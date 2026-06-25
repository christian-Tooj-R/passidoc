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

  <div class="page-header">
    <h2>Collaborateurs</h2>
    <span class="count">{{ stats().actifs }} actif(s) · {{ stats().total }} au total</span>
  </div>

  <div class="toolbar">
    <input class="search" type="text" placeholder="Rechercher..."
           [value]="search()" (input)="search.set($any($event.target).value)" />
    <select class="filter-select" [value]="siteFiltre()" (change)="siteFiltre.set($any($event.target).value)">
      <option value="">Tous les sites</option>
      <option value="REUNION">La Réunion</option>
      <option value="MADAGASCAR">Madagascar</option>
    </select>
    <select class="filter-select" [value]="statutFiltre()" (change)="statutFiltre.set($any($event.target).value)">
      <option value="">Tous statuts</option>
      <option value="actif">Actifs</option>
      <option value="ancien">Anciens</option>
    </select>
  </div>

  <app-data-table
    [columns]="colonnes"
    [data]="listeFiltree()"
    [loading]="loading()"
    [pageSize]="20"
    [rowClass]="rowClass"
    (rowClick)="router.navigate(['/salaries',$event.id])">

    <ng-template appCol="site" let-c>
      {{ c.site === 'REUNION' ? 'La Réunion' : 'Madagascar' }}
    </ng-template>

    <ng-template appCol="dateEntree" let-c>
      {{ (c.dateEntree | date:'dd/MM/yyyy') || '—' }}
    </ng-template>

    <ng-template appCol="role" let-c>
      <span class="role-badge role-badge--{{ c.role.toLowerCase() }}">{{ roleLabel(c.role) }}</span>
    </ng-template>

    <ng-template appCol="actions" let-c>
      <button mat-icon-button [matMenuTriggerFor]="menu" (click)="$event.stopPropagation()">
        <mat-icon>more_vert</mat-icon>
      </button>
      <mat-menu #menu="matMenu">
        <button mat-menu-item (click)="router.navigate(['/rh/salaries',c.id])">
          <mat-icon>visibility</mat-icon><span>Voir la fiche</span>
        </button>
        <button mat-menu-item (click)="openForm(c)">
          <mat-icon>edit</mat-icon><span>Modifier</span>
        </button>
        @if (!c.dateSortie) {
          <button mat-menu-item (click)="archiver(c)">
            <mat-icon>person_off</mat-icon><span>Marquer comme ancien</span>
          </button>
        } @else {
          <button mat-menu-item (click)="reactiver(c)">
            <mat-icon>person</mat-icon><span>Réactiver</span>
          </button>
        }
      </mat-menu>
    </ng-template>

  </app-data-table>
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
      <label>Site</label>
      <mat-form-field appearance="outline" class="w100">
        <mat-select formControlName="site">
          <mat-option value="REUNION">La Réunion</mat-option>
          <mat-option value="MADAGASCAR">Madagascar</mat-option>
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
    .page { padding: 24px; }
    .page-header { display: flex; align-items: baseline; gap: 16px; margin-bottom: 16px;
      h2 { margin: 0; font-size: 1.1rem; font-weight: 600; color: #111; }
      .count { font-size: 13px; color: #666; }
    }
    .toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
    .search {
      border: 1px solid #ccc; border-radius: 4px; padding: 6px 10px;
      font-size: 13px; outline: none; width: 240px;
      &:focus { border-color: #162351; }
    }
    .filter-select {
      border: 1px solid #ccc; border-radius: 4px; padding: 6px 8px;
      font-size: 13px; background: #fff; outline: none; cursor: pointer;
    }
    .role-badge {
      display: inline-block; font-size: 11px; font-weight: 600;
      padding: 2px 8px; border-radius: 4px;
    }
    .role-badge--admin            { background: #fde8e8; color: #991b1b; }
    .role-badge--expert_comptable { background: #dbeafe; color: #1e40af; }
    .role-badge--collaborateur    { background: #e4e8f4; color: #4b5a7a; }
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 999; }
    .drawer {
      position: fixed; right: 0; top: 0; bottom: 0; width: 400px;
      background: #fff; box-shadow: -2px 0 12px rgba(0,0,0,.15);
      z-index: 1000; display: flex; flex-direction: column;
    }
    .drawer-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; border-bottom: 1px solid #ddd;
      font-size: 14px; font-weight: 600; color: #111;
    }
    .drawer-body {
      padding: 16px; display: flex; flex-direction: column; gap: 2px;
      flex: 1; overflow-y: auto;
      label { font-size: 12px; font-weight: 600; color: #555; margin-bottom: 2px; display: block; }
    }
    .w100 { width: 100%; }
    .drawer-footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 12px; border-top: 1px solid #eee; margin-top: 8px; }
  `],
})
export class SalariesComponent implements OnInit {
  private svc   = inject(SalariesService);
  private snack = inject(MatSnackBar);
  private fb    = inject(FormBuilder);
  router        = inject(Router);

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
    { key: 'site',       label: 'Site'          },
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

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      ADMIN: 'Admin', EXPERT_COMPTABLE: 'Expert-comptable', COLLABORATEUR: 'Collaborateur',
    };
    return map[role] ?? role;
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
