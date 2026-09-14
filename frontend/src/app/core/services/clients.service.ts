import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Client } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class ClientsService {
  private readonly api = `${environment.apiUrl}/clients`;

  constructor(private http: HttpClient) {}

  getAll(site?: string) {
    const params: Record<string, string> = {};
    if (site) params['site'] = site;
    return this.http.get<Client[]>(this.api, { params });
  }

  getOne(id: number) {
    return this.http.get<Client>(`${this.api}/${id}`);
  }

  create(data: { nom: string; site: string; ficheData?: any }) {
    return this.http.post<Client>(this.api, data);
  }

  update(id: number, data: Partial<Client>) {
    return this.http.patch<Client>(`${this.api}/${id}`, data);
  }

  delete(id: number) {
    return this.http.delete(`${this.api}/${id}`);
  }

  assign(clientId: number, responsableId: number | null) {
    return this.http.patch<Client>(`${this.api}/${clientId}/assign`, { responsableId });
  }

  assignOuest(clientId: number, collaborateurOuestId: number | null) {
    return this.http.patch<Client>(`${this.api}/${clientId}/assign-ouest`, { collaborateurOuestId });
  }

  assignDirecteur(clientId: number, directeurId: number | null) {
    return this.http.patch<Client>(`${this.api}/${clientId}/assign-directeur`, { directeurId });
  }


  exportPdf(id: number) {
    return this.http.get(`${this.api}/${id}/export/pdf`, { responseType: 'blob' });
  }

  uploadLogo(clientId: number, file: File) {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post<any>(`${environment.apiUrl}/clients/${clientId}/logo`, formData);
  }

  uploadFichePhoto(clientId: number, file: File) {
    const formData = new FormData();
    formData.append('photo', file);
    return this.http.post<any>(`${environment.apiUrl}/clients/${clientId}/fiche/photos`, formData);
  }

  deleteFichePhoto(clientId: number, photoUrl: string) {
    return this.http.delete<any>(`${environment.apiUrl}/clients/${clientId}/fiche/photos`, { body: { photoUrl } });
  }

  /** Définit la photo de la 1ère carte (logo) à partir d'une photo déjà présente dans la galerie. */
  setLogoFromGallery(clientId: number, photoUrl: string) {
    return this.http.patch<any>(`${environment.apiUrl}/clients/${clientId}/logo-from-gallery`, { photoUrl });
  }

  /** Retire la photo de la 1ère carte (repasse à l'illustration secteur par défaut). */
  removeLogo(clientId: number) {
    return this.http.delete<any>(`${environment.apiUrl}/clients/${clientId}/logo`);
  }
}
