import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter } from 'rxjs/operators';

type RhSection = 'salaries' | 'conges';

interface NavItem { label: string; icon: string; route: string; section: RhSection; }

const NAV: NavItem[] = [
  { label: 'Gestion des salariés', icon: 'badge',        route: '/rh/salaries', section: 'salaries' },
  { label: 'Congés & Absences',    icon: 'beach_access', route: '/rh/conges',   section: 'conges'   },
];

@Component({
  selector: 'app-rh',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
<div class="rh-shell">

  <!-- ══ Sidebar dédiée RH ══ -->
  <aside class="rh-sidebar">

    <!-- Bouton retour -->
    <button class="back-btn" (click)="router.navigate(['/dashboard'])" matTooltip="Retour au tableau de bord">
      <mat-icon>arrow_back</mat-icon>
    </button>

    <!-- Logo / en-tête module -->
    <div class="rh-brand">
      <div class="rh-brand__icon">
        <mat-icon>groups</mat-icon>
      </div>
      <div class="rh-brand__text">
        <span class="rh-brand__title">Ressources<br>Humaines</span>
      </div>
    </div>

    <div class="rh-divider"></div>

    <!-- Navigation -->
    <nav class="rh-nav">
      @for (item of nav; track item.section) {
        <a class="rh-nav-item"
           [routerLink]="item.route"
           routerLinkActive="active"
           [routerLinkActiveOptions]="{ exact: false }">
          <mat-icon>{{ item.icon }}</mat-icon>
          <span>{{ item.label }}</span>
        </a>
      }
    </nav>

    <div class="rh-spacer"></div>

  </aside>

  <!-- ══ Contenu principal ══ -->
  <main class="rh-main">
    <router-outlet />
  </main>

</div>
  `,
  styles: [`
    .rh-shell {
      display: flex; height: 100vh; width: 100vw; overflow: hidden;
      background: #f4f5fb;
    }

    /* ─── Sidebar ─────────────────────────────────── */
    .rh-sidebar {
      width: 240px; flex-shrink: 0;
      background: #ffffff;
      border-right: 1px solid #e4e8f4;
      display: flex; flex-direction: column;
      padding: 16px 0 20px;
      box-shadow: 2px 0 8px rgba(0,0,0,.04);
    }

    /* Bouton retour */
    .back-btn {
      display: flex; align-items: center; gap: 8px;
      margin: 0 12px 4px; padding: 8px 10px;
      border: none; background: none; cursor: pointer;
      border-radius: 8px; color: #6b7fa3; font-size: 13px; font-weight: 600;
      transition: background .14s, color .14s;
      width: calc(100% - 24px);
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .back-btn:hover { background: #f0f3fa; color: #162351; }

    /* Brand */
    .rh-brand {
      display: flex; align-items: center; gap: 11px;
      padding: 10px 16px 14px;
    }
    .rh-brand__icon {
      width: 40px; height: 40px; border-radius: 11px; flex-shrink: 0;
      background: linear-gradient(135deg, #6d28d9, #7c3aed);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 3px 10px rgba(124,58,237,.30);
      mat-icon { color: #fff; font-size: 20px; width: 20px; height: 20px; }
    }
    .rh-brand__title {
      font-size: 13px; font-weight: 700; color: #0f1a35;
      line-height: 1.3;
    }

    .rh-divider {
      height: 1px; background: #e4e8f4; margin: 0 16px 10px;
    }

    /* Nav items */
    .rh-nav {
      display: flex; flex-direction: column; gap: 2px; padding: 0 10px;
    }
    .rh-nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 8px;
      text-decoration: none; font-size: 13px; font-weight: 500; color: #3c4555;
      transition: background .14s, color .14s;
      position: relative;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #8b93a9; transition: color .14s; flex-shrink: 0; }
    }
    .rh-nav-item:hover {
      background: #f0f3fa; color: #162351;
      mat-icon { color: #4b5a7a; }
    }
    .rh-nav-item.active {
      background: #ede9fe; color: #7c3aed; font-weight: 600;
      mat-icon { color: #7c3aed; }
    }
    .rh-nav-item.active::before {
      content: '';
      position: absolute; left: 0; top: 6px; bottom: 6px;
      width: 3px; border-radius: 0 3px 3px 0;
      background: #7c3aed;
    }

    .rh-spacer { flex: 1; }

    /* ─── Contenu ─────────────────────────────────── */
    .rh-main {
      flex: 1; overflow-y: auto; overflow-x: hidden;
      display: flex; flex-direction: column;
    }
  `],
})
export class RhComponent implements OnInit {
  router = inject(Router);
  readonly nav = NAV;

  ngOnInit() {
    // Si on arrive sur /rh sans sous-route, rediriger vers /rh/salaries
    if (this.router.url === '/rh') {
      this.router.navigate(['/rh/salaries'], { replaceUrl: true });
    }
  }
}
