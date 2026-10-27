import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as XLSX from 'xlsx';
import {
  IndicateurPieces, LIBELLES_INDICATEUR, LigneSuiviPieces, PieceManquante, SuiviPiecesService, TableauSuiviPieces,
} from '../../core/services/suivi-pieces.service';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';
import { ToastService } from '../../core/services/toast.service';
import { approcheClient } from '../../core/models/client.model';
import { RelanceClientComponent } from './relance-client.component';

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/**
 * Pièces manquantes (cahier v2 #1) : complétude des documents attendus par dossier et par
 * période, indicateur rouge / orange / vert, relance du contact opérationnel du client.
 * Source : la grille des documents mensuels de chaque dossier ; la synchronisation TIIME
 * l'alimentera automatiquement une fois l'accès partenaire à leur API obtenu.
 */
@Component({
  selector: 'app-suivi-pieces',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatTooltipModule, RelanceClientComponent],
  template: `
<div class="page">
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon"><mat-icon>assignment_late</mat-icon></div>
      <div>
        <h1 class="pg-title">Pièces manquantes</h1>
        <p class="pg-sub">Documents attendus par dossier et relances clients — {{ annee }} · relance au-delà de {{ data()?.delaiJours ?? 15 }} jours</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn-export" (click)="exportExcel()" [disabled]="!lignesVue().length"><mat-icon>table_view</mat-icon> Excel</button>
    </div>
  </div>

  <!-- Source des données + paramètres (ADMIN) -->
  <div class="source">
    <mat-icon>hub</mat-icon>
    <div class="source__txt">
      <strong>Source : grille des documents mensuels de chaque dossier.</strong>
      <span>Connexion TIIME : en attente de l'accès partenaire à l'API TIIME — une fois obtenu, les pièces non intégrées
        côté TIIME alimenteront automatiquement ce tableau.</span>
    </div>
    @if (auth.isAdmin()) {
      <div class="reglages">
        <label class="fb-label" for="sp-delai">Délai avant relance</label>
        <div class="reglages__row">
          <input id="sp-delai" type="number" min="1" max="120" class="fb-input fb-input--num" [(ngModel)]="delai" /> jours
          <label class="chk" matTooltip="Chaque jour ouvré à 8 h : e-mail au contact opérationnel des dossiers au rouge, au plus une fois par délai">
            <input type="checkbox" [(ngModel)]="relanceAuto" /> Relance automatique par e-mail
          </label>
          <button class="btn-mini" (click)="enregistrerReglages()" [disabled]="savingReglages()">Enregistrer</button>
        </div>
      </div>
    }
  </div>

  <div class="kpis">
    <button class="kpi kpi--ROUGE" [class.kpi--on]="filtre() === 'ROUGE'" (click)="basculer('ROUGE')">
      <div class="kpi__v">{{ data()?.totaux?.rouge ?? 0 }}</div><div class="kpi__l">À relancer</div>
    </button>
    <button class="kpi kpi--ORANGE" [class.kpi--on]="filtre() === 'ORANGE'" (click)="basculer('ORANGE')">
      <div class="kpi__v">{{ data()?.totaux?.orange ?? 0 }}</div><div class="kpi__l">En attente (dans le délai)</div>
    </button>
    <button class="kpi kpi--VERT" [class.kpi--on]="filtre() === 'VERT'" (click)="basculer('VERT')">
      <div class="kpi__v">{{ data()?.totaux?.vert ?? 0 }}</div><div class="kpi__l">Complets</div>
    </button>
    <button class="kpi kpi--NON_SUIVI" [class.kpi--on]="filtre() === 'NON_SUIVI'" (click)="basculer('NON_SUIVI')">
      <div class="kpi__v">{{ data()?.totaux?.nonSuivi ?? 0 }}</div><div class="kpi__l">Non suivis</div>
    </button>
    <div class="kpi kpi--total">
      <div class="kpi__v">{{ data()?.totaux?.piecesManquantes ?? 0 }}</div><div class="kpi__l">Pièces manquantes</div>
    </div>
  </div>

  <div class="filters">
    <div class="fb-field">
      <label class="fb-label" for="sp-annee">Année</label>
      <select id="sp-annee" class="fb-select" [(ngModel)]="annee" (ngModelChange)="load()">
        @for (a of annees; track a) { <option [ngValue]="a">{{ a }}</option> }
      </select>
    </div>
    <div class="fb-field fb-field--grow">
      <label class="fb-label" for="sp-q">Recherche</label>
      <input id="sp-q" class="fb-input" [ngModel]="recherche()" (ngModelChange)="recherche.set($event)" placeholder="Dossier, intervenant, contact…" />
    </div>
  </div>

  @if (loading()) {
    <div class="empty"><mat-icon class="spin">sync</mat-icon> Chargement…</div>
  } @else if (!lignesVue().length) {
    <div class="empty"><mat-icon>task_alt</mat-icon> Aucun dossier pour ces critères.</div>
  } @else {
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>État</th><th>Dossier</th><th class="th-bar">Complétude</th><th>Pièces manquantes</th>
            <th class="num">Retard</th><th>Contact opérationnel</th><th>Relancé le</th><th></th>
          </tr>
        </thead>
        <tbody>
          @for (l of lignesVue(); track l.clientId) {
            <tr class="data-row data-row--{{ l.indicateur }}">
              <td><span class="ind ind--{{ l.indicateur }}"><span class="ind__dot"></span>{{ libelleIndicateur(l.indicateur) }}</span></td>
              <td>
                <a class="lnk" [routerLink]="['/clients', l.clientId]">{{ l.client }}</a>
                <div class="muted small">{{ l.intervenants.responsable || l.intervenants.directeur || 'Non assigné' }}</div>
              </td>
              <td class="td-bar">
                @if (l.indicateur !== 'NON_SUIVI') {
                  <div class="bar"><div class="bar__fill bar__fill--{{ l.indicateur }}" [style.width.%]="l.taux"></div></div>
                  <span class="mono">{{ l.deposes }}/{{ l.attendus }}</span>
                } @else {
                  <span class="muted small">Aucun document paramétré</span>
                }
              </td>
              <td class="td-pieces">
                @for (p of l.manquantes.slice(0, 4); track p.type + p.mois) {
                  <span class="piece" [class.piece--late]="p.joursRetard > (data()?.delaiJours ?? 15)"
                        [matTooltip]="p.libelle + ' — ' + libelleMoisLong(p) + ' — attendu depuis ' + p.joursRetard + ' j'">
                    {{ p.libelle }} · {{ libelleMois(p) }}
                  </span>
                }
                @if (l.manquantes.length > 4) { <span class="piece piece--more">+{{ l.manquantes.length - 4 }}</span> }
                @if (!l.manquantes.length && l.indicateur !== 'NON_SUIVI') { <span class="muted small">—</span> }
              </td>
              <td class="num mono" [class.neg]="l.horsDelai > 0">{{ l.manquantes.length ? l.plusAncienRetard + ' j' : '—' }}</td>
              <td class="td-contact">
                @if (l.contactOperationnel.nom || l.contactOperationnel.email) {
                  <div>{{ l.contactOperationnel.nom || l.contactOperationnel.email }}</div>
                  <div class="muted small">{{ l.contactOperationnel.telephone || l.contactOperationnel.email }}</div>
                } @else if (l.destinataire) {
                  <div class="muted">Contact légal : {{ l.destinataire.email }}</div>
                } @else {
                  <span class="warn small" matTooltip="Renseignez le contact opérationnel dans la fiche d'identité">Aucun contact</span>
                }
                <span class="badge-approche badge-approche--{{ l.approche }} appr" [matTooltip]="approche(l).description">{{ approche(l).libelle }}</span>
              </td>
              <td class="muted">{{ l.derniereRelance ? (l.derniereRelance | date:'dd/MM/yyyy') : '—' }}</td>
              <td>
                <button class="btn-relance" (click)="relancer(l)" [disabled]="!l.manquantes.length || !l.destinataire"
                        [matTooltip]="!l.manquantes.length ? 'Rien à relancer' : !l.destinataire ? 'Aucune adresse e-mail de contact' : 'Relancer ' + (l.destinataire.nom || l.destinataire.email)">
                  <mat-icon>forward_to_inbox</mat-icon> Relancer
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }

  @if (relanceClientId(); as id) {
    <app-relance-client [clientId]="id" [annee]="annee" (fermer)="relanceClientId.set(null)" (envoyee)="load()" />
  }
</div>
  `,
  styles: [`
    .page { padding-bottom:28px; }
    .pg-header { display:flex; align-items:center; justify-content:space-between; padding:24px 28px 0; gap:12px; flex-wrap:wrap; }
    .pg-header__left { display:flex; align-items:center; gap:14px; }
    .pg-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#dc2626,#b91c1c); box-shadow:0 4px 14px rgba(220,38,38,.25); }
    .pg-icon mat-icon { color:#fff; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub { font-size:13px; color:#64748b; margin:2px 0 0; }
    .header-actions { display:flex; gap:10px; }
    .btn-export { display:flex; align-items:center; gap:6px; padding:9px 16px; border-radius:9px; border:1.5px solid #bbf7d0; background:#fff; color:#15803d; font-size:13px; font-weight:600; cursor:pointer; }
    .btn-export mat-icon { font-size:16px; width:16px; height:16px; }
    .btn-export:disabled { opacity:.5; cursor:not-allowed; }

    .source { display:flex; align-items:flex-start; gap:12px; margin:16px 28px 0; padding:12px 16px; border-radius:12px; background:#eff6ff; border:1px solid #bfdbfe; flex-wrap:wrap; }
    .source > mat-icon { color:#1d4ed8; }
    .source__txt { display:flex; flex-direction:column; gap:2px; font-size:12.5px; color:#1e3a8a; flex:1; min-width:260px; }
    .source__txt span { color:#475569; }
    .reglages { display:flex; flex-direction:column; gap:4px; }
    .reglages__row { display:flex; align-items:center; gap:10px; font-size:12.5px; color:#334155; flex-wrap:wrap; }
    .fb-input--num { width:70px; min-width:0 !important; }
    .chk { display:flex; align-items:center; gap:6px; font-size:12.5px; color:#334155; cursor:pointer; }
    .btn-mini { height:30px; padding:0 12px; border-radius:7px; border:none; background:#1d4ed8; color:#fff; font-weight:600; font-size:12px; cursor:pointer; }
    .btn-mini:disabled { opacity:.6; }

    .kpis { display:flex; gap:12px; padding:14px 28px 0; flex-wrap:wrap; }
    .kpi { flex:1; min-width:140px; border-radius:12px; padding:13px 16px; background:#fff; border:1px solid #e2e8f0; color:#0f172a; text-align:left; font:inherit; cursor:pointer; }
    .kpi--total { cursor:default; }
    .kpi__v { font-size:20px; font-weight:800; font-variant-numeric:tabular-nums; }
    .kpi__l { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; margin-top:3px; }
    .kpi--ROUGE .kpi__v { color:#dc2626; }
    .kpi--ORANGE .kpi__v { color:#d97706; }
    .kpi--VERT .kpi__v { color:#16a34a; }
    .kpi--NON_SUIVI .kpi__v { color:#64748b; }
    .kpi--on { box-shadow:0 0 0 2px #0f172a inset; }

    .filters { display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; background:#fff; margin:14px 28px 0; padding:14px 20px; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,.06); border:1px solid #f1f5f9; }
    .fb-field { display:flex; flex-direction:column; gap:4px; }
    .fb-field--grow { flex:1; min-width:200px; }
    .fb-label { font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; }
    .fb-input, .fb-select { height:36px; border:1px solid #e2e8f0; border-radius:7px; padding:0 10px; font-size:13px; background:#fff; color:#374151; outline:none; font-family:inherit; min-width:130px; box-sizing:border-box; }

    .empty { display:flex; align-items:center; justify-content:center; gap:8px; padding:48px; color:#94a3b8; }
    .spin { animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .table-wrap { margin:14px 28px 0; overflow-x:auto; border-radius:10px; }
    .data-table { width:100%; border-collapse:collapse; font-size:12.5px; background:#fff; }
    .data-table thead { background:#1e293b; }
    .data-table th { color:#fff; font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; padding:10px; text-align:left; white-space:nowrap; }
    .data-table td { padding:8px 10px; border-bottom:1px solid #f1f5f9; color:#374151; vertical-align:top; }
    .data-row:hover { background:#f8fafc; }
    .data-row--ROUGE { background:#fffafa; }
    .num { text-align:right !important; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .mono { font-family:monospace; }
    .muted { color:#64748b; }
    .small { font-size:11.5px; }
    .neg { color:#dc2626; font-weight:700; }
    .warn { color:#b45309; font-weight:600; }
    .lnk { color:#1d4ed8; font-weight:600; text-decoration:none; }
    .lnk:hover { text-decoration:underline; }
    .ind { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700; padding:3px 9px; border-radius:12px; white-space:nowrap; }
    .ind__dot { width:8px; height:8px; border-radius:50%; background:currentColor; }
    .ind--ROUGE { background:#fee2e2; color:#b91c1c; }
    .ind--ORANGE { background:#ffedd5; color:#c2410c; }
    .ind--VERT { background:#dcfce7; color:#15803d; }
    .ind--NON_SUIVI { background:#f1f5f9; color:#64748b; }
    .th-bar { min-width:96px; }
    .td-bar { white-space:nowrap; }
    .td-bar .bar { display:inline-block; vertical-align:middle; width:52px; height:7px; background:#e2e8f0; border-radius:4px; overflow:hidden; margin-right:6px; }
    .bar__fill { height:100%; border-radius:4px; }
    .bar__fill--ROUGE { background:#dc2626; }
    .bar__fill--ORANGE { background:#f59e0b; }
    .bar__fill--VERT { background:#16a34a; }
    .td-pieces { min-width:220px; max-width:340px; }
    .piece { display:inline-block; font-size:11px; padding:2px 7px; border-radius:6px; background:#fff7ed; color:#9a3412; border:1px solid #fed7aa; margin:0 4px 4px 0; white-space:nowrap; }
    .piece--late { background:#fef2f2; color:#b91c1c; border-color:#fecaca; }
    .piece--more { background:#f1f5f9; color:#475569; border-color:#e2e8f0; }
    .td-contact { min-width:150px; }
    .appr { margin-top:4px; font-size:10.5px; padding:1px 8px; }
    .btn-relance { display:flex; align-items:center; gap:5px; height:30px; padding:0 12px; border-radius:7px; border:1px solid #c7d2fe; background:#eef2ff; color:#3730a3; font-weight:700; font-size:12px; cursor:pointer; white-space:nowrap; }
    .btn-relance mat-icon { font-size:16px; width:16px; height:16px; }
    .btn-relance:disabled { opacity:.45; cursor:not-allowed; }
  `],
})
export class SuiviPiecesComponent implements OnInit {
  private svc = inject(SuiviPiecesService);
  auth = inject(AuthService);
  private tenantSvc = inject(TenantService);
  private toast = inject(ToastService);

