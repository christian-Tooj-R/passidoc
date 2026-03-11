import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { FicheIdentite } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class FicheIdentiteService {
  private api(id: number) { return `${environment.apiUrl}/clients/${id}/fiche-identite`; }

  constructor(private http: HttpClient) {}

  get(clientId: number) { return this.http.get<FicheIdentite>(this.api(clientId)); }
  update(clientId: number, data: Partial<FicheIdentite>) {
    return this.http.patch<FicheIdentite>(this.api(clientId), data);
  }
}
