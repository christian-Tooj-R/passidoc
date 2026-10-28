import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin } from 'rxjs';
import { MissionsService } from '../../../../../core/services/missions.service';
import { AuthService } from '../../../../../core/services/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { CodeCycle, CyclesDossier, Mission, MissionDejaRefusee, StatutMission, SyntheseMissions } from '../../../../../core/models/mission.model';
import { Exercice } from '../../../../../core/models/client.model';
import { MissionsCyclesComponent } from './missions-cycles.component';
import { MissionsPipelineComponent } from './missions-pipeline.component';
import { MissionFormData, MissionFormDialogComponent } from './mission-form-dialog.component';

export interface PrefillMission { titre: string; type: string; description: string; arguments: string }

/**
 * Module Missions du dossier (CDC « Module Missions — restructuration », 19/10/2026) :
 * fusion de l'ancien Dossier de travail (révision par cycle) et de l'ancien module Mission,
 * en deux onglets — « Par cycle » et « Pipeline missions ».
 *
 * Droits (CDC §7) : intervenants du dossier, ADMIN et EXPERT_COMPTABLE en écriture ; le
 * pipeline est en lecture seule pour un COLLABORATEUR, tout le module pour le gérant de pôle
 * et lors de la consultation d'un exercice clôturé.
 */
@Component({
  selector: 'app-missions-tab',
  standalone: true,
  imports: [CommonModule, MatIconModule, MissionsCyclesComponent, MissionsPipelineComponent],
  template: `
<div class="mt">
  <div class="mt-head">
    <div class="mt-tabs" role="tablist">
      <button role="tab" type="button" class="mt-tab" [class.mt-tab--on]="vue() === 'cycles'" [attr.aria-selected]="vue() === 'cycles'" (click)="vue.set('cycles')">
        <mat-icon>account_tree</mat-icon> Par cycle
        <span class="cnt">{{ nbMissionsCycles() }}</span>
      </button>
      <button role="tab" type="button" class="mt-tab" [class.mt-tab--on]="vue() === 'pipeline'" [attr.aria-selected]="vue() === 'pipeline'" (click)="vue.set('pipeline')">
        <mat-icon>view_kanban</mat-icon> Pipeline missions
        <span class="cnt">{{ synthese()?.total ?? 0 }}</span>
      </button>
    </div>
    <div class="mt-ctx">
      @if (exercice) { Exercice {{ exercice.annee }}{{ exercice.statut === 'CLOTURE' ? ' (clôturé)' : '' }} }
      @if (lectureSeule()) { <span class="ro"><mat-icon>visibility</mat-icon> Lecture seule</span> }
    </div>
  </div>

  @if (chargement()) {
    <div class="vide"><mat-icon class="spin">sync</mat-icon> Chargement…</div>
  } @else if (vue() === 'cycles') {
    <app-missions-cycles
      [clientId]="clientId" [exerciceId]="exercice?.id ?? null" [annee]="exercice?.annee ?? null"
      [exerciceClos]="exercice?.statut === 'CLOTURE'" [peutEcrire]="peutEcrireCycles()"
      [data]="cycles()" [missions]="missions()"
      (ouvrir)="ouvrir($event, true)" (ajouter)="nouvelle($event)" (reproposer)="reproposer($event)" />
  } @else {
    <app-missions-pipeline
      [missions]="missions()" [synthese]="synthese()" [peutEcrire]="peutEcrirePipeline()"
      (ouvrir)="ouvrir($event, false)" (nouvelle)="nouvelle(null)" (changerStatut)="changerStatut($event.mission, $event.statut)" />
  }
</div>
  `,
  styles: [`
    .mt { padding: 4px 0 24px; }
    .mt-head { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
    .mt-tabs { display:inline-flex; gap:4px; padding:4px; background:#f1f5f9; border-radius:12px; }
    .mt-tab { display:inline-flex; align-items:center; gap:6px; height:36px; padding:0 14px; border:none; border-radius:9px; background:transparent; color:#475569; font:inherit; font-size:13px; font-weight:700; cursor:pointer; }
    .mt-tab mat-icon { font-size:18px; width:18px; height:18px; }
    .mt-tab--on { background:#fff; color:#4f46e5; box-shadow:0 1px 4px rgba(15,23,42,.1); }
    .cnt { min-width:20px; height:20px; padding:0 6px; border-radius:10px; background:#e2e8f0; color:#334155; font-size:11px; display:inline-flex; align-items:center; justify-content:center; }
    .mt-tab--on .cnt { background:#e0e7ff; color:#4338ca; }
    .mt-ctx { display:flex; align-items:center; gap:10px; font-size:12.5px; color:#64748b; font-weight:600; }
    .ro { display:inline-flex; align-items:center; gap:4px; padding:2px 9px; border-radius:10px; background:#f1f5f9; color:#475569; font-size:11.5px; }
    .ro mat-icon { font-size:14px; width:14px; height:14px; }
    .vide { display:flex; align-items:center; justify-content:center; gap:8px; padding:40px; color:#94a3b8; }
    .spin { animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
  `],
})
export class MissionsTabComponent implements OnInit, OnChanges {
  @Input() clientId!: number;
  @Input() exercice: Exercice | null = null;
  /** Intervenant du dossier, ADMIN ou EXPERT_COMPTABLE (cf. client-detail canEdit). */
  @Input() canEdit = false;
  @Input() utilisateurs: { id: number; firstName: string; lastName: string; isActive?: boolean }[] = [];
  /** Mission pré-remplie depuis le Contrôle interne : ouvre la saisie dans le pipeline. */
  @Input() prefill: PrefillMission | null = null;
  @Output() prefillUsed = new EventEmitter<void>();

