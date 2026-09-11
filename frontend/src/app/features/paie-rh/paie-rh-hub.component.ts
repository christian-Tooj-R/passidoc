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
import {
  PaieRhService, CyclePaieRh, SalarieATraiter, StatutCyclePaieRh, deviseSymbole, STATUT_CYCLE_LABELS,
} from '../../core/services/paie-rh.service';
import { RubriquesPaieRhComponent } from './rubriques/rubriques-paie-rh.component';
import { ConstantesPaieRhComponent } from './constantes/constantes-paie-rh.component';
import { BulletinSalarieDialogComponent } from './bulletin-salarie-dialog/bulletin-salarie-dialog.component';
import { BulletinPdfPreviewDialogComponent } from './bulletin-pdf-preview-dialog.component';

type HubTab = 'cycle' | 'rubriques' | 'constantes';
const MOIS_LABEL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/**
 * Hub d'administration du module Paie & RH interne (collaborateurs AFYM) : cycle mensuel
 * (assistant de préparation, calcul en masse, validation, clôture) et paramétrage des
 * rubriques/paramètres de paie. Accessible depuis /rh/paie. Voir Doc/MODULE_PAIE_RH_NOTES.md.
 */
@Component({
  selector: 'app-paie-rh-hub',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSnackBarModule,
    MatDialogModule, MatTooltipModule,
    RubriquesPaieRhComponent, ConstantesPaieRhComponent,
  ],
  template: `
<div class="prhh-wrap">

  <div class="prhh-header">
    <div class="prhh-header-main">
      <div class="prhh-header-icon"><mat-icon>payments</mat-icon></div>
      <div>
        <h1>Paie interne</h1>
        <p class="prhh-sub">Cycle de paie mensuel des salariés, rubriques et constantes de calcul.</p>
      </div>
    </div>
    @if (tab() === 'cycle') {
      <div class="prhh-periode">
        <mat-form-field appearance="outline" class="sm">
          <mat-label>Mois</mat-label>
          <mat-select [(ngModel)]="mois" (ngModelChange)="reloadCycle()">
            @for (m of moisOptions; track m.v) { <mat-option [value]="m.v">{{ m.l }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="sm">
          <mat-label>Année</mat-label>
          <input matInput type="number" [(ngModel)]="annee" (ngModelChange)="reloadCycle()" />
        </mat-form-field>
      </div>
    }
  </div>

  <div class="prhh-body">

  <!-- ── Menu vertical (simple liste, pas un composant sidebar) ── -->
  <nav class="prhh-nav">
    <button class="prhh-nav-item" [class.active]="tab()==='cycle'" (click)="tab.set('cycle')"><mat-icon>event_repeat</mat-icon>Cycle mensuel</button>
    <button class="prhh-nav-item" [class.active]="tab()==='rubriques'" (click)="tab.set('rubriques')"><mat-icon>list_alt</mat-icon>Rubriques</button>
    <button class="prhh-nav-item" [class.active]="tab()==='constantes'" (click)="tab.set('constantes')"><mat-icon>functions</mat-icon>Constantes</button>
  </nav>

  <div class="prhh-content">

  <!-- ═══ CYCLE MENSUEL ═══ -->
  @if (tab() === 'cycle') {
  <div class="prhh-card">
    <div class="prhh-cycle-bar">
      @if (cycle()) {
        <span class="badge-cycle" [attr.data-statut]="cycle()!.statut">{{ statutLabel(cycle()!.statut) }}</span>
        <span class="prhh-stat">{{ nbBulletinsGeneres() }} / {{ salaries().length }} bulletins générés</span>
        <span class="prhh-stat">Total brut : {{ cycle()!.totalBrut | number:'1.2-2' }} {{ deviseCommune() }}</span>
        <span class="prhh-stat">Net à payer total : {{ cycle()!.totalNetAPayer | number:'1.2-2' }} {{ deviseCommune() }}</span>
        @if (!deviseCommune()) {
          <span class="prhh-stat prhh-stat--warn" matTooltip="Les salariés de ce cycle n'ont pas tous la même devise — un total additionné mélangerait des devises différentes, aucun symbole n'est affiché pour ne pas induire en erreur.">
            <mat-icon>warning</mat-icon> devises mélangées
          </span>
        }
      } @else {
        <span class="prhh-stat">Aucun cycle ouvert pour cette période.</span>
      }
      <div class="prhh-spacer"></div>
      @if (!cycle()) {
        <button mat-flat-button color="primary" (click)="ouvrirCycle()"><mat-icon>lock_open</mat-icon> Ouvrir la période</button>
      }
      @if (cycle() && cycle()!.statut !== 'CLOTURE') {
        @if (nbBulletinsGeneres() < salaries().length) {
          <button mat-stroked-button (click)="calculerCycle()"><mat-icon>calculate</mat-icon> Calculer les bulletins restants</button>
        }
        @if (nbBulletinsGeneres() > 0) {
          <button mat-stroked-button (click)="recalculerTousCycle()"
                  matTooltip="Régénère tous les bulletins du mois (les bulletins déjà payés sont conservés) — à utiliser après un changement de rubriques, constantes ou variables">
            <mat-icon>refresh</mat-icon> Recalculer tous les bulletins
          </button>
        }
      }
      @if (cycle() && cycle()!.statut === 'CALCULE') {
        <button mat-flat-button color="primary" (click)="validerCycle()"><mat-icon>check_circle</mat-icon> Valider le cycle</button>
      }
      @if (cycle() && cycle()!.statut === 'VALIDE') {
        <button mat-flat-button color="warn" (click)="cloturerCycle()"><mat-icon>lock</mat-icon> Clôturer (verrouille la période)</button>
      }
    </div>

    <table class="prhh-table">
      <thead><tr><th>Salarié</th><th>Pôle / Régime</th><th>Salaire base</th><th>Statut bulletin</th><th>Net à payer</th><th></th></tr></thead>
      <tbody>
        @for (s of salaries(); track s.salarieId) {
          <tr class="prhh-row-link">
            <td [routerLink]="['/rh/salaries', s.salarieId]">{{ s.salarie ? s.salarie.firstName + ' ' + s.salarie.lastName : ('#' + s.salarieId) }}</td>
            <td [routerLink]="['/rh/salaries', s.salarieId]">{{ s.regimePaieCode }}</td>
            <td [routerLink]="['/rh/salaries', s.salarieId]">{{ s.salaireBase | number:'1.2-2' }} {{ symboleDevise(s) }}</td>
            <td [routerLink]="['/rh/salaries', s.salarieId]"><span class="badge-statut" [attr.data-statut]="s.bulletinStatut">{{ s.bulletinStatut === 'GENERE' ? 'Généré' : 'À traiter' }}</span></td>
            <td [routerLink]="['/rh/salaries', s.salarieId]">{{ s.netAPayer != null ? (s.netAPayer | number:'1.2-2') + ' ' + symboleDevise(s) : '—' }}</td>
            <td class="prhh-actions-cell">
              @if (s.bulletinId) {
                <button mat-icon-button matTooltip="Visualiser le bulletin" aria-label="Visualiser le bulletin" (click)="visualiserPdf(s)"><mat-icon>visibility</mat-icon></button>
              }
              <button mat-icon-button matTooltip="Ouvrir le bulletin détaillé" aria-label="Ouvrir le bulletin détaillé" (click)="ouvrirBulletin(s)"><mat-icon>receipt_long</mat-icon></button>
            </td>
          </tr>
        }
        @if (!salaries().length) {
          <tr><td colspan="6" class="prhh-empty-row">Aucun salarié avec un contrat actif.</td></tr>
        }
      </tbody>
    </table>
  </div>
  }

  <!-- ═══ RUBRIQUES ═══ -->
  @if (tab() === 'rubriques') {
    <app-rubriques-paie-rh />
  }

  <!-- ═══ CONSTANTES ═══ -->
  @if (tab() === 'constantes') {
    <app-constantes-paie-rh />
  }

  </div>
  </div>

</div>
  `,
  styles: [`
    .prhh-wrap { padding: 24px 28px 48px; max-width: 1680px; margin: 0 auto; }
    .prhh-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-bottom: 18px; flex-wrap: wrap; }
    .prhh-header-main { display: flex; align-items: center; gap: 12px; }
    .prhh-header-icon { width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #7C3AED, #6D28D9);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 3px 10px rgba(109,40,217,.25);
      mat-icon { color: #fff; font-size: 22px; width: 22px; height: 22px; } }
    .prhh-header h1 { font-size: 20px; font-weight: 700; color: #1E293B; margin: 0 0 4px; }
    .prhh-sub { font-size: 12px; color: #94A3B8; margin: 0; max-width: 560px; }
    .prhh-periode { display: flex; gap: 10px; }
    mat-form-field.sm { max-width: 140px; }
    .prhh-body { display: flex; align-items: flex-start; gap: 24px; }
    .prhh-nav { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; width: 200px; }
    .prhh-nav-item {
      display: flex; align-items: center; gap: 10px; border: none; background: none; cursor: pointer;
      padding: 10px 14px; font-size: 13px; font-weight: 500; color: #64748B; border-radius: 8px;
      text-align: left; width: 100%; border-left: 3px solid transparent;
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
    }
    .prhh-nav-item:hover { color: #1E293B; background: #F8FAFC; }
    .prhh-nav-item.active { color: #7C3AED; background: #F5F3FF; border-left-color: #7C3AED; font-weight: 700; }
    .prhh-content { flex: 1; min-width: 0; }
    .prhh-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; }
    .prhh-hint { font-size: 12px; color: #64748B; margin: 0 0 14px; }
    .prhh-cycle-bar { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; flex-wrap: wrap; }
    .prhh-spacer { flex: 1; }
    .prhh-stat { font-size: 12px; color: #64748B; }
    .prhh-stat--warn { display: inline-flex; align-items: center; gap: 4px; color: #B45309;
      mat-icon { font-size: 15px; width: 15px; height: 15px; } }
    .badge-cycle { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 10px; background: #F1F5F9; color: #64748B; }
    .badge-cycle[data-statut="OUVERT"] { background: #DBEAFE; color: #1D4ED8; }
    .badge-cycle[data-statut="CALCULE"] { background: #FEF3C7; color: #92400E; }
    .badge-cycle[data-statut="VALIDE"] { background: #D1FAE5; color: #047857; }
    .badge-cycle[data-statut="CLOTURE"] { background: #E2E8F0; color: #334155; }
    .prhh-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .prhh-table th { text-align: left; color: #94A3B8; font-size: 11px; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid #E2E8F0; }
    .prhh-table td { padding: 8px; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
    .prhh-row-link td[routerLink] { cursor: pointer; }
    .prhh-row-link:hover { background: #F8FAFC; }
    .prhh-actions-cell { text-align: right; }
    .prhh-row--placeholder { background: #FFFBEB; }
    .prhh-empty-row { text-align: center; color: #94A3B8; padding: 16px !important; }
    .badge-statut { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: #F1F5F9; color: #64748B; }
    .badge-statut[data-statut="GENERE"] { background: #DCFCE7; color: #15803D; }
    .badge-ph { font-size: 10px; background: #FEF3C7; color: #92400E; padding: 1px 6px; border-radius: 8px; margin-left: 6px; }
    .mono { font-family: monospace; }
  `],
})
export class PaieRhHubComponent implements OnInit {
  private paieRh = inject(PaieRhService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  readonly moisOptions = MOIS_LABEL.map((l, i) => ({ v: i + 1, l }));

  tab = signal<HubTab>('cycle');
  today = new Date();
  mois = this.today.getMonth() + 1;
  annee = this.today.getFullYear();

  cycle = signal<CyclePaieRh | null>(null);
  salaries = signal<SalarieATraiter[]>([]);

  symboleDevise(s: SalarieATraiter): string {
    return deviseSymbole(s.salarie?.devise);
  }

  /** Symbole commun si TOUS les salariés du cycle partagent la même devise, sinon '' (voir
   *  le message "devises mélangées" — un total additionné ne doit jamais porter un symbole
   *  arbitraire quand il mélange plusieurs devises). */
  deviseCommune(): string {
    const devises = new Set(this.salaries().map((s) => s.salarie?.devise ?? 'EUR'));
    return devises.size === 1 ? deviseSymbole([...devises][0]) : '';
  }

  statutLabel(s: StatutCyclePaieRh): string {
    return STATUT_CYCLE_LABELS[s] ?? s;
  }

  /** Compté sur la liste vivante plutôt que sur le compteur figé du cycle. */
  nbBulletinsGeneres(): number {
    return this.salaries().filter((s) => s.bulletinId).length;
  }

  recalculerTousCycle() {
    if (!confirm('Régénérer tous les bulletins du mois avec le paramétrage actuel ? Les bulletins déjà payés ne seront pas touchés.')) return;
    this.paieRh.calculerCycle(this.mois, this.annee, true).subscribe({
      next: (res) => {
        this.snack.open(`${res.generes} bulletin(s) régénéré(s)${res.erreurs.length ? `, ${res.erreurs.length} ignoré(s) (déjà payés ou en erreur)` : ''}`, undefined, { duration: 3500 });
        this.reloadCycle();
      },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
    });
  }

  ngOnInit() {
    this.reloadCycle();
  }

  reloadCycle() {
    this.paieRh.findCycle(this.mois, this.annee).subscribe({
      next: (c) => { this.cycle.set(c); this.loadSalaries(); },
      error: () => { this.cycle.set(null); this.loadSalaries(); },
    });
  }

  private loadSalaries() {
    this.paieRh.listerSalariesATraiter(this.mois, this.annee).subscribe((s) => this.salaries.set(s));
  }

  visualiserPdf(s: SalarieATraiter) {
    if (!s.bulletinId) return;
    this.paieRh.telechargerBulletinPdf(s.bulletinId).subscribe((blob) => {
      const nom = s.salarie ? `${s.salarie.firstName} ${s.salarie.lastName}` : `#${s.salarieId}`;
      this.dialog.open(BulletinPdfPreviewDialogComponent, {
        panelClass: ['rounded-dialog', 'no-pad-dialog'],
        width: '900px', maxWidth: '96vw', height: '90vh', maxHeight: '90vh',
        data: { blob, titre: `Bulletin — ${nom}` },
      });
    });
  }

  ouvrirBulletin(s: SalarieATraiter) {
    const ref = this.dialog.open(BulletinSalarieDialogComponent, {
      panelClass: ['rounded-dialog', 'no-pad-dialog'],
      width: '1300px', maxWidth: '96vw', height: '92vh', maxHeight: '92vh',
      data: { salarieId: s.salarieId, mois: this.mois, annee: this.annee },
    });
    ref.afterClosed().subscribe((result) => {
      if (result?.changed) { this.reloadCycle(); }
    });
  }

  ouvrirCycle() {
    this.paieRh.ouvrirCycle(this.mois, this.annee).subscribe({
      next: (c) => { this.cycle.set(c); this.loadSalaries(); this.snack.open('Période ouverte', undefined, { duration: 2500 }); },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
    });
  }

  calculerCycle() {
    this.paieRh.calculerCycle(this.mois, this.annee).subscribe({
      next: (res) => {
        this.snack.open(`${res.generes} bulletin(s) généré(s)${res.erreurs.length ? `, ${res.erreurs.length} erreur(s)` : ''}`, undefined, { duration: 3500 });
        this.reloadCycle();
      },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
    });
  }

  validerCycle() {
    this.paieRh.validerCycle(this.mois, this.annee).subscribe({
      next: (c) => { this.cycle.set(c); this.snack.open('Cycle validé', undefined, { duration: 2500 }); },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
    });
  }

  cloturerCycle() {
    if (!confirm('Clôturer verrouille définitivement la période — confirmer ?')) return;
    this.paieRh.cloturerCycle(this.mois, this.annee).subscribe({
      next: (c) => { this.cycle.set(c); this.snack.open('Cycle clôturé', undefined, { duration: 2500 }); },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3000 }),
    });
  }

}
