import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Subject, takeUntil } from 'rxjs';
import { SaisieTempsService } from '../../../../core/services/saisie-temps.service';
import { toLocalIso } from '../../../../core/services/date.util';
import { UsersService } from '../../../../core/services/users.service';
import { User } from '../../../../core/models/user.model';
import { exportRowsToCsv } from '../../../../core/services/csv-export.util';
import { formatHeures } from '../../../../core/services/duree.util';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-travail-temps-semaine',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatAutocompleteModule],
  template: `
<div class="page">

  <!-- ── Header ── -->
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon pg-icon--violet"><mat-icon>date_range</mat-icon></div>
      <div>
        <h1 class="pg-title">Temps passés par semaine</h1>
        <p class="pg-sub">{{ filteredRows().length }} ligne(s) · semaine courante : S{{ currentWeek }}</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn-export" (click)="exportCsv()" [disabled]="filteredRows().length === 0">
        <mat-icon>download</mat-icon> Export CSV
      </button>
      <button class="btn-export" (click)="exportPdf()" [disabled]="filteredRows().length === 0">
        <mat-icon>picture_as_pdf</mat-icon> Export PDF
      </button>
    </div>
  </div>

  <!-- ── Filtres inline ── -->
  <div class="filter-bar">
    <div class="fb-field">
      <label class="fb-label">À partir du</label>
      <input type="date" class="fb-input" [(ngModel)]="dateDebut" />
    </div>
    <div class="fb-field">
      <label class="fb-label">Jusqu'au</label>
      <input type="date" class="fb-input" [(ngModel)]="dateFin" />
    </div>
    <div class="fb-field">
      <label class="fb-label">Collaborateur</label>
      <input class="fb-select" [(ngModel)]="collaborateurSearch" name="collaborateurSearch"
             [matAutocomplete]="collabAuto" placeholder="Tous"
             (blur)="onCollaborateurBlur()" autocomplete="off" />
      <mat-autocomplete #collabAuto="matAutocomplete" (optionSelected)="onCollaborateurSelected($event)">
        <mat-option [value]="''">Tous</mat-option>
        @for (u of filteredUsers; track u.id) {
          <mat-option [value]="'' + u.id">{{ u.firstName }} {{ u.lastName }}</mat-option>
        }
      </mat-autocomplete>
    </div>
    <div class="fb-field fb-field--grow">
      <label class="fb-label">Recherche</label>
      <input class="fb-input" style="width:100%" [(ngModel)]="recherche" placeholder="Collaborateur, période…" />
    </div>
    <div class="fb-actions">
      <button class="fb-btn-apply" (click)="load()">Appliquer</button>
      <button class="fb-btn-clear" (click)="vider()">Vider les filtres</button>
    </div>
  </div>

  <!-- ── Totaux KPI ── -->
  @if (filteredRows().length > 0) {
    <div class="totaux-bar">
      <div class="tot-card tot-green">
        <div class="tot-val">{{ formatH(sumFacturable()) }}</div>
        <div class="tot-lbl">Réalisé Facturable</div>
      </div>
      <div class="tot-card tot-red">
        <div class="tot-val">{{ formatH(sumNF()) }}</div>
        <div class="tot-lbl">Réalisé Non Facturable</div>
      </div>
      <div class="tot-card tot-blue">
        <div class="tot-val">{{ formatH(sumFacturable() + sumNF()) }}</div>
        <div class="tot-lbl">Réalisé Total</div>
      </div>
    </div>
  }

  <!-- ── Toolbar ── -->
  <div class="table-toolbar">
    <button class="tb-btn" (click)="load()">
      <mat-icon style="font-size:14px;width:14px;height:14px;">refresh</mat-icon> Recharger
    </button>
    <span class="tb-count">{{ filteredRows().length }} résultat(s)</span>
  </div>

  <!-- ── Tableau ── -->
  <div class="table-wrap">
    @if (loading()) {
      <div class="empty-state"><mat-icon>hourglass_empty</mat-icon><p>Chargement…</p></div>
    } @else if (filteredRows().length === 0) {
      <div class="empty-state"><mat-icon>timer_off</mat-icon><p>Aucune saisie pour cette période</p></div>
    } @else {
      <table class="data-table">
        <thead>
          <tr>
            <th></th>
            <th>Semaine n°</th>
            <th>Période</th>
            <th>Collaborateur</th>
            <th class="th-num th-green">Facturable</th>
            <th class="th-num th-red">Non facturable</th>
            <th class="th-num th-blue">Total</th>
            <th>Ratio facturable</th>
          </tr>
        </thead>
        <tbody>
          @for (r of filteredRows(); track r.isoWeek + r.collaborateur) {
            <tr class="data-row" [class.row-current]="r.semaine === currentWeek" (click)="toggleExpand(rowKey(r))">
              <td class="td-expand">
                <mat-icon class="expand-icon" [class.expand-icon--open]="isExpanded(rowKey(r))">chevron_right</mat-icon>
              </td>
              <td>
                <span class="semaine-badge">S{{ r.semaine }}</span>
                <span class="annee-label">{{ r.annee }}</span>
              </td>
              <td class="td-periode">{{ formatPeriode(r.periode) }}</td>
              <td class="td-collab">{{ r.collaborateur }}</td>
              <td class="td-num td-fact">{{ formatH(r.facturable) }}</td>
              <td class="td-num td-nf">{{ formatH(r.nonFacturable) }}</td>
              <td class="td-num td-total">{{ formatH(r.total) }}</td>
              <td>
                @if (r.total > 0) {
                  <div class="ratio-wrap" [matTooltip]="ratioLabel(r)">
                    <div class="ratio-bar">
                      <div class="ratio-fill" [style.width.%]="r.facturable / r.total * 100"></div>
                    </div>
                    <span class="ratio-pct">{{ (r.facturable / r.total * 100).toFixed(0) }}%</span>
                  </div>
                }
              </td>
            </tr>
            @if (isExpanded(rowKey(r))) {
              <tr class="detail-row">
                <td colspan="8">
                  <table class="detail-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Client</th>
                        <th>Mission</th>
                        <th>Début</th>
                        <th>Fin</th>
                        <th class="th-num">Durée</th>
                        <th>Type</th>
                        <th>Commentaire</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (s of r.saisies; track s.id) {
                        <tr>
                          <td>{{ formatDate(s.date) }}</td>
                          <td>{{ s.client ?? '—' }}</td>
                          <td>{{ s.missionCode ?? '—' }}</td>
                          <td>{{ s.heureDebut ?? '—' }}</td>
                          <td>{{ s.heureFin ?? '—' }}</td>
                          <td class="td-num">{{ formatH(s.dureeHeures) }}</td>
                          <td>
                            @if (s.type === 'FACTURABLE') {
                              <span class="badge-fact">✓ Facturable</span>
                            } @else {
                              <span class="badge-nf">✗ Non fact.</span>
                            }
                          </td>
                          <td class="td-comment">{{ s.commentaire ?? '—' }}</td>
                        </tr>
                      } @empty {
                        <tr><td colspan="8" class="detail-empty">Aucune tâche</td></tr>
                      }
                    </tbody>
                  </table>
                </td>
              </tr>
            }
          }
        </tbody>
        <tfoot>
          <tr class="footer-row">
            <td colspan="4"><strong>Total général</strong></td>
            <td class="td-num td-fact"><strong>{{ formatH(sumFacturable()) }}</strong></td>
            <td class="td-num td-nf"><strong>{{ formatH(sumNF()) }}</strong></td>
            <td class="td-num td-total"><strong>{{ formatH(sumFacturable() + sumNF()) }}</strong></td>
            <td></td>
          </tr>
        </tfoot>
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
    .pg-icon--violet { background:linear-gradient(135deg,#7c3aed,#6d28d9); box-shadow:0 4px 14px rgba(124,58,237,.35); }
    .pg-icon mat-icon { color:#fff; font-size:22px; width:22px; height:22px; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub { font-size:13px; color:#64748b; margin:2px 0 0; }

    .header-actions { display:flex; align-items:center; gap:10px; }
    .btn-export { display:flex; align-items:center; gap:6px; padding:10px 20px; border-radius:9px; border:1.5px solid #bbf7d0; background:#fff; color:#15803d; font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; }
    .btn-export mat-icon { font-size:16px; width:16px; height:16px; }
    .btn-export:hover:not(:disabled) { background:#f0fdf4; border-color:#86efac; box-shadow:0 2px 8px rgba(21,128,61,.15); }
    .btn-export:disabled { opacity:.5; cursor:not-allowed; }

    /* Filter bar */
    .filter-bar { display:flex; align-items:flex-end; gap:12px; padding:18px 28px 0; flex-wrap:wrap; flex-shrink:0; background:#fff; margin:16px 28px 0; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,.06); border:1px solid #f1f5f9; }
    .fb-field { display:flex; flex-direction:column; gap:4px; }
    .fb-field--grow { flex:1; min-width:180px; }
    .fb-label { font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; }
    .fb-input, .fb-select { height:36px; border:1px solid #e2e8f0; border-radius:7px; padding:0 10px; font-size:13px; background:#fff; color:#374151; outline:none; font-family:inherit; min-width:130px; }
    .fb-input:focus, .fb-select:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.12); }
    .fb-actions { display:flex; gap:8px; align-self:flex-end; margin-bottom:0; }
    .fb-btn-apply { height:36px; background:#6366f1; color:#fff; border:none; border-radius:7px; padding:0 16px; font-size:13px; font-weight:600; cursor:pointer; transition:background .15s; }
    .fb-btn-apply:hover { background:#4f46e5; }
    .fb-btn-clear { height:36px; background:#f1f5f9; color:#64748b; border:1px solid #e2e8f0; border-radius:7px; padding:0 14px; font-size:13px; cursor:pointer; transition:all .15s; }
    .fb-btn-clear:hover { background:#fee2e2; color:#dc2626; border-color:#fca5a5; }

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

    /* Toolbar */
    .table-toolbar { display:flex; align-items:center; gap:8px; padding:16px 28px 10px; flex-shrink:0; }
    .tb-count { font-size:12px; color:#64748b; margin-left:auto; font-weight:600; }
    .tb-btn { height:32px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0 12px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:5px; color:#374151; transition:all .15s; }
    .tb-btn:hover { background:#e0e7ff; border-color:#c7d2fe; color:#4f46e5; }

    /* Table */
    .table-wrap { flex:1; overflow:auto; padding:0 28px 28px; }
    .data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table thead { background:#1e293b; }
    .data-table th { color:#fff; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:11px 14px; text-align:left; white-space:nowrap; }
    .th-num { text-align:right; }
    .th-green { color:#86efac !important; }
    .th-red   { color:#fca5a5 !important; }
    .th-blue  { color:#93c5fd !important; }
    .data-table tbody tr:nth-child(even) { background:#f8fafc; }
    .data-table tbody tr:hover { background:#eef2ff; }
    .data-table td { padding:10px 14px; color:#374151; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
    .row-current { background:#faf5ff !important; }
    .data-row { cursor:pointer; }
    .td-expand { width:28px; padding-right:0 !important; }
    .expand-icon { font-size:18px; width:18px; height:18px; color:#94a3b8; transition:transform .15s; }
    .expand-icon--open { transform:rotate(90deg); color:#6366f1; }

    /* Détail des tâches (ligne dépliée) */
    .detail-row td { padding:0 14px 12px; background:#fafbff; border-bottom:1px solid #f1f5f9; }
    .detail-table { width:100%; border-collapse:collapse; font-size:12px; background:#fff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; }
    .detail-table thead { background:#eef2ff; }
    .detail-table th { color:#4338ca; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:7px 10px; text-align:left; }
    .detail-table td { padding:6px 10px; color:#475569; border-bottom:1px solid #f1f5f9; }
    .detail-table tbody tr:last-child td { border-bottom:none; }
    .detail-table tbody tr:hover { background:#f8fafc; }
    .detail-table .th-num, .detail-table .td-num { text-align:right; }
    .detail-empty { text-align:center; color:#94a3b8; padding:12px !important; }
    .td-comment { color:#64748b; font-size:11.5px; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .badge-fact { font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:20px; background:#dcfce7; color:#15803d; }
    .badge-nf   { font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:20px; background:#fee2e2; color:#dc2626; }

    .td-periode { color:#64748b; font-size:11.5px; white-space:nowrap; }
    .td-collab  { color:#475569; white-space:nowrap; }
    .td-num { text-align:right; font-variant-numeric:tabular-nums; font-weight:600; }
    .td-fact  { color:#15803d; }
    .td-nf    { color:#dc2626; }
    .td-total { color:#1d4ed8; font-weight:800; }

    .semaine-badge { font-size:13px; font-weight:800; color:#6366f1; }
    .annee-label   { font-size:10px; color:#94a3b8; margin-left:4px; }

    .ratio-wrap { display:flex; align-items:center; gap:8px; }
    .ratio-bar { flex:1; height:8px; background:#fee2e2; border-radius:4px; overflow:hidden; min-width:60px; }
    .ratio-fill { height:100%; background:#22c55e; border-radius:4px; transition:width .3s; }
    .ratio-pct { font-size:11px; font-weight:700; color:#475569; min-width:36px; text-align:right; }

    .footer-row td { padding:10px 14px; border-top:2px solid #e8ecf0; background:#f0f4ff; }

    .empty-state { display:flex; flex-direction:column; align-items:center; padding:60px 28px; color:#94a3b8; gap:12px; }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; opacity:.3; display:block; }
    .empty-state p { font-size:14px; margin:0; }
  `],
})
export class TravailTempsSemaineComponent implements OnInit, OnDestroy {
  private svc      = inject(SaisieTempsService);
  private usersSvc = inject(UsersService);
  private _d$      = new Subject<void>();

