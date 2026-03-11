import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Fournisseur } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class FournisseursService {
  private api(id: number) { return `${environment.apiUrl}/clients/${id}/fournisseurs`; }

  constructor(private http: HttpClient) {}

  getAll(clientId: number) { return this.http.get<Fournisseur[]>(this.api(clientId)); }
  create(clientId: number, data: any) { return this.http.post<Fournisseur>(this.api(clientId), data); }
  update(clientId: number, fId: number, data: any) {
    return this.http.patch<Fournisseur>(`${this.api(clientId)}/${fId}`, data);
  }
  delete(clientId: number, fId: number) { return this.http.delete(`${this.api(clientId)}/${fId}`); }
}
