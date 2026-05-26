import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ToastService } from '../../core/services/toast.service';
import { UsersService } from '../../core/services/users.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationStreamService } from '../../core/services/notification-stream.service';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-equipes',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatRippleModule, MatTooltipModule],
  template: `
<div class="page" (click)="assignPanelUserId.set(null)">

  @if (auth.isAdmin()) {
  <!-- ══ VUE ADMIN ══════════════════════════════════════════ -->

  <div class="page-header">
    <div>
      <h1 class="page-title">Toutes les équipes</h1>
      <p class="page-sub">
        {{ madagascarCollabs.length }} collaborateur(s) Madagascar ·
        <span class="stat-ok">{{ assignedCount }} assigné(s)</span>
        @if (madagascarCollabs.length - assignedCount > 0) {
          · <span class="stat-warn">{{ madagascarCollabs.length - assignedCount }} sans équipe</span>
        }
      </p>
    </div>
  </div>

  <div class="info-banner">
    <mat-icon>info</mat-icon>
    <span>Seul le collaborateur Réunion lié (et l'admin) peut assigner des tâches à un collaborateur Madagascar.</span>
  </div>

  <!-- Search -->
  <div class="search-bar" (click)="$event.stopPropagation()">
    <mat-icon>search</mat-icon>
    <input class="search-input" type="text"
           placeholder="Rechercher un collaborateur…"
           [value]="searchQuery()"
           (input)="searchQuery.set($any($event.target).value)" />
    @if (searchQuery()) {
      <button class="search-clear" (click)="searchQuery.set('')">
        <mat-icon>close</mat-icon>
      </button>
    }
  </div>

  <!-- Table -->
  <div class="table-wrap">
    <table class="table">
      <thead>
        <tr>
          <th>Collaborateur Madagascar</th>
          <th>Équipe Réunion</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (u of filteredMgCollabs; track u.id) {
          <tr class="tr-main" [class.tr-main--open]="assignPanelUserId() === u.id">
            <td>
              <div class="user-cell">
                <div class="avatar mg">{{ u.firstName[0] }}{{ u.lastName[0] }}</div>
                <div>
                  <div class="cell-name">{{ u.firstName }} {{ u.lastName }}</div>
                  <div class="cell-email">{{ u.email }}</div>
                </div>
              </div>
            </td>
            <td>
              @if (u.referentId) {
                <div class="user-cell">
                  <div class="avatar re">{{ getReferentInitials(u.referentId) }}</div>
                  <span class="cell-name">{{ getReferentName(u.referentId) }}</span>
                </div>
              } @else {
                <span class="badge-none">Non assigné</span>
              }
            </td>
            <td class="td-action">
              <button class="btn-action"
                      [class.btn-action--active]="assignPanelUserId() === u.id"
                      matRipple
                      (click)="$event.stopPropagation(); openAssignPanel(u.id)">
                <mat-icon>{{ u.referentId ? 'swap_horiz' : 'add_link' }}</mat-icon>
                {{ u.referentId ? 'Changer' : 'Assigner' }}
              </button>
            </td>
          </tr>

          @if (assignPanelUserId() === u.id) {
            <tr class="tr-panel">
              <td colspan="3" (click)="$event.stopPropagation()">
                <div class="assign-bar">
                  <span class="assign-label">Assigner à :</span>
                  <div class="assign-chips">
                    @for (r of reunionUsers; track r.id) {
                      <button class="assign-chip"
                              [class.assign-chip--active]="u.referentId === r.id"
                              matRipple
                              (click)="setReferentAndClose(u, r.id)">
                        <div class="avatar re sm">{{ r.firstName[0] }}{{ r.lastName[0] }}</div>
                        {{ r.firstName }} {{ r.lastName }}
                        @if (u.referentId === r.id) {
                          <mat-icon class="chip-check">check_circle</mat-icon>
                        }
                      </button>
                    }
                    @if (u.referentId) {
                      <button class="assign-chip assign-chip--remove" matRipple
                              (click)="setReferentAndClose(u, null)">
                        <mat-icon>link_off</mat-icon>
                        Retirer
                      </button>
                    }
                  </div>
                </div>
              </td>
            </tr>
          }
        }

        @if (filteredMgCollabs.length === 0) {
          <tr>
            <td colspan="3" class="td-empty">
              <mat-icon>{{ searchQuery() ? 'search_off' : 'people_outline' }}</mat-icon>
              <span>{{ searchQuery() ? 'Aucun résultat pour "' + searchQuery() + '"' : 'Aucun collaborateur Madagascar' }}</span>
            </td>
          </tr>
        }
      </tbody>
    </table>
  </div>

  } @else {
  <!-- ══ VUE NON-ADMIN (Mon équipe) ═════════════════════════ -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Mon équipe</h1>
        <p class="page-sub">
          @if (auth.currentUser()?.site === 'REUNION') { Vos collaborateurs Madagascar rattachés }
          @else { Votre collaborateur Réunion référent }
        </p>
      </div>
    </div>

    @if (auth.currentUser()?.site === 'REUNION') {
      @if (myTeam && myTeam.team.length > 0) {
        <div class="my-team-grid">
          @for (m of myTeam.team; track m.id) {
            <div class="member-card">
              <div class="avatar mg lg">{{ m.firstName[0] }}{{ m.lastName[0] }}</div>
              <div>
                <div class="cell-name" style="font-size:15px">{{ m.firstName }} {{ m.lastName }}</div>
                <div style="font-size:12px;color:#6366F1;font-weight:600;margin-top:2px">🇲🇬 Collaborateur Madagascar</div>
                <div class="cell-email" style="margin-top:2px">{{ m.email }}</div>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="empty-team">
          <mat-icon>people_outline</mat-icon>
          <p>Aucun collaborateur Madagascar ne vous est rattaché.</p>
          <span>Contactez l'administrateur pour configurer votre équipe.</span>
        </div>
      }
    } @else {
      @if (myTeam && myTeam.referent) {
        <div class="my-team-grid">
          <div class="member-card">
            <div class="avatar re lg">{{ myTeam.referent.firstName[0] }}{{ myTeam.referent.lastName[0] }}</div>
            <div>
              <div class="cell-name" style="font-size:15px">{{ myTeam.referent.firstName }} {{ myTeam.referent.lastName }}</div>
              <div style="font-size:12px;color:#6366F1;font-weight:600;margin-top:2px">🇷🇪 Référent Réunion</div>
              <div class="cell-email" style="margin-top:2px">{{ myTeam.referent.email }}</div>
            </div>
          </div>
        </div>
      } @else {
        <div class="empty-team">
          <mat-icon>person_off</mat-icon>
          <p>Vous n'avez pas encore de collaborateur Réunion référent.</p>
          <span>Contactez l'administrateur pour être rattaché à une équipe.</span>
        </div>
      }
    }
  }
</div>
  `,
  styles: [`
    .page { padding: 0 0 56px; max-width: 960px; }

    /* ── Header ──────────────────────────────────────────────── */
    .page-header  { margin-bottom: 20px; }
    .page-title   { font-size: 22px; font-weight: 800; color: #0F172A; margin: 0; }
    .page-sub     { font-size: 13px; color: #64748B; margin: 4px 0 0; }
    .stat-ok      { color: #059669; font-weight: 600; }
    .stat-warn    { color: #D97706; font-weight: 600; }

    /* ── Info banner ─────────────────────────────────────────── */
    .info-banner {
      display: flex; align-items: flex-start; gap: 8px;
      background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px;
      padding: 12px 16px; margin-bottom: 18px;
      font-size: 13px; color: #1D4ED8; line-height: 1.5;
    }
    .info-banner mat-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px; }

    /* ── Search ──────────────────────────────────────────────── */
    .search-bar {
      display: flex; align-items: center; gap: 8px;
      border: 1.5px solid #E2E8F0; border-radius: 10px;
      padding: 9px 12px; margin-bottom: 16px; background: white;
      &:focus-within { border-color: #6366F1; }
    }
    .search-bar mat-icon { color: #94A3B8; font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    .search-input {
      flex: 1; border: none; outline: none;
      font-size: 13.5px; font-family: inherit; color: #0F172A; background: transparent;
      &::placeholder { color: #94A3B8; }
    }
    .search-clear {
      border: none; background: none; cursor: pointer; padding: 2px;
      display: flex; align-items: center; color: #94A3B8; border-radius: 4px;
      &:hover { color: #475569; }
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    /* ── Table ───────────────────────────────────────────────── */
    .table-wrap {
      background: white; border-radius: 14px; overflow: hidden;
      border: 1px solid #E2E8F0;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
    }
    .table { width: 100%; border-collapse: collapse; }
    .table thead th {
      padding: 12px 20px; text-align: left;
      font-size: 11px; font-weight: 700; color: #94A3B8;
      text-transform: uppercase; letter-spacing: .7px;
      background: #F8FAFC; border-bottom: 1px solid #E2E8F0;
    }
    .tr-main {
      border-bottom: 1px solid #F1F5F9;
      transition: background .1s;
      &:last-child { border-bottom: none; }
      &:hover { background: #F8FAFC; }
      &--open { background: #F5F3FF !important; }
    }
    .tr-main td { padding: 12px 20px; vertical-align: middle; }
    .td-action { text-align: right; width: 130px; }

    /* ── Assign panel row ───────────────────────────────────── */
    .tr-panel td { padding: 0 20px 14px; background: #F5F3FF; border-bottom: 1px solid #E0E7FF; }
    .assign-bar {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
      padding: 10px 0 0;
    }
    .assign-label { font-size: 12px; font-weight: 600; color: #6366F1; white-space: nowrap; flex-shrink: 0; }
    .assign-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .assign-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 12px 5px 6px; border: 1.5px solid #E2E8F0;
      border-radius: 20px; background: white; cursor: pointer;
      font-size: 12.5px; font-weight: 500; color: #334155;
      font-family: inherit; transition: border-color .12s, background .12s;
      &:hover { border-color: #A5B4FC; background: #EEF2FF; }
      &--active { border-color: #6366F1; background: #EEF2FF; color: #3730A3; }
      &--remove { border-color: #FECACA; color: #DC2626; background: #FFF5F5;
                  &:hover { background: #FEE2E2; } }
    }
    .assign-chip .avatar { flex-shrink: 0; }
    .chip-check { font-size: 14px !important; width: 14px !important; height: 14px !important; color: #6366F1 !important; }
    .assign-chip--remove mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* ── Cells ───────────────────────────────────────────────── */
    .user-cell  { display: flex; align-items: center; gap: 10px; }
    .cell-name  { font-size: 13.5px; font-weight: 600; color: #1E293B; }
    .cell-email { font-size: 11.5px; color: #94A3B8; margin-top: 1px; }
    .badge-none { font-size: 12.5px; color: #94A3B8; font-style: italic; }

    .btn-action {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 12px; border: 1.5px solid #E2E8F0;
      border-radius: 8px; background: white; cursor: pointer;
      font-size: 12.5px; font-weight: 600; color: #475569;
      font-family: inherit; transition: border-color .12s, background .12s, color .12s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { border-color: #A5B4FC; background: #EEF2FF; color: #4338CA; }
      &--active { border-color: #6366F1; background: #EEF2FF; color: #4338CA; }
    }

    /* ── Avatars ─────────────────────────────────────────────── */
    .avatar {
      width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
    }
    .avatar.mg { background: #DCFCE7; color: #15803D; }
    .avatar.re { background: #DBEAFE; color: #1D4ED8; }
    .avatar.sm { width: 24px; height: 24px; font-size: 9px; border-radius: 6px; }
    .avatar.lg { width: 50px; height: 50px; font-size: 17px; border-radius: 14px; }

    /* ── Empty ───────────────────────────────────────────────── */
    .td-empty {
      text-align: center; padding: 48px !important;
      color: #94A3B8; font-size: 14px;
      mat-icon { display: block; font-size: 36px; width: 36px; height: 36px; margin: 0 auto 8px; opacity: .5; }
    }

    /* ── Non-admin ───────────────────────────────────────────── */
    .my-team-grid { display: flex; flex-wrap: wrap; gap: 14px; }
    .member-card {
      display: flex; align-items: center; gap: 14px;
      background: white; border: 1px solid #E2E8F0; border-radius: 12px;
      padding: 18px 22px; min-width: 260px;
      box-shadow: 0 1px 3px rgba(0,0,0,.04);
    }
    .empty-team {
      display: flex; flex-direction: column; align-items: center;
      padding: 64px 32px; text-align: center; color: #94A3B8;
      mat-icon { font-size: 44px; width: 44px; height: 44px; margin-bottom: 14px; opacity: .4; }
      p    { font-size: 14px; color: #64748B; font-weight: 500; margin: 0 0 6px; }
      span { font-size: 13px; }
    }
  `],
})
export class EquipesComponent implements OnInit, OnDestroy {
  private usersService = inject(UsersService);
  private toast        = inject(ToastService);
  auth = inject(AuthService);
  private notifStream  = inject(NotificationStreamService);
  private sub = new Subscription();

