import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CongesAbsencesService, CongeAbsence, SoldeConge,
  TypeConge, StatutConge, TYPE_CONGE_LABELS, TYPE_CONGE_COLORS,
} from '../../core/services/conges-absences.service';
import { OnlyNumbersDirective } from '../../shared/directives/only-numbers.directive';

const TYPES: { value: TypeConge; label: string }[] = Object.entries(TYPE_CONGE_LABELS).map(([v, l]) => ({ value: v as TypeConge, label: l }));

@Component({
  selector: 'app-salaries-conges',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatSnackBarModule,
    MatTooltipModule, OnlyNumbersDirective,
  ],
  template: `
<div class="conges-page">

  <!-- En-tête avec sélecteur d'année -->
  <div class="conges-header">
    <h3>Congés & Absences — {{ userName }}</h3>
    <div class="year-selector">
      <button mat-icon-button (click)="changeAnnee(-1)"><mat-icon>chevron_left</mat-icon></button>
      <span class="year-label">{{ annee() }}</span>
      <button mat-icon-button (click)="changeAnnee(1)"><mat-icon>chevron_right</mat-icon></button>
    </div>
    <button mat-flat-button class="btn-new" (click)="showForm.set(!showForm())">
      <mat-icon>{{ showForm() ? 'close' : 'add' }}</mat-icon>
      {{ showForm() ? 'Annuler' : 'Nouvelle demande' }}
    </button>
  </div>

  <!-- Soldes -->
  <div class="soldes-grid">
    @for (s of soldes(); track s.typeConge) {
      @if (s.joursAcquis > 0 || s.typeConge === 'CONGES_PAYES' || s.typeConge === 'RTT') {
        <div class="solde-card" [style.border-top-color]="typeColor(s.typeConge)">
          <div class="solde-card__type">{{ typeLabel(s.typeConge) }}</div>
          <div class="solde-card__main" [class.solde-card__main--low]="s.solde <= 2">
            {{ s.solde | number:'1.1-1' }}<span class="solde-unit">j</span>
          </div>
          <div class="solde-card__detail">
            <span>{{ s.joursAcquis | number:'1.1-1' }}j acquis</span>
            <span class="dot">·</span>
            <span>{{ s.joursPris | number:'1.1-1' }}j pris</span>
            @if (s.joursEnAttente > 0) {
              <span class="dot">·</span>
              <span class="pending">{{ s.joursEnAttente | number:'1.1-1' }}j en attente</span>
            }
          </div>
          <button mat-icon-button class="btn-edit-solde" matTooltip="Modifier le solde"
                  (click)="editSolde(s)">
            <mat-icon>edit</mat-icon>
          </button>
        </div>
      }
    }
  </div>

  <!-- Formulaire nouvelle demande -->
  @if (showForm()) {
    <div class="form-card">
      <div class="form-card__title"><mat-icon>event_available</mat-icon> Nouvelle demande</div>
      <form [formGroup]="form" (ngSubmit)="submitDemande()" class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Type de congé</mat-label>
          <mat-select formControlName="typeConge">
            @for (t of types; track t.value) {
              <mat-option [value]="t.value">{{ t.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Nombre de jours</mat-label>
          <input matInput type="number" formControlName="nombreJours" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Date de début</mat-label>
          <input matInput type="date" formControlName="dateDebut" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Date de fin</mat-label>
          <input matInput type="date" formControlName="dateFin" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="span-2">
          <mat-label>Motif (optionnel)</mat-label>
          <input matInput formControlName="motif" />
        </mat-form-field>
        <div class="form-actions span-2">
          <button mat-flat-button class="btn-submit" type="submit" [disabled]="form.invalid || submitting()">
            <mat-icon>send</mat-icon> {{ submitting() ? 'Envoi...' : 'Soumettre' }}
          </button>
        </div>
      </form>
    </div>
  }

  <!-- Historique des demandes -->
  <div class="history">
    <div class="history__title">Historique des demandes</div>
    @if (loadingDemandes()) {
      <div class="loading-row"><div class="spinner"></div><span>Chargement...</span></div>
    } @else if (demandes().length === 0) {
      <div class="empty-row"><mat-icon>event_busy</mat-icon><span>Aucune demande pour {{ annee() }}</span></div>
    } @else {
      <div class="demandes-list">
        @for (d of demandes(); track d.id) {
          <div class="demande-row">
            <div class="demande-type" [style.background]="typeColor(d.typeConge) + '18'" [style.color]="typeColor(d.typeConge)">
              {{ typeLabel(d.typeConge) }}
            </div>
            <div class="demande-dates">
              <mat-icon>date_range</mat-icon>
              {{ d.dateDebut | date:'dd/MM/yyyy' }} → {{ d.dateFin | date:'dd/MM/yyyy' }}
              <span class="demande-jours">{{ d.nombreJours }}j</span>
            </div>
            @if (d.motif) {
              <div class="demande-motif">{{ d.motif }}</div>
            }
            <div class="demande-statut">
              <span class="statut-badge statut-badge--{{ d.statut.toLowerCase() }}">{{ statutLabel(d.statut) }}</span>
              @if (d.commentaireRH) {
                <span class="demande-comment" [matTooltip]="d.commentaireRH"><mat-icon>comment</mat-icon></span>
              }
            </div>
            @if (d.statut === 'EN_ATTENTE') {
              <button mat-icon-button class="btn-cancel" matTooltip="Annuler" (click)="annulerDemande(d.id)">
                <mat-icon>close</mat-icon>
              </button>
            }
            @if (d.statut === 'EN_ATTENTE' || d.statut === 'APPROUVEE') {
              <div class="demande-actions">
                @if (d.statut === 'EN_ATTENTE') {
                  <button mat-stroked-button class="btn-approve" (click)="approuver(d.id)">
                    <mat-icon>check</mat-icon> Approuver
                  </button>
                  <button mat-stroked-button class="btn-refuse" (click)="refuser(d.id)">
                    <mat-icon>close</mat-icon> Refuser
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>
    }
  </div>

</div>

<!-- Modale édition solde -->
@if (editSoldeVisible()) {
  <div class="overlay" (click)="editSoldeVisible.set(false)"></div>
  <div class="solde-modal">
    <div class="solde-modal__header">
      <span>Modifier le solde — {{ typeLabel(editSoldeData()?.typeConge ?? 'CONGES_PAYES') }}</span>
      <button mat-icon-button (click)="editSoldeVisible.set(false)"><mat-icon>close</mat-icon></button>
    </div>
    <div class="solde-modal__body">
      <mat-form-field appearance="outline" class="full">
        <mat-label>Jours acquis {{ annee() }}</mat-label>
        <input matInput type="number" [(ngModel)]="editSoldeJours" />
      </mat-form-field>
      <div class="modal-actions">
        <button mat-button (click)="editSoldeVisible.set(false)">Annuler</button>
        <button mat-flat-button color="primary" (click)="saveSolde()">Enregistrer</button>
      </div>
    </div>
  </div>
}
  `,
  styles: [`
    :host { display: block; }
    .conges-page { display: flex; flex-direction: column; gap: 20px; }

    /* En-tête */
    .conges-header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .conges-header h3 { margin: 0; font-size: 15px; font-weight: 700; color: #0f1a35; flex: 1; }
    .year-selector { display: flex; align-items: center; gap: 4px; }
    .year-label { font-size: 14px; font-weight: 700; color: #162351; min-width: 44px; text-align: center; }
    .btn-new { background: #162351 !important; color: #fff !important; border-radius: 20px !important; }

    /* Soldes */
    .soldes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .solde-card {
      background: #fff; border: 1px solid #e4e8f4; border-radius: 10px;
      border-top: 3px solid #162351;
      padding: 14px 16px; position: relative;
      box-shadow: 0 1px 4px rgba(22,35,81,.05);
    }
    .solde-card__type { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #8a99b8; margin-bottom: 6px; }
    .solde-card__main { font-size: 28px; font-weight: 800; color: #162351; line-height: 1; }
    .solde-card__main--low { color: #ef4444; }
    .solde-unit { font-size: 14px; font-weight: 600; margin-left: 2px; }
    .solde-card__detail { font-size: 11px; color: #8a99b8; margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
    .dot { color: #c0c9de; }
    .pending { color: #f59e0b; font-weight: 600; }
    .btn-edit-solde { position: absolute; top: 6px; right: 6px; color: #c0c9de !important; width: 28px !important; height: 28px !important;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &:hover { color: #162351 !important; }
    }

    /* Formulaire */
    .form-card { background: #f8f9fe; border: 1px solid #e0e4f4; border-radius: 10px; padding: 16px 20px; }
    .form-card__title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #162351; margin-bottom: 16px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
    .span-2 { grid-column: span 2; }
    .form-actions { display: flex; justify-content: flex-end; padding-top: 4px; }
    .btn-submit { background: #162351 !important; color: #fff !important; border-radius: 20px !important; }

    /* Historique */
    .history__title { font-size: 13px; font-weight: 700; color: #0f1a35; margin-bottom: 12px; }
    .loading-row, .empty-row { display: flex; align-items: center; gap: 10px; padding: 24px; color: #94a3b8; justify-content: center; }
    .spinner { width: 16px; height: 16px; border: 2px solid #e2e8f0; border-top-color: #162351; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .demandes-list { display: flex; flex-direction: column; gap: 8px; }
    .demande-row {
      background: #fff; border: 1px solid #e4e8f4; border-radius: 8px;
      padding: 12px 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    }
    .demande-type { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; flex-shrink: 0; }
    .demande-dates { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #4b5a7a; flex: 1;
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #8a99b8; }
    }
    .demande-jours { font-weight: 700; color: #162351; background: #eef1fa; padding: 1px 6px; border-radius: 4px; margin-left: 4px; }
    .demande-motif { font-size: 11px; color: #6b7fa3; font-style: italic; }
    .demande-statut { display: flex; align-items: center; gap: 6px; }
    .statut-badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: .04em; }
    .statut-badge--en_attente  { background: #fef3c7; color: #92400e; }
    .statut-badge--approuvee   { background: #d1fae5; color: #065f46; }
    .statut-badge--refusee     { background: #fee2e2; color: #991b1b; }
    .statut-badge--annulee     { background: #f1f5f9; color: #64748b; }
    .demande-comment mat-icon { font-size: 14px; width: 14px; height: 14px; color: #8a99b8; cursor: help; }
    .btn-cancel { color: #dc2626 !important; width: 28px !important; height: 28px !important;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .demande-actions { display: flex; gap: 6px; }
    .btn-approve { color: #065f46 !important; border-color: #86efac !important; font-size: 12px !important; }
    .btn-refuse  { color: #991b1b !important; border-color: #fca5a5 !important; font-size: 12px !important; }

    /* Modale */
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 999; }
    .solde-modal {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #fff; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,.18);
      z-index: 1000; width: 360px;
    }
    .solde-modal__header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; border-bottom: 1px solid #e4e8f4;
      font-size: 13px; font-weight: 700; color: #162351;
    }
    .solde-modal__body { padding: 16px; }
    .full { width: 100%; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
  `],
})
export class SalariesCongesComponent implements OnInit {
  @Input() userId!: number;
  @Input() userName = '';

