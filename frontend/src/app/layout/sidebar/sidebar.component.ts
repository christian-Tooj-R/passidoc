import { Component, signal, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { RolePermissionsService } from '../../core/services/role-permissions.service';
import { ThemeService } from '../../core/services/theme.service';
import { HelpService } from '../../core/services/help.service';
import { filter } from 'rxjs/operators';

type ModuleId = 'apercu' | 'dossiers' | 'travail' | 'documents' | 'notes' | 'equipe' | 'pointage' | 'rh';

interface NavItem  { label: string; route: string; icon: string; badge?: number; }
interface NavGroup { label: string; items: NavItem[]; }

interface AppModule {
  id: ModuleId;
  icon: string;
  label: string;
  color: string;       // active accent color
  activeBg: string;    // light tint for panel items
  groups: NavGroup[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule],
  template: `
    <div class="shell">

      <!-- ══ RAIL ══════════════════════════════════════ -->
      <aside class="rail">

        <!-- Logo -->
        <a routerLink="/dashboard" class="rail-logo" matTooltip="Passidoc" matTooltipPosition="right">
          <mat-icon>description</mat-icon>
        </a>

        <div class="rail-divider"></div>

        <!-- Module buttons -->
        <nav class="rail-nav">
          @for (m of visibleModules(); track m.id) {
            <button
              class="rail-item"
              [class.active]="activeModule() === m.id"
              [matTooltip]="m.label"
              matTooltipPosition="right"
              (click)="selectModule(m.id)">
              <div class="rail-item__pill"
                   [style.background]="activeModule() === m.id ? 'var(--rail-active-bg, rgba(147,197,253,0.22))' : 'transparent'">
                <mat-icon [style.color]="activeModule() === m.id ? 'var(--rail-active-color, #93c5fd)' : 'var(--rail-text-dim)'">
                  {{ m.icon }}
                </mat-icon>
              </div>
              <span class="rail-item__label"
                    [style.color]="activeModule() === m.id ? 'var(--rail-active-color, #93c5fd)' : 'var(--rail-text-dim)'">
                {{ m.label }}
              </span>
            </button>
          }
        </nav>

        <div class="rail-spacer"></div>
        <div class="rail-divider"></div>

        <!-- Aide -->
        <button class="rail-help"
                (click)="helpSvc.toggle()"
                matTooltip="Centre d'aide (touche ?)"
                matTooltipPosition="right">
          <mat-icon>help_outline</mat-icon>
        </button>

        <!-- Personnalisation (tous les utilisateurs) -->
        <a routerLink="/personnalisation"
           routerLinkActive="rail-settings--active"
           class="rail-settings"
           matTooltip="Personnalisation" matTooltipPosition="right">
          <mat-icon>palette</mat-icon>
        </a>

        <!-- Avatar -->
        <button class="rail-avatar" [matTooltip]="fullName()" matTooltipPosition="right">
          <span>{{ initials() }}</span>
          <span class="rail-avatar__dot"></span>
        </button>

      </aside>

      <!-- ══ PANEL ══════════════════════════════════════ -->
      <aside class="panel" [class.panel--dark]="isDark()">

        <!-- Header spécial Personnalisation -->
        @if (isPersonnalisation()) {
          <div class="panel-header">
            <div class="panel-header__icon"
                 [style.background]="isDark() ? 'rgba(255,255,255,.10)' : '#EDE9FE'"
                 [style.box-shadow]="isDark() ? 'none' : '0 2px 8px #7C3AED33'">
              <mat-icon style="color:#7C3AED">palette</mat-icon>
            </div>
            <div class="panel-header__text">
              <span class="panel-header__title">Personnalisation</span>
              <span class="panel-header__count">Thème et apparence</span>
            </div>
          </div>
          <div class="panel-sep" style="background:linear-gradient(90deg,#7C3AED40 0%,transparent 100%)"></div>
        }

        @if (currentModule(); as mod) {

          <!-- Header module -->
          <div class="panel-header">
            <div class="panel-header__icon"
                 [style.background]="isDark() ? 'rgba(255,255,255,.10)' : mod.activeBg"
                 [style.box-shadow]="isDark() ? 'none' : '0 2px 8px ' + mod.color + '33'">
              <mat-icon [style.color]="mod.color">{{ mod.icon }}</mat-icon>
            </div>
            <div class="panel-header__text">
              <span class="panel-header__title">{{ mod.label }}</span>
              <span class="panel-header__count">
                {{ totalItems(mod) }} section{{ totalItems(mod) > 1 ? 's' : '' }}
              </span>
            </div>
          </div>

          <!-- Séparateur décoratif -->
          <div class="panel-sep" [style.background]="'linear-gradient(90deg,' + mod.color + '40 0%, transparent 100%)'"></div>

          <!-- Groups + items -->
          <nav class="panel-nav">
            @for (group of mod.groups; track group.label) {
              @if (group.label) {
                <span class="panel-group-label">{{ group.label }}</span>
              }
              @for (item of group.items; track item.route) {
                <a [routerLink]="item.route"
                   routerLinkActive="active"
                   [routerLinkActiveOptions]="{ exact: true }"
                   #rla="routerLinkActive"
                   class="panel-item"
                   [class.panel-item--active]="rla.isActive"
                   [style.--item-bg]="activeBg(mod)"
                   [style.--item-color]="mod.color">
                  <mat-icon class="panel-item__icon"
                            [style.color]="rla.isActive ? mod.color : null">{{ item.icon }}</mat-icon>
                  <span class="panel-item__label">{{ item.label }}</span>
                  @if (item.badge) {
                    <span class="panel-item__badge">{{ item.badge }}</span>
                  }
                </a>
              }
            }
          </nav>

        }

        <div class="panel-spacer"></div>

        <!-- Footer -->
        <div class="panel-footer">
          @if (theme.prefs().orgName) {
            <div class="panel-org">{{ theme.prefs().orgName }}</div>
          }
          <div class="panel-user">
            <div class="panel-user__av-wrap">
              <div class="panel-user__av">{{ initials() }}</div>
              <span class="panel-user__status"></span>
            </div>
            <div class="panel-user__info">
              <span class="panel-user__name">{{ fullName() }}</span>
              <span class="panel-user__role">{{ roleLabel() }}</span>
            </div>
            <span class="panel-user__flag">
              {{ auth.currentUser()?.site === 'REUNION' ? '🇷🇪' : '🇲🇬' }}
            </span>
          </div>
        </div>

      </aside>
    </div>
  `,
  styles: [`
    .shell {
      display: flex; height: 100vh; flex-shrink: 0;
      overflow: hidden;
    }

    /* ══ RAIL ════════════════════════════════════════════ */
    .rail {
      width: 64px; height: 100vh; flex-shrink: 0;
      background: var(--sidebar-gradient, linear-gradient(180deg, #0c1a3a 0%, #1e3a8a 50%, #1d4ed8 100%));
      border-right: none;
      display: flex; flex-direction: column; align-items: center;
      padding: 14px 0 18px;
      z-index: 2;
      box-shadow: 2px 0 12px rgba(0,0,0,.25);
    }

    /* Logo */
    .rail-logo {
      width: 36px; height: 36px; border-radius: 11px;
      background: linear-gradient(135deg, #1565C0, #60a5fa);
      display: flex; align-items: center; justify-content: center;
      text-decoration: none; flex-shrink: 0; margin-bottom: 10px;
      box-shadow: 0 2px 8px rgba(21,101,192,.35);
      transition: transform .18s, box-shadow .18s;
    }
    .rail-logo:hover { transform: scale(1.06); box-shadow: 0 4px 14px rgba(96,165,250,.45); }
    .rail-logo mat-icon { color: #fff; font-size: 18px; width: 18px; height: 18px; }

    .rail-divider { width: 36px; height: 1px; background: var(--rail-divider, rgba(255,255,255,.08)); margin: 6px 0; flex-shrink: 0; }
    .rail-spacer  { flex: 1; }

    /* Rail items */
    .rail-nav { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 0; width: 100%; }

    .rail-item {
      width: 58px; border: none; background: transparent; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 6px 0 8px; border-radius: 16px;
      transition: background .12s;
    }
    .rail-item:hover { background: var(--rail-hover, rgba(255,255,255,.07)); }

    .rail-item__pill {
      width: 42px; height: 28px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      transition: background .18s, box-shadow .18s;
    }
    .rail-item.active .rail-item__pill {
      box-shadow: 0 2px 12px var(--rail-active-bg, rgba(96,165,250,.30)), inset 0 0 0 1px var(--rail-active-color, rgba(147,197,253,.50));
    }
    .rail-item__pill mat-icon {
      font-size: 20px; width: 20px; height: 20px;
      transition: color .18s;
    }

    .rail-item__label {
      font-size: 10px; font-weight: 600; letter-spacing: .2px;
      line-height: 1; text-align: center;
      transition: color .18s;
    }


    /* Bouton aide */
    .rail-help {
      width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      border: none; background: transparent; cursor: pointer; margin-bottom: 4px;
      color: var(--rail-text-dim, rgba(255,255,255,.45));
      transition: background .15s, color .15s;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .rail-help:hover {
      background: var(--rail-hover, rgba(255,255,255,.07));
      color: rgba(255,255,255,.90);
    }

    /* Icône personnalisation en bas */
    .rail-settings {
      width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      text-decoration: none; margin-bottom: 8px;
      color: var(--rail-text-dim, rgba(255,255,255,.45));
      transition: background .15s, color .15s;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .rail-settings:hover {
      background: var(--rail-hover, rgba(255,255,255,.07));
      color: var(--rail-text, rgba(255,255,255,.90));
    }
    .rail-settings--active {
      background: var(--rail-active-bg, rgba(147,197,253,0.22));
      color: var(--rail-active-color, #93c5fd) !important;
    }

    /* Avatar */
    .rail-avatar {
      position: relative; width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, #1565C0, #60a5fa);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: white;
      transition: transform .15s;
      margin-top: 6px;
    }
    .rail-avatar:hover { transform: scale(1.08); }
    .rail-avatar__dot {
      position: absolute; bottom: 1px; right: 0;
      width: 9px; height: 9px; border-radius: 50%;
      background: #34A853; border: 2px solid #fff;
    }

    /* ══ PANEL ══════════════════════════════════════════════════ */
    .panel {
      width: 200px; height: 100vh; flex-shrink: 0;
      background: var(--panel-bg, #F7F8FD);
      border-right: 1px solid var(--panel-border, #E4E8F0);
      display: flex; flex-direction: column; overflow: hidden;
      backdrop-filter: var(--panel-backdrop, none);
      -webkit-backdrop-filter: var(--panel-backdrop, none);
    }
    .panel--dark {
      background: #141E2F;
      border-color: rgba(255,255,255,.08);
    }

    /* ── Header ─────────────────────────────────────────────── */
    .panel-header {
      display: flex; align-items: center; gap: 12px;
      padding: 20px 16px 12px; flex-shrink: 0;
    }
    .panel-header__icon {
      width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      transition: background .2s, box-shadow .2s;
    }
    .panel-header__icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .panel-header__text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .panel-header__title {
      font-size: 14.5px; font-weight: 700; color: #1A1F36; letter-spacing: -.25px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .panel--dark .panel-header__title { color: #F1F5F9; }
    .panel-header__count {
      font-size: 11px; font-weight: 500; color: #94A3B8; letter-spacing: .1px;
    }

    /* Séparateur dégradé sous le header */
    .panel-sep {
      height: 2px; flex-shrink: 0; margin: 0 16px 8px;
      border-radius: 2px; opacity: .5;
    }

    /* ── Nav ─────────────────────────────────────────────────── */
    .panel-nav {
      padding: 2px 8px 8px;
      display: flex; flex-direction: column; gap: 2px;
      overflow-y: auto; flex: 1; scrollbar-width: none;
    }
    .panel-nav::-webkit-scrollbar { display: none; }

    .panel-group-label {
      display: flex; align-items: center; gap: 8px;
      font-size: 10px; font-weight: 700; color: #B0B8CC;
      text-transform: uppercase; letter-spacing: 1px;
      padding: 14px 4px 6px;
    }
    .panel-group-label::after {
      content: ''; flex: 1; height: 1px;
      background: currentColor; opacity: .35;
    }
    .panel--dark .panel-group-label { color: #3D4E68; }

    /* ── Items ───────────────────────────────────────────────── */
    .panel-item {
      display: flex; align-items: center; gap: 8px;
      padding: 0 8px 0 10px; height: 36px;
      border-radius: 8px; text-decoration: none;
      font-size: 13px; font-weight: 500;
      color: var(--pi-color, #3C4555);
      position: relative; overflow: hidden;
      transition: background .15s, color .15s;
    }
    .panel-item:not(.active):hover {
      background: var(--ph-bg, rgba(0,0,0,.055)) !important;
      color: var(--ph-color, #1A1F36) !important;
    }
    .panel-item:not(.active):hover .panel-item__icon { color: var(--ph-icon, #4B5563) !important; }

    /* État actif */
    .panel-item--active {
      font-weight: 600;
      background: var(--item-bg, rgba(0,0,0,.06));
      color: var(--item-color, #1A1F36);
    }
    .panel-item--active::before {
      content: '';
      position: absolute; left: 0; top: 5px; bottom: 5px;
      width: 3px; border-radius: 0 3px 3px 0;
      background: var(--item-color, #1A1F36);
    }

    /* Icône directe */
    .panel-item__icon {
      font-size: 16px; width: 16px; height: 16px; flex-shrink: 0;
      color: var(--pi-icon, #8B93A9); transition: color .15s;
    }
    .panel-item--active .panel-item__icon { color: var(--item-color, #1A1F36); }

    /* Label */
    .panel-item__label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Badge */
    .panel-item__badge {
      font-size: 10px; font-weight: 700; min-width: 18px; height: 18px;
      background: #EF4444; color: white; border-radius: 9px;
      padding: 0 5px; display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }

    .panel-spacer { flex: 1; }

    /* ── Footer ─────────────────────────────────────────────── */
    .panel-org {
      font-size: 10px; font-weight: 700; color: #94A3B8;
      text-transform: uppercase; letter-spacing: .8px;
      padding: 6px 14px 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .panel--dark .panel-org { color: #3D4E68; }

    .panel-footer {
      padding: 6px 10px 14px; border-top: 1px solid #E4E8F0; flex-shrink: 0;
    }
    .panel--dark .panel-footer { border-color: rgba(255,255,255,.07); }

    .panel-user {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 8px; border-radius: 12px;
      transition: background .15s; cursor: default;
    }
    .panel-user:hover { background: rgba(0,0,0,.05); }
    .panel--dark .panel-user:hover { background: rgba(255,255,255,.06); }

    /* Avatar avec indicateur de présence */
    .panel-user__av-wrap {
      position: relative; flex-shrink: 0;
    }
    .panel-user__av {
      width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, #1565C0, #42A5F5);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: white;
    }
    .panel-user__status {
      position: absolute; bottom: 0; right: -1px;
      width: 9px; height: 9px; border-radius: 50%;
      background: #22C55E; border: 2px solid var(--panel-bg, #F7F8FD);
    }
    .panel--dark .panel-user__status { border-color: #141E2F; }

    .panel-user__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .panel-user__name {
      font-size: 12.5px; font-weight: 600; color: #1A1F36;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .panel--dark .panel-user__name { color: #F1F5F9; }
    .panel-user__role {
      font-size: 10.5px; color: #94A3B8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .panel--dark .panel-user__role { color: #64748B; }
    .panel-user__flag { font-size: 14px; flex-shrink: 0; }
  `],
})
export class SidebarComponent implements OnInit {

