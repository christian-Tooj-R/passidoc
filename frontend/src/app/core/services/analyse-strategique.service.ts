import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AnalyseStrategiqueService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  get(clientId: number, exerciceId: number) {
    return this.http.get<any>(`${this.base}/clients/${clientId}/analyse`, { params: { exerciceId } });
  }

  save(clientId: number, exerciceId: number, data: any) {
    return this.http.patch<any>(`${this.base}/clients/${clientId}/analyse`, data, { params: { exerciceId } });
  }
}
