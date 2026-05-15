import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
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
  imports: [CommonModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatSelectModule],
  template: `
    <div class="page">
      @if (auth.isAdmin()) {
        <!-- ======= VUE ADMIN ======= -->
        <div class="page-header">
          <div class="page-header__left">
            <mat-icon class="page-icon">people</mat-icon>
            <div>
              <h1>Équipes</h1>
              <p>Lier chaque collaborateur Madagascar à son collaborateur Réunion</p>
            </div>
          </div>
        </div>

        <div class="info-banner">
          <mat-icon>info</mat-icon>
          <span>
            Seul le collaborateur Réunion lié (et l'admin) peut assigner des tâches à un collaborateur Madagascar.
            Un collaborateur Réunion ne peut pas assigner à l'équipe d'un autre.
          </span>
        </div>

        <!-- Vue par collaborateur Réunion -->
        @for (ref of reunionUsers; track ref.id) {
          <div class="team-card">
            <div class="team-card__header">
              <div class="user-avatar re">{{ ref.firstName[0] }}{{ ref.lastName[0] }}</div>
              <div>
                <div class="team-name">{{ ref.firstName }} {{ ref.lastName }}</div>
                <div class="team-site">🇷🇪 Collaborateur Réunion</div>
              </div>
              <span class="team-count">{{ getTeam(ref.id).length }} collaborateur(s) Madagascar</span>
            </div>
            <div class="team-members">
              @for (m of getTeam(ref.id); track m.id) {
                <div class="member-chip">
                  <div class="user-avatar mg sm">{{ m.firstName[0] }}{{ m.lastName[0] }}</div>
                  <span>{{ m.firstName }} {{ m.lastName }}</span>
                  <button mat-icon-button class="btn-remove" (click)="setReferent(m, null)" matTooltip="Retirer de l'équipe">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              }
              @if (getTeam(ref.id).length === 0) {
                <span class="no-member">Aucun collaborateur assigné</span>
              }
            </div>
          </div>
        }

        <!-- Table assignation -->
        <h2 class="section-title" style="margin-top:32px">
          <mat-icon>swap_horiz</mat-icon> Configurer les liens
        </h2>
        <div class="table-card">
          <table class="table">
            <thead>
              <tr>
                <th>Collaborateur Madagascar</th>
                <th>Collaborateur Réunion actuel</th>
                <th>Modifier</th>
              </tr>
            </thead>
            <tbody>
              @for (u of madagascarCollabs; track u.id) {
                <tr class="table-row">
                  <td>
                    <div class="user-cell">
                      <div class="user-avatar mg">{{ u.firstName[0] }}{{ u.lastName[0] }}</div>
                      <div>
                        <div class="user-name">{{ u.firstName }} {{ u.lastName }}</div>
                        <div class="text-muted">{{ u.email }}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    @if (u.referentId) {
                      <div class="user-cell">
                        <div class="user-avatar re sm">{{ getReferentInitials(u.referentId) }}</div>
                        <span>{{ getReferentName(u.referentId) }}</span>
                      </div>
                    } @else {
                      <span class="none">Non configuré</span>
                    }
                  </td>
                  <td>
                    <mat-form-field appearance="outline" class="assign-field">
                      <mat-select [value]="u.referentId || null" (selectionChange)="setReferent(u, $event.value)">
                        <mat-option [value]="null">— Aucun —</mat-option>
                        @for (r of reunionUsers; track r.id) {
                          <mat-option [value]="r.id">{{ r.firstName }} {{ r.lastName }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </td>
                </tr>
              }
              @if (madagascarCollabs.length === 0) {
                <tr><td colspan="3" class="empty-state">
                  <mat-icon>people_outline</mat-icon><span>Aucun collaborateur à Madagascar</span>
                </td></tr>
              }
            </tbody>
          </table>
        </div>

      } @else {
        <!-- ======= VUE NON-ADMIN (Mon équipe) ======= -->
        <div class="page-header">
          <div class="page-header__left">
            <mat-icon class="page-icon">people</mat-icon>
            <div>
              <h1>Mon équipe</h1>
              @if (auth.currentUser()?.site === 'REUNION') {
                <p>Vos collaborateurs Madagascar rattachés</p>
              } @else {
                <p>Votre collaborateur Réunion référent</p>
              }
            </div>
          </div>
        </div>

        @if (auth.currentUser()?.site === 'REUNION') {
          <!-- Collab Réunion : voir son équipe MG -->
          @if (myTeam && myTeam.team.length > 0) {
            <div class="my-team-grid">
              @for (m of myTeam.team; track m.id) {
                <div class="member-card">
                  <div class="user-avatar mg lg">{{ m.firstName[0] }}{{ m.lastName[0] }}</div>
                  <div class="member-info">
                    <div class="member-name">{{ m.firstName }} {{ m.lastName }}</div>
                    <div class="member-role">🇲🇬 Collaborateur Madagascar</div>
                    <div class="member-email">{{ m.email }}</div>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="empty-team">
              <mat-icon>people_outline</mat-icon>
              <p>Aucun collaborateur Madagascar ne vous est rattaché pour l'instant.</p>
              <span>Contactez l'administrateur pour configurer votre équipe.</span>
            </div>
          }
        } @else {
          <!-- Collab Madagascar : voir son référent Réunion -->
          @if (myTeam && myTeam.referent) {
            <div class="my-team-grid">
              <div class="member-card">
                <div class="user-avatar re lg">{{ myTeam.referent.firstName[0] }}{{ myTeam.referent.lastName[0] }}</div>
                <div class="member-info">
                  <div class="member-name">{{ myTeam.referent.firstName }} {{ myTeam.referent.lastName }}</div>
                  <div class="member-role">🇷🇪 Collaborateur Réunion — Référent</div>
                  <div class="member-email">{{ myTeam.referent.email }}</div>
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
    .page { padding: 32px; max-width: 1100px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .page-header__left { display: flex; align-items: center; gap: 16px; }
    .page-icon { font-size: 32px; width: 32px; height: 32px; color: #6366f1; }
    .page-header h1 { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0; line-height: 1.2; }
    .page-header p { font-size: 13px; color: #94a3b8; margin: 0; }

    .info-banner { display: flex; align-items: flex-start; gap: 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px 18px; margin-bottom: 28px; font-size: 13px; color: #1d4ed8; line-height: 1.5; }
    .info-banner mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }

    /* Team cards */
    .team-card { background: white; border: 1px solid #e8ecf0; border-radius: 14px; padding: 18px 20px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .team-card__header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .team-name { font-size: 15px; font-weight: 700; color: #1e293b; }
    .team-site { font-size: 12px; color: #94a3b8; }
    .team-count { margin-left: auto; font-size: 12px; font-weight: 600; color: #6366f1; background: #eef2ff; padding: 3px 10px; border-radius: 20px; }
    .team-members { display: flex; flex-wrap: wrap; gap: 8px; }
    .member-chip { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 30px; padding: 4px 6px 4px 10px; font-size: 13px; color: #1e293b; font-weight: 500; }
    .btn-remove { color: #cbd5e1 !important; width: 24px !important; height: 24px !important; }
    .btn-remove:hover { color: #f87171 !important; }
    ::ng-deep .btn-remove .mat-icon { font-size: 14px !important; width: 14px !important; height: 14px !important; }
    .no-member { font-size: 13px; color: #cbd5e1; font-style: italic; padding: 4px 0; }

    .section-title { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: #1e293b; margin: 0 0 16px; }
    .section-title mat-icon { font-size: 20px; width: 20px; height: 20px; color: #6366f1; }

    /* Table */
    .table-card { background: white; border-radius: 16px; border: 1px solid #e8ecf0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); overflow: hidden; }
    .table { width: 100%; border-collapse: collapse; }
    .table thead th { padding: 14px 20px; text-align: left; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; background: #f8fafc; border-bottom: 1px solid #e8ecf0; }
    .table-row { border-bottom: 1px solid #f1f5f9; transition: background 0.12s; }
    .table-row:last-child { border-bottom: none; }
    .table-row:hover { background: #f8fafc; }
    .table td { padding: 12px 20px; vertical-align: middle; }

    .user-cell { display: flex; align-items: center; gap: 10px; }
    .user-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; text-transform: uppercase; }
    .user-avatar.mg { background: linear-gradient(135deg, #dcfce7, #bbf7d0); color: #15803d; }
    .user-avatar.re { background: linear-gradient(135deg, #dbeafe, #bfdbfe); color: #1d4ed8; }
    .user-avatar.sm { width: 28px; height: 28px; font-size: 10px; }
    .user-name { font-size: 14px; font-weight: 600; color: #1e293b; }
    .text-muted { font-size: 12px; color: #94a3b8; }
    .none { font-size: 13px; color: #cbd5e1; font-style: italic; }

    .assign-field { width: 200px; }
    ::ng-deep .assign-field .mat-mdc-form-field-subscript-wrapper { display: none; }
    ::ng-deep .assign-field .mat-mdc-text-field-wrapper { padding: 0 8px; }

    .empty-state { text-align: center; padding: 48px !important; color: #94a3b8; }
    .empty-state mat-icon { font-size: 36px; width: 36px; height: 36px; display: block; margin: 0 auto 8px; }

    /* Non-admin "Mon équipe" */
    .my-team-grid { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 8px; }
    .member-card { display: flex; align-items: center; gap: 16px; background: white; border: 1px solid #e8ecf0; border-radius: 14px; padding: 20px 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); min-width: 280px; }
    .user-avatar.lg { width: 52px; height: 52px; font-size: 18px; }
    .member-info { display: flex; flex-direction: column; gap: 3px; }
    .member-name { font-size: 16px; font-weight: 700; color: #1e293b; }
    .member-role { font-size: 12px; color: #6366f1; font-weight: 600; }
    .member-email { font-size: 12px; color: #94a3b8; }
    .empty-team { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 32px; text-align: center; color: #94a3b8; }
    .empty-team mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 16px; color: #cbd5e1; }
    .empty-team p { font-size: 15px; color: #64748b; font-weight: 500; margin: 0 0 6px; }
    .empty-team span { font-size: 13px; color: #94a3b8; }

    /* ── Permissions ── */
    .perm-card { background: white; border: 1px solid #e8ecf0; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .perm-role-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .perm-role-tab {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 20px; border-radius: 12px;
      border: 2px solid #e8ecf0; background: #f8fafc;
      font-size: 14px; font-weight: 600; color: #64748b;
      cursor: pointer; transition: all .15s;
    }
    .perm-role-tab.active { border-color: #6366f1; background: #eef2ff; color: #4338ca; }
    .perm-role-badge { font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 6px; }
    .badge--ec  { background: #dbeafe; color: #1d4ed8; }
    .badge--col { background: #dcfce7; color: #15803d; }
    .perm-hint { font-size: 13px; color: #94a3b8; margin: 0 0 20px; line-height: 1.5; }
    .perm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-bottom: 24px; }
    .perm-item {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px; border-radius: 12px;
      border: 2px solid #e8ecf0; background: #f8fafc;
      cursor: pointer; transition: all .15s; user-select: none;
    }
    .perm-item:hover { border-color: #a5b4fc; background: #f5f3ff; }
    .perm-item--checked { border-color: #6366f1; background: #eef2ff; }
    .perm-item__icon { width: 36px; height: 36px; border-radius: 10px; background: #e0e7ff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .perm-item--checked .perm-item__icon { background: #6366f1; }
    .perm-item__icon mat-icon { font-size: 18px; width: 18px; height: 18px; color: #6366f1; }
    .perm-item--checked .perm-item__icon mat-icon { color: white; }
    .perm-item__label { flex: 1; font-size: 13.5px; font-weight: 600; color: #334155; }
    .perm-item--checked .perm-item__label { color: #3730a3; }
    .perm-item__check mat-icon { font-size: 20px; width: 20px; height: 20px; color: #cbd5e1; }
    .perm-item--checked .perm-item__check mat-icon { color: #6366f1; }
    .perm-actions { display: flex; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 1px solid #f1f5f9; }
    .perm-count { font-size: 13px; color: #94a3b8; font-weight: 500; }
    .btn-save-perms {
      display: inline-flex; align-items: center; gap: 8px;
      background: #6366f1; color: white; border: none;
      border-radius: 10px; padding: 10px 22px;
      font-size: 13.5px; font-weight: 600; cursor: pointer;
      transition: background .15s; font-family: inherit;
    }
    .btn-save-perms:hover:not(:disabled) { background: #4f46e5; }
    .btn-save-perms:disabled { opacity: .6; cursor: default; }
    .btn-save-perms mat-icon { font-size: 18px; width: 18px; height: 18px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spin { animation: spin 1s linear infinite; }
  `],
})
export class EquipesComponent implements OnInit, OnDestroy {
  private usersService = inject(UsersService);
  private toast        = inject(ToastService);
  auth = inject(AuthService);
  private notifStream = inject(NotificationStreamService);
  private sub = new Subscription();

  users: User[] = [];
  myTeam: { referent: User | null; team: User[] } | null = null;


  get madagascarCollabs(): User[] {
    return this.users.filter(u => u.site === 'MADAGASCAR' && u.role !== 'ADMIN' && u.isActive);
  }
  get reunionUsers(): User[] {
    return this.users.filter(u => u.site === 'REUNION' && u.isActive);
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

  getTeam(referentId: number): User[] {
    return this.madagascarCollabs.filter(u => u.referentId === referentId);
  }

  getReferentName(referentId: number): string {
    const u = this.users.find(u => u.id === referentId);
    return u ? `${u.firstName} ${u.lastName}` : 'Inconnu';
  }

  getReferentInitials(referentId: number): string {
    const u = this.users.find(u => u.id === referentId);
    return u ? `${u.firstName[0]}${u.lastName[0]}` : '?';
  }

  setReferent(user: User, referentId: number | null) {
    this.usersService.setReferent(user.id, referentId).subscribe(updated => {
      user.referentId = updated.referentId;
      this.toast.success('Équipe mise à jour');
    });
  }

}

