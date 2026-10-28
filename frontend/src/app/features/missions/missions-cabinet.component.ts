import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MissionsService } from '../../core/services/missions.service';
import { TenantService } from '../../core/services/tenant.service';
import { ToastService } from '../../core/services/toast.service';
import {
  CYCLES_MISSIONS, FiltresMissionsCabinet, MissionCabinet, STATUTS_MISSION, StatutMission, TableauMissionsCabinet,
  formatMontant, initialesPersonne, libelleStatut, nomCycle, nomPersonne,
} from '../../core/models/mission.model';
import { toLocalMonth } from '../../core/services/date.util';
import { MissionsExportService } from './missions.export';

/**
 * Vue globale cabinet — tableau de bord des missions (CDC §5) : missions de tous les dossiers
 * du portefeuille visible, KPI, filtres, exports. Statut modifiable en ligne pour l'ADMIN.
 */
@Component({
  selector: 'app-missions-cabinet',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatTooltipModule],
  template: `
<div class="page">
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon"><mat-icon>work_history</mat-icon></div>
      <div>
        <h1 class="pg-title">Missions</h1>
        <p class="pg-sub">Opportunités détectées pendant la révision et suivi commercial, sur tout le portefeuille</p>
      </div>
    </div>
    <div class="header-actions">
      <input type="month" class="fb-input fb-input--month" [(ngModel)]="moisRapport" aria-label="Mois du rapport" />
      <button class="btn-export btn-export--pdf" (click)="exportPdf()" [disabled]="!data()"><mat-icon>picture_as_pdf</mat-icon> Rapport mensuel</button>
      <button class="btn-export" (click)="exportExcel()" [disabled]="!lignes().length"><mat-icon>table_view</mat-icon> Excel</button>
    </div>
  </div>

  <div class="kpis">
    <div class="kpi"><div class="kpi__v">{{ data()?.kpi?.proposees?.nombre ?? 0 }}</div><div class="kpi__l">Missions proposées</div></div>
    <div class="kpi"><div class="kpi__v">{{ montant(data()?.kpi?.potentiel ?? 0) }}</div><div class="kpi__l">Potentiel total HT</div></div>
    <div class="kpi kpi--ok"><div class="kpi__v">{{ montant(data()?.kpi?.acceptees?.montant ?? 0) }}</div><div class="kpi__l">Signé HT</div></div>
    <div class="kpi"><div class="kpi__v">{{ data()?.kpi?.tauxConversion == null ? '—' : data()!.kpi.tauxConversion + ' %' }}</div>
      <div class="kpi__l" matTooltip="Acceptées / (Proposées + En discussion + Acceptées)">Taux de conversion</div></div>
    <button class="kpi kpi--rel" [class.kpi--on]="f.relance === 'RETARD'" (click)="f.relance = f.relance === 'RETARD' ? '' : 'RETARD'; load()">
      <div class="kpi__v">{{ data()?.kpi?.aRelancer ?? 0 }}</div><div class="kpi__l">À relancer</div>
    </button>
  </div>

  <div class="filters">
    <div class="fb-field fb-field--statuts">
      <span class="fb-label">Statut</span>
      <div class="chips">
        @for (s of statuts; track s.code) {
          <button type="button" class="chip badge-mission badge-mission--{{ s.code }}" [class.chip--off]="!statutActif(s.code)"
                  (click)="basculerStatut(s.code)" [attr.aria-pressed]="statutActif(s.code)">{{ s.libelle }}</button>
        }
      </div>
    </div>
    <div class="fb-field">
      <label class="fb-label" for="mc-resp">Responsable</label>
      <select id="mc-resp" class="fb-select" [(ngModel)]="f.responsableId" (ngModelChange)="load()">
        <option [ngValue]="null">Tous</option>
        @for (r of data()?.responsables ?? []; track r.id) { <option [ngValue]="r.id">{{ r.nom }}</option> }
      </select>
    </div>
    <div class="fb-field">
      <label class="fb-label" for="mc-cycle">Cycle d'origine</label>
      <select id="mc-cycle" class="fb-select" [(ngModel)]="f.cycle" (ngModelChange)="load()">
        <option value="">Tous</option>
        <option value="HORS_CYCLE">— Hors cycle</option>
        @for (c of cycles; track c.code) { <option [value]="c.code">{{ c.code }} · {{ c.nom }}</option> }
      </select>
    </div>
    <div class="fb-field">
      <label class="fb-label" for="mc-tranche">Montant estimé</label>
      <select id="mc-tranche" class="fb-select" [(ngModel)]="f.tranche" (ngModelChange)="load()">
        <option value="">Tous</option>
        <option value="MOINS_1000">&lt; 1 000 €</option>
        <option value="DE_1000_A_5000">1 000 – 5 000 €</option>
        <option value="PLUS_5000">&gt; 5 000 €</option>
      </select>
    </div>
    <div class="fb-field">
      <label class="fb-label" for="mc-relance">Date de relance</label>
      <select id="mc-relance" class="fb-select" [(ngModel)]="f.relance" (ngModelChange)="load()">
        <option value="">Toutes</option>
        <option value="SEMAINE">Cette semaine</option>
        <option value="MOIS">Ce mois-ci</option>
        <option value="RETARD">En retard</option>
      </select>
    </div>
    <div class="fb-field">
      <label class="fb-label" for="mc-secteur">Secteur d'activité</label>
      <select id="mc-secteur" class="fb-select" [(ngModel)]="f.secteur" (ngModelChange)="load()">
        <option value="">Tous</option>
        @for (s of data()?.secteurs ?? []; track s.code) { <option [value]="s.code">{{ s.label }}</option> }
      </select>
    </div>
    <div class="fb-field fb-field--grow">
      <label class="fb-label" for="mc-q">Recherche</label>
      <input id="mc-q" class="fb-input" [ngModel]="recherche()" (ngModelChange)="recherche.set($event)" placeholder="Dossier, mission…" />
    </div>
    <div class="fb-field fb-field--chk">
      <label class="chk"><input type="checkbox" [(ngModel)]="f.avecMontant" (ngModelChange)="load()" /> Avec montant</label>
      <label class="chk"><input type="checkbox" [(ngModel)]="f.inclureArchivees" (ngModelChange)="load()" /> Archivées</label>
    </div>
  </div>

  @if (loading() && !data()) {
    <div class="empty"><mat-icon class="spin">sync</mat-icon> Chargement…</div>
  } @else if (!lignes().length) {
    <div class="empty"><mat-icon>work_outline</mat-icon> Aucune mission pour ces critères.</div>
  } @else {
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Dossier client</th><th>Intitulé mission</th><th>Cycle d'origine</th><th>Statut</th>
            <th class="num">Montant estimé HT</th><th>Date de relance</th><th>Responsable</th><th>Secteur / activité</th>
          </tr>
        </thead>
        <tbody>
          @for (m of lignes(); track m.id) {
            <tr class="data-row" [class.data-row--refusee]="m.statut === 'REFUSEE'" [class.data-row--archivee]="m.archivee">
              <td><a class="lnk" [routerLink]="['/clients', m.client.id]" [queryParams]="{ tab: 'missions' }">{{ m.client.nom }}</a></td>
              <td>{{ m.titre }} @if (m.archivee) { <span class="tag">Archivée</span> }</td>
              <td>@if (m.cycle) { <span class="cyc">{{ m.cycle }}</span> {{ nomCycle(m.cycle) }} } @else { <span class="muted">Hors cycle</span> }</td>
              <td>
                @if (data()?.peutModifier && !m.archivee) {
                  <select class="sel badge-mission badge-mission--{{ m.statut }}" [ngModel]="m.statut" (ngModelChange)="changerStatut(m, $event)"
                          [attr.aria-label]="'Statut de ' + m.titre">
                    @for (s of statuts; track s.code) { <option [value]="s.code">{{ s.libelle }}</option> }
                  </select>
                } @else {
                  <span class="badge-mission badge-mission--{{ m.statut }}">{{ libelleStatut(m.statut) }}</span>
                }
              </td>
              <td class="num">{{ montant(m.honoraires) }}</td>
              <td>
                @if (m.dateRelance) {
                  <span [class.neg]="m.aRelancer">{{ m.dateRelance | date:'dd/MM/yyyy' }}</span>
                  @if (m.aRelancer) { <span class="badge-relance">À relancer</span> }
                } @else { <span class="muted">—</span> }
              </td>
              <td>
                @if (m.responsable) { <span class="av">{{ initiales(m) }}</span> {{ nomPersonne(m) }} }
                @else { <span class="muted">—</span> }
              </td>
              <td class="muted">{{ m.client.secteur || '—' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <div class="foot muted">{{ lignes().length }} mission(s){{ data()?.peutModifier ? '' : ' · lecture seule' }}</div>
  }
</div>
  `,
  styles: [`
    .page { padding-bottom:28px; }
    .pg-header { display:flex; align-items:center; justify-content:space-between; padding:24px 28px 0; gap:12px; flex-wrap:wrap; }
    .pg-header__left { display:flex; align-items:center; gap:14px; }
    .pg-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#6366f1,#4338ca); box-shadow:0 4px 14px rgba(79,70,229,.25); }
    .pg-icon mat-icon { color:#fff; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub { font-size:13px; color:#64748b; margin:2px 0 0; }
    .header-actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
    .btn-export { display:flex; align-items:center; gap:6px; padding:9px 16px; border-radius:9px; border:1.5px solid #bbf7d0; background:#fff; color:#15803d; font-size:13px; font-weight:600; cursor:pointer; }
    .btn-export--pdf { border-color:#fecaca; color:#b91c1c; }
    .btn-export mat-icon { font-size:16px; width:16px; height:16px; }
    .btn-export:disabled { opacity:.5; cursor:not-allowed; }
    .fb-input--month { min-width:0 !important; width:150px; }

    .kpis { display:flex; gap:12px; padding:14px 28px 0; flex-wrap:wrap; }
    .kpi { flex:1; min-width:150px; border-radius:12px; padding:13px 16px; background:#fff; border:1px solid #e2e8f0; color:#0f172a; text-align:left; font:inherit; }
    button.kpi { cursor:pointer; }
    .kpi__v { font-size:20px; font-weight:800; font-variant-numeric:tabular-nums; }
    .kpi__l { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; margin-top:3px; }
    .kpi--ok .kpi__v { color:#15803d; }
    .kpi--rel .kpi__v { color:#dc2626; }
    .kpi--on { box-shadow:0 0 0 2px #dc2626 inset; }

    .filters { display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; background:#fff; margin:14px 28px 0; padding:14px 20px; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,.06); border:1px solid #f1f5f9; }
    .fb-field { display:flex; flex-direction:column; gap:4px; }
    .fb-field--grow { flex:1; min-width:180px; }
    .fb-field--statuts { flex-basis:100%; }
    .fb-field--chk { flex-direction:row; gap:12px; padding-bottom:8px; }
    .fb-label { font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; }
    .fb-input, .fb-select { height:36px; border:1px solid #e2e8f0; border-radius:7px; padding:0 10px; font-size:13px; background:#fff; color:#374151; outline:none; font-family:inherit; min-width:130px; box-sizing:border-box; }
    .fb-select { max-width:220px; }
    .chips { display:flex; gap:6px; flex-wrap:wrap; }
    .chip { cursor:pointer; font:inherit; font-size:12px; font-weight:700; padding:4px 11px; }
    .chip--off { opacity:.35; filter:grayscale(.6); }
    .chk { display:flex; align-items:center; gap:5px; font-size:12.5px; color:#334155; cursor:pointer; white-space:nowrap; }

    .empty { display:flex; align-items:center; justify-content:center; gap:8px; padding:48px; color:#94a3b8; }
    .spin { animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .table-wrap { margin:14px 28px 0; overflow-x:auto; border-radius:10px; }
    .data-table { width:100%; border-collapse:collapse; font-size:12.5px; background:#fff; }
    .data-table thead { background:#1e293b; }
    .data-table th { color:#fff; font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; padding:10px; text-align:left; white-space:nowrap; }
    .data-table td { padding:8px 10px; border-bottom:1px solid #f1f5f9; color:#374151; vertical-align:middle; }
    .data-row:hover { background:#f8fafc; }
    .data-row--refusee td { opacity:.55; }
    .data-row--archivee td { color:#94a3b8; background:#fafafa; }
    .num { text-align:right !important; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .muted { color:#94a3b8; }
    .neg { color:#dc2626; font-weight:700; margin-right:6px; }
    .lnk { color:#1d4ed8; font-weight:600; text-decoration:none; }
    .lnk:hover { text-decoration:underline; }
    .tag { margin-left:6px; font-size:10.5px; padding:1px 7px; border-radius:10px; background:#f1f5f9; color:#64748b; }
    .cyc { display:inline-block; font-size:10.5px; font-weight:800; padding:1px 6px; border-radius:5px; background:#eef2ff; color:#4338ca; margin-right:4px; }
    .sel { cursor:pointer; font:inherit; font-size:11.5px; font-weight:700; padding:2px 6px; border-radius:12px; }
    .av { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:50%; background:#e0e7ff; color:#3730a3; font-size:10px; font-weight:800; margin-right:4px; }
    .foot { margin:8px 28px 0; font-size:12px; }
  `],
})
export class MissionsCabinetComponent implements OnInit {
  private svc = inject(MissionsService);
  private tenant = inject(TenantService);
  private toast = inject(ToastService);
  private exports = inject(MissionsExportService);

