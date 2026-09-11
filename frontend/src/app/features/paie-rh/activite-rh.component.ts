import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PaieRhService, ActivitePeriodeRh, deviseSymbole } from '../../core/services/paie-rh.service';
import { BulletinSalarieDialogComponent } from './bulletin-salarie-dialog/bulletin-salarie-dialog.component';
import { FeuilleActiviteRhDialogComponent } from './feuille-activite-rh-dialog.component';

const MOIS_LABEL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/**
 * "Activité" (~"Feuille d'activité" / "Calcul d'activité" RADIAN) : vue globale, pour tous
 * les salariés en contrat sur la période, du résumé des variables de paie déjà saisies/
 * synchronisées (heures sup, absences valorisées, primes, avantages, retenues) — sans
 * attendre la génération d'un bulletin. Le détail par salarié ("Feuille d'activité"
 * individuelle) réutilise le dialogue "Bulletin du salarié" déjà existant (onglets
 * Variables/Congés-absences), ouvrable directement depuis cette liste. Accessible depuis
 * /rh/activite.
 */
@Component({
  selector: 'app-activite-rh',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSnackBarModule,
    MatDialogModule, MatTooltipModule,
  ],
  template: `
<div class="ar-wrap">

  <div class="ar-header">
    <div class="ar-header-main">
      <div class="ar-header-icon"><mat-icon>assignment</mat-icon></div>
      <div>
        <h1>Activité</h1>
        <p class="ar-sub">Heures sup, absences, primes, avantages et retenues du mois, salarié par salarié.</p>
      </div>
    </div>
    <div class="ar-periode">
      <mat-form-field appearance="outline" class="sm">
        <mat-label>Mois</mat-label>
        <mat-select [(ngModel)]="mois" (ngModelChange)="reload()">
          @for (m of moisOptions; track m.v) { <mat-option [value]="m.v">{{ m.l }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="sm">
        <mat-label>Année</mat-label>
        <input matInput type="number" [(ngModel)]="annee" (ngModelChange)="reload()" />
      </mat-form-field>
    </div>
  </div>

  <div class="ar-card">
    <div class="ar-toolbar">
      <span class="ar-stat">{{ lignes().length }} salarié(s) en contrat sur la période</span>
      <div class="ar-spacer"></div>
      <button mat-stroked-button (click)="recalculer()"><mat-icon>sync</mat-icon> Recalculer les activités du mois</button>
    </div>

    <table class="ar-table">
      <thead>
        <tr><th>Salarié</th><th>Statut</th><th>Heures sup</th><th>Absences</th><th>Primes</th><th>Avantages</th><th>Retenues</th><th></th></tr>
      </thead>
      <tbody>
        @for (l of lignes(); track l.salarieId) {
          <tr>
            <td [routerLink]="['/rh/salaries', l.salarieId]" class="ar-link">{{ l.salarie ? l.salarie.firstName + ' ' + l.salarie.lastName : ('#' + l.salarieId) }}</td>
            <td><span class="badge-statut" [attr.data-statut]="l.statut ?? 'AUCUNE'">{{ statutLabel(l.statut) }}</span></td>
            <td>{{ l.heuresSupplementaires }} h</td>
            <td>{{ l.totalAbsences | number:'1.2-2' }} {{ symboleDevise(l) }} @if (l.nbAbsencesAuto) { <span class="ar-tag" matTooltip="Lignes synchronisées automatiquement depuis les congés validés">{{ l.nbAbsencesAuto }} auto</span> }</td>
            <td>{{ l.totalPrimes | number:'1.2-2' }} {{ symboleDevise(l) }}</td>
            <td>{{ l.totalAvantagesNature | number:'1.2-2' }} {{ symboleDevise(l) }}</td>
            <td>{{ l.totalRetenues | number:'1.2-2' }} {{ symboleDevise(l) }}</td>
            <td class="ar-actions-cell">
              <button mat-icon-button matTooltip="Feuille d'activité journalière" aria-label="Feuille d'activité journalière" (click)="voirFeuilleJournaliere(l)"><mat-icon>calendar_view_week</mat-icon></button>
              <button mat-icon-button matTooltip="Variables mensuelles (bulletin)" aria-label="Variables mensuelles (bulletin)" (click)="voirFeuille(l)"><mat-icon>assignment</mat-icon></button>
            </td>
          </tr>
        }
        @if (!lignes().length) {
          <tr><td colspan="8" class="ar-empty-row">Aucun salarié en contrat sur cette période.</td></tr>
        }
      </tbody>
    </table>
  </div>

</div>
  `,
  styles: [`
    .ar-wrap { padding: 24px 28px 48px; max-width: 1400px; margin: 0 auto; }
    .ar-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 18px; flex-wrap: wrap; }
    .ar-header-main { display: flex; align-items: center; gap: 12px; }
    .ar-header-icon { width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #7C3AED, #6D28D9);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 3px 10px rgba(109,40,217,.25);
      mat-icon { color: #fff; font-size: 22px; width: 22px; height: 22px; } }
    .ar-header h1 { font-size: 20px; font-weight: 700; color: #1E293B; margin: 0 0 4px; }
    .ar-sub { font-size: 12px; color: #94A3B8; margin: 0; max-width: 560px; }
    .ar-periode { display: flex; gap: 10px; }
    mat-form-field.sm { max-width: 140px; }
    .ar-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; }
    .ar-toolbar { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
    .ar-spacer { flex: 1; }
    .ar-stat { font-size: 12px; color: #64748B; }
    .ar-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .ar-table th { text-align: left; color: #94A3B8; font-size: 11px; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid #E2E8F0; }
    .ar-table td { padding: 8px; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
    .ar-link { cursor: pointer; }
    .ar-link:hover { color: #7C3AED; }
    .ar-actions-cell { text-align: right; }
    .ar-empty-row { text-align: center; color: #94A3B8; padding: 16px !important; }
    .ar-tag { font-size: 10px; background: #EDE9F8; color: #6D28D9; padding: 1px 6px; border-radius: 8px; margin-left: 6px; }
    .badge-statut { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: #F1F5F9; color: #64748B; }
    .badge-statut[data-statut="VALIDEE"] { background: #D1FAE5; color: #047857; }
    .badge-statut[data-statut="BULLETIN_GENERE"] { background: #DBEAFE; color: #1D4ED8; }
    .badge-statut[data-statut="AUCUNE"] { background: #FEF3C7; color: #92400E; }
  `],
})
export class ActiviteRhComponent implements OnInit {
  private paieRh = inject(PaieRhService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  readonly moisOptions = MOIS_LABEL.map((l, i) => ({ v: i + 1, l }));

  today = new Date();
  mois = this.today.getMonth() + 1;
  annee = this.today.getFullYear();

  lignes = signal<ActivitePeriodeRh[]>([]);

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.paieRh.findActivitePeriode(this.mois, this.annee).subscribe((l) => this.lignes.set(l));
  }