  activeModule      = signal<ModuleId | null>('apercu');
  isPersonnalisation = signal(false);

  private rolePerms = inject(RolePermissionsService);
  theme   = inject(ThemeService);
  helpSvc = inject(HelpService);
  constructor(public auth: AuthService, private router: Router) {}

  canSeeMenu(id: string): boolean {
    const role = this.auth.currentUser()?.role ?? '';
    return this.rolePerms.canSee(role, id);
  }

  ngOnInit() {
    this.syncFromRoute(this.router.url);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => this.syncFromRoute(e.urlAfterRedirects));
  }

  private syncFromRoute(url: string) {
    if      (url.startsWith('/dashboard'))                                        this.activeModule.set('apercu');
    else if (url.startsWith('/clients') || url.startsWith('/portefeuilles'))      this.activeModule.set('dossiers');
    else if (url.startsWith('/tasks'))                                            this.activeModule.set('travail');
    else if (url.startsWith('/documents'))                                        this.activeModule.set('documents');
    else if (url.startsWith('/notes'))                                            this.activeModule.set('notes');
    else if (url.startsWith('/admin/pointage-config'))                            this.activeModule.set('pointage');
    else if (url.startsWith('/equipes') || url.startsWith('/permissions-roles') || url.startsWith('/admin'))  this.activeModule.set('equipe');
    else if (url.startsWith('/pointage'))                                         this.activeModule.set('pointage');
    else if (url.startsWith('/salaries') || url.startsWith('/conges')) this.activeModule.set('rh');
    // /personnalisation : page utilitaire — on conserve le module actif courant (panel reste visible)
    else if (url.startsWith('/personnalisation'))                                   this.activeModule.set(null);
    else                                                                           this.activeModule.set(null);
    this.isPersonnalisation.set(url.startsWith('/personnalisation'));
  }

  get allModules(): AppModule[] {
    const isAdmin   = this.auth.isAdmin() || this.auth.isExpert();
    const canPortef = this.auth.canManagePortefeuilles();
    return [
      ...(this.canSeeMenu('dashboard') ? [{
        id: 'apercu' as ModuleId, icon: 'space_dashboard', label: 'Aperçu',
        color: '#0D9488', activeBg: '#CCFBF1',
        groups: [{ label: '', items: [
          { label: 'Tableau de bord', route: '/dashboard', icon: 'space_dashboard' },
        ]}],
      }] : []),
      ...((this.canSeeMenu('clients') || this.canSeeMenu('portefeuilles')) ? [{
        id: 'dossiers' as ModuleId, icon: 'folder_shared', label: 'Dossiers',
        color: '#1A73E8', activeBg: '#E8F0FE',
        groups: [{ label: '', items: [
          ...(this.canSeeMenu('clients')       ? [{ label: 'Tous les dossiers', route: '/clients',       icon: 'folder_open'   }] : []),
          ...(this.canSeeMenu('portefeuilles') && canPortef ? [{ label: 'Portefeuilles', route: '/portefeuilles', icon: 'account_tree' }] : []),
        ]}],
      }] : []),
      ...(this.canSeeMenu('tasks') ? [{
        id: 'travail' as ModuleId, icon: 'checklist_rtl', label: 'Travail',
        color: '#E8710A', activeBg: '#FEF3E2',
        groups: [{ label: '', items: [
          { label: 'Toutes les tâches', route: '/tasks', icon: 'task_alt' },
        ]}],
      }] : []),
      ...(this.canSeeMenu('documents') ? [{
        id: 'documents' as ModuleId, icon: 'insert_drive_file', label: 'Documents',
        color: '#C5221F', activeBg: '#FCE8E6',
        groups: [{ label: '', items: [
          { label: 'Tous les documents', route: '/documents', icon: 'folder_open' },
        ]}],
      }] : []),
      ...(this.canSeeMenu('notes') ? [{
        id: 'notes' as ModuleId, icon: 'sticky_note_2', label: 'Notes',
        color: '#D97706', activeBg: '#FEF3C7',
        groups: [{ label: '', items: [
          { label: 'Mes notes', route: '/notes', icon: 'edit_note' },
        ]}],
      }] : []),
      ...(this.canSeeMenu('equipes') ? [{
        id: 'equipe' as ModuleId, icon: 'groups',
        label: isAdmin ? 'Équipes' : (this.auth.isChefAntenne() ? 'Mon antenne' : (this.auth.isChefMission() ? 'Mon équipe' : 'Équipe')),
        color: '#7C3AED', activeBg: '#EDE9FE',
        groups: [{ label: '', items: [
          { label: isAdmin ? 'Hiérarchie des équipes' : (this.auth.isChefAntenne() ? 'Mon antenne' : 'Mon équipe'), route: '/equipes', icon: 'people' },
          ...(this.auth.isAdmin() ? [
            { label: 'Permissions des rôles', route: '/permissions-roles', icon: 'security' },
            { label: "Secteurs d'activité",   route: '/admin/secteurs',       icon: 'category'     },
          ] : []),
        ]}],
      }] : []),
      {
        id: 'pointage' as ModuleId, icon: 'fingerprint', label: 'Pointage',
        color: '#0F766E', activeBg: '#CCFBF1',
        groups: [{ label: '', items: [
          { label: 'Présences du jour', route: '/pointage', icon: 'fingerprint' },
          ...(isAdmin ? [
            { label: 'Config. pointage', route: '/admin/pointage-config', icon: 'location_on' },
          ] : []),
        ]}],
      },
      {
        id: 'rh' as ModuleId, icon: 'manage_accounts', label: 'RH', color: '#7C3AED', activeBg: '#EDE9FE', groups: [{ label: '', items: [
            ...(this.canSeeMenu('salaries') || this.canSeeMenu('conges') ? [{
              label: 'Ressources Humaines',
              route: '/rh',
              icon: 'manage_accounts',
            }] : []),
          ],
        }],
      },
    ];
  }

  visibleModules() { return this.allModules; }
  currentModule()  { return this.allModules.find(m => m.id === this.activeModule()) ?? null; }

  totalItems(mod: AppModule): number {
    return mod.groups.reduce((n, g) => n + g.items.length, 0);
  }

  roleLabel(): string {
    const role = this.auth.currentUser()?.role;
    const labels: Record<string, string> = {
      ADMIN:             'Administrateur',
      EXPERT_COMPTABLE:  'Expert-comptable',
      CHEF_ANTENNE:      'Chef d\'antenne',
      CHEF_MISSION:      'Chef de mission',
      COLLABORATEUR:     'Collaborateur',
      GERANT_MADAGASCAR: 'Gérant Madagascar',
    };
    return labels[role ?? ''] ?? 'Collaborateur';
  }

  /** True si le panel est en mode sombre */
  isDark(): boolean { return this.theme.prefs().panelStyleId === 'dark'; }

  /** Background de l'item actif : tint subtil en dark, couleur pastel en clair */
  activeBg(mod: AppModule): string {
    return this.isDark() ? 'rgba(255,255,255,.09)' : mod.activeBg;
  }

  selectModule(id: ModuleId) {
    this.activeModule.set(id);
    const mod = this.allModules.find(m => m.id === id);
    if (mod?.groups[0]?.items.length) this.router.navigate([mod.groups[0].items[0].route]);
  }

  initials() {
    const u = this.auth.currentUser();
    return u ? (u.firstName?.[0] || '') + (u.lastName?.[0] || '') : '?';
  }
  fullName() {
    const u = this.auth.currentUser();
    return u ? `${u.firstName} ${u.lastName}` : '';
  }
}
