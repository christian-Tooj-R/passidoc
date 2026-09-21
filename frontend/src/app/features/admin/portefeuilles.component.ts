import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
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
    MatTooltipModule, MatFormFieldModule, MatAutocompleteModule,
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
    <button class="filter-chip" [class.active]="siteFilter === 'EST'" (click)="siteFilter = 'EST'">
      {{ tenantSvc.poleFlag1() }} {{ tenantSvc.poleLabel1() }} ({{ countSite('EST') }})
    </button>
    <button class="filter-chip" [class.active]="siteFilter === 'OUEST'" (click)="siteFilter = 'OUEST'">
      {{ tenantSvc.poleFlag2() }} {{ tenantSvc.poleLabel2() }} ({{ countSite('OUEST') }})
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
          <th class="th-collab">Collaborateur {{ tenantSvc.poleLabel1() }}</th>
          <th class="th-collab">Collaborateur {{ tenantSvc.poleLabel2() }}</th>
          <th class="th-action"></th>
        </tr>
      </thead>
      <tbody>
        @for (c of filteredClients; track c.id) {
          <tr class="aff-row">
            <!-- Nom dossier -->
            <td class="td-nom">
              <div class="client-cell">
                <div class="client-avatar" [class.ca--re]="c.site === 'EST'" [class.ca--mg]="c.site !== 'EST'">
                  {{ c.nom[0] }}
                </div>
                <span class="client-name">{{ c.nom }}</span>
              </div>
            </td>

            <!-- Pôle -->
            <td class="td-pole">
              <span class="pole-chip" [class.pole-chip--re]="c.site === 'EST'" [class.pole-chip--mg]="c.site !== 'EST'">
                {{ c.site === 'EST' ? tenantSvc.poleFlag1() : tenantSvc.poleFlag2() }}
                {{ c.site === 'EST' ? tenantSvc.poleLabel1() : tenantSvc.poleLabel2() }}
              </span>
            </td>

            <!-- Directeur -->
            <td class="td-directeur">
              <div class="assign-cell" [class.assign-cell--empty]="!c.directeur">
                <mat-icon class="assign-icon">manage_accounts</mat-icon>
                <input class="assign-select" [(ngModel)]="directeurSearchMap[c.id]" name="direSearch{{c.id}}"
                       [matAutocomplete]="dirAuto" placeholder="— Non assigné —"
                       (blur)="onDirecteurBlur(c)" autocomplete="off" />
                <mat-autocomplete #dirAuto="matAutocomplete" [displayWith]="userDisplayWith" (optionSelected)="onDirecteurSelected($event, c)">
                  <mat-option [value]="null">— Non assigné —</mat-option>
                  @for (u of filteredDirecteurUsers(c); track u.id) {
                    <mat-option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</mat-option>
                  }
                </mat-autocomplete>
              </div>
            </td>

            <!-- Collaborateur pôle EST -->
            <td class="td-collab">
              <div class="assign-cell" [class.assign-cell--empty]="!c.responsable">
                <mat-icon class="assign-icon">person</mat-icon>
                <input class="assign-select" [(ngModel)]="responsableSearchMap[c.id]" name="respSearch{{c.id}}"
                       [matAutocomplete]="respAuto" placeholder="— Non assigné —"
                       (blur)="onResponsableBlur(c)" autocomplete="off" />
                <mat-autocomplete #respAuto="matAutocomplete" [displayWith]="userDisplayWith" (optionSelected)="onResponsableSelected($event, c)">
                  <mat-option [value]="null">— Non assigné —</mat-option>
                  @for (u of filteredResponsableUsers(c); track u.id) {
                    <mat-option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</mat-option>
                  }
                </mat-autocomplete>
              </div>
            </td>

            <!-- Collaborateur pôle OUEST -->
            <td class="td-collab">
              <div class="assign-cell" [class.assign-cell--empty]="!c.collaborateurOuest">
                <mat-icon class="assign-icon">person</mat-icon>
                <input class="assign-select" [(ngModel)]="collabSearchMap[c.id]" name="collabSearch{{c.id}}"
                       [matAutocomplete]="collabAuto" placeholder="— Non assigné —"
                       (blur)="onCollabBlur(c)" autocomplete="off" />
                <mat-autocomplete #collabAuto="matAutocomplete" [displayWith]="userDisplayWith" (optionSelected)="onCollabSelected($event, c)">
                  <mat-option [value]="null">— Non assigné —</mat-option>
                  @for (u of filteredCollabUsers(c); track u.id) {
                    <mat-option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</mat-option>
                  }
                </mat-autocomplete>
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
            <td colspan="6" class="td-empty">
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

  directeurSearchMap: Record<number, string>   = {};
  responsableSearchMap: Record<number, string> = {};
  collabSearchMap: Record<number, string>      = {};

  get noDirecteurCount(): number {
    return this.allClients.filter(c => !c.directeur).length;
  }

  get noCollabCount(): number {
    return this.allClients.filter(c => c.site === 'EST' ? !c.responsable : !c.collaborateurOuest).length;
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
    // Charger les deux en même temps : si les dossiers s'affichent avant que
    // la liste des utilisateurs assignables soit prête, les <select> natifs
    // se retrouvent sans <option> correspondante au moment où Angular fixe
    // leur valeur, et restent bloqués sur "Non assigné" même après coup.
    forkJoin({
      clients: this.clientsSvc.getAll(),
      users: this.usersSvc.getAssignable(),
    }).subscribe(({ clients, users }) => {
      this.assignableUsers = users;
      this.allClients = clients;
      this.syncAllRowSearch();
    });
  }

  private userLabel(u: { firstName: string; lastName: string }): string {
    return `${u.firstName} ${u.lastName}`;
  }

  /**
   * [displayWith] des 3 <mat-autocomplete> par ligne : sans cette fonction,
   * Angular Material écrit l'id brut (u.id) directement dans le champ au clic
   * sur une option, avant que notre resync (onXSelected) ne corrige
   * l'affichage — correctif qu'Angular peut ignorer silencieusement si la
   * valeur finale est identique à celle déjà liée (ex. re-cliquer
   * l'intervenant déjà assigné sur cette ligne).
   */
  userDisplayWith = (value: number | string | null): string => {
    if (value == null) return '';
    if (typeof value === 'number') {
      const u = this.assignableUsers.find(x => x.id === value);
      return u ? this.userLabel(u) : '';
    }
    return value;
  };

  private sortedAssignableUsers(): User[] {
    return [...this.assignableUsers].sort((a, b) => this.userLabel(a).localeCompare(this.userLabel(b), 'fr', { sensitivity: 'base' }));
  }

  private filterAssignableUsers(term: string): User[] {
    const sorted = this.sortedAssignableUsers();
    const t = term.trim().toLowerCase();
    if (!t) return sorted;
    return sorted.filter(u => this.userLabel(u).toLowerCase().includes(t));
  }

  filteredDirecteurUsers(c: Client): User[] {
    return this.filterAssignableUsers(this.directeurSearchMap[c.id] ?? '');
  }

  filteredResponsableUsers(c: Client): User[] {
    return this.filterAssignableUsers(this.responsableSearchMap[c.id] ?? '');
  }

  filteredCollabUsers(c: Client): User[] {
    return this.filterAssignableUsers(this.collabSearchMap[c.id] ?? '');
  }

  /** (Re)initialise les 3 champs de recherche de chaque ligne à partir des intervenants déjà assignés. */
  private syncAllRowSearch() {
    for (const c of this.allClients) {
      this.directeurSearchMap[c.id]   = c.directeur ? this.userLabel(c.directeur) : '';
      this.responsableSearchMap[c.id] = c.responsable ? this.userLabel(c.responsable) : '';
      this.collabSearchMap[c.id]      = c.collaborateurOuest ? this.userLabel(c.collaborateurOuest) : '';
    }
  }

  onDirecteurSelected(event: MatAutocompleteSelectedEvent, c: Client) {
    const id = event.option.value as number | null;
    const u = id != null ? this.assignableUsers.find(x => x.id === id) : undefined;
    this.directeurSearchMap[c.id] = u ? this.userLabel(u) : '';
    this.onDirecteurChange(c, id != null ? String(id) : '');
  }

  onDirecteurBlur(c: Client) {
    // Délai volontaire : un clic sur une option déclenche aussi le blur de
    // l'input, et s'il se réconcilie immédiatement, il écrase la sélection
    // en cours avant que (optionSelected) n'ait eu le temps de s'appliquer.
    setTimeout(() => {
      this.directeurSearchMap[c.id] = c.directeur ? this.userLabel(c.directeur) : '';
    }, 200);
  }

  onResponsableSelected(event: MatAutocompleteSelectedEvent, c: Client) {
    const id = event.option.value as number | null;
    const u = id != null ? this.assignableUsers.find(x => x.id === id) : undefined;
    this.responsableSearchMap[c.id] = u ? this.userLabel(u) : '';
    this.onResponsableChange(c, id != null ? String(id) : '');
  }

  onResponsableBlur(c: Client) {
    setTimeout(() => {
      this.responsableSearchMap[c.id] = c.responsable ? this.userLabel(c.responsable) : '';
    }, 200);
  }

  onCollabSelected(event: MatAutocompleteSelectedEvent, c: Client) {
    const id = event.option.value as number | null;
    const u = id != null ? this.assignableUsers.find(x => x.id === id) : undefined;
    this.collabSearchMap[c.id] = u ? this.userLabel(u) : '';
    this.onCollabChange(c, id != null ? String(id) : '');
  }

  onCollabBlur(c: Client) {
    setTimeout(() => {
      this.collabSearchMap[c.id] = c.collaborateurOuest ? this.userLabel(c.collaborateurOuest) : '';
    }, 200);
  }

  onDirecteurChange(client: Client, value: string) {
    const id = value ? +value : null;
    this.clientsSvc.assignDirecteur(client.id, id).subscribe(updated => {
      client.directeur = updated.directeur;
      this.directeurSearchMap[client.id] = client.directeur ? this.userLabel(client.directeur) : '';
      this.toast.success(id ? 'Directeur assigné' : 'Directeur retiré');
    });
  }

  onResponsableChange(client: Client, value: string) {
    const id = value ? +value : null;
    this.clientsSvc.assign(client.id, id).subscribe(updated => {
      client.responsable = updated.responsable;
      this.responsableSearchMap[client.id] = client.responsable ? this.userLabel(client.responsable) : '';
      this.toast.success(id ? 'Collaborateur assigné' : 'Collaborateur retiré');
    });
  }

  onCollabChange(client: Client, value: string) {
    const id = value ? +value : null;
    this.clientsSvc.assignOuest(client.id, id).subscribe(updated => {
      client.collaborateurOuest = updated.collaborateurOuest;
      this.collabSearchMap[client.id] = client.collaborateurOuest ? this.userLabel(client.collaborateurOuest) : '';
      this.toast.success(id ? 'Collaborateur assigné' : 'Collaborateur retiré');
    });
  }
}
