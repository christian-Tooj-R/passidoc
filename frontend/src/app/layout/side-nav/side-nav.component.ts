import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  route: string;
  icon: string;
  label: string;
  adminOnly?: boolean;
  portefeuilleOnly?: boolean;
}

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule],
  template: `
    <aside class="sidenav" [class.collapsed]="!open()">

      <!-- Nav items -->
      <nav class="sidenav__nav">
        <ul>
          @for (item of visibleItems(); track item.route) {
            <li>
              <a [routerLink]="item.route"
                 routerLinkActive="active"
                 class="nav-item"
                 [matTooltip]="!open() ? item.label : ''"
                 matTooltipPosition="right">
                <span class="item-icon">
                  <mat-icon>{{ item.icon }}</mat-icon>
                </span>
                <span class="item-label">{{ item.label }}</span>
                @if (open()) {
                  <span class="item-arrow">
                    <mat-icon>chevron_right</mat-icon>
                  </span>
                }
              </a>
            </li>
          }
        </ul>
      </nav>

      <!-- Footer -->
      <div class="sidenav__footer">
        <div class="footer-divider"></div>
        <div class="footer-info" [class.centered]="!open()">
          <div class="footer-icon">
            <mat-icon>verified_user</mat-icon>
          </div>
          @if (open()) {
            <div class="footer-text">
              <span class="footer-version">v2.0.0</span>
              <span class="footer-copy">© 2026 AFYM</span>
            </div>
          }
        </div>
      </div>

    </aside>
  `,
  styles: [`
    /* ═══════════════════════════════════════════════
       SIDENAV — variables & container
    ═══════════════════════════════════════════════ */
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
    }

    .sidenav {
      width: 220px;
      height: 100%;
      background: linear-gradient(180deg, #0f172a 0%, #1e2d4e 60%, #1e1b4b 100%);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: width .25s cubic-bezier(.4,0,.2,1);
      position: relative;
      flex-shrink: 0;
    }
    .sidenav.collapsed { width: 64px; }

    /* Décoration subtile */
    .sidenav::before {
      content: '';
      position: absolute;
      top: -60px; right: -60px;
      width: 180px; height: 180px;
      background: radial-gradient(circle, rgba(99,102,241,.12) 0%, transparent 70%);
      pointer-events: none;
    }
    .sidenav::after {
      content: '';
      position: absolute;
      bottom: 40px; left: -40px;
      width: 140px; height: 140px;
      background: radial-gradient(circle, rgba(79,70,229,.08) 0%, transparent 70%);
      pointer-events: none;
    }

    /* ═══════════════════════════════════════════════
       NAV ITEMS
    ═══════════════════════════════════════════════ */
    .sidenav__nav {
      flex: 1;
      padding: 16px 10px 0;
      overflow-y: auto;
      overflow-x: hidden;
      position: relative;
      z-index: 1;
    }
    .sidenav__nav::-webkit-scrollbar { width: 0; }

    ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 2px; }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 9px 11px;
      border-radius: 10px;
      text-decoration: none;
      color: rgba(255,255,255,.5);
      font-size: 13.5px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      transition: all .16s ease;
      position: relative;
    }
    .nav-item:hover {
      color: rgba(255,255,255,.9);
      background: rgba(255,255,255,.08);
    }
    .nav-item.active {
      color: white;
      background: linear-gradient(135deg, rgba(99,102,241,.35), rgba(79,70,229,.25));
      font-weight: 600;
      box-shadow: inset 0 0 0 1px rgba(99,102,241,.3);
    }
    /* Active left accent */
    .nav-item.active::before {
      content: '';
      position: absolute;
      left: 0; top: 20%; bottom: 20%;
      width: 3px;
      background: linear-gradient(180deg, #818cf8, #6366f1);
      border-radius: 0 3px 3px 0;
    }

    .item-icon {
      width: 32px; height: 32px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 8px; flex-shrink: 0;
      transition: background .16s;
    }
    .nav-item.active .item-icon {
      background: rgba(99,102,241,.3);
    }
    .item-icon mat-icon {
      font-size: 18px; width: 18px; height: 18px;
      color: inherit;
    }

    .item-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: opacity .2s;
    }
    .sidenav.collapsed .item-label { opacity: 0; pointer-events: none; }

    .item-arrow {
      opacity: 0;
      transition: opacity .15s, transform .15s;
    }
    .nav-item:hover .item-arrow { opacity: .4; transform: translateX(2px); }
    .nav-item.active .item-arrow { opacity: .6; transform: translateX(2px); }
    .item-arrow mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* ═══════════════════════════════════════════════
       FOOTER
    ═══════════════════════════════════════════════ */
    .sidenav__footer {
      padding: 0 10px 14px;
      position: relative;
      z-index: 1;
    }
    .footer-divider {
      height: 1px;
      background: rgba(255,255,255,.07);
      margin-bottom: 12px;
    }
    .footer-info {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 0 4px;
    }
    .footer-info.centered { justify-content: center; }
    .footer-icon {
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .footer-icon mat-icon { font-size: 15px; width: 15px; height: 15px; color: rgba(255,255,255,.2); }
    .footer-text { display: flex; flex-direction: column; gap: 1px; overflow: hidden; }
    .footer-version { font-size: 11px; font-weight: 600; color: rgba(255,255,255,.3); white-space: nowrap; }
    .footer-copy    { font-size: 10px; color: rgba(255,255,255,.18); white-space: nowrap; }
  `],
})
export class SideNavComponent {
  open = input<boolean>(true);

  private readonly NAV_ITEMS: NavItem[] = [
    { route: '/dashboard',    icon: 'dashboard',       label: 'Tableau de bord' },
    { route: '/clients',      icon: 'folder_shared',   label: 'Dossiers clients' },
    { route: '/tasks',        icon: 'task_alt',         label: 'Tâches' },
    { route: '/portefeuilles',icon: 'account_tree',    label: 'Portefeuilles',  portefeuilleOnly: true },
    { route: '/pointage',     icon: 'fingerprint',      label: 'Pointage' },
    { route: '/equipes',      icon: 'people',           label: 'Équipes',        adminOnly: true },
    { route: '/admin',        icon: 'manage_accounts', label: 'Utilisateurs',   adminOnly: true },
  ];

  constructor(public auth: AuthService) {}

  visibleItems() {
    return this.NAV_ITEMS.filter(item => {
      if (item.adminOnly && !this.auth.isAdmin()) return false;
      if (item.portefeuilleOnly && !this.auth.canManagePortefeuilles()) return false;
      return true;
    });
  }
}
