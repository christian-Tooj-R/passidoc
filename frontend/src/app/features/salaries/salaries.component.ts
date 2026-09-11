import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterModule } from '@angular/router';
import { DataTableComponent, ColDirective, ColumnDef } from '../../shared/data-table/data-table.component';
import { SalariesService, Collaborateur, UpdateRHDto } from './salaries.service';
import { TenantService } from '../../core/services/tenant.service';
import { AuthService } from '../../core/services/auth.service';
import { ROLE_LABELS } from '../../core/models/user.model';
const TYPES_CONTRAT = ['CDI', 'CDD', 'Apprentissage', 'Stage', 'Intérimaire', 'Freelance', 'Autre'];

@Component({
  selector: 'app-salaries',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatSnackBarModule,
    MatMenuModule, RouterModule,
    DataTableComponent, ColDirective,
  ],
  template: `
<div class="page">

  <div class="rhx-page-head">
    <div class="rhx-page-head__main">
      <div class="rhx-page-head__icon"><mat-icon>badge</mat-icon></div>
      <div>
        <h1>Salariés</h1>
        <p class="rhx-page-head__sub">{{ stats().actifs }} actif{{ stats().actifs > 1 ? 's' : '' }} · {{ stats().total }} au total</p>
      </div>
    </div>
    <div class="rhx-page-head__actions toolbar">
      <div class="search-wrap">
        <svg class="search-icon" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5" stroke="currentColor" stroke-width="1.5"/><path d="M13 13l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <input class="search" type="text" placeholder="Nom, poste, email…"
               [value]="search()" (input)="search.set($any($event.target).value)" />
      </div>
      <select class="filter-select" [value]="siteFiltre()" (change)="siteFiltre.set($any($event.target).value)">
        <option value="">Tous les pôles</option>
        <option value="REUNION">{{ tenantSvc.poleLabel1() }}</option>
        <option value="MADAGASCAR">{{ tenantSvc.poleLabel2() }}</option>
      </select>
      <select class="filter-select" [value]="statutFiltre()" (change)="statutFiltre.set($any($event.target).value)">
        <option value="">Tous statuts</option>
        <option value="actif">Actifs</option>
        <option value="ancien">Anciens</option>
      </select>
    </div>
  </div>

  <div class="rhx-kpis">
    <div class="rhx-kpi">
      <div class="rhx-kpi__icon"><mat-icon>groups</mat-icon></div>
      <div class="rhx-kpi__body">
        <div class="rhx-kpi__label">Effectif actif</div>
        <div class="rhx-kpi__value">{{ kpis().actifs }}<small>/ {{ stats().total }}</small></div>
        <div class="rhx-kpi__sub">{{ kpis().anciens }} ancien{{ kpis().anciens > 1 ? 's' : '' }}</div>
      </div>
    </div>
    <div class="rhx-kpi rhx-kpi--teal">
      <div class="rhx-kpi__icon"><mat-icon>work</mat-icon></div>
      <div class="rhx-kpi__body">
        <div class="rhx-kpi__label">CDI</div>
        <div class="rhx-kpi__value">{{ kpis().cdi }}<small>/ {{ kpis().actifs }}</small></div>
        <div class="rhx-kpi__sub">{{ kpis().contratRenseigne }} contrat{{ kpis().contratRenseigne > 1 ? 's' : '' }} renseigné{{ kpis().contratRenseigne > 1 ? 's' : '' }}</div>
      </div>
    </div>
    <div class="rhx-kpi rhx-kpi--blue">
      <div class="rhx-kpi__icon"><mat-icon>place</mat-icon></div>
      <div class="rhx-kpi__body">
        <div class="rhx-kpi__label">Par pôle</div>
        <div class="rhx-kpi__value">{{ kpis().pole1 }}<small>{{ tenantSvc.poleLabel1() }}</small></div>
        <div class="rhx-kpi__sub">{{ kpis().pole2 }} · {{ tenantSvc.poleLabel2() }}</div>
      </div>
    </div>
    <div class="rhx-kpi rhx-kpi--amber">
      <div class="rhx-kpi__icon"><mat-icon>person_add</mat-icon></div>
      <div class="rhx-kpi__body">
        <div class="rhx-kpi__label">Entrées sur 12 mois</div>
        <div class="rhx-kpi__value">{{ kpis().entrees12 }}</div>
        <div class="rhx-kpi__sub">{{ kpis().dateEntreeRenseignee }} date{{ kpis().dateEntreeRenseignee > 1 ? 's' : '' }} d'entrée renseignée{{ kpis().dateEntreeRenseignee > 1 ? 's' : '' }}</div>
      </div>
    </div>
  </div>

  <div class="table-wrap">
  <app-data-table
    [columns]="colonnes"
    [data]="listeFiltree()"
    [loading]="loading()"
    [pageSize]="20"
    [rowClass]="rowClass"
    (rowClick)="router.navigate(['/rh/salaries',$event.id])">

    <ng-template appCol="nom" let-c>
      <div class="rhx-person">
        <span class="rhx-avatar rhx-avatar--sm" [class]="'rhx-avatar rhx-avatar--sm ' + avatarClasse(c)">{{ initiales(c) }}</span>
        <div>
          <div class="rhx-person__name">{{ c.lastName }} {{ c.firstName }}</div>
          @if (c.poste) { <div class="rhx-person__meta">{{ c.poste }}</div> }
        </div>
      </div>
    </ng-template>

    <ng-template appCol="site" let-c>
      <span class="rhx-chip rhx-chip--nodot" [class]="'rhx-chip rhx-chip--nodot ' + (c.site === 'REUNION' ? 'rhx-chip--violet' : 'rhx-chip--blue')">
        {{ tenantSvc.poleFlag(c.site) }} {{ tenantSvc.poleLabel(c.site) }}
      </span>
    </ng-template>

    <ng-template appCol="typeContrat" let-c>
      @if (c.typeContrat) { <span class="rhx-chip rhx-chip--muted rhx-chip--nodot">{{ c.typeContrat }}</span> } @else { <span class="muted">—</span> }
    </ng-template>

    <ng-template appCol="dateEntree" let-c>
      {{ (c.dateEntree | date:'dd/MM/yyyy') || '—' }}
    </ng-template>

    <ng-template appCol="role" let-c>
      <span class="rhx-chip" [class]="'rhx-chip ' + roleChipClasse(c.role)">{{ roleLabel(c.role) }}</span>
    </ng-template>

    <ng-template appCol="actions" let-c>
      <button mat-icon-button [matMenuTriggerFor]="menu" (click)="$event.stopPropagation()">
        <mat-icon>more_vert</mat-icon>
      </button>
      <mat-menu #menu="matMenu">
        <button mat-menu-item (click)="router.navigate(['/rh/salaries',c.id])">
          <mat-icon>visibility</mat-icon><span>Voir la fiche</span>
        </button>
        @if (canEdit(c)) {
          <button mat-menu-item (click)="openForm(c)">
            <mat-icon>edit</mat-icon><span>Modifier</span>
          </button>
        }
        @if (canEdit(c) && !c.dateSortie) {
          <button mat-menu-item (click)="archiver(c)">
            <mat-icon>person_off</mat-icon><span>Marquer comme ancien</span>
          </button>
        } @else if (canEdit(c) && c.dateSortie) {
          <button mat-menu-item (click)="reactiver(c)">
            <mat-icon>person</mat-icon><span>Réactiver</span>
          </button>
        }
      </mat-menu>
    </ng-template>

  </app-data-table>
  </div>
</div>

@if (formVisible()) {
  <div class="overlay" (click)="closeForm()"></div>
  <div class="drawer">
    <div class="drawer-header">
      <span>Modifier — {{ selected()?.lastName }} {{ selected()?.firstName }}</span>
      <button mat-icon-button (click)="closeForm()"><mat-icon>close</mat-icon></button>
    </div>
    <form [formGroup]="form" (ngSubmit)="save()" class="drawer-body">
      <label>Prénom</label>
      <mat-form-field appearance="outline" class="w100">
        <input matInput formControlName="firstName" />
      </mat-form-field>
      <label>Nom</label>
      <mat-form-field appearance="outline" class="w100">
        <input matInput formControlName="lastName" />
      </mat-form-field>
      <label>Pôle</label>
      <mat-form-field appearance="outline" class="w100">
        <mat-select formControlName="site">
          <mat-option value="REUNION">{{ tenantSvc.poleLabel1() }}</mat-option>
          <mat-option value="MADAGASCAR">{{ tenantSvc.poleLabel2() }}</mat-option>
        </mat-select>
      </mat-form-field>
      <label>Poste</label>
      <mat-form-field appearance="outline" class="w100">
        <input matInput formControlName="poste" />
      </mat-form-field>
      <label>Type de contrat</label>
      <mat-form-field appearance="outline" class="w100">
        <mat-select formControlName="typeContrat">
          <mat-option [value]="null">—</mat-option>
          @for (t of typesContrat; track t) { <mat-option [value]="t">{{ t }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <label>Date d'entrée</label>
      <mat-form-field appearance="outline" class="w100">
        <input matInput type="date" formControlName="dateEntree" />
      </mat-form-field>
      <label>Date de sortie</label>
      <mat-form-field appearance="outline" class="w100">
        <input matInput type="date" formControlName="dateSortie" />
      </mat-form-field>
      <label>Téléphone</label>
      <mat-form-field appearance="outline" class="w100">
        <input matInput formControlName="telephone" />
      </mat-form-field>
      <div class="drawer-footer">
        <button mat-button type="button" (click)="closeForm()">Annuler</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="saving()">
          {{ saving() ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </div>
    </form>
  </div>
}
  `,
  styles: [`
    .page { padding: 24px 28px 48px; max-width: 1680px; margin: 0 auto; }


    /* ── Barre de filtre ── */
    .toolbar {
      display: flex; gap: 8px; align-items: center;
      padding: 0; margin: 0; flex-wrap: wrap;
    }
    .search-wrap {
      position: relative; display: flex; align-items: center;
    }
    .search-icon {
      position: absolute; left: 9px;
      width: 15px; height: 15px; color: #9CA3AF; pointer-events: none;
    }
    .search {
      border: 1px solid #E5E7EB; border-radius: 6px;
      padding: 7px 10px 7px 30px;
      font-size: 13px; outline: none; width: 220px; background: #fff;
      color: #111827;
      transition: border-color .15s, box-shadow .15s;
      &:focus { border-color: #7c3aed; box-shadow: 0 0 0 3px rgba(124,58,237,.1); }
      &::placeholder { color: #9CA3AF; }
    }
    .filter-select {
      border: 1px solid #E5E7EB; border-radius: 6px;
      padding: 7px 10px; font-size: 13px;
      background: #fff; color: #374151;
      outline: none; cursor: pointer;
      transition: border-color .15s;
      &:focus { border-color: #7c3aed; }
    }

    /* ── Zone table ── */
    .table-wrap { padding: 0; }

    /* ── Badges rôle ── */

    /* ── Drawer ── */
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.3); z-index: 999; }
    .drawer {
      position: fixed; right: 0; top: 0; bottom: 0; width: 400px;
      background: #fff; box-shadow: -4px 0 24px rgba(0,0,0,.12);
      z-index: 1000; display: flex; flex-direction: column;
    }
    .drawer-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 18px; border-bottom: 1px solid #F0F2F7;
      font-size: 14px; font-weight: 600; color: #111827;
    }
    .drawer-body {
      padding: 18px; display: flex; flex-direction: column; gap: 2px;
      flex: 1; overflow-y: auto;
      label { font-size: 11.5px; font-weight: 600; color: #6B7280;
              text-transform: uppercase; letter-spacing: .04em;
              margin-bottom: 2px; display: block; }
    }
    .w100 { width: 100%; }
    .drawer-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 12px 18px; border-top: 1px solid #F0F2F7;
    }
  `],
})
export class SalariesComponent implements OnInit {
  private svc   = inject(SalariesService);
  private snack = inject(MatSnackBar);
  private fb    = inject(FormBuilder);
  private auth  = inject(AuthService);
  router        = inject(Router);

