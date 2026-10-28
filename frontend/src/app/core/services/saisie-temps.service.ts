import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export type TypeTemps = 'FACTURABLE' | 'NON_FACTURABLE';
export type CategorieNonFacturable = 'APPEL_CLIENT' | 'REUNION_INTERNE' | 'FORMATION' | 'ADMINISTRATIF' | 'AUTRE';
export type MissionCode = 'TCO' | 'REV' | 'FISC' | 'SOC' | 'JUR' | 'CON' | 'FORM' | 'ADM';

export const MISSION_CODES: { code: MissionCode; label: string; color: string; bg: string }[] = [
  { code: 'TCO',  label: 'Tenue comptabilité',     color: '#1d4ed8', bg: '#dbeafe' },
  { code: 'REV',  label: 'Révision des comptes',   color: '#7c3aed', bg: '#ede9fe' },
  { code: 'FISC', label: 'Déclarations fiscales',  color: '#c2410c', bg: '#ffedd5' },
  { code: 'SOC',  label: 'Social / Paie',           color: '#15803d', bg: '#dcfce7' },
  { code: 'JUR',  label: 'Juridique',               color: '#dc2626', bg: '#fee2e2' },
  { code: 'CON',  label: 'Conseil',                 color: '#6366f1', bg: '#eef2ff' },
  { code: 'FORM', label: 'Formation',               color: '#0e7490', bg: '#cffafe' },
  { code: 'ADM',  label: 'Administration cabinet',  color: '#475569', bg: '#f1f5f9' },
];

export { LIEUX_TRAVAIL, lieuTravail } from '../models/lieu-travail';
export type { LieuTravail } from '../models/lieu-travail';
import type { LieuTravail } from '../models/lieu-travail';

export interface SaisieTemps {
  id: number;
  date: string;
  dureeHeures: number;
  type: TypeTemps;
  categorie?: CategorieNonFacturable;
  missionCode?: MissionCode;
  dossierId?: number;
  commentaire?: string;
  clientId?: number;
  client?: { id: number; nom: string };
  collaborateurId: number;
  tenantId: number;
  isLocked?: boolean;
  lockedAt?: string;
  lockedBy?: string;
  heureDebut?: string;
  heureFin?: string;
  /** Affaire = exercice du dossier (« C2026-09 »), attribuée automatiquement côté serveur. */
  affaire?: string | null;
  /** Prix de vente horaire du collaborateur figé au moment de la saisie. */
  tauxHoraire?: number | null;
  /** Pôle de travail (cahier v2 #5) — défaut serveur : site du collaborateur. */
  lieuTravail?: LieuTravail | null;
  collaborateur?: { id: number; firstName: string; lastName: string; site?: string };
}

export interface CreateSaisieTempsDto {
  date: string;
  dureeHeures: number;
  type: TypeTemps;
  categorie?: CategorieNonFacturable;
  missionCode?: string;
  dossierId?: number;
  commentaire?: string;
  clientId?: number;
  heureDebut?: string;
  heureFin?: string;
  /** Absente = conservée/automatique ; null = recalcul automatique. */
  affaire?: string | null;
  /** Absent = site du collaborateur (création) ou inchangé (modification). */
  lieuTravail?: LieuTravail | null;
  /** Tâche chronométrée dont provient ce temps : évite de le saisir à nouveau quand la tâche
   *  se termine (saisie automatique côté serveur). */
  taskId?: number | null;
}

export interface RatioSemaine {
  semaine: string;
  totalHeures: number;
  heuresFacturables: number;
  heuresNonFacturables: number;
  ratioNonFacturablePct: number;
  alerteTotal: boolean;
  alerteRatio: boolean;
}

export interface BudgetMission {
  id: number;
  clientId: number;
  missionCode: string;
  annee: number;
  heuresBudget: number;
}

/** Ligne du rapport « Détail des temps passés » (format Tempolia). */
export interface LigneRapportDetail {
  id: number;
  source: 'SAISIE' | 'ABSENCE';
  date: string;
  collaborateurId: number;
  collaborateur: string;
  presence: 'FACTURABLE' | 'NON_FACTURABLE' | 'ABSENCE';
  clientId: number | null;
  client: string | null;
  /** « Client / TNF » : le client, sinon la catégorie de temps non facturable / d'absence. */
  clientTnf: string;
  affaire: string | null;
  affaireEtat: 'O' | 'C' | null;
  missionCode: string | null;
  categorie: string | null;
  libelle: string | null;
  dureeHeures: number;
  tauxHoraire: number | null;
  tauxFige: boolean;
  pv: number;
  heureDebut: string | null;
  heureFin: string | null;
  isLocked: boolean;
  /** Pôle de travail ; null pour une absence. */
  lieuTravail?: LieuTravail | null;
}

