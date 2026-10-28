import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';
import { TimerService } from './saisie-temps.service';
import { formatHeures } from './duree.util';
import { toLocalIso } from './date.util';

export type TaskStatut = 'A_FAIRE' | 'EN_COURS' | 'EN_PAUSE' | 'TERMINEE' | 'NON_FAIT' | 'EN_ATTENTE';
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
  debutEnCours?: string;
  tempsTotalSecondes?: number;
  createdAt: string;
  anyoneCanTake?: boolean;
  recurrenceType?: string;
  recurrenceJour?: number;
  serviceDestinataire?: 'COMPTA' | 'SOCIAL' | 'JURIDIQUE' | 'ADMIN';
  serviceAttendu?: 'COMPTA' | 'SOCIAL' | 'JURIDIQUE' | 'ADMIN';
  enAttenteService?: boolean;
  estRecurrente?: boolean;
  estFacturable?: boolean;
  /** Présent uniquement dans la réponse d'une mise à jour qui termine la tâche. */
  saisieAuto?: SaisieAuto | null;
}

/** Saisie de temps faite automatiquement par le serveur quand la tâche passe à « Terminée ». */
export type SaisieAuto =
  | { creee: true; saisieId: number; dureeHeures: number; date: string; collaborateurId: number; collaborateur: string }
  | { creee: false; motif: 'AUCUN_TEMPS' | 'DEJA_SAISI' | 'REFUSEE'; message: string };

export interface TaskComment {
  id: number;
  contenu: string;
  taskId: number;
  auteurId: number;
  auteur: { id: number; firstName: string; lastName: string };
  mentions: number[];
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
  commentaires: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class TasksService {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private timer = inject(TimerService);

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

  getMesTaches() {
    return this.http.get<Task[]>(`${environment.apiUrl}/tasks/mes-taches`);
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
    type?: TaskType; dateEcheance?: string; assigneeId?: number; anyoneCanTake?: boolean;
    recurrenceType?: string; recurrenceJour?: number; semaine?: number;
  }) {
    return this.http.post<Task>(this.api(clientId), data);
  }

  createGlobal(data: {
    titre: string; description?: string; priorite?: TaskPriorite;
    type?: TaskType; dateEcheance?: string; assigneeId?: number; anyoneCanTake?: boolean;
    recurrenceType?: string; recurrenceJour?: number;
    serviceDestinataire?: 'COMPTA' | 'SOCIAL' | 'JURIDIQUE' | 'ADMIN';
    enAttenteService?: boolean;
    serviceAttendu?: 'COMPTA' | 'SOCIAL' | 'JURIDIQUE' | 'ADMIN';
    estFacturable?: boolean;
  }) {
    return this.http.post<Task>(`${environment.apiUrl}/tasks`, data);
  }

  /** Mise à jour d'une tâche ; une tâche sans dossier passe par la route globale. Quand la
   *  tâche se termine, le serveur saisit le temps chronométré (cf. signalerSaisieAuto). */
  update(clientId: number | null | undefined, id: number, data: Partial<{
    titre: string; description: string; statut: TaskStatut; priorite: TaskPriorite;
    type: TaskType; dateEcheance: string; assigneeId: number; tempsExecution: number; heuresSup: number;
    serviceDestinataire: 'COMPTA' | 'SOCIAL' | 'JURIDIQUE' | 'ADMIN';
  }>) {
    const url = clientId ? `${this.api(clientId)}/${id}` : `${environment.apiUrl}/tasks/${id}`;
    const now = new Date();
    // Heure locale du navigateur : date la saisie automatique dans le fuseau de l'utilisateur.
    const fin = data.statut === 'TERMINEE'
      ? { dateFinLocale: toLocalIso(now), heureFinLocale: now.toTimeString().slice(0, 5) }
      : {};
    return this.http.patch<Task>(url, { ...data, ...fin }).pipe(
      tap(t => this.signalerSaisieAuto(id, t?.saisieAuto)),
    );
  }

  private signalerSaisieAuto(taskId: number, s: SaisieAuto | null | undefined) {
    if (!s) return;
    // Le temps du minuteur de la tâche est désormais saisi : on l'abandonne, sinon l'arrêter
    // proposerait de l'enregistrer une seconde fois.
    if (s.creee || s.motif === 'DEJA_SAISI') this.timer.oublierTache(taskId);
    // Différé : chaque écran affiche son propre toast (« Tâche mise à jour ») à la réception ;
    // celui-ci, plus informatif, doit passer après.
    setTimeout(() => {
      if (s.creee) {
        const ou = s.collaborateurId === this.auth.currentUser()?.id
          ? 'votre saisie des temps'
          : `la saisie des temps de ${s.collaborateur}`;
        this.toast.success(`Tâche terminée : ${formatHeures(s.dureeHeures)} ajoutée à ${ou}`);
      } else if (s.motif === 'REFUSEE') {
        this.toast.error(`Tâche terminée, mais temps non saisi : ${s.message}`);
      } else {
        this.toast.info(s.message);
      }
    });
  }

  prendreTache(id: number) {
    return this.http.patch<Task>(`${environment.apiUrl}/tasks/${id}/prendre`, {});
  }

  delete(clientId: number, id: number) {
    return this.http.delete(`${this.api(clientId)}/${id}`);
  }

  getComments(clientId: number, taskId: number) {
    return this.http.get<TaskComment[]>(`${this.api(clientId)}/${taskId}/comments`);
  }

  addComment(clientId: number, taskId: number, dto: { contenu: string; mentions: number[] }) {
    return this.http.post<TaskComment>(`${this.api(clientId)}/${taskId}/comments`, dto);
  }

  deleteComment(clientId: number, taskId: number, commentId: number) {
    return this.http.delete(`${this.api(clientId)}/${taskId}/comments/${commentId}`);
  }
}