  symboleDevise(l: ActivitePeriodeRh): string {
    return deviseSymbole(l.salarie?.devise);
  }

  statutLabel(s: ActivitePeriodeRh['statut']): string {
    if (s === 'VALIDEE') return 'Validée';
    if (s === 'BULLETIN_GENERE') return 'Bulletin généré';
    if (s === 'BROUILLON') return 'Brouillon';
    return 'Aucune saisie';
  }

  recalculer() {
    this.paieRh.recalculerActivitePeriode(this.mois, this.annee).subscribe({
      next: (res) => {
        this.snack.open(`${res.traites} salarié(s) recalculé(s)${res.erreurs.length ? `, ${res.erreurs.length} erreur(s)` : ''}`, undefined, { duration: 3500 });
        this.reload();
      },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3500 }),
    });
  }

  voirFeuille(l: ActivitePeriodeRh) {
    const ref = this.dialog.open(BulletinSalarieDialogComponent, {
      panelClass: ['rounded-dialog', 'no-pad-dialog'],
      width: '1300px', maxWidth: '96vw', height: '92vh', maxHeight: '92vh',
      data: { salarieId: l.salarieId, mois: this.mois, annee: this.annee },
    });
    ref.afterClosed().subscribe((result) => {
      if (result?.changed) this.reload();
    });
  }

  voirFeuilleJournaliere(l: ActivitePeriodeRh) {
    this.dialog.open(FeuilleActiviteRhDialogComponent, {
      panelClass: ['rounded-dialog', 'no-pad-dialog'],
      width: '1100px', maxWidth: '96vw', height: '85vh', maxHeight: '85vh',
      data: {
        salarieId: l.salarieId,
        salarieNom: l.salarie ? `${l.salarie.firstName} ${l.salarie.lastName}` : undefined,
        mois: this.mois, annee: this.annee,
      },
    });
  }
}
