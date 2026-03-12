import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TasksService, Task, GrilleResult } from '../../../../../core/services/tasks.service';

const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const TYPES_MENSUELS = ['TVA', 'PAIE', 'ACHATS', 'VENTES', 'RB', 'GV'] as const;

@Component({
  selector: 'app-taches-tab',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatButtonModule, MatIconModule, MatTooltipModule, MatProgressBarModule,
  ],
  template: `
    <div class="grille-page">

      <!-- Barre de navigation année + lien gestion -->
      <div class="grille-header">
        <div class="year-nav">
          <button mat-icon-button (click)="changeAnnee(-1)" matTooltip="Année précédente">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <span class="year-label">{{ annee }}</span>
          <button mat-icon-button (click)="changeAnnee(1)" [disabled]="annee >= today.getFullYear()" matTooltip="Année suivante">
            <mat-icon>chevron_right</mat-icon>
          </button>
        </div>

        <!-- Progression globale -->
        <div class="global-progress">
          <span class="gp-label">Avancement global</span>
          <div class="gp-bar-wrap">
            <div class="gp-bar" [style.width.%]="progressionGlobale"></div>
          </div>
          <span class="gp-pct">{{ progressionGlobale }}%</span>
        </div>

        <a mat-stroked-button class="btn-manage" routerLink="/tasks">
          <mat-icon>open_in_new</mat-icon> Toutes les tâches
        </a>
      </div>

      @if (grille) {
        <div class="grille-wrap">
          <table class="grille-table">
            <thead>
              <tr>
                <th class="col-type">Type</th>
                @for (m of mois; track m.num) {
                  <th class="col-mois" [class.col-mois-current]="m.num === today.getMonth() + 1 && annee === today.getFullYear()">
                    {{ m.label }}
                  </th>
                }
                <th class="col-pct">%</th>
                <th class="col-note">Note</th>
              </tr>
            </thead>
            <tbody>

              <!-- Lignes mensuelles : TVA, PAIE, ACHATS, VENTES, RB, GV -->
              @for (type of typesMensuels; track type) {
                <tr class="grille-row">
                  <td class="col-type">
                    <span class="type-pill type-{{ type.toLowerCase() }}">{{ type }}</span>
                  </td>
                  @for (m of mois; track m.num) {
                    <td class="col-mois" [class.future]="isFuture(m.num)"
                        (click)="!isFuture(m.num) && toggle(type, m.num)"
                        [class.clickable]="!isFuture(m.num)">
                      <div class="cell" [class]="cellClass(type, m.num)">
                        @if (cellStatut(type, m.num) === 'TERMINEE') {
                          <mat-icon class="cell-icon">check</mat-icon>
                        } @else if (cellStatut(type, m.num) === 'NON_FAIT') {
                          <mat-icon class="cell-icon">close</mat-icon>
                        } @else if (!isFuture(m.num)) {
                          <span class="cell-dot"></span>
                        }
                      </div>
                    </td>
                  }
                  <td class="col-pct">
                    <div class="row-pct">
                      <div class="row-bar">
                        <div class="row-bar-fill" [style.width.%]="rowProgression(type)"></div>
                      </div>
                      <span>{{ rowProgression(type) }}%</span>
                    </div>
                  </td>
                  <td class="col-note">
                    @if (editingNote === type) {
                      <input class="note-input" [(ngModel)]="noteTemp" (blur)="saveNote(type)"
                             (keydown.enter)="saveNote(type)" (keydown.escape)="editingNote = null"
                             [autofocus]="true" />
                    } @else {
                      <span class="note-text" (click)="startEditNote(type)" matTooltip="Cliquer pour éditer">
                        {{ commentaires[type] || '—' }}
                      </span>
                    }
                  </td>
                </tr>
              }

              <!-- Séparateur DR -->
              <tr class="dr-separator">
                <td colspan="16"><span>Dossier de Révision</span></td>
              </tr>

              <!-- Ligne DR expandable -->
              <tr class="grille-row dr-row">
                <td class="col-type">
                  <button class="dr-toggle" (click)="drExpanded = !drExpanded">
                    <span class="type-pill type-dr">DR</span>
                    <mat-icon class="dr-arrow">{{ drExpanded ? 'expand_less' : 'expand_more' }}</mat-icon>
                  </button>
                </td>
                <!-- Cellule DR couvrant les 12 mois : barre de progression étapes -->
                <td class="dr-progress-cell" colspan="12">
                  <div class="dr-progress">
                    <div class="dr-bar-wrap">
                      <div class="dr-bar" [style.width.%]="drProgression"></div>
                    </div>
                    <span class="dr-count">
                      {{ drTerminees }} / {{ grille.drEtapes.length }} étapes
                    </span>
                  </div>
                </td>
                <td class="col-pct">{{ drProgression }}%</td>
                <td class="col-note">
                  @if (editingNote === 'DR') {
                    <input class="note-input" [(ngModel)]="noteTemp" (blur)="saveNote('DR')"
                           (keydown.enter)="saveNote('DR')" (keydown.escape)="editingNote = null"
                           [autofocus]="true" />
                  } @else {
                    <span class="note-text" (click)="startEditNote('DR')">
                      {{ commentaires['DR'] || '—' }}
                    </span>
                  }
                </td>
              </tr>

              <!-- Étapes DR dépliables -->
              @if (drExpanded) {
                @for (etape of grille.drEtapes; track etape.id) {
                  <tr class="dr-etape-row">
                    <td colspan="2" class="etape-label">
                      <mat-icon class="etape-bullet">subdirectory_arrow_right</mat-icon>
                      {{ etape.titre }}
                    </td>
                    <!-- Cellule statut cliquable sur toute la largeur restante -->
                    <td colspan="11" class="etape-cell" (click)="toggleEtape(etape)">
                      <span class="etape-statut" [class]="'es-' + etape.statut.toLowerCase()">
                        @if (etape.statut === 'TERMINEE') {
                          <mat-icon>check_circle</mat-icon> Fait
                        } @else {
                          <mat-icon>radio_button_unchecked</mat-icon> À faire
                        }
                      </span>
                    </td>
                    <td></td>
                    <td></td>
                  </tr>
                }
              }

            </tbody>
          </table>
        </div>

        <!-- Légende -->
        <div class="legende">
          <span class="leg-item"><span class="leg-cell cell-terminee"><mat-icon>check</mat-icon></span> Fait</span>
          <span class="leg-item"><span class="leg-cell cell-non_fait"><mat-icon>close</mat-icon></span> Non fait</span>
          <span class="leg-item"><span class="leg-cell"><span class="cell-dot"></span></span> À faire</span>
          <span class="leg-item"><span class="leg-cell future"></span> Mois à venir</span>
          <span class="leg-tip"><mat-icon>touch_app</mat-icon> Cliquer sur une cellule pour cocher / décocher</span>
        </div>
      } @else {
        <div class="loading">
          <mat-icon>hourglass_empty</mat-icon>
          <p>Chargement de la grille…</p>
        </div>
      }

    </div>
  `,
  styles: [`
    .grille-page { padding: 20px 24px; }

    /* Header */
    .grille-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
    .year-nav { display: flex; align-items: center; gap: 4px; }
    .year-label { font-size: 18px; font-weight: 800; color: #1e293b; min-width: 44px; text-align: center; }
    .global-progress { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 160px; }
    .gp-label { font-size: 12px; color: #64748b; white-space: nowrap; }
    .gp-bar-wrap { flex: 1; height: 8px; background: #e8ecf0; border-radius: 4px; overflow: hidden; }
    .gp-bar { height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 4px; transition: width .4s ease; }
    .gp-pct { font-size: 13px; font-weight: 700; color: #6366f1; min-width: 36px; text-align: right; }
    .btn-manage { border-radius: 9px !important; font-size: 12px; color: #6366f1 !important; border-color: #c7d2fe !important; gap: 4px; }
    .btn-manage mat-icon { font-size: 15px; width: 15px; height: 15px; }

    /* Table */
    .grille-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid #e8ecf0; background: white; box-shadow: 0 1px 3px rgba(0,0,0,.04); }
    .grille-table { width: 100%; border-collapse: collapse; }
    .grille-table thead tr { background: #f8fafc; border-bottom: 2px solid #e8ecf0; }
    .grille-table th { padding: 8px 6px; text-align: center; font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .3px; white-space: nowrap; }
    .col-type { text-align: left !important; padding-left: 14px !important; width: 90px; }
    .col-mois { width: 52px; }
    .col-mois-current { background: #f0f4ff; color: #4f46e5 !important; }
    .col-pct { width: 80px; }
    .col-note { min-width: 140px; text-align: left !important; }

    /* Rows */
    .grille-row { border-bottom: 1px solid #f1f5f9; }
    .grille-row:hover { background: #fafbff; }
    .grille-row td { padding: 7px 6px; vertical-align: middle; text-align: center; }
    .grille-row td.col-type { text-align: left; padding-left: 14px; }

    /* Type pills */
    .type-pill { font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 5px; white-space: nowrap; }
    .type-tva    { background: #fef9c3; color: #854d0e; }
    .type-paie   { background: #dbeafe; color: #1e40af; }
    .type-achats { background: #fce7f3; color: #9d174d; }
    .type-ventes { background: #dcfce7; color: #14532d; }
    .type-rb     { background: #ede9fe; color: #5b21b6; }
    .type-gv     { background: #fff7ed; color: #c2410c; }
    .type-dr     { background: #f1f5f9; color: #334155; }

    /* Cells */
    .col-mois.clickable { cursor: pointer; }
    .col-mois.future { opacity: .35; cursor: default; }
    .cell { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin: 0 auto; transition: all .12s; border: 1.5px solid transparent; }
    .clickable:hover .cell:not(.cell-terminee):not(.cell-non_fait) { background: #f0f4ff; border-color: #c7d2fe; }
    .cell-terminee { background: #dcfce7; border-color: #86efac; }
    .cell-terminee .cell-icon { color: #15803d; font-size: 16px; width: 16px; height: 16px; }
    .cell-non_fait { background: #fee2e2; border-color: #fca5a5; }
    .cell-non_fait .cell-icon { color: #dc2626; font-size: 16px; width: 16px; height: 16px; }
    .cell-dot { width: 7px; height: 7px; border-radius: 50%; background: #cbd5e1; }
    .clickable:hover .cell .cell-dot { background: #a5b4fc; }

    /* Progression par ligne */
    .row-pct { display: flex; align-items: center; gap: 6px; }
    .row-bar { flex: 1; height: 5px; background: #f1f5f9; border-radius: 3px; overflow: hidden; min-width: 40px; }
    .row-bar-fill { height: 100%; background: linear-gradient(90deg, #22c55e, #15803d); border-radius: 3px; transition: width .4s ease; }
    .row-pct span { font-size: 11px; font-weight: 600; color: #475569; min-width: 28px; text-align: right; }

    /* Note */
    .note-text { font-size: 12px; color: #64748b; cursor: pointer; padding: 2px 6px; border-radius: 5px; display: block; }
    .note-text:hover { background: #f1f5f9; color: #1e293b; }
    .note-input { width: 100%; font-size: 12px; border: 1.5px solid #a5b4fc; border-radius: 5px; padding: 3px 7px; outline: none; color: #1e293b; }

    /* Séparateur DR */
    .dr-separator td { padding: 6px 14px 4px; background: #f8fafc; border-top: 2px solid #e8ecf0; border-bottom: 1px solid #e8ecf0; }
    .dr-separator span { font-size: 10.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; }

    /* Ligne DR */
    .dr-row td { padding: 8px 6px; }
    .dr-toggle { display: flex; align-items: center; gap: 5px; background: none; border: none; cursor: pointer; padding: 0; }
    .dr-arrow { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; }
    .dr-progress-cell { text-align: left; padding-left: 10px !important; }
    .dr-progress { display: flex; align-items: center; gap: 10px; }
    .dr-bar-wrap { width: 140px; height: 7px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
    .dr-bar { height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 4px; transition: width .4s ease; }
    .dr-count { font-size: 11.5px; color: #64748b; white-space: nowrap; }

    /* Étapes DR */
    .dr-etape-row { background: #fafbff; border-bottom: 1px solid #f1f5f9; }
    .etape-label { text-align: left; padding: 6px 8px 6px 14px; font-size: 12px; color: #475569; display: flex; align-items: center; gap: 4px; }
    .etape-bullet { font-size: 14px; width: 14px; height: 14px; color: #cbd5e1; }
    .etape-cell { text-align: left; padding-left: 10px; cursor: pointer; }
    .etape-cell:hover { background: #f0f4ff; }
    .etape-statut { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
    .es-terminee { background: #dcfce7; color: #15803d; }
    .es-terminee mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .es-a_faire { background: #f1f5f9; color: #94a3b8; }
    .es-a_faire mat-icon { font-size: 15px; width: 15px; height: 15px; }

    /* Légende */
    .legende { display: flex; align-items: center; gap: 16px; margin-top: 14px; flex-wrap: wrap; }
    .leg-item { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: #64748b; }
    .leg-cell { width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1.5px solid #e8ecf0; }
    .leg-cell.cell-terminee { background: #dcfce7; border-color: #86efac; }
    .leg-cell.cell-terminee mat-icon { color: #15803d; font-size: 13px; width: 13px; height: 13px; }
    .leg-cell.cell-non_fait { background: #fee2e2; border-color: #fca5a5; }
    .leg-cell.cell-non_fait mat-icon { color: #dc2626; font-size: 13px; width: 13px; height: 13px; }
    .leg-cell.future { background: #f8fafc; opacity: .4; }
    .leg-tip { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #94a3b8; margin-left: auto; }
    .leg-tip mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .loading { display: flex; flex-direction: column; align-items: center; padding: 60px 0; color: #94a3b8; gap: 10px; }
    .loading mat-icon { font-size: 40px; width: 40px; height: 40px; }
  `],
})
export class TachesTabComponent implements OnInit {
  @Input() clientId!: number;
  private svc = inject(TasksService);

