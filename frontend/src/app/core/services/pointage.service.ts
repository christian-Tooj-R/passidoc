import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Pointage {
  id: number;
  userId: number;
  date: string;
  heureArrivee: string;
  heureDepart: string | null;
}

export interface EntreeJournee {
  user: {
    id: number;
    firstName: string;
    lastName: string;
    site: string;
    role: string;
  };
  pointage: Pointage | null;
}

export interface MonStatut {
  pointage: Pointage | null;
  estPointe: boolean;
  estParti: boolean;
}

@Injectable({ providedIn: 'root' })
export class PointageService {
  private readonly api = `${environment.apiUrl}/pointage`;

  constructor(private http: HttpClient) {}

  pointer() {
    return this.http.post<Pointage>(`${this.api}/pointer`, {});
  }

  getJournee(date?: string, site?: string) {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;
    if (site) params['site'] = site;
    return this.http.get<EntreeJournee[]>(`${this.api}/journee`, { params });
  }

  getMonStatut() {
    return this.http.get<MonStatut>(`${this.api}/mon-statut`);
  }

  getHistorique() {
    return this.http.get<Pointage[]>(`${this.api}/historique`);
  }
}
