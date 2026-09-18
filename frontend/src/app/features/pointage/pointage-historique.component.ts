import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { PointageService, Pointage } from '../../core/services/pointage.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';
import { toLocalIso } from '../../core/services/date.util';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type StatutHisto = 'termine' | 'cours' | 'pause' | 'anomalie';

interface HistoRow {
  pointage: Pointage;
  pauseMin: number;
  netMin: number;
  statutClass: StatutHisto;
  statutLabel: string;
}

@Component({
  selector: 'app-pointage-historique',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatDatepickerModule],
  template: `
<div class="page">

  <!-- ── Header ── -->
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon pg-icon--teal"><mat-icon>history</mat-icon></div>
      <div>
        <h1 class="pg-title">Historique de pointage</h1>
        <p class="pg-sub">{{ rows().length }} ligne(s) sur la période</p>
      </div>
    </div>
    <div class="header-actions">
      @if (isAdmin()) {
        <div class="view-toggle">
          <button [class.vt-active]="vue() === 'moi'"    (click)="setVue('moi')">Mon historique</button>
          <button [class.vt-active]="vue() === 'equipe'" (click)="setVue('equipe')">Équipe</button>
        </div>
      }
      <button class="btn-export" (click)="exportCsv()" [disabled]="rows().length === 0">
        <mat-icon>download</mat-icon> Export CSV
      </button>
      <button class="btn-export" (click)="exportPdf()" [disabled]="rows().length === 0">
        <mat-icon>picture_as_pdf</mat-icon> Export PDF
      </button>
    </div>
  </div>

  <!-- ── Filtres inline ── -->
  <div class="filter-bar">
    <div class="fb-field">
      <label class="fb-label">À partir du</label>
      <input type="date" class="fb-input" [(ngModel)]="dateDebut" [max]="dateFin" (change)="load()">
    </div>
    <div class="fb-field">
      <label class="fb-label">Jusqu'au</label>
      <input type="date" class="fb-input" [(ngModel)]="dateFin" [min]="dateDebut" (change)="load()">
    </div>
    <div class="fb-field">
      <label class="fb-label">Période</label>
      <button type="button" class="fb-cal-btn" matTooltip="Choisir une période sur un calendrier" (click)="rangePicker.open()">
        <mat-icon>calendar_month</mat-icon>
      </button>
      <mat-date-range-input class="fb-range-hidden" [rangePicker]="rangePicker">
        <input matStartDate [(ngModel)]="rangeStart" name="rangeStart" (dateChange)="onRangeChange()">
        <input matEndDate   [(ngModel)]="rangeEnd"   name="rangeEnd"   (dateChange)="onRangeChange()">
      </mat-date-range-input>
      <mat-date-range-picker #rangePicker></mat-date-range-picker>
    </div>
    @if (vue() === 'equipe') {
      <div class="fb-field">
        <label class="fb-label">Pôle</label>
        <select class="fb-select" [(ngModel)]="siteFiltre" (ngModelChange)="load()">
          <option value="">Tous</option>
          <option value="EST">{{ tenantSvc.poleFlag1() }} {{ tenantSvc.poleLabel1() }}</option>
          <option value="OUEST">{{ tenantSvc.poleFlag2() }} {{ tenantSvc.poleLabel2() }}</option>
        </select>
      </div>
      <div class="fb-field fb-field--grow">
        <label class="fb-label">Recherche</label>
        <input class="fb-input" style="width:100%" [(ngModel)]="recherche" placeholder="Nom d'un employé…">
      </div>
    }
    <div class="fb-actions">
      <button class="fb-btn-apply" (click)="load()">Appliquer</button>
      <button class="fb-btn-clear" (click)="vider()">Vider les filtres</button>
    </div>
  </div>

  <!-- ── Totaux KPI ── -->
  @if (rows().length > 0) {
    <div class="totaux-bar">
      <div class="tot-card tot-blue">
        <div class="tot-val">{{ rows().length }}</div>
        <div class="tot-lbl">Pointages</div>
      </div>
      <div class="tot-card tot-green">
        <div class="tot-val">{{ minToStr(totalTravail()) }}</div>
        <div class="tot-lbl">Total travaillé</div>
      </div>
      @if (nbAnomalies() > 0) {
        <div class="tot-card tot-red">
          <div class="tot-val">{{ nbAnomalies() }}</div>
          <div class="tot-lbl">Non clôturés</div>
        </div>
      }
    </div>
  }

  <!-- ── Tableau ── -->
  <div class="table-wrap">
    @if (loading()) {
      <div class="empty-state"><mat-icon>hourglass_empty</mat-icon><p>Chargement…</p></div>
    } @else if (rows().length === 0) {
      <div class="empty-state"><mat-icon>event_busy</mat-icon><p>Aucun pointage sur cette période</p></div>
    } @else {
      <table class="data-table">
        <thead>
          <tr>
            @if (vue() === 'equipe') { <th>Employé</th><th>Site</th> }
            <th>Date</th>
            <th>Arrivée</th>
            <th>Départ</th>
            <th>Pause</th>
            <th class="th-num th-blue">Travail net</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          @for (h of rows(); track h.pointage.id) {
            <tr class="data-row" [class.row-today]="h.pointage.date === todayIso">
              @if (vue() === 'equipe') {
                <td class="td-employe">{{ employeNom(h.pointage) }}</td>
                <td>{{ tenantSvc.poleLabel(employeSite(h.pointage)) }}</td>
              }
              <td class="td-date">{{ fmtDate(h.pointage.date) }}</td>
              <td class="td-time">{{ fmt(h.pointage.heureArrivee) }}</td>
              <td class="td-time">{{ h.pointage.heureDepart ? fmt(h.pointage.heureDepart) : '—' }}</td>
              <td class="td-time">{{ h.pauseMin > 0 ? minToStr(h.pauseMin) : '—' }}</td>
              <td class="td-num">{{ h.statutClass === 'anomalie' ? '—' : minToStr(h.netMin) }}</td>
              <td><span class="statut-badge" [class]="'statut-badge--' + h.statutClass">{{ h.statutLabel }}</span></td>
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
    .pg-header { display:flex; align-items:center; justify-content:space-between; padding:24px 28px 0; flex-shrink:0; flex-wrap:wrap; gap:12px; }
    .pg-header__left { display:flex; align-items:center; gap:14px; }
    .pg-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .pg-icon--teal { background:linear-gradient(135deg,#0891b2,#0e7490); box-shadow:0 4px 14px rgba(8,145,178,.35); }
    .pg-icon mat-icon { color:#fff; font-size:22px; width:22px; height:22px; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub { font-size:13px; color:#64748b; margin:2px 0 0; }

    .header-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .view-toggle { display:flex; border:1px solid #e2e8f0; border-radius:7px; overflow:hidden; }
    .view-toggle button { height:36px; padding:0 14px; border:none; background:#fff; color:#374151; font-size:12.5px; font-weight:500; cursor:pointer; }
    .vt-active { background:#eef2ff !important; color:#4f46e5 !important; font-weight:700 !important; }

    .btn-export { display:flex; align-items:center; gap:6px; padding:10px 20px; border-radius:9px; border:1.5px solid #bbf7d0; background:#fff; color:#15803d; font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; }
    .btn-export mat-icon { font-size:16px; width:16px; height:16px; }
    .btn-export:hover:not(:disabled) { background:#f0fdf4; border-color:#86efac; box-shadow:0 2px 8px rgba(21,128,61,.15); }
    .btn-export:disabled { opacity:.5; cursor:not-allowed; }

    /* Filter bar */
    .filter-bar { display:flex; align-items:flex-end; gap:12px; padding:18px 28px; flex-wrap:wrap; flex-shrink:0; background:#fff; margin:16px 28px 0; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,.06); border:1px solid #f1f5f9; }
    .fb-field { display:flex; flex-direction:column; gap:4px; position:relative; }
    .fb-field--grow { flex:1; min-width:180px; }
    .fb-label { font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; }
    .fb-input, .fb-select { height:36px; border:1px solid #e2e8f0; border-radius:7px; padding:0 10px; font-size:13px; background:#fff; color:#374151; outline:none; font-family:inherit; min-width:130px; }
    .fb-input:focus, .fb-select:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.12); }
    .fb-actions { display:flex; gap:8px; align-self:flex-end; }
    .fb-btn-apply { height:36px; background:#6366f1; color:#fff; border:none; border-radius:7px; padding:0 16px; font-size:13px; font-weight:600; cursor:pointer; transition:background .15s; }
    .fb-btn-apply:hover { background:#4f46e5; }
    .fb-btn-clear { height:36px; background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; border-radius:7px; padding:0 14px; font-size:13px; cursor:pointer; transition:all .15s; }
    .fb-btn-clear:hover { background:#fee2e2; color:#dc2626; border-color:#fca5a5; }
    .fb-cal-btn {
      height:36px; width:36px; border:1px solid #e2e8f0; border-radius:7px;
      background:#fff; color:#0891b2; cursor:pointer; display:flex;
      align-items:center; justify-content:center; transition:all .15s;
    }
    .fb-cal-btn:hover { background:#ecfeff; border-color:#a5f3fc; }
    .fb-cal-btn mat-icon { font-size:18px; width:18px; height:18px; }
    .fb-range-hidden { position:absolute; width:0; height:0; overflow:hidden; opacity:0; pointer-events:none; }

    /* Totaux */
    .totaux-bar { display:flex; gap:14px; padding:16px 28px 0; flex-shrink:0; }
    .tot-card { flex:1; max-width:200px; border-radius:12px; padding:16px 20px; display:flex; flex-direction:column; gap:4px; border:1px solid transparent; }
    .tot-val { font-size:24px; font-weight:800; font-family:monospace; line-height:1; }
    .tot-lbl { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; opacity:.75; }
    .tot-green { background:#f0fdf4; border-color:#bbf7d0; }
    .tot-green .tot-val, .tot-green .tot-lbl { color:#15803d; }
    .tot-red { background:#fff1f2; border-color:#fecdd3; }
    .tot-red .tot-val, .tot-red .tot-lbl { color:#dc2626; }
    .tot-blue { background:#eff6ff; border-color:#bfdbfe; }
    .tot-blue .tot-val, .tot-blue .tot-lbl { color:#1d4ed8; }

    /* Table */
    .table-wrap { flex:1; overflow:auto; padding:16px 28px 28px; }
    .data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table thead { background:#1e293b; }
    .data-table th { color:#fff; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:11px 14px; text-align:left; white-space:nowrap; }
    .th-num { text-align:right; }
    .th-blue { color:#93c5fd !important; }
    .data-table tbody tr:nth-child(even) { background:#f8fafc; }
    .data-table tbody tr:hover { background:#eef2ff; }
    .data-table td { padding:9px 14px; color:#374151; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
    .row-today { background:#eef2ff !important; }

    .td-employe { font-weight:600; color:#1e293b; white-space:nowrap; }
    .td-date   { white-space:nowrap; font-variant-numeric:tabular-nums; }
    .td-time   { font-variant-numeric:tabular-nums; color:#64748b; text-align:center; font-size:12px; }
    .td-num    { text-align:right; font-variant-numeric:tabular-nums; font-weight:700; color:#1d4ed8; font-family:monospace; }

    .statut-badge { font-size:11px; font-weight:700; padding:3px 9px; border-radius:20px; white-space:nowrap; }
    .statut-badge--termine  { background:#f1f5f9; color:#475569; }
    .statut-badge--cours    { background:#dcfce7; color:#15803d; }
    .statut-badge--pause    { background:#fef3c7; color:#92400e; }
    .statut-badge--anomalie { background:#fee2e2; color:#dc2626; }

    .empty-state { display:flex; flex-direction:column; align-items:center; padding:60px 28px; color:#94a3b8; gap:12px; }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; opacity:.3; display:block; }
    .empty-state p { font-size:14px; margin:0; }
  `],
})
export class PointageHistoriqueComponent implements OnInit {
  private svc  = inject(PointageService);
  private auth = inject(AuthService);
  tenantSvc    = inject(TenantService);

