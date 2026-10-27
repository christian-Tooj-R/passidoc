import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { SaisieTempsService, IndicateursRentabilite, StatutBudget, TableauRentabilite } from '../../../../core/services/saisie-temps.service';
import { UsersService } from '../../../../core/services/users.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { User } from '../../../../core/models/user.model';
import { formatHeures } from '../../../../core/services/duree.util';
import { formatEuros, textePdf } from '../../shared/rapport-temps.util';

type Tri = 'nom' | 'boni' | 'conso' | 'honoraires';

export const LIBELLES_STATUT: Record<StatutBudget, string> = {
  NON_BUDGETE: 'Non budgété',
  OK: 'Dans les clous',
  ATTENTION: 'Attention',
  DEPASSE: 'Dépassé',
};

/**
 * Tableau de bord « Rentabilité des dossiers » — cahier v2 #6 : pour chaque dossier et chaque
 * affaire clôturant l'année choisie, honoraires comptables, budget temps, temps consommé,
 * prix de vente horaire, boni/mali. ADMIN : tous les dossiers (+ valorisation au PV
 * collaborateur) ; autres profils : leurs dossiers uniquement.
 */
@Component({
  selector: 'app-travail-rentabilite',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatTooltipModule],
  template: `
<div class="page">
  <div class="pg-header">
    <div class="pg-header__left">
      <div class="pg-icon"><mat-icon>savings</mat-icon></div>
      <div>
        <h1 class="pg-title">Rentabilité des dossiers</h1>
        <p class="pg-sub">Budget temps comptable et boni/mali — exercices clôturant en {{ annee }}</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn-export" (click)="exportExcel()" [disabled]="!lignesVue().length"><mat-icon>table_view</mat-icon> Excel</button>
      <button class="btn-export btn-export--pdf" (click)="exportPdf()" [disabled]="!lignesVue().length"><mat-icon>picture_as_pdf</mat-icon> Récapitulatif boni/mali</button>
    </div>
  </div>

  <div class="filters">
    <div class="fb-field">
      <label class="fb-label">Exercices clôturant en</label>
      <select class="fb-select" [(ngModel)]="annee" (ngModelChange)="load()">
        @for (a of annees; track a) { <option [ngValue]="a">{{ a }}</option> }
      </select>
    </div>
    @if (authSvc.isAdmin()) {
      <div class="fb-field">
        <label class="fb-label">Intervenant</label>
        <select class="fb-select" [(ngModel)]="collaborateurId" (ngModelChange)="load()">
          <option [ngValue]="null">Tous les dossiers</option>
          @for (u of usersTries(); track u.id) { <option [ngValue]="u.id">{{ u.firstName }} {{ u.lastName }}</option> }
        </select>
      </div>
    }
    <div class="fb-field">
      <label class="fb-label">Statut</label>
      <div class="seg">
        <button type="button" class="seg__btn" [class.seg__btn--on]="!statut" (click)="statut = null">Tous</button>
        @for (s of statuts; track s) {
          <button type="button" class="seg__btn seg__btn--{{ s }}" [class.seg__btn--on]="statut === s" (click)="statut = s">
            {{ libelleStatut(s) }} ({{ compte(s) }})
          </button>
        }
      </div>
    </div>
    <div class="fb-field">
      <label class="fb-label">Trier par</label>
      <select class="fb-select" [(ngModel)]="tri">
        <option value="boni">Boni / mali (pires d'abord)</option>
        <option value="conso">Consommation du budget</option>
        <option value="honoraires">Honoraires (décroissant)</option>
        <option value="nom">Dossier</option>
      </select>
    </div>
    <div class="fb-field fb-field--grow">
      <label class="fb-label">Dossier</label>
      <input class="fb-input" [(ngModel)]="recherche" placeholder="Rechercher un dossier…" />
    </div>
    <label class="chk"><input type="checkbox" [(ngModel)]="masquerVides" /> Masquer les dossiers sans temps ni budget</label>
  </div>

  @if (data(); as d) {
    <div class="kpis">
      <div class="kpi"><div class="kpi__v">{{ fe(d.totaux.honoraires) }} €</div><div class="kpi__l">Honoraires compta</div></div>
      <div class="kpi"><div class="kpi__v">{{ fh(d.totaux.heuresConsommees) }} <small>/ {{ fh(d.totaux.heuresBudget) }}</small></div><div class="kpi__l">Temps consommé / budget</div></div>
      <div class="kpi" [class.kpi--neg]="d.totaux.boniMali < 0" [class.kpi--pos]="d.totaux.boniMali > 0">
        <div class="kpi__v">{{ signe(d.totaux.boniMali) }}{{ fe(d.totaux.boniMali) }} €</div><div class="kpi__l">Boni / mali (budget)</div>
      </div>
      <div class="kpi kpi--red"><div class="kpi__v">{{ d.totaux.dossiersDepasses }}</div><div class="kpi__l">Dossiers dépassés</div></div>
      <div class="kpi kpi--orange"><div class="kpi__v">{{ d.totaux.dossiersAttention }}</div><div class="kpi__l">À surveiller (≥ 80 %)</div></div>
      @if (d.voirValorisation) {
        <div class="kpi" matTooltip="Σ temps × prix de vente horaire des collaborateurs (PV Col)">
          <div class="kpi__v">{{ fe(d.totaux.valorisation) }} €</div><div class="kpi__l">Valorisation PV Col</div>
        </div>
        <div class="kpi" [class.kpi--neg]="(d.totaux.margeValorisation ?? 0) < 0" matTooltip="Honoraires − valorisation PV Col">
          <div class="kpi__v">{{ signe(d.totaux.margeValorisation) }}{{ fe(d.totaux.margeValorisation) }} €</div><div class="kpi__l">Marge réelle</div>
        </div>
      }
    </div>
  }

  <div class="table-wrap">
    @if (loading()) {
      <div class="empty-state"><mat-icon>hourglass_empty</mat-icon><p>Chargement…</p></div>
    } @else if (!lignesVue().length) {
      <div class="empty-state"><mat-icon>savings</mat-icon><p>Aucun dossier pour ces critères</p></div>
    } @else {
      <table class="data-table">
        <thead>
          <tr>
            <th>Dossier</th><th>Affaire</th><th>Responsable</th>
            <th class="num">Honoraires</th><th class="num">Budget</th><th class="num" matTooltip="Prix de vente horaire = honoraires ÷ heures budget (ou saisi)">PV/h</th>
            <th class="num">Consommé</th><th class="th-bar">Consommation</th>
            <th class="num" matTooltip="Heures consommées × prix de vente horaire">Réalisé</th>
            <th class="num">Boni / mali</th><th>Statut</th>
            @if (data()?.voirValorisation) { <th class="num">Valo. PV Col</th><th class="num">Marge réelle</th> }
          </tr>
        </thead>
        <tbody>
          @for (l of lignesVue(); track l.clientId + l.affaire) {
            <tr class="data-row" [class.data-row--over]="l.statut === 'DEPASSE'">
              <td><a class="lnk" [routerLink]="['/clients', l.clientId]" [queryParams]="{ tab: 'rentabilite' }">{{ l.client }}</a></td>
              <td class="mono">{{ l.affaire }} <span class="etat etat--{{ l.etat }}">{{ l.etat }}</span></td>
              <td class="muted">{{ l.intervenants.responsable ?? l.intervenants.directeur ?? '—' }}</td>
              <td class="num">{{ l.honoraires !== null ? fe(l.honoraires) : '—' }}</td>
              <td class="num">{{ l.heuresBudget !== null ? fh(l.heuresBudget) : '—' }}</td>
              <td class="num">
                {{ l.prixVenteHoraire !== null ? fe(l.prixVenteHoraire) : '—' }}
                @if (l.prixVenteHoraire !== null && !l.prixVenteCalcule) { <span class="tag" matTooltip="Saisi manuellement">M</span> }
              </td>
              <td class="num strong">{{ fh(l.heuresConsommees) }}</td>
              <td class="td-bar">
                @if (l.tauxConsommation !== null) {
                  <div class="bar"><div class="bar__fill bar__fill--{{ l.statut }}" [style.width.%]="min(100, l.tauxConsommation * 100)"></div></div>
                  <span class="bar__pct">{{ (l.tauxConsommation * 100) | number:'1.0-0' }} %</span>
                }
              </td>
              <td class="num">{{ l.montantRealise !== null ? fe(l.montantRealise) : '—' }}</td>
              <td class="num strong" [class.neg]="(l.boniMali ?? 0) < 0" [class.pos]="(l.boniMali ?? 0) > 0">
                @if (l.boniMali !== null) {
                  {{ signe(l.boniMali) }}{{ fe(l.boniMali) }}
                  <small>({{ signe(l.boniMali) }}{{ ((l.boniMaliPct ?? 0) * 100) | number:'1.0-0' }} %)</small>
                } @else { — }
              </td>
              <td><span class="statut statut--{{ l.statut }}">{{ libelleStatut(l.statut) }}</span></td>
              @if (data()?.voirValorisation) {
                <td class="num">{{ fe(l.valorisation) }}</td>
                <td class="num" [class.neg]="(l.margeValorisation ?? 0) < 0">{{ l.margeValorisation !== null ? signe(l.margeValorisation) + fe(l.margeValorisation) : '—' }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
      <p class="note">
        Temps consommé = temps <strong>facturable</strong> saisi sur le dossier pour l'affaire, hors missions facturées à part
        (social, juridique, conseil). Boni/mali = honoraires − temps consommé × prix de vente horaire.
        Budget et honoraires se règlent dans l'onglet <em>Rentabilité</em> du dossier.
      </p>
    }
  </div>
</div>
  `,
  styles: [`
    .page { display:flex; flex-direction:column; height:100%; min-height:0; overflow:auto; }
    .pg-header { display:flex; align-items:center; justify-content:space-between; padding:24px 28px 0; gap:12px; flex-wrap:wrap; }
    .pg-header__left { display:flex; align-items:center; gap:14px; }
    .pg-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#059669,#047857); box-shadow:0 4px 14px rgba(5,150,105,.3); }
    .pg-icon mat-icon { color:#fff; }
    .pg-title { font-size:20px; font-weight:800; color:#0f172a; margin:0; }
    .pg-sub { font-size:13px; color:#64748b; margin:2px 0 0; }
    .header-actions { display:flex; gap:10px; }
    .btn-export { display:flex; align-items:center; gap:6px; padding:9px 16px; border-radius:9px; border:1.5px solid #bbf7d0; background:#fff; color:#15803d; font-size:13px; font-weight:600; cursor:pointer; }
    .btn-export--pdf { border-color:#fbcfe8; color:#be185d; }
    .btn-export mat-icon { font-size:16px; width:16px; height:16px; }
    .btn-export:disabled { opacity:.5; cursor:not-allowed; }

    .filters { display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; background:#fff; margin:16px 28px 0; padding:14px 20px; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,.06); border:1px solid #f1f5f9; }
    .fb-field { display:flex; flex-direction:column; gap:4px; }
    .fb-field--grow { flex:1; min-width:180px; }
    .fb-label { font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; }
    .fb-input, .fb-select { height:36px; border:1px solid #e2e8f0; border-radius:7px; padding:0 10px; font-size:13px; background:#fff; color:#374151; outline:none; font-family:inherit; min-width:130px; box-sizing:border-box; }
    .seg { display:flex; gap:3px; background:#f1f5f9; border-radius:7px; padding:3px; height:36px; box-sizing:border-box; }
    .seg__btn { border:none; background:transparent; border-radius:5px; padding:0 10px; font-size:12px; font-weight:600; color:#64748b; cursor:pointer; white-space:nowrap; }
    .seg__btn--on { background:#334155; color:#fff; }
    .seg__btn--DEPASSE.seg__btn--on { background:#dc2626; }
    .seg__btn--ATTENTION.seg__btn--on { background:#d97706; }
    .seg__btn--OK.seg__btn--on { background:#16a34a; }
    .chk { display:flex; align-items:center; gap:6px; font-size:12.5px; color:#475569; height:36px; }

    .kpis { display:flex; gap:12px; padding:14px 28px 0; flex-wrap:wrap; }
    .kpi { flex:1; min-width:140px; border-radius:12px; padding:13px 16px; background:#fff; border:1px solid #e2e8f0; color:#0f172a; }
    .kpi__v { font-size:18px; font-weight:800; font-family:monospace; white-space:nowrap; }
    .kpi__v small { font-size:13px; color:#64748b; }
    .kpi__l { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; margin-top:3px; }
    .kpi--pos { background:#f0fdf4; border-color:#bbf7d0; color:#15803d; }
    .kpi--neg { background:#fef2f2; border-color:#fecaca; color:#b91c1c; }
    .kpi--red .kpi__v { color:#dc2626; }
    .kpi--orange .kpi__v { color:#d97706; }

    .table-wrap { padding:14px 28px 28px; overflow-x:auto; }
    .data-table { width:100%; border-collapse:collapse; font-size:12.5px; background:#fff; }
    .data-table thead { background:#1e293b; }
    .data-table th { color:#fff; font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; padding:10px; text-align:left; white-space:nowrap; }
    .data-table td { padding:8px 10px; border-bottom:1px solid #f1f5f9; color:#374151; white-space:nowrap; }
    .data-row:hover { background:#f8fafc; }
    .data-row--over { background:#fff7f7; }
    .num { text-align:right !important; font-variant-numeric:tabular-nums; }
    .strong { font-weight:800; }
    .mono { font-family:monospace; }
    .muted { color:#64748b; }
    .neg { color:#dc2626; }
    .pos { color:#15803d; }
    .lnk { color:#1d4ed8; font-weight:600; text-decoration:none; }
    .lnk:hover { text-decoration:underline; }
    .tag { font-size:9.5px; font-weight:800; background:#e0e7ff; color:#4338ca; border-radius:4px; padding:0 4px; margin-left:3px; }
    .etat { font-size:10px; font-weight:800; padding:1px 6px; border-radius:10px; margin-left:4px; }
    .etat--O { background:#dcfce7; color:#15803d; }
    .etat--C { background:#e2e8f0; color:#475569; }
    .th-bar, .td-bar { min-width:150px; }
    .td-bar { display:flex; align-items:center; gap:8px; }
    .bar { flex:1; height:7px; background:#e2e8f0; border-radius:4px; overflow:hidden; }
    .bar__fill { height:100%; border-radius:4px; }
    .bar__fill--OK { background:#16a34a; }
    .bar__fill--ATTENTION { background:#f59e0b; }
    .bar__fill--DEPASSE { background:#dc2626; }
    .bar__pct { font-size:11.5px; font-weight:700; min-width:40px; text-align:right; }
    .statut { font-size:11px; font-weight:700; padding:3px 9px; border-radius:20px; }
    .statut--NON_BUDGETE { background:#f1f5f9; color:#64748b; }
    .statut--OK { background:#dcfce7; color:#15803d; }
    .statut--ATTENTION { background:#fef3c7; color:#b45309; }
    .statut--DEPASSE { background:#fee2e2; color:#b91c1c; }
    .note { font-size:12px; color:#64748b; margin:12px 0 0; line-height:1.5; }
    .empty-state { display:flex; flex-direction:column; align-items:center; padding:60px 28px; color:#94a3b8; gap:12px; }
    .empty-state mat-icon { font-size:48px; width:48px; height:48px; opacity:.3; }
  `],
})
export class TravailRentabiliteComponent implements OnInit, OnDestroy {
  private svc      = inject(SaisieTempsService);
  private usersSvc = inject(UsersService);
  authSvc          = inject(AuthService);
  private tenantSvc = inject(TenantService);
  private _d$      = new Subject<void>();

