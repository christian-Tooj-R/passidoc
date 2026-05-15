import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { QuestionnaireAdnGlobal, QuestionnaireAdnSectoriel } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class QuestionnaireAdnService {
  private base(clientId: number) {
    return `${environment.apiUrl}/clients/${clientId}/questionnaire-adn`;
  }

  constructor(private http: HttpClient) {}

  getGlobal(clientId: number) {
    return this.http.get<QuestionnaireAdnGlobal>(`${this.base(clientId)}/global`);
  }

  updateGlobal(clientId: number, data: Partial<QuestionnaireAdnGlobal>) {
    return this.http.patch<QuestionnaireAdnGlobal>(`${this.base(clientId)}/global`, data);
  }

  getSectoriel(clientId: number) {
    return this.http.get<QuestionnaireAdnSectoriel>(`${this.base(clientId)}/sectoriel`);
  }

  updateSectoriel(clientId: number, data: Partial<QuestionnaireAdnSectoriel>) {
    return this.http.patch<QuestionnaireAdnSectoriel>(`${this.base(clientId)}/sectoriel`, data);
  }
}
