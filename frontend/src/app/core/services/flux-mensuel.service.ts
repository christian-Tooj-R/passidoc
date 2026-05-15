import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { FluxMensuel } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class FluxMensuelService {
  private api(id: number) { return `${environment.apiUrl}/clients/${id}/flux`; }

  constructor(private http: HttpClient) {}

  getAll(clientId: number, annee?: number) {
    const params: Record<string, string> = {};
    if (annee) params['annee'] = String(annee);
    return this.http.get<FluxMensuel[]>(this.api(clientId), { params });
  }

  getAlertes(clientId: number) {
    return this.http.get<FluxMensuel[]>(`${this.api(clientId)}/alertes`);
  }

  create(clientId: number, data: any) {
    return this.http.post<FluxMensuel>(this.api(clientId), data);
  }

  update(clientId: number, fluxId: number, data: any) {
    return this.http.patch<FluxMensuel>(`${this.api(clientId)}/${fluxId}`, data);
  }

  delete(clientId: number, fluxId: number) {
    return this.http.delete(`${this.api(clientId)}/${fluxId}`);
  }

  initAnnee(clientId: number, annee: number) {
    return this.http.post<{ created: number }>(`${this.api(clientId)}/init-annee`, { annee });
  }

  getAlertesGlobales() {
    return this.http.get<any[]>(`${environment.apiUrl}/alertes`);
  }
}
