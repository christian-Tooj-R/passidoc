import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CongesAbsencesService,
  CalendrierAbsence,
} from '../../core/services/conges-absences.service';
import { AuthService } from '../../core/services/auth.service';

const MOIS_LABELS = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

const JOURS_COURTS = ['D','L','M','M','J','V','S'];

interface CollabRow {
  userId:    number;
  firstName: string;
  lastName:  string;
  absences:  CalendrierAbsence[];
}

@Component({
  selector: 'app-conges-calendrier',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule, MatButtonToggleModule, FormsModule],
  template: `
<div class="cal-wrap">

  <!-- Barre de contrôle -->
  <div class="cal-toolbar">
    <div class="cal-toolbar__nav">
      <button mat-icon-button (click)="prevMois()" matTooltip="Mois précédent">
        <mat-icon>chevron_left</mat-icon>
      </button>
      <span class="cal-toolbar__label">{{ moisLabel() }}</span>
      <button mat-icon-button (click)="nextMois()" matTooltip="Mois suivant">
        <mat-icon>chevron_right</mat-icon>
      </button>
      <button mat-stroked-button class="btn-today" (click)="goToday()">Aujourd'hui</button>
    </div>

    <div class="cal-toolbar__filters">
      <mat-button-toggle-group [(ngModel)]="siteFilter" (change)="load()">
        <mat-button-toggle value="">Tous</mat-button-toggle>
        <mat-button-toggle value="REUNION">🇷🇪 La Réunion</mat-button-toggle>
        <mat-button-toggle value="MADAGASCAR">🇲🇬 Madagascar</mat-button-toggle>
      </mat-button-toggle-group>
    </div>
  </div>

  @if (loading()) {
    <div class="cal-loading">
      <mat-icon class="spin">refresh</mat-icon>
      <span>Chargement du planning…</span>
    </div>
  } @else if (rows().length === 0) {
    <div class="cal-empty">
      <mat-icon>event_available</mat-icon>
      <p>Aucune absence ce mois-ci.</p>
    </div>
  } @else {
    <!-- Planning Gantt -->
    <div class="cal-grid-wrap">
      <div class="cal-grid" [style.grid-template-columns]="'200px repeat(' + nbJours() + ', 1fr)'">

        <!-- En-tête : jours du mois -->
        <div class="cal-header__name">Collaborateur</div>
        @for (d of joursDuMois(); track d.num) {
          <div class="cal-header__day"
               [class.cal-header__day--today]="d.isToday"
               [class.cal-header__day--weekend]="d.isWeekend">
            <span class="day-num">{{ d.num }}</span>
            <span class="day-short">{{ d.short }}</span>
          </div>
        }

        <!-- Lignes collaborateurs -->
        @for (row of rows(); track row.userId) {
          <!-- Nom -->
          <div class="cal-row__name">
            <div class="avatar">{{ row.firstName[0] }}{{ row.lastName[0] }}</div>
            <span>{{ row.lastName }} {{ row.firstName }}</span>
          </div>

          <!-- Cellules du mois -->
          @for (d of joursDuMois(); track d.num) {
            <div class="cal-cell"
                 [class.cal-cell--weekend]="d.isWeekend"
                 [class.cal-cell--today]="d.isToday"
                 [class.cal-cell--absent]="isAbsent(row, d.date)"
                 [class.cal-cell--pending]="isPending(row, d.date)"
                 [class.cal-cell--start]="isStart(row, d.date)"
                 [class.cal-cell--end]="isEnd(row, d.date)"
                 [matTooltip]="getTooltip(row, d.date)">
              @if (isStart(row, d.date)) {
                <span class="absent-label">Absent</span>
              }
            </div>
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
    </div>
  }

</div>

<!-- Toast email action (si redirigé depuis un email) -->
@if (emailActionMsg()) {
  <div class="email-toast" [class.email-toast--ok]="emailActionOk()" [class.email-toast--err]="!emailActionOk()">
    <mat-icon>{{ emailActionOk() ? 'check_circle' : 'error' }}</mat-icon>
    <span>{{ emailActionMsg() }}</span>
  </div>
}
`,
  styles: [`
:host { display: block; height: 100%; }

.cal-wrap {
  padding: 24px;
  max-width: 100%;
  overflow: hidden;
}

/* Toolbar */
.cal-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
}
.cal-toolbar__nav {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cal-toolbar__label {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  min-width: 180px;
  text-align: center;
}
.btn-today {
  border-radius: 20px !important;
  font-size: 13px !important;
}

/* Grid */
.cal-grid-wrap {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #fff;
}
.cal-grid {
  display: grid;
  min-width: 800px;
}

/* Header row */
.cal-header__name {
  padding: 10px 12px;
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: .5px;
  position: sticky;
  left: 0;
  z-index: 2;
}
.cal-header__day {
  padding: 6px 2px;
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
  border-right: 1px solid #f1f5f9;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  min-width: 28px;
}
.cal-header__day--weekend { background: #f1f5f9; }
.cal-header__day--today { background: #dbeafe; }
.day-num {
  font-size: 11px;
  font-weight: 700;
  color: #374151;
  line-height: 1;
}
.day-short {
  font-size: 9px;
  color: #9ca3af;
  text-transform: uppercase;
}

/* Row cells */
.cal-row__name {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #f1f5f9;
  border-right: 1px solid #e2e8f0;
  background: #fff;
  position: sticky;
  left: 0;
  z-index: 1;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
}
.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #1565C0;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.cal-cell {
  border-bottom: 1px solid #f1f5f9;
  border-right: 1px solid #f1f5f9;
  min-height: 40px;
  position: relative;
  overflow: hidden;
  cursor: default;
}
.cal-cell--weekend { background: #fafafa; }
.cal-cell--today   { background: #eff6ff; }
.cal-cell--absent {
  background: #1d4ed8;
  border-right-color: #1d4ed8;
}
.cal-cell--absent.cal-cell--weekend { background: #2563eb; }
.cal-cell--pending {
  background: #bfdbfe;
  border-right-color: #bfdbfe;
}
.cal-cell--start { border-radius: 4px 0 0 4px; margin-left: 2px; }
.cal-cell--end   { border-radius: 0 4px 4px 0; margin-right: 2px; }

.absent-label {
  position: absolute;
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
  pointer-events: none;
}

/* Loading / empty */
.cal-loading, .cal-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 64px;
  color: #9ca3af;
}
.cal-loading mat-icon, .cal-empty mat-icon { font-size: 40px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Légende */
.cal-legend {
  display: flex;
  gap: 24px;
  margin-top: 16px;
  padding: 0 4px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}
.legend-dot {
  width: 14px;
  height: 14px;
  border-radius: 3px;
}
.legend-dot--approved { background: #1d4ed8; }
.legend-dot--pending  { background: #bfdbfe; border: 1px solid #93c5fd; }

/* Toast email action */
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
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  z-index: 9999;
  animation: slideUp .3s ease;
}
.email-toast--ok  { background: #16a34a; color: #fff; }
.email-toast--err { background: #dc2626; color: #fff; }
@keyframes slideUp { from { transform: translateX(-50%) translateY(20px); opacity:0; } to { transform: translateX(-50%) translateY(0); opacity:1; } }

@media (prefers-color-scheme: dark) {
  .cal-toolbar__label { color: #f1f5f9; }
  .cal-grid-wrap { background: #1e293b; border-color: #334155; }
  .cal-header__name, .cal-header__day { background: #0f172a; border-color: #334155; }
  .cal-header__day--weekend { background: #1e293b; }
  .cal-header__day--today   { background: #1e3a5f; }
  .day-num { color: #e2e8f0; }
  .cal-row__name { background: #1e293b; border-color: #334155; color: #e2e8f0; }
  .avatar { background: #2563eb; }
  .cal-cell { border-color: #334155; }
  .cal-cell--weekend { background: #172030; }
  .cal-cell--today   { background: #1e3a5f; }
}
`],
})
export class CongesCalendrierComponent implements OnInit {
  private cSvc   = inject(CongesAbsencesService);
  private auth   = inject(AuthService);
  private route  = inject(ActivatedRoute);
  private router = inject(Router);

