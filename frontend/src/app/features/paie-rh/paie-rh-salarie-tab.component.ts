import { Component, Input, OnInit, inject, signal } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  PaieRhService, ContratTravail, TYPE_CONTRAT_LABELS, TypeContratTravail, deviseSymbole,
} from '../../core/services/paie-rh.service';

/**
 * Onglet "Contrat & Paie" de la fiche salarié — module Paie RH interne (collaborateurs
 * AFYM). Distinct du sous-onglet "Paie" existant sous "Fiche salarié" (qui n'affiche que
 * les champs bruts de `User` en lecture seule) : ici on gère uniquement le CONTRAT DE
 * TRAVAIL — le calcul/génération de bulletins et les acomptes sont réservés à la section
 * Paie (ADMIN uniquement), gérés depuis "Paie interne" (`/rh/paie`), pas depuis la fiche
 * individuelle du salarié. Voir Doc/MODULE_PAIE_RH_NOTES.md.
 */
@Component({
  selector: 'app-paie-rh-salarie-tab',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSnackBarModule,
  ],
  template: `
<div class="prh-wrap">

  @if (loading()) {
    <div class="prh-loading"><div class="spinner"></div><span>Chargement…</span></div>
  }

  <!-- ═══ CONTRAT DE TRAVAIL ═══ -->
  <div class="prh-card">
    <div class="prh-card__header">
      <mat-icon>description</mat-icon>
      <span>Contrat de travail</span>
      @if (!editingContrat() && contrat()) {
        <button mat-stroked-button class="prh-btn-sm" (click)="startEditContrat()">
          <mat-icon>edit</mat-icon> Modifier / Avenant
        </button>
      }
    </div>

    @if (!contrat() && !editingContrat()) {
      <div class="prh-empty">
        <p>Aucun contrat de travail actif pour ce collaborateur.</p>
        <button mat-flat-button color="primary" (click)="startEditContrat()">
          <mat-icon>add</mat-icon> Créer un contrat
        </button>
      </div>
    }

    @if (contrat() && !editingContrat()) {
      <div class="field-grid">
        <div class="field"><span class="f-label">Type de contrat</span><span class="f-val">{{ typeLabel(contrat()!.typeContrat) }}</span></div>
        <div class="field"><span class="f-label">Date de début</span><span class="f-val">{{ contrat()!.dateDebut | date:'dd/MM/yyyy' }}</span></div>
        <div class="field"><span class="f-label">Date de fin</span><span class="f-val">{{ contrat()!.dateFin ? (contrat()!.dateFin | date:'dd/MM/yyyy') : 'Indéterminée' }}</span></div>
        <div class="field"><span class="f-label">Quotité de travail</span><span class="f-val">{{ contrat()!.quotiteTravail | number:'1.0-2' }} %</span></div>
        <div class="field"><span class="f-label">Salaire de base mensuel</span><span class="f-val">{{ contrat()!.salaireBase | number:'1.2-2' }} {{ symboleDevise() }}</span></div>
        <div class="field"><span class="f-label">Régime de paie (pôle)</span><span class="f-val">{{ contrat()!.regimePaieCode }}</span></div>
      </div>
      @if (contrat()!.historique?.length) {
        <details class="prh-historique">
          <summary>Historique ({{ contrat()!.historique!.length }} modification(s))</summary>
          @for (h of contrat()!.historique; track $index) {
            <div class="prh-hist-row">
              <span class="hist-date">{{ h.date | date:'dd/MM/yyyy HH:mm' }}</span>
              <span class="hist-champ">{{ h.champ }}</span>
              <span class="hist-vals">{{ h.ancienneValeur ?? '—' }} → {{ h.nouvelleValeur ?? '—' }}</span>
              @if (h.motif) { <span class="hist-motif">({{ h.motif }})</span> }
            </div>
          }
        </details>
      }
    }

    @if (editingContrat()) {
      <div class="prh-form">
        <div class="prh-form-grid">
          <mat-form-field appearance="outline">
            <mat-label>Type de contrat</mat-label>
            <mat-select [(ngModel)]="formTypeContrat">
              @for (t of typesContrat; track t) { <mat-option [value]="t">{{ typeLabel(t) }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Date de début</mat-label>
            <input matInput type="date" [(ngModel)]="formDateDebut" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Quotité de travail (%)</mat-label>
            <input matInput type="number" [(ngModel)]="formQuotite" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Salaire de base mensuel brut</mat-label>
            <input matInput type="number" [(ngModel)]="formSalaireBase" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Régime de paie (pôle)</mat-label>
            <mat-select [(ngModel)]="formRegime">
              @for (r of regimesOptions; track r) { <mat-option [value]="r">{{ r }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Motif de la modification</mat-label>
            <input matInput [(ngModel)]="formMotif" placeholder="Ex: revalorisation salariale, avenant temps partiel..." />
          </mat-form-field>
        </div>
        <div class="prh-form-actions">
          <button mat-button (click)="cancelEditContrat()">Annuler</button>
          <button mat-flat-button color="primary" (click)="saveContrat()">Enregistrer</button>
        </div>
      </div>
    }
  </div>

</div>
  `,
  styles: [`
    .prh-wrap { display: flex; flex-direction: column; gap: 16px; padding: 4px 0 32px; }
    .prh-loading { display: flex; align-items: center; gap: 8px; padding: 20px; color: #64748B; }
    .prh-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px 20px; }
    .prh-card__header {
      display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #1E293B;
      margin-bottom: 14px;
      mat-icon { color: #7C3AED; font-size: 20px; width: 20px; height: 20px; }
    }
    .prh-btn-sm { margin-left: auto; font-size: 12px; }
    .prh-empty { text-align: center; padding: 24px 0; color: #94A3B8; }
    .field-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 20px; }
    .field { display: flex; flex-direction: column; gap: 2px; }
    .field.span-2 { grid-column: span 2; }
    .f-label { font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: .04em; }
    .f-val { font-size: 14px; color: #1E293B; font-weight: 500; }
    .f-val.f-strong, .f-label.f-strong { font-weight: 700; color: #7C3AED; }
    .prh-historique { margin-top: 14px; font-size: 12px; color: #64748B; }
    .prh-historique summary { cursor: pointer; font-weight: 600; }
    .prh-hist-row { display: flex; gap: 8px; padding: 4px 0; border-bottom: 1px dashed #E2E8F0; flex-wrap: wrap; }
    .hist-date { color: #94A3B8; min-width: 130px; }
    .hist-champ { font-weight: 600; }
    .prh-form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 16px; }
    .prh-form-grid .span-2 { grid-column: span 2; }
    .prh-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    .spinner { width: 18px; height: 18px; border: 2px solid #E2E8F0; border-top-color: #7C3AED; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class PaieRhSalarieTabComponent implements OnInit {
  @Input({ required: true }) userId!: number;
  /** Pôle/antenne (EST/OUEST, menu Équipes) — détermine le régime de paie par défaut d'un nouveau contrat. */
  @Input() userAntenne?: string | null;
  /** Devise du salarié (`User.devise`) — jamais "€" supposé, voir `deviseSymbole()`. */
  @Input() userDevise?: string | null;
  readonly regimesOptions = ['TOUS', 'EST', 'OUEST'];
  readonly symboleDevise = () => deviseSymbole(this.userDevise);

  private paieRh = inject(PaieRhService);
  private snack = inject(MatSnackBar);

  readonly typesContrat: TypeContratTravail[] = ['CDI', 'CDD', 'APPRENTISSAGE', 'STAGE', 'INTERIM', 'AUTRE'];

  loading = signal(true);
  contrat = signal<ContratTravail | null>(null);

  editingContrat = signal(false);
  formTypeContrat: TypeContratTravail = 'CDI';
  formDateDebut = new Date().toISOString().split('T')[0];
  formQuotite = 100;
  formSalaireBase = 0;
  formRegime = '';
  formMotif = '';

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.paieRh.findContratActif(this.userId).subscribe({
      next: (c) => {
        this.contrat.set(c);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  typeLabel(t: TypeContratTravail) { return TYPE_CONTRAT_LABELS[t] ?? t; }

  startEditContrat() {
    const c = this.contrat();
    if (c) {
      this.formTypeContrat = c.typeContrat;
      this.formDateDebut = new Date().toISOString().split('T')[0];
      this.formQuotite = c.quotiteTravail;
      this.formSalaireBase = c.salaireBase;
      this.formRegime = c.regimePaieCode;
    } else {
      this.formRegime = this.userAntenne ?? 'TOUS';
    }
    this.formMotif = '';
    this.editingContrat.set(true);
  }

  cancelEditContrat() { this.editingContrat.set(false); }

  saveContrat() {
    const c = this.contrat();
    if (c) {
      this.paieRh.updateContrat(c.id, {
        typeContrat: this.formTypeContrat,
        quotiteTravail: this.formQuotite,
        salaireBase: this.formSalaireBase,
        regimePaieCode: this.formRegime,
        motif: this.formMotif,
      } as any).subscribe({
        next: (updated) => {
          this.contrat.set(updated);
          this.editingContrat.set(false);
          this.snack.open('Contrat mis à jour', undefined, { duration: 2500 });
        },
        error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
      });
    } else {
      this.paieRh.createContrat({
        salarieId: this.userId,
        typeContrat: this.formTypeContrat,
        dateDebut: this.formDateDebut,
        quotiteTravail: this.formQuotite,
        salaireBase: this.formSalaireBase,
        regimePaieCode: this.formRegime || undefined,
        motif: this.formMotif,
      }).subscribe({
        next: (created) => {
          this.contrat.set(created);
          this.editingContrat.set(false);
          this.snack.open('Contrat créé', undefined, { duration: 2500 });
        },
        error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
      });
    }
  }

}
