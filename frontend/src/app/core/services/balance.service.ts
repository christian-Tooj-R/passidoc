import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface MoisBalance {
  mois: number;
  nbFournisseursAttendu: number;
  nbClientsAttendu:      number;
  nbFournisseursRecu:    number;
  nbClientsRecu:         number;
  tauxFournisseurs:      number;
  tauxClients:           number;
  analyseIA:             string | null;
}

@Injectable({ providedIn: 'root' })
export class BalanceService {
  private http = inject(HttpClient);

  private base(clientId: number) {
    return `${environment.apiUrl}/clients/${clientId}/balance`;
  }

  getBalance(clientId: number, annee: number) {
    return this.http.get<MoisBalance[]>(this.base(clientId), { params: { annee } });
  }

  importFec(clientId: number, annee: number, file: File) {
    const fd = new FormData();
    fd.append('fec', file);
    return this.http.post<{ imported: number; annee: number }>(
      `${this.base(clientId)}/import-fec`,
      fd,
      { params: { annee } },
    );
  }

  updateRecu(clientId: number, annee: number, mois: number, body: { nbFournisseursRecu?: number; nbClientsRecu?: number }) {
    return this.http.patch<void>(`${this.base(clientId)}/${mois}`, body, { params: { annee } });
  }

  analyser(clientId: number, annee: number) {
    return this.http.post<{ analyse: string }>(`${this.base(clientId)}/analyse`, {}, { params: { annee } });
  }
}
