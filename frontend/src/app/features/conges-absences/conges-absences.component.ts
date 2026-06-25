import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import {
  CongesAbsencesService, CongeAbsence, CongeStats,
  TypeConge, TYPE_CONGE_LABELS, TYPE_CONGE_COLORS,
} from '../../core/services/conges-absences.service';
import { SalariesService, Collaborateur } from '../salaries/salaries.service';

const TYPES: { value: TypeConge; label: string }[] = Object.entries(TYPE_CONGE_LABELS).map(([v, l]) => ({ value: v as TypeConge, label: l }));
type ViewMode = 'demandes' | 'soldes' | 'stats';
type SoldeRow = { userId: number; name: string; initials: string; soldes: Record<string, number> };

@Component({
  selector: 'app-conges-absences',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule, RouterModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatSnackBarModule,
    MatTooltipModule,
  ],
  template: `
<div class="page">

  <!-- En-tête -->
  <div class="page-header">
    <div class="page-title">
      <mat-icon>beach_access</mat-icon>
      <div>
        <h2>Congés & Absences</h2>
        <span class="subtitle">Gestion des demandes et soldes de l'équipe</span>
      </div>
    </div>
    <div class="header-actions">
      <div class="year-selector">
        <button mat-icon-button (click)="changeAnnee(-1)"><mat-icon>chevron_left</mat-icon></button>
        <span class="year-label">{{ annee() }}</span>
        <button mat-icon-button (click)="changeAnnee(1)"><mat-icon>chevron_right</mat-icon></button>
      </div>
      <button mat-flat-button class="btn-new" (click)="showNewForm.set(!showNewForm())">
        <mat-icon>add</mat-icon> Nouvelle demande
      </button>
    </div>
  </div>

  <!-- Stats rapides -->
  @if (stats()) {
    <div class="stats-bar">
      <div class="stat-chip stat-chip--orange">
        <mat-icon>hourglass_empty</mat-icon>
        <span>{{ stats()!.enAttente }}</span>
        <span class="stat-label">en attente</span>
      </div>
      <div class="stat-chip stat-chip--green">
        <mat-icon>check_circle</mat-icon>
        <span>{{ stats()!.totalApprouves }}</span>
        <span class="stat-label">approuvées {{ annee() }}</span>
      </div>
      @for (t of topTypes(); track t.type) {
        <div class="stat-chip">
          <span class="stat-dot" [style.background]="typeColor(t.type)"></span>
          <span class="stat-label">{{ typeLabel(t.type) }}</span>
          <span class="stat-val">{{ t.jours }}j</span>
        </div>
      }
    </div>
  }

  <!-- Onglets vue -->
  <div class="view-tabs">
    <button class="view-tab" [class.active]="view()==='demandes'" (click)="view.set('demandes')">
      <mat-icon>list_alt</mat-icon> Demandes
    </button>
    <button class="view-tab" [class.active]="view()==='soldes'" (click)="view.set('soldes')">
      <mat-icon>account_balance_wallet</mat-icon> Soldes
    </button>
  </div>

  <!-- Filtres -->
  <div class="filters">
    <input class="search" type="text" placeholder="Rechercher un collaborateur..."
           [value]="search()" (input)="search.set($any($event.target).value)" />
    @if (view() === 'demandes') {
      <select class="filter-select" [value]="statutFiltre()" (change)="statutFiltre.set($any($event.target).value)">
        <option value="">Tous les statuts</option>
        <option value="EN_ATTENTE">En attente</option>
        <option value="APPROUVEE">Approuvées</option>
        <option value="REFUSEE">Refusées</option>
        <option value="ANNULEE">Annulées</option>
      </select>
      <select class="filter-select" [value]="typeFiltre()" (change)="typeFiltre.set($any($event.target).value)">
        <option value="">Tous les types</option>
        @for (t of types; track t.value) { <option [value]="t.value">{{ t.label }}</option> }
      </select>
    }
    <select class="filter-select" [value]="siteFiltre()" (change)="siteFiltre.set($any($event.target).value)">
      <option value="">Tous les sites</option>
      <option value="REUNION">La Réunion</option>
      <option value="MADAGASCAR">Madagascar</option>
    </select>
  </div>

  <!-- ═══ VUE DEMANDES ═══ -->
  @if (view() === 'demandes') {
    @if (loading()) {
      <div class="loading-row"><div class="spinner"></div><span>Chargement...</span></div>
    } @else if (demandesFiltrees().length === 0) {
      <div class="empty-row"><mat-icon>event_busy</mat-icon><span>Aucune demande</span></div>
    } @else {
      <div class="demandes-table">
        <div class="table-head">
          <span>Collaborateur</span><span>Type</span><span>Dates</span>
          <span>Jours</span><span>Motif</span><span>Statut</span><span>Actions</span>
        </div>
        @for (d of demandesFiltrees(); track d.id) {
          <div class="table-row">
            <span class="col-collab">
              <a [routerLink]="['/rh/salaries',d.userId]" class="collab-link">
                <span class="avatar-mini">{{ initials(d) }}</span>
                {{ d.user?.firstName }} {{ d.user?.lastName }}
              </a>
            </span>
            <span>
              <span class="type-badge" [style.background]="typeColor(d.typeConge)+'18'" [style.color]="typeColor(d.typeConge)">
                {{ typeLabel(d.typeConge) }}
              </span>
            </span>
            <span class="col-dates">
              {{ d.dateDebut | date:'dd/MM' }} → {{ d.dateFin | date:'dd/MM/yy' }}
            </span>
            <span class="col-jours"><strong>{{ d.nombreJours }}j</strong></span>
            <span class="col-motif">{{ d.motif || '—' }}</span>
            <span>
              <span class="statut-badge statut-badge--{{ d.statut.toLowerCase() }}">{{ statutLabel(d.statut) }}</span>
            </span>
            <span class="col-actions">
              @if (d.statut === 'EN_ATTENTE') {
                <button mat-icon-button class="btn-approve" matTooltip="Approuver" (click)="approuver(d)">
                  <mat-icon>check</mat-icon>
                </button>
                <button mat-icon-button class="btn-refuse" matTooltip="Refuser" (click)="openRefus(d)">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </span>
          </div>
        }
      </div>
    }
  }

  <!-- ═══ VUE SOLDES ═══ -->
  @if (view() === 'soldes') {
    @if (loadingSoldes()) {
      <div class="loading-row"><div class="spinner"></div><span>Chargement des soldes...</span></div>
    } @else {
      <div class="soldes-table">
        <div class="soldes-table__head">
          <span class="col-name">Collaborateur</span>
          @for (t of typesActifs(); track t) {
            <span class="col-type" [style.color]="typeColor(t)">{{ typeLabel(t) }}</span>
          }
        </div>
        @for (row of soldesRows(); track row.userId) {
          <div class="soldes-table__row">
            <span class="col-name">
              <a [routerLink]="['/rh/salaries',row.userId]" class="collab-link">
                <span class="avatar-mini avatar-mini--sm">{{ row.initials }}</span>
                {{ row.name }}
              </a>
            </span>
            @for (t of typesActifs(); track t) {
              <span class="col-type">
                @if (row.soldes[t] !== undefined) {
                  <span class="solde-chip" [class.solde-chip--low]="row.soldes[t] <= 2">
                    {{ row.soldes[t] | number:'1.1-1' }}j
                  </span>
                } @else {
                  <span class="solde-chip solde-chip--none">—</span>
                }
              </span>
            }
          </div>
        }
      </div>
    }
  }

</div>

<!-- Formulaire nouvelle demande -->
@if (showNewForm()) {
  <div class="overlay" (click)="showNewForm.set(false)"></div>
  <div class="modal">
    <div class="modal__header">
      <span>Nouvelle demande de congé</span>
      <button mat-icon-button (click)="showNewForm.set(false)"><mat-icon>close</mat-icon></button>
    </div>
    <form [formGroup]="newForm" (ngSubmit)="submitNew()" class="modal__body">
      <mat-form-field appearance="outline" class="full">
        <mat-label>Collaborateur</mat-label>
        <mat-select formControlName="userId">
          @for (c of collaborateurs(); track c.id) {
            <mat-option [value]="c.id">{{ c.firstName }} {{ c.lastName }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Type de congé</mat-label>
        <mat-select formControlName="typeConge">
          @for (t of types; track t.value) { <mat-option [value]="t.value">{{ t.label }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <div class="form-row">
        <mat-form-field appearance="outline"><mat-label>Date de début</mat-label><input matInput type="date" formControlName="dateDebut" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Date de fin</mat-label><input matInput type="date" formControlName="dateFin" /></mat-form-field>
      </div>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Nombre de jours</mat-label>
        <input matInput type="number" formControlName="nombreJours" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Motif (optionnel)</mat-label>
        <input matInput formControlName="motif" />
      </mat-form-field>
      <div class="modal-actions">
        <button mat-button type="button" (click)="showNewForm.set(false)">Annuler</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="newForm.invalid || submitting()">
          {{ submitting() ? 'Envoi...' : 'Créer la demande' }}
        </button>
      </div>
    </form>
  </div>
}

<!-- Modale refus -->
@if (refusVisible()) {
  <div class="overlay" (click)="refusVisible.set(false)"></div>
  <div class="modal modal--sm">
    <div class="modal__header">
      <span>Motif du refus</span>
      <button mat-icon-button (click)="refusVisible.set(false)"><mat-icon>close</mat-icon></button>
    </div>
    <div class="modal__body">
      <mat-form-field appearance="outline" class="full">
        <mat-label>Commentaire (optionnel)</mat-label>
        <textarea matInput rows="3" [(ngModel)]="refusCommentaire"></textarea>
      </mat-form-field>
      <div class="modal-actions">
        <button mat-button (click)="refusVisible.set(false)">Annuler</button>
        <button mat-flat-button color="warn" (click)="confirmerRefus()">Refuser</button>
      </div>
    </div>
  </div>
}
  `,
  styles: [`
    .page { padding: 24px; }

    /* En-tête */
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
    .page-title { display: flex; align-items: center; gap: 12px;
      mat-icon { font-size: 28px; width: 28px; height: 28px; color: #162351; }
      h2 { margin: 0; font-size: 18px; font-weight: 700; color: #0f1a35; }
      .subtitle { font-size: 12px; color: #8a99b8; }
    }
    .header-actions { display: flex; align-items: center; gap: 10px; }
    .year-selector { display: flex; align-items: center; gap: 4px; }
    .year-label { font-size: 15px; font-weight: 700; color: #162351; min-width: 44px; text-align: center; }
    .btn-new { background: #162351 !important; color: #fff !important; border-radius: 20px !important; }

    /* Stats bar */
    .stats-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .stat-chip { display: flex; align-items: center; gap: 6px; background: #f8f9fe; border: 1px solid #e4e8f4; border-radius: 20px; padding: 5px 12px; font-size: 12px; font-weight: 600; color: #162351;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .stat-chip--orange { background: #fff7ed; border-color: #fed7aa; color: #c2410c; mat-icon { color: #f97316; } }
    .stat-chip--green  { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; mat-icon { color: #22c55e; } }
    .stat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .stat-label { color: #6b7fa3; font-weight: 400; }
    .stat-val { font-weight: 700; }

    /* Onglets vue */
    .view-tabs { display: flex; gap: 4px; margin-bottom: 14px; background: #f0f3fa; border-radius: 8px; padding: 3px; width: fit-content; }
    .view-tab { display: flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; color: #5a6a8a; background: none; border: none; cursor: pointer; transition: background .15s, color .15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .view-tab.active { background: #fff; color: #162351; box-shadow: 0 1px 3px rgba(0,0,0,.08); }

    /* Filtres */
    .filters { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
    .search { border: 1px solid #d1d5db; border-radius: 6px; padding: 7px 12px; font-size: 13px; outline: none; width: 240px; &:focus { border-color: #162351; } }
    .filter-select { border: 1px solid #d1d5db; border-radius: 6px; padding: 7px 10px; font-size: 13px; background: #fff; outline: none; cursor: pointer; }

    /* Demandes table */
    .loading-row, .empty-row { display: flex; align-items: center; gap: 10px; padding: 40px; color: #94a3b8; justify-content: center;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }
    .spinner { width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top-color: #162351; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .demandes-table { background: #fff; border: 1px solid #e4e8f4; border-radius: 10px; overflow: hidden; }
    .table-head, .table-row { display: grid; grid-template-columns: 2fr 1.5fr 1.5fr .7fr 1.5fr 1fr .8fr; align-items: center; padding: 10px 16px; gap: 8px; }
    .table-head { background: #f8f9fe; border-bottom: 1px solid #e4e8f4; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #8a99b8; }
    .table-row { border-bottom: 1px solid #f0f3fa; font-size: 12px; &:last-child { border-bottom: none; } &:hover { background: #fafbff; } }

    .collab-link { display: flex; align-items: center; gap: 8px; color: #0f1a35; text-decoration: none; font-weight: 600; &:hover { color: #162351; } }
    .avatar-mini { width: 26px; height: 26px; border-radius: 6px; background: linear-gradient(135deg, #1a2d6b, #2563eb); color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .avatar-mini--sm { width: 22px; height: 22px; font-size: 9px; }
    .type-badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px; }
    .col-dates { color: #4b5a7a; }
    .col-jours { color: #162351; }
    .col-motif { color: #6b7fa3; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .col-actions { display: flex; gap: 2px; }
    .statut-badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: .03em; }
    .statut-badge--en_attente  { background: #fef3c7; color: #92400e; }
    .statut-badge--approuvee   { background: #d1fae5; color: #065f46; }
    .statut-badge--refusee     { background: #fee2e2; color: #991b1b; }
    .statut-badge--annulee     { background: #f1f5f9; color: #64748b; }
    .btn-approve { color: #16a34a !important; &:hover { background: #f0fdf4 !important; } }
    .btn-refuse  { color: #dc2626 !important; &:hover { background: #fef2f2 !important; } }

    /* Soldes table */
    .soldes-table { background: #fff; border: 1px solid #e4e8f4; border-radius: 10px; overflow-x: auto; }
    .soldes-table__head, .soldes-table__row { display: flex; align-items: center; padding: 10px 16px; gap: 4px; border-bottom: 1px solid #f0f3fa; }
    .soldes-table__head { background: #f8f9fe; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
    .soldes-table__row:last-child { border-bottom: none; }
    .soldes-table__row:hover { background: #fafbff; }
    .col-name { min-width: 180px; flex-shrink: 0; }
    .col-type { min-width: 90px; flex-shrink: 0; text-align: center; font-size: 11px; }
    .solde-chip { display: inline-block; padding: 2px 8px; border-radius: 5px; background: #eef1fa; color: #162351; font-size: 11px; font-weight: 700; }
    .solde-chip--low  { background: #fee2e2; color: #991b1b; }
    .solde-chip--none { background: transparent; color: #c0c9de; }

    /* Modales */
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 999; }
    .modal {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,.18);
      z-index: 1000; width: 480px; max-height: 90vh; display: flex; flex-direction: column;
    }
    .modal--sm { width: 380px; }
    .modal__header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #e4e8f4; font-size: 14px; font-weight: 700; color: #162351; flex-shrink: 0; }
    .modal__body { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .full { width: 100%; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
  `],
})
export class CongesAbsencesComponent implements OnInit {
  private cSvc   = inject(CongesAbsencesService);
  private sSvc   = inject(SalariesService);
  private snack  = inject(MatSnackBar);
  private fb     = inject(FormBuilder);