  readonly statuts: StatutBudget[] = ['DEPASSE', 'ATTENTION', 'OK', 'NON_BUDGETE'];
  readonly annees = (() => { const y = new Date().getFullYear(); return [y + 1, y, y - 1, y - 2, y - 3]; })();

  loading = signal(true);
  data    = signal<TableauRentabilite | null>(null);
  users: User[] = [];

  annee = new Date().getFullYear();
  collaborateurId: number | null = null;
  statut: StatutBudget | null = null;
  tri: Tri = 'boni';
  recherche = '';
  masquerVides = true;

  ngOnInit() {
    if (this.authSvc.isAdmin()) this.usersSvc.getAll().pipe(takeUntil(this._d$)).subscribe(u => this.users = u);
    this.load();
  }

  ngOnDestroy() { this._d$.next(); this._d$.complete(); }

  load() {
    this.loading.set(true);
    this.svc.getRentabilite({ annee: this.annee, collaborateurId: this.collaborateurId ?? undefined })
      .pipe(takeUntil(this._d$))
      .subscribe({
        next: d => { this.data.set(d); this.loading.set(false); },
        error: () => { this.data.set(null); this.loading.set(false); },
      });
  }

  private lignesBase(): IndicateursRentabilite[] {
    const q = this.recherche.trim().toLowerCase();
    return (this.data()?.lignes ?? []).filter(l =>
      (!this.masquerVides || l.heuresConsommees > 0 || l.heuresBudget !== null)
      && (!q || l.client.toLowerCase().includes(q)));
  }

