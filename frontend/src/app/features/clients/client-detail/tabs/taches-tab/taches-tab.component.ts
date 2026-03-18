import { Component, Input, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TasksService, Task, GrilleResult } from '../../../../../core/services/tasks.service';

const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const TYPES_MENSUELS: { key: string; label: string; color: string }[] = [
  { key: 'TVA',    label: 'TVA',              color: 'tva'    },
  { key: 'PAIE',   label: 'Paie (SILAE)',     color: 'paie'   },
  { key: 'ACHATS', label: 'Achats',           color: 'achats' },
  { key: 'VENTES', label: 'Ventes',           color: 'ventes' },
  { key: 'RB',     label: 'Relevé Bancaire',  color: 'rb'     },
  { key: 'GV',     label: 'Grand Livre Ventes', color: 'gv'  },
];

@Component({
  selector: 'app-taches-tab',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatButtonModule, MatIconModule, MatTooltipModule,
  ],
  template: `
    <div class="grille-page">

      <!-- ── En-tête ── -->
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

        <div class="global-progress">
          <span class="gp-label">Avancement global</span>
          <div class="gp-bar-wrap">
            <div class="gp-bar" [style.width.%]="progressionGlobale"
                 [class]="progressionGlobale >= 80 ? 'gp-green' : progressionGlobale >= 50 ? 'gp-orange' : 'gp-bar'">
            </div>
          </div>
          <span class="gp-pct" [class]="progressionGlobale >= 80 ? 'pct-green' : progressionGlobale >= 50 ? 'pct-orange' : ''">
            {{ progressionGlobale }}%
          </span>
        </div>

        <a mat-stroked-button class="btn-manage" routerLink="/tasks">
          <mat-icon>open_in_new</mat-icon> Toutes les tâches
        </a>
      </div>

      @if (grille) {

        <!-- ── KPI bar ── -->
        <div class="kpi-bar">
          <div class="kpi-item kpi-done">
            <span class="kpi-val">{{ countDone }}</span>
            <span class="kpi-lbl">Faits</span>
          </div>
          <div class="kpi-item kpi-todo">
            <span class="kpi-val">{{ countTodo }}</span>
            <span class="kpi-lbl">À faire</span>
          </div>
          <div class="kpi-item kpi-nf">
            <span class="kpi-val">{{ countNonFait }}</span>
            <span class="kpi-lbl">Non fait</span>
          </div>
          <div class="kpi-item kpi-dr">
            <span class="kpi-val">{{ drTerminees }}/{{ grille.drEtapes.length }}</span>
            <span class="kpi-lbl">Cycles DR</span>
          </div>
        </div>

        <!-- ── Grille mensuelle ── -->
        <div class="grille-wrap">
          <table class="grille-table">
            <thead>
              <tr>
                <th class="col-type">Type</th>
                @for (m of mois; track m.num) {
                  <th class="col-mois" [class.col-mois-current]="isCurrentMonth(m.num)">
                    {{ m.label }}
                  </th>
                }
                <th class="col-pct">%</th>
                <th class="col-fini" matTooltip="Tout terminé ?">✓</th>
                <th class="col-note">Note</th>
              </tr>
            </thead>
            <tbody>

              <!-- Lignes mensuelles -->
              @for (type of typesMensuels; track type.key) {
                <tr class="grille-row">
                  <td class="col-type">
                    <div class="type-cell">
                      <span class="type-pill type-{{ type.color }}">{{ type.key }}</span>
                      <span class="type-label">{{ type.label }}</span>
                    </div>
                  </td>
                  @for (m of mois; track m.num) {
                    <td class="col-mois" [class.future]="isFuture(m.num)"
                        (click)="!isFuture(m.num) && toggle(type.key, m.num)"
                        [class.clickable]="!isFuture(m.num)">
                      <div class="cell" [class]="cellClass(type.key, m.num)">
                        @if (cellStatut(type.key, m.num) === 'TERMINEE') {
                          <mat-icon class="cell-icon">check</mat-icon>
                        } @else if (cellStatut(type.key, m.num) === 'NON_FAIT') {
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
                        <div class="row-bar-fill"
                             [style.width.%]="rowProgression(type.key)"
                             [class]="rowProgression(type.key) === 100 ? 'fill-green' : rowProgression(type.key) >= 50 ? 'fill-orange' : 'fill-red'">
                        </div>
                      </div>
                      <span>{{ rowProgression(type.key) }}%</span>
                    </div>
                  </td>
                  <td class="col-fini">
                    @if (isToutFini(type.key)) {
                      <span class="badge-fini" matTooltip="Tout terminé !">
                        <mat-icon>check_circle</mat-icon>
                      </span>
                    } @else {
                      <span class="badge-pending" [matTooltip]="'Encore ' + countPending(type.key) + ' mois à faire'">
                        <mat-icon>radio_button_unchecked</mat-icon>
                      </span>
                    }
                  </td>
                  <td class="col-note">
                    @if (editingNote === type.key) {
                      <input class="note-input" [(ngModel)]="noteTemp"
                             (blur)="saveNote(type.key)"
                             (keydown.enter)="saveNote(type.key)"
                             (keydown.escape)="editingNote = null"
                             [autofocus]="true" />
                    } @else {
                      <span class="note-text" (click)="startEditNote(type.key)"
                            [matTooltip]="grille.commentaires[type.key] ? grille.commentaires[type.key] : 'Cliquer pour ajouter une note'">
                        {{ grille.commentaires[type.key] || '—' }}
                      </span>
                    }
                  </td>
                </tr>
              }

              <!-- ── Séparateur DR ── -->
              <tr class="dr-separator">
                <td colspan="17"><span>Dossier de Révision (DR) — {{ drTerminees }}/{{ grille.drEtapes.length }} cycles</span></td>
              </tr>

              <!-- Ligne DR résumé cliquable -->
              <tr class="grille-row dr-row">
                <td class="col-type">
                  <button class="dr-toggle" (click)="drExpanded = !drExpanded" matTooltip="Voir les 16 cycles">
                    <span class="type-pill type-dr">DR</span>
                    <mat-icon class="dr-arrow">{{ drExpanded ? 'expand_less' : 'expand_more' }}</mat-icon>
                  </button>
                </td>
                <td class="dr-progress-cell" colspan="12">
                  <div class="dr-progress">
                    <div class="dr-bar-wrap">
                      <div class="dr-bar" [style.width.%]="drProgression"
                           [class]="drProgression === 100 ? 'dr-bar-green' : 'dr-bar'"></div>
                    </div>
                    <span class="dr-count">{{ drTerminees }} / {{ grille.drEtapes.length }} cycles terminés</span>
                  </div>
                </td>
                <td class="col-pct">{{ drProgression }}%</td>
                <td class="col-fini">
                  @if (drProgression === 100) {
                    <span class="badge-fini"><mat-icon>check_circle</mat-icon></span>
                  } @else {
                    <span class="badge-pending"><mat-icon>radio_button_unchecked</mat-icon></span>
                  }
                </td>
                <td class="col-note">
                  @if (editingNote === 'DR') {
                    <input class="note-input" [(ngModel)]="noteTemp"
                           (blur)="saveNote('DR')"
                           (keydown.enter)="saveNote('DR')"
                           (keydown.escape)="editingNote = null"
                           [autofocus]="true" />
                  } @else {
                    <span class="note-text" (click)="startEditNote('DR')">
                      {{ grille.commentaires['DR'] || '—' }}
                    </span>
                  }
                </td>
              </tr>

              <!-- Étapes DR dépliées (16 cycles) -->
              @if (drExpanded) {
                @for (etape of grille.drEtapes; track etape.id; let i = $index) {
                  <tr class="dr-etape-row">
                    <td colspan="2" class="etape-label">
                      <span class="etape-num">{{ i + 1 }}</span>
                      {{ etape.titre }}
                    </td>
                    <td colspan="11" class="etape-cell" (click)="toggleEtape(etape)">
                      <span class="etape-statut" [class]="'es-' + etape.statut.toLowerCase()">
                        @if (etape.statut === 'TERMINEE') {
                          <mat-icon>check_circle</mat-icon> Fait
                        } @else {
                          <mat-icon>radio_button_unchecked</mat-icon> À faire
                        }
                      </span>
                    </td>
                    <td></td><td></td>
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

      <!-- ── Tâches libres ── -->
      <div class="taches-libres">
        <div class="tl-header">
          <mat-icon>task_alt</mat-icon>
          <span>Tâches assignées</span>
          @if (taches.length > 0) {
            <span class="tl-count">{{ taches.length }}</span>
          }
          <a class="tl-link" routerLink="/tasks">
            <mat-icon>open_in_new</mat-icon> Voir tout
          </a>
        </div>

        @if (taches.length > 0) {
          <table class="tl-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tâche</th>
                <th>Type</th>
                <th>Collaborateur</th>
                <th>Échéance</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              @for (t of taches; track t.id) {
                <tr [class.tl-terminee]="t.statut === 'TERMINEE'">
                  <td><span class="tl-id">{{ t.taskId ?? '—' }}</span></td>
                  <td class="tl-titre">{{ t.titre }}</td>
                  <td>
                    @if (t.type) {
                      <span class="tl-type type-{{ t.type.toLowerCase() }}">{{ t.type }}</span>
                    } @else { <span class="none">—</span> }
                  </td>
                  <td class="tl-collab">
                    {{ t.assignee ? (t.assignee.firstName + ' ' + t.assignee.lastName) : '—' }}
                  </td>
                  <td class="tl-date">
                    @if (t.dateEcheance) {
                      <span [class.overdue]="isOverdue(t)">{{ formatDate(t.dateEcheance) }}</span>
                    } @else { — }
                  </td>
                  <td>
                    <select class="tl-statut statut-{{ t.statut.toLowerCase() }}"
                            [value]="t.statut"
                            (change)="changeStatut(t, $any($event.target).value)">
                      <option value="A_FAIRE">À faire</option>
                      <option value="EN_COURS">En cours</option>
                      <option value="TERMINEE">Terminée</option>
                      <option value="NON_FAIT">Non fait</option>
                      <option value="EN_ATTENTE">En attente</option>
                    </select>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        } @else {
          <div class="tl-empty">
            <mat-icon>inbox</mat-icon>
            <span>Aucune tâche assignée à ce dossier</span>
          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    .grille-page { padding: 24px; }

    /* ── En-tête ── */
    .grille-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
    .year-nav { display: flex; align-items: center; gap: 8px; }
    .year-label { font-size: 18px; font-weight: 800; color: #1e293b; min-width: 52px; text-align: center; }
    .global-progress { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 160px; }
    .gp-label { font-size: 12px; color: #64748b; white-space: nowrap; }
    .gp-bar-wrap { flex: 1; height: 8px; background: #e8ecf0; border-radius: 4px; overflow: hidden; }
    .gp-bar { height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 4px; transition: width .4s; }
    .gp-green { height: 100%; background: linear-gradient(90deg, #22c55e, #16a34a); border-radius: 4px; transition: width .4s; }
    .gp-orange { height: 100%; background: linear-gradient(90deg, #fb923c, #d97706); border-radius: 4px; transition: width .4s; }
    .gp-pct { font-size: 13px; font-weight: 700; color: #6366f1; min-width: 36px; text-align: right; }
    .pct-green  { color: #16a34a !important; }
    .pct-orange { color: #d97706 !important; }
    .btn-manage { border-radius: 9px !important; font-size: 12px; color: #6366f1 !important; border-color: #c7d2fe !important; gap: 4px; }
    .btn-manage mat-icon { font-size: 15px; width: 15px; height: 15px; }

    /* ── KPI bar ── */
    .kpi-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .kpi-item { display: flex; flex-direction: column; align-items: center; background: white; border: 1px solid #e8ecf0; border-radius: 12px; padding: 12px 20px; min-width: 88px; }
    .kpi-val { font-size: 20px; font-weight: 800; line-height: 1.1; }
    .kpi-lbl { font-size: 10px; color: #94a3b8; font-weight: 500; margin-top: 2px; }
    .kpi-done { border-color: #bbf7d0; }
    .kpi-done .kpi-val { color: #15803d; }
    .kpi-todo .kpi-val { color: #1d4ed8; }
    .kpi-nf { border-color: #fecaca; }
    .kpi-nf .kpi-val { color: #dc2626; }
    .kpi-dr { border-color: #c7d2fe; }
    .kpi-dr .kpi-val { color: #6366f1; }

    /* ── Table ── */
    .grille-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid #e8ecf0; background: white; box-shadow: 0 1px 3px rgba(0,0,0,.04); margin-bottom: 14px; }
    .grille-table { width: 100%; border-collapse: collapse; }
    .grille-table thead tr { background: #f8fafc; border-bottom: 2px solid #e8ecf0; }
    .grille-table th { padding: 10px 6px; text-align: center; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .3px; white-space: nowrap; }
    .col-type { text-align: left !important; padding-left: 16px !important; min-width: 168px; }
    .col-mois { width: 50px; }
    .col-mois-current { background: #f0f4ff; color: #4f46e5 !important; }
    .col-pct { width: 80px; }
    .col-fini { width: 36px; }
    .col-note { min-width: 130px; text-align: left !important; padding-left: 8px !important; }

    /* ── Rows ── */
    .grille-row { border-bottom: 1px solid #f1f5f9; }
    .grille-row:hover { background: #fafbff; }
    .grille-row td { padding: 8px 6px; vertical-align: middle; text-align: center; }
    .grille-row td.col-type { text-align: left; padding-left: 16px; }

    /* ── Type cell ── */
    .type-cell { display: flex; align-items: center; gap: 8px; }
    .type-label { font-size: 11.5px; color: #64748b; white-space: nowrap; }
    .type-pill { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; white-space: nowrap; flex-shrink: 0; }
    .type-tva    { background: #fef9c3; color: #854d0e; }
    .type-paie   { background: #dbeafe; color: #1e40af; }
    .type-achats { background: #fce7f3; color: #9d174d; }
    .type-ventes { background: #dcfce7; color: #14532d; }
    .type-rb     { background: #ede9fe; color: #5b21b6; }
    .type-gv     { background: #fff7ed; color: #c2410c; }
    .type-dr     { background: #f1f5f9; color: #334155; }

    /* ── Cells ── */
    .col-mois.clickable { cursor: pointer; }
    .col-mois.future { opacity: .3; cursor: default; }
    .cell { width: 30px; height: 30px; border-radius: 7px; display: flex; align-items: center; justify-content: center; margin: 0 auto; transition: all .12s; border: 1.5px solid transparent; }
    .clickable:hover .cell:not(.cell-terminee):not(.cell-non_fait) { background: #f0f4ff; border-color: #c7d2fe; }
    .cell-terminee { background: #dcfce7; border-color: #86efac; }
    .cell-terminee .cell-icon { color: #15803d; font-size: 15px; width: 15px; height: 15px; }
    .cell-non_fait { background: #fee2e2; border-color: #fca5a5; }
    .cell-non_fait .cell-icon { color: #dc2626; font-size: 15px; width: 15px; height: 15px; }
    .cell-dot { width: 6px; height: 6px; border-radius: 50%; background: #cbd5e1; }
    .clickable:hover .cell .cell-dot { background: #a5b4fc; }

    /* ── Progression ── */
    .row-pct { display: flex; align-items: center; gap: 5px; }
    .row-bar { flex: 1; height: 5px; background: #f1f5f9; border-radius: 3px; overflow: hidden; min-width: 36px; }
    .row-bar-fill { height: 100%; border-radius: 3px; transition: width .4s; }
    .fill-green  { background: linear-gradient(90deg, #22c55e, #15803d); }
    .fill-orange { background: linear-gradient(90deg, #fb923c, #d97706); }
    .fill-red    { background: linear-gradient(90deg, #f87171, #dc2626); }
    .row-pct span { font-size: 11px; font-weight: 600; color: #475569; min-width: 28px; text-align: right; }

    /* ── Tout fini ── */
    .badge-fini { display: flex; justify-content: center; }
    .badge-fini mat-icon { font-size: 17px; width: 17px; height: 17px; color: #15803d; }
    .badge-pending mat-icon { font-size: 17px; width: 17px; height: 17px; color: #e2e8f0; }

    /* ── Note ── */
    .note-text { font-size: 11.5px; color: #64748b; cursor: pointer; padding: 2px 5px; border-radius: 4px; display: block; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .note-text:hover { background: #f1f5f9; color: #1e293b; }
    .note-input { width: 100%; font-size: 12px; border: 1.5px solid #a5b4fc; border-radius: 5px; padding: 3px 7px; outline: none; color: #1e293b; }

    /* ── DR ── */
    .dr-separator td { padding: 6px 14px 4px; background: #f8fafc; border-top: 2px solid #e8ecf0; border-bottom: 1px solid #e8ecf0; }
    .dr-separator span { font-size: 10.5px; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: .5px; }
    .dr-row td { padding: 8px 5px; }
    .dr-toggle { display: flex; align-items: center; gap: 5px; background: none; border: none; cursor: pointer; padding: 0; }
    .dr-arrow { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; }
    .dr-progress-cell { text-align: left; padding-left: 10px !important; }
    .dr-progress { display: flex; align-items: center; gap: 10px; }
    .dr-bar-wrap { width: 160px; height: 7px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
    .dr-bar { height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 4px; transition: width .4s; }
    .dr-bar-green { height: 100%; background: linear-gradient(90deg, #22c55e, #15803d); border-radius: 4px; transition: width .4s; }
    .dr-count { font-size: 11.5px; color: #64748b; white-space: nowrap; }

    /* ── Étapes DR ── */
    .dr-etape-row { background: #fafbff; border-bottom: 1px solid #f1f5f9; }
    .etape-label { text-align: left; padding: 5px 8px 5px 14px !important; font-size: 12px; color: #475569; }
    .etape-num { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: #e8ecf0; color: #64748b; font-size: 9px; font-weight: 700; margin-right: 6px; flex-shrink: 0; }
    .etape-cell { text-align: left; padding-left: 10px !important; cursor: pointer; }
    .etape-cell:hover { background: #f0f4ff; }
    .etape-statut { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
    .es-terminee { background: #dcfce7; color: #15803d; }
    .es-terminee mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .es-a_faire { background: #f1f5f9; color: #94a3b8; }
    .es-a_faire mat-icon { font-size: 15px; width: 15px; height: 15px; }

    /* ── Légende ── */
    .legende { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-top: 12px; }
    .leg-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #64748b; }
    .leg-cell { width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center; border: 1.5px solid #e8ecf0; }
    .leg-cell.cell-terminee { background: #dcfce7; border-color: #86efac; }
    .leg-cell.cell-terminee mat-icon { color: #15803d; font-size: 12px; width: 12px; height: 12px; }
    .leg-cell.cell-non_fait { background: #fee2e2; border-color: #fca5a5; }
    .leg-cell.cell-non_fait mat-icon { color: #dc2626; font-size: 12px; width: 12px; height: 12px; }
    .leg-cell.future { background: #f8fafc; opacity: .4; }
    .leg-tip { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #94a3b8; margin-left: auto; }
    .leg-tip mat-icon { font-size: 13px; width: 13px; height: 13px; }

    .loading { display: flex; flex-direction: column; align-items: center; padding: 60px 0; color: #94a3b8; gap: 10px; }
    .loading mat-icon { font-size: 40px; width: 40px; height: 40px; }

    /* ── Tâches libres ── */
    .taches-libres { margin-top: 28px; }
    .tl-header { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 12px; }
    .tl-header mat-icon { font-size: 17px; width: 17px; height: 17px; color: #6366f1; }
    .tl-count { background: #6366f1; color: white; font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 20px; }
    .tl-link { display: flex; align-items: center; gap: 3px; margin-left: auto; font-size: 11.5px; color: #6366f1; text-decoration: none; font-weight: 600; }
    .tl-link mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .tl-link:hover { text-decoration: underline; }
    .tl-table { width: 100%; border-collapse: collapse; font-size: 12.5px; background: white; border: 1px solid #e8ecf0; border-radius: 10px; overflow: hidden; }
    .tl-table thead tr { background: #f8fafc; border-bottom: 2px solid #e8ecf0; }
    .tl-table th { padding: 8px 12px; text-align: left; font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .4px; white-space: nowrap; }
    .tl-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background .1s; }
    .tl-table tbody tr:last-child { border-bottom: none; }
    .tl-table tbody tr:hover { background: #fafbfc; }
    .tl-table td { padding: 8px 12px; color: #1e293b; vertical-align: middle; }
    .tl-terminee td { color: #94a3b8; }
    .tl-id { font-family: monospace; font-size: 11px; color: #94a3b8; background: #f1f5f9; padding: 2px 5px; border-radius: 4px; }
    .tl-titre { font-weight: 600; max-width: 220px; }
    .tl-collab { font-size: 12px; color: #475569; }
    .tl-date { font-size: 12px; color: #64748b; white-space: nowrap; }
    .tl-date .overdue { color: #dc2626; font-weight: 700; }
    .tl-type { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; }
    .tl-statut { border: none; outline: none; border-radius: 20px; padding: 3px 20px 3px 8px; font-size: 11px; font-weight: 700; cursor: pointer; appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2394a3b8'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 6px center; transition: opacity .15s; }
    .tl-statut:hover { opacity: .85; }
    .statut-a_faire   { background-color: #eff6ff; color: #1d4ed8; }
    .statut-en_cours  { background-color: #fffbeb; color: #d97706; }
    .statut-terminee  { background-color: #f0fdf4; color: #15803d; }
    .statut-non_fait  { background-color: #fff1f2; color: #e11d48; }
    .statut-en_attente { background-color: #f5f3ff; color: #7c3aed; }
    .type-tva    { background: #fef9c3; color: #854d0e; }
    .type-paie   { background: #dbeafe; color: #1e40af; }
    .type-achats { background: #fce7f3; color: #9d174d; }
    .type-ventes { background: #dcfce7; color: #14532d; }
    .type-rb     { background: #f0fdf4; color: #15803d; }
    .type-gv     { background: #ede9fe; color: #5b21b6; }
    .type-dr     { background: #fff7ed; color: #c2410c; }
    .type-autre  { background: #f1f5f9; color: #475569; }
    .tl-empty { display: flex; align-items: center; gap: 8px; padding: 20px 16px; background: #f8fafc; border: 1px dashed #e2e8f0; border-radius: 10px; color: #94a3b8; font-size: 13px; }
    .tl-empty mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .none { color: #cbd5e1; }
  `],
})
export class TachesTabComponent implements OnInit {
  @Input() clientId!: number;
  private svc = inject(TasksService);

