import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface PausePointage {
  id: number;
  heureDebut: string;
  heureFin:   string | null;
}

export interface Pointage {
  id: number;
  userId: number;
  date: string;
  heureArrivee:    string;
  heureDebutPause: string | null; // @deprecated — utiliser pauses[]
  heureFinPause:   string | null; // @deprecated — utiliser pauses[]
  heureDepart:     string | null;
  pauses:          PausePointage[];
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

export type EtatPointage = 'absent' | 'present' | 'en_pause' | 'revenu' | 'parti';

export interface MonStatut {
  pointage:      Pointage | null;
  etat:          EtatPointage;
  estPointe:     boolean;
  enPause:       boolean;
  estRevenu:     boolean;
  estParti:      boolean;
  dureeNetteMin: number;
  dureePauseMin: number;
  nbPauses:      number;
}

export interface SiteLocation {
  site: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  adresse?: string;
}

@Injectable({ providedIn: 'root' })
export class PointageService {
  private readonly api = `${environment.apiUrl}/pointage`;

  constructor(private http: HttpClient) {}

  pointer(latitude?: number, longitude?: number, action?: 'debut_pause' | 'fin_pause' | 'depart') {
    return this.http.post<Pointage>(`${this.api}/pointer`, { latitude, longitude, action });
  }

  getSiteLocation(site: string) {
    return this.http.get<SiteLocation | null>(`${this.api}/site-location/${site}`);
  }

  upsertSiteLocation(site: string, data: { latitude: number; longitude: number; radiusMeters: number; adresse?: string }) {
    return this.http.patch<SiteLocation>(`${this.api}/site-location/${site}`, data);
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

  getHistoriqueAll(site?: string) {
    const params: Record<string, string> = {};
    if (site) params['site'] = site;
    return this.http.get<(Pointage & { user: { firstName: string; lastName: string; site: string } })[]>(
      `${this.api}/historique/all`, { params }
    );
  }
}
