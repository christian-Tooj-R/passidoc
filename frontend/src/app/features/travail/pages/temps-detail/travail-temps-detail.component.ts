import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { SaisieTempsService } from '../../../../core/services/saisie-temps.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { UsersService } from '../../../../core/services/users.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Client } from '../../../../core/models/client.model';
import { User } from '../../../../core/models/user.model';
import { exportRowsToCsv } from '../../../../core/services/csv-export.util';
import { formatHeures } from '../../../../core/services/duree.util';
import { SaisieEditFormComponent, SaisieEditSeed, SaisieEditResult } from '../../shared/saisie-edit-form.component';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-travail-temps-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, SaisieEditFormComponent],
  template: `
<div class="page">

  <!-- ── Header ── -->
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon pg-icon--teal"><mat-icon>manage_search</mat-icon></div>
      <div>
        <h1 class="pg-title">Détail des temps passés</h1>
        <p class="pg-sub">{{ filteredRows().length }} saisie(s) · page {{ page() + 1 }}/{{ totalPages() }}</p>
      </div>
    </div>
    <button class="btn-export" (click)="exportCsv()" [disabled]="filteredRows().length === 0">
      <mat-icon>download</mat-icon> Export CSV
    </button>
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
      <select class="fb-select" [(ngModel)]="collaborateurId">
        <option value="">Tous</option>
        @for (u of users; track u.id) {
          <option [value]="u.id">{{ u.firstName }} {{ u.lastName }}</option>
        }
      </select>
    </div>
    <div class="fb-field">
      <label class="fb-label">Client</label>
      <select class="fb-select" [(ngModel)]="clientId">
        <option value="">Tous</option>
        @for (c of clients; track c.id) {
          <option [value]="c.id">{{ c.nom }}</option>
        }
      </select>
    </div>
    <div class="fb-field">
      <label class="fb-label">Facturable</label>
      <select class="fb-select" [(ngModel)]="filterFacturable">
        <option value="">Tous</option>
        <option value="FACTURABLE">Oui</option>
        <option value="NON_FACTURABLE">Non</option>
      </select>
    </div>
    <div class="fb-field fb-field--grow">
      <label class="fb-label">Recherche</label>
      <input class="fb-input" style="width:100%" [(ngModel)]="recherche"
             placeholder="Client, mission, commentaire…" />
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
        <div class="tot-val">{{ formatH(totalFacturable()) }}</div>
        <div class="tot-lbl">Réalisé Facturable</div>
      </div>
      <div class="tot-card tot-red">
        <div class="tot-val">{{ formatH(totalNF()) }}</div>
        <div class="tot-lbl">Réalisé Non Facturable</div>
      </div>
      <div class="tot-card tot-blue">
        <div class="tot-val">{{ formatH(totalFacturable() + totalNF()) }}</div>
        <div class="tot-lbl">Réalisé Total</div>
      </div>
    </div>
  }

  <!-- ── Formulaire édition / duplication ── -->
  @if (editing()) {
    <app-saisie-edit-form
      [clients]="clients"
      [mode]="editMode()"
      [seed]="editSeed()"
      [submitting]="saving()"
      [apiError]="editError()"
      (save)="onSaveEdit($event)"
      (cancel)="closeEdit()" />
  }

  <!-- ── Toolbar ── -->
  <div class="table-toolbar">
    <button class="tb-btn" (click)="load()">
      <mat-icon style="font-size:14px;width:14px;height:14px;">refresh</mat-icon> Recharger
    </button>
    <span class="tb-count">{{ filteredRows().length }} résultat(s) — Lignes {{ page() * 50 + 1 }} à {{ Math.min((page() + 1) * 50, filteredRows().length) }}</span>
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
            <th>Date</th>
            <th>Collaborateur</th>
            <th>Client</th>
            <th>Mission</th>
            <th>Début</th>
            <th>Fin</th>
            <th class="th-num th-blue">Durée</th>
            <th>Type</th>
            <th>Commentaire</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (r of pageRows(); track r.id) {
            <tr class="data-row">
              <td class="td-date">{{ formatDate(r.date) }}</td>
              <td class="td-collab">{{ r.collaborateur ?? '—' }}</td>
              <td class="td-client">{{ r.client ?? '—' }}</td>
              <td>{{ r.missionCode ?? '—' }}</td>
              <td class="td-time">{{ r.heureDebut ?? '—' }}</td>
              <td class="td-time">{{ r.heureFin ?? '—' }}</td>
              <td class="td-num">{{ formatH(r.dureeHeures) }}</td>
              <td>
                @if (r.type === 'FACTURABLE') {
                  <span class="badge-fact">✓ Facturable</span>
                } @else {
                  <span class="badge-nf">✗ Non fact.</span>
                }
              </td>
              <td class="td-comment">{{ r.commentaire ?? '—' }}</td>
              <td class="td-actions">
                @if (r.isLocked) {
                  <mat-icon style="font-size:16px;width:16px;height:16px;color:#94a3b8;" title="Verrouillée">lock</mat-icon>
                } @else if (isMine(r)) {
                  <button class="td-act" (click)="startEdit(r)" title="Modifier">
                    <mat-icon style="font-size:16px;width:16px;height:16px;">edit</mat-icon>
                  </button>
                  <button class="td-act" (click)="startDuplicate(r)" title="Dupliquer">
                    <mat-icon style="font-size:16px;width:16px;height:16px;">content_copy</mat-icon>
                  </button>
                  <button class="td-act td-act--del" (click)="supprimer(r)" title="Supprimer">
                    <mat-icon style="font-size:16px;width:16px;height:16px;">delete_outline</mat-icon>
                  </button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>

      <!-- Pagination style Tempolia -->
      @if (totalPages() > 1) {
        <div class="pagination">
          <button class="pag-btn" (click)="prevPage()" [disabled]="page() === 0">
            <mat-icon>chevron_left</mat-icon> Précédent
          </button>
          <span class="pag-info">Lignes {{ page() * 50 + 1 }} à {{ Math.min((page() + 1) * 50, filteredRows().length) }} — Total : {{ filteredRows().length }} résultats</span>
          <button class="pag-btn" (click)="nextPage()" [disabled]="page() === totalPages() - 1">
            Suivant <mat-icon>chevron_right</mat-icon>
          </button>
        </div>
      }
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
    .pg-icon--teal { background:linear-gradient(135deg,#0891b2,#0e7490); box-shadow:0 4px 14px rgba(8,145,178,.35); }
    .pg-icon mat-icon { color:#fff; font-size:22px; width:22px; height:22px; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub { font-size:13px; color:#64748b; margin:2px 0 0; }

    .btn-export { display:flex; align-items:center; gap:6px; padding:10px 20px; border-radius:9px; border:1.5px solid #bbf7d0; background:#fff; color:#15803d; font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; }
    .btn-export mat-icon { font-size:16px; width:16px; height:16px; }
    .btn-export:hover:not(:disabled) { background:#f0fdf4; border-color:#86efac; box-shadow:0 2px 8px rgba(21,128,61,.15); }
    .btn-export:disabled { opacity:.5; cursor:not-allowed; }

    /* Filter bar */
    .filter-bar { display:flex; align-items:flex-end; gap:12px; padding:18px 28px; flex-wrap:wrap; flex-shrink:0; background:#fff; margin:16px 28px 0; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,.06); border:1px solid #f1f5f9; }
    .fb-field { display:flex; flex-direction:column; gap:4px; }
    .fb-field--grow { flex:1; min-width:180px; }
    .fb-label { font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; }
    .fb-input, .fb-select { height:36px; border:1px solid #e2e8f0; border-radius:7px; padding:0 10px; font-size:13px; background:#fff; color:#374151; outline:none; font-family:inherit; min-width:130px; }
    .fb-input:focus, .fb-select:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.12); }
    .fb-actions { display:flex; gap:8px; align-self:flex-end; }
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
    .th-blue { color:#93c5fd !important; }
    .data-table tbody tr:nth-child(even) { background:#f8fafc; }
    .data-table tbody tr:hover { background:#eef2ff; }
    .data-table td { padding:8px 14px; color:#374151; border-bottom:1px solid #f1f5f9; vertical-align:middle; }

    .td-date   { white-space:nowrap; font-variant-numeric:tabular-nums; }
    .td-collab { color:#475569; white-space:nowrap; }
    .td-client { color:#475569; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .td-time   { font-variant-numeric:tabular-nums; color:#64748b; text-align:center; font-size:12px; }
    .td-num    { text-align:right; font-variant-numeric:tabular-nums; font-weight:700; color:#7c3aed; font-family:monospace; }
    .td-comment { color:#64748b; font-size:11.5px; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .td-actions { text-align:right; white-space:nowrap; }
    .td-act { background:none; border:none; cursor:pointer; color:#94a3b8; padding:4px; border-radius:5px; display:inline-flex; transition:all .15s; margin-left:2px; }
    .td-act:hover { color:#4f46e5; background:#e0e7ff; }
    .td-act--del:hover { color:#dc2626; background:#fee2e2; }

    .badge-fact { font-size:11px; font-weight:700; padding:3px 9px; border-radius:20px; background:#dcfce7; color:#15803d; }
    .badge-nf   { font-size:11px; font-weight:700; padding:3px 9px; border-radius:20px; background:#fee2e2; color:#dc2626; }

    /* Pagination */
    .pagination { display:flex; align-items:center; justify-content:center; gap:16px; padding:16px 0; }
    .pag-btn { display:flex; align-items:center; gap:4px; height:36px; border-radius:8px; border:1.5px solid #e2e8f0; background:white; cursor:pointer; color:#475569; font-size:13px; font-weight:500; padding:0 14px; transition:all .12s; }
    .pag-btn mat-icon { font-size:18px; width:18px; height:18px; }
    .pag-btn:hover:not(:disabled) { border-color:#6366f1; color:#6366f1; background:#eef2ff; }
    .pag-btn:disabled { opacity:.4; cursor:not-allowed; }
    .pag-info { font-size:12.5px; font-weight:600; color:#475569; }

    .empty-state { display:flex; flex-direction:column; align-items:center; padding:60px 28px; color:#94a3b8; gap:12px; }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; opacity:.3; display:block; }
    .empty-state p { font-size:14px; margin:0; }
  `],
})
export class TravailTempsDetailComponent implements OnInit, OnDestroy {
  protected readonly Math = Math;