  get statuts() { return STATUTS_MISSION; }
  get cycles() { return CYCLES_MISSIONS; }

  readonly data = signal<TableauMissionsCabinet | null>(null);
  readonly loading = signal(true);
  readonly recherche = signal('');
  /** Filtres serveur ; aucun statut coché = tous. */
  f: Required<Pick<FiltresMissionsCabinet, 'cycle' | 'tranche' | 'relance' | 'secteur'>> & FiltresMissionsCabinet = {
    statuts: [], responsableId: null, cycle: '', tranche: '', relance: '', secteur: '', avecMontant: false, inclureArchivees: false,
  };
  moisRapport = toLocalMonth(new Date());

  readonly lignes = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const l = this.data()?.missions ?? [];
    return q ? l.filter(m => m.client.nom.toLowerCase().includes(q) || m.titre.toLowerCase().includes(q)) : l;
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.tableauCabinet(this.f).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Chargement des missions impossible'); },
    });
  }

  statutActif(s: StatutMission) { return !this.f.statuts?.length || this.f.statuts.includes(s); }
  basculerStatut(s: StatutMission) {
    const actifs = this.f.statuts?.length ? [...this.f.statuts] : [];
    const i = actifs.indexOf(s);
    if (!actifs.length) this.f.statuts = [s];                 // premier clic : ce statut seul
    else if (i >= 0) this.f.statuts = actifs.filter(x => x !== s);
    else this.f.statuts = [...actifs, s];
    if (this.f.statuts.length === STATUTS_MISSION.length) this.f.statuts = [];
    this.load();
  }

  changerStatut(m: MissionCabinet, statut: StatutMission) {
    if (statut === m.statut) return;
    this.svc.update(m.client.id, m.id, { statut }).subscribe({
      next: () => { this.toast.success('Statut mis à jour'); this.load(); },
      error: (e) => { this.toast.error(e?.error?.message || 'Modification refusée'); this.load(); },
    });
  }

  montant(v: number | null | undefined) { return formatMontant(v); }
  libelleStatut(s: string) { return libelleStatut(s); }
  nomCycle(c: string | null) { return nomCycle(c); }
  initiales(m: MissionCabinet) { return initialesPersonne(m.responsable); }
  nomPersonne(m: MissionCabinet) { return nomPersonne(m.responsable); }

  private libellesFiltres(): string[] {
    const d = this.data();
    const out: string[] = [];
    if (this.f.statuts?.length) out.push(this.f.statuts.map(libelleStatut).join(', '));
    if (this.f.responsableId) out.push(d?.responsables.find(r => r.id === this.f.responsableId)?.nom ?? '');
    if (this.f.cycle) out.push(this.f.cycle === 'HORS_CYCLE' ? 'Hors cycle' : nomCycle(this.f.cycle));
    if (this.f.tranche) out.push({ MOINS_1000: '< 1 000 €', DE_1000_A_5000: '1 000 – 5 000 €', PLUS_5000: '> 5 000 €' }[this.f.tranche]);
    if (this.f.relance) out.push({ SEMAINE: 'relance cette semaine', MOIS: 'relance ce mois-ci', RETARD: 'relance en retard' }[this.f.relance]);
    if (this.f.secteur) out.push(d?.secteurs.find(s => s.code === this.f.secteur)?.label ?? this.f.secteur);
    if (this.f.avecMontant) out.push('avec montant');
    if (this.recherche().trim()) out.push(`« ${this.recherche().trim()} »`);
    return out.filter(Boolean);
  }

  exportExcel() {
    this.exports.excel(this.lignes(), `missions-${this.moisRapport}.xlsx`);
  }

  exportPdf() {
    const d = this.data();
    if (!d) return;
    this.exports.rapportMensuel(this.lignes(), d.kpi, {
      cabinet: this.tenant.nomSociete?.() || 'Cabinet',
      mois: this.moisRapport || toLocalMonth(new Date()),
      filtres: this.libellesFiltres(),
    });
  }
}
