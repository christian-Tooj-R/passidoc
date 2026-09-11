import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';

import { SaisieTempsService } from '../../../../core/services/saisie-temps.service';

interface CollabRow {
  id: number;
  nom: string;
  totalH: number;
  factH: number;
  nfH: number;
  taux: number;
}

@Component({
  selector: 'app-travail-rapports-productivite',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, DecimalPipe],
  template: `
<div class="page">
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon pg-icon--green"><mat-icon>trending_up</mat-icon></div>
      <div>
        <h1 class="pg-title">Rapport productivité</h1>
        <p class="pg-sub">Analyse par collaborateur sur la période sélectionnée</p>
      </div>
    </div>
  </div>

  <!-- Filtres -->
  <div class="filter-bar">
    <label class="filter-lbl">Du</label>
    <input type="date" class="date-input" [(ngModel)]="dateDebut" />
    <label class="filter-lbl">au</label>
    <input type="date" class="date-input" [(ngModel)]="dateFin" />
    <button class="btn-apply" (click)="applyFilter()">
      <mat-icon>search</mat-icon> Appliquer
    </button>
  </div>

  <!-- KPIs -->
  <div class="kpi-row">
    <div class="kpi-card kpi-card--blue">
      <div class="kpi-val">{{ totalH() | number:'1.1-1' }}h</div>
      <div class="kpi-lbl">Heures totales saisies</div>
    </div>
    <div class="kpi-card kpi-card--green">
      <div class="kpi-val">{{ factH() | number:'1.1-1' }}h</div>
      <div class="kpi-lbl">Heures facturables</div>
    </div>
    <div class="kpi-card kpi-card--purple">
      <div class="kpi-val">{{ tauxGlobal() }}%</div>
      <div class="kpi-lbl">Taux de facturation</div>
    </div>
    <div class="kpi-card kpi-card--red">
      <div class="kpi-val">{{ nfH() | number:'1.1-1' }}h</div>
      <div class="kpi-lbl">Heures non facturables</div>
    </div>
  </div>

  @if (loading()) {
    <div class="loading-state">
      <mat-icon class="spin">refresh</mat-icon>
      <span>Chargement des données…</span>
    </div>
  } @else {
    <div class="table-wrap">
      <table class="prod-table">
        <thead>
          <tr>
            <th class="th-collab">Collaborateur</th>
            <th class="th-num">Heures total</th>
            <th class="th-num">Facturable</th>
            <th class="th-num">Non fact.</th>
            <th class="th-num">Taux (%)</th>
            <th class="th-bar">Barre taux</th>
          </tr>
        </thead>
        <tbody>
          @for (row of collabRows(); track row.id) {
            <tr>
              <td class="td-collab">
                <div class="collab-cell">
                  <div class="collab-avatar">{{ row.nom[0] }}</div>
                  <span>{{ row.nom }}</span>
                </div>
              </td>
              <td class="td-num">{{ row.totalH | number:'1.1-1' }}h</td>
              <td class="td-num td-fact">{{ row.factH | number:'1.1-1' }}h</td>
              <td class="td-num td-nf">{{ row.nfH | number:'1.1-1' }}h</td>
              <td class="td-num td-taux" [class]="'taux-' + tauxClass(row.taux)">{{ row.taux }}%</td>
              <td class="td-bar-cell">
                <div class="rate-bar">
                  <div class="rate-fill" [style.width]="(row.taux > 100 ? 100 : row.taux) + '%'" [class]="'rf-' + tauxClass(row.taux)"></div>
                </div>
              </td>
            </tr>
          }
          @if (collabRows().length === 0) {
            <tr>
              <td colspan="6" class="td-empty">Aucune donnée pour cette période</td>
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
    .pg-icon--green { background:linear-gradient(135deg,#10b981,#059669); box-shadow:0 4px 14px rgba(16,185,129,.35); }
    .pg-icon mat-icon { color:#fff; font-size:22px; width:22px; height:22px; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub { font-size:13px; color:#64748b; margin:2px 0 0; }

    .filter-bar { display:flex; align-items:center; gap:10px; padding:12px 24px; background:#fff; border-bottom:1px solid #e2e8f0; flex-shrink:0; }
    .filter-lbl { font-size:12px; color:#64748b; font-weight:500; }
    .date-input { height:34px; border:1.5px solid #e2e8f0; border-radius:7px; font-size:13px; padding:0 10px; color:#1e293b; background:#f8fafc; }
    .date-input:focus { outline:none; border-color:#6366f1; }
    .btn-apply { display:flex; align-items:center; gap:6px; height:34px; padding:0 14px; background:#6366f1; color:#fff; border:none; border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; }
    .btn-apply mat-icon { font-size:16px; width:16px; height:16px; }

    .kpi-row { display:flex; gap:12px; padding:16px 24px; background:#f8fafc; border-bottom:1px solid #e2e8f0; flex-shrink:0; }
    .kpi-card { flex:1; border-radius:10px; padding:14px 18px; border:1px solid; }
    .kpi-card--blue   { background:#dbeafe; border-color:#bfdbfe; }
    .kpi-card--green  { background:#dcfce7; border-color:#bbf7d0; }
    .kpi-card--purple { background:#ede9fe; border-color:#ddd6fe; }
    .kpi-card--red    { background:#fee2e2; border-color:#fecaca; }
    .kpi-val { font-size:22px; font-weight:800; color:#0f172a; }
    .kpi-lbl { font-size:11px; color:#64748b; font-weight:500; margin-top:2px; }

    .loading-state { display:flex; align-items:center; justify-content:center; gap:10px; padding:60px; color:#94a3b8; }
    .spin { animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .table-wrap { flex:1; overflow:auto; padding:20px 24px; }
    .prod-table { width:100%; border-collapse:collapse; min-width:700px; }
    .prod-table thead { background:#1e293b; }
    .th-collab { color:#fff; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:12px 16px; text-align:left; min-width:200px; }
    .th-num,.th-bar { color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:12px 12px; text-align:center; }
    .th-bar { min-width:120px; }

    .prod-table tbody tr:nth-child(even) { background:#f8fafc; }
    .prod-table tbody tr:hover { background:#eef2ff; }
    .td-collab { padding:12px 16px; border-bottom:1px solid #f1f5f9; }
    .collab-cell { display:flex; align-items:center; gap:8px; }
    .collab-avatar { width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,#10b981,#059669); color:#fff; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; text-transform:uppercase; }
    .collab-cell span { font-size:13px; font-weight:600; color:#0f172a; }
    .td-num { padding:12px; border-bottom:1px solid #f1f5f9; text-align:center; font-size:13px; color:#374151; }
    .td-fact { color:#15803d; font-weight:600; }
    .td-nf   { color:#dc2626; }
    .td-taux { font-weight:700; font-family:monospace; }
    .taux-green  { color:#15803d; }
    .taux-orange { color:#c2410c; }
    .taux-red    { color:#dc2626; }
    .td-bar-cell { padding:12px; border-bottom:1px solid #f1f5f9; }
    .rate-bar { height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden; }
    .rate-fill { height:100%; border-radius:4px; transition:width .4s; }
    .rf-green  { background:#10b981; }
    .rf-orange { background:#f97316; }
    .rf-red    { background:#ef4444; }
    .td-empty { text-align:center; color:#94a3b8; padding:40px; font-size:14px; }
  `],
})
export class TravailRapportsProductiviteComponent implements OnInit, OnDestroy {
  private saisiesSvc = inject(SaisieTempsService);
  private _d$ = new Subject<void>();

