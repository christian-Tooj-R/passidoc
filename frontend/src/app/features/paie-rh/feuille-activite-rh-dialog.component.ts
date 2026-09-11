import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  PaieRhService, VariableActiviteRh, LigneActiviteJourRh, LigneRollupActiviteRh, GranulariteActivite,
} from '../../core/services/paie-rh.service';

const MOIS_LABEL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export interface FeuilleActiviteRhDialogData {
  salarieId: number;
  salarieNom?: string;
  mois: number;
  annee: number;
}

type OngletActivite = 'journaliere' | 'hebdomadaire' | 'mensuelle' | 'annuelle';

const STATUT_LABELS: Record<string, string> = {
  EN_ATTENTE: 'En attente', CALCULE: 'Calculée', MODIFIE_MANUEL: 'Modifiée manuellement',
};

/**
 * "Feuille d'activité" journalière d'UN salarié (~"Consultation feuille d'activité" +
 * "Calcul Activité" RADIAN) : grille jour par jour d'une variable choisie (Présence,
 * Absence, Heures travaillées, Heures sup), avec regroupements Hebdomadaire/Mensuelle/
 * Annuelle, calcul en masse (Initialiser/Calculer) et correction manuelle ligne à ligne.
 *
 * Distinct du dialogue "Bulletin du salarié" (résumé mensuel primes/absences/retenues pour
 * le moteur de paie) — ouvrable en complément depuis l'écran "Activité" (/rh/activite).
 */
