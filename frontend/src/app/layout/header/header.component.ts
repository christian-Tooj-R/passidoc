import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule, MatDividerModule],
  template: `
    <mat-toolbar class="header">
      <span class="header__spacer"></span>
      <button mat-button [matMenuTriggerFor]="menu" class="header__user">
        <mat-icon>account_circle</mat-icon>
        <span>{{ auth.currentUser()?.firstName }} {{ auth.currentUser()?.lastName }}</span>
        <mat-icon>arrow_drop_down</mat-icon>
      </button>
      <mat-menu #menu="matMenu">
        <div class="header__user-info">
          <p>{{ auth.currentUser()?.email }}</p>
          <span class="header__role">{{ auth.currentUser()?.role }}</span>
        </div>
        <mat-divider></mat-divider>
        <button mat-menu-item (click)="auth.logout()">
          <mat-icon>logout</mat-icon>
          <span>Déconnexion</span>
        </button>
      </mat-menu>
    </mat-toolbar>
  `,
  styles: [`
    .header { background: white; border-bottom: 1px solid #e2e8f0; box-shadow: none; }
    .header__spacer { flex: 1; }
    .header__user { display: flex; align-items: center; gap: 8px; }
    .header__user-info { padding: 12px 16px; }
    .header__user-info p { margin: 0; font-size: 13px; color: #64748b; }
    .header__role {
      font-size: 11px;
      background: #dbeafe;
      color: #1d4ed8;
      padding: 2px 8px;
      border-radius: 12px;
    }
  `],
})
export class HeaderComponent {
  constructor(public auth: AuthService) {}
}