  users:  User[] = [];
  myTeam: { referent: User | null; team: User[] } | null = null;

  searchQuery       = signal('');
  assignPanelUserId = signal<number | null>(null);

  get madagascarCollabs(): User[] {
    return this.users.filter(u => u.site === 'MADAGASCAR' && u.role !== 'ADMIN' && u.isActive);
  }
  get reunionUsers(): User[] {
    return this.users.filter(u => u.site === 'REUNION' && u.isActive);
  }
  get filteredMgCollabs(): User[] {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.madagascarCollabs;
    return this.madagascarCollabs.filter(u =>
      `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)
    );
  }
  get assignedCount(): number {
    return this.madagascarCollabs.filter(u => !!u.referentId).length;
  }

  ngOnInit() {
    this.load();
    this.sub.add(
      this.notifStream.newNotif$.pipe(filter(n => n.type === 'TEAM_ASSIGNED')).subscribe(() => this.load())
    );
  }
  ngOnDestroy() { this.sub.unsubscribe(); }

  private load() {
    if (this.auth.isAdmin()) {
      this.usersService.getAll().subscribe(u => this.users = u);
    } else {
      this.usersService.getMyTeam().subscribe(t => this.myTeam = t);
    }
  }

  getReferentName(referentId: number): string {
    const u = this.users.find(u => u.id === referentId);
    return u ? `${u.firstName} ${u.lastName}` : 'Inconnu';
  }
  getReferentInitials(referentId: number): string {
    const u = this.users.find(u => u.id === referentId);
    return u ? `${u.firstName[0]}${u.lastName[0]}` : '?';
  }
  openAssignPanel(userId: number) {
    this.assignPanelUserId.set(this.assignPanelUserId() === userId ? null : userId);
  }
  setReferent(user: User, referentId: number | null) {
    this.usersService.setReferent(user.id, referentId).subscribe(updated => {
      user.referentId = updated.referentId;
      this.toast.success('Équipe mise à jour');
    });
  }
  setReferentAndClose(user: User, referentId: number | null) {
    this.setReferent(user, referentId);
    this.assignPanelUserId.set(null);
  }
}