  tenantSvc   = inject(TenantService);
  liste       = signal<Collaborateur[]>([]);
  loading     = signal(true);
  formVisible = signal(false);
  saving      = signal(false);
  selected    = signal<Collaborateur | null>(null);
  search       = signal('');
  siteFiltre   = signal('');
  statutFiltre = signal('');

  readonly typesContrat = TYPES_CONTRAT;
  readonly colonnes: ColumnDef[] = [
    { key: 'nom',        label: 'Nom Prénom'    },
    { key: 'email',      label: 'Email'         },
    { key: 'poste',      label: 'Poste'         },
    { key: 'site',       label: 'Pôle'          },
    { key: 'typeContrat',label: 'Contrat'       },
    { key: 'role',       label: 'Rôle'          },
    { key: 'dateEntree', label: "Date d'entrée" },
    { key: 'actions',    label: ''              },
  ];

  rowClass = (c: Collaborateur) => c.dateSortie ? 'row--ancien' : '';

  form = this.fb.group({
    firstName: [''], lastName: [''], site: ['REUNION'],
    poste: [null as string | null], typeContrat: [null as string | null],
    dateEntree: [null as string | null], dateSortie: [null as string | null],
    telephone: [null as string | null],
  });

  stats = computed(() => ({
    total:  this.liste().length,
    actifs: this.liste().filter(c => !c.dateSortie).length,
  }));

