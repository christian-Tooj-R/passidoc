import { Component, signal, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { filter } from 'rxjs/operators';

// ─── Types ────────────────────────────────────────────────
type ModuleId = 'apercu' | 'dossiers' | 'travail' | 'documents' | 'equipe' | 'admin';

interface SubItem {
  label: string;
  route: string;
  icon: string;
  badge?: number;
}

interface AppModule {
  id: ModuleId;
  railIcon: string;
  railLabel: string;
  panelTitle: string;
  panelColor: string;
  panelTextColor: string;
  items: SubItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule],
  template: `
    <div class="sidebar-shell">

      <!-- ══════════════════════════════════════════════
           RAIL  (colonne 1 — module switcher)
      ══════════════════════════════════════════════ -->
      <aside class="rail">

        <a routerLink="/dashboard" class="rail__logo" matTooltip="Passidoc" matTooltipPosition="right">
          <mat-icon>description</mat-icon>
        </a>

        <div class="rail__sep"></div>

        <nav class="rail__nav">
          @for (m of visibleModules(); track m.id) {
            <button
              class="rail__btn"
              [class.active]="activeModule() === m.id"
              (click)="selectModule(m.id)">
              <div class="rail__btn-indicator">
                <mat-icon>{{ m.railIcon }}</mat-icon>
              </div>
              <span class="rail__btn-label">{{ m.railLabel }}</span>
            </button>
          }
        </nav>

        <div class="rail__spacer"></div>

        <!-- Séparateur bottom -->
        <div class="rail__sep"></div>

        <!-- Avatar utilisateur -->
        <div class="rail__avatar-wrap" [matTooltip]="userName()" matTooltipPosition="right">
          <div class="rail__avatar">{{ initials() }}</div>
          <span class="rail__role-dot"></span>
        </div>

      </aside>

      <!-- ══════════════════════════════════════════════
           NAV PANEL  (colonne 2 — navigation détaillée)
      ══════════════════════════════════════════════ -->
      <aside class="nav-panel">

        <!-- Header du module actif -->
        @if (currentModule(); as mod) {
          <div class="panel-head">
            <div class="panel-head__icon" [style.background]="mod.panelColor">
              <mat-icon [style.color]="mod.panelTextColor">{{ mod.railIcon }}</mat-icon>
            </div>
            <div class="panel-head__title">{{ mod.panelTitle }}</div>
          </div>

          <!-- Items du module -->
          <nav class="panel-nav">
            @for (item of mod.items; track item.route) {
              <a [routerLink]="item.route"
                 routerLinkActive="active"
                 class="panel-item">
                <span class="panel-item__icon">
                  <mat-icon>{{ item.icon }}</mat-icon>
                </span>
                <span class="panel-item__label">{{ item.label }}</span>
                @if (item.badge) {
                  <span class="panel-item__badge">{{ item.badge }}</span>
                }
              </a>
            }
          </nav>
        }

        <div class="panel-spacer"></div>

        <!-- Footer site -->
        <div class="panel-footer">
          <div class="site-chip" [class.site-mg]="auth.currentUser()?.site === 'MADAGASCAR'">
            <span class="site-dot"></span>
            {{ auth.currentUser()?.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}
          </div>
        </div>

      </aside>
    </div>
  `,
  styles: [`
    /* ── Shell ──────────────────────────────────────── */
    .sidebar-shell {
      display: flex;
      flex-direction: row;
      height: 100vh;
      flex-shrink: 0;
    }

    /* ══════════════════════════════════════════════════
       RAIL — MD3 Navigation Rail (80px)
    ══════════════════════════════════════════════════ */
    .rail {
      width: 80px;
      height: 100vh;
      background: linear-gradient(180deg, #0f2040 0%, #1e3a8a 55%, #312e81 100%);
      box-shadow: 4px 0 16px rgba(15,32,64,.30);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 0 16px;
      flex-shrink: 0;
      position: relative;
      z-index: 2;
    }

    /* Logo */
    .rail__logo {
      width: 40px; height: 40px;
      background: linear-gradient(135deg, #19D9B4, #53DA85);
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      text-decoration: none;
      flex-shrink: 0;
      margin-bottom: 8px;
      box-shadow: 0 2px 8px rgba(25,217,180,.4);
    }
    .rail__logo mat-icon { color: #0F1523; font-size: 20px; width: 20px; height: 20px; }

    .rail__sep { width: 40px; height: 1px; background: rgba(255,255,255,.08); margin: 6px 0; }

    /* Nav buttons — MD3: icon + label */
    .rail__nav {
      display: flex; flex-direction: column; gap: 4px;
      width: 100%; align-items: center; padding: 4px 0;
    }

    .rail__btn {
      width: 72px;
      border: none; background: transparent; cursor: pointer;
      border-radius: 16px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 4px;
      padding: 6px 0 8px;
      transition: background .12s;
    }
    .rail__btn:hover { background: rgba(255,255,255,.06); }

    /* MD3 active indicator pill */
    .rail__btn-indicator {
      width: 56px; height: 32px;
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s;
      background: transparent;
    }
    .rail__btn:hover .rail__btn-indicator { background: rgba(255,255,255,.08); }
    .rail__btn.active .rail__btn-indicator { background: rgba(25,217,180,.22); }

    .rail__btn-indicator mat-icon {
      font-size: 22px; width: 22px; height: 22px;
      color: rgba(255,255,255,.55);
      transition: color .12s;
    }
    .rail__btn:hover .rail__btn-indicator mat-icon { color: rgba(255,255,255,.80); }
    .rail__btn.active .rail__btn-indicator mat-icon { color: #19D9B4; }

    /* Label sous l'icône */
    .rail__btn-label {
      font-size: 10px; font-weight: 500; letter-spacing: .2px;
      color: rgba(255,255,255,.45);
      transition: color .12s;
      line-height: 1;
      text-align: center;
    }
    .rail__btn:hover .rail__btn-label { color: rgba(255,255,255,.75); }
    .rail__btn.active .rail__btn-label { color: #19D9B4; font-weight: 600; }

    .rail__spacer { flex: 1; }

    /* Avatar */
    .rail__avatar-wrap {
      position: relative; cursor: pointer; margin-top: 6px;
    }
    .rail__avatar {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, #19D9B4, #53DA85);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: #0F1523;
    }
    .rail__role-dot {
      position: absolute; bottom: 1px; right: 1px;
      width: 9px; height: 9px;
      background: #19D9B4;
      border-radius: 50%;
      border: 2px solid #1e3a8a;
    }

    /* ══════════════════════════════════════════════════
       NAV PANEL
    ══════════════════════════════════════════════════ */
    .nav-panel {
      width: 220px;
      height: 100vh;
      background: #FFFBFE;
      border-right: 1px solid #E0E2EC;
      box-shadow: 1px 0 2px rgba(0,0,0,.12);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex-shrink: 0;
    }

    /* Panel header */
    .panel-head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 16px 16px;
      border-bottom: 1px solid #E8EAED;
      flex-shrink: 0;
    }
    .panel-head__icon {
      width: 36px; height: 36px; flex-shrink: 0;
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
    }
    .panel-head__icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .panel-head__title {
      font-size: 15px;
      font-weight: 700;
      color: #1A1C1E;
      letter-spacing: -.2px;
    }

    /* Nav items */
    .panel-nav {
      padding: 10px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 0;
    }

    .panel-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 28px;
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 500;
      color: #44474F;
      transition: background .12s, color .12s;
    }
    .panel-item:hover { background: #E8EAED; color: #1A1C1E; }
    .panel-item.active {
      background: #DDE3EA;
      color: #1A1C1E;
      font-weight: 600;
    }
    .panel-item.active::before {
      /* handled via border-left on the element */
    }

    .panel-item__icon {
      width: 24px; height: 24px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .panel-item__icon mat-icon {
      font-size: 20px; width: 20px; height: 20px;
      color: #44474F;
    }
    .panel-item.active .panel-item__icon mat-icon { color: #1A1C1E; }
    .panel-item__label { flex: 1; line-height: 1; }
    .panel-item__badge {
      font-size: 10px; font-weight: 700;
      background: #EF4444; color: #fff;
      padding: 1px 6px; border-radius: 20px;
    }

    .panel-spacer { flex: 1; }

    /* Footer */
    .panel-footer {
      padding: 10px 12px 16px;
      border-top: 1px solid #E8EAED;
      flex-shrink: 0;
    }
    .site-chip {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; border-radius: 28px;
      background: #E8EAED;
      font-size: 12px; font-weight: 600; color: #1A1C1E;
    }
    .site-chip.site-mg { background: #DDE3EA; color: #162351; }
    .site-dot { width: 7px; height: 7px; border-radius: 50%; background: #19D9B4; flex-shrink: 0; }
  `],
})
export class SidebarComponent implements OnInit {

