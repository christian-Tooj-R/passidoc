import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SaisieTempsService, RentabiliteDossier, StatutBudget } from '../../../../../core/services/saisie-temps.service';
import { formatHeures, parseDuree } from '../../../../../core/services/duree.util';
import { formatEuros, libelleMission, libelleMois } from '../../../../travail/shared/rapport-temps.util';

const LIBELLES_STATUT: Record<StatutBudget, string> = {
  NON_BUDGETE: 'Non budgété',
  OK: 'Dans les clous',
  ATTENTION: 'Attention — 80 % du budget atteint',
  DEPASSE: 'Budget dépassé',
};

/**
 * Onglet « Rentabilité » du dossier — cahier v2 #6 : budget temps de l'affaire, barre de
 * consommation, prix de vente horaire, boni/mali (€ et %), statut, répartition du temps et
 * historique par affaire. Valorisation au PV collaborateur et détail par collaborateur : ADMIN.
 */
@Component({
  selector: 'app-rentabilite-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatTooltipModule],
  template: `
@if (loading() && !data()) {
  <div class="empty"><mat-icon>hourglass_empty</mat-icon> Chargement…</div>
} @else if (data(); as d) {
  <div class="rt">
    <!-- Sélection de l'affaire -->
    <div class="rt-top">
      <div class="fld">
        <label>Affaire (exercice)</label>
        <select [ngModel]="d.affaire" (ngModelChange)="load($event)">
          @for (a of d.affaires; track a.code) {
            <option [ngValue]="a.code">{{ a.code }} — du {{ fd(a.dateOuverture) }} au {{ fd(a.dateCloture) }} ({{ a.etat === 'O' ? 'ouverte' : 'clôturée' }})</option>
          }
        </select>
      </div>
      <a class="lnk" [routerLink]="['/travail/temps/detail']">
        <mat-icon>manage_search</mat-icon> Détail des temps passés
      </a>
    </div>

    <!-- Bandeau d'alerte -->
    @if (d.indicateurs.statut === 'DEPASSE' || d.indicateurs.statut === 'ATTENTION') {
      <div class="alert alert--{{ d.indicateurs.statut }}">
        <mat-icon>{{ d.indicateurs.statut === 'DEPASSE' ? 'error' : 'warning' }}</mat-icon>
        <span>
          {{ libelleStatut(d.indicateurs.statut) }} : {{ fh(d.indicateurs.heuresConsommees) }} consommées
          sur {{ fh(d.indicateurs.heuresBudget) }} budgétées ({{ pct(d.indicateurs.tauxConsommation) }} %).
        </span>
      </div>
    }

    <div class="grid">
      <!-- Budget -->
      <div class="card">
        <div class="card__hd"><mat-icon>tune</mat-icon> Budget de l'affaire {{ d.affaire }}</div>
        @if (d.peutModifierBudget && !readonly) {
          <form class="budget" (ngSubmit)="enregistrer()">
            <div class="fld">
              <label>Budget temps alloué</label>
              <input [(ngModel)]="budgetHeures" name="bh" placeholder="ex. 60 ou 60h30" required />
            </div>
            <div class="fld">
              <label>Honoraires compta (€ HT)</label>
              <input type="number" min="0" step="0.01" [(ngModel)]="budgetHonoraires" name="bhon"
                     [placeholder]="d.indicateurs.honorairesSource === 'FICHE' ? fe(d.indicateurs.honoraires) + ' (fiche identité)' : 'Fiche identité'" />
            </div>
            <div class="fld">
              <label>Prix de vente horaire (€)</label>
              <input type="number" min="0" step="0.01" [(ngModel)]="budgetPvh" name="bpvh" placeholder="Calculé automatiquement" />
            </div>
            <div class="budget__actions">
              <button type="submit" class="btn btn--ok" [disabled]="saving()"><mat-icon>check</mat-icon> Enregistrer</button>
              @if (d.indicateurs.budgetId) {
                <button type="button" class="btn btn--del" (click)="supprimer()" [disabled]="saving()">Supprimer le budget</button>
              }
            </div>
            @if (erreur()) { <p class="err">{{ erreur() }}</p> }
            <p class="hint">
              Honoraires vides = ceux de la fiche identité. Prix de vente horaire vide = honoraires ÷ heures budget.
              Alertes in-app et email à 80 % puis 100 % du budget.
            </p>
          </form>
        } @else {
          <dl class="ro">
            <dt>Budget temps</dt><dd>{{ d.indicateurs.heuresBudget !== null ? fh(d.indicateurs.heuresBudget) : 'Non défini' }}</dd>
            <dt>Honoraires compta</dt><dd>{{ d.indicateurs.honoraires !== null ? fe(d.indicateurs.honoraires) + ' €' : '—' }}</dd>
          </dl>
        }
      </div>

      <!-- Indicateurs -->
      <div class="card card--wide">
        <div class="card__hd"><mat-icon>monitoring</mat-icon> Indicateurs
          <span class="statut statut--{{ d.indicateurs.statut }}">{{ libelleStatutCourt(d.indicateurs.statut) }}</span>
        </div>
        <div class="conso">
          <div class="conso__lbl">
            <strong>{{ fh(d.indicateurs.heuresConsommees) }}</strong> consommées
            @if (d.indicateurs.heuresBudget !== null) {
              sur {{ fh(d.indicateurs.heuresBudget) }} ·
              @if ((d.indicateurs.heuresRestantes ?? 0) >= 0) { reste {{ fh(d.indicateurs.heuresRestantes ?? 0) }} }
              @else { dépassement de {{ fh(-(d.indicateurs.heuresRestantes ?? 0)) }} }
            }
          </div>
          @if (d.indicateurs.tauxConsommation !== null) {
            <div class="bar">
              <div class="bar__fill bar__fill--{{ d.indicateurs.statut }}" [style.width.%]="min(100, d.indicateurs.tauxConsommation * 100)"></div>
              <div class="bar__mark" [style.left.%]="d.seuilAttention * 100" matTooltip="Seuil d'alerte 80 %"></div>
            </div>
            <div class="bar__pct">{{ pct(d.indicateurs.tauxConsommation) }} %</div>
          }
        </div>
        <div class="tiles">
          <div class="tile">
            <div class="tile__v">{{ d.indicateurs.prixVenteHoraire !== null ? fe(d.indicateurs.prixVenteHoraire) + ' €' : '—' }}</div>
            <div class="tile__l">Prix de vente / h {{ d.indicateurs.prixVenteHoraire !== null ? (d.indicateurs.prixVenteCalcule ? '(calculé)' : '(saisi)') : '' }}</div>
          </div>
          <div class="tile">
            <div class="tile__v">{{ d.indicateurs.montantRealise !== null ? fe(d.indicateurs.montantRealise) + ' €' : '—' }}</div>
            <div class="tile__l">Montant réalisé</div>
          </div>
          <div class="tile" [class.tile--pos]="(d.indicateurs.boniMali ?? 0) > 0" [class.tile--neg]="(d.indicateurs.boniMali ?? 0) < 0">
            <div class="tile__v">
              @if (d.indicateurs.boniMali !== null) { {{ signe(d.indicateurs.boniMali) }}{{ fe(d.indicateurs.boniMali) }} € }
              @else { — }
            </div>
            <div class="tile__l">
              {{ (d.indicateurs.boniMali ?? 0) < 0 ? 'Mali' : 'Boni' }}
              @if (d.indicateurs.boniMaliPct !== null) { ({{ signe(d.indicateurs.boniMaliPct) }}{{ pct(d.indicateurs.boniMaliPct) }} %) }
            </div>
          </div>
          @if (d.voirValorisation) {
            <div class="tile" matTooltip="Σ temps × prix de vente horaire des collaborateurs (PV Col)">
              <div class="tile__v">{{ fe(d.indicateurs.valorisation) }} €</div>
              <div class="tile__l">Valorisation PV Col</div>
            </div>
            <div class="tile" [class.tile--neg]="(d.indicateurs.margeValorisation ?? 0) < 0" matTooltip="Honoraires − valorisation PV Col">
              <div class="tile__v">{{ d.indicateurs.margeValorisation !== null ? signe(d.indicateurs.margeValorisation) + fe(d.indicateurs.margeValorisation) + ' €' : '—' }}</div>
              <div class="tile__l">Marge réelle</div>
            </div>
          }
        </div>
        @if (d.heuresHorsBudget > 0) {
          <p class="hint">+ {{ fh(d.heuresHorsBudget) }} sur cette affaire hors budget compta (non facturable, social, juridique, conseil).</p>
        }
      </div>
    </div>

    <!-- Répartitions -->
    <div class="grid">
      <div class="card">
        <div class="card__hd"><mat-icon>category</mat-icon> Par tâche</div>
        @for (m of d.parMission; track m.missionCode) {
          <div class="rep">
            <span class="rep__lbl">{{ m.missionCode === 'SANS' ? 'Sans tâche' : m.missionCode + ' — ' + libelleMission(m.missionCode) }}</span>
            <div class="rep__bar"><div [style.width.%]="part(m.heures, d.indicateurs.heuresConsommees)"></div></div>
            <span class="rep__v">{{ fh(m.heures) }}</span>
          </div>
        } @empty { <p class="hint">Aucun temps saisi sur cette affaire.</p> }
      </div>
      <div class="card">
        <div class="card__hd"><mat-icon>calendar_month</mat-icon> Par mois</div>
        @for (m of d.parMois; track m.mois) {
          <div class="rep">
            <span class="rep__lbl">{{ libelleMois(m.mois) }}</span>
            <div class="rep__bar rep__bar--mois"><div [style.width.%]="part(m.heures, maxMois(d))"></div></div>
            <span class="rep__v">{{ fh(m.heures) }}</span>
          </div>
        } @empty { <p class="hint">—</p> }
      </div>
      @if (d.parCollaborateur) {
        <div class="card">
          <div class="card__hd"><mat-icon>groups</mat-icon> Par collaborateur</div>
          @for (c of d.parCollaborateur; track c.collaborateurId) {
            <div class="rep">
              <span class="rep__lbl">{{ c.collaborateur }}</span>
              <div class="rep__bar rep__bar--collab"><div [style.width.%]="part(c.heures, d.indicateurs.heuresConsommees)"></div></div>
              <span class="rep__v">{{ fh(c.heures) }} · {{ fe(c.valorisation) }} €</span>
            </div>
          } @empty { <p class="hint">—</p> }
        </div>
      }
    </div>

    <!-- Historique -->
    @if (d.historique.length > 1) {
      <div class="card">
        <div class="card__hd"><mat-icon>history</mat-icon> Historique par affaire</div>
        <table class="hist">
          <thead><tr><th>Affaire</th><th class="num">Honoraires</th><th class="num">Budget</th><th class="num">Consommé</th><th class="num">%</th><th class="num">Boni / mali</th><th>Statut</th></tr></thead>
          <tbody>
            @for (h of d.historique; track h.affaire) {
              <tr [class.cur]="h.affaire === d.affaire" (click)="load(h.affaire)">
                <td class="mono">{{ h.affaire }} <span class="etat etat--{{ h.etat }}">{{ h.etat }}</span></td>
                <td class="num">{{ h.honoraires !== null ? fe(h.honoraires) : '—' }}</td>
                <td class="num">{{ h.heuresBudget !== null ? fh(h.heuresBudget) : '—' }}</td>
                <td class="num">{{ fh(h.heuresConsommees) }}</td>
                <td class="num">{{ h.tauxConsommation !== null ? pct(h.tauxConsommation) + ' %' : '—' }}</td>
                <td class="num" [class.neg]="(h.boniMali ?? 0) < 0" [class.pos]="(h.boniMali ?? 0) > 0">{{ h.boniMali !== null ? signe(h.boniMali) + fe(h.boniMali) : '—' }}</td>
                <td><span class="statut statut--{{ h.statut }}">{{ libelleStatutCourt(h.statut) }}</span></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    <p class="hint">
      Temps consommé = temps <strong>facturable</strong> saisi sur ce dossier pour l'affaire, hors missions
      {{ d.missionsHorsBudget.join(', ') }} (facturées par des honoraires distincts).
    </p>
  </div>
} @else {
  <div class="empty"><mat-icon>error_outline</mat-icon> Rentabilité indisponible.</div>
}
  `,
  styles: [`
    .rt { display:flex; flex-direction:column; gap:14px; padding:16px 24px 24px; }
    .rt-top { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap; }
    .fld { display:flex; flex-direction:column; gap:4px; }
    .fld label { font-size:10.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.4px; }
    .fld select, .fld input { height:36px; border:1px solid #e2e8f0; border-radius:7px; padding:0 10px; font-size:13px; background:#fff; outline:none; font-family:inherit; box-sizing:border-box; }
    .fld input:focus, .fld select:focus { border-color:#059669; box-shadow:0 0 0 3px rgba(5,150,105,.12); }
    .lnk { display:flex; align-items:center; gap:4px; font-size:13px; color:#1d4ed8; text-decoration:none; font-weight:600; }
    .lnk mat-icon { font-size:17px; width:17px; height:17px; }

    .alert { display:flex; align-items:center; gap:10px; padding:12px 16px; border-radius:10px; font-size:13.5px; font-weight:600; }
    .alert--DEPASSE { background:#fef2f2; border:1px solid #fca5a5; color:#b91c1c; }
    .alert--ATTENTION { background:#fffbeb; border:1px solid #fcd34d; color:#b45309; }

    .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:14px; }
    .card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px; }
    .card--wide { grid-column:span 2; }
    @media (max-width: 900px) { .card--wide { grid-column:auto; } }
    .card__hd { display:flex; align-items:center; gap:8px; font-weight:700; font-size:13.5px; color:#0f172a; margin-bottom:12px; }
    .card__hd mat-icon { font-size:18px; width:18px; height:18px; color:#059669; }

    .budget { display:flex; flex-direction:column; gap:10px; }
    .budget__actions { display:flex; gap:8px; flex-wrap:wrap; }
    .btn { height:34px; border-radius:7px; padding:0 14px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:5px; border:1px solid transparent; }
    .btn mat-icon { font-size:16px; width:16px; height:16px; }
    .btn--ok { background:#059669; color:#fff; }
    .btn--ok:hover:not(:disabled) { background:#047857; }
    .btn--del { background:#fff; color:#b91c1c; border-color:#fecaca; }
    .btn:disabled { opacity:.6; cursor:not-allowed; }
    .err { color:#dc2626; font-size:12.5px; margin:0; }
    .hint { font-size:12px; color:#64748b; margin:6px 0 0; line-height:1.45; }
    .ro { display:grid; grid-template-columns:auto 1fr; gap:6px 14px; margin:0; font-size:13px; }
    .ro dt { color:#64748b; }
    .ro dd { margin:0; font-weight:700; }

    .statut { margin-left:auto; font-size:11px; font-weight:700; padding:3px 9px; border-radius:20px; }
    .statut--NON_BUDGETE { background:#f1f5f9; color:#64748b; }
    .statut--OK { background:#dcfce7; color:#15803d; }
    .statut--ATTENTION { background:#fef3c7; color:#b45309; }
    .statut--DEPASSE { background:#fee2e2; color:#b91c1c; }

    .conso { margin-bottom:14px; }
    .conso__lbl { font-size:13px; color:#334155; margin-bottom:8px; }
    .bar { position:relative; height:12px; background:#e2e8f0; border-radius:6px; overflow:visible; }
    .bar__fill { height:100%; border-radius:6px; transition:width .4s; }
    .bar__fill--OK { background:#16a34a; }
    .bar__fill--ATTENTION { background:#f59e0b; }
    .bar__fill--DEPASSE { background:#dc2626; }
    .bar__fill--NON_BUDGETE { background:#94a3b8; }
    .bar__mark { position:absolute; top:-3px; bottom:-3px; width:2px; background:#334155; opacity:.5; }
    .bar__pct { font-size:12px; font-weight:800; margin-top:4px; text-align:right; }

    .tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; }
    .tile { border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; background:#f8fafc; }
    .tile__v { font-size:17px; font-weight:800; font-family:monospace; color:#0f172a; }
    .tile__l { font-size:10.5px; font-weight:700; text-transform:uppercase; color:#64748b; margin-top:2px; }
    .tile--pos { background:#f0fdf4; border-color:#bbf7d0; }
    .tile--pos .tile__v { color:#15803d; }
    .tile--neg { background:#fef2f2; border-color:#fecaca; }
    .tile--neg .tile__v { color:#b91c1c; }

    .rep { display:grid; grid-template-columns:minmax(110px, 1.2fr) 2fr auto; align-items:center; gap:10px; font-size:12.5px; padding:4px 0; }
    .rep__lbl { color:#334155; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .rep__bar { height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden; }
    .rep__bar div { height:100%; background:#059669; border-radius:4px; }
    .rep__bar--mois div { background:#6366f1; }
    .rep__bar--collab div { background:#db2777; }
    .rep__v { font-family:monospace; font-weight:700; white-space:nowrap; }

    .hist { width:100%; border-collapse:collapse; font-size:12.5px; }
    .hist th { text-align:left; font-size:10.5px; text-transform:uppercase; color:#64748b; padding:6px 8px; border-bottom:1px solid #e2e8f0; }
    .hist td { padding:7px 8px; border-bottom:1px solid #f1f5f9; cursor:pointer; }
    .hist tr:hover td { background:#f8fafc; }
    .hist tr.cur td { background:#ecfdf5; font-weight:700; }
    .num { text-align:right !important; font-variant-numeric:tabular-nums; }
    .mono { font-family:monospace; }
    .neg { color:#dc2626; }
    .pos { color:#15803d; }
    .etat { font-size:10px; font-weight:800; padding:1px 6px; border-radius:10px; margin-left:4px; }
    .etat--O { background:#dcfce7; color:#15803d; }
    .etat--C { background:#e2e8f0; color:#475569; }
    .empty { display:flex; align-items:center; gap:8px; color:#94a3b8; padding:40px; justify-content:center; }
  `],
})
export class RentabiliteTabComponent implements OnChanges {
  @Input({ required: true }) clientId!: number;
  @Input() readonly = false;

