import { Component, OnInit, OnDestroy, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { AlertesService } from '../../core/services/alertes.service';
import { NotificationStreamService } from '../../core/services/notification-stream.service';
import { TaskNotification } from '../../core/services/notification-stream.service';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive,
    MatButtonModule, MatIconModule, MatMenuModule,
    MatDividerModule, MatBadgeModule, MatTooltipModule,
  ],
  template: `
    <aside class="sidebar">

      <!-- ── Logo ─────────────────────────────────── -->
      <a routerLink="/dashboard" class="sidebar__brand">
        <div class="brand-icon">
          <mat-icon>description</mat-icon>
        </div>
        <div class="brand-text">
          <span class="brand-name">Passidoc</span>
          <span class="brand-sub">AFYM Audit Expertise</span>
        </div>
      </a>

      <!-- ── Navigation ────────────────────────────── -->
      <nav class="sidebar__nav">

        <span class="nav-label">Principal</span>

        <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
          <div class="nav-icon-wrap"><mat-icon>space_dashboard</mat-icon></div>
          <span>Tableau de bord</span>
        </a>

        <a routerLink="/clients" routerLinkActive="active" class="nav-item">
          <div class="nav-icon-wrap"><mat-icon>folder_shared</mat-icon></div>
          <span>Dossiers clients</span>
        </a>

        <a routerLink="/tasks" routerLinkActive="active" class="nav-item">
          <div class="nav-icon-wrap"><mat-icon>task_alt</mat-icon></div>
          <span>Tâches</span>
        </a>

        @if (auth.canManagePortefeuilles() || auth.isAdmin()) {
          <div class="nav-sep"></div>
          <span class="nav-label">Gestion</span>

          @if (auth.canManagePortefeuilles()) {
            <a routerLink="/portefeuilles" routerLinkActive="active" class="nav-item">
              <div class="nav-icon-wrap"><mat-icon>account_tree</mat-icon></div>
              <span>Portefeuilles</span>
            </a>
          }

          <a routerLink="/equipes" routerLinkActive="active" class="nav-item">
            <div class="nav-icon-wrap"><mat-icon>people</mat-icon></div>
            <span>Équipes</span>
          </a>

          @if (auth.isAdmin()) {
            <a routerLink="/admin" routerLinkActive="active" class="nav-item">
              <div class="nav-icon-wrap"><mat-icon>manage_accounts</mat-icon></div>
              <span>Utilisateurs</span>
            </a>
          }
        }

      </nav>

      <div class="sidebar__spacer"></div>

      <!-- ── Site indicator ────────────────────────── -->
      <div class="site-chip" [class.site-mg]="auth.currentUser()?.site === 'MADAGASCAR'">
        <span class="site-dot"></span>
        {{ auth.currentUser()?.site === 'REUNION' ? 'La Réunion' : 'Madagascar' }}
      </div>

      <!-- ── Notifications ─────────────────────────── -->
      <div class="sidebar__notif-row">
        <button class="notif-btn" (click)="toggleBell($event)" [class.has-notif]="totalCount() > 0">
          <mat-icon>notifications</mat-icon>
          @if (totalCount() > 0) {
            <span class="notif-badge">{{ totalCount() > 99 ? '99+' : totalCount() }}</span>
          }
        </button>

        <!-- Bell dropdown panel -->
        @if (bellOpen) {
          <div class="bell-panel" (click)="$event.stopPropagation()">

            <div class="bell-panel__header">
              <span>Notifications</span>
              @if (notifStream.unreadCount() > 0) {
                <button class="bell-mark-all" (click)="notifStream.markAllRead()">Tout marquer lu</button>
              }
            </div>

            @if (notifStream.notifications().length > 0) {
              <div class="bell-section-label">
                <mat-icon>task_alt</mat-icon> Assignations
              </div>
              <div class="bell-list">
                @for (n of notifStream.notifications().slice(0, 6); track n.id) {
                  <div class="bell-item" [class.unread]="!n.read" (click)="navigateTo(n)">
                    <div class="bell-item__icon">
                      <mat-icon>{{ notifIcon(n.type) }}</mat-icon>
                    </div>
                    <div class="bell-item__body">
                      <div class="bell-item__msg">{{ n.message }}</div>
                      @if (n.titre) {
                        <div class="bell-item__titre">{{ n.titre }}</div>
                      }
                    </div>
                    @if (!n.read) { <span class="bell-unread-dot"></span> }
                    <button class="bell-dismiss" (click)="dismiss($event, n.id)" matTooltip="Supprimer">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                }
              </div>
              <div class="bell-sep"></div>
            }

            <div class="bell-section-label">
              <mat-icon>warning_amber</mat-icon> Alertes dépôt
              @if (alertes.count() > 0) {
                <span class="bell-count">{{ alertes.count() }}</span>
              }
            </div>

            @if (alertes.alertes().length === 0) {
              <div class="bell-empty">
                <mat-icon>check_circle</mat-icon> Aucune alerte
              </div>
            }
            @for (a of alertes.alertes().slice(0, 5); track a.id) {
              <div class="bell-item alert-item" (click)="router.navigate(['/clients', a.client.id]); bellOpen=false">
                <div class="bell-item__icon alert-icon">
                  <mat-icon>schedule</mat-icon>
                </div>
                <div class="bell-item__body">
                  <div class="bell-item__msg">{{ a.client.nom }}</div>
                  <div class="bell-item__titre">{{ alertes.typeLabel(a.type) }} — {{ alertes.moisLabel(a.mois) }} {{ a.annee }}</div>
                </div>
                <span class="status-pill" [class.pill-retard]="a.statut === 'EN_RETARD'" [class.pill-manquant]="a.statut === 'MANQUANT'">
                  {{ a.statut === 'EN_RETARD' ? 'Retard' : 'Manquant' }}
                </span>
              </div>
            }

          </div>
        }
      </div>

      <!-- ── User ───────────────────────────────────── -->
      <button class="sidebar__user" [matMenuTriggerFor]="userMenu">
        <div class="user-avatar">{{ initials }}</div>
        <div class="user-meta">
          <span class="user-name">{{ auth.currentUser()?.firstName }} {{ auth.currentUser()?.lastName }}</span>
          <span class="role-pill" [class]="'role-' + auth.currentUser()?.role?.toLowerCase()">{{ roleLabel }}</span>
        </div>
        <mat-icon class="user-caret">unfold_more</mat-icon>
      </button>

      <mat-menu #userMenu="matMenu" xPosition="after" yPosition="above">
        <div class="um-header">
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

    </aside>
  `,
  styles: [`
    /* ── Sidebar shell ─────────────────────────────── */
    .sidebar {
      width: 240px;
      height: 100vh;
      background: #fff;
      border-right: 1px solid #E5E7EB;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow: hidden;
      position: relative;
    }

    /* ── Brand ──────────────────────────────────────── */
    .sidebar__brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 22px 20px 18px;
      text-decoration: none;
      flex-shrink: 0;
      border-bottom: 1px solid #F3F4F6;
    }
    .brand-icon {
      width: 36px; height: 36px; flex-shrink: 0;
      background: linear-gradient(135deg, #1D4ED8 0%, #4F46E5 100%);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(37,99,235,.28);
    }
    .brand-icon mat-icon { color: #fff; font-size: 18px; width: 18px; height: 18px; }
    .brand-text { display: flex; flex-direction: column; gap: 2px; }
    .brand-name { font-size: 15.5px; font-weight: 800; color: #111827; letter-spacing: -.5px; line-height: 1; }
    .brand-sub  { font-size: 10px; color: #9CA3AF; font-weight: 500; }

    /* ── Nav ────────────────────────────────────────── */
    .sidebar__nav {
      flex: 1;
      padding: 16px 12px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .nav-label {
      display: block;
      font-size: 10.5px;
      font-weight: 700;
      color: #9CA3AF;
      text-transform: uppercase;
      letter-spacing: .8px;
      padding: 6px 10px 4px;
      margin-top: 4px;
    }
    .nav-sep { height: 1px; background: #F3F4F6; margin: 6px 0; }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 500;
      color: #4B5563;
      transition: all .14s ease;
      cursor: pointer;
      user-select: none;
    }
    .nav-item:hover { background: #F9FAFB; color: #111827; }
    .nav-item.active { background: #EFF6FF; color: #2563EB; font-weight: 600; }

    .nav-icon-wrap {
      width: 30px; height: 30px; flex-shrink: 0;
      border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      transition: background .14s;
    }
    .nav-item:hover .nav-icon-wrap { background: #F3F4F6; }
    .nav-item.active .nav-icon-wrap { background: #DBEAFE; }
    .nav-icon-wrap mat-icon { font-size: 17px; width: 17px; height: 17px; color: inherit; }

    /* ── Spacer ─────────────────────────────────────── */
    .sidebar__spacer { flex: 1; }

    /* ── Site chip ──────────────────────────────────── */
    .site-chip {
      display: flex; align-items: center; gap: 6px;
      margin: 0 12px 8px;
      padding: 6px 12px;
      border-radius: 8px;
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      font-size: 12px; font-weight: 600; color: #1D4ED8;
    }
    .site-chip.site-mg { background: #F5F3FF; border-color: #DDD6FE; color: #7C3AED; }
    .site-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: .7; }

    /* ── Notifications ──────────────────────────────── */
    .sidebar__notif-row {
      position: relative;
      padding: 0 12px 4px;
    }
    .notif-btn {
      display: flex; align-items: center; gap: 10px;
      width: 100%; padding: 8px 10px;
      border: none; background: none; cursor: pointer;
      border-radius: 8px; color: #4B5563;
      font-size: 13.5px; font-weight: 500;
      font-family: 'Inter', sans-serif;
      transition: all .14s;
      position: relative;
    }
    .notif-btn:hover { background: #F9FAFB; color: #111827; }
    .notif-btn.has-notif { color: #D97706; }
    .notif-btn mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .notif-badge {
      position: absolute; top: 4px; right: 10px;
      background: #EF4444; color: #fff;
      font-size: 10px; font-weight: 700;
      padding: 1px 5px; border-radius: 20px;
      min-width: 18px; text-align: center;
      line-height: 1.5;
    }

    /* Bell dropdown */
    .bell-panel {
      position: absolute;
      left: calc(100% + 8px);
      bottom: 0;
      width: 360px;
      background: #fff;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06);
      z-index: 1000;
      overflow: hidden;
    }
    .bell-panel__header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px 10px;
      font-size: 14px; font-weight: 700; color: #111827;
      border-bottom: 1px solid #F3F4F6;
    }
    .bell-mark-all {
      font-size: 11.5px; font-weight: 500; color: #2563EB;
      background: none; border: none; cursor: pointer;
      font-family: 'Inter', sans-serif;
    }
    .bell-mark-all:hover { text-decoration: underline; }

    .bell-section-label {
      display: flex; align-items: center; gap: 5px;
      padding: 10px 16px 4px;
      font-size: 10.5px; font-weight: 700;
      color: #9CA3AF; text-transform: uppercase; letter-spacing: .5px;
      pointer-events: none;
    }
    .bell-section-label mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .bell-count {
      background: #FEE2E2; color: #DC2626;
      font-size: 10px; font-weight: 700;
      padding: 1px 6px; border-radius: 20px; margin-left: auto;
    }

    .bell-list { max-height: 220px; overflow-y: auto; }
    .bell-sep { height: 1px; background: #F3F4F6; margin: 4px 0; }

    .bell-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px;
      cursor: pointer;
      transition: background .12s;
      position: relative;
    }
    .bell-item:hover { background: #F9FAFB; }
    .bell-item.unread { background: #FAFBFF; }
    .bell-item.unread:hover { background: #F0F4FF; }

    .bell-item__icon {
      width: 32px; height: 32px; flex-shrink: 0;
      background: #EFF6FF; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
    }
    .bell-item__icon mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563EB; }
    .alert-icon { background: #FFF7ED; }
    .alert-icon mat-icon { color: #D97706; }

    .bell-item__body { flex: 1; min-width: 0; }
    .bell-item__msg   { font-size: 12px; color: #6B7280; line-height: 1.3; }
    .bell-item__titre { font-size: 13px; font-weight: 600; color: #111827; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .bell-unread-dot { width: 7px; height: 7px; border-radius: 50%; background: #2563EB; flex-shrink: 0; }

    .bell-dismiss {
      display: flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; flex-shrink: 0;
      border: none; background: none; cursor: pointer;
      border-radius: 6px; color: #9CA3AF;
      transition: all .12s; opacity: 0;
    }
    .bell-item:hover .bell-dismiss { opacity: 1; }
    .bell-dismiss:hover { background: #FEE2E2; color: #DC2626; }
    .bell-dismiss mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .bell-empty {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 16px 10px;
      font-size: 12.5px; color: #9CA3AF;
      pointer-events: none;
    }
    .bell-empty mat-icon { font-size: 14px; width: 14px; height: 14px; color: #22C55E; }

    .status-pill {
      font-size: 10.5px; font-weight: 600;
      padding: 2px 8px; border-radius: 20px; flex-shrink: 0;
    }
    .pill-retard   { background: #FFF7ED; color: #C2410C; }
    .pill-manquant { background: #FEF2F2; color: #DC2626; }

    /* ── User ───────────────────────────────────────── */
    .sidebar__user {
      display: flex; align-items: center; gap: 10px;
      width: 100%; padding: 12px 14px 16px;
      border: none; background: none; cursor: pointer;
      border-top: 1px solid #F3F4F6;
      transition: background .14s;
      font-family: 'Inter', sans-serif;
    }
    .sidebar__user:hover { background: #F9FAFB; }

    .user-avatar {
      width: 32px; height: 32px; flex-shrink: 0;
      background: linear-gradient(135deg, #1D4ED8, #4F46E5);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: #fff;
    }
    .user-meta { flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 0; }
    .user-name  { font-size: 12.5px; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; }
    .role-pill  { font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 20px; line-height: 1.5; }
    .role-admin            { background: #F5F3FF; color: #7C3AED; }
    .role-expert_comptable { background: #EFF6FF; color: #1D4ED8; }
    .role-collaborateur    { background: #F0FDF4; color: #15803D; }
    .user-caret { font-size: 16px !important; width: 16px !important; height: 16px !important; color: #9CA3AF; margin-left: auto; }

    /* User menu popup */
    .um-header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; pointer-events: none; }
    .um-avatar {
      width: 38px; height: 38px; flex-shrink: 0;
      background: linear-gradient(135deg, #1D4ED8, #4F46E5);
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; color: #fff;
    }
    .um-name  { font-size: 13.5px; font-weight: 600; color: #111827; }
    .um-email { font-size: 11.5px; color: #9CA3AF; margin-top: 2px; }
  `],
})
export class TopNavComponent implements OnInit, OnDestroy {
  bellOpen = false;

  constructor(
    public auth: AuthService,
    public alertes: AlertesService,
    public notifStream: NotificationStreamService,
    public router: Router,
  ) {}

  totalCount = computed(() => this.alertes.count() + this.notifStream.unreadCount());

  ngOnInit()    { this.alertes.startPolling(); this.notifStream.connect(); }
  ngOnDestroy() { this.alertes.stopPolling();  this.notifStream.disconnect(); }

  toggleBell(e: Event) {
    e.stopPropagation();
    this.bellOpen = !this.bellOpen;
    if (this.bellOpen) this.notifStream.markAllRead();
  }

  @HostListener('document:click')
  closeBell() { this.bellOpen = false; }

  navigateTo(n: TaskNotification) {
    this.bellOpen = false;
    this.notifStream.navigateTo(n);
  }

  dismiss(e: Event, id: number) {
    e.stopPropagation();
    this.notifStream.dismiss(id);
  }

  notifIcon(type: string): string {
    if (type === 'TEAM_ASSIGNED')   return 'people';
    if (type === 'CLIENT_ASSIGNED') return 'folder_shared';
    return 'task_alt';
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
