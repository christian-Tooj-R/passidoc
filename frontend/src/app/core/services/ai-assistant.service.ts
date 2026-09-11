import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiContextSummary {
  ficheIdentite: boolean;
  gerants: number;
  salaries: number;
  analyseStrategique: boolean;
  performances: boolean;
  derniereAnnee: number | null;
  missions: number;
  objectifs: boolean;
  controleInterne: boolean;
  fournisseurs: number;
  fluxMensuels: number;
  fluxManquants: number;
  santePassation: number;
  adnGlobal: boolean;
  adnSectoriel: boolean;
  documents: number;
  taches: number;
  exercices: number;
  responsable: string | null;
  collaborateurMg: string | null;
}

@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private api = environment.apiUrl;

  readonly openPanel$ = new Subject<{ prefill?: string }>();

  requestOpen(prefill?: string) { this.openPanel$.next({ prefill }); }

  getContextSummary(clientId: number) {
    return this.http.get<AiContextSummary>(`${this.api}/clients/${clientId}/ai/context`);
  }

  getHistory(clientId: number) {
    return this.http.get<any[]>(`${this.api}/clients/${clientId}/ai/history`);
  }

  clearHistory(clientId: number) {
    return this.http.delete(`${this.api}/clients/${clientId}/ai/history`);
  }

  /**
   * Contexte "Mes temps" (module Travail) — scopé au collaborateur connecté,
   * pas de clientId. Pas d'historique persisté côté backend pour ce premier
   * lot : la conversation vit uniquement en mémoire dans le widget tant que
   * la page n'est pas rechargée.
   */
  getMeContext() {
    return this.http.get<any>(`${this.api}/me/ai/context`);
  }

  async chatStreamMe(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (msg: string) => void,
  ): Promise<void> {
    await this.streamFrom(`/api/me/ai/chat`, messages, onChunk, onDone, onError);
  }

  async chatStream(
    clientId: number,
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (msg: string) => void,
  ): Promise<void> {
    await this.streamFrom(`/api/clients/${clientId}/ai/chat`, messages, onChunk, onDone, onError);
  }

  /** Logique de streaming partagée entre le chat "dossier client" et le chat "Mes temps". */
  private async streamFrom(
    path: string,
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (msg: string) => void,
  ): Promise<void> {
    const token = this.auth.getToken();
    const baseUrl = this.api.replace('/api', '');

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages }),
      });
    } catch {
      onError("Impossible de contacter le serveur.");
      return;
    }

    if (!response.ok) {
      onError(`Erreur serveur (${response.status})`);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        onChunk(decoder.decode(value, { stream: true }));
      }
    } finally {
      onDone();
    }
  }
}
