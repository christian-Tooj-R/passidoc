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

  <div class="rhx-page-head">
    <div class="rhx-page-head__main">
      <div class="rhx-page-head__icon"><mat-icon>assignment</mat-icon></div>
      <div>
        <h1>Activité</h1>
        <p class="rhx-page-head__sub">Heures sup, absences, primes, avantages et retenues du mois, salarié par salarié.</p>
      </div>
    </div>
    <div class="rhx-page-head__actions">
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

  <div class="rhx-kpis">
    <div class="rhx-kpi">
      <div class="rhx-kpi__icon"><mat-icon>groups</mat-icon></div>
      <div class="rhx-kpi__body">
        <div class="rhx-kpi__label">Salariés en contrat</div>
        <div class="rhx-kpi__value">{{ lignes().length }}</div>
        <div class="rhx-kpi__sub">sur la période</div>
      </div>
    </div>
    <div class="rhx-kpi rhx-kpi--blue">
      <div class="rhx-kpi__icon"><mat-icon>schedule</mat-icon></div>
      <div class="rhx-kpi__body">
        <div class="rhx-kpi__label">Heures sup</div>
        <div class="rhx-kpi__value">{{ totalHeuresSup() | number:'1.0-2' }} <small>h</small></div>
        <div class="rhx-kpi__sub">cumul du mois</div>
      </div>
    </div>
    <div class="rhx-kpi rhx-kpi--amber">
      <div class="rhx-kpi__icon"><mat-icon>event_busy</mat-icon></div>
      <div class="rhx-kpi__body">
        <div class="rhx-kpi__label">Absences</div>
        @if (deviseCommune()) {
          <div class="rhx-kpi__value">{{ totalAbsences() | number:'1.2-2' }} <small>{{ deviseCommune() }}</small></div>
          <div class="rhx-kpi__sub">{{ nbAbsencesAuto() }} ligne(s) synchronisée(s) des congés</div>
        } @else {
          <div class="rhx-kpi__value">{{ nbAbsencesAuto() }} <small>ligne(s)</small></div>
          <div class="rhx-kpi__sub">devises mélangées — pas de total</div>
        }
      </div>
    </div>
    <div class="rhx-kpi rhx-kpi--rose">
      <div class="rhx-kpi__icon"><mat-icon>edit_off</mat-icon></div>
      <div class="rhx-kpi__body">
        <div class="rhx-kpi__label">Sans saisie</div>
        <div class="rhx-kpi__value">{{ nbSansSaisie() }}</div>
        <div class="rhx-kpi__sub">aucune variable ce mois</div>
      </div>
    </div>
  </div>

  <div class="rhx-card">
    <div class="rhx-card__head">
      <div class="rhx-card__title"><mat-icon>badge</mat-icon> Salariés de la période</div>
      <div class="rhx-card__spacer"></div>
      <button mat-stroked-button (click)="recalculer()"><mat-icon>sync</mat-icon> Recalculer les activités du mois</button>
    </div>

    <table class="ar-table rhx-table">
      <thead>
        <tr><th>Salarié</th><th>Statut</th><th class="num">Heures sup</th><th class="num">Absences</th><th class="num">Primes</th><th class="num">Avantages</th><th class="num">Retenues</th><th></th></tr>
      </thead>
      <tbody>
        @for (l of lignes(); track l.salarieId) {
          <tr>
            <td [routerLink]="['/rh/salaries', l.salarieId]" class="ar-link">
              <div class="rhx-person">
                <span class="rhx-avatar" [class]="'rhx-avatar ' + avatarClasse(l.salarieId)">{{ initiales(l) }}</span>
                <div>
                  <div class="rhx-person__name">{{ l.salarie ? l.salarie.firstName + ' ' + l.salarie.lastName : ('#' + l.salarieId) }}</div>
                  <div class="rhx-person__meta">Montants en {{ symboleDevise(l) }}</div>
                </div>
              </div>
            </td>
            <td><span class="rhx-chip badge-statut" [class]="'rhx-chip badge-statut ' + statutChipClasse(l.statut)" [attr.data-statut]="l.statut ?? 'AUCUNE'">{{ statutLabel(l.statut) }}</span></td>
            <td class="num">{{ l.heuresSupplementaires | number:'1.0-2' }} h</td>
            <td class="num">{{ l.totalAbsences | number:'1.2-2' }} @if (l.nbAbsencesAuto) { <span class="rhx-chip rhx-chip--violet rhx-chip--nodot ar-tag" matTooltip="Lignes synchronisées automatiquement depuis les congés validés">{{ l.nbAbsencesAuto }} auto</span> }</td>
            <td class="num">{{ l.totalPrimes | number:'1.2-2' }}</td>
            <td class="num">{{ l.totalAvantagesNature | number:'1.2-2' }}</td>
            <td class="num">{{ l.totalRetenues | number:'1.2-2' }}</td>
            <td class="actions ar-actions-cell">
              <button mat-icon-button matTooltip="Feuille d'activité journalière" aria-label="Feuille d'activité journalière" (click)="voirFeuilleJournaliere(l)"><mat-icon>calendar_view_week</mat-icon></button>
              <button mat-icon-button matTooltip="Variables mensuelles (bulletin)" aria-label="Variables mensuelles (bulletin)" (click)="voirFeuille(l)"><mat-icon>assignment</mat-icon></button>
            </td>
          </tr>
        }
        @if (!lignes().length) {
          <tr><td colspan="8" class="ar-empty-row">
            <div class="rhx-empty"><mat-icon>person_off</mat-icon><div class="rhx-empty__title">Aucun salarié en contrat sur cette période</div><div class="rhx-empty__hint">Changez de mois ou créez un contrat depuis la fiche d'un salarié.</div></div>
          </td></tr>
        }
      </tbody>
    </table>
  </div>

</div>
  `,
  styles: [`
    .ar-wrap { padding: 24px 28px 48px; max-width: 1400px; margin: 0 auto; }
    mat-form-field.sm { max-width: 140px; }
    .ar-link { cursor: pointer; }
    .ar-link:hover .rhx-person__name { color: #7C3AED; }
    .ar-tag { margin-left: 6px; }
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

  initiales(l: ActivitePeriodeRh): string {
    return l.salarie ? `${l.salarie.firstName?.[0] ?? ''}${l.salarie.lastName?.[0] ?? ''}`.toUpperCase() : '#';
  }

  avatarClasse(id: number): string { return `rhx-avatar--h${id % 6}`; }

  statutChipClasse(s: ActivitePeriodeRh['statut']): string {
    if (s === 'VALIDEE') return 'rhx-chip--teal';
    if (s === 'BULLETIN_GENERE') return 'rhx-chip--blue';
    if (s === 'BROUILLON') return 'rhx-chip--amber';
    return 'rhx-chip--muted';
  }

  /** Symbole commun si tous les salariés partagent la même devise, sinon '' (pas de total mélangé). */
  deviseCommune(): string {
    const devises = new Set(this.lignes().map((l) => l.salarie?.devise ?? 'EUR'));
    return devises.size === 1 ? deviseSymbole([...devises][0]) : '';
  }

  totalHeuresSup(): number { return this.lignes().reduce((t, l) => t + (l.heuresSupplementaires || 0), 0); }
  totalAbsences(): number { return this.lignes().reduce((t, l) => t + (l.totalAbsences || 0), 0); }
  nbAbsencesAuto(): number { return this.lignes().reduce((t, l) => t + (l.nbAbsencesAuto || 0), 0); }
  nbSansSaisie(): number { return this.lignes().filter((l) => !l.statut).length; }

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
