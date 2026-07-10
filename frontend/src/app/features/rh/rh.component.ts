import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, RouterOutlet, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
interface NavItem { label: string; icon: string; route: string; desc: string; }

const NAV: NavItem[] = [
  { label: 'Gestion des salariés', icon: 'badge',        route: '/rh/salaries', desc: 'Fiches, contrats, paie' },
  { label: 'Congés & Absences',    icon: 'beach_access', route: '/rh/conges',   desc: 'Demandes, soldes, approbations' },
];

@Component({
  selector: 'app-rh',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
<!-- ══ Écran d'entrée (loading) ══ -->
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

<!-- ══ Interface principale ══ -->
@if (!entering()) {
<div class="rh-shell" [class.rh-shell--ready]="!entering()">

  <!-- ── Sidebar dédiée RH ── -->
  <aside class="rh-sidebar">

    <!-- Retour -->
    <button class="back-btn" (click)="router.navigate(['/dashboard'])">
      <mat-icon>arrow_back</mat-icon>
      <span>Tableau de bord</span>
    </button>

    <!-- Brand -->
    <div class="rh-brand">
      <div class="rh-brand__icon">
        <mat-icon>manage_accounts</mat-icon>
      </div>
      <div>
        <span class="rh-brand__title">Ressources Humaines</span>
        <span class="rh-brand__sub">AFYM Audit Expertise</span>
      </div>
    </div>

    <div class="rh-sep"></div>

    <!-- Navigation -->
    <p class="rh-nav-label">Modules</p>
    <nav class="rh-nav">
      @for (item of nav; track item.route) {
        <a class="rh-nav-item"
           [routerLink]="item.route"
           routerLinkActive="active"
           [routerLinkActiveOptions]="{ exact: false }"
           (click)="startNavLoading()">
          <span class="rh-nav-item__icon">
            <mat-icon>{{ item.icon }}</mat-icon>
          </span>
          <span class="rh-nav-item__text">
            <span class="rh-nav-item__label">{{ item.label }}</span>
            <span class="rh-nav-item__desc">{{ item.desc }}</span>
          </span>
        </a>
      }
    </nav>

    <div class="rh-spacer"></div>

    <!-- Indicateur de chargement navigation -->
    @if (navLoading()) {
      <div class="nav-loading-bar"><div class="nav-loading-bar__fill"></div></div>
    }

  </aside>

  <!-- ── Zone de contenu ── -->
  <main class="rh-main" [class.rh-main--loading]="navLoading()">
    @if (navLoading()) {
      <div class="content-skeleton">
        <div class="sk-header"></div>
        <div class="sk-row"></div>
        <div class="sk-row sk-row--short"></div>
        <div class="sk-grid">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="sk-card"></div>
          }
        </div>
      </div>
    }
    <div [class.rh-content--hidden]="navLoading()">
      <router-outlet />
    </div>
  </main>

</div>
}
  `,
  styles: [`
    /* ══ Écran d'entrée ══════════════════════════════════ */
    .rh-entry {
      position: fixed; inset: 0; z-index: 9999;
      background: linear-gradient(135deg, #1a0533 0%, #2d0a5e 50%, #1e0a4f 100%);
      display: flex; align-items: center; justify-content: center;
      animation: entryFadeOut .4s ease-in 1.2s forwards;
    }
    @keyframes entryFadeOut {
      to { opacity: 0; pointer-events: none; }
    }
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
      border-radius: 2px;
      animation: barFill 1.1s cubic-bezier(.4,0,.2,1) forwards;
    }
    @keyframes barFill { from { width: 0; } to { width: 100%; } }

    /* ══ Shell principal ══════════════════════════════════ */
    .rh-shell {
      display: flex; height: 100vh; width: 100vw; overflow: hidden;
      background: #f4f5fb;
      opacity: 0; animation: shellIn .35s ease .05s forwards;
    }
    @keyframes shellIn { to { opacity: 1; } }

    /* ── Sidebar ─────────────────────────────────────────── */
    .rh-sidebar {
      width: 250px; flex-shrink: 0;
      background: #fff;
      border-right: 1px solid #ede9fe;
      display: flex; flex-direction: column;
      padding: 16px 0 16px;
      box-shadow: 2px 0 12px rgba(109,40,217,.06);
      position: relative; overflow: hidden;
    }
    /* Dégradé décoratif haut de sidebar */
    .rh-sidebar::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, #7c3aed, #a78bfa, #7c3aed);
    }

    .back-btn {
      display: flex; align-items: center; gap: 8px;
      margin: 0 12px 12px; padding: 8px 10px; width: calc(100% - 24px);
      border: none; background: none; cursor: pointer; border-radius: 8px;
      color: #6b7280; font-size: 12px; font-weight: 500;
      transition: background .13s, color .13s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .back-btn:hover { background: #f3f4f6; color: #111827; }

    .rh-brand {
      display: flex; align-items: center; gap: 11px;
      padding: 8px 16px 16px;
    }
    .rh-brand__icon {
      width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
      background: linear-gradient(135deg, #5b21b6, #7c3aed);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(124,58,237,.35);
      mat-icon { color: #fff; font-size: 22px; width: 22px; height: 22px; }
    }
    .rh-brand__title {
      display: block; font-size: 13.5px; font-weight: 700; color: #111827; line-height: 1.2;
    }
    .rh-brand__sub {
      display: block; font-size: 10.5px; color: #9ca3af; margin-top: 1px;
    }

    .rh-sep { height: 1px; background: #f3f0ff; margin: 0 16px 12px; }

    .rh-nav-label {
      font-size: 9.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .08em; color: #9ca3af;
      padding: 0 20px; margin: 0 0 6px;
    }

    .rh-nav { display: flex; flex-direction: column; gap: 3px; padding: 0 10px; }

    .rh-nav-item {
      display: flex; align-items: center; gap: 11px;
      padding: 10px 12px; border-radius: 10px;
      text-decoration: none; color: #374151;
      transition: background .13s, color .13s, box-shadow .13s;
      position: relative; overflow: hidden;
    }
    .rh-nav-item:hover {
      background: #f5f3ff; color: #5b21b6;
      .rh-nav-item__icon mat-icon { color: #7c3aed; }
    }
    .rh-nav-item.active {
      background: #ede9fe; color: #5b21b6;
      box-shadow: inset 3px 0 0 #7c3aed;
      .rh-nav-item__icon mat-icon { color: #7c3aed; }
      .rh-nav-item__label { font-weight: 700; }
    }
    .rh-nav-item__icon {
      width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
      background: #f3f4f6;
      display: flex; align-items: center; justify-content: center;
      transition: background .13s;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #6b7280; transition: color .13s; }
    }
    .rh-nav-item.active .rh-nav-item__icon { background: #ddd6fe; }
    .rh-nav-item__text { display: flex; flex-direction: column; min-width: 0; }
    .rh-nav-item__label { font-size: 13px; font-weight: 500; line-height: 1.2; }
    .rh-nav-item__desc  { font-size: 10.5px; color: #9ca3af; margin-top: 1px; }
    .rh-nav-item.active .rh-nav-item__desc { color: #8b5cf6; }

    .rh-spacer { flex: 1; }

    /* Barre de chargement navigation */
    .nav-loading-bar {
      height: 2px; background: #ede9fe; margin: 0 0 0;
      overflow: hidden; flex-shrink: 0;
    }
    .nav-loading-bar__fill {
      height: 100%;
      background: linear-gradient(90deg, #7c3aed 0%, #a78bfa 50%, #7c3aed 100%);
      background-size: 200% 100%;
      animation: navBar 1.2s linear infinite;
    }
    @keyframes navBar {
      0%   { background-position: 100% 0; }
      100% { background-position: -100% 0; }
    }

    /* ── Zone de contenu ──────────────────────────────────── */
    .rh-main {
      flex: 1; overflow-y: auto; overflow-x: hidden;
      display: flex; flex-direction: column;
      transition: opacity .2s;
    }
    .rh-main--loading { overflow: hidden; }
    .rh-content--hidden { display: none; }

    /* Skeleton de chargement contenu */
    .content-skeleton {
      padding: 28px;
      display: flex; flex-direction: column; gap: 14px;
    }
    .sk-header {
      height: 32px; border-radius: 8px;
      background: linear-gradient(90deg, #f0ebff 0%, #e9e3ff 50%, #f0ebff 100%);
      background-size: 200% 100%;
      animation: shimmer 1.4s ease infinite;
      width: 220px;
    }
    .sk-row {
      height: 16px; border-radius: 6px; width: 70%;
      background: linear-gradient(90deg, #f5f3ff 0%, #ede9fe 50%, #f5f3ff 100%);
      background-size: 200% 100%;
      animation: shimmer 1.4s ease .1s infinite;
    }
    .sk-row--short { width: 45%; }
    .sk-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 8px;
    }
    .sk-card {
      height: 110px; border-radius: 12px;
      background: linear-gradient(90deg, #f5f3ff 0%, #ede9fe 40%, #f5f3ff 100%);
      background-size: 200% 100%;
      animation: shimmer 1.4s ease infinite;
    }
    .sk-card:nth-child(2) { animation-delay: .15s; }
    .sk-card:nth-child(3) { animation-delay: .3s; }
    .sk-card:nth-child(4) { animation-delay: .1s; }
    .sk-card:nth-child(5) { animation-delay: .25s; }
    .sk-card:nth-child(6) { animation-delay: .4s; }
    @keyframes shimmer {
      0%   { background-position: 100% 0; }
      100% { background-position: -100% 0; }
    }
  `],
})
export class RhComponent implements OnInit {
  router    = inject(Router);
  entering  = signal(true);
  navLoading = signal(false);
  readonly nav = NAV;

  ngOnInit() {
    // Écran d'entrée : 1.6s puis disparaît
    setTimeout(() => this.entering.set(false), 1600);

    // Barre de chargement lors des navigations internes
    this.router.events.subscribe(e => {
      if (e instanceof NavigationStart && this.router.url.startsWith('/rh')) {
        this.navLoading.set(true);
      }
      if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError) {
        setTimeout(() => this.navLoading.set(false), 300);
      }
    });
  }

  startNavLoading() { this.navLoading.set(true); }
}
