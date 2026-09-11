import { Component, Input, OnInit, inject, signal } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  PaieRhService, ContratTravail, BulletinSalarie, AcompteSalarie, ResultatCalculPaieRh,
  TYPE_CONTRAT_LABELS, TypeContratTravail, deviseSymbole,
} from '../../core/services/paie-rh.service';
import { BulletinSalarieDialogComponent } from './bulletin-salarie-dialog/bulletin-salarie-dialog.component';
import { BulletinPdfPreviewDialogComponent } from './bulletin-pdf-preview-dialog.component';

const MOIS_LABEL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/**
 * Onglet "Contrat & Paie" de la fiche salarié — module Paie RH interne (collaborateurs
 * AFYM). Distinct du sous-onglet "Paie" existant sous "Fiche salarié" (qui n'affiche que
 * les champs bruts de `User` en lecture seule) : ici on gère le CONTRAT DE TRAVAIL, le
 * CALCUL et la GÉNÉRATION DE BULLETINS, et les ACOMPTES. Voir Doc/MODULE_PAIE_RH_NOTES.md.
 */
@Component({
  selector: 'app-paie-rh-salarie-tab',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSnackBarModule, MatDialogModule,
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

  @if (contrat()) {

  <!-- ═══ BULLETINS DE SALAIRE ═══ -->
  <div class="prh-card">
    <div class="prh-card__header">
      <mat-icon>receipt_long</mat-icon>
      <span>Bulletins de salaire</span>
    </div>

    <div class="prh-periode-bar">
      <mat-form-field appearance="outline" class="sm">
        <mat-label>Mois</mat-label>
        <mat-select [(ngModel)]="selMois">
          @for (m of moisOptions; track m.v) { <mat-option [value]="m.v">{{ m.l }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="sm">
        <mat-label>Année</mat-label>
        <input matInput type="number" [(ngModel)]="selAnnee" />
      </mat-form-field>
      <button mat-stroked-button (click)="calculerApercu()">
        <mat-icon>calculate</mat-icon> Aperçu du calcul
      </button>
      <button mat-flat-button color="primary" (click)="genererBulletin()">
        <mat-icon>fact_check</mat-icon> Générer le bulletin
      </button>
      <button mat-stroked-button color="primary" (click)="ouvrirBulletinDetaille()">
        <mat-icon>open_in_full</mat-icon> Bulletin détaillé (6 onglets)
      </button>
    </div>

    @if (apercu()) {
      <div class="prh-apercu" [class.prh-apercu--placeholder]="hasPlaceholder()">
        @if (hasPlaceholder()) {
          <div class="prh-warning">
            <mat-icon>warning</mat-icon>
            Ce calcul utilise au moins un taux/paramètre EXEMPLE (placeholder) non certifié — voir Doc/MODULE_PAIE_RH_NOTES.md.
          </div>
        }
        <div class="field-grid">
          <div class="field"><span class="f-label">Salaire de base</span><span class="f-val">{{ apercu()!.salaireBase | number:'1.2-2' }} {{ symboleDevise() }}</span></div>
          <div class="field"><span class="f-label">Total brut</span><span class="f-val">{{ apercu()!.totalBrut | number:'1.2-2' }} {{ symboleDevise() }}</span></div>
          <div class="field"><span class="f-label">Cotisations salariales</span><span class="f-val">{{ apercu()!.totalCotisationsSalariales | number:'1.2-2' }} {{ symboleDevise() }}</span></div>
          <div class="field"><span class="f-label">Cotisations patronales</span><span class="f-val">{{ apercu()!.totalCotisationsPatronales | number:'1.2-2' }} {{ symboleDevise() }}</span></div>
          <div class="field"><span class="f-label">Net imposable</span><span class="f-val">{{ apercu()!.netImposable | number:'1.2-2' }} {{ symboleDevise() }}</span></div>
          <div class="field"><span class="f-label f-strong">Net à payer</span><span class="f-val f-strong">{{ apercu()!.netAPayer | number:'1.2-2' }} {{ symboleDevise() }}</span></div>
          <div class="field"><span class="f-label">Coût employeur</span><span class="f-val">{{ apercu()!.coutEmployeur | number:'1.2-2' }} {{ symboleDevise() }}</span></div>
        </div>
      </div>
    }

    <table class="prh-table">
      <thead>
        <tr><th>Période</th><th>Net à payer</th><th>Coût employeur</th><th>Paiement</th><th></th></tr>
      </thead>
      <tbody>
        @for (b of bulletins(); track b.id) {
          <tr>
            <td>{{ MOIS_LABEL[b.mois-1] }} {{ b.annee }} @if (b.version > 1) { <span class="badge-v">v{{ b.version }}</span> } @if (b.estRegularisation) { <span class="badge-r">régul.</span> }</td>
            <td>{{ b.netAPayer | number:'1.2-2' }} {{ symboleDevise() }}</td>
            <td>{{ b.coutEmployeur | number:'1.2-2' }} {{ symboleDevise() }}</td>
            <td>
              @if (b.datePaiement) {
                <span class="badge-paye">{{ b.datePaiement }} — {{ b.modePaiement }}</span>
              } @else {
                <button mat-button class="prh-btn-xs" (click)="ouvrirPaiement(b)">Enregistrer paiement</button>
              }
            </td>
            <td class="prh-actions-cell">
              <button mat-icon-button matTooltip="Visualiser le bulletin" aria-label="Visualiser le bulletin" (click)="visualiserPdf(b)"><mat-icon>visibility</mat-icon></button>
              <button mat-icon-button matTooltip="Télécharger le PDF" aria-label="Télécharger le PDF" (click)="telechargerPdf(b)"><mat-icon>picture_as_pdf</mat-icon></button>
            </td>
          </tr>
        }
        @if (!bulletins().length) {
          <tr><td colspan="5" class="prh-empty-row">Aucun bulletin généré pour ce collaborateur.</td></tr>
        }
      </tbody>
    </table>
  </div>

  <!-- ═══ ACOMPTES ═══ -->
  <div class="prh-card">
    <div class="prh-card__header">
      <mat-icon>payments</mat-icon>
      <span>Acomptes</span>
    </div>
    <div class="prh-form-grid prh-form-grid--acompte">
      <mat-form-field appearance="outline" class="sm">
        <mat-label>Mois de déduction</mat-label>
        <mat-select [(ngModel)]="acompteMois">
          @for (m of moisOptions; track m.v) { <mat-option [value]="m.v">{{ m.l }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="sm">
        <mat-label>Année</mat-label>
        <input matInput type="number" [(ngModel)]="acompteAnnee" />
      </mat-form-field>
      <mat-form-field appearance="outline" class="sm">
        <mat-label>Montant</mat-label>
        <input matInput type="number" [(ngModel)]="acompteMontant" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Motif</mat-label>
        <input matInput [(ngModel)]="acompteMotif" />
      </mat-form-field>
      <button mat-flat-button color="primary" (click)="demanderAcompte()">
        <mat-icon>add</mat-icon> Demander
      </button>
    </div>
    <table class="prh-table">
      <thead><tr><th>Demandé le</th><th>Période</th><th>Montant</th><th>Statut</th><th></th></tr></thead>
      <tbody>
        @for (a of acomptes(); track a.id) {
          <tr>
            <td>{{ a.dateDemande | date:'dd/MM/yyyy' }}</td>
            <td>{{ MOIS_LABEL[a.periodeMois-1] }} {{ a.periodeAnnee }}</td>
            <td>{{ a.montant | number:'1.2-2' }} {{ symboleDevise() }}</td>
            <td><span class="badge-statut" [attr.data-statut]="a.statut">{{ a.statut }}</span></td>
            <td>
              @if (a.statut === 'DEMANDE') {
                <button mat-button class="prh-btn-xs" (click)="validerAcompte(a)">Valider</button>
                <button mat-button class="prh-btn-xs" (click)="annulerAcompte(a)">Annuler</button>
              }
            </td>
          </tr>
        }
        @if (!acomptes().length) {
          <tr><td colspan="5" class="prh-empty-row">Aucun acompte.</td></tr>
        }
      </tbody>
    </table>
  </div>

  }
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
    .prh-form-grid--acompte { grid-template-columns: repeat(3, 1fr) 2fr auto; align-items: start; }
    .prh-form-grid--acompte mat-form-field.sm { max-width: none; }
    .prh-form-grid .span-2 { grid-column: span 2; }
    .prh-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    mat-form-field.sm { max-width: 140px; }
    .prh-periode-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .prh-apercu { background: #F8FAFC; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; }
    .prh-apercu--placeholder { border: 1px dashed #F59E0B; }
    .prh-warning {
      display: flex; align-items: center; gap: 8px; color: #B45309; font-size: 12px; margin-bottom: 10px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .prh-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .prh-table th { text-align: left; color: #94A3B8; font-size: 11px; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid #E2E8F0; }
    .prh-table td { padding: 8px; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
    .prh-empty-row { text-align: center; color: #94A3B8; padding: 16px !important; }
    .prh-actions-cell { text-align: right; }
    .badge-v, .badge-r { font-size: 10px; padding: 1px 6px; border-radius: 8px; margin-left: 6px; }
    .badge-v { background: #EDE9F8; color: #5B21B6; }
    .badge-r { background: #FEF3C7; color: #92400E; }
    .badge-paye { font-size: 11px; color: #059669; }
    .prh-btn-xs { font-size: 11px; min-width: 0; padding: 0 8px; }
    .badge-statut { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: #F1F5F9; color: #64748B; }
    .badge-statut[data-statut="VALIDE"] { background: #DBEAFE; color: #1D4ED8; }
    .badge-statut[data-statut="DEDUIT"] { background: #DCFCE7; color: #15803D; }
    .badge-statut[data-statut="ANNULE"] { background: #FEE2E2; color: #B91C1C; }
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
  private dialog = inject(MatDialog);

  readonly MOIS_LABEL = MOIS_LABEL;
  readonly typesContrat: TypeContratTravail[] = ['CDI', 'CDD', 'APPRENTISSAGE', 'STAGE', 'INTERIM', 'AUTRE'];
  readonly moisOptions = MOIS_LABEL.map((l, i) => ({ v: i + 1, l }));

  loading = signal(true);
  contrat = signal<ContratTravail | null>(null);
  bulletins = signal<BulletinSalarie[]>([]);
  acomptes = signal<AcompteSalarie[]>([]);
  apercu = signal<ResultatCalculPaieRh | null>(null);

  editingContrat = signal(false);
  formTypeContrat: TypeContratTravail = 'CDI';
  formDateDebut = new Date().toISOString().split('T')[0];
  formQuotite = 100;
  formSalaireBase = 0;
  formRegime = '';
  formMotif = '';

  today = new Date();
  selMois = this.today.getMonth() + 1;
  selAnnee = this.today.getFullYear();

  acompteMois = this.today.getMonth() + 1;
  acompteAnnee = this.today.getFullYear();
  acompteMontant = 0;
  acompteMotif = '';

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.paieRh.findContratActif(this.userId).subscribe({
      next: (c) => {
        this.contrat.set(c);
        this.loading.set(false);
        if (c) this.loadBulletinsEtAcomptes();
      },
      error: () => this.loading.set(false),
    });
  }

  private loadBulletinsEtAcomptes() {
    this.paieRh.findBulletinsBySalarie(this.userId).subscribe((b) => this.bulletins.set(b));
    this.paieRh.findAcomptes(this.userId).subscribe((a) => this.acomptes.set(a));
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
          this.loadBulletinsEtAcomptes();
          this.snack.open('Contrat créé', undefined, { duration: 2500 });
        },
        error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
      });
    }
  }

  rubriquesPlaceholder = signal(false);

  hasPlaceholder(): boolean {
    return this.rubriquesPlaceholder();
  }

  calculerApercu() {
    this.paieRh.calculerBulletin(this.userId, this.selMois, this.selAnnee).subscribe({
      next: (r) => this.apercu.set(r),
      error: (e) => this.snack.open(e?.error?.message || 'Erreur de calcul', undefined, { duration: 3000 }),
    });
    // Vérifie si le régime de ce contrat repose sur des rubriques/paramètres EXEMPLE
    // (placeholder) — affiché en avertissement à côté de l'aperçu du calcul.
    const c = this.contrat();
    if (c) {
      this.paieRh.findRubriques(c.regimePaieCode).subscribe((rubriques) => {
        this.rubriquesPlaceholder.set(rubriques.some((r) => r.estPlaceholder));
      });
    }
  }

  genererBulletin() {
    this.paieRh.genererBulletin(this.userId, this.selMois, this.selAnnee).subscribe({
      next: () => {
        this.snack.open('Bulletin généré', undefined, { duration: 2500 });
        this.loadBulletinsEtAcomptes();
        this.apercu.set(null);
      },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur de génération', undefined, { duration: 3000 }),
    });
  }

  ouvrirBulletinDetaille() {
    const ref = this.dialog.open(BulletinSalarieDialogComponent, {
      panelClass: ['rounded-dialog', 'no-pad-dialog'],
      width: '1300px', maxWidth: '96vw', height: '92vh', maxHeight: '92vh',
      data: { salarieId: this.userId, mois: this.selMois, annee: this.selAnnee },
    });
    ref.afterClosed().subscribe((result) => {
      if (result?.changed) { this.loadBulletinsEtAcomptes(); this.apercu.set(null); }
    });
  }

  telechargerPdf(b: BulletinSalarie) {
    this.paieRh.telechargerBulletinPdf(b.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `bulletin-salaire-${b.annee}-${String(b.mois).padStart(2, '0')}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  visualiserPdf(b: BulletinSalarie) {
    this.paieRh.telechargerBulletinPdf(b.id).subscribe((blob) => {
      this.dialog.open(BulletinPdfPreviewDialogComponent, {
        panelClass: ['rounded-dialog', 'no-pad-dialog'],
        width: '900px', maxWidth: '96vw', height: '90vh', maxHeight: '90vh',
        data: { blob, titre: `Bulletin — ${this.MOIS_LABEL[b.mois - 1]} ${b.annee}` },
      });
    });
  }

  ouvrirPaiement(b: BulletinSalarie) {
    const date = prompt('Date de paiement (AAAA-MM-JJ) :', new Date().toISOString().split('T')[0]);
    if (!date) return;
    const mode = prompt('Mode de paiement (VIREMENT / ESPECES / CHEQUE) :', 'VIREMENT');
    if (!mode) return;
    this.paieRh.enregistrerPaiement(b.id, { datePaiement: date, modePaiement: mode }).subscribe({
      next: () => { this.snack.open('Paiement enregistré', undefined, { duration: 2500 }); this.loadBulletinsEtAcomptes(); },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
    });
  }

  demanderAcompte() {
    if (!this.acompteMontant || this.acompteMontant <= 0) {
      this.snack.open('Montant invalide', undefined, { duration: 2500 });
      return;
    }
    this.paieRh.createAcompte({
      salarieId: this.userId,
      periodeMois: this.acompteMois,
      periodeAnnee: this.acompteAnnee,
      montant: this.acompteMontant,
      motif: this.acompteMotif || undefined,
    }).subscribe({
      next: () => {
        this.snack.open('Acompte enregistré', undefined, { duration: 2500 });
        this.acompteMontant = 0; this.acompteMotif = '';
        this.loadBulletinsEtAcomptes();
      },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
    });
  }

  validerAcompte(a: AcompteSalarie) {
    this.paieRh.validerAcompte(a.id).subscribe({
      next: () => { this.snack.open('Acompte validé', undefined, { duration: 2500 }); this.loadBulletinsEtAcomptes(); },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
    });
  }

  annulerAcompte(a: AcompteSalarie) {
    this.paieRh.annulerAcompte(a.id).subscribe({
      next: () => { this.snack.open('Acompte annulé', undefined, { duration: 2500 }); this.loadBulletinsEtAcomptes(); },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
    });
  }
}
