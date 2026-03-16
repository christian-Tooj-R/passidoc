import { Component, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../core/services/auth.service';
import { AlertesService } from '../../core/services/alertes.service';
import { NotificationStreamService } from '../../core/services/notification-stream.service';

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

        <!-- Bell : alertes flux + tâches -->
        <button mat-icon-button [matMenuTriggerFor]="bellMenu" class="btn-bell"
                [class.has-notif]="totalCount() > 0"
                (click)="notifStream.markAllRead()">
          <mat-icon
            [matBadge]="totalCount() > 0 ? totalCount() : null"
            matBadgeColor="warn"
            matBadgeSize="small">
            notifications
          </mat-icon>
        </button>

        <mat-menu #bellMenu="matMenu" xPosition="before" class="bell-menu">

          <!-- Notifications -->
          @if (notifStream.notifications().length > 0) {
            <div class="section-header">
              <mat-icon>notifications_active</mat-icon> Notifications
              @if (notifStream.unreadCount() > 0) {
                <span class="section-count">{{ notifStream.unreadCount() }}</span>
              }
            </div>
            @for (n of notifStream.notifications().slice(0, 6); track n.id) {
              <button mat-menu-item class="notif-item" (click)="notifStream.navigateTo(n)">
                <span class="notif-icon notif-{{ n.type.toLowerCase() }}">
                  <mat-icon>{{ n.type === 'TASK_ASSIGNED' ? 'task_alt' : n.type === 'CLIENT_ASSIGNED' ? 'folder_shared' : 'people' }}</mat-icon>
                </span>
                <div class="notif-item__body">
                  <div class="notif-item__msg">{{ n.message }}</div>
                  <div class="notif-item__titre">{{ n.titre }}</div>
                </div>
                @if (!n.read) { <span class="notif-dot"></span> }
              </button>
            }
            <mat-divider />
          } @else {
            <div class="empty-section">
              <mat-icon>notifications_none</mat-icon> Aucune notification
            </div>
            <mat-divider />
          }

          <!-- Alertes flux mensuels -->
          <div class="section-header">
            <mat-icon>warning_amber</mat-icon> Alertes dépôt
            @if (alertes.count() > 0) {
              <span class="section-count">{{ alertes.count() }}</span>
            }
          </div>
          @if (alertes.alertes().length === 0) {
            <div class="empty-section">
              <mat-icon>check_circle</mat-icon> Aucune alerte
            </div>
          }
          @for (a of alertes.alertes().slice(0, 6); track a.id) {
            <a mat-menu-item [routerLink]="['/clients', a.client.id]" class="alert-item">
              <div class="alert-item__body">
                <div class="alert-item__client">{{ a.client.nom }}</div>
                <div class="alert-item__detail">
                  {{ alertes.typeLabel(a.type) }} — {{ alertes.moisLabel(a.mois) }} {{ a.annee }}
                </div>
              </div>
              <span class="badge" [class.badge-retard]="a.statut === 'EN_RETARD'"
                    [class.badge-manquant]="a.statut === 'MANQUANT'">
                {{ a.statut === 'EN_RETARD' ? 'En retard' : 'Manquant' }}
              </span>
            </a>
          }
        </mat-menu>

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

    .section-header {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 16px 6px; font-size: 11px; font-weight: 700;
      color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;
      pointer-events: none;
    }
    .section-header mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .section-count { background: #fee2e2; color: #dc2626; font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 20px; margin-left: auto; }

    .notif-item { display: flex !important; align-items: center !important; gap: 8px !important; min-width: 300px; }
    .notif-item__body { flex: 1; }
    .notif-item__msg { font-size: 12px; color: #64748b; }
    .notif-item__titre { font-size: 13px; font-weight: 600; color: #1e293b; }
    .notif-dot { width: 8px; height: 8px; border-radius: 50%; background: #6366f1; flex-shrink: 0; }
    .notif-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .notif-icon mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .notif-task_assigned   { background: #eef2ff; color: #6366f1; }
    .notif-client_assigned { background: #f0fdf4; color: #15803d; }
    .notif-team_assigned   { background: #fef3c7; color: #d97706; }

    .empty-section { display: flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: 12px; color: #94a3b8; pointer-events: none; }
    .empty-section mat-icon { font-size: 15px; width: 15px; height: 15px; color: #22c55e; }

    .alert-item { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; min-width: 300px; }
    .alert-item__body { flex: 1; min-width: 0; }
    .alert-item__client { font-size: 13px; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .alert-item__detail { font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; flex-shrink: 0; }
    .badge-retard { background: #fff7ed; color: #c2410c; }
    .badge-manquant { background: #fee2e2; color: #dc2626; }

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
  constructor(
    public auth: AuthService,
    public alertes: AlertesService,
    public notifStream: NotificationStreamService,
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
