import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface PappersResult {
  siren: string;
  nomEntreprise: string;
  formeJuridique: string;
  adresse: string;
  siret: string;
  dirigeants: { nom: string; prenom: string; qualite: string; dateNaissance?: string }[];
}

@Injectable({ providedIn: 'root' })
export class PappersService {
  private readonly api = `${environment.apiUrl}/pappers`;

  constructor(private http: HttpClient) {}

  search(q: string) {
    return this.http.get<PappersResult[]>(`${this.api}/search`, { params: { q } });
  }
}
