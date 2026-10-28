import { Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CYCLES_MISSIONS, Mission, STATUTS_MISSION, StatutMission, SyntheseMissions,
  formatMontant, initialesPersonne, libelleStatut, nomCycle, nomPersonne,
} from '../../../../../core/models/mission.model';
import { toLocalIso } from '../../../../../core/services/date.util';

type FiltreRelance = '' | 'SEMAINE' | 'MOIS' | 'RETARD';

function finSemaine(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return toLocalIso(d);
}
function finMois(iso: string): string {
  const [a, m] = iso.split('-').map(Number);
  return toLocalIso(new Date(a, m, 0));
}

/**
 * Onglet 2 « Pipeline missions » (CDC §4) : toutes les missions du dossier, qu'elles
 * viennent d'un cycle ou soient saisies directement ; KPI, filtres, statut modifiable en ligne.
 */
@Component({
  selector: 'app-missions-pipeline',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  template: `
<div class="kpis">
  <div class="kpi">
    <div class="kpi__l">Potentiel total</div>
    <div class="kpi__v">{{ montant(synthese?.potentiel) }}</div>
    <div class="kpi__s">{{ (synthese?.proposees?.nombre ?? 0) + (synthese?.enDiscussion?.nombre ?? 0) + (synthese?.acceptees?.nombre ?? 0) }} mission(s) active(s)</div>
  </div>
  <div class="kpi kpi--disc">
    <div class="kpi__l">En cours</div>
    <div class="kpi__v">{{ synthese?.enDiscussion?.nombre ?? 0 }}</div>
    <div class="kpi__s">en discussion · {{ montant(synthese?.enDiscussion?.montant) }}</div>
  </div>
  <div class="kpi kpi--ok">
    <div class="kpi__l">Signées</div>
    <div class="kpi__v">{{ synthese?.acceptees?.nombre ?? 0 }}</div>
    <div class="kpi__s">acceptées · {{ montant(synthese?.acceptees?.montant) }}</div>
  </div>
  <button class="kpi kpi--rel" type="button" [class.kpi--on]="relance() === 'RETARD'" (click)="relance.set(relance() === 'RETARD' ? '' : 'RETARD')">
    <div class="kpi__l">À relancer</div>
    <div class="kpi__v">{{ synthese?.aRelancer ?? 0 }}</div>
    <div class="kpi__s">date de relance dépassée</div>
  </button>
</div>

<div class="bar">
  <select class="fi" [ngModel]="statut()" (ngModelChange)="statut.set($event)" aria-label="Filtrer par statut">
    <option value="">Tous les statuts</option>
    @for (s of statuts; track s.code) { <option [value]="s.code">{{ s.libelle }}</option> }
  </select>
  <select class="fi" [ngModel]="cycle()" (ngModelChange)="cycle.set($event)" aria-label="Filtrer par cycle d'origine">
    <option value="">Tous les cycles</option>
    <option value="HORS_CYCLE">— Hors cycle</option>
    @for (c of cycles; track c.code) { <option [value]="c.code">{{ c.code }} · {{ c.nom }}</option> }
  </select>
  <select class="fi" [ngModel]="responsableId()" (ngModelChange)="responsableId.set($event)" aria-label="Filtrer par responsable">
    <option [ngValue]="null">Tous les responsables</option>
    @for (r of responsables(); track r.id) { <option [ngValue]="r.id">{{ r.nom }}</option> }
  </select>
  <select class="fi" [ngModel]="relance()" (ngModelChange)="relance.set($event)" aria-label="Filtrer par date de relance">
    <option value="">Toutes les relances</option>
    <option value="SEMAINE">À relancer cette semaine</option>
    <option value="MOIS">À relancer ce mois-ci</option>
    <option value="RETARD">Relance dépassée</option>
  </select>
  <label class="chk"><input type="checkbox" [ngModel]="avecMontant()" (ngModelChange)="avecMontant.set($event)" /> Avec montant</label>
  <label class="chk"><input type="checkbox" [ngModel]="archivees()" (ngModelChange)="archivees.set($event)" /> Archivées</label>
  <span class="spacer"></span>
  @if (peutEcrire) {
    <button class="btn-new" type="button" (click)="nouvelle.emit()"><mat-icon>add</mat-icon> Nouvelle mission</button>
  }
</div>

@if (!vues().length) {
  <div class="empty">
    <mat-icon>work_outline</mat-icon>
    @if (missions.length) { Aucune mission pour ces filtres. }
    @else { Aucune mission sur ce dossier. Les missions proposées dans l'onglet « Par cycle » apparaissent ici automatiquement. }
  </div>
} @else {
  <div class="tw">
    <table class="t">
      <thead>
        <tr>
          <th>Intitulé de la mission</th><th>Cycle d'origine</th><th>Statut</th>
          <th class="num">Montant estimé HT</th><th>Date de relance</th><th>Responsable</th><th>Dernière modif.</th>
        </tr>
      </thead>
      <tbody>
        @for (m of vues(); track m.id) {
          <tr [class.r--refusee]="m.statut === 'REFUSEE'" [class.r--archivee]="m.archivee">
            <td>
              <button class="lnk" type="button" (click)="ouvrir.emit(m)">{{ m.titre }}</button>
              @if (m.archivee) { <span class="chip">Archivée</span> }
            </td>
            <td>
              @if (m.cycle) { <span class="cyc" [matTooltip]="nomCycle(m.cycle)">{{ m.cycle }}</span> {{ nomCycle(m.cycle) }} }
              @else { <span class="muted">— Hors cycle</span> }
            </td>
            <td>
              @if (peutEcrire && !m.archivee) {
                <select class="sel badge-mission badge-mission--{{ m.statut }}" [ngModel]="m.statut"
                        (ngModelChange)="changerStatut.emit({ mission: m, statut: $event })" [attr.aria-label]="'Statut de ' + m.titre">
                  @for (s of statuts; track s.code) { <option [value]="s.code">{{ s.libelle }}</option> }
                </select>
              } @else {
                <span class="badge-mission badge-mission--{{ m.statut }}">{{ libelleStatut(m.statut) }}</span>
              }
            </td>
            <td class="num">{{ montant(m.honoraires) }}</td>
            <td>
              @if (m.dateRelance) {
                <span [class.late]="relanceDepassee(m)">{{ m.dateRelance | date:'dd/MM/yyyy' }}</span>
                @if (m.aRelancer) { <span class="badge-relance">À relancer</span> }
              } @else { <span class="muted">—</span> }
            </td>
            <td>
              @if (m.responsable) { <span class="av" [matTooltip]="nomPersonne(m.responsable)">{{ initiales(m) }}</span> }
              @else { <span class="muted">—</span> }
            </td>
            <td class="muted">{{ m.updatedAt | date:'dd/MM/yyyy' }}</td>
          </tr>
        }
      </tbody>
    </table>
  </div>
}
  `,
  styles: [`
    :host { display:block; }
    .kpis { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px; }
    .kpi { border-radius:12px; padding:12px 16px; background:#fff; border:1px solid #e2e8f0; text-align:left; font:inherit; color:#0f172a; }
    button.kpi { cursor:pointer; }
    .kpi__l { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#64748b; }
    .kpi__v { font-size:21px; font-weight:800; font-variant-numeric:tabular-nums; margin-top:2px; }
    .kpi__s { font-size:11.5px; color:#94a3b8; margin-top:1px; }
    .kpi--disc .kpi__v { color:#a16207; }
    .kpi--ok .kpi__v { color:#15803d; }
    .kpi--rel .kpi__v { color:#dc2626; }
    .kpi--on { box-shadow:0 0 0 2px #dc2626 inset; }
    .bar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:14px 0 10px; }
    .fi { height:34px; border:1px solid #e2e8f0; border-radius:8px; padding:0 8px; font-size:12.5px; background:#fff; color:#334155; font-family:inherit; max-width:230px; }
    .chk { display:flex; align-items:center; gap:5px; font-size:12.5px; color:#334155; cursor:pointer; }
    .spacer { flex:1; }
    .btn-new { display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 14px; border-radius:8px; border:none; background:#4f46e5; color:#fff; font-weight:700; font-size:13px; cursor:pointer; font-family:inherit; }
    .btn-new mat-icon { font-size:18px; width:18px; height:18px; }
    .empty { display:flex; align-items:center; justify-content:center; gap:8px; padding:40px 16px; color:#94a3b8; text-align:center; font-size:13px; }
    .tw { overflow-x:auto; border-radius:10px; border:1px solid #f1f5f9; }
    .t { width:100%; border-collapse:collapse; font-size:12.5px; background:#fff; }
    .t thead { background:#1e293b; }
    .t th { color:#fff; font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; padding:10px; text-align:left; white-space:nowrap; }
    .t td { padding:8px 10px; border-bottom:1px solid #f1f5f9; color:#374151; vertical-align:middle; }
    .t tbody tr:hover { background:#f8fafc; }
    .r--refusee td { opacity:.55; }
    .r--archivee td { background:#fafafa; color:#94a3b8; }
    .num { text-align:right !important; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .muted { color:#94a3b8; }
    .late { color:#dc2626; font-weight:700; margin-right:6px; }
    .lnk { border:none; background:none; padding:0; color:#1d4ed8; font-weight:600; cursor:pointer; text-align:left; font:inherit; font-weight:600; }
    .lnk:hover { text-decoration:underline; }
    .chip { margin-left:6px; font-size:10.5px; padding:1px 7px; border-radius:10px; background:#f1f5f9; color:#64748b; }
    .cyc { display:inline-block; font-size:10.5px; font-weight:800; padding:1px 6px; border-radius:5px; background:#eef2ff; color:#4338ca; margin-right:4px; }
    .sel { cursor:pointer; font:inherit; font-size:11.5px; font-weight:700; padding:2px 6px; border-radius:12px; }
    .av { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:50%; background:#e0e7ff; color:#3730a3; font-size:10.5px; font-weight:800; }
    @media (max-width: 900px) { .kpis { grid-template-columns:repeat(2, minmax(0, 1fr)); } }
  `],
})
export class MissionsPipelineComponent implements OnChanges {
  @Input() missions: Mission[] = [];
  @Input() synthese: SyntheseMissions | null = null;
  @Input() peutEcrire = false;
  @Output() ouvrir = new EventEmitter<Mission>();
  @Output() nouvelle = new EventEmitter<void>();
  @Output() changerStatut = new EventEmitter<{ mission: Mission; statut: StatutMission }>();