  activeModule = signal<ModuleId>('apercu');

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    // Sync active module with current route
    this.syncModuleFromRoute(this.router.url);
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => this.syncModuleFromRoute(e.urlAfterRedirects));
  }

  private syncModuleFromRoute(url: string) {
    if (url.startsWith('/dashboard')) this.activeModule.set('apercu');
    else if (url.startsWith('/clients') || url.startsWith('/portefeuilles')) this.activeModule.set('dossiers');
    else if (url.startsWith('/tasks')) this.activeModule.set('travail');
    else if (url.startsWith('/documents')) this.activeModule.set('documents');
    else if (url.startsWith('/equipes')) this.activeModule.set('equipe');
    else if (url.startsWith('/admin')) this.activeModule.set('admin');
  }

  get allModules(): AppModule[] {
    const isAdmin = this.auth.isAdmin();
    const canPortef = this.auth.canManagePortefeuilles();
    return [
      {
        id: 'apercu',
        railIcon: 'grid_view',
        railLabel: 'Aperçu',
        panelTitle: 'Aperçu général',
        panelColor: 'linear-gradient(135deg, #19D9B4, #53DA85)',
        panelTextColor: '#0F1523',
        items: [
          { label: 'Tableau de bord', route: '/dashboard', icon: 'space_dashboard' },
        ],
      },
      {
        id: 'dossiers',
        railIcon: 'folder_shared',
        railLabel: 'Dossiers',
        panelTitle: 'Dossiers clients',
        panelColor: 'linear-gradient(135deg, #3B82F6, #6366F1)',
        panelTextColor: '#fff',
        items: [
          { label: 'Tous les dossiers', route: '/clients', icon: 'folder_open' },
          ...(canPortef ? [{ label: 'Portefeuilles', route: '/portefeuilles', icon: 'account_tree' }] : []),
        ],
      },
      {
        id: 'travail',
        railIcon: 'checklist_rtl',
        railLabel: 'Mon travail',
        panelTitle: 'Mon travail',
        panelColor: 'linear-gradient(135deg, #F97316, #EF4444)',
        panelTextColor: '#fff',
        items: [
          { label: 'Toutes les tâches', route: '/tasks', icon: 'task_alt' },
        ],
      },
      {
        id: 'documents',
        railIcon: 'insert_drive_file',
        railLabel: 'Documents',
        panelTitle: 'Documents',
        panelColor: 'linear-gradient(135deg, #F43F5E, #EC4899)',
        panelTextColor: '#fff',
        items: [
          { label: 'Tous les documents', route: '/documents', icon: 'folder_open' },
          { label: 'Importer', route: '/documents/import', icon: 'upload_file' },
        ],
      },
      {
        id: 'equipe',
        railIcon: 'groups',
        railLabel: isAdmin ? 'Équipes' : 'Mon équipe',
        panelTitle: isAdmin ? 'Gestion équipes' : 'Mon équipe',
        panelColor: 'linear-gradient(135deg, #EC4899, #F43F5E)',
        panelTextColor: '#fff',
        items: [
          { label: isAdmin ? 'Toutes les équipes' : 'Mon équipe', route: '/equipes', icon: 'people' },
        ],
      },
      ...(isAdmin ? [{
        id: 'admin' as ModuleId,
        railIcon: 'admin_panel_settings',
        railLabel: 'Administration',
        panelTitle: 'Administration',
        panelColor: 'linear-gradient(135deg, #F59E0B, #EAB308)',
        panelTextColor: '#1a1200',
        items: [
          { label: 'Utilisateurs', route: '/admin', icon: 'manage_accounts' },
        ],
      }] : []),
    ];
  }

  visibleModules() { return this.allModules; }

  currentModule() {
    return this.allModules.find(m => m.id === this.activeModule()) ?? null;
  }

  selectModule(id: ModuleId) {
    this.activeModule.set(id);
    const mod = this.allModules.find(m => m.id === id);
    if (mod?.items.length) {
      this.router.navigate([mod.items[0].route]);
    }
  }

  initials() {
    const u = this.auth.currentUser();
    if (!u) return '?';
    return (u.firstName?.[0] || '') + (u.lastName?.[0] || '');
  }

  userName() {
    const u = this.auth.currentUser();
    return u ? `${u.firstName} ${u.lastName} — ${u.role}` : '';
  }
}