  lignesVue(): IndicateursRentabilite[] {
    const lignes = this.lignesBase().filter(l => !this.statut || l.statut === this.statut);
    const parNom = (a: IndicateursRentabilite, b: IndicateursRentabilite) => a.client.localeCompare(b.client, 'fr', { sensitivity: 'base' });
    const tris: Record<Tri, (a: IndicateursRentabilite, b: IndicateursRentabilite) => number> = {
      nom: parNom,
      boni: (a, b) => (a.boniMali ?? Infinity) - (b.boniMali ?? Infinity) || parNom(a, b),
      conso: (a, b) => (b.tauxConsommation ?? -1) - (a.tauxConsommation ?? -1) || parNom(a, b),
      honoraires: (a, b) => (b.honoraires ?? -1) - (a.honoraires ?? -1) || parNom(a, b),
    };
    return [...lignes].sort(tris[this.tri]);
  }

  compte(s: StatutBudget) { return this.lignesBase().filter(l => l.statut === s).length; }

  usersTries() {
    return [...this.users].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, 'fr', { sensitivity: 'base' }));
  }

  libelleStatut(s: StatutBudget) { return LIBELLES_STATUT[s]; }
  fh(h: number | null) { return formatHeures(h ?? 0); }
  fe(n: number | null) { return formatEuros(n); }
  signe(n: number | null | undefined) { return n && n > 0 ? '+' : ''; }
  min(a: number, b: number) { return Math.min(a, b); }

  // ── Exports ──

  private lignesExport() {
    const voir = !!this.data()?.voirValorisation;
    return this.lignesVue().map(l => ({
      Dossier: l.client,
      Affaire: l.affaire,
      'État': l.etat,
      Responsable: l.intervenants.responsable ?? l.intervenants.directeur ?? '',
      'Honoraires (€)': l.honoraires ?? '',
      'Budget (h)': l.heuresBudget ?? '',
      'PV horaire (€)': l.prixVenteHoraire ?? '',
      'Consommé (h)': l.heuresConsommees,
      'Consommation (%)': l.tauxConsommation !== null ? Math.round(l.tauxConsommation * 100) : '',
      'Réalisé (€)': l.montantRealise ?? '',
      'Boni/mali (€)': l.boniMali ?? '',
      'Boni/mali (%)': l.boniMaliPct !== null ? Math.round(l.boniMaliPct * 100) : '',
      Statut: LIBELLES_STATUT[l.statut],
      ...(voir ? { 'Valorisation PV Col (€)': l.valorisation ?? '', 'Marge réelle (€)': l.margeValorisation ?? '' } : {}),
    }));
  }

  exportExcel() {
    const ws = XLSX.utils.json_to_sheet(this.lignesExport());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Rentabilité ${this.annee}`);
    XLSX.writeFile(wb, `rentabilite-dossiers-${this.annee}.xlsx`);
  }

  exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`Récapitulatif boni / mali — exercices clôturant en ${this.annee}`, 14, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Généré le ${new Date().toLocaleString('fr-FR')} par ${this.tenantSvc.nomSociete()}`, 14, 19.5);
    const lignes = this.lignesExport();
    const colonnes = lignes.length ? Object.keys(lignes[0]) : [];
    autoTable(doc, {
      startY: 25,
      head: [colonnes],
      body: lignes.map(l => colonnes.map(c => {
        const v = (l as any)[c];
        return textePdf(typeof v === 'number' && /€/.test(c) ? formatEuros(v) : String(v));
      })),
      headStyles: { fillColor: [30, 41, 59], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      margin: { left: 8, right: 8 },
      didParseCell: (h) => {
        if (h.section === 'body' && colonnes[h.column.index]?.startsWith('Boni/mali')) {
          const v = Number(String(h.cell.raw).replace(/[\s\u202f\u00a0]/g, '').replace(',', '.'));
          if (v < 0) h.cell.styles.textColor = [185, 28, 28];
          if (v > 0) h.cell.styles.textColor = [21, 128, 61];
        }
      },
    });
    doc.save(`rentabilite-dossiers-${this.annee}.pdf`);
  }
}
