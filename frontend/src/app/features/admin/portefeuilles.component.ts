import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ToastService } from '../../core/services/toast.service';
import { UsersService } from '../../core/services/users.service';
import { ClientsService } from '../../core/services/clients.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';
import { User } from '../../core/models/user.model';
import { Client } from '../../core/models/client.model';

@Component({
  selector: 'app-portefeuilles',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatButtonModule, MatIconModule, MatSelectModule,
    MatTooltipModule, MatFormFieldModule,
  ],
  template: `
<div class="page">

  <!-- ── En-tête ── -->
  <div class="page-header">
    <div class="page-header__left">
      <div class="page-icon-wrap"><mat-icon>supervisor_account</mat-icon></div>
      <div>
        <h1>Affectations</h1>
        <p class="page-subtitle">Répartition des dossiers par directeur et collaborateur</p>
      </div>
    </div>
  </div>

  <!-- ── Stat cards ── -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-card__icon indigo"><mat-icon>folder</mat-icon></div>
      <div class="stat-card__body">
        <span class="stat-card__value">{{ allClients.length }}</span>
        <span class="stat-card__label">Total dossiers</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card__icon" [class.amber]="noDirecteurCount > 0" [class.green]="noDirecteurCount === 0">
        <mat-icon>manage_accounts</mat-icon>
      </div>
      <div class="stat-card__body">
        <span class="stat-card__value" [class.text-amber]="noDirecteurCount > 0">{{ noDirecteurCount }}</span>
        <span class="stat-card__label">Sans directeur</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card__icon" [class.amber]="noCollabCount > 0" [class.green]="noCollabCount === 0">
        <mat-icon>person_off</mat-icon>
      </div>
      <div class="stat-card__body">
        <span class="stat-card__value" [class.text-amber]="noCollabCount > 0">{{ noCollabCount }}</span>
        <span class="stat-card__label">Sans collaborateur</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card__icon blue"><mat-icon>groups</mat-icon></div>
      <div class="stat-card__body">
        <span class="stat-card__value">{{ assignableUsers.length }}</span>
        <span class="stat-card__label">Intervenants actifs</span>
      </div>
    </div>
  </div>

  <!-- ── Filtres ── -->
  <div class="filters-row">
    <button class="filter-chip" [class.active]="siteFilter === null" (click)="siteFilter = null">
      <mat-icon>layers</mat-icon> Tous ({{ allClients.length }})
    </button>
    <button class="filter-chip" [class.active]="siteFilter === 'REUNION'" (click)="siteFilter = 'REUNION'">
      {{ tenantSvc.poleFlag1() }} {{ tenantSvc.poleLabel1() }} ({{ countSite('REUNION') }})
    </button>
    <button class="filter-chip" [class.active]="siteFilter === 'MADAGASCAR'" (click)="siteFilter = 'MADAGASCAR'">
      {{ tenantSvc.poleFlag2() }} {{ tenantSvc.poleLabel2() }} ({{ countSite('MADAGASCAR') }})
    </button>
    <div class="filter-search">
      <mat-icon>search</mat-icon>
      <input [(ngModel)]="search" placeholder="Rechercher un dossier…" class="search-input">
    </div>
  </div>

  <!-- ── Table ── -->
  <div class="table-wrap">
    <table class="aff-table">
      <thead>
        <tr>
          <th class="th-nom">Dossier</th>
          <th class="th-pole">Pôle</th>
          <th class="th-directeur">Directeur</th>
          <th class="th-collab">Collaborateur</th>
          <th class="th-action"></th>
        </tr>
      </thead>
      <tbody>
        @for (c of filteredClients; track c.id) {
          <tr class="aff-row">
            <!-- Nom dossier -->
            <td class="td-nom">
              <div class="client-cell">
                <div class="client-avatar" [class.ca--re]="c.site === 'REUNION'" [class.ca--mg]="c.site !== 'REUNION'">
                  {{ c.nom[0] }}
                </div>
                <span class="client-name">{{ c.nom }}</span>
              </div>
            </td>

            <!-- Pôle -->
            <td class="td-pole">
              <span class="pole-chip" [class.pole-chip--re]="c.site === 'REUNION'" [class.pole-chip--mg]="c.site !== 'REUNION'">
                {{ c.site === 'REUNION' ? tenantSvc.poleFlag1() : tenantSvc.poleFlag2() }}
                {{ c.site === 'REUNION' ? tenantSvc.poleLabel1() : tenantSvc.poleLabel2() }}
              </span>
            </td>

            <!-- Directeur -->
            <td class="td-directeur">
              <div class="assign-cell" [class.assign-cell--empty]="!c.directeur">
                <mat-icon class="assign-icon">manage_accounts</mat-icon>
                <select class="assign-select"
                        [value]="c.directeur?.id ?? ''"
                        (change)="onDirecteurChange(c, $any($event.target).value)">
                  <option value="">— Non assigné —</option>
                  @for (u of assignableUsers; track u.id) {
                    <option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</option>
                  }
                </select>
              </div>
            </td>

            <!-- Collaborateur -->
            <td class="td-collab">
              <div class="assign-cell" [class.assign-cell--empty]="!c.collaborateurMg">
                <mat-icon class="assign-icon">person</mat-icon>
                <select class="assign-select"
                        [value]="c.collaborateurMg?.id ?? ''"
                        (change)="onCollabChange(c, $any($event.target).value)">
                  <option value="">— Non assigné —</option>
                  @for (u of assignableUsers; track u.id) {
                    <option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</option>
                  }
                </select>
              </div>
            </td>

            <!-- Action -->
            <td class="td-action">
              <a [routerLink]="['/clients', c.id]" mat-icon-button matTooltip="Ouvrir le dossier" class="btn-open">
                <mat-icon>open_in_new</mat-icon>
              </a>
            </td>
          </tr>
        } @empty {
          <tr>
            <td colspan="5" class="td-empty">
              <mat-icon>search_off</mat-icon>
              <span>Aucun dossier trouvé</span>
            </td>
          </tr>
        }
      </tbody>
    </table>
  </div>

</div>
  `,
  styles: [`
    .page { padding: 24px; max-width: 1200px; }

    /* ── En-tête ── */
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .page-header__left { display: flex; align-items: center; gap: 16px; }
    .page-icon-wrap {
      width: 48px; height: 48px; border-radius: 14px;
      background: linear-gradient(135deg, #6366f1, #818cf8);
      display: flex; align-items: center; justify-content: center;
      mat-icon { color: white; font-size: 24px; width: 24px; height: 24px; }
    }
    h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin: 0; }
    .page-subtitle { font-size: 13px; color: #94a3b8; margin: 2px 0 0; }

    /* ── Stats ── */
    .stats-grid {
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 16px; margin-bottom: 20px;
    }
    .stat-card {
      background: white; border-radius: 14px;
      border: 1px solid #e8ecf0; padding: 16px;
      display: flex; align-items: center; gap: 14px;
    }
    .stat-card__icon {
      width: 42px; height: 42px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: white; }
    }
    .indigo { background: linear-gradient(135deg, #6366f1, #818cf8); }
    .amber  { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
    .green  { background: linear-gradient(135deg, #10b981, #34d399); }
    .blue   { background: linear-gradient(135deg, #0ea5e9, #38bdf8); }
    .stat-card__value { font-size: 24px; font-weight: 800; color: #0f172a; display: block; }
    .stat-card__label { font-size: 12px; color: #94a3b8; }
    .text-amber { color: #d97706 !important; }

    /* ── Filtres ── */
    .filters-row {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 16px; flex-wrap: wrap;
    }
    .filter-chip {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500;
      border: 1.5px solid #e2e8f0; background: white; cursor: pointer;
      color: #64748b; transition: all .15s;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .filter-chip:hover { border-color: #a5b4fc; color: #4338ca; }
    .filter-chip.active { background: #eef2ff; border-color: #6366f1; color: #4338ca; font-weight: 700; }
    .filter-search {
      margin-left: auto; display: flex; align-items: center; gap: 6px;
      background: white; border: 1.5px solid #e2e8f0; border-radius: 20px;
      padding: 5px 14px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; }
    }
    .search-input {
      border: none; outline: none; font-size: 13px; color: #1e293b;
      background: transparent; width: 200px;
    }

    /* ── Table ── */
    .table-wrap {
      background: white; border-radius: 16px;
      border: 1px solid #e8ecf0;
      overflow: hidden;
    }
    .aff-table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f8fafc; }
    thead th {
      padding: 11px 16px; text-align: left;
      font-size: 11px; font-weight: 700; color: #94a3b8;
      text-transform: uppercase; letter-spacing: .5px;
      border-bottom: 1px solid #e2e8f0;
    }
    .aff-row { border-bottom: 1px solid #f1f5f9; transition: background .1s; }
    .aff-row:last-child { border-bottom: none; }
    .aff-row:hover { background: #fafbff; }
    td { padding: 10px 16px; vertical-align: middle; }

    /* Client cell */
    .client-cell { display: flex; align-items: center; gap: 10px; }
    .client-avatar {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; color: white; flex-shrink: 0;
    }
    .ca--re { background: linear-gradient(135deg, #6366f1, #818cf8); }
    .ca--mg { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
    .client-name { font-size: 13px; font-weight: 600; color: #1e293b; }

    /* Pôle chip */
    .pole-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 10px; border-radius: 12px;
      font-size: 11px; font-weight: 600;
    }
    .pole-chip--re { background: #eef2ff; color: #4338ca; }
    .pole-chip--mg { background: #fffbeb; color: #b45309; }

    /* Assign cell */
    .assign-cell {
      display: flex; align-items: center; gap: 6px;
    }
    .assign-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; flex-shrink: 0; }
    .assign-cell--empty .assign-icon { color: #fca5a5; }
    .assign-select {
      border: 1.5px solid #e2e8f0; border-radius: 8px;
      padding: 5px 8px; font-size: 12px; color: #1e293b;
      background: white; cursor: pointer; outline: none;
      transition: border-color .15s; min-width: 160px;
      &:focus { border-color: #6366f1; }
    }
    .assign-cell--empty .assign-select { border-color: #fecaca; color: #ef4444; }

    /* Action */
    .td-action { text-align: right; }
    .btn-open { color: #6366f1 !important; }
    .td-empty {
      text-align: center; padding: 40px !important; color: #94a3b8;
      mat-icon { font-size: 32px; width: 32px; height: 32px; display: block; margin: 0 auto 8px; }
    }

    @media (max-width: 900px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .th-pole, .td-pole { display: none; }
    }
  `],
})
export class PortefeuillesComponent implements OnInit {
  auth          = inject(AuthService);
  tenantSvc     = inject(TenantService);
  private clientsSvc = inject(ClientsService);
  private usersSvc   = inject(UsersService);
  private toast      = inject(ToastService);

