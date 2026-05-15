import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Note {
  id: number;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/notes`;

  getAll() {
    return this.http.get<Note[]>(this.base);
  }

  create(data: Partial<Note>) {
    return this.http.post<Note>(this.base, data);
  }

  update(id: number, data: Partial<Note>) {
    return this.http.patch<Note>(`${this.base}/${id}`, data);
  }

  delete(id: number) {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