  private svc        = inject(SaisieTempsService);
  private clientsSvc = inject(ClientsService);
  private usersSvc   = inject(UsersService);
  private authSvc    = inject(AuthService);
  private _d$        = new Subject<void>();

  loading  = signal(true);
  allRows  = signal<any[]>([]);
  page     = signal(0);
  clients: Client[] = [];
  users: User[]     = [];

  dateDebut        = '';
  dateFin          = '';
  collaborateurId  = '';
  clientId         = '';
  filterFacturable = '';
  recherche        = '';

  // ── Édition / duplication ──
  editing   = signal(false);
  editMode  = signal<'edit' | 'duplicate'>('edit');
  editSeed  = signal<SaisieEditSeed | null>(null);
  editingId = signal<number | null>(null);
  saving    = signal(false);
  editError = signal('');

  // NB : méthodes normales (et non computed()) car "recherche" est lié par ngModel
  // (propriété simple, pas un signal) — un computed() Angular ne re-déclenche que
  // sur lecture de signal. Comme le reste du module, on relit à chaque cycle.
  filteredRows(): any[] {
    const q = this.recherche.trim().toLowerCase();
    if (!q) return this.allRows();
    return this.allRows().filter(r =>
      (r.client ?? '').toLowerCase().includes(q) ||
      (r.collaborateur ?? '').toLowerCase().includes(q) ||
      (r.missionCode ?? '').toLowerCase().includes(q) ||
      (r.commentaire ?? '').toLowerCase().includes(q),
    );
  }
  pageRows(): any[]    { return this.filteredRows().slice(this.page() * PAGE_SIZE, (this.page() + 1) * PAGE_SIZE); }
  totalPages(): number { return Math.max(1, Math.ceil(this.filteredRows().length / PAGE_SIZE)); }