  today = new Date();
  mois  = signal(this.today.getMonth() + 1);  // 1-12
  annee = signal(this.today.getFullYear());
  siteFilter = '';

  loading  = signal(false);
  absences = signal<CalendrierAbsence[]>([]);

  emailActionMsg = signal('');
  emailActionOk  = signal(false);

  moisLabel = computed(() => `${MOIS_LABELS[this.mois() - 1]} ${this.annee()}`);

  nbJours = computed(() => new Date(this.annee(), this.mois(), 0).getDate());

  joursDuMois = computed(() => {
    const n = this.nbJours();
    const today = new Date();
    return Array.from({ length: n }, (_, i) => {
      const d   = new Date(this.annee(), this.mois() - 1, i + 1);
      const dow = d.getDay(); // 0=dim, 6=sam
      return {
        num:       i + 1,
        date:      d,
        short:     JOURS_COURTS[dow],
        isWeekend: dow === 0 || dow === 6,
        isToday:   d.toDateString() === today.toDateString(),
      };
    });
  });

  rows = computed<CollabRow[]>(() => {
    const map = new Map<number, CollabRow>();
    for (const a of this.absences()) {
      if (!map.has(a.userId)) {
        map.set(a.userId, {
          userId: a.userId, firstName: a.firstName, lastName: a.lastName, absences: [],
        });
      }
      map.get(a.userId)!.absences.push(a);
    }
    return [...map.values()].sort((a, b) => a.lastName.localeCompare(b.lastName));
  });

