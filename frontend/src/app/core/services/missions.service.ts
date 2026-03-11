import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Mission {
  id?: number;
  type: 'REALISEE' | 'REFUSEE' | 'DETECTEE' | 'IA';
  titre: string;
  description?: string;
  honoraires?: number;
  arguments?: string;
  raisonRefus?: string;
  annee?: number;
  isProposee?: boolean;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class MissionsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getAll(clientId: number) {
    return this.http.get<Mission[]>(`${this.base}/clients/${clientId}/missions`);
  }

  create(clientId: number, data: Partial<Mission>) {
    return this.http.post<Mission>(`${this.base}/clients/${clientId}/missions`, data);
  }

  update(clientId: number, id: number, data: Partial<Mission>) {
    return this.http.patch<Mission>(`${this.base}/clients/${clientId}/missions/${id}`, data);
  }

  delete(clientId: number, id: number) {
    return this.http.delete(`${this.base}/clients/${clientId}/missions/${id}`);
  }
}