  private svc   = inject(CongesAbsencesService);
  private snack = inject(MatSnackBar);
  private fb    = inject(FormBuilder);

  annee           = signal(new Date().getFullYear());
  soldes          = signal<SoldeConge[]>([]);
  demandes        = signal<CongeAbsence[]>([]);
  loadingDemandes = signal(false);
  showForm        = signal(false);
  submitting      = signal(false);
  editSoldeVisible = signal(false);
  editSoldeData    = signal<SoldeConge | null>(null);
  editSoldeJours   = 0;

  readonly types = TYPES;

  form = this.fb.group({
    typeConge:   ['CONGES_PAYES', Validators.required],
    dateDebut:   ['', Validators.required],
    dateFin:     ['', Validators.required],
    nombreJours: [1, [Validators.required, Validators.min(0.5)]],
    motif:       [''],
  });

  ngOnInit() { this.load(); }

  load() {
    this.svc.getSoldes(this.userId, this.annee()).subscribe(s => this.soldes.set(s));
    this.loadingDemandes.set(true);
    this.svc.findAll({ userId: this.userId, annee: this.annee() }).subscribe({
      next: d => { this.demandes.set(d); this.loadingDemandes.set(false); },
      error: () => this.loadingDemandes.set(false),
    });
  }

  changeAnnee(delta: number) { this.annee.update(a => a + delta); this.load(); }