export interface AffaireInfo {
  code: string;
  dateOuverture: string;
  dateCloture: string;
  etat: 'O' | 'C';
  source: 'EXERCICE' | 'CALCUL';
}

export type StatutBudget = 'NON_BUDGETE' | 'OK' | 'ATTENTION' | 'DEPASSE';

export interface IndicateursRentabilite {
  clientId: number;
  client: string;
  site: string | null;
  intervenants: { directeur: string | null; responsable: string | null; collaborateurOuest: string | null };
  affaire: string;
  etat: 'O' | 'C';
  dateOuverture: string;
  dateCloture: string;
  budgetId: number | null;
  honoraires: number | null;
  honorairesSource: 'BUDGET' | 'FICHE' | null;
  heuresBudget: number | null;
  prixVenteHoraire: number | null;
  prixVenteCalcule: boolean;
  heuresConsommees: number;
  heuresRestantes: number | null;
  tauxConsommation: number | null;
  statut: StatutBudget;
  montantRealise: number | null;
  boniMali: number | null;
  boniMaliPct: number | null;
  valorisation: number | null;
  margeValorisation: number | null;
}

export interface TableauRentabilite {
  annee: number;
  voirValorisation: boolean;
  lignes: IndicateursRentabilite[];
  totaux: {
    honoraires: number; heuresBudget: number; heuresConsommees: number; montantRealise: number;
    boniMali: number; valorisation: number | null; margeValorisation: number | null;
    dossiersDepasses: number; dossiersAttention: number;
  };
}

export interface RentabiliteDossier {
  client: { id: number; nom: string };
  affaire: string;
  affaires: AffaireInfo[];
  indicateurs: IndicateursRentabilite;
  historique: IndicateursRentabilite[];
  heuresHorsBudget: number;
  parMission: { missionCode: string; heures: number }[];
  parMois: { mois: string; heures: number }[];
  parCollaborateur: { collaborateurId: number; collaborateur: string; heures: number; valorisation: number }[] | null;
  peutModifierBudget: boolean;
  voirValorisation: boolean;
  missionsHorsBudget: string[];
  seuilAttention: number;
}

export interface BudgetDossierInput {
  affaire: string;
  heuresBudget: number;
  honoraires?: number | null;
  prixVenteHoraire?: number | null;
}

export interface PlanningRow {
  collaborateurId: number;
  collaborateurNom: string;
  date: string;
  totalHeures: number;
}

/* ────────────────────────────────────────────────────────────────────────────
   TimerService inline — persisté via localStorage, signal Angular
   ──────────────────────────────────────────────────────────────────────────── */
export interface ActiveTaskCtx {
  taskId: number;
  clientId?: number;
  clientNom?: string;
  taskTitre: string;
}

export type TimerStatus = 'idle' | 'running' | 'paused';

@Injectable({ providedIn: 'root' })
export class TimerService {
  private readonly LS_KEY        = 'st_timer';
  private readonly LS_CTX_KEY    = 'st_timer_task_ctx';
  private readonly LS_PAUSED_KEY = 'st_timer_paused_tasks';

  status         = signal<TimerStatus>('idle');
  isRunning      = computed(() => this.status() === 'running');
  isPaused       = computed(() => this.status() === 'paused');
  startedAt      = signal<number | null>(null);   // timestamp ms — recalé à chaque reprise
  elapsedSec     = signal(0);
  activeTaskCtx  = signal<ActiveTaskCtx | null>(null);
  /** Tâches actuellement en pause (temps accumulé conservé pour une reprise ultérieure),
   *  indexées par taskId — permet de basculer le minuteur d'une tâche à l'autre sans perdre
   *  le temps déjà passé sur celle qu'on quitte (lien Kanban : EN_COURS ⇄ EN_PAUSE). */
  pausedTasks    = signal<Record<number, { elapsedSec: number; ctx: ActiveTaskCtx }>>({});

