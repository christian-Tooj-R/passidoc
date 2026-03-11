import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SyntheseCloture } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class SyntheseService {
  private api(id: number) { return `${environment.apiUrl}/clients/${id}/syntheses`; }

  constructor(private http: HttpClient) {}

  getAll(clientId: number) { return this.http.get<SyntheseCloture[]>(this.api(clientId)); }
  create(clientId: number, data: any) { return this.http.post<SyntheseCloture>(this.api(clientId), data); }
  update(clientId: number, sId: number, data: any) {
    return this.http.patch<SyntheseCloture>(`${this.api(clientId)}/${sId}`, data);
  }
  delete(clientId: number, sId: number) { return this.http.delete(`${this.api(clientId)}/${sId}`); }
}
