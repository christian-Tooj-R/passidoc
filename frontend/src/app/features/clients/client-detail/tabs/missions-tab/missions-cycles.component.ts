import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MissionsService } from '../../../../../core/services/missions.service';
import { ToastService } from '../../../../../core/services/toast.service';
import {
  CYCLES_MISSIONS, CodeCycle, CyclesDossier, Mission, MissionDejaRefusee,
  compterRecommandations, formatMontant, initialesPersonne, libelleStatut, nomPersonne, resumeStatuts,
} from '../../../../../core/models/mission.model';

const PLACEHOLDER_RECO = "Ex. : Nous recommandons au dirigeant de mettre en place un tableau de bord mensuel pour suivre "
  + "l'évolution de ses charges de personnel, qui ont progressé de 18 % sur l'exercice.";

/**
 * Onglet 1 « Par cycle » (CDC §3) : par cycle de révision, les recommandations émises au
 * client (zone A) et les missions proposables détectées (zone B). Aucune écriture comptable
 * n'est recopiée. Les missions créées ici alimentent automatiquement le pipeline (R1).
 */
@Component({
  selector: 'app-missions-cycles',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  template: `
<div class="intro">
  <mat-icon>lightbulb</mat-icon>
  <div>
    Notez, cycle par cycle, ce que vous avez déjà identifié pendant la révision{{ annee ? ' de l’exercice ' + annee : '' }} :
    les <strong>recommandations</strong> à adresser au client et les <strong>missions</strong> à lui proposer.
    Pas de ressaisie comptable : les écritures restent dans TIIME.
  </div>
</div>
@if (exerciceClos) {
  <div class="ro"><mat-icon>lock</mat-icon> Exercice clôturé : consultation seule. Le suivi des missions continue depuis l'exercice en cours et la page Missions.</div>
}

<div class="acc">
  @for (c of cycles; track c.code) {
    @let ms = missionsDuCycle(c.code);
    @let reco = texte(c.code);
    <section class="cy" [class.cy--open]="ouvert(c.code)">
      <button class="cy-h" type="button" (click)="basculer(c.code)" [attr.aria-expanded]="ouvert(c.code)">
        <span class="cy-ic"><mat-icon>{{ c.icon }}</mat-icon></span>
        <span class="cy-code">{{ c.code }}</span>
        <span class="cy-nom">{{ c.nom }}</span>
        <span class="cy-sum">
          <span class="pill" [class.pill--on]="nbReco(c.code) > 0"><mat-icon>edit_note</mat-icon>{{ nbReco(c.code) }} recommandation{{ nbReco(c.code) > 1 ? 's' : '' }}</span>
          <span class="pill" [class.pill--on]="ms.length > 0"><mat-icon>work_outline</mat-icon>{{ ms.length }} mission{{ ms.length > 1 ? 's' : '' }}</span>
          @if (total(ms) > 0) { <span class="pill pill--eur">{{ montant(total(ms)) }}</span> }
          @for (r of resume(ms).slice(0, 2); track r.code) { <span class="badge-mission badge-mission--{{ r.code }}">{{ r.libelle }}</span> }
          @if (refuseesDuCycle(c.code).length) { <span class="pill pill--memo" matTooltip="Missions refusées lors d'un exercice précédent">↺ {{ refuseesDuCycle(c.code).length }}</span> }
        </span>
        <mat-icon class="cy-chev">expand_more</mat-icon>
      </button>

      @if (ouvert(c.code)) {
        <div class="cy-b">
          <div class="ex">Missions typiques : {{ c.exemples }}</div>

          <div class="zone">
            <div class="zone-t"><span class="zl">A</span> Recommandations émises au client sur ce cycle</div>
            <textarea class="ta" rows="4" [ngModel]="reco" (ngModelChange)="brouillon[c.code] = $event"
                      (blur)="enregistrer(c.code)" [disabled]="!peutEcrire" [placeholder]="placeholder"
                      [attr.aria-label]="'Recommandations — ' + c.nom"></textarea>
            <div class="zone-f">
              <span class="muted">Une recommandation par ligne.</span>
              @if (saving() === c.code) { <span class="muted">Enregistrement…</span> }
              @else if (modifie(c.code)) {
                <button class="b-mini" type="button" (click)="enregistrer(c.code)">Enregistrer</button>
              } @else if (data?.recommandations?.[c.code]?.updatedAt) {
                <span class="ok"><mat-icon>check</mat-icon> Enregistré le {{ data!.recommandations[c.code]!.updatedAt | date:'dd/MM/yyyy HH:mm' }}</span>
              }
            </div>
          </div>

          <div class="zone">
            <div class="zone-t"><span class="zl">B</span> Propositions de missions</div>
            @for (m of ms; track m.id) {
              <div class="ml" [class.ml--refusee]="m.statut === 'REFUSEE'">
                <button class="lnk" type="button" (click)="ouvrir.emit(m)">{{ m.titre }}</button>
                <span class="badge-mission badge-mission--{{ m.statut }}">{{ libelleStatut(m.statut) }}</span>
                <span class="mono">{{ montant(m.honoraires) }}</span>
                @if (m.dateRelance) {
                  <span class="muted" [class.late]="m.aRelancer"><mat-icon>event</mat-icon>{{ m.dateRelance | date:'dd/MM/yyyy' }}</span>
                }
                @if (m.aRelancer) { <span class="badge-relance">À relancer</span> }
                @if (m.responsable) { <span class="av" [matTooltip]="nomPersonne(m)">{{ initiales(m) }}</span> }
              </div>
            } @empty {
              <div class="muted vide">Aucune mission proposée sur ce cycle.</div>
            }
            @for (r of refuseesDuCycle(c.code); track r.id) {
              <div class="memo">
                <mat-icon>history</mat-icon>
                <span><strong>Déjà refusée en {{ r.anneeRefus }}</strong> — {{ r.titre }} ({{ montant(r.honoraires) }})
                  @if (r.raisonRefus) { <span class="muted">· {{ r.raisonRefus }}</span> }</span>
                @if (peutEcrire) { <button class="b-mini b-mini--ghost" type="button" (click)="reproposer.emit(r)">Reproposer</button> }
              </div>
            }
            @if (peutEcrire) {
              <button class="b-add" type="button" (click)="ajouter.emit(c.code)"><mat-icon>add</mat-icon> Ajouter une mission</button>
            }
          </div>
        </div>
      }
    </section>
  }
</div>
  `,
  styles: [`
    :host { display:block; }
    .intro { display:flex; gap:10px; align-items:flex-start; padding:10px 14px; border-radius:10px; background:#eef2ff; border:1px solid #e0e7ff; color:#3730a3; font-size:12.5px; line-height:1.5; }
    .intro mat-icon { color:#6366f1; flex-shrink:0; }
    .ro { display:flex; align-items:center; gap:8px; margin-top:10px; padding:8px 12px; border-radius:8px; background:#fff7ed; border:1px solid #fed7aa; color:#9a3412; font-size:12.5px; }
    .ro mat-icon { font-size:18px; width:18px; height:18px; }
    .acc { display:flex; flex-direction:column; gap:8px; margin-top:12px; }
    .cy { border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden; }
    .cy--open { border-color:#c7d2fe; box-shadow:0 2px 10px rgba(79,70,229,.08); }
    .cy-h { width:100%; display:flex; align-items:center; gap:10px; padding:10px 14px; border:none; background:transparent; cursor:pointer; text-align:left; font:inherit; color:#0f172a; flex-wrap:wrap; }
    .cy-h:hover { background:#f8fafc; }
    .cy-ic { width:30px; height:30px; border-radius:8px; background:#eef2ff; color:#4f46e5; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .cy-ic mat-icon { font-size:18px; width:18px; height:18px; }
    .cy-code { font-size:11px; font-weight:800; color:#4338ca; background:#e0e7ff; padding:2px 7px; border-radius:6px; }
    .cy-nom { font-weight:700; font-size:13.5px; }
    .cy-sum { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-left:auto; }
    .cy-chev { color:#94a3b8; transition:transform .15s; }
    .cy--open .cy-chev { transform:rotate(180deg); }
    .pill { display:inline-flex; align-items:center; gap:3px; font-size:11px; font-weight:600; color:#94a3b8; background:#f8fafc; border:1px solid #f1f5f9; padding:2px 8px; border-radius:12px; white-space:nowrap; }
    .pill mat-icon { font-size:14px; width:14px; height:14px; }
    .pill--on { color:#334155; background:#fff; border-color:#e2e8f0; }
    .pill--eur { color:#15803d; background:#f0fdf4; border-color:#bbf7d0; font-variant-numeric:tabular-nums; }
    .pill--memo { color:#b91c1c; background:#fef2f2; border-color:#fecaca; }
    .cy-b { padding:4px 16px 16px; border-top:1px solid #f1f5f9; }
    .ex { font-size:12px; color:#64748b; margin:10px 0 4px; font-style:italic; }
    .zone { margin-top:12px; }
    .zone-t { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:800; color:#334155; text-transform:uppercase; letter-spacing:.04em; margin-bottom:6px; }
    .zl { width:20px; height:20px; border-radius:6px; background:#0f172a; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:11px; }
    .ta { width:100%; box-sizing:border-box; border:1px solid #e2e8f0; border-radius:8px; padding:9px 11px; font:inherit; font-size:13px; line-height:1.5; resize:vertical; color:#0f172a; }
    .ta:focus { outline:none; border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.15); }
    .ta:disabled { background:#f8fafc; }
    .zone-f { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:4px; min-height:26px; }
    .ok { display:inline-flex; align-items:center; gap:3px; font-size:11.5px; color:#15803d; }
    .ok mat-icon { font-size:15px; width:15px; height:15px; }
    .muted { color:#94a3b8; font-size:12px; display:inline-flex; align-items:center; gap:3px; }
    .muted mat-icon { font-size:14px; width:14px; height:14px; }
    .late { color:#dc2626; font-weight:700; }
    .vide { padding:6px 0; }
    .ml { display:flex; align-items:center; gap:10px; flex-wrap:wrap; padding:8px 10px; border:1px solid #f1f5f9; border-radius:8px; margin-bottom:6px; background:#fcfcfd; }
    .ml--refusee { opacity:.6; }
    .lnk { border:none; background:none; padding:0; color:#1d4ed8; font:inherit; font-weight:700; font-size:13px; cursor:pointer; text-align:left; }
    .lnk:hover { text-decoration:underline; }
    .mono { font-variant-numeric:tabular-nums; font-size:12.5px; color:#334155; }
    .av { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:50%; background:#e0e7ff; color:#3730a3; font-size:10px; font-weight:800; margin-left:auto; }
    .memo { display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:7px 10px; border-radius:8px; background:#fef2f2; border:1px dashed #fecaca; color:#7f1d1d; font-size:12.5px; margin-bottom:6px; }
    .memo mat-icon { font-size:16px; width:16px; height:16px; color:#dc2626; }
    .b-mini { height:26px; padding:0 10px; border-radius:6px; border:none; background:#4f46e5; color:#fff; font-weight:700; font-size:11.5px; cursor:pointer; font-family:inherit; margin-left:auto; }
    .b-mini--ghost { background:#fff; color:#b91c1c; border:1px solid #fecaca; }
    .b-add { display:inline-flex; align-items:center; gap:5px; margin-top:4px; height:32px; padding:0 12px; border-radius:8px; border:1.5px dashed #c7d2fe; background:#fff; color:#4f46e5; font-weight:700; font-size:12.5px; cursor:pointer; font-family:inherit; }
    .b-add mat-icon { font-size:17px; width:17px; height:17px; }
  `],
})
export class MissionsCyclesComponent {
  @Input() clientId!: number;
  @Input() exerciceId: number | null = null;
  @Input() annee: number | null = null;
  @Input() exerciceClos = false;
  @Input() peutEcrire = false;
  @Input() data: CyclesDossier | null = null;
  @Input() missions: Mission[] = [];
  @Output() ouvrir = new EventEmitter<Mission>();
  @Output() ajouter = new EventEmitter<CodeCycle>();
  @Output() reproposer = new EventEmitter<MissionDejaRefusee>();

