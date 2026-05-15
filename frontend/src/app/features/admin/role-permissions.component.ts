import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RolePermissionsService, MENU_ITEMS, MenuItemDef } from '../../core/services/role-permissions.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-role-permissions',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-header__left">
          <div class="header-icon"><mat-icon>security</mat-icon></div>
          <div>
            <h1>Permissions des rôles</h1>
            <p>Définissez les sections accessibles pour chaque rôle dans la navigation</p>
          </div>
        </div>
      </div>

      <div class="perm-card">

        <!-- Onglets rôles -->
        <div class="role-tabs">
          @for (r of roles; track r.key) {
            <button class="role-tab" [class.active]="activeRole() === r.key"
                    (click)="activeRole.set(r.key)">
              <div class="role-tab__badge" [class]="'badge--' + r.key.toLowerCase().slice(0,2)">
                <mat-icon>{{ r.icon }}</mat-icon>
              </div>
              <div class="role-tab__text">
                <span class="role-tab__label">{{ r.label }}</span>
                <span class="role-tab__count">{{ permCount(r.key) }}/{{ menuItems.length }} sections</span>
              </div>
              @if (activeRole() === r.key) {
                <mat-icon class="role-tab__active-dot">check_circle</mat-icon>
              }
            </button>
          }
        </div>

        <div class="divider"></div>

        <!-- Info -->
        <div class="info-row">
          <mat-icon>info</mat-icon>
          <span>
            Les administrateurs ont toujours accès à tout. Seuls les rôles
            <strong>Expert Comptable</strong> et <strong>Collaborateur</strong> sont configurables.
          </span>
        </div>

        <!-- Grille menus -->
        <div class="menu-grid">
          @for (item of menuItems; track item.id) {
            <div class="menu-item" [class.menu-item--on]="hasPermission(activeRole(), item.id)"
                 (click)="togglePermission(activeRole(), item.id)">
              <div class="menu-item__icon">
                <mat-icon>{{ item.icon }}</mat-icon>
              </div>
              <span class="menu-item__label">{{ item.label }}</span>
              <div class="menu-item__toggle">
                <div class="toggle-track" [class.on]="hasPermission(activeRole(), item.id)">
                  <div class="toggle-thumb"></div>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="perm-footer">
          <div class="perm-footer__info">
            <mat-icon>tune</mat-icon>
            <span><strong>{{ permCount(activeRole()) }}</strong> section(s) activée(s) sur {{ menuItems.length }} pour le rôle
              <strong>{{ roles.find(r => r.key === activeRole())?.label }}</strong></span>
          </div>
          <button class="btn-save" [disabled]="saving()" (click)="save()">
            @if (saving()) {
              <mat-icon class="spin">refresh</mat-icon> Enregistrement…
            } @else {
              <mat-icon>save</mat-icon> Enregistrer les modifications
            }
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .page { padding: 32px; max-width: 900px; margin: 0 auto; }

    /* Header */
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
    .page-header__left { display: flex; align-items: center; gap: 16px; }
    .header-icon {
      width: 48px; height: 48px; border-radius: 14px;
      background: linear-gradient(135deg, #6366f1, #818cf8);
      display: flex; align-items: center; justify-content: center;
    }
    .header-icon mat-icon { color: white; font-size: 24px; width: 24px; height: 24px; }
    .page-header h1 { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0 0 4px; }
    .page-header p { font-size: 13px; color: #94a3b8; margin: 0; }

    /* Card */
    .perm-card { background: white; border: 1px solid #e8ecf0; border-radius: 20px; padding: 28px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

    /* Role tabs */
    .role-tabs { display: flex; gap: 12px; margin-bottom: 24px; }
    .role-tab {
      flex: 1; display: flex; align-items: center; gap: 14px;
      padding: 16px 20px; border-radius: 14px;
      border: 2px solid #e8ecf0; background: #f8fafc;
      cursor: pointer; transition: all .15s; text-align: left;
    }
    .role-tab:hover { border-color: #a5b4fc; background: #f5f3ff; }
    .role-tab.active { border-color: #6366f1; background: #eef2ff; }
    .role-tab__badge {
      width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: #e0e7ff;
    }
    .role-tab__badge mat-icon { font-size: 22px; width: 22px; height: 22px; color: #6366f1; }
    .role-tab.active .role-tab__badge { background: #6366f1; }
    .role-tab.active .role-tab__badge mat-icon { color: white; }
    .role-tab__text { flex: 1; }
    .role-tab__label { display: block; font-size: 14px; font-weight: 700; color: #334155; }
    .role-tab.active .role-tab__label { color: #3730a3; }
    .role-tab__count { font-size: 12px; color: #94a3b8; }
    .role-tab__active-dot { font-size: 20px; width: 20px; height: 20px; color: #6366f1; }

    .divider { height: 1px; background: #f1f5f9; margin: 0 0 20px; }

    /* Info */
    .info-row {
      display: flex; align-items: flex-start; gap: 10px;
      background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px;
      padding: 12px 16px; font-size: 13px; color: #1d4ed8;
      margin-bottom: 24px; line-height: 1.5;
    }
    .info-row mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }

    /* Menu grid */
    .menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; margin-bottom: 28px; }
    .menu-item {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 16px; border-radius: 12px;
      border: 1.5px solid #e8ecf0; background: #f8fafc;
      cursor: pointer; transition: all .15s; user-select: none;
    }
    .menu-item:hover { border-color: #a5b4fc; background: #f5f3ff; }
    .menu-item--on { border-color: #6366f1; background: #eef2ff; }
    .menu-item__icon {
      width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
      background: #e0e7ff; display: flex; align-items: center; justify-content: center;
      transition: background .15s;
    }
    .menu-item--on .menu-item__icon { background: #6366f1; }
    .menu-item__icon mat-icon { font-size: 20px; width: 20px; height: 20px; color: #6366f1; transition: color .15s; }
    .menu-item--on .menu-item__icon mat-icon { color: white; }
    .menu-item__label { flex: 1; font-size: 13.5px; font-weight: 600; color: #475569; transition: color .15s; }
    .menu-item--on .menu-item__label { color: #3730a3; }

    /* Toggle switch */
    .menu-item__toggle { flex-shrink: 0; }
    .toggle-track {
      width: 40px; height: 22px; border-radius: 11px; background: #cbd5e1;
      position: relative; transition: background .2s;
    }
    .toggle-track.on { background: #6366f1; }
    .toggle-thumb {
      position: absolute; top: 3px; left: 3px;
      width: 16px; height: 16px; border-radius: 50%;
      background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      transition: left .2s;
    }
    .toggle-track.on .toggle-thumb { left: 21px; }

    /* Footer */
    .perm-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding-top: 20px; border-top: 1px solid #f1f5f9;
    }
    .perm-footer__info { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748b; }
    .perm-footer__info mat-icon { font-size: 18px; width: 18px; height: 18px; color: #94a3b8; }
    .btn-save {
      display: inline-flex; align-items: center; gap: 8px;
      background: #6366f1; color: white; border: none;
      border-radius: 12px; padding: 12px 24px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: background .15s; font-family: inherit;
      box-shadow: 0 2px 8px rgba(99,102,241,.3);
    }
    .btn-save:hover:not(:disabled) { background: #4f46e5; }
    .btn-save:disabled { opacity: .6; cursor: default; box-shadow: none; }
    .btn-save mat-icon { font-size: 18px; width: 18px; height: 18px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spin { animation: spin 1s linear infinite; }
  `],
})
export class RolePermissionsComponent implements OnInit {
  private rolePermsSvc = inject(RolePermissionsService);
  private toast        = inject(ToastService);
  auth = inject(AuthService);

  menuItems: MenuItemDef[] = MENU_ITEMS;
  roles = [
    { key: 'EXPERT_COMPTABLE', label: 'Expert Comptable', icon: 'badge' },
    { key: 'COLLABORATEUR',    label: 'Collaborateur',    icon: 'person' },
  ];

  activeRole = signal<string>('EXPERT_COMPTABLE');
  saving     = signal(false);
  private localPerms: Record<string, Set<string>> = {};

  ngOnInit() {
    this.rolePermsSvc.load();
    setTimeout(() => this.syncFromService(), 500);
  }

  private syncFromService() {
    const all = this.rolePermsSvc.getAll();
    for (const r of this.roles) {
      const items = all[r.key] ?? MENU_ITEMS.map(m => m.id);
      this.localPerms[r.key] = new Set(items);
    }
    if (Object.keys(all).length === 0) setTimeout(() => this.syncFromService(), 400);
  }

  hasPermission(role: string, id: string): boolean {
    return this.localPerms[role]?.has(id) ?? true;
  }

  togglePermission(role: string, id: string) {
    if (!this.localPerms[role]) this.localPerms[role] = new Set(MENU_ITEMS.map(m => m.id));
    if (this.localPerms[role].has(id)) this.localPerms[role].delete(id);
    else this.localPerms[role].add(id);
  }

  permCount(role: string): number {
    return this.localPerms[role]?.size ?? MENU_ITEMS.length;
  }

  save() {
    const role  = this.activeRole();
    const items = Array.from(this.localPerms[role] ?? []);
    this.saving.set(true);
    this.rolePermsSvc.update(role, items).subscribe({
      next: () => {
        this.rolePermsSvc.load();
        const label = this.roles.find(r => r.key === role)?.label ?? role;
        this.toast.success(`Permissions "${label}" enregistrées`);
        this.saving.set(false);
      },
      error: () => {
        this.toast.error('Erreur lors de la sauvegarde');
        this.saving.set(false);
      },
    });
  }
}
