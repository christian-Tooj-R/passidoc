import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';

import { SaisieTempsService } from '../../../../core/services/saisie-temps.service';

interface ClientRapportRow {
  clientId: number;
  clientNom: string;
  nbSaisies: number;
  factH: number;
  nfH: number;
  totalH: number;
  pctFact: number;
}

@Component({
  selector: 'app-travail-rapports-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, DecimalPipe],
  template: `
<div class="page">
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon pg-icon--violet"><mat-icon>business</mat-icon></div>
      <div>
        <h1 class="pg-title">Rapport par client</h1>
        <p class="pg-sub">Temps saisi par dossier client sur la période sélectionnée</p>
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
      <div class="kpi-val">{{ clientRows().length }}</div>
      <div class="kpi-lbl">Clients actifs</div>
    </div>
    <div class="kpi-card kpi-card--green">
      <div class="kpi-val">{{ totalFact() | number:'1.1-1' }}h</div>
      <div class="kpi-lbl">Heures facturables</div>
    </div>
    <div class="kpi-card kpi-card--red">
      <div class="kpi-val">{{ totalNF() | number:'1.1-1' }}h</div>
      <div class="kpi-lbl">Heures non fact.</div>
    </div>
    <div class="kpi-card kpi-card--purple">
      <div class="kpi-val">{{ totalAll() | number:'1.1-1' }}h</div>
      <div class="kpi-lbl">Total heures</div>
    </div>
  </div>

  @if (loading()) {
    <div class="loading-state">
      <mat-icon class="spin">refresh</mat-icon>
      <span>Chargement des données…</span>
    </div>
  } @else {
    <div class="table-wrap">
      <table class="client-table">
        <thead>
          <tr>
            <th class="th-client">Client</th>
            <th class="th-num">Nb saisies</th>
            <th class="th-num">Heures F</th>
            <th class="th-num">Heures NF</th>
            <th class="th-num">Total</th>
            <th class="th-num">% F</th>
            <th class="th-bar">Répartition</th>
          </tr>
        </thead>
        <tbody>
          @for (row of clientRows(); track row.clientId) {
            <tr>
              <td class="td-client">
                <div class="client-cell">
                  <div class="client-avatar">{{ row.clientNom[0] }}</div>
                  <span>{{ row.clientNom }}</span>
                </div>
              </td>
              <td class="td-num">{{ row.nbSaisies }}</td>
              <td class="td-num td-fact">{{ row.factH | number:'1.1-1' }}h</td>
              <td class="td-num td-nf">{{ row.nfH | number:'1.1-1' }}h</td>
              <td class="td-num td-total">{{ row.totalH | number:'1.1-1' }}h</td>
              <td class="td-num td-pct">{{ row.pctFact }}%</td>
              <td class="td-bar-cell">
                <div class="stacked-bar">
                  <div class="sb-fact" [style.width]="row.pctFact + '%'"></div>
                  <div class="sb-nf"   [style.width]="(100 - row.pctFact) + '%'"></div>
                </div>
              </td>
            </tr>
          }
          @if (clientRows().length === 0) {
            <tr>
              <td colspan="7" class="td-empty">Aucune donnée pour cette période</td>
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
    .pg-icon--violet { background:linear-gradient(135deg,#8b5cf6,#7c3aed); box-shadow:0 4px 14px rgba(139,92,246,.35); }
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
    .kpi-card--red    { background:#fee2e2; border-color:#fecaca; }
    .kpi-card--purple { background:#ede9fe; border-color:#ddd6fe; }
    .kpi-val { font-size:22px; font-weight:800; color:#0f172a; }
    .kpi-lbl { font-size:11px; color:#64748b; font-weight:500; margin-top:2px; }

    .loading-state { display:flex; align-items:center; justify-content:center; gap:10px; padding:60px; color:#94a3b8; }
    .spin { animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .table-wrap { flex:1; overflow:auto; padding:20px 24px; }
    .client-table { width:100%; border-collapse:collapse; min-width:700px; }
    .client-table thead { background:#1e293b; }
    .th-client { color:#fff; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:12px 16px; text-align:left; min-width:200px; }
    .th-num,.th-bar { color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:12px 12px; text-align:center; }
    .th-bar { min-width:120px; }

    .client-table tbody tr:nth-child(even) { background:#f8fafc; }
    .client-table tbody tr:hover { background:#eef2ff; }
    .td-client { padding:12px 16px; border-bottom:1px solid #f1f5f9; }
    .client-cell { display:flex; align-items:center; gap:8px; }
    .client-avatar { width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,#8b5cf6,#7c3aed); color:#fff; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; text-transform:uppercase; }
    .client-cell span { font-size:13px; font-weight:600; color:#0f172a; }
    .td-num { padding:12px; border-bottom:1px solid #f1f5f9; text-align:center; font-size:13px; color:#374151; }
    .td-fact  { color:#15803d; font-weight:600; }
    .td-nf    { color:#dc2626; }
    .td-total { font-weight:700; color:#0f172a; }
    .td-pct   { font-weight:700; font-family:monospace; color:#7c3aed; }
    .td-bar-cell { padding:12px; border-bottom:1px solid #f1f5f9; }
    .stacked-bar { display:flex; height:8px; border-radius:4px; overflow:hidden; }
    .sb-fact { background:#10b981; }
    .sb-nf   { background:#f87171; }
    .td-empty { text-align:center; color:#94a3b8; padding:40px; font-size:14px; }
  `],
})
export class TravailRapportsClientsComponent implements OnInit, OnDestroy {
  private saisiesSvc = inject(SaisieTempsService);
  private _d$ = new Subject<void>();

  loading = signal(true);
  clientRows = signal<ClientRapportRow[]>([]);
  dateDebut = this.firstDayOfMonth();
  dateFin   = this.today();

  totalFact = computed(() => this.clientRows().reduce((a, r) => a + r.factH, 0));
  totalNF   = computed(() => this.clientRows().reduce((a, r) => a + r.nfH, 0));
  totalAll  = computed(() => this.clientRows().reduce((a, r) => a + r.totalH, 0));

  ngOnInit() { this.applyFilter(); }

  applyFilter() {
    this.loading.set(true);
    this.saisiesSvc.getRapports('client', this.dateDebut, this.dateFin)
      .pipe(takeUntil(this._d$))
      .subscribe({
        next: rows => {
          this.clientRows.set(rows.map((r: any) => ({
            clientId:  r.clientId ?? 0,
            clientNom: r.clientNom ?? r.nom ?? `Client #${r.clientId}`,
            nbSaisies: +(r.nbSaisies ?? r.count ?? 0),
            factH:     +(r.heuresFacturables ?? r.factH ?? 0),
            nfH:       +(r.heuresNonFacturables ?? r.nfH ?? 0),
            totalH:    +(r.totalHeures ?? r.totalH ?? 0),
            pctFact:   Math.round(+(r.tauxFacturation ?? r.pctFact ?? 0)),
          })).sort((a: ClientRapportRow, b: ClientRapportRow) => b.totalH - a.totalH));
          this.loading.set(false);
        },
        error: () => {
          this.clientRows.set([]);
          this.loading.set(false);
        },
      });
  }

  private today(): string { return new Date().toISOString().split('T')[0]; }
  private firstDayOfMonth(): string {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
  }

  ngOnDestroy() { this._d$.next(); this._d$.complete(); }
}
