import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

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
  private readonly api = `${environment.apiUrl}/alertes`;

  private _alertes = signal<AlerteFlux[]>([]);
  readonly alertes = this._alertes.asReadonly();
  readonly count = computed(() => this._alertes().length);

  private pollSub: Subscription | null = null;

  startPolling() {
    if (this.pollSub) return;
    this.pollSub = interval(60_000)
      .pipe(startWith(0), switchMap(() => this.http.get<AlerteFlux[]>(this.api)))
      .subscribe({ next: (data) => this._alertes.set(data), error: () => {} });
  }

  stopPolling() {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

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
