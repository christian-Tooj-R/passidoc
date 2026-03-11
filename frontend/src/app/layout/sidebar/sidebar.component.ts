import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule],
  template: `
    <nav class="sidebar">
      <div class="sidebar__logo">
        <span class="sidebar__logo-text">Passidoc</span>
      </div>

      <ul class="sidebar__menu">
        <li>
          <a routerLink="/dashboard" routerLinkActive="active" matTooltip="Tableau de bord">
            <mat-icon>dashboard</mat-icon>
            <span>Tableau de bord</span>
          </a>
        </li>
        <li>
          <a routerLink="/clients" routerLinkActive="active" matTooltip="Dossiers clients">
            <mat-icon>folder_shared</mat-icon>
            <span>Dossiers clients</span>
          </a>
        </li>
        @if (auth.isAdmin()) {
          <li>
            <a routerLink="/admin" routerLinkActive="active" matTooltip="Administration">
              <mat-icon>admin_panel_settings</mat-icon>
              <span>Administration</span>
            </a>
          </li>
        }
      </ul>

      <div class="sidebar__footer">
        <div class="sidebar__site">
          <mat-icon>location_on</mat-icon>
          <span>{{ auth.currentUser()?.site }}</span>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .sidebar {
      width: 240px;
      background: #1e293b;
      color: white;
      display: flex;
      flex-direction: column;
      padding: 0;
    }
    .sidebar__logo {
      padding: 24px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .sidebar__logo-text {
      font-size: 22px;
      font-weight: 700;
      color: #60a5fa;
      letter-spacing: 1px;
    }
    .sidebar__menu {
      list-style: none;
      padding: 16px 0;
      margin: 0;
      flex: 1;
    }
    .sidebar__menu li a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      color: rgba(255,255,255,0.7);
      text-decoration: none;
      transition: all 0.2s;
      border-left: 3px solid transparent;
    }
    .sidebar__menu li a:hover,
    .sidebar__menu li a.active {
      color: white;
      background: rgba(255,255,255,0.08);
      border-left-color: #60a5fa;
    }
    .sidebar__footer {
      padding: 16px 20px;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    .sidebar__site {
      display: flex;
      align-items: center;
      gap: 8px;
      color: rgba(255,255,255,0.5);
      font-size: 13px;
    }
  `],
})
export class SidebarComponent {
  constructor(public auth: AuthService) {}
}
