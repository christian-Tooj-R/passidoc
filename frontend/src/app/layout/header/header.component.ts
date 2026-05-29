import { Component, OnInit, OnDestroy, computed, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../core/services/auth.service';
import { AlertesService } from '../../core/services/alertes.service';
import { NotificationStreamService, TaskNotification } from '../../core/services/notification-stream.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule, MatButtonModule, MatIconModule,
    MatMenuModule, MatDividerModule,
  ],
  template: `
    <header class="topbar">

      <!-- ── Recherche globale ───────────────────── -->
      <div class="search-bar" [class.search-bar--focused]="searchFocused">
        <mat-icon class="search-bar__icon">search</mat-icon>
        <input class="search-bar__input"
               type="text"
               placeholder="Rechercher client, dossier, document…"
               (focus)="searchFocused = true"
               (blur)="searchFocused = false" />
      </div>

      <!-- ── Right ────────────────────────────────── -->
      <div class="topbar__right">

        <!-- Bell -->
        <div class="bell-wrap">
          <button class="icon-btn" [class.bell-active]="totalCount() > 0"
                  (click)="toggleBell($event)" aria-label="Notifications">
            <mat-icon>notifications</mat-icon>
            @if (totalCount() > 0) {
              <span class="notif-badge">{{ totalCount() > 99 ? '99+' : totalCount() }}</span>
            }
          </button>

          @if (bellOpen) {
            <div class="bell-panel" (click)="$event.stopPropagation()">

              <div class="bell-panel__head">
                <span class="bell-panel__title">Notifications</span>
                @if (notifStream.unreadCount() > 0) {
                  <button class="mark-all-btn" (click)="notifStream.markAllRead()">Tout marquer lu</button>
                }
              </div>

              <!-- Assignations -->
              <div class="bell-section">
                <mat-icon>task_alt</mat-icon> Assignations
              </div>
              <div class="bell-list">
                @if (notifStream.notifications().length === 0) {
                  <div class="bell-empty">
                    <mat-icon>notifications_none</mat-icon> Aucune notification
                  </div>
                }
                @for (n of notifStream.notifications(); track n.id) {
                  <div class="bell-item" [class.unread]="!n.read">
                    <div class="bell-item__click" (click)="navigateTo(n)">
                      <span class="bell-icon notif-{{ n.type.toLowerCase() }}">
                        <mat-icon>{{ typeIcon(n.type) }}</mat-icon>
                      </span>
                      <div class="bell-body">
                        <div class="bell-msg">{{ n.message }}</div>
                        <div class="bell-time">{{ n.createdAt | date:'dd/MM · HH:mm' }}</div>
                      </div>
                    </div>
                    <button class="dismiss-btn" (click)="notifStream.dismiss(n.id)" title="Supprimer">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                }
              </div>

              <div class="bell-sep"></div>

              <!-- Alertes -->
              <div class="bell-section">
                <mat-icon>warning_amber</mat-icon> Alertes dépôt
                @if (alertes.count() > 0) {
                  <span class="alert-count">{{ alertes.count() }}</span>
                }
              </div>
              <div class="bell-list">
                @if (alertes.alertes().length === 0) {
                  <div class="bell-empty">
                    <mat-icon style="color:#19D9B4">check_circle</mat-icon> Aucune alerte
                  </div>
                }
                @for (a of alertes.alertes().slice(0, 8); track a.id) {
                  <div class="bell-item alert-row" (click)="goToClient(a.client.id)">
                    <div class="bell-item__click">
                      <span class="bell-icon alert-icon">
                        <mat-icon>schedule</mat-icon>
                      </span>
                      <div class="bell-body">
                        <div class="bell-msg" style="font-weight:600;color:#162351">{{ a.client.nom }}</div>
                        <div class="bell-time">{{ alertes.typeLabel(a.type) }} — {{ alertes.moisLabel(a.mois) }} {{ a.annee }}</div>
                      </div>
                    </div>
                    <span class="status-pill" [class.pill-retard]="a.statut === 'EN_RETARD'" [class.pill-manquant]="a.statut === 'MANQUANT'">
                      {{ a.statut === 'EN_RETARD' ? 'Retard' : 'Manquant' }}
                    </span>
                  </div>
                }
              </div>

            </div>
          }
        </div>

        <!-- User -->
        <button class="user-btn" [matMenuTriggerFor]="userMenu">
          <div class="user-avatar">{{ initials }}</div>
          <div class="user-info">
            <span class="user-name">{{ auth.currentUser()?.firstName }} {{ auth.currentUser()?.lastName }}</span>
            <span class="role-badge" [class]="'role-' + auth.currentUser()?.role?.toLowerCase()">{{ roleLabel }}</span>
          </div>
          <mat-icon class="user-caret">expand_more</mat-icon>
        </button>

        <mat-menu #userMenu="matMenu" xPosition="before">
          <div class="menu-head">
            <div class="menu-avatar">{{ initials }}</div>
            <div>
              <div class="menu-name">{{ auth.currentUser()?.firstName }} {{ auth.currentUser()?.lastName }}</div>
              <div class="menu-email">{{ auth.currentUser()?.email }}</div>
            </div>
          </div>
          <mat-divider />
          <button mat-menu-item (click)="auth.logout()">
            <mat-icon>logout</mat-icon>
            <span>Déconnexion</span>
          </button>
        </mat-menu>

      </div>
    </header>
  `,
  styles: [`
    /* ── Topbar ─────────────────────────────────── */
    .topbar {
      height: 52px;
      background: var(--page-header-bg, #FFFBFE);
      border-bottom: 1px solid var(--page-header-border, #E0E2EC);
      backdrop-filter: var(--panel-backdrop, none);
      -webkit-backdrop-filter: var(--panel-backdrop, none);
      box-shadow: 0 1px 2px rgba(0,0,0,.06);
      display: flex;
      align-items: center;
      padding: 0 24px;
      flex-shrink: 0;
      gap: 12px;
    }
    .topbar__right { display: flex; align-items: center; gap: 6px; margin-left: auto; }

    /* ── Recherche globale ───────────────────────── */
    .search-bar {
      flex: 1;
      max-width: 520px;
      display: flex; align-items: center; gap: 10px;
      height: 34px;
      background: #F1F5F9;
      border-radius: 10px;
      border: 1.5px solid transparent;
      padding: 0 12px;
      transition: border-color .18s, background .18s, box-shadow .18s;
      cursor: text;
    }
    .search-bar--focused {
      background: #fff;
      border-color: #6366F1;
      box-shadow: 0 0 0 3px rgba(99,102,241,.10);
    }
    .search-bar__icon {
      font-size: 18px; width: 18px; height: 18px;
      color: #94A3B8; flex-shrink: 0; transition: color .18s;
    }
    .search-bar--focused .search-bar__icon { color: #6366F1; }
    .search-bar__input {
      flex: 1; border: none; background: transparent; outline: none;
      font-size: 13.5px; font-family: 'Inter', sans-serif;
      color: #1A1F36;
    }
    .search-bar__input::placeholder { color: #94A3B8; }

    /* ── MD3 Icon buttons ────────────────────────── */
    .icon-btn {
      position: relative;
      width: 34px; height: 34px;
      border: none;
      background: transparent;
      border-radius: 8px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: var(--panel-text, #44474F);
      transition: background .12s, color .12s;
    }
    .icon-btn:hover { background: var(--panel-hover-bg, #E8EAED); }
    .icon-btn.bell-active { color: #7B4F00; background: #FFDDB0; }
    .icon-btn mat-icon { font-size: 19px; width: 19px; height: 19px; }

    .notif-badge {
      position: absolute; top: -5px; right: -5px;
      background: #DC2626; color: #fff;
      font-size: 9.5px; font-weight: 700;
      padding: 1px 4px; border-radius: 20px;
      min-width: 16px; text-align: center; line-height: 1.5;
      border: 1.5px solid #fff;
    }

    /* ── Bell panel ─────────────────────────────── */
    .bell-wrap { position: relative; }
    .bell-panel {
      position: absolute;
      top: calc(100% + 8px); right: 0;
      width: 400px;
      background: #FFFBFE;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,.25), 0 8px 12px 6px rgba(0,0,0,.12);
      z-index: 1000;
      overflow: hidden;
    }

    .bell-panel__head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px 10px;
      border-bottom: 1px solid #F0F2F8;
    }
    .bell-panel__title { font-size: 14px; font-weight: 700; color: #162351; }
    .mark-all-btn {
      font-size: 11.5px; font-weight: 500; color: #19D9B4;
      background: none; border: none; cursor: pointer;
      font-family: 'Inter', sans-serif; padding: 0;
    }
    .mark-all-btn:hover { text-decoration: underline; }

    .bell-section {
      display: flex; align-items: center; gap: 5px;
      padding: 10px 16px 4px;
      font-size: 10.5px; font-weight: 700;
      color: #9BA6C2; text-transform: uppercase; letter-spacing: .5px;
      pointer-events: none;
    }
    .bell-section mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .alert-count {
      margin-left: auto;
      background: #FEE2E2; color: #DC2626;
      font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 20px;
    }

    .bell-sep { height: 1px; background: #F0F2F8; margin: 4px 0; }
    .bell-list { max-height: 200px; overflow-y: auto; padding-bottom: 6px; }
    .bell-list::-webkit-scrollbar { width: 4px; }
    .bell-list::-webkit-scrollbar-thumb { background: #E4E7F0; border-radius: 4px; }

    .bell-item {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 14px 9px 16px;
      transition: background .12s;
    }
    .bell-item:hover { background: #F8F9FC; }
    .bell-item.unread { background: #F0FBF9; }
    .bell-item.unread:hover { background: #E6F9F5; }
    .bell-item.alert-row { cursor: pointer; }

    .bell-item__click {
      display: flex; align-items: center; gap: 10px;
      flex: 1; min-width: 0; cursor: pointer;
    }

    .bell-icon {
      width: 32px; height: 32px; flex-shrink: 0;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .bell-icon mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .notif-task_assigned   { background: #E6FBF7; color: #0E9E83; }
    .notif-client_assigned { background: #EEF0F8; color: #162351; }
    .notif-team_assigned   { background: #F5F3FF; color: #7C3AED; }
    .alert-icon            { background: #FFFBEB; color: #D97706; }

    .bell-body { flex: 1; min-width: 0; }
    .bell-msg  { font-size: 13px; color: #2D3A5E; line-height: 1.4; }
    .bell-time { font-size: 11px; color: #9BA6C2; margin-top: 2px; }

    .dismiss-btn {
      width: 26px; height: 26px; flex-shrink: 0;
      border: none; background: none; cursor: pointer;
      border-radius: 6px; color: #C9CEEA;
      display: flex; align-items: center; justify-content: center;
      transition: all .12s; opacity: 0;
    }
    .bell-item:hover .dismiss-btn { opacity: 1; }
    .dismiss-btn:hover { background: #FEE2E2; color: #DC2626; }
    .dismiss-btn mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .bell-empty {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 16px;
      font-size: 12.5px; color: #9BA6C2;
      pointer-events: none;
    }
    .bell-empty mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .status-pill { font-size: 10.5px; font-weight: 600; padding: 2px 8px; border-radius: 6px; flex-shrink: 0; }
    .pill-retard   { background: #FFF7ED; color: #C2410C; }
    .pill-manquant { background: #FEF2F2; color: #DC2626; }

    /* ── User button ────────────────────────────── */
    .user-btn {
      display: flex; align-items: center; gap: 7px;
      padding: 3px 8px 3px 4px;
      border: 1px solid var(--panel-border, #E4E7F0);
      border-radius: 40px;
      background: var(--page-card-bg, #fff);
      cursor: pointer;
      transition: all .15s;
      font-family: 'Inter', sans-serif;
    }
    .user-btn:hover { background: var(--panel-hover-bg, #F8F9FC); border-color: var(--panel-border, #C9CEEA); }

    .user-avatar {
      width: 26px; height: 26px; flex-shrink: 0;
      background: linear-gradient(135deg, #19D9B4, #53DA85);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700; color: #162351;
    }
    .user-info { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
    .user-name  { font-size: 12.5px; font-weight: 600; color: var(--panel-title, #162351); line-height: 1; white-space: nowrap; }
    .role-badge { font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 20px; line-height: 1.5; }
    .role-admin            { background: #E6FBF7; color: #0E9E83; }
    .role-expert_comptable { background: #EEF0F8; color: #162351; }
    .role-collaborateur    { background: #F0FDF4; color: #15803D; }
    .user-caret { font-size: 16px !important; width: 16px !important; height: 16px !important; color: #9BA6C2; }

    /* User menu */
    .menu-head { display: flex; align-items: center; gap: 12px; padding: 14px 16px; pointer-events: none; }
    .menu-avatar {
      width: 38px; height: 38px; flex-shrink: 0;
      background: linear-gradient(135deg, #19D9B4, #53DA85);
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; color: #162351;
    }
    .menu-name  { font-size: 13.5px; font-weight: 600; color: #162351; }
    .menu-email { font-size: 11.5px; color: #9BA6C2; margin-top: 2px; }
  `],
})
export class HeaderComponent implements OnInit, OnDestroy {
  bellOpen     = false;
  searchFocused = false;