  get statuts() { return STATUTS_MISSION; }
  get cycles() { return CYCLES_MISSIONS; }

  readonly statut = signal<string>('');
  readonly cycle = signal<string>('');
  readonly responsableId = signal<number | null>(null);
  readonly relance = signal<FiltreRelance>('');
  readonly avecMontant = signal(false);
  readonly archivees = signal(false);
  /** Les @Input classiques ne sont pas des signaux : on force le recalcul quand ils changent. */
  private readonly version = signal(0);
  ngOnChanges() { this.version.update(v => v + 1); }

  readonly responsables = computed(() => {
    this.version();
    const m = new Map<number, string>();
    for (const x of this.missions) if (x.responsable) m.set(x.responsable.id, nomPersonne(x.responsable));
    return [...m].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  });

  readonly vues = computed(() => {
    this.version();
    const auj = toLocalIso(new Date());
    const s = this.statut(), c = this.cycle(), r = this.responsableId(), rel = this.relance();
    return this.missions.filter(m => {
      if (!this.archivees() && m.archivee) return false;
      if (s && m.statut !== s) return false;
      if (c && (c === 'HORS_CYCLE' ? !!m.cycle : m.cycle !== c)) return false;
      if (r && m.responsableId !== r) return false;
      if (this.avecMontant() && m.honoraires == null) return false;
      if (rel) {
        if (rel === 'RETARD') return m.aRelancer;
        const ouverte = m.statut === 'PROPOSEE' || m.statut === 'EN_DISCUSSION';
        if (!m.dateRelance || !ouverte || m.dateRelance < auj) return false;
        return m.dateRelance <= (rel === 'SEMAINE' ? finSemaine(auj) : finMois(auj));
      }
      return true;
    });
  });

  montant(v: number | null | undefined) { return v == null ? '—' : formatMontant(v); }
  libelleStatut(s: string) { return libelleStatut(s); }
  nomCycle(c: string | null) { return nomCycle(c); }
  nomPersonne(p: Mission['responsable']) { return nomPersonne(p); }
  initiales(m: Mission) { return initialesPersonne(m.responsable); }
  /** CDC §4.2 : date en rouge si dépassée et mission ni acceptée ni refusée. */
  relanceDepassee(m: Mission) {
    return !!m.dateRelance && m.dateRelance < toLocalIso(new Date()) && m.statut !== 'ACCEPTEE' && m.statut !== 'REFUSEE';
  }
}
