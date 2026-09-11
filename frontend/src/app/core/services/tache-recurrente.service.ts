import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type FrequenceTache = 'MENSUELLE' | 'TRIMESTRIELLE' | 'SEMESTRIELLE' | 'ANNUELLE';

export interface TacheRecurrente {
  id: number;
  titre: string;
  description?: string;
  frequence: FrequenceTache;
  delaiAvantEcheanceJours: number;
  serviceDestinataire?: string;
  isActive: boolean;
  clientId: number;
  assigneAId?: number;
  tenantId: number;
  createdAt: string;
}

export interface CreateTacheRecurrenteDto {
  titre: string;
  description?: string;
  frequence: FrequenceTache;
  delaiAvantEcheanceJours?: number;
  serviceDestinataire?: string;
  clientId: number;
  assigneAId?: number;
}

@Injectable({ providedIn: 'root' })
export class TacheRecurrenteService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/taches-recurrentes`;

  findAll(): Observable<TacheRecurrente[]> {
    return this.http.get<TacheRecurrente[]>(this.api);
  }

  findByClient(clientId: number): Observable<TacheRecurrente[]> {
    return this.http.get<TacheRecurrente[]>(`${this.api}?clientId=${clientId}`);
  }

  create(dto: CreateTacheRecurrenteDto): Observable<TacheRecurrente> {
    return this.http.post<TacheRecurrente>(this.api, dto);
  }

  update(id: number, dto: Partial<TacheRecurrente>): Observable<TacheRecurrente> {
    return this.http.patch<TacheRecurrente>(`${this.api}/${id}`, dto);
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  generer(): Observable<{ created: number }> {
    return this.http.post<{ created: number }>(`${this.api}/generer`, {});
  }
}
