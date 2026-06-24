import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type UserRole = 'ADMIN' | 'EXPERT_COMPTABLE' | 'COLLABORATEUR';
export type UserSite = 'REUNION' | 'MADAGASCAR';

export interface Collaborateur {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  site: UserSite;
  isActive: boolean;
  isTwoFactorEnabled: boolean;
  poste: string | null;
  typeContrat: string | null;
  dateEntree: string | null;
  dateSortie: string | null;
  telephone: string | null;
  referentId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollaborateurDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  site: UserSite;
  role: UserRole;
  poste?: string | null;
  typeContrat?: string | null;
  dateEntree?: string | null;
  telephone?: string | null;
}

export interface UpdateRHDto {
  firstName?: string;
  lastName?: string;
  site?: UserSite;
  poste?: string | null;
  typeContrat?: string | null;
  dateEntree?: string | null;
  dateSortie?: string | null;
  telephone?: string | null;
}

@Injectable({ providedIn: 'root' })
export class SalariesService {
  private readonly api = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  list(site?: UserSite) {
    const params: Record<string, string> = {};
    if (site) params['site'] = site;
    return this.http.get<Collaborateur[]>(`${this.api}/salaries`, { params });
  }

  getOne(id: number) {
    return this.http.get<Collaborateur>(`${this.api}/salaries/${id}`);
  }

  create(dto: CreateCollaborateurDto) {
    return this.http.post<Collaborateur>(this.api, dto);
  }

  updateRH(id: number, dto: UpdateRHDto) {
    return this.http.patch<Collaborateur>(`${this.api}/${id}/rh`, dto);
  }

  updateRole(id: number, role: UserRole) {
    return this.http.patch<Collaborateur>(`${this.api}/${id}`, { role });
  }
}
