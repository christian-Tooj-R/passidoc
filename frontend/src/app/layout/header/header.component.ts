import { Component, OnInit, OnDestroy, computed, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../core/services/auth.service';
import { AlertesService } from '../../core/services/alertes.service';
import { NotificationStreamService, TaskNotification } from '../../core/services/notification-stream.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule, RouterLink, MatButtonModule, MatIconModule,
    MatMenuModule, MatDividerModule, MatBadgeModule,
  ],
  template: `
    <header class="header">
      <div class="header__spacer"></div>

      <div class="header__right">

        <!-- Bell button -->
        <div class="bell-wrapper">
          <button mat-icon-button class="btn-bell" [class.has-notif]="totalCount() > 0"
                  (click)="toggleBell($event)">
            <mat-icon
              [matBadge]="totalCount() > 0 ? totalCount() : null"
              matBadgeColor="warn"
              matBadgeSize="small">
              notifications
            </mat-icon>
          </button>

          <!-- Dropdown custom -->
          @if (bellOpen) {
            <div class="bell-dropdown" (click)="$event.stopPropagation()">

              <!-- Section Notifications -->
              <div class="dropdown-section-header">
                <span class="dropdown-section-title">
                  <mat-icon>notifications_active</mat-icon> Notifications
                </span>
                @if (notifStream.unreadCount() > 0) {
                  <span class="section-count">{{ notifStream.unreadCount() }} non lue(s)</span>
                }
              </div>

              <div class="notif-list">
                @if (notifStream.notifications().length === 0) {
                  <div class="empty-section">
                    <mat-icon>notifications_none</mat-icon> Aucune notification
                  </div>
                }
                @for (n of notifStream.notifications(); track n.id) {
                  <div class="notif-item" [class.unread]="!n.read">
                    <div class="notif-item__clickable" (click)="navigateTo(n)">
                      <span class="notif-icon notif-{{ n.type.toLowerCase() }}">
                        <mat-icon>{{ n.type === 'TASK_ASSIGNED' ? 'task_alt' : n.type === 'CLIENT_ASSIGNED' ? 'folder_shared' : 'people' }}</mat-icon>
                      </span>
                      <div class="notif-item__body">
                        <div class="notif-item__msg">{{ n.message }}</div>
                        <div class="notif-item__time">{{ n.createdAt | date:'dd/MM HH:mm' }}</div>
                      </div>
                    </div>
                    <button class="notif-dismiss" (click)="notifStream.dismiss(n.id)" title="Effacer">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                }
              </div>

              <mat-divider />

              <!-- Section Alertes -->
              <div class="dropdown-section-header">
                <span class="dropdown-section-title">
                  <mat-icon>warning_amber</mat-icon> Alertes dépôt
                </span>
                @if (alertes.count() > 0) {
                  <span class="section-count warn">{{ alertes.count() }}</span>
                }
              </div>

              <div class="notif-list">
                @if (alertes.alertes().length === 0) {
                  <div class="empty-section">
                    <mat-icon style="color:#22c55e">check_circle</mat-icon> Aucune alerte
                  </div>
                }
                @for (a of alertes.alertes().slice(0, 8); track a.id) {
                  <div class="notif-item alert-row" (click)="goToClient(a.client.id)">
                    <div class="notif-item__body">
                      <div class="notif-item__msg" style="font-weight:600;color:#1e293b">{{ a.client.nom }}</div>
                      <div class="notif-item__time">{{ alertes.typeLabel(a.type) }} — {{ alertes.moisLabel(a.mois) }} {{ a.annee }}</div>
                    </div>
                    <span class="badge" [class.badge-retard]="a.statut === 'EN_RETARD'" [class.badge-manquant]="a.statut === 'MANQUANT'">
                      {{ a.statut === 'EN_RETARD' ? 'En retard' : 'Manquant' }}
                    </span>
                  </div>
                }
              </div>

            </div>
          }
        </div>

        <!-- User button -->
        <button mat-button [matMenuTriggerFor]="userMenu" class="header__user-btn">
          <div class="user-avatar">{{ initials }}</div>
          <div class="user-info">
            <span class="user-name">{{ auth.currentUser()?.firstName }} {{ auth.currentUser()?.lastName }}</span>
            <span class="user-role-badge" [class]="'role-' + auth.currentUser()?.role?.toLowerCase()">
              {{ roleLabel }}
            </span>
          </div>
          <mat-icon class="chevron">expand_more</mat-icon>
        </button>
      </div>

      <mat-menu #userMenu="matMenu" xPosition="before">
        <div class="menu-header">
          <div class="menu-avatar">{{ initials }}</div>
          <div>
            <div class="menu-name">{{ auth.currentUser()?.firstName }} {{ auth.currentUser()?.lastName }}</div>
            <div class="menu-email">{{ auth.currentUser()?.email }}</div>
          </div>
        </div>
        <mat-divider></mat-divider>
        <button mat-menu-item (click)="auth.logout()">
          <mat-icon>logout</mat-icon>
          <span>Déconnexion</span>
        </button>
      </mat-menu>
    </header>
  `,
  styles: [`
    .header {
      height: 60px; background: white;
      border-bottom: 1px solid #e8ecf0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      display: flex; align-items: center;
      padding: 0 28px; flex-shrink: 0;
    }
    .header__spacer { flex: 1; }
    .header__right { display: flex; align-items: center; gap: 4px; }

    .btn-bell { color: #94a3b8 !important; transition: color 0.2s; }
    .btn-bell.has-notif { color: #f59e0b !important; animation: bell-shake 0.5s ease; }
    @keyframes bell-shake {
      0%,100% { transform: rotate(0); }
      20% { transform: rotate(-12deg); }
      40% { transform: rotate(12deg); }
      60% { transform: rotate(-8deg); }
      80% { transform: rotate(8deg); }
    }

    /* Bell dropdown custom */
    .bell-wrapper { position: relative; }
    .bell-dropdown {
      position: absolute; top: calc(100% + 8px); right: 0;
      width: 480px;
      background: white;
      border: 1px solid #e8ecf0;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
      z-index: 1000;
      overflow: hidden;
    }

    .dropdown-section-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px 8px;
      background: #f8fafc;
      border-bottom: 1px solid #f1f5f9;
    }
    .dropdown-section-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; color: #94a3b8;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .dropdown-section-title mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .section-count { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; background: #fee2e2; color: #dc2626; }
    .section-count.warn { background: #fff7ed; color: #c2410c; }

    /* Scrollable list */
    .notif-list { max-height: 240px; overflow-y: auto; }
    .notif-list::-webkit-scrollbar { width: 4px; }
    .notif-list::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }

    /* Notification item */
    .notif-item {
      display: flex; align-items: center;
      padding: 4px 12px 4px 16px; gap: 8px;
      transition: background 0.12s;
      min-height: 48px;
    }
    .notif-item:hover { background: #f8fafc; }
    .notif-item.unread { background: #f5f3ff; }
    .notif-item.unread:hover { background: #ede9fe; }
    .notif-item.alert-row { cursor: pointer; }

    .notif-item__clickable {
      display: flex; align-items: center; gap: 10px;
      flex: 1; min-width: 0; cursor: pointer; padding: 6px 0;
    }
    .notif-item__body { flex: 1; min-width: 0; }
    .notif-item__msg { font-size: 13px; color: #374151; line-height: 1.4; white-space: normal; }
    .notif-item__time { font-size: 11px; color: #cbd5e1; margin-top: 2px; }

    .notif-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .notif-icon mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .notif-task_assigned   { background: #eef2ff; color: #6366f1; }
    .notif-client_assigned { background: #f0fdf4; color: #15803d; }
    .notif-team_assigned   { background: #fef3c7; color: #d97706; }

    .notif-dismiss {
      background: none; border: none; cursor: pointer;
      padding: 4px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      color: #d1d5db; flex-shrink: 0; width: 26px; height: 26px;
      transition: color 0.15s, background 0.15s;
    }
    .notif-dismiss mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .notif-dismiss:hover { color: #f87171; background: #fee2e2; }

    .empty-section { display: flex; align-items: center; gap: 6px; padding: 12px 16px; font-size: 12px; color: #94a3b8; }
    .empty-section mat-icon { font-size: 15px; width: 15px; height: 15px; }

    .badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; flex-shrink: 0; }
    .badge-retard { background: #fff7ed; color: #c2410c; }
    .badge-manquant { background: #fee2e2; color: #dc2626; }

    /* User menu */
    .header__user-btn {
      display: flex !important; align-items: center !important; gap: 10px !important;
      padding: 5px 10px 5px 6px !important; border-radius: 40px !important;
      height: auto !important; border: 1px solid #e8ecf0 !important;
      transition: all 0.15s !important; margin-left: 4px;
    }
    .header__user-btn:hover { background: #f8fafc !important; }
    .user-avatar {
      width: 34px; height: 34px;
      background: linear-gradient(135deg, #1e40af, #3730a3);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: white; flex-shrink: 0;
    }
    .user-info { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
    .user-name { font-size: 13px; font-weight: 600; color: #1e293b; line-height: 1; }
    .user-role-badge { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 20px; line-height: 1.4; }
    .role-admin { background: #ede9fe; color: #7c3aed; }
    .role-expert_comptable { background: #dbeafe; color: #1d4ed8; }
    .role-collaborateur { background: #f0fdf4; color: #15803d; }
    .chevron { font-size: 18px !important; width: 18px !important; height: 18px !important; color: #94a3b8; }

    .menu-header { display: flex; align-items: center; gap: 12px; padding: 16px; pointer-events: none; }
    .menu-avatar {
      width: 40px; height: 40px;
      background: linear-gradient(135deg, #1e40af, #3730a3);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; color: white;
    }
    .menu-name { font-size: 14px; font-weight: 600; color: #1e293b; }
    .menu-email { font-size: 12px; color: #94a3b8; }
  `],
})
export class HeaderComponent implements OnInit, OnDestroy {
  bellOpen = false;

  constructor(
    public auth: AuthService,
    public alertes: AlertesService,
    public notifStream: NotificationStreamService,
    private router: Router,
    private elRef: ElementRef,
  ) {}

  totalCount = computed(() => this.alertes.count() + this.notifStream.unreadCount());

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.bellOpen = false;
    }
  }

  toggleBell(event: MouseEvent) {
    event.stopPropagation();
    this.bellOpen = !this.bellOpen;
    if (this.bellOpen) {
      this.notifStream.markAllRead();
    }
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

  ngOnInit() {
    this.alertes.startPolling();
    this.notifStream.connect();
  }

  ngOnDestroy() {
    this.alertes.stopPolling();
    this.notifStream.disconnect();
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
