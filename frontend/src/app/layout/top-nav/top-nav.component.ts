import { Component, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { AlertesService } from '../../core/services/alertes.service';
import { NotificationStreamService } from '../../core/services/notification-stream.service';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatIconModule, MatMenuModule,
    MatDividerModule, MatBadgeModule, MatTooltipModule,
  ],
  template: `
    <header class="topnav">

      <!-- ── Toggle + Brand ──────────────────────────── -->
      <div class="topnav__left">
        <button class="btn-toggle" matTooltip="Menu">
          <mat-icon>menu</mat-icon>
        </button>
        <a routerLink="/dashboard" class="brand">
          <div class="brand-icon">
            <mat-icon>description</mat-icon>
          </div>
          <div class="brand-text">
            <span class="brand-name">Passidoc</span>
            <span class="brand-sub">AFYM Audit Expertise</span>
          </div>
        </a>
      </div>

      <div class="spacer"></div>

      <!-- ── Right actions ───────────────────────────── -->
      <div class="topnav__right">

        <!-- Site pill -->
        <div class="site-pill" [class.site-mg]="auth.currentUser()?.site === 'MADAGASCAR'">
          <span class="site-dot"></span>
          {{ auth.currentUser()?.site === 'REUNION' ? 'La Réunion' : 'Madagascar' }}
        </div>

        <!-- Notifications -->
        <button mat-icon-button
                [matMenuTriggerFor]="bellMenu"
                class="btn-icon"
                [class.has-notif]="totalCount() > 0"
                (click)="notifStream.markAllRead()">
          <mat-icon
            [matBadge]="totalCount() > 0 ? totalCount() : null"
            matBadgeColor="warn"
            matBadgeSize="small">notifications</mat-icon>
        </button>

        <mat-menu #bellMenu="matMenu" xPosition="before">
          @if (notifStream.notifications().length > 0) {
            <div class="menu-label"><mat-icon>task_alt</mat-icon> Tâches assignées</div>
            @for (n of notifStream.notifications().slice(0, 5); track n.id) {
              <button mat-menu-item class="notif-row" (click)="notifStream.navigateTo(n)">
                <div class="notif-body">
                  <div class="notif-msg">{{ n.message }}</div>
                  <div class="notif-titre">{{ n.titre }}</div>
                </div>
                @if (!n.read) { <span class="notif-dot"></span> }
              </button>
            }
            <mat-divider />
          }
          <div class="menu-label">
            <mat-icon>warning_amber</mat-icon> Alertes dépôt
            @if (alertes.count() > 0) {
              <span class="count-badge">{{ alertes.count() }}</span>
            }
          </div>
          @if (alertes.alertes().length === 0) {
            <div class="menu-empty"><mat-icon>check_circle</mat-icon> Aucune alerte</div>
          }
          @for (a of alertes.alertes().slice(0, 6); track a.id) {
            <a mat-menu-item [routerLink]="['/clients', a.client.id]" class="alert-row">
              <div class="alert-body">
                <div class="alert-client">{{ a.client.nom }}</div>
                <div class="alert-detail">{{ alertes.typeLabel(a.type) }} — {{ alertes.moisLabel(a.mois) }} {{ a.annee }}</div>
              </div>
              <span class="status-pill" [class.pill-retard]="a.statut === 'EN_RETARD'" [class.pill-manquant]="a.statut === 'MANQUANT'">
                {{ a.statut === 'EN_RETARD' ? 'Retard' : 'Manquant' }}
              </span>
            </a>
          }
        </mat-menu>

        <!-- User -->
        <button mat-button [matMenuTriggerFor]="userMenu" class="user-chip">
          <div class="avatar">{{ initials }}</div>
          <div class="user-meta">
            <span class="user-name">{{ auth.currentUser()?.firstName }} {{ auth.currentUser()?.lastName }}</span>
            <span class="role-pill" [class]="'role-' + auth.currentUser()?.role?.toLowerCase()">{{ roleLabel }}</span>
          </div>
          <mat-icon class="caret">expand_more</mat-icon>
        </button>

        <mat-menu #userMenu="matMenu" xPosition="before">
          <div class="user-menu-top">
            <div class="um-avatar">{{ initials }}</div>
            <div>
              <div class="um-name">{{ auth.currentUser()?.firstName }} {{ auth.currentUser()?.lastName }}</div>
              <div class="um-email">{{ auth.currentUser()?.email }}</div>
            </div>
          </div>
          <mat-divider />
          <button mat-menu-item (click)="auth.logout()">
            <mat-icon>logout</mat-icon><span>Déconnexion</span>
          </button>
        </mat-menu>

      </div>
    </header>
  `,
  styles: [`
    .topnav {
      height: 56px;
      background: white;
      border-bottom: 1px solid #e8ecf0;
      box-shadow: 0 1px 4px rgba(15,23,42,.06);
      display: flex;
      align-items: center;
      padding: 0 16px 0 12px;
      gap: 8px;
      flex-shrink: 0;
      z-index: 200;
      position: relative;
    }

    /* Left */
    .topnav__left { display: flex; align-items: center; gap: 8px; }

    .btn-toggle {
      width: 36px; height: 36px;
      border: none; background: none; cursor: pointer;
      border-radius: 8px; display: flex; align-items: center; justify-content: center;
      color: #64748b; transition: all .15s;
      flex-shrink: 0;
    }
    .btn-toggle:hover { background: #f1f5f9; color: #1e293b; }
    .btn-toggle mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .brand {
      display: flex; align-items: center; gap: 10px;
      text-decoration: none; padding: 4px 8px 4px 4px;
      border-radius: 10px; transition: background .15s;
    }
    .brand:hover { background: #f8fafc; }
    .brand-icon {
      width: 32px; height: 32px;
      background: linear-gradient(135deg, #1e3a8a 0%, #4f46e5 100%);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(79,70,229,.25);
    }
    .brand-icon mat-icon { color: white; font-size: 17px; width: 17px; height: 17px; }
    .brand-text { display: flex; flex-direction: column; gap: 1px; }
    .brand-name { font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -.4px; line-height: 1.1; }
    .brand-sub  { font-size: 9.5px; color: #94a3b8; font-weight: 500; line-height: 1; }

    .spacer { flex: 1; }

    /* Right */
    .topnav__right { display: flex; align-items: center; gap: 6px; }

    .site-pill {
      display: flex; align-items: center; gap: 5px;
      padding: 4px 11px; border-radius: 20px;
      background: #eff6ff; border: 1px solid #bfdbfe;
      font-size: 11.5px; font-weight: 600; color: #1d4ed8;
    }
    .site-pill.site-mg { background: #faf5ff; border-color: #ddd6fe; color: #7c3aed; }
    .site-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: currentColor; opacity: .7;
    }

    .btn-icon {
      color: #94a3b8 !important;
      border-radius: 8px !important;
      transition: all .15s !important;
    }
    .btn-icon:hover { background: #f1f5f9 !important; color: #475569 !important; }
    .btn-icon.has-notif { color: #f59e0b !important; animation: bell .5s ease; }
    @keyframes bell {
      0%,100% { transform: rotate(0); }
      20% { transform: rotate(-12deg); }
      40% { transform: rotate(12deg); }
      60% { transform: rotate(-7deg); }
    }

    /* Notification menu */
    .menu-label {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 16px 5px; font-size: 10.5px; font-weight: 700;
      color: #94a3b8; text-transform: uppercase; letter-spacing: .6px;
      pointer-events: none;
    }
    .menu-label mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .count-badge { background: #fee2e2; color: #dc2626; font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 20px; margin-left: auto; }
    .menu-empty { display: flex; align-items: center; gap: 6px; padding: 6px 16px; font-size: 12px; color: #94a3b8; pointer-events: none; }
    .menu-empty mat-icon { font-size: 15px; width: 15px; height: 15px; color: #22c55e; }

    .notif-row { display: flex !important; align-items: center !important; gap: 8px !important; min-width: 300px; }
    .notif-body { flex: 1; }
    .notif-msg { font-size: 12px; color: #64748b; }
    .notif-titre { font-size: 13px; font-weight: 600; color: #1e293b; }
    .notif-dot { width: 7px; height: 7px; border-radius: 50%; background: #6366f1; flex-shrink: 0; }

    .alert-row { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; min-width: 300px; }
    .alert-body { flex: 1; min-width: 0; }
    .alert-client { font-size: 13px; font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .alert-detail { font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .status-pill { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; flex-shrink: 0; }
    .pill-retard  { background: #fff7ed; color: #c2410c; }
    .pill-manquant { background: #fee2e2; color: #dc2626; }

    /* User chip */
    .user-chip {
      display: flex !important; align-items: center !important; gap: 8px !important;
      padding: 4px 8px 4px 4px !important; border-radius: 36px !important;
      height: auto !important; border: 1px solid #e2e8f0 !important;
      transition: all .15s !important;
    }
    .user-chip:hover { background: #f8fafc !important; border-color: #cbd5e1 !important; }

    .avatar {
      width: 28px; height: 28px;
      background: linear-gradient(135deg, #1e3a8a, #4f46e5);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: white; flex-shrink: 0;
    }
    .user-meta { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
    .user-name { font-size: 12.5px; font-weight: 600; color: #1e293b; line-height: 1; white-space: nowrap; }
    .role-pill { font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 20px; line-height: 1.5; }
    .role-admin            { background: #ede9fe; color: #7c3aed; }
    .role-expert_comptable { background: #dbeafe; color: #1d4ed8; }
    .role-collaborateur    { background: #f0fdf4; color: #15803d; }
    .caret { font-size: 16px !important; width: 16px !important; height: 16px !important; color: #94a3b8; }

    /* User dropdown */
    .user-menu-top { display: flex; align-items: center; gap: 12px; padding: 14px 16px; pointer-events: none; }
    .um-avatar {
      width: 38px; height: 38px;
      background: linear-gradient(135deg, #1e3a8a, #4f46e5);
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; color: white;
    }
    .um-name  { font-size: 13.5px; font-weight: 600; color: #1e293b; }
    .um-email { font-size: 11.5px; color: #94a3b8; }
  `],
})
export class TopNavComponent implements OnInit, OnDestroy {
  constructor(
    public auth: AuthService,
    public alertes: AlertesService,
    public notifStream: NotificationStreamService,
  ) {}

  totalCount = computed(() => this.alertes.count() + this.notifStream.unreadCount());

  ngOnInit()    { this.alertes.startPolling(); this.notifStream.connect(); }
  ngOnDestroy() { this.alertes.stopPolling();  this.notifStream.disconnect(); }

  get initials(): string {
    const u = this.auth.currentUser();
    if (!u) return '?';
    return ((u.firstName || '')[0] || '') + ((u.lastName || '')[0] || '');
  }

  get roleLabel(): string {
    const role = this.auth.currentUser()?.role;
    if (role === 'ADMIN') return 'Admin';
    if (role === 'EXPERT_COMPTABLE') return 'Expert';
    return 'Collaborateur';
  }
}
