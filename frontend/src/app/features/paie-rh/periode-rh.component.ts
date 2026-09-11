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

  <div class="pr-header">
    <div class="pr-header-main">
      <div class="pr-header-icon"><mat-icon>event_note</mat-icon></div>
      <div>
        <h1>Période en cours</h1>
        <p class="pr-sub">Exercice RH annuel de l'entreprise et cycle de paie du mois.</p>
      </div>
    </div>
  </div>

  <!-- ═══ EXERCICE RH ═══ -->
  <div class="pr-card">
    <div class="pr-card-title"><mat-icon>event_note</mat-icon> Exercice RH</div>

    @if (exerciceOuvert()) {
      <div class="pr-exercice-bar">
        <span class="badge-exercice" data-statut="OUVERT">Exercice {{ exerciceOuvert()!.annee }} — ouvert</span>
        <span class="pr-stat">Du {{ exerciceOuvert()!.dateDebut | date:'dd/MM/yyyy' }} au {{ exerciceOuvert()!.dateFin | date:'dd/MM/yyyy' }}</span>
        <div class="pr-spacer"></div>
        <button mat-stroked-button color="warn" (click)="cloturerExercice()"><mat-icon>lock</mat-icon> Clôturer l'exercice</button>
      </div>
    } @else {
      <div class="pr-exercice-bar">
        <span class="pr-stat">Aucun exercice RH ouvert — aucun nouveau cycle de paie ne peut être ouvert tant qu'un exercice n'est pas créé.</span>
        <div class="pr-spacer"></div>
        <mat-form-field appearance="outline" class="sm">
          <mat-label>Année</mat-label>
          <input matInput type="number" [(ngModel)]="nouvelleAnnee" />
        </mat-form-field>
        <button mat-flat-button color="primary" (click)="ouvrirExercice()"><mat-icon>lock_open</mat-icon> Ouvrir l'exercice {{ nouvelleAnnee }}</button>
      </div>
    }

    @if (historique().length) {
      <table class="pr-table">
        <thead><tr><th>Année</th><th>Début</th><th>Fin</th><th>Statut</th></tr></thead>
        <tbody>
          @for (e of historique(); track e.id) {
            <tr>
              <td>{{ e.annee }}</td>
              <td>{{ e.dateDebut | date:'dd/MM/yyyy' }}</td>
              <td>{{ e.dateFin | date:'dd/MM/yyyy' }}</td>
              <td><span class="badge-exercice" [attr.data-statut]="e.statut">{{ e.statut === 'OUVERT' ? 'Ouvert' : 'Clôturé' }}</span></td>
            </tr>
          }
        </tbody>
      </table>
    }
  </div>

  <!-- ═══ CYCLE DU MOIS ═══ -->
  <div class="pr-card">
    <div class="pr-card-title"><mat-icon>event_repeat</mat-icon> Cycle de paie du mois</div>

    <div class="pr-periode">
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

    <div class="pr-cycle-bar">
      @if (cycle()) {
        <span class="badge-cycle" [attr.data-statut]="cycle()!.statut">{{ statutLabel(cycle()!.statut) }}</span>
        <span class="pr-stat">{{ nbBulletinsGeneres() }} / {{ salaries().length }} bulletins générés</span>
        <span class="pr-stat">Net à payer total : {{ cycle()!.totalNetAPayer | number:'1.2-2' }} {{ deviseCommune() }}</span>
        @if (!deviseCommune()) {
          <span class="pr-stat pr-stat--warn" matTooltip="Les salariés de ce cycle n'ont pas tous la même devise — un total additionné mélangerait des devises différentes, aucun symbole n'est affiché pour ne pas induire en erreur.">
            <mat-icon>warning</mat-icon> devises mélangées
          </span>
        }
      } @else {
        <span class="pr-stat">Aucun cycle ouvert pour cette période.</span>
      }
      <div class="pr-spacer"></div>
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
    .pr-header { margin-bottom: 18px; }
    .pr-header-main { display: flex; align-items: center; gap: 12px; }
    .pr-header-icon { width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #7C3AED, #6D28D9);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 3px 10px rgba(109,40,217,.25);
      mat-icon { color: #fff; font-size: 22px; width: 22px; height: 22px; } }
    .pr-header h1 { font-size: 20px; font-weight: 700; color: #1E293B; margin: 0 0 4px; }
    .pr-sub { font-size: 12px; color: #94A3B8; margin: 0; max-width: 640px; }
    .pr-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .pr-card-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #1E293B; margin-bottom: 14px;
      mat-icon { color: #7C3AED; font-size: 20px; width: 20px; height: 20px; } }
    .pr-exercice-bar, .pr-cycle-bar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 10px; }
    .pr-periode { display: flex; gap: 10px; margin-bottom: 12px; }
    mat-form-field.sm { max-width: 140px; }
    .pr-spacer { flex: 1; }
    .pr-stat { font-size: 12px; color: #64748B; }
    .pr-stat--warn { display: inline-flex; align-items: center; gap: 4px; color: #B45309;
      mat-icon { font-size: 15px; width: 15px; height: 15px; } }
    .badge-exercice, .badge-cycle { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 10px; background: #F1F5F9; color: #64748B; }
    .badge-exercice[data-statut="OUVERT"] { background: #DBEAFE; color: #1D4ED8; }
    .badge-exercice[data-statut="CLOTURE"] { background: #E2E8F0; color: #334155; }
    .badge-cycle[data-statut="OUVERT"] { background: #DBEAFE; color: #1D4ED8; }
    .badge-cycle[data-statut="CALCULE"] { background: #FEF3C7; color: #92400E; }
    .badge-cycle[data-statut="VALIDE"] { background: #D1FAE5; color: #047857; }
    .badge-cycle[data-statut="CLOTURE"] { background: #E2E8F0; color: #334155; }
    .pr-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
    .pr-table th { text-align: left; color: #94A3B8; font-size: 11px; text-transform: uppercase; padding: 6px 8px; border-bottom: 1px solid #E2E8F0; }
    .pr-table td { padding: 8px; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
  `],
})
export class PeriodeRhComponent implements OnInit {
  private paieRh = inject(PaieRhService);
  private snack = inject(MatSnackBar);

  readonly moisOptions = MOIS_LABEL.map((l, i) => ({ v: i + 1, l }));

  today = new Date();
  mois = this.today.getMonth() + 1;
  annee = this.today.getFullYear();
  nouvelleAnnee = this.today.getFullYear();

  exerciceOuvert = signal<ExerciceRh | null>(null);
  historique = signal<ExerciceRh[]>([]);
  cycle = signal<CyclePaieRh | null>(null);
  salaries = signal<SalarieATraiter[]>([]);

  ngOnInit() {
    this.reloadExercices();
    this.reloadCycle();
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
      next: (c) => { this.cycle.set(c); this.reloadCycle(); this.snack.open('Période ouverte', undefined, { duration: 2500 }); },
      error: (e) => this.snack.open(e?.error?.message || 'Erreur', undefined, { duration: 3500 }),
    });
  }
}
