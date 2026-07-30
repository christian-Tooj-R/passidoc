import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  CongesAbsencesService, CalendrierAbsence, SoldeConge,
  TYPE_CONGE_LABELS, TypeConge,
} from '../../core/services/conges-absences.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';

const MOIS_LABELS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];
const JOURS_COURTS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];


function isoWeek(d: Date): number {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil((((dt.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

interface DayInfo {
  num:       number;
  date:      Date;
  short:     string;
  isWeekend: boolean;
  isToday:   boolean;
  week:      number;
  showWeek:  boolean;
}

interface CollabRow {
  userId:    number;
  firstName: string;
  lastName:  string;
  site:      string;
  absences:  CalendrierAbsence[];
}

interface SiteGroup {
  site:   string;
  label:  string;
  flag:   string;
  rows:   CollabRow[];
}

@Component({
  selector: 'app-conges-calendrier',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule, FormsModule, RouterModule],
  template: `
<div class="agenda-shell">

  <!-- ── ZONE PRINCIPALE ─────────────────────────────────────────── -->
  <div class="agenda-main">

    <!-- Toolbar -->
    <div class="agenda-toolbar">
      <div class="toolbar-left">
        <button mat-icon-button (click)="prevMois()" matTooltip="Mois précédent">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <span class="period-pill">{{ moisLabel() }}</span>
        <button mat-icon-button (click)="nextMois()" matTooltip="Mois suivant">
          <mat-icon>chevron_right</mat-icon>
        </button>
        <button class="btn-today" (click)="goToday()">Aujourd'hui</button>
      </div>
      <div class="toolbar-right">
        <button class="btn-demande" routerLink="/rh/conges">
          <mat-icon>add</mat-icon>
          Faire une demande d'absence
        </button>
      </div>
    </div>

    <!-- Filtres -->
    <div class="agenda-filters">
      <div class="search-wrap">
        <mat-icon class="search-icon">search</mat-icon>
        <input class="search-input" [(ngModel)]="search" placeholder="Rechercher un collaborateur…">
        @if (search) {
          <button class="search-clear" (click)="search = ''">
            <mat-icon>close</mat-icon>
          </button>
        }
      </div>
      <div class="site-chips">
        <button class="site-chip" [class.active]="siteFilter === ''"           (click)="setSite('')">Tous les sites</button>
        <button class="site-chip" [class.active]="siteFilter === 'REUNION'"    (click)="setSite('REUNION')">{{ tenantSvc.poleFlag1() }} {{ tenantSvc.poleLabel1() }}</button>
        <button class="site-chip" [class.active]="siteFilter === 'MADAGASCAR'" (click)="setSite('MADAGASCAR')">{{ tenantSvc.poleFlag2() }} {{ tenantSvc.poleLabel2() }}</button>
      </div>
    </div>

    <!-- Grille Gantt -->
    @if (loading()) {
      <div class="cal-loading">
        <mat-icon class="spin">refresh</mat-icon>
        <span>Chargement du planning…</span>
      </div>
    } @else if (totalRows() === 0) {
      <div class="cal-empty">
        <mat-icon>event_available</mat-icon>
        <p>Aucune absence ce mois-ci.</p>
      </div>
    } @else {
      <div class="cal-grid-wrap">
        <div class="cal-grid" [style.grid-template-columns]="'220px repeat(' + nbJours() + ', minmax(28px, 1fr))'">

          <!-- ── En-tête ── -->
          <div class="ch-name">Collaborateur</div>
          @for (d of joursDuMois(); track d.num) {
            <div class="ch-day"
                 [class.ch-day--weekend]="d.isWeekend"
                 [class.ch-day--today]="d.isToday">
              @if (d.showWeek) {
                <span class="week-badge">S{{ d.week }}</span>
              }
              <span class="day-short">{{ d.short }}</span>
              <span class="day-num">{{ d.num }}</span>
            </div>
          }

          <!-- ── Groupes par site ── -->
          @for (grp of filteredGroups(); track grp.site) {
            <!-- En-tête de groupe -->
            <div class="grp-header" (click)="toggleGroup(grp.site)">
              <mat-icon class="grp-toggle">{{ isCollapsed(grp.site) ? 'chevron_right' : 'expand_more' }}</mat-icon>
              <span class="grp-flag">{{ grp.flag }}</span>
              <span class="grp-label">{{ grp.label }}</span>
              <span class="grp-count">{{ grp.rows.length }} personne{{ grp.rows.length > 1 ? 's' : '' }}</span>
            </div>
            @for (d of joursDuMois(); track d.num) {
              <div class="grp-cell" [class.grp-cell--weekend]="d.isWeekend"></div>
            }

            <!-- Lignes collaborateurs -->
            @if (!isCollapsed(grp.site)) {
              @for (row of grp.rows; track row.userId) {
                <div class="cr-name">
                  <div class="avatar">{{ row.firstName[0] }}{{ row.lastName[0] }}</div>
                  <div class="cr-name__text">
                    <span class="cr-last">{{ row.lastName }}</span>
                    <span class="cr-first">{{ row.firstName }}</span>
                  </div>
                </div>
                @for (d of joursDuMois(); track d.num) {
                  <div class="cal-cell"
                       [class.cal-cell--weekend]="d.isWeekend"
                       [class.cal-cell--today]="d.isToday"
                       [class.cal-cell--absent]="isApproved(row, d.date)"
                       [class.cal-cell--pending]="isPending(row, d.date)"
                       [class.cal-cell--start]="isStart(row, d.date)"
                       [class.cal-cell--end]="isEnd(row, d.date)"
                       [matTooltip]="getTooltip(row, d.date)"
                       matTooltipClass="agenda-tooltip">
                    @if (isStart(row, d.date)) {
                      <span class="abs-label">{{ getTypeLabel(row, d.date) }}</span>
                    }
                  </div>
                }
              }
            }
          }

        </div>
      </div>

      <!-- Légende -->
      <div class="cal-legend">
        <div class="legend-item">
          <span class="legend-dot legend-dot--approved"></span>
          <span>Absence approuvée</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot legend-dot--pending"></span>
          <span>En attente de validation</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot legend-dot--today"></span>
          <span>Aujourd'hui</span>
        </div>
      </div>
    }

  </div>

  <!-- ── PANNEAU DROIT — Solde disponible ────────────────────────── -->
  <div class="agenda-side">
    <div class="side-header">
      <span class="side-title">Solde disponible</span>
      <span class="side-year">{{ annee() }}</span>
    </div>

    @if (soldesAffichees().length === 0) {
      <div class="side-empty">Aucun solde configuré</div>
    }

    @for (s of soldesAffichees(); track s.typeConge) {
      <div class="solde-card">
        <div class="solde-card__header">
          <span class="solde-type">{{ typeLabel(s.typeConge) }}</span>
        </div>
        <div class="solde-card__big">{{ s.solde | number:'1.0-1' }}</div>
        <div class="solde-card__rows">
          <div class="solde-row">
            <span class="solde-row__key">Acquis</span>
            <span class="solde-row__val">{{ s.joursAcquis | number:'1.0-1' }}</span>
          </div>
          <div class="solde-row">
            <span class="solde-row__key">Planifié</span>
            <span class="solde-row__val pending">{{ s.joursEnAttente | number:'1.0-1' }}</span>
          </div>
          <div class="solde-row">
            <span class="solde-row__key">Pris</span>
            <span class="solde-row__val taken">{{ s.joursPris | number:'1.0-1' }}</span>
          </div>
        </div>
      </div>
    }
  </div>

</div>

<!-- Toast email action -->
@if (emailActionMsg()) {
  <div class="email-toast" [class.email-toast--ok]="emailActionOk()" [class.email-toast--err]="!emailActionOk()">
    <mat-icon>{{ emailActionOk() ? 'check_circle' : 'error' }}</mat-icon>
    <span>{{ emailActionMsg() }}</span>
  </div>
}
`,
  styles: [`
:host { display: block; height: 100%; overflow: hidden; }

/* ── Shell ──────────────────────────────────────── */
.agenda-shell {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: #F0EEFF;
}

/* ── Zone principale ────────────────────────────── */
.agenda-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 24px 24px 16px;
  gap: 16px;
  overflow: hidden;
}

/* ── Toolbar ─────────────────────────────────────── */
.agenda-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.period-pill {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  min-width: 160px;
  text-align: center;
}
.btn-today {
  background: transparent;
  border: 1px solid #CBD5E1;
  border-radius: 20px;
  padding: 5px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: background .12s, color .12s;
}
.btn-today:hover { background: #fff; color: #1e293b; }

.btn-demande {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #7C3AED;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background .12s;
  mat-icon { font-size: 18px; width: 18px; height: 18px; }
}
.btn-demande:hover { background: #6D28D9; }

/* ── Filtres ─────────────────────────────────────── */
.agenda-filters {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 6px 10px;
  min-width: 220px;
}
.search-icon { font-size: 18px; width: 18px; height: 18px; color: #94A3B8; flex-shrink: 0; }
.search-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 13px;
  color: #1e293b;
  background: transparent;
}
.search-input::placeholder { color: #94A3B8; }
.search-clear {
  background: none; border: none; cursor: pointer; padding: 0; color: #94A3B8; display: flex;
  mat-icon { font-size: 16px; width: 16px; height: 16px; }
}
.site-chips { display: flex; gap: 6px; }
.site-chip {
  border: 1px solid #E2E8F0;
  background: #fff;
  border-radius: 20px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #64748B;
  cursor: pointer;
  transition: all .12s;
}
.site-chip:hover  { border-color: #7C3AED; color: #7C3AED; }
.site-chip.active { background: #EDE9F8; border-color: #7C3AED; color: #5B21B6; font-weight: 600; }

/* ── Grid ────────────────────────────────────────── */
.cal-grid-wrap {
  flex: 1;
  overflow: auto;
  border-radius: 12px;
  border: 1px solid #E2E8F0;
  background: #fff;
  min-height: 0;
}
.cal-grid {
  display: grid;
  min-width: 700px;
}

/* En-tête */
.ch-name {
  padding: 10px 14px;
  background: #F8FAFC;
  border-bottom: 2px solid #E2E8F0;
  border-right: 1px solid #E2E8F0;
  font-size: 11px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .6px;
  position: sticky;
  left: 0;
  z-index: 3;
}
.ch-day {
  padding: 5px 3px 4px;
  background: #F8FAFC;
  border-bottom: 2px solid #E2E8F0;
  border-right: 1px solid #EEF2F7;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 28px;
}
.ch-day--weekend { background: #F1F5F9; }
.ch-day--today   { background: #DCFCE7; }

.week-badge {
  font-size: 8px;
  font-weight: 700;
  color: #7C3AED;
  background: #EDE9F8;
  border-radius: 3px;
  padding: 0 3px;
  line-height: 13px;
  display: block;
  margin-bottom: 1px;
}
.day-short {
  font-size: 9px;
  color: #94A3B8;
  text-transform: uppercase;
  font-weight: 500;
  line-height: 1;
}
.day-num {
  font-size: 12px;
  font-weight: 700;
  color: #374151;
  line-height: 1;
}
.ch-day--today .day-num {
  color: #15803d;
}

/* Groupe (site) */
.grp-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: #F5F3FF;
  border-bottom: 1px solid #EDE9F8;
  border-right: 1px solid #E2E8F0;
  font-size: 12px;
  font-weight: 600;
  color: #5B21B6;
  cursor: pointer;
  position: sticky;
  left: 0;
  z-index: 2;
  user-select: none;
  transition: background .1s;
}
.grp-header:hover { background: #EDE9F8; }
.grp-toggle { font-size: 16px; width: 16px; height: 16px; color: #7C3AED; flex-shrink: 0; }
.grp-flag { font-size: 14px; }
.grp-label { flex: 1; }
.grp-count {
  font-size: 11px;
  font-weight: 500;
  color: #7C3AED;
  background: #EDE9F8;
  border-radius: 10px;
  padding: 1px 7px;
}
.grp-cell {
  background: #F5F3FF;
  border-bottom: 1px solid #EDE9F8;
  border-right: 1px solid #EEF2F7;
  min-height: 32px;
}
.grp-cell--weekend { background: #F0EEF8; }

/* Ligne collaborateur */
.cr-name {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 14px;
  border-bottom: 1px solid #F1F5F9;
  border-right: 1px solid #E2E8F0;
  background: #fff;
  position: sticky;
  left: 0;
  z-index: 1;
  white-space: nowrap;
  min-height: 44px;
}
.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #15803d;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.cr-name__text { display: flex; flex-direction: column; gap: 1px; }
.cr-last  { font-size: 13px; font-weight: 600; color: #1e293b; line-height: 1.2; }
.cr-first { font-size: 11px; color: #64748B; line-height: 1; }

/* Cellules */
.cal-cell {
  border-bottom: 1px solid #F1F5F9;
  border-right: 1px solid #F1F5F9;
  min-height: 44px;
  position: relative;
  overflow: hidden;
}
.cal-cell--weekend { background: #FAFAFA; }
.cal-cell--today   { background: #F0FDF4; }

.cal-cell--absent {
  background: #16a34a;
  border-right-color: #16a34a;
}
.cal-cell--absent.cal-cell--weekend { background: #15803d; }
.cal-cell--pending {
  background: #f59e0b;
  border-right-color: #f59e0b;
}
.cal-cell--pending.cal-cell--weekend { background: #d97706; }

.cal-cell--start { border-radius: 4px 0 0 4px; margin-left: 2px; }
.cal-cell--end   { border-radius: 0 4px 4px 0; margin-right: 2px; }

.abs-label {
  position: absolute;
  left: 5px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
  pointer-events: none;
  letter-spacing: .1px;
}
.cal-cell--pending .abs-label { color: #78350f; }

/* Loading / empty */
.cal-loading, .cal-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 64px;
  color: #9CA3AF;
  flex: 1;
}
.cal-loading mat-icon, .cal-empty mat-icon { font-size: 40px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Légende */
.cal-legend {
  display: flex;
  gap: 20px;
  padding: 0 2px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #6B7280; }
.legend-dot { width: 14px; height: 14px; border-radius: 3px; flex-shrink: 0; }
.legend-dot--approved { background: #16a34a; }
.legend-dot--pending  { background: #f59e0b; }
.legend-dot--today    { background: #DCFCE7; border: 1px solid #86EFAC; }

/* ── Panneau droit ──────────────────────────────── */
.agenda-side {
  width: 260px;
  flex-shrink: 0;
  background: #fff;
  border-left: 1px solid #E8E4F4;
  display: flex;
  flex-direction: column;
  padding: 20px 16px;
  gap: 12px;
  overflow-y: auto;
}
.side-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.side-title {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}
.side-year {
  font-size: 12px;
  color: #94A3B8;
  font-weight: 500;
}
.side-empty {
  font-size: 13px;
  color: #94A3B8;
  padding: 16px 0;
  text-align: center;
}

.solde-card {
  border: 1px solid #EDE9F8;
  border-radius: 10px;
  padding: 14px;
  background: #FAFBFF;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.solde-card__header { }
.solde-type {
  font-size: 12px;
  font-weight: 600;
  color: #5B21B6;
  text-transform: uppercase;
  letter-spacing: .4px;
}
.solde-card__big {
  font-size: 32px;
  font-weight: 800;
  color: #1e293b;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.solde-card__rows { display: flex; flex-direction: column; gap: 4px; border-top: 1px solid #EDE9F8; padding-top: 8px; }
.solde-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
.solde-row__key { color: #64748B; }
.solde-row__val { font-weight: 700; color: #1e293b; font-variant-numeric: tabular-nums; }
.solde-row__val.pending { color: #d97706; }
.solde-row__val.taken   { color: #dc2626; }

/* ── Toast email ─────────────────────────────────── */
.email-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(0,0,0,.15);
  z-index: 9999;
  animation: slideUp .3s ease;
}
.email-toast--ok  { background: #16a34a; color: #fff; }
.email-toast--err { background: #dc2626; color: #fff; }
@keyframes slideUp {
  from { transform: translateX(-50%) translateY(20px); opacity: 0; }
  to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
}

/* ── Dark mode ───────────────────────────────────── */
@media (prefers-color-scheme: dark) {
  .agenda-shell    { background: #0f172a; }
  .agenda-side     { background: #1e293b; border-color: #334155; }
  .period-pill     { background: #1e293b; border-color: #334155; color: #f1f5f9; }
  .btn-today       { border-color: #334155; color: #94a3b8; }
  .btn-today:hover { background: #1e293b; color: #f1f5f9; }
  .search-wrap     { background: #1e293b; border-color: #334155; }
  .search-input    { color: #f1f5f9; }
  .site-chip       { background: #1e293b; border-color: #334155; color: #94a3b8; }
  .site-chip.active{ background: #2d1b69; border-color: #7c3aed; color: #c4b5fd; }
  .cal-grid-wrap   { background: #1e293b; border-color: #334155; }
  .ch-name         { background: #0f172a; border-color: #334155; color: #64748b; }
  .ch-day          { background: #0f172a; border-color: #334155; }
  .ch-day--weekend { background: #1a2235; }
  .ch-day--today   { background: #14532d; }
  .day-num         { color: #e2e8f0; }
  .day-short       { color: #64748b; }
  .ch-day--today .day-num { color: #4ade80; }
  .grp-header      { background: #1a1040; border-color: #2d1b69; color: #c4b5fd; }
  .grp-header:hover{ background: #2d1b69; }
  .grp-cell        { background: #1a1040; border-color: #2d1b69; }
  .cr-name         { background: #1e293b; border-color: #334155; }
  .cr-last         { color: #f1f5f9; }
  .cr-first        { color: #64748b; }
  .cal-cell        { border-color: #334155; }
  .cal-cell--weekend{ background: #172030; }
  .cal-cell--today  { background: #14532d; }
  .side-title      { color: #f1f5f9; }
  .solde-card      { background: #1a2235; border-color: #334155; }
  .solde-type      { color: #c4b5fd; }
  .solde-card__big { color: #f1f5f9; }
  .solde-row__key  { color: #94a3b8; }
  .solde-row__val  { color: #f1f5f9; }
  .legend-item     { color: #94a3b8; }
}
`],
})
export class CongesCalendrierComponent implements OnInit {
  private cSvc  = inject(CongesAbsencesService);
  private auth  = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router= inject(Router);
  tenantSvc     = inject(TenantService);

  today = new Date();
  mois  = signal(this.today.getMonth() + 1);
  annee = signal(this.today.getFullYear());

  siteFilter = '';
  search     = '';

  loading  = signal(false);
  absences = signal<CalendrierAbsence[]>([]);
  soldes   = signal<SoldeConge[]>([]);

  emailActionMsg = signal('');
  emailActionOk  = signal(false);

  private collapsedSites = signal<Set<string>>(new Set());

  moisLabel = computed(() => `${MOIS_LABELS[this.mois() - 1]} ${this.annee()}`);
  nbJours   = computed(() => new Date(this.annee(), this.mois(), 0).getDate());

  joursDuMois = computed<DayInfo[]>(() => {
    const n     = this.nbJours();
    const today = new Date();
    let lastWeek = -1;
    return Array.from({ length: n }, (_, i) => {
      const d    = new Date(this.annee(), this.mois() - 1, i + 1);
      const dow  = d.getDay();
      const week = isoWeek(d);
      const showWeek = week !== lastWeek;
      lastWeek = week;
      return {
        num: i + 1, date: d,
        short: JOURS_COURTS[dow],
        isWeekend: dow === 0 || dow === 6,
        isToday:   d.toDateString() === today.toDateString(),
        week, showWeek,
      };
    });
  });

  private allGroups = computed<SiteGroup[]>(() => {
    const map = new Map<number, CollabRow>();
    for (const a of this.absences()) {
      if (!map.has(a.userId)) {
        map.set(a.userId, { userId: a.userId, firstName: a.firstName, lastName: a.lastName, site: a.site ?? '', absences: [] });
      }
      map.get(a.userId)!.absences.push(a);
    }
    const allRows = [...map.values()].sort((a, b) => a.lastName.localeCompare(b.lastName));

    const siteMap = new Map<string, CollabRow[]>();
    for (const row of allRows) {
      const s = row.site || 'AUTRE';
      if (!siteMap.has(s)) siteMap.set(s, []);
      siteMap.get(s)!.push(row);
    }

    return [...siteMap.entries()].map(([site, rows]) => ({
      site,
      label: this.tenantSvc.poleLabel(site) ?? site,
      flag:  this.tenantSvc.poleFlag(site) ?? '🏢',
      rows,
    }));
  });

  filteredGroups = computed<SiteGroup[]>(() => {
    const q = this.search.toLowerCase().trim();
    return this.allGroups()
      .map(grp => ({
        ...grp,
        rows: q ? grp.rows.filter(r =>
          `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
          `${r.lastName} ${r.firstName}`.toLowerCase().includes(q)
        ) : grp.rows,
      }))
      .filter(grp => grp.rows.length > 0);
  });

  totalRows = computed(() => this.filteredGroups().reduce((s, g) => s + g.rows.length, 0));

  soldesAffichees = computed(() =>
    this.soldes().filter(s =>
      (s.joursAcquis > 0 || s.typeConge === 'CONGES_PAYES')
    )
  );

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['email_action']) {
        const ok  = params['email_action'] === 'APPROUVEE' || params['email_action'] === 'REFUSEE';
        const msg = decodeURIComponent(params['msg'] ?? '');
        this.emailActionOk.set(ok);
        this.emailActionMsg.set(msg || (ok ? 'Demande traitée avec succès' : 'Erreur'));
        setTimeout(() => this.emailActionMsg.set(''), 6000);
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });
    this.load();
    this.loadSoldes();
  }

  load() {
    this.loading.set(true);
    this.cSvc.getCalendrier(this.mois(), this.annee(), this.siteFilter || undefined)
      .subscribe({
        next:  data => { this.absences.set(data); this.loading.set(false); },
        error: ()   => this.loading.set(false),
      });
  }

  loadSoldes() {
    this.cSvc.mesSoldes(this.annee()).subscribe({
      next: data => this.soldes.set(data),
      error: () => {},
    });
  }

  prevMois() {
    if (this.mois() === 1) { this.mois.set(12); this.annee.update(a => a - 1); }
    else this.mois.update(m => m - 1);
    this.load();
  }

  nextMois() {
    if (this.mois() === 12) { this.mois.set(1); this.annee.update(a => a + 1); }
    else this.mois.update(m => m + 1);
    this.load();
  }

  goToday() {
    const t = new Date();
    this.mois.set(t.getMonth() + 1);
    this.annee.set(t.getFullYear());
    this.load();
  }

  setSite(site: string) {
    this.siteFilter = site;
    this.load();
  }

  toggleGroup(site: string) {
    this.collapsedSites.update(set => {
      const next = new Set(set);
      next.has(site) ? next.delete(site) : next.add(site);
      return next;
    });
  }

  isCollapsed(site: string): boolean {
    return this.collapsedSites().has(site);
  }

  private _absence(row: CollabRow, date: Date): CalendrierAbsence | null {
    const ts = date.getTime();
    return row.absences.find(a => {
      const d = new Date(a.dateDebut + 'T00:00:00').getTime();
      const f = new Date(a.dateFin   + 'T00:00:00').getTime();
      return ts >= d && ts <= f;
    }) ?? null;
  }

  isApproved(row: CollabRow, date: Date): boolean {
    return this._absence(row, date)?.statut === 'APPROUVEE';
  }

  isPending(row: CollabRow, date: Date): boolean {
    return this._absence(row, date)?.statut === 'EN_ATTENTE';
  }

  isStart(row: CollabRow, date: Date): boolean {
    const a = this._absence(row, date);
    if (!a) return false;
    return new Date(a.dateDebut + 'T00:00:00').toDateString() === date.toDateString();
  }

  isEnd(row: CollabRow, date: Date): boolean {
    const a = this._absence(row, date);
    if (!a) return false;
    return new Date(a.dateFin + 'T00:00:00').toDateString() === date.toDateString();
  }

  getTypeLabel(row: CollabRow, date: Date): string {
    const a = this._absence(row, date);
    if (!a) return 'Absent';
    if (!this.auth.isAdmin()) return 'Absent';
    return TYPE_CONGE_LABELS[a.typeConge] ?? 'Absent';
  }

  getTooltip(row: CollabRow, date: Date): string {
    const a = this._absence(row, date);
    if (!a) return '';
    const statut = a.statut === 'APPROUVEE' ? '✓ Approuvée' : '⏳ En attente';
    if (!this.auth.isAdmin()) {
      return `${row.lastName} ${row.firstName}\n${a.dateDebut} → ${a.dateFin} (${a.nombreJours}j)\n${statut}`;
    }
    const type = TYPE_CONGE_LABELS[a.typeConge] ?? a.typeConge;
    return `${row.lastName} ${row.firstName}\n${type}\n${a.dateDebut} → ${a.dateFin} (${a.nombreJours}j)\n${statut}`;
  }

  typeLabel(t: TypeConge): string {
    return TYPE_CONGE_LABELS[t] ?? t;
  }
}
