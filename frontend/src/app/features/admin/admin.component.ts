import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../core/services/toast.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UsersService } from '../../core/services/users.service';
import { User } from '../../core/models/user.model';
import { DataTableComponent, ColDirective, ColumnDef } from '../../shared/data-table/data-table.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule,
    MatTooltipModule, DataTableComponent, ColDirective],
  template: `
    <div class="page">
      <div class="page-header">
        <div class="page-header__left">
          <mat-icon class="page-icon">manage_accounts</mat-icon>
          <div>
            <h1>Utilisateurs</h1>
            <p class="page-subtitle">{{ users.length }} compte(s) enregistré(s)</p>
          </div>
        </div>
      </div>

      <!-- Stats mini -->
      <div class="stats-row">
        <div class="stat-chip">
          <mat-icon>manage_accounts</mat-icon>
          <span>{{ countRole('ADMIN') }} Admin</span>
        </div>
        <div class="stat-chip">
          <mat-icon>work</mat-icon>
          <span>{{ countRole('EXPERT_COMPTABLE') }} Expert-comptable</span>
        </div>
        <div class="stat-chip">
          <mat-icon>badge</mat-icon>
          <span>{{ countRole('COLLABORATEUR') }} Collaborateur</span>
        </div>
        <div class="stat-chip">
          <mat-icon>flag</mat-icon>
          <span>{{ countSite('REUNION') }} Réunion · {{ countSite('MADAGASCAR') }} Madagascar</span>
        </div>
      </div>

      <app-data-table [columns]="colonnes" [data]="users" [pageSize]="0">

        <ng-template appCol="nom" let-u>
          <div class="user-cell">
            <div class="user-avatar">{{ (u.firstName?.[0] || '') + (u.lastName?.[0] || '') }}</div>
            <span class="user-name">{{ u.firstName }} {{ u.lastName }}</span>
          </div>
        </ng-template>

        <ng-template appCol="role" let-u>
          <span class="role-badge" [class]="'role-' + u.role?.toLowerCase()">{{ roleLabel(u.role) }}</span>
        </ng-template>

        <ng-template appCol="site" let-u>
          <span [class]="u.site === 'REUNION' ? 'badge-reunion' : 'badge-madagascar'">
            {{ u.site === 'REUNION' ? '🇷🇪 La Réunion' : '🇲🇬 Madagascar' }}
          </span>
        </ng-template>

        <ng-template appCol="twofa" let-u>
          <span class="twofa-badge" [class.active]="u.isTwoFactorEnabled">
            <mat-icon>{{ u.isTwoFactorEnabled ? 'verified_user' : 'gpp_maybe' }}</mat-icon>
            {{ u.isTwoFactorEnabled ? 'Activé' : 'Inactif' }}
          </span>
        </ng-template>

        <ng-template appCol="actions" let-u>
          <button mat-icon-button class="btn-delete" matTooltip="Désactiver l'utilisateur" (click)="deleteUser(u)">
            <mat-icon>person_off</mat-icon>
          </button>
        </ng-template>

      </app-data-table>
    </div>
  `,
  styles: [`
    .page { padding: 32px 36px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-header__left { display: flex; align-items: center; gap: 16px; }
    .page-icon { font-size: 32px; width: 32px; height: 32px; color: #6366f1; }
    .page-header h1 { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0; line-height: 1.2; }
    .page-subtitle { font-size: 13px; color: #94a3b8; margin: 0; }
    /* Stats */
    .stats-row { display: flex; gap: 12px; margin-bottom: 28px; flex-wrap: wrap; }
    .stat-chip {
      display: flex; align-items: center; gap: 8px;
      background: white; border: 1px solid #e8ecf0;
      border-radius: 10px; padding: 8px 14px;
      font-size: 13px; font-weight: 500; color: #475569;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .stat-chip mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; }

    /* Table wrapper */
    app-data-table { display: block; margin-bottom: 8px; }

    .user-cell { display: flex; align-items: center; gap: 10px; }
    .user-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, #dbeafe, #c7d2fe);
      color: #1e40af; font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      text-transform: uppercase;
    }
    .user-avatar.small { width: 26px; height: 26px; font-size: 10px; }
    .folder-avatar {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      color: #d97706; font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .user-name { font-size: 14px; font-weight: 600; color: #1e293b; }
    .text-muted { font-size: 13px; color: #64748b; }
    .resp-none { font-size: 13px; color: #cbd5e1; font-style: italic; }

    .role-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
    .role-admin { background: #ede9fe; color: #7c3aed; }
    .role-expert_comptable { background: #dbeafe; color: #1d4ed8; }
    .role-collaborateur { background: #f0fdf4; color: #15803d; }

    .badge-reunion { display: inline-flex; align-items: center; background: #dbeafe; color: #1d4ed8; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .badge-madagascar { display: inline-flex; align-items: center; background: #dcfce7; color: #15803d; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }

    .twofa-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 500; color: #94a3b8; }
    .twofa-badge mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .twofa-badge.active { color: #15803d; }

    .action-cell { text-align: right; }
    .btn-delete { color: #cbd5e1 !important; }
    .btn-delete:hover { color: #f87171 !important; }

    .empty-state { text-align: center; padding: 48px !important; color: #94a3b8; }
    .empty-state mat-icon { font-size: 36px; width: 36px; height: 36px; display: block; margin: 0 auto 8px; }
  `],
})
export class AdminComponent implements OnInit {
  private usersService = inject(UsersService);
  private toast = inject(ToastService);

  users: User[] = [];

  readonly colonnes: ColumnDef[] = [
    { key: 'nom',     label: 'Utilisateur' },
    { key: 'email',   label: 'Email' },
    { key: 'role',    label: 'Rôle' },
    { key: 'site',    label: 'Site' },
    { key: 'twofa',   label: '2FA' },
    { key: 'actions', label: '' },
  ];

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() { this.usersService.getAll().subscribe((d) => (this.users = d)); }

  deleteUser(u: User) {
    if (!confirm(`Désactiver le compte de ${u.firstName} ${u.lastName} ?`)) return;
    this.usersService.delete(u.id).subscribe(() => {
      this.loadUsers();
      this.toast.success('Utilisateur désactivé');
    });
  }

  roleLabel(role: string) {
    if (role === 'ADMIN') return 'Admin';
    if (role === 'EXPERT_COMPTABLE') return 'Expert-comptable';
    return 'Collaborateur';
  }
  countRole(role: string) { return this.users.filter((u) => u.role === role).length; }
  countSite(site: string) { return this.users.filter((u) => u.site === site).length; }
}
