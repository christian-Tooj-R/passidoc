import { Component, signal, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { RolePermissionsService } from '../../core/services/role-permissions.service';
import { filter } from 'rxjs/operators';

type ModuleId = 'apercu' | 'dossiers' | 'travail' | 'documents' | 'notes' | 'equipe' | 'admin' | 'pointage';

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
              [matTooltip]="m.label" matTooltipPosition="right"
              (click)="selectModule(m.id)">
              <div class="rail-item__pill"
                   [style.background]="activeModule() === m.id ? 'rgba(147,197,253,0.22)' : 'transparent'">
                <mat-icon [style.color]="activeModule() === m.id ? '#93c5fd' : 'rgba(255,255,255,.50)'">
                  {{ m.icon }}
                </mat-icon>
              </div>
              <span class="rail-item__label"
                    [style.color]="activeModule() === m.id ? '#93c5fd' : 'rgba(255,255,255,.45)'">
                {{ m.label }}
              </span>
            </button>
          }
        </nav>

        <div class="rail-spacer"></div>
        <div class="rail-divider"></div>

        <!-- Avatar -->
        <button class="rail-avatar" [matTooltip]="fullName()" matTooltipPosition="right">
          <span>{{ initials() }}</span>
          <span class="rail-avatar__dot"></span>
        </button>

      </aside>

      <!-- ══ PANEL ══════════════════════════════════════ -->
      <aside class="panel">

        @if (currentModule(); as mod) {

          <!-- Header -->
          <div class="panel-header">
            <div class="panel-header__icon" [style.background]="mod.activeBg">
              <mat-icon [style.color]="mod.color">{{ mod.icon }}</mat-icon>
            </div>
            <span class="panel-header__title">{{ mod.label }}</span>
          </div>

          <!-- Groups + items -->
          <nav class="panel-nav">
            @for (group of mod.groups; track group.label) {
              @if (group.label) {
                <span class="panel-group-label">{{ group.label }}</span>
              }
              @for (item of group.items; track item.route) {
                <a [routerLink]="item.route"
                   routerLinkActive="active"
                   #rla="routerLinkActive"
                   class="panel-item"
                   [style.background]="rla.isActive ? mod.activeBg : ''"
                   [style.color]="rla.isActive ? mod.color : ''">
                  <mat-icon [style.color]="rla.isActive ? mod.color : '#5F6368'">{{ item.icon }}</mat-icon>
                  <span>{{ item.label }}</span>
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
          <div class="panel-user">
            <div class="panel-user__av">{{ initials() }}</div>
            <div class="panel-user__info">
              <span class="panel-user__name">{{ fullName() }}</span>
              <span class="panel-user__role">{{ auth.currentUser()?.role }}</span>
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
    .shell { display: flex; height: 100vh; flex-shrink: 0; }

    /* ══ RAIL ════════════════════════════════════════════ */
    .rail {
      width: 72px; height: 100vh; flex-shrink: 0;
      background: linear-gradient(180deg, #0c1a3a 0%, #1e3a8a 50%, #1d4ed8 100%);
      border-right: none;
      display: flex; flex-direction: column; align-items: center;
      padding: 14px 0 18px;
      z-index: 2;
      box-shadow: 2px 0 12px rgba(0,0,0,.25);
    }

    /* Logo */
    .rail-logo {
      width: 40px; height: 40px; border-radius: 12px;
      background: linear-gradient(135deg, #1565C0, #60a5fa);
      display: flex; align-items: center; justify-content: center;
      text-decoration: none; flex-shrink: 0; margin-bottom: 10px;
      box-shadow: 0 2px 8px rgba(21,101,192,.35);
      transition: transform .18s, box-shadow .18s;
    }
    .rail-logo:hover { transform: scale(1.06); box-shadow: 0 4px 14px rgba(96,165,250,.45); }
    .rail-logo mat-icon { color: #fff; font-size: 22px; width: 22px; height: 22px; }

    .rail-divider { width: 36px; height: 1px; background: rgba(255,255,255,.08); margin: 6px 0; flex-shrink: 0; }
    .rail-spacer  { flex: 1; }

    /* Rail items */
    .rail-nav { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 0; width: 100%; }

    .rail-item {
      width: 64px; border: none; background: transparent; cursor: pointer;
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 6px 0 8px; border-radius: 16px;
      transition: background .12s;
    }
    .rail-item:hover { background: rgba(255,255,255,.07); }

    .rail-item__pill {
      width: 48px; height: 32px; border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      transition: background .18s, box-shadow .18s;
    }
    .rail-item.active .rail-item__pill {
      box-shadow: 0 2px 12px rgba(96,165,250,.30), inset 0 0 0 1px rgba(147,197,253,.50);
    }
    .rail-item__pill mat-icon {
      font-size: 22px; width: 22px; height: 22px;
      transition: color .18s;
    }

    .rail-item__label {
      font-size: 10px; font-weight: 600; letter-spacing: .2px;
      line-height: 1; text-align: center;
      transition: color .18s;
    }

    /* Avatar */
    .rail-avatar {
      position: relative; width: 36px; height: 36px; border-radius: 50%;
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

    /* ══ PANEL ════════════════════════════════════════════ */
    .panel {
      width: 220px; height: 100vh; flex-shrink: 0;
      background: #F0F4FF;
      border-right: 1px solid #DDE3F0;
      display: flex; flex-direction: column; overflow: hidden;
    }

    /* Header */
    .panel-header {
      display: flex; align-items: center; gap: 12px;
      padding: 18px 16px 14px; flex-shrink: 0;
      border-bottom: 1px solid #DDE3F0;
    }
    .panel-header__icon {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .panel-header__icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .panel-header__title {
      font-size: 15px; font-weight: 700; color: #202124; letter-spacing: -.2px;
    }

    /* Nav */
    .panel-nav {
      padding: 8px 8px 4px;
      display: flex; flex-direction: column; gap: 1px;
      overflow-y: auto; flex: 1;
      scrollbar-width: none;
    }
    .panel-nav::-webkit-scrollbar { display: none; }

    .panel-group-label {
      font-size: 10.5px; font-weight: 700; color: #80868B;
      text-transform: uppercase; letter-spacing: .8px;
      padding: 12px 8px 5px; display: block;
    }

    .panel-item {
      display: flex; align-items: center; gap: 10px;
      padding: 0 12px; height: 38px;
      border-radius: 20px; text-decoration: none;
      font-size: 13.5px; font-weight: 500; color: #3C4043;
      transition: background .12s, color .12s;
    }
    .panel-item:hover { background: #E2E9F8; color: #202124; }
    .panel-item.active { font-weight: 600; }
    .panel-item mat-icon {
      font-size: 19px; width: 19px; height: 19px; flex-shrink: 0;
      transition: color .12s;
    }
    .panel-item:hover mat-icon { color: #3C4043; }
    .panel-item span { flex: 1; }
    .panel-item__badge {
      font-size: 10px; font-weight: 700; min-width: 18px; height: 18px;
      background: #D93025; color: white; border-radius: 9px;
      padding: 0 5px; display: flex; align-items: center; justify-content: center;
    }

    .panel-spacer { flex: 1; }

    /* Footer */
    .panel-footer {
      padding: 8px 10px 12px;
      border-top: 1px solid #DDE3F0;
      flex-shrink: 0;
    }
    .panel-user {
      display: flex; align-items: center; gap: 9px;
      padding: 8px 10px; border-radius: 12px;
      transition: background .12s; cursor: default;
    }
    .panel-user:hover { background: #E2E9F8; }
    .panel-user__av {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg, #1565C0, #42A5F5);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: white;
    }
    .panel-user__info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .panel-user__name {
      font-size: 12px; font-weight: 600; color: #202124;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .panel-user__role { font-size: 10.5px; color: #80868B; text-transform: capitalize; }
    .panel-user__flag { font-size: 15px; flex-shrink: 0; }
  `],
})
export class SidebarComponent implements OnInit {

  activeModule = signal<ModuleId>('apercu');

  private rolePerms = inject(RolePermissionsService);
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
    if      (url.startsWith('/dashboard'))                                this.activeModule.set('apercu');
    else if (url.startsWith('/clients') || url.startsWith('/portefeuilles')) this.activeModule.set('dossiers');
    else if (url.startsWith('/tasks'))                                    this.activeModule.set('travail');
    else if (url.startsWith('/documents'))                                this.activeModule.set('documents');
    else if (url.startsWith('/notes'))                                    this.activeModule.set('notes');
    else if (url.startsWith('/equipes'))                                  this.activeModule.set('equipe');
    else if (url.startsWith('/admin'))                                    this.activeModule.set('admin');
    else if (url.startsWith('/pointage'))                                 this.activeModule.set('pointage');
  }

  get allModules(): AppModule[] {
    const isAdmin   = this.auth.isAdmin();
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
        id: 'equipe' as ModuleId, icon: 'groups', label: isAdmin ? 'Équipes' : 'Équipe',
        color: '#7C3AED', activeBg: '#EDE9FE',
        groups: [{ label: '', items: [
          { label: isAdmin ? 'Toutes les équipes' : 'Mon équipe', route: '/equipes', icon: 'people' },
          ...(isAdmin ? [{ label: 'Permissions des rôles', route: '/permissions-roles', icon: 'security' }] : []),
        ]}],
      }] : []),
      {
        id: 'pointage' as ModuleId, icon: 'fingerprint', label: 'Pointage',
        color: '#0F766E', activeBg: '#CCFBF1',
        groups: [{ label: '', items: [
          { label: 'Présences du jour', route: '/pointage', icon: 'fingerprint' },
        ]}],
      },
      ...(isAdmin ? [{
        id: 'admin' as ModuleId, icon: 'admin_panel_settings', label: 'Admin',
        color: '#B45309', activeBg: '#FEF3C7',
        groups: [{ label: '', items: [
          { label: 'Utilisateurs', route: '/admin', icon: 'manage_accounts' },
        ]}],
      }] : []),
    ];
  }

  visibleModules() { return this.allModules; }
  currentModule()  { return this.allModules.find(m => m.id === this.activeModule()) ?? null; }

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
