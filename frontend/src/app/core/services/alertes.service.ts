import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { lireVu, ecrireVu } from './notification-stream.service';

export interface AlerteFlux {
  id: number;
  type: string;
  mois: number;
  annee: number;
  statut: string;
  client: { id: number; nom: string; site: string };
}

@Injectable({ providedIn: 'root' })
export class AlertesService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private readonly api = `${environment.apiUrl}/alertes`;

  private _alertes = signal<AlerteFlux[]>([]);
  readonly alertes = this._alertes.asReadonly();
  readonly count = computed(() => this._alertes().length);

  /** Alertes déjà vues à l'ouverture de la cloche : seules les nouvelles comptent dans le badge.
   *  Mémorisées dans le navigateur, par utilisateur. */
  private _vues = signal<Set<number>>(new Set());
  readonly nonVuesCount = computed(() => this._alertes().filter(a => !this._vues().has(a.id)).length);

  private pollSub: Subscription | null = null;

  startPolling() {
    if (this.pollSub) return;
    this._vues.set(new Set(lireVu<number[]>(this.cleVu(), [])));
    this.pollSub = interval(60_000)
      .pipe(startWith(0), switchMap(() => this.http.get<AlerteFlux[]>(this.api)))
      .subscribe({ next: (data) => this._alertes.set(data), error: () => {} });
  }

  stopPolling() {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  /** Cloche ouverte : les alertes actuelles ne comptent plus dans le badge. */
  marquerVues() {
    const ids = this._alertes().map(a => a.id);
    this._vues.set(new Set(ids));
    ecrireVu(this.cleVu(), ids);
  }

  private cleVu() { return `cloche_vue_alertes_${this.auth.currentUser()?.id ?? 0}`; }

  refresh() {
    this.http.get<AlerteFlux[]>(this.api).subscribe((data) => this._alertes.set(data));
  }

  moisLabel(mois: number): string {
    return new Date(2000, mois - 1).toLocaleString('fr-FR', { month: 'long' });
  }

  typeLabel(type: string): string {
    const map: Record<string, string> = {
      RELEVE_BANCAIRE: 'Relevé bancaire',
      RAPPORT_VENTE: 'Rapport de vente',
      RAPPORT_REGLEMENT: 'Rapport de règlement',
    };
    return map[type] || type;
  }
}
