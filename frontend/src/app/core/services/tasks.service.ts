import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type TaskStatut = 'A_FAIRE' | 'EN_COURS' | 'TERMINEE' | 'NON_FAIT' | 'EN_ATTENTE';
export type TaskPriorite = 'BASSE' | 'NORMALE' | 'HAUTE';
export type TaskType = 'TVA' | 'PAIE' | 'ACHATS' | 'VENTES' | 'RB' | 'GV' | 'DR' | 'AUTRE';

export interface Task {
  id: number;
  taskId?: string;
  titre: string;
  description?: string;
  statut: TaskStatut;
  priorite: TaskPriorite;
  type?: TaskType;
  dateEcheance?: string;
  clientId: number;
  client?: { id: number; nom: string };
  assignee?: { id: number; firstName: string; lastName: string };
  createdBy?: { id: number; firstName: string; lastName: string };
  heureDebut?: string;
  heureFin?: string;
  tempsExecution?: number;
  heuresSup?: number;
  semaine?: number;
  mois?: number;
  annee?: number;
  commentaire?: string;
  createdAt: string;
}

export interface TaskDashboard {
  semaine?: number;
  total: number;
  terminees: number;
  enCours: number;
  nonFait: number;
  enAttente: number;
  tauxCompletion: number;
  tempsMoyen: number;
  parCollaborateur: { name: string; total: number; terminees: number; tempsTotal: number }[];
  parType: { type: string; count: number }[];
}

export interface GrilleResult {
  annee: number;
  grille: Record<string, Record<number, Task | null>>;
  drEtapes: Task[];
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

  getDashboard(semaine?: number) {
    const params = semaine ? { semaine: semaine.toString() } : undefined;
    return this.http.get<TaskDashboard>(`${environment.apiUrl}/tasks/dashboard`, params ? { params } : {});
  }

  getGrille(clientId: number, annee: number) {
    return this.http.get<GrilleResult>(`${this.api(clientId)}/grille`, {
      params: { annee: annee.toString() },
    });
  }

  toggleMensuel(clientId: number, data: { type: string; mois: number; annee: number }) {
    return this.http.post<Task | null>(`${this.api(clientId)}/toggle-mensuel`, data);
  }

  toggleDrEtape(clientId: number, id: number) {
    return this.http.patch<Task>(`${this.api(clientId)}/dr-etape/${id}`, {});
  }

  updateCommentaire(clientId: number, type: string, annee: number, commentaire: string) {
    return this.http.patch(`${this.api(clientId)}/commentaire`, { type, annee, commentaire });
  }

  create(clientId: number, data: {
    titre: string; description?: string; priorite?: TaskPriorite;
    type?: TaskType; dateEcheance?: string; assigneeId?: number; semaine?: number;
  }) {
    return this.http.post<Task>(this.api(clientId), data);
  }

  update(clientId: number, id: number, data: Partial<{
    titre: string; description: string; statut: TaskStatut; priorite: TaskPriorite;
    type: TaskType; dateEcheance: string; assigneeId: number; tempsExecution: number; heuresSup: number;
  }>) {
    return this.http.patch<Task>(`${this.api(clientId)}/${id}`, data);
  }

  delete(clientId: number, id: number) {
    return this.http.delete(`${this.api(clientId)}/${id}`);
  }
}
