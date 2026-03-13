import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface AuditLog {
  id: number;
  action: string;
  ressource: string;
  ressourceId: number;
  avant: any;
  apres: any;
  user?: { id: number; firstName: string; lastName: string; role: string };
  ipAddress?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  constructor(private http: HttpClient) {}
  getByClient(clientId: number) {
    return this.http.get<AuditLog[]>(`${environment.apiUrl}/clients/${clientId}/audit`);
  }
}
