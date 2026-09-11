import { Component, Inject, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  PaieRhService, ContratTravail, VariablePaieRh, ResultatCalculPaieRh, CumulAnnuelPaieRh,
  RubriquePaieRh, SalarieATraiter, LignePaieLibreRh, SurchargeRubriquePaieRh, LigneBulletinRh,
  PartRubriqueRh, ChampCalculRubriqueRh, TYPE_CONTRAT_LABELS, TypeContratTravail, deviseSymbole,
} from '../../../core/services/paie-rh.service';
import {
  CongesAbsencesService, CongeAbsence, TYPE_CONGE_LABELS, TYPE_CONGE_COLORS,
} from '../../../core/services/conges-absences.service';
import { BulletinPdfPreviewDialogComponent } from '../bulletin-pdf-preview-dialog.component';
import { SalariesService } from '../../salaries/salaries.service';

const MOIS_LABEL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const STATUT_CONGE_LABELS: Record<string, string> = {
  EN_ATTENTE: 'En attente', APPROUVEE: 'Approuvée', REFUSEE: 'Refusée', ANNULEE: 'Annulée',
};

export interface BulletinSalarieDialogData {
  salarieId: number;
  mois: number;
  annee: number;
}

export interface BulletinSalarieDialogResult {
  changed: boolean;
}

type DialogTab = 'rubriques' | 'conges' | 'heures' | 'variables' | 'base' | 'bulletin';

/**
 * Dialogue "Bulletin du salarié" (~Sage 100 Paie & RH, analyse vidéo — voir
 * Doc/MODULE_PAIE_RH_NOTES.md, section dédiée) : écran complet à 6 onglets pour saisir/
 * consulter tout ce qui concerne le bulletin d'UN salarié pour UNE période, avec recalcul
 * en direct, cumul annuel, et navigation Précédent/Suivant dans le cycle mensuel — sans
 * fermer le dialogue. Adapté à notre modèle de données existant (VariablePaieRh,
 * RubriquePaieRh, CongeAbsence, ContratTravail) plutôt qu'un clone de Sage — voir les
 * notes de simplification dans Doc/MODULE_PAIE_RH_NOTES.md.
 *
 * Ouvrable depuis l'onglet "Cycle mensuel" du hub `/rh/paie` (une ligne = un salarié) et
 * depuis l'onglet "Contrat & Paie" de la fiche salarié individuelle.
 */
