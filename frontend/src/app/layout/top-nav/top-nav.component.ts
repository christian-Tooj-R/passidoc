import { Component, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
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
    CommonModule, RouterLink, RouterLinkActive,
    MatButtonModule, MatIconModule, MatMenuModule,
    MatDividerModule, MatBadgeModule, MatTooltipModule,
  ],
  template: `
    <nav class="topnav">

      <!-- ── Brand ─────────────────────────────────────── -->
      <a routerLink="/dashboard" class="brand">
        <div class="brand-icon">
          <mat-icon>description</mat-icon>
        </div>
        <div class="brand-text">
          <span class="brand-name">Passidoc</span>
          <span class="brand-sub">AFYM Audit</span>
        </div>
      </a>

      <div class="divider"></div>

      <!-- ── Navigation items ──────────────────────────── -->
      <ul class="nav-list">
        <li>
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
            <mat-icon class="nav-icon">dashboard</mat-icon>
            <span>Tableau de bord</span>
          </a>
        </li>
        <li>
          <a routerLink="/clients" routerLinkActive="active" class="nav-item">
            <mat-icon class="nav-icon">folder_shared</mat-icon>
            <span>Dossiers</span>
          </a>
        </li>
        <li>
          <a routerLink="/tasks" routerLinkActive="active" class="nav-item">
            <mat-icon class="nav-icon">task_alt</mat-icon>
            <span>Tâches</span>
          </a>
        </li>
        @if (auth.canManagePortefeuilles()) {
          <li>
            <a routerLink="/portefeuilles" routerLinkActive="active" class="nav-item">
              <mat-icon class="nav-icon">account_tree</mat-icon>
              <span>Portefeuilles</span>
            </a>
          </li>
        }
        @if (auth.isAdmin()) {
          <li>
            <a routerLink="/equipes" routerLinkActive="active" class="nav-item">
              <mat-icon class="nav-icon">people</mat-icon>
              <span>Équipes</span>
            </a>
          </li>
          <li>
            <a routerLink="/admin" routerLinkActive="active" class="nav-item">
              <mat-icon class="nav-icon">manage_accounts</mat-icon>
              <span>Utilisateurs</span>
            </a>
          </li>
        }
      </ul>

      <!-- ── Spacer ─────────────────────────────────────── -->
      <div class="spacer"></div>

      <!-- ── Site badge ─────────────────────────────────── -->
      <div class="site-badge" [class.site-mg]="auth.currentUser()?.site === 'MADAGASCAR'">
        <mat-icon>location_on</mat-icon>
        <span>{{ auth.currentUser()?.site === 'REUNION' ? 'La Réunion' : 'Madagascar' }}</span>
      </div>

      <!-- ── Notifications ─────────────────────────────── -->
      <button mat-icon-button
              [matMenuTriggerFor]="bellMenu"
              class="btn-notif"
              [class.has-notif]="totalCount() > 0"
              (click)="notifStream.markAllRead()"
              matTooltip="Notifications">
        <mat-icon
          [matBadge]="totalCount() > 0 ? totalCount() : null"
          matBadgeColor="warn"
          matBadgeSize="small">
          notifications
        </mat-icon>
      </button>

      <mat-menu #bellMenu="matMenu" xPosition="before" class="bell-menu">
        @if (notifStream.notifications().length > 0) {
          <div class="menu-section-label">
            <mat-icon>task_alt</mat-icon> Tâches assignées
          </div>
          @for (n of notifStream.notifications().slice(0, 5); track n.id) {
            <button mat-menu-item class="notif-item" (click)="notifStream.navigateTo(n)">
              <div class="notif-body">
                <div class="notif-msg">{{ n.message }}</div>
                <div class="notif-titre">{{ n.titre }}</div>
              </div>
              @if (!n.read) { <span class="notif-dot"></span> }
            </button>
          }
          <mat-divider />
        }
        <div class="menu-section-label">
          <mat-icon>warning_amber</mat-icon> Alertes dépôt
          @if (alertes.count() > 0) {
            <span class="alert-count">{{ alertes.count() }}</span>
          }
        </div>
        @if (alertes.alertes().length === 0) {
          <div class="menu-empty">
            <mat-icon>check_circle</mat-icon> Aucune alerte
          </div>
        }
        @for (a of alertes.alertes().slice(0, 6); track a.id) {
          <a mat-menu-item [routerLink]="['/clients', a.client.id]" class="alert-item">
            <div class="alert-body">
              <div class="alert-client">{{ a.client.nom }}</div>
              <div class="alert-detail">{{ alertes.typeLabel(a.type) }} — {{ alertes.moisLabel(a.mois) }} {{ a.annee }}</div>
            </div>
            <span class="badge" [class.badge-retard]="a.statut === 'EN_RETARD'" [class.badge-manquant]="a.statut === 'MANQUANT'">
              {{ a.statut === 'EN_RETARD' ? 'Retard' : 'Manquant' }}
            </span>
          </a>
        }
      </mat-menu>

      <!-- ── User button ────────────────────────────────── -->
      <button mat-button [matMenuTriggerFor]="userMenu" class="user-btn">
        <div class="user-avatar">{{ initials }}</div>
        <div class="user-info">
          <span class="user-name">{{ auth.currentUser()?.firstName }} {{ auth.currentUser()?.lastName }}</span>
          <span class="role-badge" [class]="'role-' + auth.currentUser()?.role?.toLowerCase()">{{ roleLabel }}</span>
        </div>
        <mat-icon class="chevron">expand_more</mat-icon>
      </button>

      <mat-menu #userMenu="matMenu" xPosition="before">
        <div class="user-menu-header">
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

    </nav>
  `,
  styles: [`
    /* ═══════════════════════════════════════════
       TOPNAV CONTAINER
    ═══════════════════════════════════════════ */
    .topnav {
      height: 58px;
      background: white;
      border-bottom: 1px solid #e8ecf0;
      box-shadow: 0 1px 0 #e8ecf0, 0 2px 8px rgba(15,32,64,.05);
      display: flex;
      align-items: center;
      padding: 0 20px;
      gap: 4px;
      flex-shrink: 0;
      position: relative;
      z-index: 100;
    }

    /* ═══════════════════════════════════════════
       BRAND
    ═══════════════════════════════════════════ */
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      padding: 6px 10px 6px 4px;
      border-radius: 10px;
      transition: background .15s;
      flex-shrink: 0;
    }
    .brand:hover { background: #f8fafc; }
    .brand-icon {
      width: 34px; height: 34px;
      background: linear-gradient(135deg, #1e3a8a, #4f46e5);
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(79,70,229,.3);
    }
    .brand-icon mat-icon { color: white; font-size: 18px; width: 18px; height: 18px; }
    .brand-text { display: flex; flex-direction: column; gap: 1px; }
    .brand-name { font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -.4px; line-height: 1; }
    .brand-sub  { font-size: 10px; color: #94a3b8; font-weight: 500; line-height: 1; }

    .divider {
      width: 1px; height: 24px;
      background: #e2e8f0;
      margin: 0 12px;
      flex-shrink: 0;
    }

    /* ═══════════════════════════════════════════
       NAV LIST
    ═══════════════════════════════════════════ */
    .nav-list {
      display: flex;
      align-items: center;
      gap: 2px;
      list-style: none;
      padding: 0; margin: 0;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 7px 13px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 500;
      color: #64748b;
      transition: all .15s ease;
      white-space: nowrap;
      position: relative;
    }
    .nav-item:hover {
      color: #1e293b;
      background: #f1f5f9;
    }
    .nav-item.active {
      color: #4f46e5;
      background: #eef2ff;
      font-weight: 600;
    }
    .nav-item.active .nav-icon {
      color: #4f46e5;
    }
    /* Active indicator line */
    .nav-item.active::after {
      content: '';
      position: absolute;
      bottom: -9px;
      left: 50%;
      transform: translateX(-50%);
      width: 20px; height: 2px;
      background: #4f46e5;
      border-radius: 2px;
    }

    .nav-icon {
      font-size: 17px;
      width: 17px; height: 17px;
      color: #94a3b8;
      transition: color .15s;
    }
    .nav-item:hover .nav-icon { color: #475569; }

    /* ═══════════════════════════════════════════
       SPACER + RIGHT SECTION
    ═══════════════════════════════════════════ */
    .spacer { flex: 1; }

    /* ═══════════════════════════════════════════
       SITE BADGE
    ═══════════════════════════════════════════ */
    .site-badge {
      display: flex; align-items: center; gap: 5px;
      padding: 4px 10px;
      background: #f0f4ff;
      border: 1px solid #c7d2fe;
      border-radius: 20px;
      font-size: 11.5px; font-weight: 600; color: #4338ca;
      flex-shrink: 0;
      margin-right: 6px;
    }
    .site-badge.site-mg {
      background: #fdf4ff;
      border-color: #e9d5ff;
      color: #7c3aed;
    }
    .site-badge mat-icon { font-size: 13px; width: 13px; height: 13px; }

    /* ═══════════════════════════════════════════
       NOTIFICATION BELL
    ═══════════════════════════════════════════ */
    .btn-notif {
      color: #94a3b8 !important;
      transition: all .15s !important;
      border-radius: 8px !important;
    }
    .btn-notif:hover { color: #475569 !important; background: #f1f5f9 !important; }
    .btn-notif.has-notif {
      color: #f59e0b !important;
      animation: bell-pulse .5s ease;
    }
    @keyframes bell-pulse {
      0%,100% { transform: rotate(0); }
      20% { transform: rotate(-12deg); }
      40% { transform: rotate(12deg); }
      60% { transform: rotate(-7deg); }
      80% { transform: rotate(7deg); }
    }

    /* ═══════════════════════════════════════════
       NOTIFICATION MENU ITEMS
    ═══════════════════════════════════════════ */
    .menu-section-label {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 16px 6px;
      font-size: 11px; font-weight: 700;
      color: #94a3b8; text-transform: uppercase; letter-spacing: .5px;
      pointer-events: none;
    }
    .menu-section-label mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .alert-count {
      background: #fee2e2; color: #dc2626;
      font-size: 10px; font-weight: 700;
      padding: 1px 7px; border-radius: 20px;
      margin-left: auto;
    }
    .menu-empty {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 16px; font-size: 12px; color: #94a3b8;
      pointer-events: none;
    }
    .menu-empty mat-icon { font-size: 15px; width: 15px; height: 15px; color: #22c55e; }

    .notif-item { display: flex !important; align-items: center !important; gap: 8px !important; min-width: 300px; }
    .notif-body { flex: 1; }
    .notif-msg { font-size: 12px; color: #64748b; }
    .notif-titre { font-size: 13px; font-weight: 600; color: #1e293b; }
    .notif-dot { width: 8px; height: 8px; border-radius: 50%; background: #6366f1; flex-shrink: 0; }

    .alert-item { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; min-width: 300px; }
    .alert-body { flex: 1; min-width: 0; }
    .alert-client { font-size: 13px; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .alert-detail { font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; flex-shrink: 0; }
    .badge-retard { background: #fff7ed; color: #c2410c; }
    .badge-manquant { background: #fee2e2; color: #dc2626; }

    /* ═══════════════════════════════════════════
       USER BUTTON
    ═══════════════════════════════════════════ */
    .user-btn {
      display: flex !important;
      align-items: center !important;
      gap: 9px !important;
      padding: 4px 10px 4px 5px !important;
      border-radius: 40px !important;
      height: auto !important;
      border: 1px solid #e8ecf0 !important;
      margin-left: 4px;
      transition: all .15s !important;
    }
    .user-btn:hover { background: #f8fafc !important; border-color: #cbd5e1 !important; }

    .user-avatar {
      width: 30px; height: 30px;
      background: linear-gradient(135deg, #1e3a8a, #4f46e5);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: white;
      flex-shrink: 0;
    }
    .user-info { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
    .user-name { font-size: 12.5px; font-weight: 600; color: #1e293b; line-height: 1; white-space: nowrap; }
    .role-badge { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 20px; line-height: 1.4; }
    .role-admin               { background: #ede9fe; color: #7c3aed; }
    .role-expert_comptable    { background: #dbeafe; color: #1d4ed8; }
    .role-collaborateur       { background: #f0fdf4; color: #15803d; }
    .chevron { font-size: 16px !important; width: 16px !important; height: 16px !important; color: #94a3b8; }

    /* ═══════════════════════════════════════════
       USER DROPDOWN
    ═══════════════════════════════════════════ */
    .user-menu-header { display: flex; align-items: center; gap: 12px; padding: 16px; pointer-events: none; }
    .menu-avatar {
      width: 40px; height: 40px;
      background: linear-gradient(135deg, #1e3a8a, #4f46e5);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; color: white;
    }
    .menu-name { font-size: 14px; font-weight: 600; color: #1e293b; }
    .menu-email { font-size: 12px; color: #94a3b8; }
  `],
})
export class TopNavComponent implements OnInit, OnDestroy {
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
    return ((u.firstName || '')[0] || '') + ((u.lastName || '')[0] || '');
  }

  get roleLabel(): string {
    const role = this.auth.currentUser()?.role;
    if (role === 'ADMIN') return 'Admin';
    if (role === 'EXPERT_COMPTABLE') return 'Expert';
    return 'Collaborateur';
  }
}
