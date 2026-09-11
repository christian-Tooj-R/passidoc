import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';

import { TasksService, Task } from '../../../../core/services/tasks.service';

interface BudgetRow {
  clientId: number;
  clientNom: string;
  nbTaches: number;
  budgetHeures: number;
  realiseHeures: number;
  resteHeures: number;
  pct: number;
  statut: 'ok' | 'warning' | 'danger';
}

@Component({
  selector: 'app-travail-budgets',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, DecimalPipe],
  template: `
<div class="page">
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon pg-icon--orange"><mat-icon>pie_chart</mat-icon></div>
      <div>
        <h1 class="pg-title">Budget missions</h1>
        <p class="pg-sub">Suivi budgétaire par client · {{ budgetRows().length }} mission(s)</p>
      </div>
    </div>
    <div class="header-actions">
      <span class="notice-badge"><mat-icon>info</mat-icon> Budgets basés sur le temps saisi</span>
    </div>
  </div>

  <!-- KPIs -->
  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-icon kpi-icon--blue"><mat-icon>folder_open</mat-icon></div>
      <div>
        <div class="kpi-val">{{ budgetRows().length }}</div>
        <div class="kpi-lbl">Missions actives</div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon kpi-icon--green"><mat-icon>schedule</mat-icon></div>
      <div>
        <div class="kpi-val">{{ totalRealise() | number:'1.1-1' }}h</div>
        <div class="kpi-lbl">Heures réalisées</div>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon kpi-icon--purple"><mat-icon>bar_chart</mat-icon></div>
      <div>
        <div class="kpi-val">{{ tauxMoyen() }}%</div>
        <div class="kpi-lbl">Taux consommation moyen</div>
      </div>
    </div>
  </div>

  <!-- Filtre -->
  <div class="filter-bar">
    <div class="search-box">
      <mat-icon>search</mat-icon>
      <input type="text" placeholder="Filtrer par client…" [(ngModel)]="filterText" />
    </div>
  </div>

  @if (loading()) {
    <div class="loading-state">
      <mat-icon class="spin">refresh</mat-icon>
      <span>Chargement des budgets…</span>
    </div>
  } @else {
    <div class="table-wrap">
      <table class="budget-table">
        <thead>
          <tr>
            <th class="th-client">Client</th>
            <th class="th-num">Nb tâches</th>
            <th class="th-num">Budget estimé</th>
            <th class="th-num">Réalisé</th>
            <th class="th-num">Reste</th>
            <th class="th-pct">%</th>
            <th class="th-bar">Progression</th>
            <th class="th-statut">Statut</th>
          </tr>
        </thead>
        <tbody>
          @for (row of filteredRows(); track row.clientId) {
            <tr>
              <td class="td-client">
                <div class="client-cell">
                  <div class="client-avatar">{{ row.clientNom[0] }}</div>
                  <span>{{ row.clientNom }}</span>
                </div>
              </td>
              <td class="td-num">{{ row.nbTaches }}</td>
              <td class="td-num">{{ row.budgetHeures | number:'1.1-1' }}h</td>
              <td class="td-num td-realise">{{ row.realiseHeures | number:'1.1-1' }}h</td>
              <td class="td-num">{{ row.resteHeures | number:'1.1-1' }}h</td>
              <td class="td-pct" [class]="'pct-' + row.statut">{{ row.pct }}%</td>
              <td class="td-bar">
                <div class="prog-bar">
                  <div class="prog-fill" [style.width]="(row.pct > 100 ? 100 : row.pct) + '%'" [class]="'fill-' + row.statut"></div>
                </div>
              </td>
              <td class="td-statut">
                @if (row.statut === 'ok') {
                  <span class="badge badge-ok">Dans le budget</span>
                } @else if (row.statut === 'warning') {
                  <span class="badge badge-warning">Attention</span>
                } @else {
                  <span class="badge badge-danger">Dépassé</span>
                }
              </td>
            </tr>
          }
          @if (filteredRows().length === 0) {
            <tr>
              <td colspan="8" class="td-empty">Aucune mission trouvée</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }
</div>
  `,
  styles: [`
    .page { display:flex; flex-direction:column; height:100%; min-height:0; overflow:hidden; }
    .pg-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px 16px; background:#fff; border-bottom:1px solid #e2e8f0; flex-shrink:0; }
    .pg-header__left { display:flex; align-items:center; gap:12px; }
    .pg-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; }
    .pg-icon--orange { background:linear-gradient(135deg,#f97316,#ea580c); box-shadow:0 4px 14px rgba(249,115,22,.35); }
    .pg-icon mat-icon { color:#fff; font-size:22px; width:22px; height:22px; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub { font-size:13px; color:#64748b; margin:2px 0 0; }

    .notice-badge { display:flex; align-items:center; gap:6px; font-size:12px; color:#64748b; background:#f1f5f9; padding:6px 12px; border-radius:8px; }
    .notice-badge mat-icon { font-size:16px; width:16px; height:16px; color:#94a3b8; }

    .kpi-row { display:flex; gap:16px; padding:16px 24px; background:#f8fafc; border-bottom:1px solid #e2e8f0; flex-shrink:0; }
    .kpi-card { display:flex; align-items:center; gap:12px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px 18px; flex:1; }
    .kpi-icon { width:36px; height:36px; border-radius:9px; display:flex; align-items:center; justify-content:center; }
    .kpi-icon--blue   { background:#dbeafe; } .kpi-icon--blue   mat-icon { color:#1d4ed8; }
    .kpi-icon--green  { background:#dcfce7; } .kpi-icon--green  mat-icon { color:#15803d; }
    .kpi-icon--purple { background:#ede9fe; } .kpi-icon--purple mat-icon { color:#7c3aed; }
    .kpi-icon mat-icon { font-size:18px; width:18px; height:18px; }
    .kpi-val { font-size:22px; font-weight:800; color:#0f172a; }
    .kpi-lbl { font-size:11px; color:#64748b; font-weight:500; margin-top:2px; }

    .filter-bar { display:flex; align-items:center; gap:12px; padding:12px 24px; background:#fff; border-bottom:1px solid #e2e8f0; flex-shrink:0; }
    .search-box { display:flex; align-items:center; gap:8px; border:1px solid #e2e8f0; border-radius:8px; padding:0 12px; height:36px; background:#f8fafc; }
    .search-box mat-icon { font-size:16px; width:16px; height:16px; color:#94a3b8; }
    .search-box input { border:none; background:none; font-size:13px; color:#1e293b; outline:none; width:220px; }

    .loading-state { display:flex; align-items:center; justify-content:center; gap:10px; padding:60px; color:#94a3b8; }
    .spin { animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .table-wrap { flex:1; overflow:auto; padding:20px 24px; }
    .budget-table { width:100%; border-collapse:collapse; min-width:800px; }
    .budget-table thead { background:#1e293b; }
    .th-client { color:#fff; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:12px 16px; text-align:left; min-width:200px; }
    .th-num,.th-pct,.th-bar,.th-statut { color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:12px 12px; text-align:center; }
    .th-bar { min-width:120px; }

    .budget-table tbody tr:nth-child(even) { background:#f8fafc; }
    .budget-table tbody tr:hover { background:#eef2ff; }
    .td-client { padding:12px 16px; border-bottom:1px solid #f1f5f9; }
    .client-cell { display:flex; align-items:center; gap:8px; }
    .client-avatar { width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,#f97316,#ea580c); color:#fff; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; text-transform:uppercase; }
    .client-cell span { font-size:13px; font-weight:600; color:#0f172a; }
    .td-num { padding:12px; border-bottom:1px solid #f1f5f9; text-align:center; font-size:13px; color:#374151; }
    .td-realise { font-weight:600; color:#0f172a; }
    .td-pct { padding:12px; border-bottom:1px solid #f1f5f9; text-align:center; font-size:13px; font-weight:700; font-family:monospace; }
    .pct-ok      { color:#15803d; }
    .pct-warning { color:#c2410c; }
    .pct-danger  { color:#dc2626; }
    .td-bar { padding:12px; border-bottom:1px solid #f1f5f9; }
    .prog-bar { height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden; }
    .prog-fill { height:100%; border-radius:4px; transition:width .4s; }
    .fill-ok      { background:#10b981; }
    .fill-warning { background:#f97316; }
    .fill-danger  { background:#ef4444; }
    .td-statut { padding:12px; border-bottom:1px solid #f1f5f9; text-align:center; }
    .badge { font-size:10px; font-weight:700; padding:3px 10px; border-radius:10px; }
    .badge-ok      { background:#dcfce7; color:#15803d; }
    .badge-warning { background:#ffedd5; color:#c2410c; }
    .badge-danger  { background:#fee2e2; color:#dc2626; }
    .td-empty { text-align:center; color:#94a3b8; padding:40px; font-size:14px; }
  `],
})
export class TravailBudgetsComponent implements OnInit, OnDestroy {
  private tasksSvc = inject(TasksService);
  private _d$ = new Subject<void>();

