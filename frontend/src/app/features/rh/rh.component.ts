import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, RouterOutlet, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

interface NavItem { label: string; icon: string; route: string; }

const NAV: NavItem[] = [
  { label: 'Collaborateurs', icon: 'badge',        route: '/rh/salaries' },
  { label: 'Congés & Absences', icon: 'event_busy', route: '/rh/conges'   },
];

@Component({
  selector: 'app-rh',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
<!-- ══ Écran d'entrée ══ -->
@if (entering()) {
  <div class="rh-entry">
    <div class="entry-card">
      <div class="entry-icon">
        <mat-icon>manage_accounts</mat-icon>
      </div>
      <h2>Ressources Humaines</h2>
      <p>Chargement du module…</p>
      <div class="entry-bar"><div class="entry-bar__fill"></div></div>
    </div>
  </div>
}

<div class="rh-shell" [class.rh-shell--hidden]="entering()">

  <!-- ── Sidebar ── -->
  <aside class="rh-sidebar">

    <!-- En-tête module -->
    <div class="rh-header">
      <div class="rh-header__icon">
        <mat-icon>manage_accounts</mat-icon>
      </div>
      <div class="rh-header__text">
        <span class="rh-header__title">Ressources Humaines</span>
        <span class="rh-header__sub">AFYM Audit Expertise</span>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="rh-nav">
      <span class="rh-nav__section">Navigation</span>
      @for (item of nav; track item.route) {
        <a class="rh-nav__item"
           [routerLink]="item.route"
           routerLinkActive="active"
           [routerLinkActiveOptions]="{ exact: false }">
          <mat-icon class="rh-nav__icon">{{ item.icon }}</mat-icon>
          <span class="rh-nav__label">{{ item.label }}</span>
        </a>
      }
    </nav>

    <div class="rh-spacer"></div>

    <!-- Retour vers l'application -->
    <button class="rh-back" (click)="router.navigate(['/dashboard'])">
      <mat-icon>arrow_back</mat-icon>
      <span>Retour à l'application</span>
    </button>

    <!-- Barre de chargement navigation (bas de sidebar) -->
    <div class="rh-progress" [class.rh-progress--active]="navLoading()">
      <div class="rh-progress__bar"></div>
    </div>

  </aside>

  <!-- ── Contenu ── -->
  <main class="rh-main">
    <router-outlet />
  </main>

</div>
  `,
  styles: [`
    /* ── Écran d'entrée ── */
    .rh-entry {
      position: fixed; inset: 0; z-index: 9999;
      background: linear-gradient(135deg, #1a0533 0%, #2d0a5e 50%, #1e0a4f 100%);
      display: flex; align-items: center; justify-content: center;
      animation: entryFadeOut .4s ease-in 1.2s forwards;
    }
    @keyframes entryFadeOut { to { opacity: 0; pointer-events: none; } }
    .entry-card {
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      animation: entrySlideUp .5s cubic-bezier(.16,1,.3,1) forwards;
    }
    @keyframes entrySlideUp {
      from { opacity: 0; transform: translateY(24px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .entry-icon {
      width: 72px; height: 72px; border-radius: 20px;
      background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.2);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 40px rgba(167,139,250,.4);
      mat-icon { color: #fff; font-size: 36px; width: 36px; height: 36px; }
    }
    .entry-card h2 { color: #fff; font-size: 22px; font-weight: 700; margin: 0; letter-spacing: -.3px; }
    .entry-card p  { color: rgba(255,255,255,.5); font-size: 13px; margin: 0; }
    .entry-bar {
      width: 180px; height: 3px; background: rgba(255,255,255,.12); border-radius: 2px; overflow: hidden;
    }
    .entry-bar__fill {
      height: 100%; background: linear-gradient(90deg, #a78bfa, #c4b5fd);
      border-radius: 2px; animation: barFill 1.1s cubic-bezier(.4,0,.2,1) forwards;
    }
    @keyframes barFill { from { width: 0; } to { width: 100%; } }

    /* ── Shell ──────────────────────────────────────────── */
    .rh-shell {
      display: flex;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
      background: #F0EEFF;
      animation: rhFadeIn .35s ease .05s both;
    }
    .rh-shell--hidden { visibility: hidden; }
    @keyframes rhFadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* ── Sidebar (couleur reprend l'animation d'entrée) ──── */
    .rh-sidebar {
      width: 236px;
      flex-shrink: 0;
      background: linear-gradient(180deg, #200B45 0%, #2a0e58 100%);
      border-right: none;
      display: flex;
      flex-direction: column;
      padding: 0;
      position: relative;
      box-shadow: 3px 0 20px rgba(32,11,69,.35);
    }

    /* En-tête module */
    .rh-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 16px 18px;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }
    .rh-header__icon {
      width: 36px;
      height: 36px;
      border-radius: 9px;
      background: rgba(167,139,250,.25);
      border: 1px solid rgba(167,139,250,.3);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      mat-icon { color: #c4b5fd; font-size: 20px; width: 20px; height: 20px; }
    }
    .rh-header__title {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      line-height: 1.25;
      letter-spacing: -.1px;
    }
    .rh-header__sub {
      display: block;
      font-size: 11px;
      color: rgba(196,181,253,.6);
      margin-top: 1px;
    }

    /* Navigation */
    .rh-nav {
      display: flex;
      flex-direction: column;
      padding: 14px 10px 0;
      gap: 2px;
    }
    .rh-nav__section {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: rgba(196,181,253,.4);
      padding: 0 8px 8px;
      display: block;
    }
    .rh-nav__item {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 9px 10px;
      border-radius: 7px;
      text-decoration: none;
      color: rgba(255,255,255,.65);
      font-size: 13px;
      font-weight: 500;
      transition: background .12s, color .12s;
      position: relative;
    }
    .rh-nav__item:hover {
      background: rgba(255,255,255,.08);
      color: #fff;
    }
    .rh-nav__item.active {
      background: rgba(167,139,250,.2);
      color: #fff;
      font-weight: 600;
    }
    .rh-nav__item.active::before {
      content: '';
      position: absolute;
      left: 0; top: 6px; bottom: 6px;
      width: 3px;
      border-radius: 0 2px 2px 0;
      background: #a78bfa;
    }
    .rh-nav__icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: rgba(196,181,253,.5);
      flex-shrink: 0;
      transition: color .12s;
    }
    .rh-nav__item:hover .rh-nav__icon { color: rgba(196,181,253,.9); }
    .rh-nav__item.active .rh-nav__icon { color: #c4b5fd; }
    .rh-nav__label { flex: 1; min-width: 0; }

    .rh-spacer { flex: 1; }

    /* Bouton retour */
    .rh-back {
      display: flex;
      align-items: center;
      gap: 7px;
      margin: 0 10px 12px;
      padding: 8px 10px;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 7px;
      color: rgba(196,181,253,.45);
      font-size: 12px;
      font-weight: 500;
      transition: background .12s, color .12s;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .rh-back:hover { background: rgba(255,255,255,.07); color: rgba(255,255,255,.8); }

    /* Barre de progression navigation */
    .rh-progress {
      height: 2px;
      background: transparent;
      overflow: hidden;
      flex-shrink: 0;
    }
    .rh-progress--active { background: rgba(255,255,255,.08); }
    .rh-progress__bar { height: 100%; width: 0; }
    .rh-progress--active .rh-progress__bar {
      width: 100%;
      background: linear-gradient(90deg, #7c3aed 0%, #c4b5fd 50%, #7c3aed 100%);
      background-size: 200% 100%;
      animation: progressBar 1.2s linear infinite;
    }
    @keyframes progressBar {
      0%   { background-position: 100% 0; }
      100% { background-position: -100% 0; }
    }

    /* ── Zone de contenu ──────────────────────────────────── */
    .rh-main {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
    }
  `],
})
export class RhComponent implements OnInit {
  router     = inject(Router);
  entering   = signal(true);
  navLoading = signal(false);
  readonly nav = NAV;

  ngOnInit() {
    setTimeout(() => this.entering.set(false), 1600);

    this.router.events.subscribe(e => {
      if (e instanceof NavigationStart && this.router.url.startsWith('/rh')) {
        this.navLoading.set(true);
      }
      if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        setTimeout(() => this.navLoading.set(false), 280);
      }
    });
  }

  startNavLoading() { this.navLoading.set(true); }
}
