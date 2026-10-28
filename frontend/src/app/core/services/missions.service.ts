import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  CyclesDossier, FiltresMissionsCabinet, HistoriqueStatut, Mission, StatutMission, SyntheseMissions, TableauMissionsCabinet,
} from '../models/mission.model';

export type { Mission } from '../models/mission.model';

/** Champs modifiables d'une mission (création ou mise à jour). */
export interface MissionSaisie {
  titre?: string;
  description?: string | null;
  honoraires?: number | null;
  statut?: StatutMission;
  dateRelance?: string | null;
  responsableId?: number | null;
  cycle?: string | null;
  exerciceId?: number | null;
  annee?: number;
  type?: string;
  arguments?: string;
  raisonRefus?: string;
  archivee?: boolean;
  repriseDeId?: number;
}

@Injectable({ providedIn: 'root' })
export class MissionsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;
  private url = (clientId: number) => `${this.base}/clients/${clientId}/missions`;

  getAll(clientId: number) {
    return this.http.get<Mission[]>(this.url(clientId));
  }

  synthese(clientId: number) {
    return this.http.get<SyntheseMissions>(`${this.url(clientId)}/synthese`);
  }

  cycles(clientId: number, exerciceId: number | null) {
    const params = exerciceId ? new HttpParams().set('exerciceId', exerciceId) : undefined;
    return this.http.get<CyclesDossier>(`${this.url(clientId)}/cycles`, { params });
  }

  enregistrerRecommandation(clientId: number, cycle: string, exerciceId: number | null, texte: string) {
    return this.http.patch<{ cycle: string; texte: string; updatedAt: string }>(
      `${this.url(clientId)}/cycles/${cycle}/recommandation`, { exerciceId, texte });
  }

  create(clientId: number, data: MissionSaisie) {
    return this.http.post<Mission>(this.url(clientId), data);
  }

  update(clientId: number, id: number, data: MissionSaisie) {
    return this.http.patch<Mission>(`${this.url(clientId)}/${id}`, data);
  }

  delete(clientId: number, id: number) {
    return this.http.delete(`${this.url(clientId)}/${id}`);
  }

  historique(clientId: number, id: number) {
    return this.http.get<HistoriqueStatut[]>(`${this.url(clientId)}/${id}/historique`);
  }

  /** Vue cabinet (menu Missions) : filtres appliqués côté serveur. */
  tableauCabinet(f: FiltresMissionsCabinet = {}) {
    let params = new HttpParams();
    if (f.statuts?.length) params = params.set('statuts', f.statuts.join(','));
    if (f.responsableId) params = params.set('responsableId', f.responsableId);
    if (f.cycle) params = params.set('cycle', f.cycle);
    if (f.tranche) params = params.set('tranche', f.tranche);
    if (f.relance) params = params.set('relance', f.relance);
    if (f.secteur) params = params.set('secteur', f.secteur);
    if (f.avecMontant) params = params.set('avecMontant', 'true');
    if (f.inclureArchivees) params = params.set('inclureArchivees', 'true');
    return this.http.get<TableauMissionsCabinet>(`${this.base}/missions`, { params });
  }
}