  /** Indicateurs de l'en-tête — uniquement dérivés des données réellement renseignées. */
  kpis = computed(() => {
    const tous = this.liste();
    const actifs = tous.filter(c => !c.dateSortie);
    const ilYA12Mois = new Date(); ilYA12Mois.setFullYear(ilYA12Mois.getFullYear() - 1);
    return {
      actifs: actifs.length,
      anciens: tous.length - actifs.length,
      cdi: actifs.filter(c => c.typeContrat === 'CDI').length,
      contratRenseigne: actifs.filter(c => !!c.typeContrat).length,
      pole1: actifs.filter(c => c.site === 'REUNION').length,
      pole2: actifs.filter(c => c.site === 'MADAGASCAR').length,
      entrees12: tous.filter(c => c.dateEntree && new Date(c.dateEntree) >= ilYA12Mois).length,
      dateEntreeRenseignee: tous.filter(c => !!c.dateEntree).length,
    };
  });

  initiales(c: Collaborateur): string {
    return `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase();
  }

  avatarClasse(c: Collaborateur): string {
    return `rhx-avatar--h${c.id % 6}`;
  }

  roleChipClasse(role: string): string {
    switch (role) {
      case 'ADMIN': return 'rhx-chip--rose';
      case 'EXPERT_COMPTABLE': return 'rhx-chip--blue';
      case 'CHEF_ANTENNE': return 'rhx-chip--violet';
      case 'CHEF_MISSION': return 'rhx-chip--teal';
      default: return 'rhx-chip--muted';
    }
  }

  listeFiltree = computed(() => {
    const q    = this.search().toLowerCase().trim();
    const site = this.siteFiltre();
    const stat = this.statutFiltre();
    return this.liste()
      .filter(c => {
        if (site && c.site !== site)            return false;
        if (stat === 'actif'  &&  c.dateSortie) return false;
        if (stat === 'ancien' && !c.dateSortie) return false;
        if (!q) return true;
        return `${c.lastName} ${c.firstName} ${c.poste ?? ''} ${c.email}`.toLowerCase().includes(q);
      })
      .map(c => ({ ...c, nom: `${c.lastName} ${c.firstName}` }));
  });

  ngOnInit() { this.load(); }

  private load() {
    this.loading.set(true);
    this.svc.list().subscribe({
      next:  data => { this.liste.set(data); this.loading.set(false); },
      error: ()   => this.loading.set(false),
    });
  }

  canEdit(c: Collaborateur): boolean {
    if (this.auth.isAdmin() || this.auth.isExpert() || this.auth.isChefAntenne() || this.auth.isChefMission()) return true;
    return this.auth.currentUser()?.id === c.id;
  }

  roleLabel(role: string): string {
    return (ROLE_LABELS as Record<string, string>)[role] ?? role;
  }

  openForm(c: Collaborateur) {
    this.selected.set(c);
    this.form.patchValue({
      firstName: c.firstName, lastName: c.lastName, site: c.site,
      poste: c.poste, typeContrat: c.typeContrat, dateEntree: c.dateEntree,
      dateSortie: c.dateSortie, telephone: c.telephone,
    });
    this.formVisible.set(true);
  }

  closeForm() { this.formVisible.set(false); }

  save() {
    const c = this.selected(); if (!c) return;
    const raw = this.form.getRawValue();
    const dto: UpdateRHDto = {
      firstName: raw.firstName || undefined, lastName: raw.lastName || undefined,
      site: raw.site as any || undefined, poste: raw.poste ?? null,
      typeContrat: raw.typeContrat ?? null, dateEntree: raw.dateEntree ?? null,
      dateSortie: raw.dateSortie ?? null, telephone: raw.telephone ?? null,
    };
    this.saving.set(true);
    this.svc.updateRH(c.id, dto).subscribe({
      next: updated => {
        this.liste.update(l => l.map(x => x.id === updated.id ? updated : x));
        this.saving.set(false);
        this.closeForm();
        this.snack.open('Fiche mise à jour', undefined, { duration: 2500 });
      },
      error: () => this.saving.set(false),
    });
  }

  archiver(c: Collaborateur) {
    const today = new Date().toISOString().split('T')[0];
    this.svc.updateRH(c.id, { dateSortie: today }).subscribe(updated => {
      this.liste.update(l => l.map(x => x.id === updated.id ? updated : x));
      this.snack.open(`${c.firstName} ${c.lastName} marqué comme ancien`, undefined, { duration: 3000 });
    });
  }

  reactiver(c: Collaborateur) {
    this.svc.updateRH(c.id, { dateSortie: null }).subscribe(updated => {
      this.liste.update(l => l.map(x => x.id === updated.id ? updated : x));
      this.snack.open(`${c.firstName} ${c.lastName} réactivé`, undefined, { duration: 3000 });
    });
  }
}