  private svc = inject(MissionsService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  readonly vue = signal<'cycles' | 'pipeline'>('cycles');
  readonly missions = signal<Mission[]>([]);
  readonly synthese = signal<SyntheseMissions | null>(null);
  readonly cycles = signal<CyclesDossier | null>(null);
  readonly chargement = signal(true);
  private readonly exerciceSig = signal<Exercice | null>(null);
  private readonly canEditSig = signal(false);

  private readonly gerant = computed(() => this.auth.isGerantOuest());
  /** Consultation d'un exercice clôturé : tout le dossier est en lecture seule (comme les
   *  autres onglets) ; le suivi des missions continue depuis l'exercice en cours. */
  private readonly exerciceClos = computed(() => this.exerciceSig()?.statut === 'CLOTURE');
  readonly peutEcrireCycles = computed(() => this.canEditSig() && !this.gerant() && !this.exerciceClos());
  readonly peutEcrirePipeline = computed(() => this.canEditSig() && !this.gerant() && !this.auth.isCollaborateur() && !this.exerciceClos());
  readonly lectureSeule = computed(() => !this.peutEcrireCycles() && !this.peutEcrirePipeline());
  readonly nbMissionsCycles = computed(() => {
    const exId = this.exerciceSig()?.id ?? null;
    return this.missions().filter(m => m.cycle && !m.archivee && (m.exerciceId ?? null) === exId).length;
  });

  ngOnInit() { this.charger(); }

  ngOnChanges(ch: SimpleChanges) {
    this.exerciceSig.set(this.exercice);
    this.canEditSig.set(this.canEdit);
    if (ch['exercice'] && !ch['exercice'].firstChange) this.charger();
    if (ch['prefill'] && this.prefill) this.ouvrirPrefill(this.prefill);
  }

  charger() {
    if (!this.clientId) return;
    forkJoin({
      missions: this.svc.getAll(this.clientId),
      synthese: this.svc.synthese(this.clientId),
      cycles: this.svc.cycles(this.clientId, this.exercice?.id ?? null),
    }).subscribe({
      next: r => { this.missions.set(r.missions); this.synthese.set(r.synthese); this.cycles.set(r.cycles); this.chargement.set(false); },
      error: () => { this.chargement.set(false); this.toast.error('Chargement des missions impossible'); },
    });
  }

  private donnees(extra: Partial<MissionFormData>): MissionFormData {
    return {
      clientId: this.clientId,
      exerciceId: this.exercice?.id ?? null,
      annee: this.exercice?.annee ?? null,
      utilisateurs: this.utilisateurs,
      peutEcrire: false,
      cycleModifiable: false,
      ...extra,
    };
  }

  private ouvrirDialogue(data: MissionFormData) {
    this.dialog.open(MissionFormDialogComponent, { data, width: '720px', maxWidth: '96vw', autoFocus: 'first-tabbable' })
      .afterClosed().subscribe(r => { if (r) this.charger(); });
  }

  /** Détail / modification. Depuis « Par cycle », le cycle d'origine reste figé. */
  ouvrir(m: Mission, depuisCycle: boolean) {
    const peutEcrire = m.cycle ? (this.peutEcrireCycles() || this.peutEcrirePipeline()) : this.peutEcrirePipeline();
    this.ouvrirDialogue(this.donnees({ mission: m, peutEcrire, cycleModifiable: !depuisCycle && this.peutEcrirePipeline() }));
  }

  /** Nouvelle mission : depuis un cycle (zone B) ou hors cycle (pipeline). */
  nouvelle(cycle: CodeCycle | null, prefill?: MissionFormData['prefill']) {
    this.ouvrirDialogue(this.donnees({
      cycle,
      peutEcrire: cycle ? this.peutEcrireCycles() : this.peutEcrirePipeline(),
      cycleModifiable: !cycle,
      prefill,
    }));
  }

  /** R5 : reproposer cette année une mission refusée lors d'un exercice antérieur. */
  reproposer(r: MissionDejaRefusee) {
    this.nouvelle(r.cycle as CodeCycle, {
      titre: r.titre, description: r.description ?? '', honoraires: r.honoraires, repriseDeId: r.id,
    });
  }

  changerStatut(m: Mission, statut: StatutMission) {
    if (statut === m.statut) return;
    // Mise à jour immédiate de la liste : une fiche ouverte avant la fin du rechargement
    // ne doit pas afficher (puis renvoyer à l'enregistrement) l'ancien statut.
    this.missions.update(ms => ms.map(x => x.id === m.id ? { ...x, statut } : x));
    this.svc.update(this.clientId, m.id, { statut }).subscribe({
      next: () => { this.toast.success(`Statut mis à jour`); this.charger(); },
      error: (e) => { this.toast.error(e?.error?.message || 'Modification refusée'); this.charger(); },
    });
  }

  private ouvrirPrefill(p: PrefillMission) {
    this.vue.set('pipeline');
    this.nouvelle(null, { titre: p.titre, description: p.description, arguments: p.arguments });
    this.prefillUsed.emit();
  }
}
