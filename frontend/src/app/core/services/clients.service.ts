import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Client } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly api = `${environment.apiUrl}/clients`;

  constructor(private http: HttpClient) {}

  getAll(site?: string) {
    const params: Record<string, string> = {};
    if (site) params['site'] = site;
    return this.http.get<Client[]>(this.api, { params });
  }

  getOne(id: number) {
    return this.http.get<Client>(`${this.api}/${id}`);
  }

  create(data: { nom: string; site: string; ficheData?: any }) {
    return this.http.post<Client>(this.api, data);
  }

  update(id: number, data: Partial<Client>) {
    return this.http.patch<Client>(`${this.api}/${id}`, data);
  }

  delete(id: number) {
    return this.http.delete(`${this.api}/${id}`);
  }

  assign(clientId: number, responsableId: number) {
    return this.http.patch<Client>(`${this.api}/${clientId}/assign`, { responsableId });
  }

  assignMg(clientId: number, collaborateurMgId: number | null) {
    return this.http.patch<Client>(`${this.api}/${clientId}/assign-mg`, { collaborateurMgId });
  }


  exportPdf(id: number) {
    return this.http.get(`${this.api}/${id}/export/pdf`, { responseType: 'blob' });
  }

  uploadLogo(clientId: number, file: File) {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post<any>(`${environment.apiUrl}/clients/${clientId}/logo`, formData);
  }
}