  ngOnInit() {
    const now = new Date();
    this.dateFin   = now.toISOString().split('T')[0];
    const debut = new Date(now); debut.setDate(debut.getDate() - 30);
    this.dateDebut = debut.toISOString().split('T')[0];
    this.clientsSvc.getAll().pipe(takeUntil(this._d$)).subscribe(c => this.clients = c);
    this.usersSvc.getAll().pipe(takeUntil(this._d$)).subscribe(u => this.users = u);
    this.load();
  }

  ngOnDestroy() { this._d$.next(); this._d$.complete(); }

  load() {
    this.loading.set(true);
    this.page.set(0);
    this.svc.getRapportJour({
      dateDebut:       this.dateDebut || undefined,
      dateFin:         this.dateFin   || undefined,
      collaborateurId: this.collaborateurId ? +this.collaborateurId : undefined,
      clientId:        this.clientId  ? +this.clientId  : undefined,
    }).pipe(takeUntil(this._d$)).subscribe({
      next: data => {
        let rows = data;
        if (this.filterFacturable) rows = rows.filter((r: any) => r.type === this.filterFacturable);
        this.allRows.set(rows);
        this.loading.set(false);
      },
      error: () => { this.allRows.set([]); this.loading.set(false); },
    });
  }

  vider() {
    this.dateDebut = this.dateFin = this.collaborateurId = this.clientId = this.filterFacturable = this.recherche = '';
    this.allRows.set([]);
    this.page.set(0);
  }

