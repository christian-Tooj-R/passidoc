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

/** Étapes du cycle mensuel, dans l'ordre métier (voir StatutCyclePaieRh côté backend). */
const ETAPES_CYCLE: Array<{ code: StatutCyclePaieRh; label: string }> = [
  { code: 'OUVERT', label: 'Ouvert' },
  { code: 'CALCULE', label: 'Calculé' },
  { code: 'VALIDE', label: 'Validé' },
  { code: 'CLOTURE', label: 'Clôturé' },
];

/**
 * Hub d'administration du module Paie & RH interne (collaborateurs AFYM) : cycle mensuel
 * (assistant de préparation, calcul en masse, validation, clôture) et paramétrage des
 * rubriques/constantes de paie. Accessible depuis /rh/paie.
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

  <div class="rhx-page-head">
    <div class="rhx-page-head__main">
      <div class="rhx-page-head__icon"><mat-icon>payments</mat-icon></div>
      <div>
        <h1>Paie interne</h1>
        <p class="rhx-page-head__sub">Cycle de paie mensuel des salariés, rubriques et constantes de calcul.</p>
      </div>
    </div>
    @if (tab() === 'cycle') {
      <div class="rhx-page-head__actions">
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

    <!-- Avancement du cycle + actions -->
    <div class="rhx-card">
      <div class="rhx-card__head">
        <div class="rhx-card__title"><mat-icon>event_repeat</mat-icon> {{ moisOptions[mois-1]?.l }} {{ annee }}</div>
        <div class="rhx-card__spacer"></div>
        @if (cycle() && !deviseCommune()) {
          <span class="rhx-chip rhx-chip--amber" matTooltip="Les salariés de ce cycle n'ont pas tous la même devise — les totaux additionnés ne portent aucun symbole pour ne pas induire en erreur.">
            devises mélangées
          </span>
        }
      </div>

      <div class="rhx-steps">
        @for (e of etapes; track e.code) {
          <div class="rhx-step" [class.rhx-step--done]="etapeIndex() > $index" [class.rhx-step--current]="etapeIndex() === $index">
            <div class="rhx-step__dot">
              @if (etapeIndex() > $index) { <mat-icon>check</mat-icon> } @else { {{ $index + 1 }} }
            </div>
            <span class="rhx-step__label">{{ e.label }}</span>
            <div class="rhx-step__line"></div>
          </div>
        }
      </div>

      <div class="prhh-cycle-bar">
        @if (!cycle()) {
          <span class="rhx-stat">Aucun cycle ouvert pour cette période.</span>
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
    </div>

    <!-- Indicateurs -->
    <div class="rhx-kpis rhx-kpis--5">
      <div class="rhx-kpi">
        <div class="rhx-kpi__icon"><mat-icon>groups</mat-icon></div>
        <div class="rhx-kpi__body">
          <div class="rhx-kpi__label">Salariés à traiter</div>
          <div class="rhx-kpi__value">{{ salaries().length }}</div>
          <div class="rhx-kpi__sub">contrats en vigueur</div>
        </div>
      </div>
      <div class="rhx-kpi rhx-kpi--teal">
        <div class="rhx-kpi__icon"><mat-icon>fact_check</mat-icon></div>
        <div class="rhx-kpi__body">
          <div class="rhx-kpi__label">Bulletins générés</div>
          <div class="rhx-kpi__value">{{ nbBulletinsGeneres() }} <small>/ {{ salaries().length }}</small></div>
          <div class="rhx-progress prhh-kpi-progress"><div class="rhx-progress__bar rhx-progress__bar--teal" [style.width.%]="progressionBulletins()"></div></div>
        </div>
      </div>
      <div class="rhx-kpi rhx-kpi--blue">
        <div class="rhx-kpi__icon"><mat-icon>account_balance_wallet</mat-icon></div>
        <div class="rhx-kpi__body">
          <div class="rhx-kpi__label">Masse salariale brute</div>
          <div class="rhx-kpi__value">{{ masseBrute() | number:'1.2-2' }} <small>{{ deviseCommune() }}</small></div>
          <div class="rhx-kpi__sub">{{ nbBulletinsGeneres() < salaries().length ? 'salaire de base pour les bulletins non générés' : 'brut des bulletins générés' }}</div>
        </div>
      </div>
      <div class="rhx-kpi rhx-kpi--amber">
        <div class="rhx-kpi__icon"><mat-icon>payments</mat-icon></div>
        <div class="rhx-kpi__body">
          <div class="rhx-kpi__label">Net à payer total</div>
          <div class="rhx-kpi__value">{{ netTotal() | number:'1.2-2' }} <small>{{ deviseCommune() }}</small></div>
          <div class="rhx-kpi__sub">bulletins générés uniquement</div>
        </div>
      </div>
      <div class="rhx-kpi rhx-kpi--rose">
        <div class="rhx-kpi__icon"><mat-icon>business</mat-icon></div>
        <div class="rhx-kpi__body">
          <div class="rhx-kpi__label">Charges patronales</div>
          <div class="rhx-kpi__value">{{ chargesPatronales() | number:'1.2-2' }} <small>{{ deviseCommune() }}</small></div>
          <div class="rhx-kpi__sub">coût employeur : {{ coutEmployeurTotal() | number:'1.2-2' }} {{ deviseCommune() }}</div>
        </div>
      </div>
    </div>

    <!-- Salariés du cycle -->
    <div class="rhx-card">
      <div class="rhx-card__head">
        <div class="rhx-card__title"><mat-icon>badge</mat-icon> Salariés du cycle</div>
        <div class="rhx-card__spacer"></div>
        <span class="rhx-stat">{{ salaries().length }} salarié(s)</span>
      </div>

      <table class="rhx-table rhx-table--clickable prhh-table">
        <thead>
          <tr>
            <th>Salarié</th><th>Pôle</th><th class="num">Salaire de base</th><th>Bulletin</th><th class="num">Net à payer</th><th></th>
          </tr>
        </thead>
        <tbody>
          @for (s of salaries(); track s.salarieId) {
            <tr>
              <td [routerLink]="['/rh/salaries', s.salarieId]">
                <div class="rhx-person">
                  <span class="rhx-avatar" [class]="'rhx-avatar ' + avatarClasse(s.salarieId)">{{ initiales(s) }}</span>
                  <div>
                    <div class="rhx-person__name">{{ nomComplet(s) }}</div>
                    <div class="rhx-person__meta">Régime {{ s.regimePaieCode }}</div>
                  </div>
                </div>
              </td>
              <td [routerLink]="['/rh/salaries', s.salarieId]"><span class="rhx-chip rhx-chip--nodot" [class]="'rhx-chip rhx-chip--nodot ' + poleClasse(s.regimePaieCode)">{{ s.regimePaieCode }}</span></td>
              <td class="num" [routerLink]="['/rh/salaries', s.salarieId]">{{ s.salaireBase | number:'1.2-2' }} {{ symboleDevise(s) }}</td>
              <td [routerLink]="['/rh/salaries', s.salarieId]">
                <span class="rhx-chip" [class]="'rhx-chip ' + (s.bulletinStatut === 'GENERE' ? 'rhx-chip--teal' : 'rhx-chip--amber')" [attr.data-statut]="s.bulletinStatut">
                  {{ s.bulletinStatut === 'GENERE' ? 'Généré' : 'À traiter' }}
                </span>
              </td>
              <td class="num strong" [routerLink]="['/rh/salaries', s.salarieId]">{{ s.netAPayer != null ? (s.netAPayer | number:'1.2-2') + ' ' + symboleDevise(s) : '—' }}</td>
              <td class="actions">
                @if (s.bulletinId) {
                  <button mat-icon-button matTooltip="Visualiser le bulletin" aria-label="Visualiser le bulletin" (click)="visualiserPdf(s)"><mat-icon>visibility</mat-icon></button>
                }
                <button mat-icon-button matTooltip="Ouvrir le bulletin détaillé" aria-label="Ouvrir le bulletin détaillé" (click)="ouvrirBulletin(s)"><mat-icon>receipt_long</mat-icon></button>
              </td>
            </tr>
          }
          @if (!salaries().length) {
            <tr><td colspan="6">
              <div class="rhx-empty">
                <mat-icon>person_off</mat-icon>
                <div class="rhx-empty__title">Aucun salarié avec un contrat actif</div>
                <div class="rhx-empty__hint">Créez un contrat de travail depuis la fiche d'un salarié (onglet Contrat &amp; Paie) pour l'inclure dans le cycle.</div>
              </div>
            </td></tr>
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
    mat-form-field.sm { max-width: 140px; }
    .prhh-body { display: flex; align-items: flex-start; gap: 24px; }
    .prhh-nav { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; width: 200px; background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; padding: 8px; box-shadow: var(--rhx-shadow); }
    .prhh-nav-item {
      display: flex; align-items: center; gap: 10px; border: none; background: none; cursor: pointer;
      padding: 10px 12px; font-size: 13px; font-weight: 500; color: #64748B; border-radius: 9px;
      text-align: left; width: 100%; transition: background .12s, color .12s;
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; color: #94A3B8; }
    }
    .prhh-nav-item:hover { color: #1E293B; background: #F8FAFC; }
    .prhh-nav-item.active { color: #6D28D9; background: #F5F3FF; font-weight: 700; mat-icon { color: #7C3AED; } }
    .prhh-content { flex: 1; min-width: 0; }
    .prhh-cycle-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .prhh-spacer { flex: 1; }
    .prhh-kpi-progress { margin-top: 8px; }
    .rhx-table td[routerLink] { cursor: pointer; }
  `],
})
export class PaieRhHubComponent implements OnInit {
  private paieRh = inject(PaieRhService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  readonly moisOptions = MOIS_LABEL.map((l, i) => ({ v: i + 1, l }));
  readonly etapes = ETAPES_CYCLE;

  tab = signal<HubTab>('cycle');
  today = new Date();
  mois = this.today.getMonth() + 1;
  annee = this.today.getFullYear();

  cycle = signal<CyclePaieRh | null>(null);
  salaries = signal<SalarieATraiter[]>([]);

  /* ── Présentation ─────────────────────────────────────────────────────────── */

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

  /** Index de l'étape courante dans le stepper (-1 si aucun cycle ouvert). */
  etapeIndex(): number {
    const c = this.cycle();
    return c ? ETAPES_CYCLE.findIndex((e) => e.code === c.statut) : -1;
  }

  nomComplet(s: SalarieATraiter): string {
    return s.salarie ? `${s.salarie.firstName} ${s.salarie.lastName}` : `#${s.salarieId}`;
  }

  initiales(s: SalarieATraiter): string {
    return s.salarie ? `${s.salarie.firstName?.[0] ?? ''}${s.salarie.lastName?.[0] ?? ''}`.toUpperCase() : '#';
  }

  avatarClasse(id: number): string {
    return `rhx-avatar--h${id % 6}`;
  }

  poleClasse(regime: string): string {
    if (regime === 'EST') return 'rhx-chip--violet';
    if (regime === 'OUEST') return 'rhx-chip--blue';
    return 'rhx-chip--muted';
  }

  /* ── Indicateurs (calculés sur la liste vivante, pas sur les compteurs figés du cycle) ── */

  nbBulletinsGeneres(): number {
    return this.salaries().filter((s) => s.bulletinId).length;
  }

  progressionBulletins(): number {
    const n = this.salaries().length;
    return n ? Math.round((this.nbBulletinsGeneres() / n) * 100) : 0;
  }

  /** Brut des bulletins générés ; repli sur le salaire de base du contrat pour les autres. */
  masseBrute(): number {
    return this.salaries().reduce((t, s) => t + (s.totalBrut ?? s.salaireBase ?? 0), 0);
  }

  netTotal(): number {
    return this.salaries().reduce((t, s) => t + (s.netAPayer ?? 0), 0);
  }

  chargesPatronales(): number {
    return this.salaries().reduce((t, s) => t + (s.totalCotisationsPatronales ?? 0), 0);
  }

  coutEmployeurTotal(): number {
    return this.salaries().reduce((t, s) => t + (s.coutEmployeur ?? 0), 0);
  }

  /* ── Chargement ───────────────────────────────────────────────────────────── */

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

  /* ── Actions ──────────────────────────────────────────────────────────────── */

  visualiserPdf(s: SalarieATraiter) {
    if (!s.bulletinId) return;
    this.paieRh.telechargerBulletinPdf(s.bulletinId).subscribe((blob) => {
      this.dialog.open(BulletinPdfPreviewDialogComponent, {
        panelClass: ['rounded-dialog', 'no-pad-dialog'],
        width: '900px', maxWidth: '96vw', height: '90vh', maxHeight: '90vh',
        data: { blob, titre: `Bulletin — ${this.nomComplet(s)}` },
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