  submitDemande() {
    if (this.form.invalid) return;
    this.submitting.set(true);
    const v = this.form.getRawValue();
    this.svc.create({ ...v as any, userId: this.userId }).subscribe({
      next: () => {
        this.snack.open('Demande soumise', undefined, { duration: 2500 });
        this.showForm.set(false);
        this.form.reset({ typeConge: 'CONGES_PAYES', nombreJours: 1 });
        this.submitting.set(false);
        this.load();
      },
      error: (e) => {
        this.snack.open(e?.error?.message ?? 'Erreur', undefined, { duration: 3500 });
        this.submitting.set(false);
      },
    });
  }

  annulerDemande(id: number) {
    this.svc.annuler(id).subscribe(() => { this.snack.open('Demande annulée', undefined, { duration: 2000 }); this.load(); });
  }

  approuver(id: number) {
    this.svc.approuver(id).subscribe(() => { this.snack.open('Demande approuvée', undefined, { duration: 2000 }); this.load(); });
  }

  refuser(id: number) {
    this.svc.refuser(id).subscribe(() => { this.snack.open('Demande refusée', undefined, { duration: 2000 }); this.load(); });
  }

  editSolde(s: SoldeConge) {
    this.editSoldeData.set(s);
    this.editSoldeJours = s.joursAcquis;
    this.editSoldeVisible.set(true);
  }

  saveSolde() {
    const s = this.editSoldeData();
    if (!s) return;
    this.svc.updateSolde(this.userId, { typeConge: s.typeConge, annee: this.annee(), joursAcquis: this.editSoldeJours }).subscribe(() => {
      this.snack.open('Solde mis à jour', undefined, { duration: 2000 });
      this.editSoldeVisible.set(false);
      this.load();
    });
  }

  typeLabel(t: string)  { return TYPE_CONGE_LABELS[t as TypeConge] ?? t; }
  typeColor(t: string)  { return TYPE_CONGE_COLORS[t as TypeConge] ?? '#162351'; }
  statutLabel(s: string) {
    return { EN_ATTENTE: 'En attente', APPROUVEE: 'Approuvée', REFUSEE: 'Refusée', ANNULEE: 'Annulée' }[s] ?? s;
  }
}
