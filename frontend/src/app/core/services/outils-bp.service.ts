import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { OutilBpCode, OutilBpVue, ProfilAutoBp, SuggestionBp, TableauBp } from '../models/outils-bp.model';

/** Tableau de Bord BP d'un dossier, par exercice. */
@Injectable({ providedIn: 'root' })
export class OutilsBpService {
  private http = inject(HttpClient);
  private url = (clientId: number) => `${environment.apiUrl}/clients/${clientId}/bp`;

  tableau(clientId: number, exerciceId: number) {
    return this.http.get<TableauBp>(this.url(clientId), { params: { exerciceId } });
  }

  suggestions(clientId: number, exerciceId: number) {
    return this.http.get<{ suggestions: SuggestionBp[]; profil: ProfilAutoBp }>(`${this.url(clientId)}/suggestions`, { params: { exerciceId } });
  }

  /** Suggestions de l'IA pour un outil (même forme que les suggestions PASSIDOC). */
  suggestionsIa(clientId: number, exerciceId: number, outil: OutilBpCode) {
    return this.http.get<{ suggestions: SuggestionBp[] }>(`${this.url(clientId)}/suggestions-ia`, { params: { exerciceId, outil } });
  }

  enregistrer(clientId: number, exerciceId: number, outil: OutilBpCode, contenu: any) {
    return this.http.patch<OutilBpVue>(`${this.url(clientId)}/${outil}`, { contenu }, { params: { exerciceId } });
  }

  valider(clientId: number, exerciceId: number, outil: OutilBpCode, commentaire = '') {
    return this.http.post<OutilBpVue>(`${this.url(clientId)}/${outil}/valider`, commentaire ? { commentaire } : {}, { params: { exerciceId } });
  }
}
