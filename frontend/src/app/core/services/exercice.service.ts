import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Exercice } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class ExerciceService {
  private api(clientId: number) { return `${environment.apiUrl}/clients/${clientId}/exercices`; }

  constructor(private http: HttpClient) {}

  list(clientId: number) {
    return this.http.get<Exercice[]>(this.api(clientId));
  }

  current(clientId: number) {
    return this.http.get<Exercice | null>(`${this.api(clientId)}/current`);
  }

  create(clientId: number, dateClotureExercice: string) {
    return this.http.post<Exercice>(this.api(clientId), { dateClotureExercice });
  }

  cloturer(clientId: number, exerciceId: number) {
    return this.http.patch<{ closed: Exercice; next: Exercice }>(
      `${this.api(clientId)}/${exerciceId}/cloturer`, {},
    );
  }
}