  private svc = inject(MissionsService);
  private toast = inject(ToastService);

  get cycles() { return CYCLES_MISSIONS; }
  readonly placeholder = PLACEHOLDER_RECO;
  readonly saving = signal<string | null>(null);
  private readonly ouverts = signal<Set<string>>(new Set());
  /** Texte en cours de saisie, par cycle (absent = identique à l'enregistré). */
  brouillon: Partial<Record<string, string>> = {};

  ouvert(code: string) { return this.ouverts().has(code); }
  basculer(code: string) {
    this.ouverts.update(s => { const n = new Set(s); n.has(code) ? n.delete(code) : n.add(code); return n; });
  }

  texte(code: string): string {
    return this.brouillon[code] ?? this.data?.recommandations?.[code as CodeCycle]?.texte ?? '';
  }
  nbReco(code: string) { return compterRecommandations(this.texte(code)); }
  modifie(code: string) {
    const b = this.brouillon[code];
    return b !== undefined && b !== (this.data?.recommandations?.[code as CodeCycle]?.texte ?? '');
  }

  /** Missions créées depuis ce cycle pendant la révision de l'exercice affiché. */
  missionsDuCycle(code: string): Mission[] {
    return this.missions.filter(m => m.cycle === code && !m.archivee && (m.exerciceId ?? null) === (this.exerciceId ?? null));
  }
  refuseesDuCycle(code: string): MissionDejaRefusee[] {
    return (this.data?.dejaRefusees ?? []).filter(m => m.cycle === code);
  }
  total(ms: Mission[]) { return ms.reduce((a, m) => a + (Number(m.honoraires) || 0), 0); }
  resume(ms: Mission[]) { return resumeStatuts(ms); }
  montant(v: number | null | undefined) { return formatMontant(v); }
  libelleStatut(s: string) { return libelleStatut(s); }
  initiales(m: Mission) { return initialesPersonne(m.responsable); }
  nomPersonne(m: Mission) { return nomPersonne(m.responsable); }

  enregistrer(code: string) {
    if (!this.peutEcrire || !this.modifie(code) || this.saving()) return;
    const texte = this.brouillon[code] ?? '';
    this.saving.set(code);
    this.svc.enregistrerRecommandation(this.clientId, code, this.exerciceId, texte).subscribe({
      next: r => {
        if (this.data) this.data.recommandations = { ...this.data.recommandations, [code]: { texte: r.texte, updatedAt: r.updatedAt } };
        delete this.brouillon[code];
        this.saving.set(null);
      },
      error: (e) => {
        this.saving.set(null);
        this.toast.error(e?.error?.message || "Les recommandations n'ont pas pu être enregistrées");
      },
    });
  }
}