  ngOnInit() {
    // Vérifier si redirigé depuis un lien email
    this.route.queryParams.subscribe(params => {
      if (params['email_action']) {
        const ok  = params['email_action'] === 'APPROUVEE' || params['email_action'] === 'REFUSEE';
        const msg = decodeURIComponent(params['msg'] ?? '');
        this.emailActionOk.set(ok);
        this.emailActionMsg.set(msg || (ok ? 'Demande traitée avec succès' : 'Erreur'));
        setTimeout(() => this.emailActionMsg.set(''), 6000);
        // Nettoyer l'URL
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
      }
    });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.cSvc.getCalendrier(this.mois(), this.annee(), this.siteFilter || undefined)
      .subscribe({
        next:  data => { this.absences.set(data); this.loading.set(false); },
        error: ()   => this.loading.set(false),
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

  private _getAbsenceForDate(row: CollabRow, date: Date): CalendrierAbsence | null {
    const ts = date.getTime();
    return row.absences.find(a => {
      const d  = new Date(a.dateDebut).getTime();
      const f  = new Date(a.dateFin).getTime();
      return ts >= d && ts <= f;
    }) ?? null;
  }

  isAbsent(row: CollabRow, date: Date): boolean {
    const a = this._getAbsenceForDate(row, date);
    return a?.statut === 'APPROUVEE';
  }

  isPending(row: CollabRow, date: Date): boolean {
    const a = this._getAbsenceForDate(row, date);
    return a?.statut === 'EN_ATTENTE';
  }

  isStart(row: CollabRow, date: Date): boolean {
    const a = this._getAbsenceForDate(row, date);
    if (!a) return false;
    return new Date(a.dateDebut).toDateString() === date.toDateString();
  }

  isEnd(row: CollabRow, date: Date): boolean {
    const a = this._getAbsenceForDate(row, date);
    if (!a) return false;
    return new Date(a.dateFin).toDateString() === date.toDateString();
  }

  getTooltip(row: CollabRow, date: Date): string {
    const a = this._getAbsenceForDate(row, date);
    if (!a) return '';
    const statut = a.statut === 'APPROUVEE' ? 'Approuvée' : 'En attente';
    return `${row.firstName} ${row.lastName} — Absent\n${a.dateDebut} → ${a.dateFin} (${a.nombreJours}j)\n${statut}`;
  }
}
