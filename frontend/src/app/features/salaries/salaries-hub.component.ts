import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-salaries-hub',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  template: `
<div class="hub">

  <!-- En-tête -->
  <div class="hub-header">
    <div class="hub-title">
      <div class="hub-icon"><mat-icon>badge</mat-icon></div>
      <div>
        <h1>Ressources Humaines</h1>
        <span>Gestion des salariés et des congés & absences</span>
      </div>
    </div>
  </div>

  <!-- Onglets de navigation -->
  <div class="hub-tabs">
    <a class="hub-tab" routerLink="/salaries/liste" routerLinkActive="active"
       [routerLinkActiveOptions]="{ exact: false }">
      <mat-icon>badge</mat-icon>
      <span>Gestion des salariés</span>
    </a>
    <a class="hub-tab" routerLink="/salaries/conges" routerLinkActive="active"
       [routerLinkActiveOptions]="{ exact: false }">
      <mat-icon>beach_access</mat-icon>
      <span>Congés & Absences</span>
    </a>
  </div>

  <!-- Contenu de l'onglet actif -->
  <div class="hub-content">
    <router-outlet />
  </div>

</div>
  `,
  styles: [`
    .hub { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

    /* En-tête */
    .hub-header {
      padding: 20px 28px 0; flex-shrink: 0;
    }
    .hub-title {
      display: flex; align-items: center; gap: 14px;
      h1 { margin: 0; font-size: 20px; font-weight: 700; color: #0f1a35; }
      span { font-size: 12px; color: #8a99b8; display: block; margin-top: 2px; }
    }
    .hub-icon {
      width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
      background: linear-gradient(135deg, #7C3AED22, #7C3AED11);
      border: 1px solid #7C3AED33;
      display: flex; align-items: center; justify-content: center;
      mat-icon { color: #7C3AED; font-size: 22px; width: 22px; height: 22px; }
    }

    /* Onglets */
    .hub-tabs {
      display: flex; gap: 0; padding: 16px 28px 0; flex-shrink: 0;
      border-bottom: 2px solid #e4e8f4; margin-top: 16px;
    }
    .hub-tab {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 20px; border-bottom: 2px solid transparent;
      margin-bottom: -2px; text-decoration: none;
      font-size: 13px; font-weight: 600; color: #6b7fa3;
      border-radius: 8px 8px 0 0;
      transition: color .15s, border-color .15s, background .15s;
      mat-icon { font-size: 17px; width: 17px; height: 17px; transition: color .15s; }
    }
    .hub-tab:hover {
      color: #162351; background: #f4f5fb;
    }
    .hub-tab.active {
      color: #7C3AED; border-bottom-color: #7C3AED; background: #faf8ff;
      mat-icon { color: #7C3AED; }
    }

    /* Zone de contenu */
    .hub-content {
      flex: 1; overflow-y: auto; overflow-x: hidden;
    }
  `],
})
export class SalariesHubComponent {}
