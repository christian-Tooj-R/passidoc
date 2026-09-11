import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';

import { TasksService, Task } from '../../../../core/services/tasks.service';

interface TimesheetRow {
  taskId: number;
  clientNom: string;
  taskTitre: string;
  estFacturable: boolean;
  hours: { [dayIndex: number]: number | null };
}

@Component({
  selector: 'app-travail-feuille-temps',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, DecimalPipe],
  template: `
<div class="page">
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon pg-icon--purple"><mat-icon>table_chart</mat-icon></div>
      <div>
        <h1 class="pg-title">Feuille de temps</h1>
        <p class="pg-sub">Semaine du {{ weekLabel() }} · Total : {{ totalWeek() | number:'1.1-1' }}h</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="nav-btn" (click)="prevWeek()"><mat-icon>chevron_left</mat-icon></button>
      <span class="week-lbl">{{ weekLabel() }}</span>
      <button class="nav-btn" (click)="nextWeek()"><mat-icon>chevron_right</mat-icon></button>
      <button class="btn-today" (click)="goToday()">Cette semaine</button>
      <button class="btn-save" (click)="save()" [disabled]="saving()">
        <mat-icon>save</mat-icon> {{ saving() ? 'Enregistrement…' : 'Enregistrer' }}
      </button>
    </div>
  </div>

  <div class="grid-wrap">
    @if (loading()) {
      <div class="loading-state">
        <mat-icon class="spin">refresh</mat-icon>
        <span>Chargement…</span>
      </div>
    } @else {
      <table class="timesheet-table">
        <thead>
          <tr>
            <th class="th-task">Client / Tâche</th>
            <th class="th-fact">Fact.</th>
            @for (d of weekDays(); track d.index) {
              <th class="th-day" [class.th-today]="d.isToday">
                <div>{{ d.name }}</div>
                <div class="day-num">{{ d.label }}</div>
              </th>
            }
            <th class="th-total">Total</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.taskId) {
            <tr>
              <td class="td-task">
                <div class="task-info">
                  <span class="task-client">{{ row.clientNom }}</span>
                  <span class="task-titre">{{ row.taskTitre }}</span>
                </div>
              </td>
              <td class="td-fact">
                <span [class]="row.estFacturable ? 'badge-fact' : 'badge-nf'">
                  {{ row.estFacturable ? 'F' : 'NF' }}
                </span>
              </td>
              @for (d of weekDays(); track d.index) {
                <td class="td-input" [class.td-today]="d.isToday">
                  <input type="number" class="h-input"
                         min="0" max="24" step="0.5"
                         [value]="row.hours[d.index] ?? null"
                         (change)="setHours(row, d.index, $event)"
                         placeholder="—" />
                </td>
              }
              <td class="td-row-total">{{ rowTotal(row) | number:'1.1-1' }}h</td>
            </tr>
          }
          <tr class="tr-totals">
            <td colspan="2" class="td-totals-lbl">Total journée</td>
            @for (d of weekDays(); track d.index) {
              <td class="td-day-total">{{ dayTotal(d.index) | number:'1.1-1' }}h</td>
            }
            <td class="td-grand-total">{{ totalWeek() | number:'1.1-1' }}h</td>
          </tr>
        </tbody>
      </table>

      @if (rows().length === 0) {
        <div class="empty-state">
          <mat-icon>table_chart</mat-icon>
          <p>Aucune tâche en cours pour cette semaine</p>
        </div>
      }
    }
  </div>
</div>
  `,
  styles: [`
    .page { display:flex; flex-direction:column; height:100%; min-height:0; }
    .pg-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px 16px; background:#fff; border-bottom:1px solid #e2e8f0; flex-shrink:0; }
    .pg-header__left { display:flex; align-items:center; gap:12px; }
    .pg-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; }
    .pg-icon--purple { background:linear-gradient(135deg,#7c3aed,#6d28d9); box-shadow:0 4px 14px rgba(124,58,237,.35); }
    .pg-icon mat-icon { color:#fff; font-size:22px; width:22px; height:22px; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub { font-size:13px; color:#64748b; margin:2px 0 0; }
    .header-actions { display:flex; align-items:center; gap:8px; }
    .nav-btn { width:32px; height:32px; border:1px solid #e2e8f0; border-radius:7px; background:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .nav-btn mat-icon { font-size:18px; width:18px; height:18px; }
    .week-lbl { font-size:13px; font-weight:600; color:#374151; min-width:120px; text-align:center; }
    .btn-today { height:32px; padding:0 14px; border:1px solid #e2e8f0; border-radius:7px; background:#f8fafc; color:#374151; font-size:12px; cursor:pointer; }
    .btn-save { display:flex; align-items:center; gap:6px; height:36px; padding:0 18px; background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; }
    .btn-save:disabled { opacity:.6; cursor:not-allowed; }
    .btn-save mat-icon { font-size:16px; width:16px; height:16px; }

    .grid-wrap { flex:1; overflow:auto; padding:20px 24px; }
    .loading-state { display:flex; align-items:center; justify-content:center; gap:10px; padding:60px; color:#94a3b8; }
    .spin { animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .timesheet-table { width:100%; border-collapse:collapse; font-size:12.5px; min-width:900px; }
    .timesheet-table thead { background:#1e293b; }
    .th-task { color:#fff; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:12px 14px; text-align:left; min-width:200px; }
    .th-fact { color:#94a3b8; font-size:11px; font-weight:600; padding:12px 8px; text-align:center; width:45px; }
    .th-day { color:#94a3b8; font-size:11px; font-weight:600; text-align:center; padding:10px 6px; min-width:80px; }
    .th-today { color:#a5b4fc; }
    .th-today .day-num { color:#fff; }
    .day-num { font-size:13px; font-weight:700; color:#e2e8f0; margin-top:2px; }
    .th-total { color:#fff; font-size:11px; font-weight:600; padding:12px 14px; text-align:center; width:70px; }

    .timesheet-table tbody tr:nth-child(even) { background:#f8fafc; }
    .timesheet-table tbody tr:hover:not(.tr-totals) { background:#eef2ff; }
    .td-task { padding:10px 14px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
    .task-info { display:flex; flex-direction:column; gap:2px; }
    .task-client { font-size:10px; color:#94a3b8; font-weight:600; text-transform:uppercase; }
    .task-titre { font-size:12.5px; color:#1e293b; font-weight:600; }
    .td-fact { padding:10px 8px; border-bottom:1px solid #f1f5f9; text-align:center; }
    .badge-fact { font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; background:#dcfce7; color:#15803d; }
    .badge-nf   { font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; background:#fee2e2; color:#dc2626; }
    .td-input { padding:6px 4px; border-bottom:1px solid #f1f5f9; }
    .td-today { background:rgba(99,102,241,.04); }
    .h-input {
      width:100%; height:32px; border:1.5px solid #e2e8f0; border-radius:6px;
      text-align:center; font-size:13px; font-weight:600; color:#1e293b;
      background:#fff; font-family:monospace; padding:0 4px;
    }
    .h-input:focus { outline:none; border-color:#6366f1; background:#eef2ff; }
    .h-input::-webkit-inner-spin-button { opacity:.5; }
    .td-row-total { text-align:center; font-family:monospace; font-weight:700; color:#7c3aed; border-bottom:1px solid #f1f5f9; padding:10px 8px; }

    .tr-totals { background:#1e293b !important; }
    .td-totals-lbl { color:#94a3b8; font-size:11px; font-weight:700; text-transform:uppercase; padding:10px 14px; }
    .td-day-total { text-align:center; font-family:monospace; font-weight:700; color:#a5b4fc; padding:10px 6px; }
    .td-grand-total { text-align:center; font-family:monospace; font-weight:800; color:#fff; font-size:14px; padding:10px 8px; }

    .empty-state { display:flex; flex-direction:column; align-items:center; padding:60px; color:#94a3b8; gap:12px; }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; opacity:.3; display:block; margin:0 auto; }
    .empty-state p { font-size:14px; margin:0; }
  `],
})
export class TravailFeuilleTempsComponent implements OnInit, OnDestroy {
  private tasksSvc = inject(TasksService);
  private _d$ = new Subject<void>();