@Component({
  selector: 'app-feuille-activite-rh-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatCheckboxModule,
    MatTooltipModule, MatSnackBarModule,
  ],
  template: `
<div class="far-wrap">

  <div class="far-header">
    <div class="far-header-main">
      <mat-icon class="far-header-icon">assignment</mat-icon>
      <div>
        <h2>Feuille d'activité — {{ data.salarieNom ?? ('#' + data.salarieId) }}</h2>
        <p class="far-sub">Matricule {{ data.salarieId }} · Période {{ MOIS_LABEL[data.mois-1] }} {{ data.annee }}</p>
      </div>
    </div>
    <button mat-icon-button class="far-close" matTooltip="Fermer" aria-label="Fermer le dialogue" (click)="fermer()">
      <mat-icon>close</mat-icon>
    </button>
  </div>

  <div class="far-toolbar">
    <mat-form-field appearance="outline" class="sm">
      <mat-label>Variable</mat-label>
      <mat-select [(ngModel)]="variableCode" (ngModelChange)="reload()">
        @for (v of catalogue(); track v.code) { <mat-option [value]="v.code">{{ v.libelle }}</mat-option> }
      </mat-select>
    </mat-form-field>

    <mat-checkbox [(ngModel)]="recalculerModifs">Recalculer les modifications manuelles</mat-checkbox>

    <div class="far-spacer"></div>
    <button mat-stroked-button (click)="initialiser()"><mat-icon>playlist_add</mat-icon> Initialiser</button>
    <button mat-flat-button color="primary" (click)="calculer()"><mat-icon>calculate</mat-icon> Calculer</button>
  </div>

  <div class="far-tabs">
    <button class="far-tab" [class.active]="onglet()==='journaliere'" (click)="setOnglet('journaliere')">Journalière</button>
    <button class="far-tab" [class.active]="onglet()==='hebdomadaire'" (click)="setOnglet('hebdomadaire')">Hebdomadaire</button>
    <button class="far-tab" [class.active]="onglet()==='mensuelle'" (click)="setOnglet('mensuelle')">Mensuelle</button>
    <button class="far-tab" [class.active]="onglet()==='annuelle'" (click)="setOnglet('annuelle')">Annuelle</button>
  </div>

  <div class="far-content">

    @if (onglet() === 'journaliere') {
      <table class="far-table">
        <thead><tr><th>Jour</th><th>Semaine</th><th>Variable</th><th>Valeur</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          @for (l of grilleJournaliere(); track l.jour) {
            <tr>
              <td>{{ l.jour }}</td>
              <td>{{ l.semaine }}</td>
              <td>{{ variableLibelle() }}</td>
              <td>
                @if (editId() === l.id && l.id) {
                  <input matInput type="number" class="far-edit-input" [(ngModel)]="editValeur" (keyup.enter)="validerEdition(l)" />
                } @else {
                  {{ l.valeur }}
                }
              </td>
              <td><span class="badge-statut" [attr.data-statut]="l.statut ?? 'AUCUNE'">{{ l.statut ? STATUT_LABELS[l.statut] : '—' }}</span></td>
              <td class="far-actions-cell">
                @if (l.id) {
                  @if (editId() === l.id) {
                    <button mat-icon-button matTooltip="Valider" aria-label="Valider" (click)="validerEdition(l)"><mat-icon>check</mat-icon></button>
                  } @else {
                    <button mat-icon-button matTooltip="Modifier la valeur" aria-label="Modifier la valeur" (click)="commencerEdition(l)"><mat-icon>edit</mat-icon></button>
                  }
                }
              </td>
            </tr>
          }
          @if (!grilleJournaliere().length) {
            <tr><td colspan="6" class="far-empty-row">Aucune donnée — cliquez sur "Initialiser" puis "Calculer".</td></tr>
          }
        </tbody>
      </table>
    }

    @if (onglet() !== 'journaliere') {
      <table class="far-table">
        <thead><tr><th>Période</th><th>{{ variableLibelle() }}</th></tr></thead>
        <tbody>
          @for (l of rollup(); track l.periode) {
            <tr><td>{{ l.periode }}</td><td>{{ l.valeur }}</td></tr>
          }
          @if (!rollup().length) {
            <tr><td colspan="2" class="far-empty-row">Aucune donnée.</td></tr>
          }
        </tbody>
      </table>
    }

  </div>
</div>
  `,
  styles: [`
    .far-wrap { display: flex; flex-direction: column; height: 100%; background: #fff; }
    .far-header { display: flex; align-items: center; gap: 12px; padding: 18px 20px; border-bottom: 1px solid #E2E8F0; }
    .far-header-main { display: flex; align-items: center; gap: 12px; flex: 1; }
    .far-header-icon { color: #7C3AED; font-size: 28px; width: 28px; height: 28px; }
    .far-header h2 { font-size: 16px; font-weight: 700; color: #1E293B; margin: 0; }
    .far-sub { font-size: 12px; color: #94A3B8; margin: 2px 0 0; }
    .far-toolbar { display: flex; align-items: center; gap: 14px; padding: 14px 20px; border-bottom: 1px solid #F1F5F9; flex-wrap: wrap; }
    mat-form-field.sm { max-width: 220px; }
    .far-spacer { flex: 1; }
    .far-tabs { display: flex; gap: 4px; padding: 0 20px; border-bottom: 1px solid #E2E8F0; }
    .far-tab { border: none; background: none; cursor: pointer; padding: 10px 14px; font-size: 13px; font-weight: 500; color: #64748B; border-bottom: 2px solid transparent; }
    .far-tab:hover { color: #1E293B; }
    .far-tab.active { color: #7C3AED; border-bottom-color: #7C3AED; font-weight: 700; }
    .far-content { flex: 1; overflow-y: auto; padding: 16px 20px; }
    .far-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .far-table th { text-align: left; color: #94A3B8; font-size: 11px; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid #E2E8F0; position: sticky; top: 0; background: #fff; }
    .far-table td { padding: 8px; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
    .far-edit-input { width: 80px; }
    .far-actions-cell { text-align: right; }
    .far-empty-row { text-align: center; color: #94A3B8; padding: 16px !important; }
    .badge-statut { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: #F1F5F9; color: #64748B; }
    .badge-statut[data-statut="CALCULE"] { background: #DBEAFE; color: #1D4ED8; }
    .badge-statut[data-statut="MODIFIE_MANUEL"] { background: #FEF3C7; color: #92400E; }
    .badge-statut[data-statut="EN_ATTENTE"] { background: #F1F5F9; color: #64748B; }
  `],
})
export class FeuilleActiviteRhDialogComponent implements OnInit {
  private paieRh = inject(PaieRhService);
  private snack = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<FeuilleActiviteRhDialogComponent>);

  readonly MOIS_LABEL = MOIS_LABEL;
  readonly STATUT_LABELS = STATUT_LABELS;

  catalogue = signal<VariableActiviteRh[]>([]);
  variableCode = 'PRESENCE';
  recalculerModifs = false;
  onglet = signal<OngletActivite>('journaliere');

  grilleJournaliere = signal<LigneActiviteJourRh[]>([]);
  rollup = signal<LigneRollupActiviteRh[]>([]);

  editId = signal<number | null>(null);
  editValeur = 0;

  constructor(@Inject(MAT_DIALOG_DATA) public data: FeuilleActiviteRhDialogData) {}

  ngOnInit() {
    this.paieRh.findCatalogueActivite().subscribe((c) => {
      this.catalogue.set(c);
      this.reload();
    });
  }

  variableLibelle(): string {
    return this.catalogue().find((v) => v.code === this.variableCode)?.libelle ?? this.variableCode;
  }

  setOnglet(o: OngletActivite) {
    this.onglet.set(o);
    this.reload();
  }

  reload() {
    if (this.onglet() === 'journaliere') {
      this.paieRh.findGrilleActiviteJour(this.data.salarieId, this.variableCode, this.data.mois, this.data.annee)
        .subscribe((l) => this.grilleJournaliere.set(l));
    } else {
      this.paieRh.findRollupActivite(
        this.data.salarieId, this.variableCode, this.onglet() as GranulariteActivite, this.data.mois, this.data.annee,
      ).subscribe((l) => this.rollup.set(l));
    }
  }

  initialiser() {
    this.paieRh.initialiserActiviteJour(this.data.mois, this.data.annee, this.data.salarieId).subscribe({
      next: (res) => { this.snack.open(`${res.creees} ligne(s) initialisée(s)`, undefined, { duration: 2500 }); this.reload(); },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3500 }),
    });
  }

  calculer() {
    this.paieRh.calculerActiviteJour(this.data.mois, this.data.annee, this.data.salarieId, this.recalculerModifs).subscribe({
      next: (res) => { this.snack.open(`${res.calculees} valeur(s) calculée(s)`, undefined, { duration: 2500 }); this.reload(); },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3500 }),
    });
  }

  commencerEdition(l: LigneActiviteJourRh) {
    this.editId.set(l.id);
    this.editValeur = l.valeur;
  }

  validerEdition(l: LigneActiviteJourRh) {
    if (!l.id) return;
    this.paieRh.modifierValeurActiviteJour(l.id, Number(this.editValeur)).subscribe({
      next: () => { this.editId.set(null); this.reload(); },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3500 }),
    });
  }

  fermer() {
    this.dialogRef.close();
  }
}
