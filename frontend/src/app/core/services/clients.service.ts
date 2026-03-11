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

  create(data: { nom: string; site: string }) {
    return this.http.post<Client>(this.api, data);
  }

  update(id: number, data: Partial<Client>) {
    return this.http.patch<Client>(`${this.api}/${id}`, data);
  }

  delete(id: number) {
    return this.http.delete(`${this.api}/${id}`);
  }

  exportPdf(id: number) {
    return this.http.get(`${this.api}/${id}/export/pdf`, { responseType: 'blob' });
  }
}
