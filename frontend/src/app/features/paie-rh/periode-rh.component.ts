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
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  PaieRhService, CyclePaieRh, ExerciceRh, SalarieATraiter, StatutCyclePaieRh,
  STATUT_CYCLE_LABELS, deviseSymbole,
} from '../../core/services/paie-rh.service';

/** Étapes du cycle mensuel, dans l'ordre métier (voir StatutCyclePaieRh côté backend). */
const ETAPES_CYCLE: Array<{ code: StatutCyclePaieRh; label: string }> = [
  { code: 'OUVERT', label: 'Ouvert' },
  { code: 'CALCULE', label: 'Calculé' },
  { code: 'VALIDE', label: 'Validé' },
  { code: 'CLOTURE', label: 'Clôturé' },
];

const MOIS_LABEL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/**
 * "Période en cours" (~RADIAN : "Gestion des exercices" + "Changement de période de
 * travail") : cockpit d'ouverture/clôture de l'exercice RH ANNUEL de l'entreprise elle-même
 * (AFYM employeur — à ne pas confondre avec l'exercice comptable d'un dossier client, voir
 * `ExerciceRh` côté backend) et du cycle de paie mensuel en cours. Un cycle mensuel
 * (`CyclePaieRh`) ne peut être ouvert que sur une année dont l'exercice RH est OUVERT — voir
 * `CyclesPaieRhService.ouvrir()`. Accessible depuis /rh/periode.
 */
