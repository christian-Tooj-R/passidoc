import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MatIconModule],
  template: `
    <nav class="sidebar">
      <div class="sidebar__brand">
        <div class="sidebar__brand-icon">
          <mat-icon>description</mat-icon>
        </div>
        <div>
          <div class="sidebar__brand-name">Passidoc</div>
          <div class="sidebar__brand-sub">AFYM Audit</div>
        </div>
      </div>

      <div class="sidebar__section-label">Navigation</div>

      <ul class="sidebar__menu">
        <li>
          <a routerLink="/dashboard" routerLinkActive="active">
            <span class="nav-icon"><mat-icon>dashboard</mat-icon></span>
            <span>Tableau de bord</span>
          </a>
        </li>
        <li>
          <a routerLink="/clients" routerLinkActive="active">
            <span class="nav-icon"><mat-icon>folder_shared</mat-icon></span>
            <span>Dossiers clients</span>
          </a>
        </li>
        <li>
          <a routerLink="/tasks" routerLinkActive="active">
            <span class="nav-icon"><mat-icon>task_alt</mat-icon></span>
            <span>Tâches</span>
          </a>
        </li>
        @if (auth.isAdmin()) {
          <li>
            <a routerLink="/equipes" routerLinkActive="active">
              <span class="nav-icon"><mat-icon>people</mat-icon></span>
              <span>Équipes</span>
            </a>
          </li>
          <li>
            <a routerLink="/portefeuilles" routerLinkActive="active">
              <span class="nav-icon"><mat-icon>folder_shared</mat-icon></span>
              <span>Portefeuilles</span>
            </a>
          </li>
          <li>
            <a routerLink="/admin" routerLinkActive="active">
              <span class="nav-icon"><mat-icon>manage_accounts</mat-icon></span>
              <span>Utilisateurs</span>
            </a>
          </li>
        }
      </ul>

      <div class="sidebar__footer">
        <div class="sidebar__user-site">
          <mat-icon>location_on</mat-icon>
          <span>{{ auth.currentUser()?.site === 'REUNION' ? 'La Réunion' : 'Madagascar' }}</span>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .sidebar {
      width: 256px;
      min-width: 256px;
      background: linear-gradient(175deg, #0f2040 0%, #1e3a8a 55%, #312e81 100%);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      position: relative;
    }
    /* Subtle orb decoration like login panel */
    .sidebar::before {
      content: '';
      position: absolute;
      top: -80px; right: -80px;
      width: 260px; height: 260px;
      background: rgba(255,255,255,0.04);
      border-radius: 50%;
      pointer-events: none;
    }
    .sidebar::after {
      content: '';
      position: absolute;
      bottom: -60px; left: -60px;
      width: 200px; height: 200px;
      background: rgba(255,255,255,0.03);
      border-radius: 50%;
      pointer-events: none;
    }

    .sidebar__brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 26px 22px 22px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      position: relative;
      z-index: 1;
    }
    .sidebar__brand-icon {
      width: 38px; height: 38px;
      background: rgba(255,255,255,0.15);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .sidebar__brand-icon mat-icon { color: white; font-size: 20px; width: 20px; height: 20px; }
    .sidebar__brand-name { font-size: 17px; font-weight: 800; color: white; line-height: 1.2; letter-spacing: -0.4px; }
    .sidebar__brand-sub { font-size: 11px; color: rgba(255,255,255,0.45); font-weight: 400; }

    .sidebar__section-label {
      font-size: 10px; font-weight: 700;
      color: rgba(255,255,255,0.3);
      text-transform: uppercase; letter-spacing: 1.4px;
      padding: 24px 22px 8px;
      position: relative; z-index: 1;
    }

    .sidebar__menu {
      list-style: none; padding: 0 12px; margin: 0; flex: 1;
      position: relative; z-index: 1;
    }
    .sidebar__menu li { margin-bottom: 2px; }
    .sidebar__menu li a {
      display: flex; align-items: center; gap: 11px;
      padding: 10px 12px;
      color: rgba(255,255,255,0.55);
      text-decoration: none; border-radius: 10px;
      font-size: 14px; font-weight: 500;
      transition: all 0.16s ease;
    }
    .sidebar__menu li a:hover {
      color: rgba(255,255,255,0.9);
      background: rgba(255,255,255,0.09);
    }
    .sidebar__menu li a.active {
      color: white;
      background: rgba(255,255,255,0.15);
      font-weight: 600;
    }
    .nav-icon {
      width: 30px; height: 30px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 7px; flex-shrink: 0;
    }
    .sidebar__menu li a.active .nav-icon {
      background: rgba(255,255,255,0.18);
    }
    .nav-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .sidebar__footer {
      padding: 16px 22px;
      border-top: 1px solid rgba(255,255,255,0.08);
      position: relative; z-index: 1;
    }
    .sidebar__user-site {
      display: flex; align-items: center; gap: 6px;
      color: rgba(255,255,255,0.35); font-size: 12px;
    }
    .sidebar__user-site mat-icon { font-size: 15px; width: 15px; height: 15px; }
  `],
})
export class SidebarComponent {
  constructor(public auth: AuthService) {}
}
