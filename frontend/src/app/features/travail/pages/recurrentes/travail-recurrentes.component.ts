import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { TacheRecurrenteService, TacheRecurrente } from '../../../../core/services/tache-recurrente.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { Client } from '../../../../core/models/client.model';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-travail-recurrentes',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
<div class="page">

  <!-- ── Header ── -->
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon pg-icon--rose"><mat-icon>repeat</mat-icon></div>
      <div>
        <h1 class="pg-title">Tâches récurrentes</h1>
        <p class="pg-sub">{{ filtered().length }} tâche(s) · {{ countActives() }} active(s)</p>
      </div>
    </div>
    <button class="btn-generer" (click)="generer()" [disabled]="generating()">
      <mat-icon>autorenew</mat-icon>
      {{ generating() ? 'Génération…' : 'Générer maintenant' }}
    </button>
  </div>

  <!-- ── Filtres inline ── -->
  <div class="filter-bar">
    <select class="fb-select" [(ngModel)]="filterClient" (change)="applyFilters()">
      <option value="">Client — Tous</option>
      @for (c of clients; track c.id) {
        <option [value]="c.id">{{ c.nom }}</option>
      }
    </select>
    <select class="fb-select" [(ngModel)]="filterFrequence" (change)="applyFilters()">
      <option value="">Fréquence — Toutes</option>
      <option value="MENSUELLE">Mensuelle</option>
      <option value="TRIMESTRIELLE">Trimestrielle</option>
      <option value="SEMESTRIELLE">Semestrielle</option>
      <option value="ANNUELLE">Annuelle</option>
    </select>
    <select class="fb-select" [(ngModel)]="filterService" (change)="applyFilters()">
      <option value="">Service — Tous</option>
      <option value="COMPTA">Comptabilité</option>
      <option value="SOCIAL">Social</option>
      <option value="JURIDIQUE">Juridique</option>
      <option value="ADMIN">Admin</option>
    </select>
    <select class="fb-select" [(ngModel)]="filterActif" (change)="applyFilters()">
      <option value="">Statut — Tous</option>
      <option value="true">Actif</option>
      <option value="false">Inactif</option>
    </select>
  </div>

  <!-- ── KPI ── -->
  <div class="kpi-row">
    <div class="kpi-card kpi-blue">
      <div class="kpi-num">{{ filtered().length }}</div>
      <div class="kpi-lbl">Total</div>
    </div>
    <div class="kpi-card kpi-green">
      <div class="kpi-num">{{ countActives() }}</div>
      <div class="kpi-lbl">Actives</div>
    </div>
    <div class="kpi-card kpi-orange">
      <div class="kpi-num">{{ countByFreq('MENSUELLE') }}</div>
      <div class="kpi-lbl">Mensuelles</div>
    </div>
    <div class="kpi-card kpi-violet">
      <div class="kpi-num">{{ countByFreq('TRIMESTRIELLE') }}</div>
      <div class="kpi-lbl">Trimestrielles</div>
    </div>
  </div>

  <!-- ── Toolbar ── -->
  <div class="table-toolbar">
    <button class="tb-btn" (click)="load()">
      <mat-icon style="font-size:14px;width:14px;height:14px;">refresh</mat-icon> Recharger
    </button>
    <span class="tb-count">{{ filtered().length }} résultat(s)</span>
  </div>

  <!-- ── Tableau ── -->
  <div class="table-wrap">
    @if (loading()) {
      <div class="empty-state"><mat-icon>hourglass_empty</mat-icon><p>Chargement…</p></div>
    } @else if (filtered().length === 0) {
      <div class="empty-state"><mat-icon>repeat_on</mat-icon><p>Aucune tâche récurrente</p></div>
    } @else {
      <table class="data-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Titre</th>
            <th>Fréquence</th>
            <th>Service</th>
            <th class="th-num">Délai (j)</th>
            <th>Actif</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (t of filtered(); track t.id) {
            <tr class="data-row">
              <td class="td-client">{{ clientNom(t.clientId) }}</td>
              <td class="td-titre">{{ t.titre }}</td>
              <td>
                <span class="freq-badge freq-{{ t.frequence.toLowerCase() }}">{{ freqLabel(t.frequence) }}</span>
              </td>
              <td class="td-service">{{ t.serviceDestinataire ?? '—' }}</td>
              <td class="td-num">{{ t.delaiAvantEcheanceJours }}</td>
              <td>
                @if (t.isActive) {
                  <span class="badge-actif">Actif</span>
                } @else {
                  <span class="badge-inactif">Inactif</span>
                }
              </td>
              <td class="td-actions">
                <button class="act-btn" (click)="toggleActif(t)" [matTooltip]="t.isActive ? 'Désactiver' : 'Activer'">
                  <mat-icon>{{ t.isActive ? 'pause_circle' : 'play_circle' }}</mat-icon>
                </button>
                <button class="act-btn act-btn--del" (click)="remove(t)" matTooltip="Supprimer">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    }
  </div>

</div>
  `,
  styles: [`
    .page { display:flex; flex-direction:column; height:100%; min-height:0; }

    /* Header */
    .pg-header { display:flex; align-items:center; justify-content:space-between; padding:24px 28px 0; flex-shrink:0; }
    .pg-header__left { display:flex; align-items:center; gap:14px; }
    .pg-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .pg-icon--rose { background:linear-gradient(135deg,#e11d48,#be123c); box-shadow:0 4px 14px rgba(225,29,72,.35); }
    .pg-icon mat-icon { color:#fff; font-size:22px; width:22px; height:22px; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub { font-size:13px; color:#64748b; margin:2px 0 0; }

    .btn-generer { display:flex; align-items:center; gap:7px; background:linear-gradient(135deg,#059669,#047857); color:#fff; border:none; padding:10px 20px; border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; box-shadow:0 4px 12px rgba(5,150,105,.3); transition:all .2s; }
    .btn-generer mat-icon { font-size:17px; width:17px; height:17px; }
    .btn-generer:hover:not(:disabled) { box-shadow:0 6px 20px rgba(5,150,105,.45); }
    .btn-generer:disabled { opacity:.6; cursor:not-allowed; }

    /* Filter bar */
    .filter-bar { display:flex; align-items:center; gap:10px; padding:18px 28px 0; flex-wrap:wrap; flex-shrink:0; }
    .fb-select { height:36px; border:1px solid #e2e8f0; border-radius:7px; padding:0 10px; font-size:13px; background:#fff; color:#374151; outline:none; font-family:inherit; }
    .fb-select:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.12); }

    /* KPI */
    .kpi-row { display:flex; gap:14px; padding:16px 28px; flex-shrink:0; }
    .kpi-card { flex:1; background:#fff; border-radius:12px; padding:14px 18px; box-shadow:0 1px 4px rgba(0,0,0,.07); border:1px solid #f1f5f9; display:flex; flex-direction:column; gap:4px; }
    .kpi-num { font-size:24px; font-weight:800; line-height:1; }
    .kpi-lbl { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:#64748b; }
    .kpi-blue .kpi-num   { color:#3b82f6; }
    .kpi-green .kpi-num  { color:#10b981; }
    .kpi-orange .kpi-num { color:#f97316; }
    .kpi-violet .kpi-num { color:#8b5cf6; }

    /* Toolbar */
    .table-toolbar { display:flex; align-items:center; gap:8px; padding:0 28px 10px; flex-shrink:0; }
    .tb-count { font-size:12px; color:#64748b; margin-left:auto; font-weight:600; }
    .tb-btn { height:32px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0 12px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:5px; color:#374151; transition:all .15s; }
    .tb-btn:hover { background:#e0e7ff; border-color:#c7d2fe; color:#4f46e5; }

    /* Table */
    .table-wrap { flex:1; overflow:auto; padding:0 28px 28px; }
    .data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table thead { background:#1e293b; }
    .data-table th { color:#fff; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:11px 14px; text-align:left; white-space:nowrap; }
    .th-num { text-align:center; }
    .data-table tbody tr:nth-child(even) { background:#f8fafc; }
    .data-table tbody tr:hover { background:#eef2ff; }
    .data-table td { padding:10px 14px; color:#374151; border-bottom:1px solid #f1f5f9; vertical-align:middle; }

    .td-client  { color:#475569; font-weight:500; }
    .td-titre   { font-weight:500; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .td-service { color:#64748b; font-size:12px; }
    .td-num     { text-align:center; font-variant-numeric:tabular-nums; font-weight:600; color:#7c3aed; }
    .td-actions { display:flex; gap:5px; }

    .freq-badge { font-size:11px; font-weight:600; padding:3px 9px; border-radius:20px; }
    .freq-mensuelle      { background:#dbeafe; color:#1e40af; }
    .freq-trimestrielle  { background:#ede9fe; color:#5b21b6; }
    .freq-semestrielle   { background:#fce7f3; color:#9d174d; }
    .freq-annuelle       { background:#fef9c3; color:#854d0e; }

    .badge-actif   { font-size:11px; font-weight:700; padding:3px 9px; border-radius:20px; background:#dcfce7; color:#15803d; }
    .badge-inactif { font-size:11px; font-weight:700; padding:3px 9px; border-radius:20px; background:#f1f5f9; color:#94a3b8; }

    .act-btn { width:28px; height:28px; border:none; border-radius:6px; background:#f1f5f9; cursor:pointer; display:flex; align-items:center; justify-content:center; color:#64748b; transition:all .15s; }
    .act-btn mat-icon { font-size:15px; width:15px; height:15px; }
    .act-btn:hover { background:#e0e7ff; color:#4f46e5; }
    .act-btn--del:hover { background:#fee2e2; color:#dc2626; }

    .empty-state { display:flex; flex-direction:column; align-items:center; padding:60px 28px; color:#94a3b8; gap:12px; }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; opacity:.3; display:block; }
    .empty-state p { font-size:14px; margin:0; }
  `],
})
export class TravailRecurrentesComponent implements OnInit, OnDestroy {
  private svc        = inject(TacheRecurrenteService);
  private clientsSvc = inject(ClientsService);
  private toast      = inject(ToastService);
  private _d$        = new Subject<void>();

  loading    = signal(true);
  generating = signal(false);
  all        = signal<TacheRecurrente[]>([]);
  filtered   = signal<TacheRecurrente[]>([]);
  clients: Client[] = [];

  filterClient    = '';
  filterFrequence = '';
  filterService   = '';
  filterActif     = '';

  ngOnInit() {
    this.clientsSvc.getAll().pipe(takeUntil(this._d$)).subscribe(c => this.clients = c);
    this.load();
  }

  ngOnDestroy() { this._d$.next(); this._d$.complete(); }

  load() {
    this.loading.set(true);
    this.svc.findAll().pipe(takeUntil(this._d$)).subscribe(data => {
      this.all.set(data);
      this.applyFilters();
      this.loading.set(false);
    });
  }

  applyFilters() {
    let list = this.all();
    if (this.filterClient)    list = list.filter(t => t.clientId === +this.filterClient);
    if (this.filterFrequence) list = list.filter(t => t.frequence === this.filterFrequence);
    if (this.filterService)   list = list.filter(t => t.serviceDestinataire === this.filterService);
    if (this.filterActif === 'true')  list = list.filter(t => t.isActive);
    if (this.filterActif === 'false') list = list.filter(t => !t.isActive);
    this.filtered.set(list);
  }

  countActives()          { return this.filtered().filter(t => t.isActive).length; }
  countByFreq(f: string)  { return this.filtered().filter(t => t.frequence === f).length; }

  clientNom(id: number): string {
    return this.clients.find(c => c.id === id)?.nom ?? `Client #${id}`;
  }

  freqLabel(f: string): string {
    const m: Record<string, string> = {
      MENSUELLE: 'Mensuelle', TRIMESTRIELLE: 'Trimestrielle',
      SEMESTRIELLE: 'Semestrielle', ANNUELLE: 'Annuelle',
    };
    return m[f] ?? f;
  }

  generer() {
    this.generating.set(true);
    this.svc.generer().subscribe({
      next: r => {
        this.generating.set(false);
        this.toast.success(`${r.created} tâche(s) générée(s)`);
        this.load();
      },
      error: () => { this.generating.set(false); this.toast.error('Erreur lors de la génération'); },
    });
  }

  toggleActif(t: TacheRecurrente) {
    this.svc.update(t.id, { isActive: !t.isActive }).subscribe(() => this.load());
  }

  remove(t: TacheRecurrente) {
    this.svc.remove(t.id).subscribe(() => {
      this.toast.success('Tâche récurrente supprimée');
      this.load();
    });
  }
}
