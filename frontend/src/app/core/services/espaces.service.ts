import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Espace {
  id: number;
  nom: string;
  userId: number;
  couleur?: string | null;
  createdAt: string;
  documents: EspaceDoc[];
}

export interface EspaceDoc {
  id: number;
  nom: string;
  mimeType: string;
  taille: number;
  espaceId: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class EspacesService {
  private readonly api = `${environment.apiUrl}/espaces`;

  constructor(private http: HttpClient) {}

  getMesEspaces() {
    return this.http.get<Espace[]>(this.api);
  }

  creer(nom: string, couleur?: string | null) {
    return this.http.post<Espace>(this.api, { nom, couleur: couleur ?? null });
  }

  supprimer(id: number) {
    return this.http.delete<{ message: string }>(`${this.api}/${id}`);
  }

  getDocs(espaceId: number) {
    return this.http.get<EspaceDoc[]>(`${this.api}/${espaceId}/documents`);
  }

  upload(espaceId: number, file: File) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http.post<EspaceDoc>(`${this.api}/${espaceId}/documents/upload`, fd);
  }

  supprimerDoc(espaceId: number, docId: number) {
    return this.http.delete<{ message: string }>(`${this.api}/${espaceId}/documents/${docId}`);
  }

  changerCouleur(id: number, couleur: string | null) {
    return this.http.patch<Espace>(`${this.api}/${id}/couleur`, { couleur });
  }

  download(espaceId: number, docId: number) {
    return this.http.get(`${this.api}/${espaceId}/documents/${docId}/download`, { responseType: 'blob' });
  }
}
