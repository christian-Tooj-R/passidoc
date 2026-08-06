import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ClientDocument } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private api(id: number) { return `${environment.apiUrl}/clients/${id}/documents`; }

  constructor(private http: HttpClient) {}

  getAll(clientId: number) { return this.http.get<ClientDocument[]>(this.api(clientId)); }

  upload(
    clientId: number,
    file: File,
    meta?: { typeDoc?: string; periodeMois?: number; periodeAnnee?: number },
  ) {
    const form = new FormData();
    form.append('file', file);
    if (meta?.typeDoc)     form.append('typeDoc',     meta.typeDoc);
    if (meta?.periodeMois) form.append('periodeMois', String(meta.periodeMois));
    if (meta?.periodeAnnee) form.append('periodeAnnee', String(meta.periodeAnnee));
    return this.http.post<ClientDocument>(`${this.api(clientId)}/upload`, form);
  }

  download(clientId: number, docId: number) {
    return this.http.get(`${this.api(clientId)}/${docId}/download`, { responseType: 'blob' });
  }

  delete(clientId: number, docId: number) {
    return this.http.delete(`${this.api(clientId)}/${docId}`);
  }
}