@Component({
  selector: 'app-periode-rh',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSnackBarModule, MatTooltipModule,
  ],
  template: `
<div class="pr-wrap">

  <div class="rhx-page-head">
    <div class="rhx-page-head__main">
      <div class="rhx-page-head__icon"><mat-icon>event_note</mat-icon></div>
      <div>
        <h1>Période en cours</h1>
        <p class="rhx-page-head__sub">Exercice RH annuel de l'entreprise et cycle de paie du mois.</p>
      </div>
    </div>
  </div>

  <!-- ═══ EXERCICE RH ═══ -->
  <div class="rhx-card">
    <div class="rhx-card__head">
      <div class="rhx-card__title"><mat-icon>event_note</mat-icon> Exercice RH</div>
      <div class="rhx-card__spacer"></div>
      @if (exerciceOuvert()) {
        <span class="rhx-chip rhx-chip--blue">Exercice {{ exerciceOuvert()!.annee }} — ouvert</span>
        <button mat-stroked-button color="warn" (click)="cloturerExercice()"><mat-icon>lock</mat-icon> Clôturer l'exercice</button>
      } @else {
        <mat-form-field appearance="outline" class="sm">
          <mat-label>Année</mat-label>
          <input matInput type="number" [(ngModel)]="nouvelleAnnee" />
        </mat-form-field>
        <button mat-flat-button color="primary" (click)="ouvrirExercice()"><mat-icon>lock_open</mat-icon> Ouvrir l'exercice {{ nouvelleAnnee }}</button>
      }
    </div>

    @if (exerciceOuvert()) {
      <div class="rhx-kpis pr-kpis">
        <div class="rhx-kpi rhx-kpi--blue">
          <div class="rhx-kpi__icon"><mat-icon>calendar_today</mat-icon></div>
          <div class="rhx-kpi__body">
            <div class="rhx-kpi__label">Exercice</div>
            <div class="rhx-kpi__value">{{ exerciceOuvert()!.annee }}</div>
            <div class="rhx-kpi__sub">du {{ exerciceOuvert()!.dateDebut | date:'dd/MM/yyyy' }} au {{ exerciceOuvert()!.dateFin | date:'dd/MM/yyyy' }}</div>
          </div>
        </div>
        <div class="rhx-kpi rhx-kpi--teal">
          <div class="rhx-kpi__icon"><mat-icon>task_alt</mat-icon></div>
          <div class="rhx-kpi__body">
            <div class="rhx-kpi__label">Mois clôturés</div>
            <div class="rhx-kpi__value">{{ nbMoisClotures() }} <small>/ 12</small></div>
            <div class="rhx-progress pr-kpi-progress"><div class="rhx-progress__bar rhx-progress__bar--teal" [style.width.%]="nbMoisClotures() / 12 * 100"></div></div>
          </div>
        </div>
        <div class="rhx-kpi rhx-kpi--amber">
          <div class="rhx-kpi__icon"><mat-icon>pending_actions</mat-icon></div>
          <div class="rhx-kpi__body">
            <div class="rhx-kpi__label">Cycles en cours</div>
            <div class="rhx-kpi__value">{{ nbCyclesEnCours() }}</div>
            <div class="rhx-kpi__sub">ouverts, calculés ou validés</div>
          </div>
        </div>
      </div>

      <div class="rhx-months">
        @for (m of moisOptions; track m.v) {
          <div class="rhx-month" [class]="'rhx-month rhx-month--' + (statutMois(m.v) ?? 'AUCUN')" [class.rhx-month--selected]="m.v === mois"
               (click)="selectionnerMois(m.v)" [matTooltip]="m.l + ' ' + annee + ' — ' + (statutMois(m.v) ? statutLabel(statutMois(m.v)!) : 'aucun cycle')">
            <div class="rhx-month__label">{{ abrevMois(m.v) }}</div>
            <div class="rhx-month__dot"></div>
          </div>
        }
      </div>
      <div class="rhx-legend pr-legend">
        <span class="rhx-legend__item"><span class="rhx-legend__dot" style="background:#3B82F6"></span> Ouvert</span>
        <span class="rhx-legend__item"><span class="rhx-legend__dot" style="background:#F59E0B"></span> Calculé</span>
        <span class="rhx-legend__item"><span class="rhx-legend__dot" style="background:#10B981"></span> Validé</span>
        <span class="rhx-legend__item"><span class="rhx-legend__dot" style="background:#475569"></span> Clôturé</span>
        <span class="rhx-legend__item"><span class="rhx-legend__dot" style="background:#E2E8F0"></span> Aucun cycle</span>
      </div>
    } @else {
      <div class="rhx-empty">
        <mat-icon>lock</mat-icon>
        <div class="rhx-empty__title">Aucun exercice RH ouvert</div>
        <div class="rhx-empty__hint">Aucun nouveau cycle de paie ne peut être ouvert tant qu'un exercice n'est pas créé.</div>
      </div>
    }

    @if (historique().length > 1) {
      <details class="pr-historique">
        <summary>Historique des exercices ({{ historique().length }})</summary>
        <table class="pr-table rhx-table">
          <thead><tr><th>Année</th><th>Début</th><th>Fin</th><th>Statut</th></tr></thead>
          <tbody>
            @for (e of historique(); track e.id) {
              <tr>
                <td class="strong">{{ e.annee }}</td>
                <td>{{ e.dateDebut | date:'dd/MM/yyyy' }}</td>
                <td>{{ e.dateFin | date:'dd/MM/yyyy' }}</td>
                <td><span class="rhx-chip badge-exercice" [class]="'rhx-chip badge-exercice ' + (e.statut === 'OUVERT' ? 'rhx-chip--blue' : 'rhx-chip--muted')" [attr.data-statut]="e.statut">{{ e.statut === 'OUVERT' ? 'Ouvert' : 'Clôturé' }}</span></td>
              </tr>
            }
          </tbody>
        </table>
      </details>
    }
  </div>

  <!-- ═══ CYCLE DU MOIS ═══ -->
  <div class="rhx-card">
    <div class="rhx-card__head">
      <div class="rhx-card__title"><mat-icon>event_repeat</mat-icon> Cycle de paie — {{ moisOptions[mois-1]?.l }} {{ annee }}</div>
      <div class="rhx-card__spacer"></div>
      <mat-form-field appearance="outline" class="sm">
        <mat-label>Mois</mat-label>
        <mat-select [(ngModel)]="mois" (ngModelChange)="reloadCycle()">
          @for (m of moisOptions; track m.v) { <mat-option [value]="m.v">{{ m.l }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="sm">
        <mat-label>Année</mat-label>
        <input matInput type="number" [(ngModel)]="annee" (ngModelChange)="onAnneeChange()" />
      </mat-form-field>
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

    <div class="pr-cycle-bar">
      @if (cycle()) {
        <span class="rhx-chip badge-cycle" [class]="'rhx-chip badge-cycle ' + statutChipClasse(cycle()!.statut)" [attr.data-statut]="cycle()!.statut">{{ statutLabel(cycle()!.statut) }}</span>
        <span class="rhx-stat">{{ nbBulletinsGeneres() }} / {{ salaries().length }} bulletins générés</span>
        <span class="rhx-stat">Net à payer total : <strong>{{ cycle()!.totalNetAPayer | number:'1.2-2' }} {{ deviseCommune() }}</strong></span>
        @if (!deviseCommune()) {
          <span class="rhx-chip rhx-chip--amber" matTooltip="Les salariés de ce cycle n'ont pas tous la même devise — un total additionné mélangerait des devises différentes, aucun symbole n'est affiché pour ne pas induire en erreur.">
            devises mélangées
          </span>
        }
      } @else {
        <span class="rhx-stat">Aucun cycle ouvert pour cette période.</span>
      }
      <div class="rhx-card__spacer"></div>
      @if (!cycle()) {
        <button mat-flat-button color="primary" (click)="ouvrirCycle()"><mat-icon>lock_open</mat-icon> Ouvrir la période</button>
      }
      <a mat-stroked-button routerLink="/rh/paie"><mat-icon>payments</mat-icon> Voir le détail dans Paie interne</a>
    </div>
  </div>

</div>
  `,
  styles: [`
    .pr-wrap { padding: 24px 28px 48px; max-width: 1200px; margin: 0 auto; }
    mat-form-field.sm { max-width: 140px; }
    .pr-kpis { margin-bottom: 16px; }
    .pr-kpi-progress { margin-top: 8px; }
    .pr-legend { margin-top: 10px; }
    .pr-historique { margin-top: 16px; }
    .pr-historique summary { cursor: pointer; font-size: 12.5px; font-weight: 600; color: #64748B; padding: 4px 0; }
    .pr-historique summary:hover { color: #7C3AED; }
    .pr-table { margin-top: 8px; }
    .pr-cycle-bar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  `],
})
export class PeriodeRhComponent implements OnInit {
  private paieRh = inject(PaieRhService);
  private snack = inject(MatSnackBar);

