import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ObjectifsService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  get(clientId: number) {
    return this.http.get<any>(`${this.base}/clients/${clientId}/objectifs`);
  }

  save(clientId: number, data: any) {
    return this.http.patch<any>(`${this.base}/clients/${clientId}/objectifs`, data);
  }
}