  loading = signal(true);
  budgetRows = signal<BudgetRow[]>([]);
  filterText = '';

  filteredRows = computed(() => {
    const text = this.filterText.toLowerCase().trim();
    if (!text) return this.budgetRows();
    return this.budgetRows().filter(r => r.clientNom.toLowerCase().includes(text));
  });

  totalRealise = computed(() =>
    this.budgetRows().reduce((a, r) => a + r.realiseHeures, 0)
  );

  tauxMoyen = computed(() => {
    const rows = this.budgetRows();
    if (!rows.length) return 0;
    return Math.round(rows.reduce((a, r) => a + r.pct, 0) / rows.length);
  });

  ngOnInit() {
    this.tasksSvc.getAllGlobal().pipe(takeUntil(this._d$)).subscribe({
      next: tasks => {
        this.budgetRows.set(this.buildBudgetRows(tasks));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  buildBudgetRows(tasks: Task[]): BudgetRow[] {
    const map = new Map<number, BudgetRow>();
    for (const t of tasks) {
      if (!t.clientId) continue;
      if (!map.has(t.clientId)) {
        map.set(t.clientId, {
          clientId: t.clientId,
          clientNom: t.client?.nom ?? `Client #${t.clientId}`,
          nbTaches: 0,
          budgetHeures: 0,
          realiseHeures: 0,
          resteHeures: 0,
          pct: 0,
          statut: 'ok',
        });
      }
      const row = map.get(t.clientId)!;
      row.nbTaches++;
      row.realiseHeures += t.tempsExecution ?? 0;
      row.budgetHeures  += (t.tempsExecution ?? 0) * 1.3;
    }
    return Array.from(map.values()).map(r => {
      r.resteHeures = Math.max(0, r.budgetHeures - r.realiseHeures);
      r.pct = r.budgetHeures > 0 ? Math.round(r.realiseHeures / r.budgetHeures * 100) : 0;
      r.statut = r.pct >= 100 ? 'danger' : r.pct >= 80 ? 'warning' : 'ok';
      return r;
    }).sort((a, b) => b.pct - a.pct);
  }

  ngOnDestroy() {
    this._d$.next();
    this._d$.complete();
  }
}