  readonly moisOptions = MOIS_LABEL.map((l, i) => ({ v: i + 1, l }));
  readonly etapes = ETAPES_CYCLE;

  today = new Date();
  mois = this.today.getMonth() + 1;
  annee = this.today.getFullYear();
  nouvelleAnnee = this.today.getFullYear();

  exerciceOuvert = signal<ExerciceRh | null>(null);
  historique = signal<ExerciceRh[]>([]);
  cycle = signal<CyclePaieRh | null>(null);
  salaries = signal<SalarieATraiter[]>([]);
  /** Tous les cycles du tenant — filtrés sur l'année sélectionnée pour la frise des 12 mois. */
  cycles = signal<CyclePaieRh[]>([]);

  ngOnInit() {
    this.reloadExercices();
    this.reloadCycles();
    this.reloadCycle();
  }

  reloadCycles() {
    this.paieRh.findCycles().subscribe({ next: (c) => this.cycles.set(c), error: () => this.cycles.set([]) });
  }

  /** Abréviations distinctes (Juin ≠ Juillet), là où slice(0,3) donnait « JUI » deux fois. */
  abrevMois(m: number): string {
    return ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'][m - 1];
  }

  onAnneeChange() { this.reloadCycle(); }

  selectionnerMois(m: number) { this.mois = m; this.reloadCycle(); }

  private cyclesAnnee(): CyclePaieRh[] { return this.cycles().filter((c) => c.annee === Number(this.annee)); }

  statutMois(m: number): StatutCyclePaieRh | null {
    return this.cyclesAnnee().find((c) => c.mois === m)?.statut ?? null;
  }

  nbMoisClotures(): number { return this.cyclesAnnee().filter((c) => c.statut === 'CLOTURE').length; }

  nbCyclesEnCours(): number { return this.cyclesAnnee().filter((c) => c.statut !== 'CLOTURE').length; }

  /** Index de l'étape courante dans le stepper (-1 si aucun cycle ouvert). */
  etapeIndex(): number {
    const c = this.cycle();
    return c ? ETAPES_CYCLE.findIndex((e) => e.code === c.statut) : -1;
  }

  statutChipClasse(s: StatutCyclePaieRh): string {
    if (s === 'OUVERT') return 'rhx-chip--blue';
    if (s === 'CALCULE') return 'rhx-chip--amber';
    if (s === 'VALIDE') return 'rhx-chip--teal';
    return 'rhx-chip--muted';
  }

  reloadExercices() {
    this.paieRh.findExerciceOuvert().subscribe((e) => this.exerciceOuvert.set(e));
    this.paieRh.findExercices().subscribe((list) => this.historique.set(list));
  }

  reloadCycle() {
    this.paieRh.findCycle(this.mois, this.annee).subscribe({
      next: (c) => this.cycle.set(c),
      error: () => this.cycle.set(null),
    });
    this.paieRh.listerSalariesATraiter(this.mois, this.annee).subscribe({
      next: (s) => this.salaries.set(s),
      error: () => this.salaries.set([]),
    });
  }

  statutLabel(s: StatutCyclePaieRh): string {
    return STATUT_CYCLE_LABELS[s] ?? s;
  }

  nbBulletinsGeneres(): number {
    return this.salaries().filter((s) => s.bulletinId).length;
  }

  /** Symbole commun si tous les salariés du cycle partagent la même devise, sinon '' (voir "devises mélangées"). */
  deviseCommune(): string {
    const devises = new Set(this.salaries().map((s) => s.salarie?.devise ?? 'EUR'));
    return devises.size === 1 ? deviseSymbole([...devises][0]) : '';
  }

  ouvrirExercice() {
    this.paieRh.creerExercice(Number(this.nouvelleAnnee)).subscribe({
      next: () => { this.reloadExercices(); this.snack.open(`Exercice RH ${this.nouvelleAnnee} ouvert`, undefined, { duration: 2500 }); },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3500 }),
    });
  }

  cloturerExercice() {
    const ex = this.exerciceOuvert();
    if (!ex) return;
    if (!confirm(`Clôturer l'exercice RH ${ex.annee} — confirmer ?`)) return;
    this.paieRh.cloturerExercice(ex.id).subscribe({
      next: () => { this.reloadExercices(); this.snack.open('Exercice RH clôturé', undefined, { duration: 2500 }); },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3500 }),
    });
  }

  ouvrirCycle() {
    this.paieRh.ouvrirCycle(this.mois, this.annee).subscribe({
      next: (c) => { this.cycle.set(c); this.reloadCycle(); this.reloadCycles(); this.snack.open('Période ouverte', undefined, { duration: 2500 }); },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3500 }),
    });
  }
}