  prevPage() { if (this.page() > 0) this.page.update(p => p - 1); }
  nextPage() { if (this.page() < this.totalPages() - 1) this.page.update(p => p + 1); }

  isMine(r: any): boolean {
    const me = this.authSvc.currentUser();
    return !!me && r.collaborateurId === me.id;
  }

  totalFacturable() { return this.filteredRows().filter(r => r.type === 'FACTURABLE').reduce((a, r) => a + r.dureeHeures, 0); }
  totalNF()         { return this.filteredRows().filter(r => r.type !== 'FACTURABLE').reduce((a, r) => a + r.dureeHeures, 0); }

  formatH(h: number): string { return formatHeures(h); }

  formatDate(d: string): string {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  // ── Édition ──
  startEdit(r: any) {
    this.editMode.set('edit');
    this.editingId.set(r.id);
    this.editError.set('');
    this.editSeed.set({
      date: r.date, clientId: r.clientId ?? null, missionCode: r.missionCode ?? null,
      dureeHeures: r.dureeHeures, type: r.type, categorie: r.categorie ?? null,
      commentaire: r.commentaire ?? null, heureDebut: r.heureDebut ?? null, heureFin: r.heureFin ?? null,
    });
    this.editing.set(true);
  }

  startDuplicate(r: any) {
    this.editMode.set('duplicate');
    this.editingId.set(null);
    this.editError.set('');
    this.editSeed.set({
      date: r.date, clientId: r.clientId ?? null, missionCode: r.missionCode ?? null,
      dureeHeures: r.dureeHeures, type: r.type, categorie: r.categorie ?? null,
      commentaire: r.commentaire ?? null, heureDebut: r.heureDebut ?? null, heureFin: r.heureFin ?? null,
    });
    this.editing.set(true);
  }

  closeEdit() {
    this.editing.set(false);
    this.editingId.set(null);
    this.editError.set('');
  }

  onSaveEdit(result: SaisieEditResult) {
    this.saving.set(true);
    this.editError.set('');
    const id = this.editingId();
    const obs = (this.editMode() === 'edit' && id !== null)
      ? this.svc.update(id, result)
      : this.svc.create(result);
    obs.pipe(takeUntil(this._d$)).subscribe({
      next: () => { this.saving.set(false); this.closeEdit(); this.load(); },
      error: (err) => {
        this.saving.set(false);
        this.editError.set(err?.error?.message || 'Erreur lors de l\'enregistrement — réessayez.');
      },
    });
  }

  supprimer(r: any) {
    if (!confirm(`Supprimer cette saisie du ${this.formatDate(r.date)} (${this.formatH(r.dureeHeures)}) ?`)) return;
    this.svc.delete(r.id).pipe(takeUntil(this._d$)).subscribe({
      next: () => this.allRows.update(rows => rows.filter(x => x.id !== r.id)),
    });
  }

  exportCsv() {
    exportRowsToCsv(this.filteredRows(), [
      { header: 'Date',          value: r => this.formatDate(r.date) },
      { header: 'Collaborateur', value: r => r.collaborateur ?? '' },
      { header: 'Client',        value: r => r.client ?? '' },
      { header: 'Mission',       value: r => r.missionCode ?? '' },
      { header: 'Heure début',   value: r => r.heureDebut ?? '' },
      { header: 'Heure fin',     value: r => r.heureFin ?? '' },
      { header: 'Durée (h)',     value: r => r.dureeHeures?.toFixed(2) ?? '0' },
      { header: 'Type',          value: r => r.type },
      { header: 'Commentaire',   value: r => r.commentaire ?? '' },
    ], 'temps-detail');
  }
}