  private svc = inject(SaisieTempsService);

  loading = signal(true);
  saving  = signal(false);
  erreur  = signal('');
  data    = signal<RentabiliteDossier | null>(null);

  budgetHeures = '';
  budgetHonoraires: number | null = null;
  budgetPvh: number | null = null;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['clientId'] && this.clientId) this.load();
  }

  load(affaire?: string) {
    this.loading.set(true);
    this.svc.getRentabiliteDossier(this.clientId, affaire).subscribe({
      next: d => {
        this.data.set(d);
        this.loading.set(false);
        const i = d.indicateurs;
        this.budgetHeures = i.heuresBudget !== null ? formatHeures(i.heuresBudget) : '';
        this.budgetHonoraires = i.honorairesSource === 'BUDGET' ? i.honoraires : null;
        this.budgetPvh = i.prixVenteCalcule ? null : i.prixVenteHoraire;
      },
      error: () => { this.data.set(null); this.loading.set(false); },
    });
  }

  enregistrer() {
    const d = this.data();
    if (!d) return;
    const heures = parseDuree(this.budgetHeures);
    if (heures === null) { this.erreur.set('Budget temps invalide — ex. 60, 60h30 ou 60,5.'); return; }
    this.erreur.set('');
    this.saving.set(true);
    this.svc.saveBudgetDossier(this.clientId, {
      affaire: d.affaire,
      heuresBudget: Math.round(heures * 100) / 100,
      honoraires: this.budgetHonoraires || null,
      prixVenteHoraire: this.budgetPvh || null,
    }).subscribe({
      next: () => { this.saving.set(false); this.load(d.affaire); },
      error: e => { this.saving.set(false); this.erreur.set(this.messageErreur(e)); },
    });
  }

  supprimer() {
    const d = this.data();
    if (!d || !confirm(`Supprimer le budget de l'affaire ${d.affaire} ?`)) return;
    this.saving.set(true);
    this.svc.deleteBudgetDossier(this.clientId, d.affaire).subscribe({
      next: () => { this.saving.set(false); this.load(d.affaire); },
      error: e => { this.saving.set(false); this.erreur.set(this.messageErreur(e)); },
    });
  }

  private messageErreur(e: any): string {
    const m = e?.error?.message;
    return Array.isArray(m) ? m.join(' ') : m || 'Erreur lors de l\'enregistrement — réessayez.';
  }

  libelleStatut(s: StatutBudget) { return LIBELLES_STATUT[s]; }
  libelleStatutCourt(s: StatutBudget) { return { NON_BUDGETE: 'Non budgété', OK: 'Dans les clous', ATTENTION: 'Attention', DEPASSE: 'Dépassé' }[s]; }
  libelleMission(c: string) { return libelleMission(c); }
  libelleMois(m: string) { return libelleMois(m); }
  fh(h: number | null) { return formatHeures(h ?? 0); }
  fe(n: number | null) { return formatEuros(n); }
  fd(d: string) { return d.split('-').reverse().join('/'); }
  pct(x: number | null) { return x === null ? 0 : Math.round(x * 100); }
  signe(n: number | null) { return n && n > 0 ? '+' : ''; }
  min(a: number, b: number) { return Math.min(a, b); }
  part(v: number, total: number) { return total > 0 ? Math.min(100, (v / total) * 100) : 0; }
  maxMois(d: RentabiliteDossier) { return Math.max(0, ...d.parMois.map(m => m.heures)); }
}