  grille: GrilleResult | null = null;
  commentaires: Record<string, string> = {};
  annee = new Date().getFullYear();
  today = new Date();
  drExpanded = false;
  editingNote: string | null = null;
  noteTemp = '';

  readonly typesMensuels = [...TYPES_MENSUELS];
  readonly mois = MOIS_LABELS.map((label, i) => ({ num: i + 1, label }));

  ngOnInit() { this.load(); }

  load() {
    this.grille = null;
    this.svc.getGrille(this.clientId, this.annee).subscribe(g => {
      this.grille = g;
      this.loadCommentaires();
    });
  }

  loadCommentaires() {
    // Les commentaires sont inclus dans les tâches sentinelles (mois=0) — on les extrait
    this.commentaires = {};
    if (!this.grille) return;
    // On récupère via une requête dédiée si nécessaire, sinon on les laisse vides au départ
    // (Le backend retourne uniquement les tâches mois>=1 dans findGrille)
    // TODO: enrichir findGrille pour inclure les commentaires
  }

  changeAnnee(delta: number) {
    this.annee += delta;
    this.load();
  }

  isFuture(mois: number): boolean {
    if (this.annee < this.today.getFullYear()) return false;
    if (this.annee > this.today.getFullYear()) return true;
    return mois > this.today.getMonth() + 1;
  }

