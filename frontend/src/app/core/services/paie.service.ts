import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type TypeContratEmployePaie = 'CDI' | 'CDD' | 'APPRENTISSAGE' | 'STAGE' | 'INTERIM' | 'AUTRE';

export interface EmployeClient {
  id: number;
  clientId: number;
  matricule: string;
  nom: string;
  prenom: string;
  poste?: string;
  dateEntree?: string | null;
  dateSortie?: string | null;
  typeContrat: TypeContratEmployePaie;
  salaireBase: number;
  quotiteTravail: number;
  regimePaieCode: string;
  isActive: boolean;
}

export interface CreateEmployeClientDto {
  clientId: number;
  matricule: string;
  nom: string;
  prenom: string;
  poste?: string;
  dateEntree?: string;
  dateSortie?: string;
  typeContrat?: TypeContratEmployePaie;
  salaireBase: number;
  quotiteTravail?: number;
  regimePaieCode?: string;
}

export interface LignePaieLibre {
  libelle: string;
  montant: number;
}

export interface VariablePaie {
  id: number;
  employeClientId: number;
  mois: number;
  annee: number;
  heuresSupplementaires: number;
  tauxMajorationHeuresSup: number | null;
  primes: LignePaieLibre[] | null;
  absences: LignePaieLibre[] | null;
  avantagesNature: LignePaieLibre[] | null;
  retenuesDiverses: LignePaieLibre[] | null;
  commentaire?: string | null;
  statut: 'BROUILLON' | 'VALIDEE' | 'BULLETIN_GENERE';
}

export interface UpsertVariablePaieDto {
  employeClientId: number;
  mois: number;
  annee: number;
  heuresSupplementaires?: number;
  tauxMajorationHeuresSup?: number;
  primes?: LignePaieLibre[];
  absences?: LignePaieLibre[];
  avantagesNature?: LignePaieLibre[];
  retenuesDiverses?: LignePaieLibre[];
  commentaire?: string;
}

export interface LigneBulletin {
  code: string;
  libelle: string;
  imputation: string;
  base: number;
  tauxSalarial: number | null;
  montantSalarial: number;
  tauxPatronal: number | null;
  montantPatronal: number;
}

export interface ResultatCalculPaie {
  employeClientId: number;
  mois: number;
  annee: number;
  salaireBase: number;
  totalBrut: number;
  totalCotisationsSalariales: number;
  totalCotisationsPatronales: number;
  netImposable: number;
  netAPayer: number;
  detailRubriques: LigneBulletin[];
}

export interface BulletinPaie {
  id: number;
  employeClientId: number;
  mois: number;
  annee: number;
  regimePaieCode: string;
  salaireBase: number;
  totalBrut: number;
  totalCotisationsSalariales: number;
  totalCotisationsPatronales: number;
  netImposable: number;
  netAPayer: number;
  detailRubriques: LigneBulletin[];
  dateGeneration: string;
}

export interface RubriquePaie {
  id: number;
  code: string;
  libelle: string;
  regimePaieCode: string;
  baseCalcul: 'BRUT' | 'SALAIRE_BASE' | 'FIXE';
  plafondMensuel: number | null;
  tauxSalarial: number | null;
  tauxPatronal: number | null;
  montantFixe: number | null;
  imputation: 'COTISATION' | 'PRIME' | 'RETENUE' | 'AUTRE';
  ordreAffichage: number;
  isActive: boolean;
  estPlaceholder: boolean;
  notes?: string | null;
}

@Injectable({ providedIn: 'root' })
export class PaieService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/paie`;

  // Employés clients
  findEmployesByClient(clientId: number): Observable<EmployeClient[]> {
    return this.http.get<EmployeClient[]>(`${this.api}/employes-clients?clientId=${clientId}`);
  }

  createEmploye(dto: CreateEmployeClientDto): Observable<EmployeClient> {
    return this.http.post<EmployeClient>(`${this.api}/employes-clients`, dto);
  }

  updateEmploye(id: number, dto: Partial<CreateEmployeClientDto> & { isActive?: boolean }): Observable<EmployeClient> {
    return this.http.patch<EmployeClient>(`${this.api}/employes-clients/${id}`, dto);
  }

  removeEmploye(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/employes-clients/${id}`);
  }

  // Rubriques (paramétrage)
  findRubriques(regime?: string): Observable<RubriquePaie[]> {
    const suffix = regime ? `?regime=${regime}` : '';
    return this.http.get<RubriquePaie[]>(`${this.api}/rubriques${suffix}`);
  }

  // Variables mensuelles
  upsertVariable(dto: UpsertVariablePaieDto): Observable<VariablePaie> {
    return this.http.post<VariablePaie>(`${this.api}/variables`, dto);
  }

  findVariablePeriode(employeClientId: number, mois: number, annee: number): Observable<VariablePaie | null> {
    return this.http.get<VariablePaie | null>(
      `${this.api}/variables?employeClientId=${employeClientId}&mois=${mois}&annee=${annee}`,
    );
  }

  findVariablesByEmploye(employeClientId: number): Observable<VariablePaie[]> {
    return this.http.get<VariablePaie[]>(`${this.api}/variables?employeClientId=${employeClientId}`);
  }

  // Bulletins
  calculerBulletin(employeClientId: number, mois: number, annee: number): Observable<ResultatCalculPaie> {
    return this.http.get<ResultatCalculPaie>(
      `${this.api}/bulletins/calculer?employeClientId=${employeClientId}&mois=${mois}&annee=${annee}`,
    );
  }

  genererBulletin(employeClientId: number, mois: number, annee: number): Observable<BulletinPaie> {
    return this.http.post<BulletinPaie>(
      `${this.api}/bulletins/generer?employeClientId=${employeClientId}&mois=${mois}&annee=${annee}`,
      {},
    );
  }

  findBulletinsByEmploye(employeClientId: number): Observable<BulletinPaie[]> {
    return this.http.get<BulletinPaie[]>(`${this.api}/bulletins?employeClientId=${employeClientId}`);
  }

  telechargerBulletinPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.api}/bulletins/${id}/pdf`, { responseType: 'blob' });
  }
}
