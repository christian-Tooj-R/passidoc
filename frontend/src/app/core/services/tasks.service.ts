import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type TaskStatut = 'A_FAIRE' | 'EN_COURS' | 'TERMINEE';
export type TaskPriorite = 'BASSE' | 'NORMALE' | 'HAUTE';

export interface Task {
  id: number;
  titre: string;
  description?: string;
  statut: TaskStatut;
  priorite: TaskPriorite;
  dateEcheance?: string;
  clientId: number;
  client?: { id: number; nom: string };
  assignee?: { id: number; firstName: string; lastName: string };
  createdBy?: { id: number; firstName: string; lastName: string };
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class TasksService {
  constructor(private http: HttpClient) {}

  private api(clientId: number) {
    return `${environment.apiUrl}/clients/${clientId}/tasks`;
  }

  getAll(clientId: number) {
    return this.http.get<Task[]>(this.api(clientId));
  }

  getAllGlobal() {
    return this.http.get<Task[]>(`${environment.apiUrl}/tasks`);
  }

  create(clientId: number, data: { titre: string; description?: string; priorite?: TaskPriorite; dateEcheance?: string; assigneeId?: number }) {
    return this.http.post<Task>(this.api(clientId), data);
  }

  update(clientId: number, id: number, data: Partial<{ titre: string; description: string; statut: TaskStatut; priorite: TaskPriorite; dateEcheance: string; assigneeId: number }>) {
    return this.http.patch<Task>(`${this.api(clientId)}/${id}`, data);
  }

  delete(clientId: number, id: number) {
    return this.http.delete(`${this.api(clientId)}/${id}`);
  }
}