  grille: GrilleResult | null = null;
  taches: Task[] = [];
  annee = new Date().getFullYear();
  today = new Date();
  drExpanded = false;
  editingNote: string | null = null;
  noteTemp = '';

  readonly typesMensuels = TYPES_MENSUELS;
  readonly mois = MOIS_LABELS.map((label, i) => ({ num: i + 1, label }));

  ngOnInit() {
    this.load();
    this.loadTaches();
  }

  load() {
    this.grille = null;
    this.svc.getGrille(this.clientId, this.annee).subscribe(g => {
      this.grille = g;
    });
  }

  loadTaches() {
    this.svc.getAll(this.clientId).subscribe(t => this.taches = t);
  }

  changeStatut(t: Task, statut: any) {
    const prev = t.statut;
    t.statut = statut;
    this.svc.update(this.clientId, t.id, { statut }).subscribe({
      error: () => t.statut = prev,
    });
  }

  isOverdue(t: Task): boolean {
    if (!t.dateEcheance || t.statut === 'TERMINEE') return false;
    return new Date(t.dateEcheance) < new Date();
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  changeAnnee(delta: number) {
    this.annee += delta;
    this.load();
  }

  isCurrentMonth(mois: number): boolean {
    return this.annee === this.today.getFullYear() && mois === this.today.getMonth() + 1;
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
    this.noteTemp = this.grille?.commentaires[type] ?? '';
  }

  saveNote(type: string) {
    if (this.grille) this.grille.commentaires[type] = this.noteTemp;
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

  isToutFini(type: string): boolean {
    if (!this.grille) return false;
    const pastMonths = this.mois.filter(m => !this.isFuture(m.num));
    if (pastMonths.length === 0) return false;
    return pastMonths.every(m => this.grille!.grille[type]?.[m.num]?.statut === 'TERMINEE');
  }

  countPending(type: string): number {
    if (!this.grille) return 0;
    return this.mois.filter(m => !this.isFuture(m.num) && this.grille!.grille[type]?.[m.num]?.statut !== 'TERMINEE').length;
  }

  get drTerminees(): number {
    return this.grille?.drEtapes.filter(e => e.statut === 'TERMINEE').length ?? 0;
  }

  get drProgression(): number {
    const total = this.grille?.drEtapes.length ?? 0;
    if (total === 0) return 0;
    return Math.round((this.drTerminees / total) * 100);
  }

  get countDone(): number {
    if (!this.grille) return 0;
    let n = 0;
    for (const type of this.typesMensuels) {
      for (let m = 1; m <= 12; m++) {
        if (this.grille.grille[type.key]?.[m]?.statut === 'TERMINEE') n++;
      }
    }
    n += this.drTerminees;
    return n;
  }

  get countTodo(): number {
    if (!this.grille) return 0;
    const pastMonths = this.mois.filter(m => !this.isFuture(m.num));
    let n = 0;
    for (const type of this.typesMensuels) {
      n += pastMonths.filter(m => !this.grille!.grille[type.key]?.[m.num]).length;
    }
    n += (this.grille.drEtapes.length - this.drTerminees);
    return n;
  }

  get countNonFait(): number {
    if (!this.grille) return 0;
    let n = 0;
    for (const type of this.typesMensuels) {
      for (let m = 1; m <= 12; m++) {
        if (this.grille.grille[type.key]?.[m]?.statut === 'NON_FAIT') n++;
      }
    }
    return n;
  }

  get progressionGlobale(): number {
    if (!this.grille) return 0;
    const pastMonths = this.mois.filter(m => !this.isFuture(m.num));
    if (pastMonths.length === 0) return 0;
    let done = 0, total = 0;
    for (const type of this.typesMensuels) {
      total += pastMonths.length;
      done += pastMonths.filter(m => this.grille!.grille[type.key]?.[m.num]?.statut === 'TERMINEE').length;
    }
    total += this.grille.drEtapes.length;
    done += this.drTerminees;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }
}
