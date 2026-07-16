import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type TypeCycle = 'VENTE' | 'ACHAT' | 'SOCIAL';

export interface CycleRevision {
  id: number;
  typeCycle: TypeCycle;
  pourcentageCouverture: number;
  diligences: string;
  conclusion: string;
  updatedAt: string;
}

export interface DossierTravail {
  id: number;
  clientId: number;
  exerciceId: number;
  noteSynthese: string;
  cycles: CycleRevision[];
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class DossierTravailService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  private url(clientId: number) {
    return `${this.base}/clients/${clientId}/dossier-travail`;
  }

  get(clientId: number, exerciceId: number) {
    return this.http.get<DossierTravail>(this.url(clientId), { params: { exerciceId } });
  }

  updateNote(clientId: number, exerciceId: number, noteSynthese: string) {
    return this.http.patch<DossierTravail>(`${this.url(clientId)}/note`, { noteSynthese }, { params: { exerciceId } });
  }

  updateCycle(clientId: number, exerciceId: number, type: TypeCycle, data: Partial<CycleRevision>) {
    return this.http.patch<CycleRevision>(`${this.url(clientId)}/cycles/${type}`, data, { params: { exerciceId } });
  }

  queryCycleIa(clientId: number, exerciceId: number, type: TypeCycle, question: string) {
    return this.http.post(
      `${this.url(clientId)}/cycles/${type}/ia`,
      { question },
      { params: { exerciceId }, responseType: 'text', observe: 'events', reportProgress: true },
    );
  }
}
