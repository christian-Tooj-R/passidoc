import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface DossierMessage {
  id: number;
  clientId: number;
  userId: number;
  contenu: string;
  createdAt: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
  };
}

@Injectable({ providedIn: 'root' })
export class DossierMessagesService {
  private http = inject(HttpClient);

  private base(clientId: number) {
    return `${environment.apiUrl}/clients/${clientId}/messages`;
  }

  getAll(clientId: number) {
    return this.http.get<DossierMessage[]>(this.base(clientId));
  }

  send(clientId: number, contenu: string) {
    return this.http.post<DossierMessage>(this.base(clientId), { contenu });
  }

  delete(clientId: number, id: number) {
    return this.http.delete<void>(`${this.base(clientId)}/${id}`);
  }
}