  allClients: Client[]     = [];
  assignableUsers: User[]  = [];
  siteFilter: string | null = null;
  search = '';

  get noDirecteurCount(): number {
    return this.allClients.filter(c => !c.directeur).length;
  }

  get noCollabCount(): number {
    return this.allClients.filter(c => !c.collaborateurMg).length;
  }

  get filteredClients(): Client[] {
    let list = this.siteFilter
      ? this.allClients.filter(c => c.site === this.siteFilter)
      : [...this.allClients];
    if (this.search.trim()) {
      const q = this.search.toLowerCase();
      list = list.filter(c => c.nom.toLowerCase().includes(q));
    }
    return list;
  }

  countSite(site: string): number {
    return this.allClients.filter(c => c.site === site).length;
  }

  ngOnInit() {
    this.clientsSvc.getAll().subscribe(c => { this.allClients = c; });
    this.usersSvc.getAssignable().subscribe(u => { this.assignableUsers = u; });
  }

  onDirecteurChange(client: Client, value: string) {
    const id = value ? +value : null;
    this.clientsSvc.assignDirecteur(client.id, id).subscribe(updated => {
      client.directeur = updated.directeur;
      this.toast.success(id ? 'Directeur assigné' : 'Directeur retiré');
    });
  }

  onCollabChange(client: Client, value: string) {
    const id = value ? +value : null;
    this.clientsSvc.assignMg(client.id, id).subscribe(updated => {
      client.collaborateurMg = updated.collaborateurMg;
      this.toast.success(id ? 'Collaborateur assigné' : 'Collaborateur retiré');
    });
  }
}