  loading = signal(true);
  collabRows = signal<CollabRow[]>([]);
  dateDebut = this.firstDayOfMonth();
  dateFin   = this.today();

  totalH    = computed(() => this.collabRows().reduce((a, r) => a + r.totalH, 0));
  factH     = computed(() => this.collabRows().reduce((a, r) => a + r.factH, 0));
  nfH       = computed(() => this.collabRows().reduce((a, r) => a + r.nfH, 0));
  tauxGlobal = computed(() => {
    const t = this.totalH();
    return t > 0 ? Math.round(this.factH() / t * 100) : 0;
  });

  ngOnInit() { this.applyFilter(); }

  applyFilter() {
    this.loading.set(true);
    this.saisiesSvc.getRapports('collaborateur', this.dateDebut, this.dateFin)
      .pipe(takeUntil(this._d$))
      .subscribe({
        next: rows => {
          this.collabRows.set(rows.map((r: any) => ({
            id: r.collaborateurId ?? r.id ?? 0,
            nom: r.collaborateurNom ?? r.nom ?? `Collab #${r.collaborateurId}`,
            totalH: +(r.totalHeures ?? r.totalH ?? 0),
            factH:  +(r.heuresFacturables ?? r.factH ?? 0),
            nfH:    +(r.heuresNonFacturables ?? r.nfH ?? 0),
            taux:   Math.round(+(r.tauxFacturation ?? r.taux ?? 0)),
          })));
          this.loading.set(false);
        },
        error: () => {
          this.collabRows.set([]);
          this.loading.set(false);
        },
      });
  }

  tauxClass(t: number): string {
    if (t >= 70) return 'green';
    if (t >= 50) return 'orange';
    return 'red';
  }

  private today(): string { return new Date().toISOString().split('T')[0]; }
  private firstDayOfMonth(): string {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  }

  ngOnDestroy() { this._d$.next(); this._d$.complete(); }
}