  loading = signal(true);
  rows    = signal<any[]>([]);
  users: User[] = [];

  dateDebut       = '';
  dateFin         = '';
  collaborateurId = '';
  recherche       = '';
  collaborateurSearch = '';

  get filteredUsers(): User[] {
    const sorted = [...this.users].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'fr', { sensitivity: 'base' }));
    const term = this.collaborateurSearch.trim().toLowerCase();
    if (!term) return sorted;
    return sorted.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(term));
  }

  onCollaborateurSelected(event: MatAutocompleteSelectedEvent) {
    this.collaborateurId = event.option.value;
    this.syncCollaborateurSearchFromId();
  }

  onCollaborateurBlur() {
    // Délai volontaire : un clic sur une option déclenche aussi le blur de l'input, et s'il se
    // réconcilie immédiatement, il écrase la sélection en cours avant que (optionSelected) n'ait
    // eu le temps de s'appliquer. NE PAS OMETTRE CE DÉLAI.
    setTimeout(() => this.syncCollaborateurSearchFromId(), 200);
  }

  private syncCollaborateurSearchFromId() {
    const u = this.users.find(x => String(x.id) === this.collaborateurId);
    this.collaborateurSearch = u ? `${u.firstName} ${u.lastName}` : '';
  }

  expandedKeys = signal<Set<string>>(new Set());
  rowKey(r: any): string { return `${r.isoWeek}__${r.collaborateur}`; }
  isExpanded(key: string): boolean { return this.expandedKeys().has(key); }
  toggleExpand(key: string) {
    const s = new Set(this.expandedKeys());
    if (s.has(key)) s.delete(key); else s.add(key);
    this.expandedKeys.set(s);
  }

  // Méthode normale (pas computed()) : "recherche" est liée par ngModel, pas un signal.
  filteredRows(): any[] {
    const q = this.recherche.trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter(r =>
      (r.collaborateur ?? '').toLowerCase().includes(q) ||
      (r.periode ?? '').toLowerCase().includes(q),
    );
  }

  get currentWeek(): number {
    const d = new Date();
    const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
    const ys = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    return Math.ceil((((dt.getTime() - ys.getTime()) / 86400000) + 1) / 7);
  }

  ngOnInit() {
    const now = new Date();
    this.dateFin   = toLocalIso(now);
    const debut = new Date(now); debut.setDate(debut.getDate() - 90);
    this.dateDebut = toLocalIso(debut);
    this.usersSvc.getAll().pipe(takeUntil(this._d$)).subscribe(u => this.users = u);
    this.load();
  }

  ngOnDestroy() { this._d$.next(); this._d$.complete(); }

  load() {
    this.loading.set(true);
    this.svc.getRapportSemaine({
      dateDebut:       this.dateDebut || undefined,
      dateFin:         this.dateFin   || undefined,
      collaborateurId: this.collaborateurId ? +this.collaborateurId : undefined,
    }).pipe(takeUntil(this._d$)).subscribe({
      next: data => { this.rows.set(data); this.loading.set(false); },
      error: ()  => { this.rows.set([]); this.loading.set(false); },
    });
  }

  vider() { this.dateDebut = this.dateFin = this.collaborateurId = this.recherche = this.collaborateurSearch = ''; this.rows.set([]); }

  sumFacturable() { return this.filteredRows().reduce((a, r) => a + r.facturable, 0); }
  sumNF()         { return this.filteredRows().reduce((a, r) => a + r.nonFacturable, 0); }

  formatH(h: number): string { return formatHeures(h); }

  formatPeriode(p: string): string {
    if (!p) return '—';
    return p.replace(/(\d{4}-\d{2}-\d{2})/g, (m) => { const [y,mo,d] = m.split('-'); return `${d}/${mo}/${y}`; });
  }

  formatDate(d: string): string {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  /** Export CSV détaillé : une ligne par tâche (saisie), avec la semaine/collaborateur
   *  répétés sur chaque ligne — pour retrouver le détail sans repasser par l'écran. */
  exportCsv() {
    const flat: any[] = [];
    for (const r of this.filteredRows()) {
      for (const s of (r.saisies ?? [])) {
        flat.push({ ...s, semaine: r.semaine, annee: r.annee, periode: this.formatPeriode(r.periode), collaborateur: r.collaborateur });
      }
    }
    exportRowsToCsv(flat, [
      { header: 'Semaine',       value: r => `S${r.semaine}` },
      { header: 'Année',         value: r => r.annee },
      { header: 'Période',       value: r => r.periode },
      { header: 'Collaborateur', value: r => r.collaborateur },
      { header: 'Date',          value: r => this.formatDate(r.date) },
      { header: 'Client',        value: r => r.client ?? '' },
      { header: 'Mission',       value: r => r.missionCode ?? '' },
      { header: 'Heure début',   value: r => r.heureDebut ?? '' },
      { header: 'Heure fin',     value: r => r.heureFin ?? '' },
      { header: 'Durée (h)',     value: r => r.dureeHeures?.toFixed(2) ?? '0' },
      { header: 'Type',          value: r => r.type },
      { header: 'Commentaire',   value: r => r.commentaire ?? '' },
    ], 'temps-semaine-detail');
  }

  /** Export PDF détaillé : pour chaque semaine × collaborateur, une ligne d'en-tête (totaux)
   *  suivie du détail de chaque tâche qui la compose. */
  exportPdf() {
    const rows = this.filteredRows();
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, pageW, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Temps passés par semaine — détail des tâches', 14, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pageW - 14, 12, { align: 'right' });

    const body: any[] = [];
    const isHeaderRow: boolean[] = [];
    for (const r of rows) {
      body.push([
        `S${r.semaine} ${r.annee} — ${this.formatPeriode(r.periode)}`,
        r.collaborateur, '', '', '',
        r.total?.toFixed(2) ?? '0',
        '', `Facturable : ${r.facturable?.toFixed(2) ?? '0'}h · Non fact. : ${r.nonFacturable?.toFixed(2) ?? '0'}h`,
      ]);
      isHeaderRow.push(true);
      for (const s of (r.saisies ?? [])) {
        body.push([
          this.formatDate(s.date), '', s.client ?? '—', s.missionCode ?? '—',
          `${s.heureDebut ?? '—'}–${s.heureFin ?? '—'}`,
          s.dureeHeures?.toFixed(2) ?? '0',
          s.type === 'FACTURABLE' ? 'Facturable' : 'Non fact.',
          s.commentaire ?? '',
        ]);
        isHeaderRow.push(false);
      }
    }

    autoTable(doc, {
      startY: 24,
      head: [['Date / Semaine', 'Collaborateur', 'Client', 'Mission', 'Horaires', 'Durée (h)', 'Type', 'Commentaire']],
      body,
      headStyles: { fillColor: [124, 58, 237], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5 },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && isHeaderRow[data.row.index]) {
          data.cell.styles.fillColor = [237, 233, 254];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = [76, 29, 149];
        }
      },
    });

    doc.save('temps-semaine-detail.pdf');
  }

  ratioLabel(r: any): string {
    if (!r.total) return '—';
    const pct = (r.facturable / r.total * 100).toFixed(1);
    return `${pct}% facturable`;
  }
}
