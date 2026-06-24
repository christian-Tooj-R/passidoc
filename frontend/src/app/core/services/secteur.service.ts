import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Secteur } from '../models/secteur.model';

@Injectable({ providedIn: 'root' })
export class SecteurService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/secteurs`;

  getAll(includeInactive = false): Observable<Secteur[]> {
    return this.http.get<Secteur[]>(this.base, { params: includeInactive ? { all: 'true' } : {} });
  }

  getOne(id: number): Observable<Secteur> {
    return this.http.get<Secteur>(`${this.base}/${id}`);
  }

  create(dto: Partial<Secteur>): Observable<Secteur> {
    return this.http.post<Secteur>(this.base, dto);
  }

  update(id: number, dto: Partial<Secteur>): Observable<Secteur> {
    return this.http.patch<Secteur>(`${this.base}/${id}`, dto);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  syncNaf(id: number): Observable<Secteur> {
    return this.http.patch<Secteur>(`${this.base}/${id}/sync-naf`, {});
  }

  syncAll(): Observable<{ synced: number; errors: number }> {
    return this.http.patch<{ synced: number; errors: number }>(`${this.base}/sync-all`, {});
  }
}