  annee          = signal(new Date().getFullYear());
  view           = signal<ViewMode>('demandes');
  search         = signal('');
  statutFiltre   = signal('');
  typeFiltre     = signal('');
  siteFiltre     = signal('');
  loading        = signal(false);
  loadingSoldes  = signal(false);
  submitting     = signal(false);
  showNewForm    = signal(false);
  refusVisible   = signal(false);
  refusCommentaire = '';
  refusDemande   = signal<CongeAbsence | null>(null);

  demandes       = signal<CongeAbsence[]>([]);
  stats          = signal<CongeStats | null>(null);
  collaborateurs = signal<Collaborateur[]>([]);
  allSoldes      = signal<{ userId: number; name: string; initials: string; soldes: Record<string, number> }[]>([]);

  readonly types = TYPES;

  newForm = this.fb.group({
    userId:     [null as number | null, Validators.required],
    typeConge:  ['CONGES_PAYES', Validators.required],
    dateDebut:  ['', Validators.required],
    dateFin:    ['', Validators.required],
    nombreJours:[1, [Validators.required, Validators.min(0.5)]],
    motif:      [''],
  });

  topTypes = computed(() =>
    (this.stats()?.parType ?? []).filter(t => t.jours > 0).sort((a,b) => b.jours - a.jours).slice(0, 3)
  );