@Component({
  selector: 'app-bulletin-salarie-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule, MatSnackBarModule,
  ],
  template: `
<div class="bsd-wrap">

  <!-- ═══ EN-TÊTE ═══ -->
  <div class="bsd-header">
    <div class="bsd-header-main">
      <mat-icon class="bsd-header-icon">receipt_long</mat-icon>
      <div>
        <h2>Bulletin du salarié — {{ salarieNom() }}</h2>
        <p class="bsd-sub">{{ MOIS_LABEL[mois()-1] }} {{ annee() }} @if (dirty()) { <span class="bsd-dirty">· modifications non enregistrées</span> }</p>
      </div>
    </div>
    <div class="bsd-header-periode">
      <mat-form-field appearance="outline" class="sm">
        <mat-label>Mois</mat-label>
        <mat-select [ngModel]="mois()" (ngModelChange)="onPeriodeChange($event, annee())">
          @for (m of moisOptions; track m.v) { <mat-option [value]="m.v">{{ m.l }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="sm">
        <mat-label>Année</mat-label>
        <input matInput type="number" [ngModel]="annee()" (ngModelChange)="onPeriodeChange(mois(), $event)" />
      </mat-form-field>
    </div>
    <button mat-icon-button class="bsd-close" matTooltip="Fermer" aria-label="Fermer le dialogue" (click)="fermer()">
      <mat-icon>close</mat-icon>
    </button>
  </div>

  <!-- ═══ ONGLETS ═══ -->
  <div class="bsd-tabs">
    <button class="bsd-tab" [class.active]="tab()==='rubriques'" (click)="setTab('rubriques')"><mat-icon>list_alt</mat-icon>Rubriques</button>
    <button class="bsd-tab" [class.active]="tab()==='conges'" (click)="setTab('conges')"><mat-icon>event_busy</mat-icon>Congés/absences</button>
    <button class="bsd-tab" [class.active]="tab()==='heures'" (click)="setTab('heures')"><mat-icon>schedule</mat-icon>Heures de travail/HS</button>
    <button class="bsd-tab" [class.active]="tab()==='variables'" (click)="setTab('variables')"><mat-icon>tune</mat-icon>Autres variables</button>
    <button class="bsd-tab" [class.active]="tab()==='base'" (click)="setTab('base')"><mat-icon>description</mat-icon>Valeurs de base</button>
    <button class="bsd-tab" [class.active]="tab()==='bulletin'" (click)="setTab('bulletin')"><mat-icon>fact_check</mat-icon>Bulletin calculé</button>
  </div>

  <!-- ═══ CONTENU (scroll interne) ═══ -->
  <div class="bsd-content">

    @if (loading()) {
      <div class="bsd-loading"><div class="spinner"></div><span>Chargement…</span></div>
    }

    @if (!contrat() && !loading()) {
      <div class="bsd-empty">
        <mat-icon>warning</mat-icon>
        <p>Aucun contrat de travail actif pour ce collaborateur sur cette période — impossible de calculer un bulletin.</p>
      </div>
    }

    @if (contrat() && !loading()) {

    <!-- ═══ ONGLET RUBRIQUES ═══ -->
    @if (tab() === 'rubriques') {
    <div class="bsd-card">
      <p class="bsd-hint">
        Rubriques applicables au régime <strong>{{ contrat()!.regimePaieCode }}</strong>. Les lignes marquées
        <span class="badge-s">S</span> autorisent une saisie exceptionnelle pour CE bulletin uniquement
        (sans changer le paramétrage général de la rubrique).
      </p>
      <table class="bsd-table">
        <thead>
          <tr><th>Code</th><th>Rubrique</th><th class="num">Nombre</th><th class="num">Base</th><th class="num">Taux sal.</th><th class="num">Montant salarial</th><th class="num">Taux pat.</th><th class="num">Montant patronal</th><th></th></tr>
        </thead>
        <tbody>
          @for (r of rubriquesActives(); track r.id) {
            @let ligne = ligneCalculee(r.code);
            <tr>
              <td class="mono">{{ r.code }}</td>
              <td>{{ r.libelle }} @if (aSurcharge(r.code, 'SALARIALE') || aSurcharge(r.code, 'PATRONALE')) { <span class="badge-ov">Surchargé ce mois</span> }</td>
              <td class="num">{{ ligne?.nombreSalarial != null ? (ligne!.nombreSalarial | number:'1.0-2') : '-' }}</td>
              <td class="num">{{ ligne ? (ligne.base | number:'1.2-2') + ' ' + symboleDevise() : '-' }}</td>
              <td class="num">{{ ligne?.tauxSalarial != null ? (ligne!.tauxSalarial + ' %') : '-' }}</td>
              <td class="num">{{ ligne ? (ligne.montantSalarial | number:'1.2-2') + ' ' + symboleDevise() : '-' }}</td>
              <td class="num">{{ ligne?.tauxPatronal != null ? (ligne!.tauxPatronal + ' %') : '-' }}</td>
              <td class="num">{{ ligne && r.imputation === 'COTISATION' ? (ligne.montantPatronal | number:'1.2-2') + ' ' + symboleDevise() : '-' }}</td>
              <td class="bsd-actions-cell">
                @if (r.elementSalarial?.saisieAutorisee) {
                  <button mat-icon-button class="bsd-btn-xxs" matTooltip="Surcharger la part salariale ce mois-ci" [attr.aria-label]="'Surcharger la part salariale de ' + r.libelle + ' ce mois-ci'" (click)="ouvrirSurcharge(r, 'SALARIALE')">
                    <mat-icon>edit_note</mat-icon>
                  </button>
                }
                @if (r.imputation === 'COTISATION' && r.elementPatronal?.saisieAutorisee) {
                  <button mat-icon-button class="bsd-btn-xxs" matTooltip="Surcharger la part patronale ce mois-ci" [attr.aria-label]="'Surcharger la part patronale de ' + r.libelle + ' ce mois-ci'" (click)="ouvrirSurcharge(r, 'PATRONALE')">
                    <mat-icon>edit_note</mat-icon>
                  </button>
                }
              </td>
            </tr>
            @if (overrideOpenKey() === (r.code + '|SALARIALE') || overrideOpenKey() === (r.code + '|PATRONALE')) {
              <tr class="bsd-override-row">
                <td colspan="9">
                  <div class="bsd-override-box">
                    <span class="bsd-override-title">Surcharge ponctuelle — {{ r.libelle }} ({{ overrideOpenKey()?.endsWith('SALARIALE') ? 'part salariale' : 'part patronale' }}), {{ MOIS_LABEL[mois()-1] }} {{ annee() }} uniquement</span>
                    <div class="bsd-override-fields">
                      <mat-form-field appearance="outline" class="sm"><mat-label>Nombre</mat-label><input matInput type="number" [(ngModel)]="overrideDraft.nombre" /></mat-form-field>
                      <mat-form-field appearance="outline" class="sm"><mat-label>Base</mat-label><input matInput type="number" [(ngModel)]="overrideDraft.base" /></mat-form-field>
                      <mat-form-field appearance="outline" class="sm"><mat-label>Taux (%)</mat-label><input matInput type="number" [(ngModel)]="overrideDraft.taux" /></mat-form-field>
                    </div>
                    <div class="bsd-override-actions">
                      <button mat-button (click)="fermerSurcharge()">Annuler</button>
                      <button mat-button color="warn" (click)="reinitialiserSurcharge(r.code, overrideOpenKeyPart())">Réinitialiser</button>
                      <button mat-flat-button color="primary" (click)="appliquerSurcharge(r.code, overrideOpenKeyPart())">Appliquer et recalculer</button>
                    </div>
                  </div>
                </td>
              </tr>
            }
          }
          @if (!rubriquesActives().length) {
            <tr><td colspan="9" class="bsd-empty-row">Aucune rubrique active pour ce régime.</td></tr>
          }
        </tbody>
      </table>
    </div>
    }

    <!-- ═══ ONGLET CONGÉS/ABSENCES ═══ -->
    @if (tab() === 'conges') {
    <div class="bsd-card">
      <div class="bsd-card__header">
        <mat-icon>event_busy</mat-icon><span>Congés/absences de la période</span>
        <button mat-stroked-button class="bsd-btn-sm" (click)="resynchroniserAbsences()">
          <mat-icon>sync</mat-icon> Resynchroniser depuis les congés validés
        </button>
      </div>
      <table class="bsd-table">
        <thead><tr><th>Type</th><th>Début</th><th>Fin</th><th class="num">Jours</th><th>Statut</th><th>Motif</th></tr></thead>
        <tbody>
          @for (c of congesPeriode(); track c.id) {
            <tr>
              <td><span class="dot" [style.background]="TYPE_CONGE_COLORS[c.typeConge]"></span>{{ TYPE_CONGE_LABELS[c.typeConge] }}</td>
              <td>{{ c.dateDebut }}</td>
              <td>{{ c.dateFin }}</td>
              <td class="num">{{ c.nombreJours }}</td>
              <td>{{ STATUT_CONGE_LABELS[c.statut] }}</td>
              <td>{{ c.motif || '—' }}</td>
            </tr>
          }
          @if (!congesPeriode().length) {
            <tr><td colspan="6" class="bsd-empty-row">Aucune demande de congé sur cette période.</td></tr>
          }
        </tbody>
      </table>

      <div class="bsd-section-title">Déductions synchronisées (calculées automatiquement)</div>
      <table class="bsd-table">
        <thead><tr><th>Libellé</th><th class="num">Montant</th></tr></thead>
        <tbody>
          @for (l of absencesAuto(); track $index) {
            <tr><td>{{ l.libelle }}</td><td class="num">-{{ l.montant | number:'1.2-2' }} {{ symboleDevise() }}</td></tr>
          }
          @if (!absencesAuto().length) {
            <tr><td colspan="2" class="bsd-empty-row">Aucune.</td></tr>
          }
        </tbody>
      </table>

      <div class="bsd-section-title">Absences saisies manuellement (hors circuit congés)</div>
      <ng-container *ngTemplateOutlet="lignesEditables; context: { lignes: fAbsencesManuelles, ajouter: ajouterAbsenceManuelle, supprimer: supprimerAbsenceManuelle }" />
    </div>
    }

    <!-- ═══ ONGLET HEURES DE TRAVAIL/HS ═══ -->
    @if (tab() === 'heures') {
    <div class="bsd-card">
      <p class="bsd-hint">
        Notre modèle agrège les heures supplémentaires du mois en un seul volume horaire
        (pas de grille par code d'heure comme "HS JOUR 130%" — simplification assumée, voir
        Doc/MODULE_PAIE_RH_NOTES.md) ; le taux de majoration par défaut vient des paramètres
        du régime et peut être surchargé ici pour ce salarié/mois.
      </p>
      <div class="bsd-form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Heures supplémentaires (h)</mat-label>
          <input matInput type="number" [(ngModel)]="fHeuresSup" (ngModelChange)="dirty.set(true)" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Taux de majoration (%, optionnel — sinon défaut du régime)</mat-label>
          <input matInput type="number" [(ngModel)]="fTauxMajoration" (ngModelChange)="dirty.set(true)" />
        </mat-form-field>
        <div class="field">
          <span class="f-label">Montant calculé (dernier recalcul)</span>
          <span class="f-val f-strong">{{ (apercu()?.detailBrut?.montantHeuresSupplementaires ?? 0) | number:'1.2-2' }} {{ symboleDevise() }}</span>
        </div>
      </div>
    </div>
    }

    <!-- ═══ ONGLET AUTRES VARIABLES ═══ -->
    @if (tab() === 'variables') {
    <div class="bsd-card">
      <div class="bsd-section-title">Primes</div>
      <ng-container *ngTemplateOutlet="lignesEditables; context: { lignes: fPrimes, ajouter: ajouterPrime, supprimer: supprimerPrime }" />

      <div class="bsd-section-title">Avantages en nature</div>
      <ng-container *ngTemplateOutlet="lignesEditables; context: { lignes: fAvantagesNature, ajouter: ajouterAvantage, supprimer: supprimerAvantage }" />

      <div class="bsd-section-title">Retenues diverses (saisies)</div>
      <ng-container *ngTemplateOutlet="lignesEditables; context: { lignes: fRetenuesManuelles, ajouter: ajouterRetenue, supprimer: supprimerRetenue }" />

      @if (retenuesAuto().length) {
        <div class="bsd-section-title">Retenues synchronisées (acomptes)</div>
        <table class="bsd-table">
          <thead><tr><th>Libellé</th><th class="num">Montant</th></tr></thead>
          <tbody>
            @for (l of retenuesAuto(); track $index) {
              <tr><td>{{ l.libelle }}</td><td class="num">-{{ l.montant | number:'1.2-2' }} {{ symboleDevise() }}</td></tr>
            }
          </tbody>
        </table>
      }
    </div>
    }

    <!-- ═══ ONGLET VALEURS DE BASE ═══ -->
    @if (tab() === 'base') {
    <div class="bsd-card">
      <p class="bsd-hint">Valeurs issues du contrat de travail — lecture seule ici (modifiables depuis l'onglet "Contrat & Paie" de la fiche salarié).</p>
      <div class="field-grid">
        <div class="field"><span class="f-label">Type de contrat</span><span class="f-val">{{ typeContratLabel(contrat()!.typeContrat) }}</span></div>
        <div class="field"><span class="f-label">Date de début</span><span class="f-val">{{ contrat()!.dateDebut }}</span></div>
        <div class="field"><span class="f-label">Date de fin</span><span class="f-val">{{ contrat()!.dateFin || 'Indéterminée' }}</span></div>
        <div class="field"><span class="f-label">Quotité de travail</span><span class="f-val">{{ contrat()!.quotiteTravail }}%</span></div>
        <div class="field"><span class="f-label">Salaire de base mensuel</span><span class="f-val">{{ contrat()!.salaireBase | number:'1.2-2' }} {{ symboleDevise() }}</span></div>
        <div class="field"><span class="f-label">Régime de paie (pôle)</span><span class="f-val">{{ contrat()!.regimePaieCode }}</span></div>
      </div>
    </div>
    }

    <!-- ═══ ONGLET BULLETIN CALCULÉ ═══ -->
    @if (tab() === 'bulletin') {
    <div class="bsd-card">
      @if (!apercu()) {
        <p class="bsd-empty-row">Pas encore calculé — cliquez sur "Recalculer".</p>
      }

      @if (apercu()) {
        <div class="bsd-bulletin-periode">
          <div class="bsd-bp-field"><span class="f-label">Période du</span><span class="f-val">{{ premierJourMois() }}</span></div>
          <div class="bsd-bp-field"><span class="f-label">au</span><span class="f-val">{{ dernierJourMois() }}</span></div>
          @if (contrat()) {
            <div class="bsd-bp-field"><span class="f-label">Régime</span><span class="f-val">{{ contrat()!.regimePaieCode }}</span></div>
          }
          <div class="bsd-bp-field"><span class="f-label">Montants en</span><span class="f-val">{{ symboleDevise() }}</span></div>
          <!-- "Paiement le / par ... / Date de DSN" (~Sage) non repris ici : ni le mode/date de
               paiement (renseignés seulement APRÈS génération, voir l'onglet "Paiement" du
               bulletin persisté), ni la DSN (déclaration sociale française, hors périmètre
               Réunion/Madagascar tel que modélisé aujourd'hui) — pas de valeur à afficher sans
               l'inventer. -->
        </div>

        <table class="bsd-table bsd-bulletin-table">
          <thead>
            <tr>
              <th>Code</th><th>Rubrique</th><th class="num">Nombre</th><th class="num">Base</th>
              <th class="num">Taux salarial</th><th class="num">Gain</th><th class="num">Retenue</th>
              <th class="num">Taux pat.</th><th class="num">Montant pat.</th>
            </tr>
          </thead>
          <tbody>
            @for (l of lignesGains(); track l.code) {
              <tr>
                <td class="mono bsd-code" [attr.data-imputation]="l.imputation">{{ l.code }}</td>
                <td>{{ l.libelle }}</td>
                <td class="num">{{ l.nombreSalarial ?? '' }}</td>
                <td class="num">{{ l.base | number:'1.2-2' }}</td>
                <td class="num">{{ l.tauxSalarial ?? '' }}</td>
                <td class="num">{{ estGain(l) ? (l.montantSalarial | number:'1.2-2') : '' }}</td>
                <td class="num"></td>
                <td class="num"></td>
                <td class="num"></td>
              </tr>
            }

            <tr class="bsd-bulletin-total-row">
              <td colspan="5"><strong>Total brut</strong></td>
              <td class="num"><strong>{{ apercu()!.totalBrut | number:'1.2-2' }}</strong></td>
              <td colspan="3"></td>
            </tr>

            @for (l of lignesCotisations(); track l.code) {
              <tr>
                <td class="mono bsd-code" [attr.data-imputation]="l.imputation">{{ l.code }}</td>
                <td>{{ l.libelle }}</td>
                <td class="num">{{ l.nombreSalarial ?? '' }}</td>
                <td class="num">{{ l.base | number:'1.2-2' }}</td>
                <td class="num">{{ l.tauxSalarial ?? '' }}</td>
                <td class="num">{{ estGain(l) ? (l.montantSalarial | number:'1.2-2') : '' }}</td>
                <td class="num">{{ estRetenue(l) ? (l.montantSalarial | number:'1.2-2') : '' }}</td>
                <td class="num">{{ l.tauxPatronal ?? '' }}</td>
                <td class="num">{{ l.montantPatronal | number:'1.2-2' }}</td>
              </tr>
            }

            @if (lignesCotisations().length) {
              <tr class="bsd-bulletin-total-row">
                <td colspan="6"><strong>Total cotisations</strong></td>
                <td class="num"><strong>{{ apercu()!.totalCotisationsSalariales | number:'1.2-2' }}</strong></td>
                <td></td>
                <td class="num"><strong>{{ apercu()!.totalCotisationsPatronales | number:'1.2-2' }}</strong></td>
              </tr>
            }

            @for (l of lignesRetenues(); track l.code) {
              <tr>
                <td class="mono bsd-code" [attr.data-imputation]="l.imputation">{{ l.code }}</td>
                <td>{{ l.libelle }}</td>
                <td class="num">{{ l.nombreSalarial ?? '' }}</td>
                <td class="num">{{ l.base | number:'1.2-2' }}</td>
                <td class="num">{{ l.tauxSalarial ?? '' }}</td>
                <td class="num"></td>
                <td class="num">{{ estRetenue(l) ? (l.montantSalarial | number:'1.2-2') : '' }}</td>
                <td class="num"></td>
                <td class="num"></td>
              </tr>
            }
          </tbody>
        </table>

        <div class="bsd-section-title">Récapitulatif</div>
        <table class="bsd-table bsd-recap-table">
          <thead>
            <tr>
              <th></th><th class="num">Brut</th><th class="num">Cotisations salariales</th>
              <th class="num">Cotisations patronales</th><th class="num">Net à payer</th><th class="num">Net imposable</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Période</strong></td>
              <td class="num">{{ apercu()!.totalBrut | number:'1.2-2' }}</td>
              <td class="num">{{ apercu()!.totalCotisationsSalariales | number:'1.2-2' }}</td>
              <td class="num">{{ apercu()!.totalCotisationsPatronales | number:'1.2-2' }}</td>
              <td class="num f-strong">{{ apercu()!.netAPayer | number:'1.2-2' }}</td>
              <td class="num">{{ apercu()!.netImposable | number:'1.2-2' }}</td>
            </tr>
            @if (cumul()) {
              <tr>
                <td><strong>Annuel</strong></td>
                <td class="num">{{ cumul()!.totalBrut | number:'1.2-2' }}</td>
                <td class="num">{{ cumul()!.totalCotisationsSalariales | number:'1.2-2' }}</td>
                <td class="num">{{ cumul()!.totalCotisationsPatronales | number:'1.2-2' }}</td>
                <td class="num f-strong">{{ cumul()!.netAPayer | number:'1.2-2' }}</td>
                <td class="num">{{ cumul()!.netImposable | number:'1.2-2' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }

      <div class="bsd-form-actions">
        @if (apercu()) {
          <button mat-stroked-button [disabled]="loadingApercuPdf()" (click)="apercuImprimer()">
            <mat-icon>visibility</mat-icon> Aperçu / Imprimer
          </button>
        }
        <button mat-flat-button color="primary" (click)="genererBulletin()">
          <mat-icon>fact_check</mat-icon> Générer (persister) le bulletin
        </button>
      </div>
    </div>
    }

    }
  </div>

  <!-- ═══ PIED — NAVIGATION PRÉC./SUIV. + RECALCULER ═══ -->
  <div class="bsd-footer">
    <button mat-stroked-button [disabled]="!canPrev()" matTooltip="Salarié précédent du cycle" aria-label="Salarié précédent du cycle" (click)="goPrev()">
      <mat-icon>chevron_left</mat-icon> Préc.
    </button>
    <span class="bsd-footer-pos">{{ salariesCycle().length ? (currentIndex() + 1) + ' / ' + salariesCycle().length : '' }}</span>
    <button mat-stroked-button [disabled]="!canNext()" matTooltip="Salarié suivant du cycle" aria-label="Salarié suivant du cycle" (click)="goNext()">
      Suiv. <mat-icon>chevron_right</mat-icon>
    </button>
    <div class="bsd-spacer"></div>
    <button mat-flat-button color="primary" [disabled]="loading()" (click)="recalculer()">
      <mat-icon>calculate</mat-icon> Recalculer
    </button>
  </div>

  <!-- Template réutilisé pour une liste de lignes libres (libellé + montant) éditable -->
  <ng-template #lignesEditables let-lignes="lignes" let-ajouter="ajouter" let-supprimer="supprimer">
    <table class="bsd-table bsd-table--edit">
      <thead><tr><th>Libellé</th><th class="num">Montant</th><th></th></tr></thead>
      <tbody>
        @for (l of lignes; track $index) {
          <tr>
            <td><input matInput class="bsd-inline-input" [(ngModel)]="l.libelle" (ngModelChange)="dirty.set(true)" /></td>
            <td class="num"><input matInput type="number" class="bsd-inline-input bsd-inline-input--num" [(ngModel)]="l.montant" (ngModelChange)="dirty.set(true)" /></td>
            <td><button mat-icon-button class="bsd-btn-xxs" matTooltip="Supprimer la ligne" aria-label="Supprimer la ligne" (click)="supprimer($index)"><mat-icon>delete</mat-icon></button></td>
          </tr>
        }
        @if (!lignes.length) {
          <tr><td colspan="3" class="bsd-empty-row">Aucune ligne.</td></tr>
        }
      </tbody>
    </table>
    <button mat-button class="bsd-btn-sm" (click)="ajouter()"><mat-icon>add</mat-icon> Ajouter une ligne</button>
  </ng-template>

</div>
  `,
  styles: [`
    .bsd-wrap { display: flex; flex-direction: column; height: 100%; background: #F8FAFC; }
    .bsd-header { display: flex; align-items: flex-start; gap: 14px; padding: 18px 22px 14px; background: #fff; border-bottom: 1px solid #E2E8F0; }
    .bsd-header-main { display: flex; gap: 12px; align-items: center; flex: 1; min-width: 0; }
    .bsd-header-icon { color: #7C3AED; font-size: 26px; width: 26px; height: 26px; flex-shrink: 0; }
    .bsd-header h2 { font-size: 16px; font-weight: 700; color: #1E293B; margin: 0 0 2px; }
    .bsd-sub { font-size: 12px; color: #94A3B8; margin: 0; }
    .bsd-dirty { color: #B45309; font-weight: 600; }
    .bsd-header-periode { display: flex; gap: 8px; }
    mat-form-field.sm { max-width: 120px; }
    .bsd-close { flex-shrink: 0; }
    .bsd-tabs { display: flex; gap: 2px; background: #fff; border-bottom: 1px solid #E2E8F0; padding: 0 14px; flex-wrap: wrap; }
    .bsd-tab {
      display: flex; align-items: center; gap: 6px; border: none; background: none; cursor: pointer;
      padding: 10px 12px; font-size: 12.5px; font-weight: 500; color: #64748B; border-bottom: 2px solid transparent;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .bsd-tab:hover { color: #1E293B; }
    .bsd-tab.active { color: #7C3AED; border-bottom-color: #7C3AED; font-weight: 700; }
    .bsd-content { flex: 1; overflow-y: auto; padding: 18px 22px; }
    .bsd-loading, .bsd-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 60px 0; color: #64748B; }
    .bsd-empty mat-icon { font-size: 32px; width: 32px; height: 32px; color: #F59E0B; }
    .bsd-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; }
    .bsd-card__header { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; color: #1E293B; margin-bottom: 14px; mat-icon { color: #7C3AED; } }
    .bsd-btn-sm { margin-left: auto; font-size: 12px; }
    .bsd-hint { font-size: 12px; color: #64748B; margin: 0 0 12px; }
    .bsd-section-title { font-weight: 700; font-size: 12.5px; color: #334155; margin: 16px 0 8px; padding-top: 12px; border-top: 1px dashed #E2E8F0; }
    .bsd-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .bsd-table th { text-align: left; color: #94A3B8; font-size: 10.5px; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid #E2E8F0; }
    .bsd-table td { padding: 7px 8px; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
    .bsd-table th.num, .bsd-table td.num { text-align: right; }
    .bsd-empty-row { text-align: center; color: #94A3B8; padding: 14px !important; }
    .mono { font-family: monospace; }
    .bsd-actions-cell { white-space: nowrap; text-align: right; }
    .bsd-btn-xxs { width: 30px; height: 30px; line-height: 30px; padding: 0; mat-icon { font-size: 17px; width: 17px; height: 17px; } }
    .badge-s { font-size: 9px; font-weight: 700; background: #EDE9F8; color: #5B21B6; padding: 1px 5px; border-radius: 6px; margin-left: 4px; }
    .badge-ov { font-size: 9px; background: #FEF3C7; color: #92400E; padding: 1px 6px; border-radius: 8px; margin-left: 6px; }
    .bsd-override-row td { padding: 0; border-bottom: 1px solid #E2E8F0; }
    .bsd-override-box { background: #F8FAFC; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
    .bsd-override-title { font-size: 11.5px; font-weight: 600; color: #475569; }
    .bsd-override-fields { display: flex; gap: 12px; }
    .bsd-override-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .field-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 20px; }
    .field-grid--1 { grid-template-columns: 1fr 1fr; }
    .field { display: flex; flex-direction: column; gap: 2px; }
    .f-label { font-size: 10.5px; color: #94A3B8; text-transform: uppercase; letter-spacing: .03em; }
    .f-val { font-size: 13.5px; color: #1E293B; font-weight: 500; }
    .f-val.f-strong, .f-label.f-strong { font-weight: 700; color: #7C3AED; }
    .bsd-form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 16px; align-items: end; }
    .bsd-form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
    .bsd-cumul-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .bsd-cumul-col { background: #F8FAFC; border-radius: 10px; padding: 14px 16px; }
    .bsd-cumul-col-title { font-weight: 700; font-size: 12.5px; color: #475569; margin-bottom: 10px; }

    /* ── Onglet "Bulletin calculé" (~Sage) ─────────────────────────────────── */
    .bsd-bulletin-periode { display: flex; gap: 24px; margin-bottom: 14px; flex-wrap: wrap; }
    .bsd-bp-field { display: flex; flex-direction: column; gap: 2px; }
    .bsd-bulletin-table thead th { background: #F8FAFC; }
    .bsd-bulletin-total-row td { background: #F8FAFC; border-top: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; padding-top: 8px; padding-bottom: 8px; }
    .bsd-code[data-imputation="COTISATION"] { color: #1D4ED8; }
    .bsd-code[data-imputation="RETENUE"] { color: #B91C1C; }
    .bsd-code[data-imputation="PRIME"], .bsd-code[data-imputation="AVANTAGE"] { color: #047857; }
    .bsd-code[data-imputation="INFORMATION"] { color: #6D28D9; }
    .bsd-recap-table td:first-child, .bsd-recap-table th:first-child { width: 90px; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
    .bsd-table--edit .bsd-inline-input { border: none; background: none; font-size: 12.5px; width: 100%; font-family: inherit; color: inherit; }
    .bsd-table--edit .bsd-inline-input:focus { outline: 1px solid #7C3AED; border-radius: 4px; }
    .bsd-table--edit .bsd-inline-input--num { text-align: right; }
    .bsd-footer { display: flex; align-items: center; gap: 10px; padding: 12px 22px; background: #fff; border-top: 1px solid #E2E8F0; }
    .bsd-footer-pos { font-size: 12px; color: #94A3B8; min-width: 50px; text-align: center; }
    .bsd-spacer { flex: 1; }
    .spinner { width: 20px; height: 20px; border: 2px solid #E2E8F0; border-top-color: #7C3AED; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class BulletinSalarieDialogComponent implements OnInit {
  private paieRh = inject(PaieRhService);
  private congesService = inject(CongesAbsencesService);
  private salariesService = inject(SalariesService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private dialogRef = inject(MatDialogRef<BulletinSalarieDialogComponent, BulletinSalarieDialogResult>);

  loadingApercuPdf = signal(false);
  /** Devise du salarié (`User.devise`) — jamais "€" supposé, voir `deviseSymbole()`. */
  deviseSalarie = signal<string | null>(null);
  readonly symboleDevise = () => deviseSymbole(this.deviseSalarie());

  readonly MOIS_LABEL = MOIS_LABEL;
  readonly TYPE_CONGE_LABELS = TYPE_CONGE_LABELS;
  readonly TYPE_CONGE_COLORS = TYPE_CONGE_COLORS;
  readonly STATUT_CONGE_LABELS = STATUT_CONGE_LABELS;
  readonly moisOptions = MOIS_LABEL.map((l, i) => ({ v: i + 1, l }));

  salarieId = signal<number>(0);
  mois = signal<number>(1);
  annee = signal<number>(new Date().getFullYear());
  tab = signal<DialogTab>('rubriques');
  loading = signal(false);
  dirty = signal(false);
  private changed = false;

  contrat = signal<ContratTravail | null>(null);
  variable = signal<VariablePaieRh | null>(null);
  rubriques = signal<RubriquePaieRh[]>([]);
  apercu = signal<ResultatCalculPaieRh | null>(null);
  cumul = signal<CumulAnnuelPaieRh | null>(null);
  congesAnnee = signal<CongeAbsence[]>([]);
  salariesCycle = signal<SalarieATraiter[]>([]);

  fHeuresSup = 0;
  fTauxMajoration: number | null = null;
  fPrimes: LignePaieLibreRh[] = [];
  fAvantagesNature: LignePaieLibreRh[] = [];
  fAbsencesManuelles: LignePaieLibreRh[] = [];
  fRetenuesManuelles: LignePaieLibreRh[] = [];
  fSurcharges: SurchargeRubriquePaieRh[] = [];

  overrideOpenKey = signal<string | null>(null);
  overrideDraft: { nombre: number | null; base: number | null; taux: number | null } = { nombre: null, base: null, taux: null };

  rubriquesActives = computed(() => this.rubriques().filter((r) => r.isActive).sort((a, b) => a.ordreAffichage - b.ordreAffichage));

  absencesAuto = computed(() => (this.variable()?.absences ?? []).filter((l) => l.origine === 'CONGE_ABSENCE'));
  retenuesAuto = computed(() => (this.variable()?.retenuesDiverses ?? []).filter((l) => l.origine === 'ACOMPTE'));

  congesPeriode = computed(() => {
    const mois = this.mois();
    const annee = this.annee();
    const debut = `${annee}-${String(mois).padStart(2, '0')}-01`;
    const finDuMois = new Date(annee, mois, 0);
    const fin = `${annee}-${String(mois).padStart(2, '0')}-${String(finDuMois.getDate()).padStart(2, '0')}`;
    return this.congesAnnee().filter((c) => c.dateDebut <= fin && c.dateFin >= debut);
  });

  currentIndex = computed(() => this.salariesCycle().findIndex((s) => s.salarieId === this.salarieId()));
  canPrev = computed(() => this.currentIndex() > 0);
  canNext = computed(() => this.currentIndex() >= 0 && this.currentIndex() < this.salariesCycle().length - 1);

  salarieNom = computed(() => {
    const s = this.salariesCycle().find((x) => x.salarieId === this.salarieId());
    return s?.salarie ? `${s.salarie.firstName} ${s.salarie.lastName}` : `#${this.salarieId()}`;
  });

  constructor(@Inject(MAT_DIALOG_DATA) public data: BulletinSalarieDialogData) {
    this.salarieId.set(data.salarieId);
    this.mois.set(data.mois);
    this.annee.set(data.annee);
  }

  ngOnInit() {
    this.loadCycle();
    this.load();
  }

  typeContratLabel(t: TypeContratTravail) { return TYPE_CONTRAT_LABELS[t] ?? t; }

  setTab(t: DialogTab) {
    this.tab.set(t);
    if (t === 'bulletin' && this.dirty()) this.recalculer();
  }

  private loadCycle() {
    this.paieRh.listerSalariesATraiter(this.mois(), this.annee()).subscribe({
      next: (s) => this.salariesCycle.set(s),
      error: () => this.salariesCycle.set([]),
    });
  }

  private loadConges() {
    this.congesService.findAll({ userId: this.salarieId(), annee: this.annee() }).subscribe({
      next: (c) => this.congesAnnee.set(c),
      error: () => this.congesAnnee.set([]),
    });
  }

  load() {
    this.loading.set(true);
    const salarieId = this.salarieId();
    const mois = this.mois();
    const annee = this.annee();
    this.salariesService.getOne(salarieId).subscribe({
      next: (c) => this.deviseSalarie.set(c.devise),
      error: () => this.deviseSalarie.set(null),
    });
    forkJoin({
      contrat: this.paieRh.findContratActif(salarieId).pipe(catchError(() => of(null))),
      variable: this.paieRh.findVariables(salarieId, mois, annee).pipe(catchError(() => of(null))),
    }).subscribe(({ contrat, variable }) => {
      this.contrat.set(contrat);
      this.variable.set((variable as VariablePaieRh) ?? null);
      this.initFormsFromVariable();
      this.loadConges();
      if (contrat) {
        this.paieRh.findRubriques(contrat.regimePaieCode).subscribe((r) => this.rubriques.set(r));
        this.recalculer();
      } else {
        this.loading.set(false);
      }
    });
  }

  private initFormsFromVariable() {
    const v = this.variable();
    this.fHeuresSup = v?.heuresSupplementaires ?? 0;
    this.fTauxMajoration = v?.tauxMajorationHeuresSup ?? null;
    this.fPrimes = v?.primes ? JSON.parse(JSON.stringify(v.primes)) : [];
    this.fAvantagesNature = v?.avantagesNature ? JSON.parse(JSON.stringify(v.avantagesNature)) : [];
    this.fAbsencesManuelles = (v?.absences ?? []).filter((l) => !l.origine || l.origine === 'MANUELLE').map((l) => ({ ...l }));
    this.fRetenuesManuelles = (v?.retenuesDiverses ?? []).filter((l) => !l.origine || l.origine === 'MANUELLE').map((l) => ({ ...l }));
    this.fSurcharges = v?.surchargesRubriques ? JSON.parse(JSON.stringify(v.surchargesRubriques)) : [];
    this.dirty.set(false);
  }

  ligneCalculee(code: string) {
    return this.apercu()?.detailRubriques.find((l) => l.code === code) ?? null;
  }

  /* ── Onglet "Bulletin calculé" (~Sage) ────────────────────────────────────────── */

  premierJourMois(): string {
    return `01/${String(this.mois()).padStart(2, '0')}/${this.annee()}`;
  }

  dernierJourMois(): string {
    const dernier = new Date(this.annee(), this.mois(), 0).getDate();
    return `${String(dernier).padStart(2, '0')}/${String(this.mois()).padStart(2, '0')}/${this.annee()}`;
  }

  lignesCotisations(): LigneBulletinRh[] {
    return this.apercu()?.detailRubriques.filter((l) => l.imputation === 'COTISATION') ?? [];
  }

  /** Lignes "de brut" (salaire de base, primes, avantages…) — en tête du bulletin, avant le Total brut. */
  lignesGains(): LigneBulletinRh[] {
    return this.apercu()?.detailRubriques.filter((l) => l.imputation !== 'COTISATION' && l.imputation !== 'RETENUE') ?? [];
  }

  /** Retenues hors cotisations (impôt, avances…) — après le Total cotisations. */
  lignesRetenues(): LigneBulletinRh[] {
    return this.apercu()?.detailRubriques.filter((l) => l.imputation === 'RETENUE') ?? [];
  }

  /** Une PRIME ou un AVANTAGE s'ajoute au net → colonne "Gain" (~Sage). */
  estGain(l: LigneBulletinRh): boolean {
    return (l.imputation === 'PRIME' || l.imputation === 'AVANTAGE') && l.montantSalarial !== 0;
  }

  /** Une COTISATION ou une RETENUE se déduit du net → colonne "Retenue" (~Sage). */
  estRetenue(l: LigneBulletinRh): boolean {
    return (l.imputation === 'COTISATION' || l.imputation === 'RETENUE') && l.montantSalarial !== 0;
  }

  /* ── Recalcul en direct ────────────────────────────────────────────────────────── */

  recalculer() {
    if (!this.contrat()) return;
    this.loading.set(true);
    const salarieId = this.salarieId();
    const mois = this.mois();
    const annee = this.annee();
    const dto = {
      salarieId, mois, annee,
      heuresSupplementaires: this.fHeuresSup,
      tauxMajorationHeuresSup: this.fTauxMajoration ?? undefined,
      primes: this.fPrimes,
      absences: this.fAbsencesManuelles,
      avantagesNature: this.fAvantagesNature,
      retenuesDiverses: this.fRetenuesManuelles,
      surchargesRubriques: this.fSurcharges,
    };
    this.paieRh.upsertVariable(dto).subscribe({
      next: () => {
        forkJoin({
          apercu: this.paieRh.calculerBulletin(salarieId, mois, annee),
          cumul: this.paieRh.cumulAnnuel(salarieId, mois, annee),
          variable: this.paieRh.findVariables(salarieId, mois, annee),
        }).subscribe({
          next: ({ apercu, cumul, variable }) => {
            this.apercu.set(apercu);
            this.cumul.set(cumul);
            this.variable.set((variable as VariablePaieRh) ?? null);
            this.dirty.set(false);
            this.changed = true;
            this.loading.set(false);
          },
          error: (e) => {
            this.loading.set(false);
            this.snack.open(e?.error?.message || 'Erreur de calcul', undefined, { duration: 3000 });
          },
        });
      },
      error: (e) => {
        this.loading.set(false);
        this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 });
      },
    });
  }

  genererBulletin() {
    this.paieRh.genererBulletin(this.salarieId(), this.mois(), this.annee()).subscribe({
      next: () => {
        this.changed = true;
        this.snack.open('Bulletin généré', undefined, { duration: 2500 });
        this.loadCycle();
      },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur de génération', undefined, { duration: 3000 }),
    });
  }

  /** Aperçu PDF en direct (sans persister) + bouton "Imprimer" — voir apercuPdf() côté backend. */
  apercuImprimer() {
    this.loadingApercuPdf.set(true);
    this.paieRh.apercuPdfBulletin(this.salarieId(), this.mois(), this.annee()).subscribe({
      next: (blob) => {
        this.loadingApercuPdf.set(false);
        this.dialog.open(BulletinPdfPreviewDialogComponent, {
          panelClass: ['rounded-dialog', 'no-pad-dialog'],
          width: '900px', maxWidth: '96vw', height: '90vh', maxHeight: '90vh',
          data: { blob, titre: `Aperçu bulletin — ${this.salarieNom()} — ${MOIS_LABEL[this.mois() - 1]} ${this.annee()}` },
        });
      },
      error: (e) => {
        this.loadingApercuPdf.set(false);
        this.snack.open(e?.error?.message || "Erreur lors de la génération de l'aperçu", undefined, { duration: 3000 });
      },
    });
  }

  /* ── Surcharge ponctuelle par rubrique ─────────────────────────────────────────── */

  aSurcharge(code: string, part: PartRubriqueRh): boolean {
    return this.fSurcharges.some((s) => s.rubriqueCode === code && s.part === part);
  }

  overrideOpenKeyPart(): PartRubriqueRh {
    return this.overrideOpenKey()?.endsWith('PATRONALE') ? 'PATRONALE' : 'SALARIALE';
  }

  private existingOverride(code: string, part: PartRubriqueRh, champ: ChampCalculRubriqueRh): number | null {
    return this.fSurcharges.find((s) => s.rubriqueCode === code && s.part === part && s.champ === champ)?.valeur ?? null;
  }

  ouvrirSurcharge(r: RubriquePaieRh, part: PartRubriqueRh) {
    this.overrideOpenKey.set(`${r.code}|${part}`);
    this.overrideDraft = {
      nombre: this.existingOverride(r.code, part, 'nombre'),
      base: this.existingOverride(r.code, part, 'base'),
      taux: this.existingOverride(r.code, part, 'taux'),
    };
  }

  fermerSurcharge() {
    this.overrideOpenKey.set(null);
  }

  appliquerSurcharge(code: string, part: PartRubriqueRh) {
    this.fSurcharges = this.fSurcharges.filter((s) => !(s.rubriqueCode === code && s.part === part));
    (['nombre', 'base', 'taux'] as ChampCalculRubriqueRh[]).forEach((champ) => {
      const v = this.overrideDraft[champ];
      if (v != null && (v as any) !== '') this.fSurcharges.push({ rubriqueCode: code, part, champ, valeur: Number(v) });
    });
    this.overrideOpenKey.set(null);
    this.dirty.set(true);
    this.recalculer();
  }

  reinitialiserSurcharge(code: string, part: PartRubriqueRh) {
    this.fSurcharges = this.fSurcharges.filter((s) => !(s.rubriqueCode === code && s.part === part));
    this.overrideOpenKey.set(null);
    this.dirty.set(true);
    this.recalculer();
  }

  /* ── Lignes libres (primes / absences / avantages / retenues) ──────────────────── */

  ajouterPrime = () => { this.fPrimes = [...this.fPrimes, { libelle: '', montant: 0 }]; this.dirty.set(true); };
  supprimerPrime = (i: number) => { this.fPrimes = this.fPrimes.filter((_, idx) => idx !== i); this.dirty.set(true); };

  ajouterAvantage = () => { this.fAvantagesNature = [...this.fAvantagesNature, { libelle: '', montant: 0 }]; this.dirty.set(true); };
  supprimerAvantage = (i: number) => { this.fAvantagesNature = this.fAvantagesNature.filter((_, idx) => idx !== i); this.dirty.set(true); };

  ajouterRetenue = () => { this.fRetenuesManuelles = [...this.fRetenuesManuelles, { libelle: '', montant: 0 }]; this.dirty.set(true); };
  supprimerRetenue = (i: number) => { this.fRetenuesManuelles = this.fRetenuesManuelles.filter((_, idx) => idx !== i); this.dirty.set(true); };

  ajouterAbsenceManuelle = () => { this.fAbsencesManuelles = [...this.fAbsencesManuelles, { libelle: '', montant: 0 }]; this.dirty.set(true); };
  supprimerAbsenceManuelle = (i: number) => { this.fAbsencesManuelles = this.fAbsencesManuelles.filter((_, idx) => idx !== i); this.dirty.set(true); };

  resynchroniserAbsences() {
    this.paieRh.synchroniserAbsences(this.salarieId(), this.mois(), this.annee()).subscribe({
      next: () => {
        this.snack.open('Absences resynchronisées', undefined, { duration: 2500 });
        this.recalculer();
      },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
    });
  }

  /* ── Période / navigation Préc./Suiv. ──────────────────────────────────────────── */

  onPeriodeChange(mois: number, annee: number) {
    if (this.dirty() && !confirm('Des modifications non enregistrées seront perdues. Continuer ?')) return;
    this.mois.set(mois);
    this.annee.set(annee);
    this.dirty.set(false);
    this.loadCycle();
    this.load();
  }

  private switchTo(salarieId: number) {
    this.salarieId.set(salarieId);
    this.dirty.set(false);
    this.tab.set('rubriques');
    this.load();
  }

  goPrev() {
    if (!this.canPrev()) return;
    if (this.dirty() && !confirm('Des modifications non enregistrées seront perdues. Continuer ?')) return;
    this.switchTo(this.salariesCycle()[this.currentIndex() - 1].salarieId);
  }

  goNext() {
    if (!this.canNext()) return;
    if (this.dirty() && !confirm('Des modifications non enregistrées seront perdues. Continuer ?')) return;
    this.switchTo(this.salariesCycle()[this.currentIndex() + 1].salarieId);
  }

  fermer() {
    if (this.dirty() && !confirm('Des modifications non enregistrées seront perdues. Fermer quand même ?')) return;
    this.dialogRef.close({ changed: this.changed });
  }
}
