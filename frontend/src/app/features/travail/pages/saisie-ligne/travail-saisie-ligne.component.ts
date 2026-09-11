import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil } from 'rxjs';
import {
  SaisieTempsService, SaisieTemps, CreateSaisieTempsDto,
  TypeTemps, CategorieNonFacturable, MissionCode, MISSION_CODES,
} from '../../../../core/services/saisie-temps.service';
import { ClientsService } from '../../../../core/services/clients.service';
import { Client } from '../../../../core/models/client.model';

const CATEGORIES_NF: { code: CategorieNonFacturable; label: string }[] = [
  { code: 'APPEL_CLIENT',     label: 'Appel client' },
  { code: 'REUNION_INTERNE',  label: 'Réunion interne' },
  { code: 'FORMATION',        label: 'Formation' },
  { code: 'ADMINISTRATIF',    label: 'Administratif' },
  { code: 'AUTRE',            label: 'Autre' },
];

/** Accepte "1h30", "1:30", "1.5" ou "1,5" → durée en heures décimales. */
function parseDuree(input: string): number | null {
  const s = input.trim().toLowerCase().replace(',', '.');
  if (!s) return null;
  const hMatch = s.match(/^(\d+)\s*h\s*(\d{0,2})$/);
  if (hMatch) {
    const h = parseInt(hMatch[1], 10);
    const m = hMatch[2] ? parseInt(hMatch[2], 10) : 0;
    return h + m / 60;
  }
  const hmMatch = s.match(/^(\d+):(\d{2})$/);
  if (hmMatch) {
    return parseInt(hmMatch[1], 10) + parseInt(hmMatch[2], 10) / 60;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

@Component({
  selector: 'app-travail-saisie-ligne',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
<div class="page">

  <!-- ── Header ── -->
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon"><mat-icon>playlist_add</mat-icon></div>
      <div>
        <h1 class="pg-title">Saisie rapide</h1>
        <p class="pg-sub">Client → mission → durée → commentaire, en une ligne</p>
      </div>
    </div>
  </div>

  <!-- ── Formulaire ── -->
  <form class="line-form" (ngSubmit)="submit()">
    <div class="lf-row">
      <div class="lf-field lf-field--date">
        <label class="lf-label">Date</label>
        <input type="date" class="lf-input" [(ngModel)]="date" name="date" required />
      </div>
      <div class="lf-field lf-field--grow">
        <label class="lf-label">Client</label>
        <select class="lf-input" [(ngModel)]="clientId" name="clientId">
          <option [ngValue]="null">— Client (optionnel) —</option>
          @for (c of clients; track c.id) {
            <option [ngValue]="c.id">{{ c.nom }}</option>
          }
        </select>
      </div>
      <div class="lf-field lf-field--grow">
        <label class="lf-label">Mission</label>
        <select class="lf-input" [(ngModel)]="missionCode" name="missionCode">
          <option [ngValue]="null">— Mission (optionnel) —</option>
          @for (m of missionCodes; track m.code) {
            <option [ngValue]="m.code">{{ m.label }}</option>
          }
        </select>
      </div>
      <div class="lf-field lf-field--duree">
        <label class="lf-label">Durée</label>
        <input class="lf-input" [(ngModel)]="dureeInput" name="duree"
               placeholder="1h30" required (blur)="validerDuree()" />
      </div>
    </div>

    <div class="lf-row">
      <div class="lf-field lf-field--type">
        <label class="lf-label">Type</label>
        <div class="lf-type">
          <button type="button" class="lf-type__btn" [class.lf-type__btn--on]="type === 'FACTURABLE'"
                  (click)="type = 'FACTURABLE'">Facturable</button>
          <button type="button" class="lf-type__btn" [class.lf-type__btn--on]="type === 'NON_FACTURABLE'"
                  (click)="type = 'NON_FACTURABLE'">Non fact.</button>
        </div>
      </div>
      @if (type === 'NON_FACTURABLE') {
        <div class="lf-field lf-field--grow">
          <label class="lf-label">Catégorie</label>
          <select class="lf-input" [(ngModel)]="categorie" name="categorie">
            @for (c of categoriesNF; track c.code) {
              <option [ngValue]="c.code">{{ c.label }}</option>
            }
          </select>
        </div>
      }
      <div class="lf-field lf-field--grow2">
        <label class="lf-label">Commentaire</label>
        <input class="lf-input" [(ngModel)]="commentaire" name="commentaire"
               placeholder="Description de l'activité…" />
      </div>
      <button type="submit" class="lf-submit" [disabled]="saving()">
        <mat-icon>{{ saving() ? 'hourglass_empty' : 'add' }}</mat-icon>
        {{ saving() ? 'Enregistrement…' : 'Ajouter la ligne' }}
      </button>
    </div>

    @if (error()) { <p class="lf-error">{{ error() }}</p> }
  </form>

  <!-- ── Dernières saisies ── -->
  <div class="table-toolbar">
    <span class="tb-title">Mes dernières saisies</span>
    <button class="tb-btn" (click)="load()">
      <mat-icon style="font-size:14px;width:14px;height:14px;">refresh</mat-icon> Recharger
    </button>
  </div>

  <div class="table-wrap">
    @if (loading()) {
      <div class="empty-state"><mat-icon>hourglass_empty</mat-icon><p>Chargement…</p></div>
    } @else if (rows().length === 0) {
      <div class="empty-state"><mat-icon>timer_off</mat-icon><p>Aucune saisie récente</p></div>
    } @else {
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th><th>Client</th><th>Mission</th><th class="th-num">Heures</th>
            <th>Facturable</th><th>Commentaire</th><th></th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows(); track r.id) {
            <tr class="data-row">
              <td class="td-date">{{ formatDate(r.date) }}</td>
              <td class="td-client">{{ r.client?.nom ?? '—' }}</td>
              <td>{{ r.missionCode ?? '—' }}</td>
              <td class="td-heures">{{ formatH(r.dureeHeures) }}</td>
              <td>
                @if (r.type === 'FACTURABLE') {
                  <span class="badge-fact">✓ Oui</span>
                } @else {
                  <span class="badge-nf">✗ Non</span>
                }
              </td>
              <td class="td-comment">{{ r.commentaire ?? '—' }}</td>
              <td class="td-actions">
                @if (!r.isLocked) {
                  <button class="td-del" (click)="supprimer(r)" title="Supprimer">
                    <mat-icon style="font-size:16px;width:16px;height:16px;">delete_outline</mat-icon>
                  </button>
                } @else {
                  <mat-icon style="font-size:16px;width:16px;height:16px;color:#94a3b8;" title="Verrouillée">lock</mat-icon>
                }
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

    .pg-header { display:flex; align-items:center; justify-content:space-between; padding:24px 28px 0; flex-shrink:0; }
    .pg-header__left { display:flex; align-items:center; gap:14px; }
    .pg-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:linear-gradient(135deg,#6366f1,#4f46e5); box-shadow:0 4px 14px rgba(99,102,241,.35); }
    .pg-icon mat-icon { color:#fff; font-size:22px; width:22px; height:22px; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub { font-size:13px; color:#64748b; margin:2px 0 0; }

    .line-form { display:flex; flex-direction:column; gap:12px; padding:18px 28px; margin:16px 28px 0; background:#fff; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,.06); border:1px solid #f1f5f9; flex-shrink:0; }
    .lf-row { display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; }
    .lf-field { display:flex; flex-direction:column; gap:4px; }
    .lf-field--grow  { flex:1; min-width:160px; }
    .lf-field--grow2 { flex:2; min-width:220px; }
    .lf-field--date  { min-width:150px; }
    .lf-field--duree { min-width:110px; }
    .lf-label { font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; }
    .lf-input { height:36px; border:1px solid #e2e8f0; border-radius:7px; padding:0 10px; font-size:13px; background:#fff; color:#374151; outline:none; font-family:inherit; width:100%; box-sizing:border-box; }
    .lf-input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.12); }

    .lf-type { display:flex; gap:4px; background:#f1f5f9; border-radius:7px; padding:3px; }
    .lf-type__btn { height:30px; border:none; background:transparent; border-radius:5px; padding:0 12px; font-size:12.5px; font-weight:600; color:#64748b; cursor:pointer; transition:all .15s; }
    .lf-type__btn--on { background:#6366f1; color:#fff; }

    .lf-submit { height:36px; background:#059669; color:#fff; border:none; border-radius:7px; padding:0 18px; font-size:13px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px; white-space:nowrap; transition:background .15s; }
    .lf-submit:hover:not(:disabled) { background:#047857; }
    .lf-submit:disabled { opacity:.6; cursor:not-allowed; }
    .lf-submit mat-icon { font-size:18px; width:18px; height:18px; }
    .lf-error { color:#dc2626; font-size:12.5px; margin:0; }

    .table-toolbar { display:flex; align-items:center; gap:8px; padding:20px 28px 10px; flex-shrink:0; }
    .tb-title { font-size:13px; font-weight:700; color:#334155; }
    .tb-btn { height:32px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:0 12px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:5px; color:#374151; transition:all .15s; margin-left:auto; }
    .tb-btn:hover { background:#e0e7ff; border-color:#c7d2fe; color:#4f46e5; }

    .table-wrap { flex:1; overflow:auto; padding:0 28px 28px; }
    .data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table thead { background:#1e293b; }
    .data-table th { color:#fff; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:11px 14px; text-align:left; white-space:nowrap; }
    .th-num { text-align:right; }
    .data-table tbody tr:nth-child(even) { background:#f8fafc; }
    .data-table tbody tr:hover { background:#eef2ff; }
    .data-table td { padding:10px 14px; color:#374151; border-bottom:1px solid #f1f5f9; vertical-align:middle; }

    .td-date   { white-space:nowrap; font-variant-numeric:tabular-nums; }
    .td-client { color:#475569; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .td-heures { font-family:monospace; font-weight:700; color:#7c3aed; text-align:right; font-size:13px; }
    .td-comment { color:#64748b; font-size:11.5px; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .td-actions { text-align:right; }
    .td-del { background:none; border:none; cursor:pointer; color:#94a3b8; padding:4px; border-radius:5px; display:inline-flex; transition:all .15s; }
    .td-del:hover { color:#dc2626; background:#fee2e2; }

    .badge-fact { font-size:11px; font-weight:700; padding:3px 9px; border-radius:20px; background:#dcfce7; color:#15803d; }
    .badge-nf   { font-size:11px; font-weight:700; padding:3px 9px; border-radius:20px; background:#fee2e2; color:#dc2626; }

    .empty-state { display:flex; flex-direction:column; align-items:center; padding:60px 28px; color:#94a3b8; gap:12px; }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; opacity:.3; display:block; }
    .empty-state p { font-size:14px; margin:0; }
  `],
})
export class TravailSaisieLigneComponent implements OnInit, OnDestroy {
  private svc        = inject(SaisieTempsService);
  private clientsSvc = inject(ClientsService);
  private _d$        = new Subject<void>();

  readonly missionCodes  = MISSION_CODES;
  readonly categoriesNF  = CATEGORIES_NF;

  loading = signal(true);
  saving  = signal(false);
  error   = signal('');
  rows    = signal<SaisieTemps[]>([]);
  clients: Client[] = [];

  date        = new Date().toISOString().split('T')[0];
  clientId: number | null = null;
  missionCode: MissionCode | null = null;
  dureeInput  = '';
  type: TypeTemps = 'FACTURABLE';
  categorie: CategorieNonFacturable = 'AUTRE';
  commentaire = '';

  ngOnInit() {
    this.clientsSvc.getAll().pipe(takeUntil(this._d$)).subscribe(c => this.clients = c);
    this.load();
  }

  ngOnDestroy() { this._d$.next(); this._d$.complete(); }

  load() {
    this.loading.set(true);
    this.svc.getMes().pipe(takeUntil(this._d$)).subscribe({
      next:  data => { this.rows.set(data.slice(0, 30)); this.loading.set(false); },
      error: ()   => { this.rows.set([]); this.loading.set(false); },
    });
  }

  validerDuree() {
    if (parseDuree(this.dureeInput) === null) {
      this.error.set('Durée invalide — utilisez un format comme "1h30" ou "1.5"');
    } else {
      this.error.set('');
    }
  }

  submit() {
    const duree = parseDuree(this.dureeInput);
    if (!this.date || duree === null) {
      this.error.set('Durée invalide — utilisez un format comme "1h30" ou "1.5"');
      return;
    }
    const dto: CreateSaisieTempsDto = {
      date:        this.date,
      dureeHeures: Math.round(duree * 100) / 100,
      type:        this.type,
      categorie:   this.type === 'NON_FACTURABLE' ? this.categorie : undefined,
      missionCode: this.missionCode ?? undefined,
      clientId:    this.clientId ?? undefined,
      commentaire: this.commentaire || undefined,
    };
    this.saving.set(true);
    this.error.set('');
    this.svc.create(dto).pipe(takeUntil(this._d$)).subscribe({
      next: () => {
        this.saving.set(false);
        this.dureeInput = '';
        this.commentaire = '';
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Erreur lors de l\'enregistrement — réessayez.');
      },
    });
  }

  supprimer(r: SaisieTemps) {
    this.svc.delete(r.id).pipe(takeUntil(this._d$)).subscribe({
      next: () => this.rows.update(rows => rows.filter(x => x.id !== r.id)),
    });
  }

  formatH(h: number): string {
    if (!h || h <= 0) return '0h00';
    const hrs = Math.floor(h);
    const min = Math.round((h - hrs) * 60);
    return `${hrs}h${String(min).padStart(2, '0')}`;
  }

  formatDate(d: string): string {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }
}
