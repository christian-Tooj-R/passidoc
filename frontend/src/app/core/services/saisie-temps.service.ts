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

export interface RapportRow { [key: string]: any; }

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

@Injectable({ providedIn: 'root' })
export class TimerService {
  private readonly LS_KEY     = 'st_timer';
  private readonly LS_CTX_KEY = 'st_timer_task_ctx';

  isRunning      = signal(false);
  startedAt      = signal<number | null>(null);   // timestamp ms
  elapsedSec     = signal(0);
  activeTaskCtx  = signal<ActiveTaskCtx | null>(null);

  displayTime$ = computed(() => {
    const s = this.elapsedSec();
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '00');
    return `${hh}:${mm}:${ss}`;
  });

  private _intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this._restore();
  }

  start() {
    const now = Date.now();
    this.startedAt.set(now);
    this.isRunning.set(true);
    this._persist();
    this._startTick();
  }

  startWithTask(ctx: ActiveTaskCtx) {
    this.activeTaskCtx.set(ctx);
    try { localStorage.setItem(this.LS_CTX_KEY, JSON.stringify(ctx)); } catch {}
    this.start();
  }

  stop(): number {
    const elapsed = this.elapsedSec();
    this._stopTick();
    this.isRunning.set(false);
    this.startedAt.set(null);
    this.elapsedSec.set(0);
    this.activeTaskCtx.set(null);
    this._clear();
    try { localStorage.removeItem(this.LS_CTX_KEY); } catch {}
    return elapsed / 3600;   // retourne les heures
  }

  get displayTime(): string {
    const s = this.elapsedSec();
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
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
      localStorage.setItem(this.LS_KEY, JSON.stringify({ startedAt: this.startedAt() }));
    } catch {}
  }

  private _clear() {
    try { localStorage.removeItem(this.LS_KEY); } catch {}
  }

  private _restore() {
    try {
      const raw = localStorage.getItem(this.LS_KEY);
      if (!raw) return;
      const { startedAt } = JSON.parse(raw) as { startedAt: number };
      if (startedAt) {
        this.startedAt.set(startedAt);
        this.isRunning.set(true);
        this.elapsedSec.set(Math.floor((Date.now() - startedAt) / 1000));
        this._startTick();
      }
      const rawCtx = localStorage.getItem(this.LS_CTX_KEY);
      if (rawCtx) this.activeTaskCtx.set(JSON.parse(rawCtx));
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

  getRapports(type: 'collaborateur' | 'client' | 'semaine', debut: string, fin: string): Observable<RapportRow[]> {
    return this.http.get<RapportRow[]>(`${this.api}/rapports`, { params: { type, debut, fin } });
  }

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

  getTenant(params: { dateDebut?: string; dateFin?: string; collaborateurId?: number; clientId?: number }): Observable<SaisieTemps[]> {
    const p: Record<string, string> = {};
    if (params.dateDebut)       p['debut']           = params.dateDebut;
    if (params.dateFin)         p['fin']             = params.dateFin;
    return this.http.get<SaisieTemps[]>(`${this.api}/tenant`, { params: p });
  }
}