  constructor(
    public auth: AuthService,
    public alertes: AlertesService,
    public notifStream: NotificationStreamService,
    private router: Router,
    private elRef: ElementRef,
  ) {}

  totalCount = computed(() => this.alertes.count() + this.notifStream.unreadCount());

  ngOnInit() {
    this.alertes.startPolling();
    this.notifStream.connect();
  }

  ngOnDestroy() {
    this.alertes.stopPolling();
    this.notifStream.disconnect();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elRef.nativeElement.contains(event.target)) this.bellOpen = false;
  }

  toggleBell(event: MouseEvent) {
    event.stopPropagation();
    this.bellOpen = !this.bellOpen;
    if (this.bellOpen) this.notifStream.markAllRead();
  }

  navigateTo(n: TaskNotification) {
    this.bellOpen = false;
    n.read = true;
    if (n.type === 'TEAM_ASSIGNED') {
      this.router.navigate(['/equipes']);
    } else if (n.clientId) {
      const queryParams = n.type === 'TASK_ASSIGNED' ? { tab: 'tasks' } : {};
      this.router.navigate(['/clients', n.clientId], { queryParams });
    }
  }

  goToClient(clientId: number) {
    this.bellOpen = false;
    this.router.navigate(['/clients', clientId]);
  }

  typeIcon(type: string): string {
    if (type === 'TEAM_ASSIGNED')   return 'people';
    if (type === 'CLIENT_ASSIGNED') return 'folder_shared';
    return 'task_alt';
  }

  get initials(): string {
    const u = this.auth.currentUser();
    if (!u) return '?';
    return (u.firstName?.[0] || '') + (u.lastName?.[0] || '');
  }

  get roleLabel(): string {
    const role = this.auth.currentUser()?.role;
    if (role === 'ADMIN') return 'Admin';
    if (role === 'EXPERT_COMPTABLE') return 'Expert';
    return 'Collaborateur';
  }
}