  cellStatut(type: string, mois: number): string | null {
    return this.grille?.grille[type]?.[mois]?.statut ?? null;
  }

  cellClass(type: string, mois: number): string {
    const s = this.cellStatut(type, mois);
    if (s === 'TERMINEE') return 'cell cell-terminee';
    if (s === 'NON_FAIT') return 'cell cell-non_fait';
    return 'cell';
  }

  toggle(type: string, mois: number) {
    if (this.isFuture(mois)) return;
    this.svc.toggleMensuel(this.clientId, { type, mois, annee: this.annee }).subscribe(() => this.load());
  }

  toggleEtape(etape: Task) {
    this.svc.toggleDrEtape(this.clientId, etape.id).subscribe(() => this.load());
  }

  startEditNote(type: string) {
    this.editingNote = type;
    this.noteTemp = this.commentaires[type] ?? '';
  }

  saveNote(type: string) {
    this.commentaires[type] = this.noteTemp;
    this.editingNote = null;
    this.svc.updateCommentaire(this.clientId, type, this.annee, this.noteTemp).subscribe();
  }

  rowProgression(type: string): number {
    if (!this.grille) return 0;
    const pastMonths = this.mois.filter(m => !this.isFuture(m.num));
    if (pastMonths.length === 0) return 0;
    const done = pastMonths.filter(m => this.grille!.grille[type]?.[m.num]?.statut === 'TERMINEE').length;
    return Math.round((done / pastMonths.length) * 100);
  }

  get drTerminees(): number {
    return this.grille?.drEtapes.filter(e => e.statut === 'TERMINEE').length ?? 0;
  }

  get drProgression(): number {
    const total = this.grille?.drEtapes.length ?? 0;
    if (total === 0) return 0;
    return Math.round((this.drTerminees / total) * 100);
  }

  get progressionGlobale(): number {
    if (!this.grille) return 0;
    const pastMonths = this.mois.filter(m => !this.isFuture(m.num));
    if (pastMonths.length === 0) return 0;
    let done = 0, total = 0;
    for (const type of this.typesMensuels) {
      total += pastMonths.length;
      done += pastMonths.filter(m => this.grille!.grille[type]?.[m.num]?.statut === 'TERMINEE').length;
    }
    // Ajouter DR
    total += this.grille.drEtapes.length;
    done += this.drTerminees;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }
}