  readonly todayIso = toLocalIso(new Date());

  loading = signal(true);
  vue     = signal<'moi' | 'equipe'>('moi');

  dateFin   = toLocalIso(new Date());
  dateDebut = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return toLocalIso(d); })();
  siteFiltre = '';
  recherche  = '';

  // ── Sélecteur de période via calendrier (icône) ──
  rangeStart: Date | null = null;
  rangeEnd:   Date | null = null;

  onRangeChange() {
    if (!this.rangeStart || !this.rangeEnd) return;
    this.dateDebut = toLocalIso(this.rangeStart);
    this.dateFin   = toLocalIso(this.rangeEnd);
    this.load();
  }

  private rowsMoi    = signal<HistoRow[]>([]);
  private rowsEquipe = signal<(HistoRow & { employe: { firstName: string; lastName: string; site: string } })[]>([]);

  isAdmin() { return this.auth.isAdmin() || this.auth.isExpert(); }

  // Méthodes normales (pas computed()) : "recherche" est liée par ngModel, pas un
  // signal — un computed() ne re-déclenche que sur lecture de signal, il resterait
  // figé tant qu'on tape dans le champ de recherche.
  rows(): (HistoRow & { employe?: { firstName: string; lastName: string; site: string } })[] {
    if (this.vue() === 'moi') return this.rowsMoi();
    const q = this.recherche.trim().toLowerCase();
    if (!q) return this.rowsEquipe();
    return this.rowsEquipe().filter(r => {
      const full = `${r.employe.firstName} ${r.employe.lastName}`.toLowerCase();
      return full.includes(q);
    });
  }

  totalTravail(): number { return this.rows().reduce((a, h) => a + h.netMin, 0); }
  nbAnomalies(): number  { return this.rows().filter(h => h.statutClass === 'anomalie').length; }

  ngOnInit() {
    this.load();
  }

  setVue(v: 'moi' | 'equipe') {
    this.vue.set(v);
    this.load();
  }

  private toRow(p: Pointage): HistoRow {
    const pauseMin = this.calcPause(p);
    let netMin = 0;
    let statutClass: StatutHisto = 'termine';
    let statutLabel = 'Terminé';
    if (p.heureDepart) {
      netMin = this.calcNette(p);
    } else if (p.date === this.todayIso) {
      netMin = this.calcNette(p);
      const pauses = p.pauses ?? [];
      if (pauses.some(x => !x.heureFin)) { statutClass = 'pause'; statutLabel = 'En pause'; }
      else { statutClass = 'cours'; statutLabel = 'En cours'; }
    } else {
      statutClass = 'anomalie'; statutLabel = 'Non clôturé';
    }
    return { pointage: p, pauseMin, netMin, statutClass, statutLabel };
  }

  load() {
    this.loading.set(true);
    if (this.vue() === 'moi') {
      this.svc.getHistorique({ dateDebut: this.dateDebut, dateFin: this.dateFin }).subscribe({
        next: h => { this.rowsMoi.set(h.map(p => this.toRow(p))); this.loading.set(false); },
        error: () => { this.rowsMoi.set([]); this.loading.set(false); },
      });
    } else {
      this.svc.getHistoriqueAll({
        site: this.siteFiltre || undefined,
        dateDebut: this.dateDebut,
        dateFin: this.dateFin,
      }).subscribe({
        next: rows => {
          this.rowsEquipe.set(rows.map(r => ({ ...this.toRow(r), employe: r.user })));
          this.loading.set(false);
        },
        error: () => { this.rowsEquipe.set([]); this.loading.set(false); },
      });
    }
  }

  vider() {
    this.dateFin   = toLocalIso(new Date());
    this.dateDebut = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return toLocalIso(d); })();
    this.rangeStart = this.rangeEnd = null;
    this.siteFiltre = '';
    this.recherche  = '';
    this.load();
  }

  employeNom(p: Pointage): string {
    const r = this.rowsEquipe().find(x => x.pointage.id === p.id);
    return r ? `${r.employe.firstName} ${r.employe.lastName}` : '—';
  }

  employeSite(p: Pointage): string {
    const r = this.rowsEquipe().find(x => x.pointage.id === p.id);
    return r?.employe.site ?? '';
  }

  private calcPause(p: Pointage): number {
    const pauses = p.pauses ?? [];
    if (!pauses.length) return 0;
    return pauses.reduce((sum, pause) => {
      const start = new Date(pause.heureDebut);
      const end   = pause.heureFin ? new Date(pause.heureFin) : new Date();
      return sum + Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
    }, 0);
  }

  private calcNette(p: Pointage): number {
    const fin   = p.heureDepart ? new Date(p.heureDepart) : new Date();
    const total = Math.max(0, Math.floor((fin.getTime() - new Date(p.heureArrivee).getTime()) / 60000));
    return Math.max(0, total - this.calcPause(p));
  }

  minToStr(min: number) {
    return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
  }

  fmt(d: string | Date | null | undefined): string {
    if (!d) return '';
    return new Date(d as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  exportCsv() {
    let csv = '﻿'; // BOM UTF-8 pour Excel
    const headers = this.vue() === 'equipe'
      ? ['Employé', 'Site', 'Date', 'Arrivée', 'Départ', 'Pause', 'Travail net', 'Statut']
      : ['Date', 'Arrivée', 'Départ', 'Pause', 'Travail net', 'Statut'];
    csv += headers.join(';') + '\n';
    this.rows().forEach(h => {
      const base = [
        this.fmtDate(h.pointage.date),
        this.fmt(h.pointage.heureArrivee),
        h.pointage.heureDepart ? this.fmt(h.pointage.heureDepart) : '',
        h.pauseMin > 0 ? this.minToStr(h.pauseMin) : '',
        h.statutClass === 'anomalie' ? '' : this.minToStr(h.netMin),
        h.statutLabel,
      ];
      const line = this.vue() === 'equipe'
        ? [this.employeNom(h.pointage), this.tenantSvc.poleLabel(this.employeSite(h.pointage)), ...base]
        : base;
      csv += line.join(';') + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `historique-pointage_${this.dateDebut}_${this.dateFin}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  exportPdf() {
    const isEquipe = this.vue() === 'equipe';
    const doc = new jsPDF({ orientation: isEquipe ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();

    doc.setFillColor(8, 145, 178);
    doc.rect(0, 0, W, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(isEquipe ? 'Historique des présences — équipe' : 'Mon historique de pointage', 14, 13);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${this.fmtDate(this.dateDebut)} → ${this.fmtDate(this.dateFin)}`, W - 14, 13, { align: 'right' });

    const head = isEquipe
      ? [['Employé', 'Site', 'Date', 'Arrivée', 'Départ', 'Pause', 'Travail net', 'Statut']]
      : [['Date', 'Arrivée', 'Départ', 'Pause', 'Travail net', 'Statut']];

    const body = this.rows().map(h => {
      const base = [
        this.fmtDate(h.pointage.date),
        this.fmt(h.pointage.heureArrivee),
        h.pointage.heureDepart ? this.fmt(h.pointage.heureDepart) : '—',
        h.pauseMin > 0 ? this.minToStr(h.pauseMin) : '—',
        h.statutClass === 'anomalie' ? '—' : this.minToStr(h.netMin),
        h.statutLabel,
      ];
      return isEquipe
        ? [this.employeNom(h.pointage), this.tenantSvc.poleLabel(this.employeSite(h.pointage)), ...base]
        : base;
    });

    autoTable(doc, {
      startY: 26,
      head,
      body,
      headStyles: { fillColor: [8, 145, 178], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [236, 254, 255] },
      styles: { fontSize: 9, cellPadding: 3 },
    });

    doc.save(`historique-pointage_${this.dateDebut}_${this.dateFin}.pdf`);
  }
}