  demandesFiltrees = computed(() => {
    const q    = this.search().toLowerCase();
    const stat = this.statutFiltre();
    const type = this.typeFiltre();
    const site = this.siteFiltre();
    return this.demandes().filter(d => {
      const name = `${d.user?.firstName ?? ''} ${d.user?.lastName ?? ''}`.toLowerCase();
      if (q && !name.includes(q)) return false;
      if (stat && d.statut !== stat) return false;
      if (type && d.typeConge !== type) return false;
      if (site && d.user?.site !== site) return false;
      return true;
    });
  });

  typesActifs = computed(() => {
    const seen = new Set<string>();
    this.allSoldes().forEach(r => Object.keys(r.soldes).forEach(t => seen.add(t)));
    return [...seen] as TypeConge[];
  });

  soldesRows = computed(() => {
    const q = this.search().toLowerCase();
    return this.allSoldes().filter(r => !q || r.name.toLowerCase().includes(q));
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.cSvc.findAll({ annee: this.annee() }).subscribe({
      next: d => { this.demandes.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.cSvc.getStats(this.annee()).subscribe(s => this.stats.set(s));
    this.sSvc.list().subscribe(c => {
      this.collaborateurs.set(c);
      this.loadAllSoldes(c);
    });
  }

  private loadAllSoldes(collabs: Collaborateur[]) {
    this.loadingSoldes.set(true);
    let pending = collabs.length;
    if (!pending) { this.loadingSoldes.set(false); return; }
    const rows: SoldeRow[] = [];
    collabs.forEach(c => {
      this.cSvc.getSoldes(c.id, this.annee()).subscribe({
        next: soldes => {
          const map: Record<string, number> = {};
          soldes.filter(s => s.joursAcquis > 0).forEach(s => { map[s.typeConge] = s.solde; });
          rows.push({ userId: c.id, name: `${c.firstName} ${c.lastName}`, initials: (c.firstName[0]??'')+(c.lastName[0]??''), soldes: map });
          if (--pending === 0) { this.allSoldes.set([...rows]); this.loadingSoldes.set(false); }
        },
        error: () => { if (--pending === 0) { this.allSoldes.set([...rows]); this.loadingSoldes.set(false); } },
      });
    });
  }

  changeAnnee(d: number) { this.annee.update(a => a + d); this.load(); }

  approuver(d: CongeAbsence) {
    this.cSvc.approuver(d.id).subscribe(() => {
      this.snack.open('Approuvée', undefined, { duration: 2000 });
      this.load();
    });
  }

  openRefus(d: CongeAbsence) { this.refusDemande.set(d); this.refusCommentaire = ''; this.refusVisible.set(true); }

  confirmerRefus() {
    const d = this.refusDemande(); if (!d) return;
    this.cSvc.refuser(d.id, this.refusCommentaire || undefined).subscribe(() => {
      this.snack.open('Refusée', undefined, { duration: 2000 });
      this.refusVisible.set(false);
      this.load();
    });
  }

  submitNew() {
    if (this.newForm.invalid) return;
    this.submitting.set(true);
    const v = this.newForm.getRawValue();
    this.cSvc.create({ ...v as any }).subscribe({
      next: () => {
        this.snack.open('Demande créée', undefined, { duration: 2500 });
        this.showNewForm.set(false);
        this.newForm.reset({ typeConge: 'CONGES_PAYES', nombreJours: 1 });
        this.submitting.set(false);
        this.load();
      },
      error: (e) => { this.snack.open(e?.error?.message ?? 'Erreur', undefined, { duration: 3500 }); this.submitting.set(false); },
    });
  }

  initials(d: CongeAbsence) { return (d.user?.firstName?.[0] ?? '') + (d.user?.lastName?.[0] ?? ''); }
  typeLabel(t: string)  { return TYPE_CONGE_LABELS[t as TypeConge] ?? t; }
  typeColor(t: string)  { return TYPE_CONGE_COLORS[t as TypeConge] ?? '#162351'; }
  statutLabel(s: string) { return { EN_ATTENTE:'En attente', APPROUVEE:'Approuvée', REFUSEE:'Refusée', ANNULEE:'Annulée' }[s] ?? s; }
}