  weekOffset = signal(0);
  rows = signal<TimesheetRow[]>([]);
  loading = signal(true);
  saving = signal(false);

  weekDays = computed(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1) + this.weekOffset() * 7);
    const names = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const today = new Date();
      return {
        index: i,
        name: names[i],
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        date: d.toISOString().split('T')[0],
        isToday: d.toDateString() === today.toDateString(),
      };
    });
  });

  weekLabel = computed(() => {
    const d = this.weekDays();
    return `${d[0].label} au ${d[6].label}`;
  });

  totalWeek = computed(() =>
    this.rows().reduce((acc, r) => acc + this.rowTotal(r), 0)
  );

  ngOnInit() {
    this.loadTasks();
  }

  loadTasks() {
    this.loading.set(true);
    this.tasksSvc.getAllGlobal().pipe(takeUntil(this._d$)).subscribe({
      next: tasks => {
        this.rows.set(
          tasks
            .filter(t => t.statut !== 'TERMINEE' && t.statut !== 'NON_FAIT')
            .map(t => ({
              taskId: t.id,
              clientNom: t.client?.nom ?? '—',
              taskTitre: t.titre,
              estFacturable: t.estFacturable ?? true,
              hours: {},
            }))
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setHours(row: TimesheetRow, dayIdx: number, event: Event) {
    const val = parseFloat((event.target as HTMLInputElement).value);
    row.hours[dayIdx] = isNaN(val) ? null : val;
  }

  rowTotal(row: TimesheetRow): number {
    return Object.values(row.hours).reduce((acc: number, v) => acc + (v ?? 0), 0);
  }

  dayTotal(dayIdx: number): number {
    return this.rows().reduce((acc, r) => acc + (r.hours[dayIdx] ?? 0), 0);
  }

  prevWeek() { this.weekOffset.update(v => v - 1); }
  nextWeek() { this.weekOffset.update(v => v + 1); }
  goToday()  { this.weekOffset.set(0); }

  save() {
    this.saving.set(true);
    // TODO: appel API saisie-temps en batch
    setTimeout(() => this.saving.set(false), 800);
  }

  ngOnDestroy() {
    this._d$.next();
    this._d$.complete();
  }
}