  readonly annees = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);
  annee = new Date().getFullYear();
  readonly data = signal<TableauSuiviPieces | null>(null);
  readonly loading = signal(true);
  readonly filtre = signal<IndicateurPieces | ''>('');
  readonly recherche = signal('');
  readonly relanceClientId = signal<number | null>(null);
  readonly savingReglages = signal(false);
  delai = 15;
  relanceAuto = false;

  readonly lignesVue = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const f = this.filtre();
    return (this.data()?.lignes ?? []).filter(l => (!f || l.indicateur === f) && (!q || [
      l.client, l.intervenants.directeur, l.intervenants.responsable, l.intervenants.collaborateurOuest,
      l.contactOperationnel.nom, l.contactOperationnel.email, l.destinataire?.email,
    ].some(t => t?.toLowerCase().includes(q))));
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.svc.tableau(this.annee).subscribe({
      next: d => {
        this.data.set(d);
        this.delai = d.delaiJours;
        this.relanceAuto = d.relanceAutoActive;
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.toast.error('Chargement des pièces manquantes impossible'); },
    });
  }

  basculer(i: IndicateurPieces) { this.filtre.set(this.filtre() === i ? '' : i); }
  relancer(l: LigneSuiviPieces) { this.relanceClientId.set(l.clientId); }
  libelleIndicateur(i: IndicateurPieces) { return LIBELLES_INDICATEUR[i]; }
  approche(l: LigneSuiviPieces) { return approcheClient(l.approche); }
  libelleMois(p: PieceManquante) { return `${MOIS_COURTS[p.mois - 1]} ${String(p.annee).slice(2)}`; }
  libelleMoisLong(p: PieceManquante) {
    return new Date(p.annee, p.mois - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  enregistrerReglages() {
    const delai = Math.round(Number(this.delai));
    if (!delai || delai < 1 || delai > 120) { this.toast.error('Délai invalide (1 à 120 jours)'); return; }
    if (this.relanceAuto && !this.data()?.relanceAutoActive
        && !confirm('Activer la relance automatique ? Chaque jour ouvré, un e-mail sera envoyé au contact opérationnel des dossiers au rouge.')) {
      return;
    }
    this.savingReglages.set(true);
    this.tenantSvc.updateConfig({ relanceDelaiJours: delai, relanceAutoActive: this.relanceAuto }).subscribe({
      next: () => { this.savingReglages.set(false); this.toast.success('Réglages des relances enregistrés'); this.load(); },
      error: () => { this.savingReglages.set(false); this.toast.error("Erreur lors de l'enregistrement"); },
    });
  }

  exportExcel() {
    const lignes = this.lignesVue().map(l => ({
      'État': LIBELLES_INDICATEUR[l.indicateur],
      'Dossier': l.client,
      'Responsable': l.intervenants.responsable ?? l.intervenants.directeur ?? '',
      'Documents reçus': l.deposes,
      'Documents attendus': l.attendus,
      'Complétude (%)': l.indicateur === 'NON_SUIVI' ? '' : l.taux,
      'Pièces manquantes': l.manquantes.map(p => `${p.libelle} ${this.libelleMois(p)}`).join(' ; '),
      'Plus ancien retard (j)': l.manquantes.length ? l.plusAncienRetard : '',
      'Contact opérationnel': l.contactOperationnel.nom ?? '',
      'E-mail de relance': l.destinataire?.email ?? '',
      'Approche client': approcheClient(l.approche).libelle,
      'Dernière relance': l.derniereRelance ? new Date(l.derniereRelance).toLocaleDateString('fr-FR') : '',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lignes), 'Pièces manquantes');
    XLSX.writeFile(wb, `pieces-manquantes-${this.annee}.xlsx`);
  }
}