  displayTime$ = computed(() => this._format(this.elapsedSec()));

  private _intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this._restore();
  }

  /** Minuteur générique sans tâche liée (bouton "Démarrer" de la sidebar Travail). */
  start() {
    if (this.status() === 'running' && this.activeTaskCtx()) {
      // Un minuteur de tâche tournait : on le met en pause avant de démarrer le générique.
      this._freezeAsPaused(this.activeTaskCtx()!);
    }
    this.activeTaskCtx.set(null);
    this._persistCtx();
    this._resumeFrom(0);
  }

  /**
   * Démarre (ou reprend) le minuteur sur une tâche. Si une AUTRE tâche était en cours, elle
   * bascule automatiquement en pause — son temps accumulé est conservé et elle repart d'où
   * elle en était à la prochaine reprise. Renvoie le contexte de la tâche ainsi mise en pause
   * (ou null) pour que l'appelant puisse répercuter le changement de statut Kanban côté API.
   */
  startWithTask(ctx: ActiveTaskCtx): { pausedPrevious: ActiveTaskCtx | null } {
    const current = this.activeTaskCtx();

    // Déjà la tâche active (en cours ou en pause) : simple reprise, on ne touche pas à
    // pausedTasks pour éviter d'écraser le temps déjà accumulé par une valeur périmée.
    if (current && current.taskId === ctx.taskId) {
      if (this.status() === 'paused') this._resumeFrom(this.elapsedSec());
      return { pausedPrevious: null };
    }

    let pausedPrevious: ActiveTaskCtx | null = null;
    if (this.status() === 'running' && current) {
      this._freezeAsPaused(current);
      pausedPrevious = current;
    }
    const already = this.pausedTasks()[ctx.taskId];
    const startSec = already ? already.elapsedSec : 0;
    if (already) {
      this.pausedTasks.update(m => { const n = { ...m }; delete n[ctx.taskId]; return n; });
      this._persistPaused();
    }
    this.activeTaskCtx.set(ctx);
    this._persistCtx();
    this._resumeFrom(startSec);
    return { pausedPrevious };
  }

  /** Met en pause le minuteur actif — conserve le temps déjà accumulé (ne le remet pas à zéro). */
  pause() {
    if (this.status() !== 'running') return;
    const ctx = this.activeTaskCtx();
    if (ctx) {
      this._freezeAsPaused(ctx);
    } else {
      this._stopTick();
      this.status.set('paused');
      this.startedAt.set(null);
      this._persist();
    }
  }

  /** Reprend le minuteur actuellement en pause, à partir du temps déjà accumulé. */
  resume() {
    if (this.status() !== 'paused') return;
    this._resumeFrom(this.elapsedSec());
  }

  /**
   * Abandonne le minuteur d'une tâche dont le temps vient d'être saisi automatiquement (tâche
   * terminée) : arrêt s'il est actif sur cette tâche, oubli de son temps s'il était en pause.
   */
  oublierTache(taskId: number) {
    if (this.activeTaskCtx()?.taskId === taskId) {
      this.stop();
      return;
    }
    if (this.pausedTasks()[taskId]) {
      this.pausedTasks.update(m => { const n = { ...m }; delete n[taskId]; return n; });
      this._persistPaused();
    }
  }

  /** Arrête définitivement et renvoie la durée en heures — comportement historique inchangé. */
  stop(): number {
    const elapsed = this.elapsedSec();
    const ctx = this.activeTaskCtx();
    this._stopTick();
    this.status.set('idle');
    this.startedAt.set(null);
    this.elapsedSec.set(0);
    this.activeTaskCtx.set(null);
    if (ctx && this.pausedTasks()[ctx.taskId]) {
      this.pausedTasks.update(m => { const n = { ...m }; delete n[ctx.taskId]; return n; });
      this._persistPaused();
    }
    this._clear();
    try { localStorage.removeItem(this.LS_CTX_KEY); } catch {}
    return elapsed / 3600;   // retourne les heures
  }

  get displayTime(): string {
    return this._format(this.elapsedSec());
  }

  private _format(s: number): string {
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  private _freezeAsPaused(ctx: ActiveTaskCtx) {
    this._stopTick();
    this.pausedTasks.update(m => ({ ...m, [ctx.taskId]: { elapsedSec: this.elapsedSec(), ctx } }));
    this._persistPaused();
    this.status.set('paused');
    this.startedAt.set(null);
    this._persist();
  }

  /** Redémarre le tick à partir d'un nombre de secondes déjà accumulées (0 pour un vrai départ). */
  private _resumeFrom(sec: number) {
    const now = Date.now();
    this.elapsedSec.set(sec);
    this.startedAt.set(now - sec * 1000);
    this.status.set('running');
    this._persist();
    this._startTick();
  }

  private _startTick() {
    this._stopTick();
    const base = this.startedAt()!;
    this._intervalId = setInterval(() => {
      this.elapsedSec.set(Math.floor((Date.now() - base) / 1000));
    }, 1000);
  }

  private _stopTick() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  private _persist() {
    try {
      localStorage.setItem(this.LS_KEY, JSON.stringify({
        startedAt: this.startedAt(), status: this.status(), elapsedSec: this.elapsedSec(),
      }));
    } catch {}
  }

  private _persistCtx() {
    try {
      const ctx = this.activeTaskCtx();
      if (ctx) localStorage.setItem(this.LS_CTX_KEY, JSON.stringify(ctx));
      else localStorage.removeItem(this.LS_CTX_KEY);
    } catch {}
  }

  private _persistPaused() {
    try { localStorage.setItem(this.LS_PAUSED_KEY, JSON.stringify(this.pausedTasks())); } catch {}
  }

  private _clear() {
    try { localStorage.removeItem(this.LS_KEY); } catch {}
  }

  private _restore() {
    try {
      const raw = localStorage.getItem(this.LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { startedAt: number | null; status?: TimerStatus; elapsedSec?: number };
        if (parsed.status === 'paused') {
          this.status.set('paused');
          this.elapsedSec.set(parsed.elapsedSec ?? 0);
        } else if (parsed.startedAt) {
          this.status.set('running');
          this.startedAt.set(parsed.startedAt);
          this.elapsedSec.set(Math.floor((Date.now() - parsed.startedAt) / 1000));
          this._startTick();
        }
      }
      const rawCtx = localStorage.getItem(this.LS_CTX_KEY);
      if (rawCtx) this.activeTaskCtx.set(JSON.parse(rawCtx));
      const rawPaused = localStorage.getItem(this.LS_PAUSED_KEY);
      if (rawPaused) this.pausedTasks.set(JSON.parse(rawPaused));
    } catch {}
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   SaisieTempsService
   ──────────────────────────────────────────────────────────────────────────── */
@Injectable({ providedIn: 'root' })
export class SaisieTempsService {
  private readonly api = `${environment.apiUrl}/saisies-temps`;

  constructor(private http: HttpClient) {}

  create(dto: CreateSaisieTempsDto): Observable<SaisieTemps> {
    return this.http.post<SaisieTemps>(this.api, dto);
  }

  update(id: number, dto: Partial<CreateSaisieTempsDto>): Observable<SaisieTemps> {
    return this.http.patch<SaisieTemps>(`${this.api}/${id}`, dto);
  }

  getMes(): Observable<SaisieTemps[]> {
    return this.http.get<SaisieTemps[]>(`${this.api}/moi`);
  }

  getRatioSemaine(lundi?: string): Observable<any> {
    if (lundi) {
      return this.http.get<any>(`${this.api}/ratio-semaine`, { params: { lundi } });
    }
    return this.http.get<any>(`${this.api}/ratio-semaine`);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  // ── Nouvelles méthodes ──────────────────────────────────────────────────

  getPlanning(debut: string, fin: string): Observable<PlanningRow[]> {
    return this.http.get<PlanningRow[]>(`${this.api}/planning`, { params: { debut, fin } });
  }

  validerPeriode(semaine: number, annee: number, collaborateurId: number): Observable<{ locked: number }> {
    return this.http.post<{ locked: number }>(`${this.api}/valider-periode`, { semaine, annee, collaborateurId });
  }

  getBudgets(clientId: number, annee: number): Observable<BudgetMission[]> {
    return this.http.get<BudgetMission[]>(`${this.api}/budgets`, { params: { clientId, annee } });
  }

  createBudget(data: { clientId: number; missionCode: string; annee: number; heuresBudget: number }): Observable<BudgetMission> {
    return this.http.post<BudgetMission>(`${this.api}/budgets`, data);
  }

  // ── Nouvelles vues rapport Travail ──────────────────────────────────────────

  getRapportJour(params: { dateDebut?: string; dateFin?: string; collaborateurId?: number; clientId?: number }): Observable<any[]> {
    const p: Record<string, string> = {};
    if (params.dateDebut)       p['dateDebut']       = params.dateDebut;
    if (params.dateFin)         p['dateFin']         = params.dateFin;
    if (params.collaborateurId) p['collaborateurId'] = String(params.collaborateurId);
    if (params.clientId)        p['clientId']        = String(params.clientId);
    return this.http.get<any[]>(`${this.api}/rapport/jour`, { params: p });
  }

  getRapportSemaine(params: { dateDebut?: string; dateFin?: string; collaborateurId?: number }): Observable<any[]> {
    const p: Record<string, string> = {};
    if (params.dateDebut)       p['dateDebut']       = params.dateDebut;
    if (params.dateFin)         p['dateFin']         = params.dateFin;
    if (params.collaborateurId) p['collaborateurId'] = String(params.collaborateurId);
    return this.http.get<any[]>(`${this.api}/rapport/semaine`, { params: p });
  }

  getRapportMois(params: { dateDebut?: string; dateFin?: string; collaborateurId?: number }): Observable<any[]> {
    const p: Record<string, string> = {};
    if (params.dateDebut)       p['dateDebut']       = params.dateDebut;
    if (params.dateFin)         p['dateFin']         = params.dateFin;
    if (params.collaborateurId) p['collaborateurId'] = String(params.collaborateurId);
    return this.http.get<any[]>(`${this.api}/rapport/mois`, { params: p });
  }

  /** Détail des temps façon Tempolia — saisies + absences, valorisées au PV collaborateur. */
  getRapportDetail(params: { dateDebut?: string; dateFin?: string; collaborateurIds?: number[]; clientIds?: number[]; absences?: boolean }): Observable<{ lignes: LigneRapportDetail[] }> {
    const p: Record<string, string> = {};
    if (params.dateDebut)                p['dateDebut']        = params.dateDebut;
    if (params.dateFin)                  p['dateFin']          = params.dateFin;
    if (params.collaborateurIds?.length) p['collaborateurIds'] = params.collaborateurIds.join(',');
    if (params.clientIds?.length)        p['clientIds']        = params.clientIds.join(',');
    if (params.absences === false)       p['absences']         = 'false';
    return this.http.get<{ lignes: LigneRapportDetail[] }>(`${this.api}/rapport/detail`, { params: p });
  }

  getAffaires(clientId: number): Observable<AffaireInfo[]> {
    return this.http.get<AffaireInfo[]>(`${this.api}/affaires`, { params: { clientId } });
  }

  getRentabilite(params: { annee?: number; collaborateurId?: number }): Observable<TableauRentabilite> {
    const p: Record<string, string> = {};
    if (params.annee)           p['annee']           = String(params.annee);
    if (params.collaborateurId) p['collaborateurId'] = String(params.collaborateurId);
    return this.http.get<TableauRentabilite>(`${this.api}/rentabilite`, { params: p });
  }

  getRentabiliteDossier(clientId: number, affaire?: string): Observable<RentabiliteDossier> {
    const p: Record<string, string> = affaire ? { affaire } : {};
    return this.http.get<RentabiliteDossier>(`${this.api}/rentabilite/dossier/${clientId}`, { params: p });
  }

  saveBudgetDossier(clientId: number, data: BudgetDossierInput): Observable<unknown> {
    return this.http.post(`${this.api}/rentabilite/dossier/${clientId}/budget`, data);
  }

  deleteBudgetDossier(clientId: number, affaire: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/rentabilite/dossier/${clientId}/budget/${affaire}`);
  }

  getTenant(params: { dateDebut?: string; dateFin?: string; collaborateurId?: number; clientId?: number }): Observable<SaisieTemps[]> {
    const p: Record<string, string> = {};
    if (params.dateDebut)       p['debut']           = params.dateDebut;
    if (params.dateFin)         p['fin']             = params.dateFin;
    if (params.collaborateurId) p['collaborateurId'] = String(params.collaborateurId);
    return this.http.get<SaisieTemps[]>(`${this.api}/tenant`, { params: p });
  }
}
