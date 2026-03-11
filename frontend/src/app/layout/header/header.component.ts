import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from '../../core/services/auth.service';
import { AlertesService } from '../../core/services/alertes.service';

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

        <!-- Notification bell -->
        <button mat-icon-button [matMenuTriggerFor]="alertMenu" class="btn-bell"
                [class.has-alerts]="alertes.count() > 0">
          <mat-icon
            [matBadge]="alertes.count() > 0 ? alertes.count() : null"
            matBadgeColor="warn"
            matBadgeSize="small">
            notifications
          </mat-icon>
        </button>

        <mat-menu #alertMenu="matMenu" xPosition="before" class="alert-menu">
          <div class="alert-menu__header">
            <span class="alert-menu__title">Alertes dépôt</span>
            @if (alertes.count() > 0) {
              <span class="alert-menu__count">{{ alertes.count() }} alerte(s)</span>
            }
          </div>
          <mat-divider />
          @if (alertes.alertes().length === 0) {
            <div class="alert-menu__empty">
              <mat-icon>check_circle</mat-icon>
              <span>Aucune alerte</span>
            </div>
          }
          @for (a of alertes.alertes().slice(0, 8); track a.id) {
            <a mat-menu-item [routerLink]="['/clients', a.client.id]" class="alert-item">
              <div class="alert-item__body">
                <div class="alert-item__client">{{ a.client.nom }}</div>
                <div class="alert-item__detail">
                  {{ alertes.typeLabel(a.type) }} — {{ alertes.moisLabel(a.mois) }} {{ a.annee }}
                </div>
              </div>
              <span class="alert-item__badge" [class.badge-retard]="a.statut === 'EN_RETARD'"
                    [class.badge-manquant]="a.statut === 'MANQUANT'">
                {{ a.statut === 'EN_RETARD' ? 'En retard' : 'Manquant' }}
              </span>
            </a>
          }
          @if (alertes.alertes().length > 8) {
            <div class="alert-menu__more">+ {{ alertes.alertes().length - 8 }} autres alertes</div>
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
      height: 60px;
      background: white;
      border-bottom: 1px solid #e8ecf0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      display: flex; align-items: center;
      padding: 0 28px; flex-shrink: 0;
    }
    .header__spacer { flex: 1; }
    .header__right { display: flex; align-items: center; gap: 4px; }

    /* Bell */
    .btn-bell { color: #94a3b8 !important; }
    .btn-bell.has-alerts { color: #f59e0b !important; }

    /* Alert menu */
    .alert-menu__header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px 10px; pointer-events: none;
    }
    .alert-menu__title { font-size: 13px; font-weight: 700; color: #0f172a; }
    .alert-menu__count { font-size: 11px; font-weight: 600; background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 20px; }
    .alert-menu__empty {
      display: flex; align-items: center; gap: 8px;
      padding: 16px; color: #94a3b8; font-size: 13px; pointer-events: none;
    }
    .alert-menu__empty mat-icon { font-size: 18px; width: 18px; height: 18px; color: #22c55e; }
    .alert-menu__more { padding: 8px 16px; font-size: 12px; color: #94a3b8; text-align: center; }

    .alert-item { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 12px !important; min-width: 320px; }
    .alert-item__body { flex: 1; min-width: 0; }
    .alert-item__client { font-size: 13px; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .alert-item__detail { font-size: 11px; color: #94a3b8; margin-top: 2px; }
    .alert-item__badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; flex-shrink: 0; }
    .badge-retard { background: #fff7ed; color: #c2410c; }
    .badge-manquant { background: #fee2e2; color: #dc2626; }

    /* User button */
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
  constructor(public auth: AuthService, public alertes: AlertesService) {}

  ngOnInit() { this.alertes.startPolling(); }
  ngOnDestroy() { this.alertes.stopPolling(); }

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
