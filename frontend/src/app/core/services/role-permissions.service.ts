import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface MenuItemDef {
  id: string;
  label: string;
  icon: string;
}

export const MENU_ITEMS: MenuItemDef[] = [
  { id: 'dashboard',     label: 'Tableau de bord',   icon: 'space_dashboard'    },
  { id: 'clients',       label: 'Tous les dossiers', icon: 'folder_open'        },
  { id: 'portefeuilles', label: 'Portefeuilles',     icon: 'account_tree'       },
  { id: 'tasks',         label: 'Tâches',            icon: 'task_alt'           },
  { id: 'documents',     label: 'Documents',         icon: 'insert_drive_file'  },
  { id: 'notes',         label: 'Notes',             icon: 'sticky_note_2'      },
  { id: 'equipes',       label: 'Équipe',            icon: 'groups'             },
];

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  EXPERT_COMPTABLE:  MENU_ITEMS.map(m => m.id),
  CHEF_ANTENNE:      ['dashboard', 'clients', 'tasks', 'documents', 'notes', 'equipes'],
  CHEF_MISSION:      ['dashboard', 'clients', 'tasks', 'documents', 'notes', 'equipes'],
  GERANT_MADAGASCAR: ['dashboard', 'clients', 'tasks', 'documents', 'notes', 'equipes'],
  COLLABORATEUR:     ['dashboard', 'clients', 'tasks', 'documents', 'notes', 'equipes'],
};

@Injectable({ providedIn: 'root' })
export class RolePermissionsService {
  private readonly api = `${environment.apiUrl}/role-permissions`;
  private _permissions = signal<Record<string, string[]>>({});

  constructor(private http: HttpClient) {}

  load() {
    this.http.get<{ role: string; menuItems: string[] }[]>(this.api).subscribe({
      next: data => {
        const map: Record<string, string[]> = {};
        data.forEach(p => (map[p.role] = p.menuItems));
        this._permissions.set(map);
      },
      error: () => this._permissions.set(DEFAULT_PERMISSIONS),
    });
  }

  getAll() { return this._permissions(); }

  canSee(role: string, menuItemId: string): boolean {
    if (role === 'ADMIN') return true;
    const perms = this._permissions()[role] ?? DEFAULT_PERMISSIONS[role] ?? MENU_ITEMS.map(m => m.id);
    return perms.includes(menuItemId);
  }

  update(role: string, menuItems: string[]) {
    return this.http.patch<any>(`${this.api}/${role}`, { menuItems });
  }
}
