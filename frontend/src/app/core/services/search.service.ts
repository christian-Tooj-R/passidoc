import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface SearchResult {
  type: 'client' | 'document';
  id: number;
  titre: string;
  sousTitre?: string;
  clientId?: number;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly api = `${environment.apiUrl}/search`;

  constructor(private http: HttpClient) {}

  search(q: string) {
    return this.http.get<SearchResult[]>(this.api, { params: { q } });
  }
}
