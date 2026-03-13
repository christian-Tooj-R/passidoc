import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface FiscalRef {
  zonesExoneration: string[];
  zonesRisque: string[];
  reglementations: string[];
}
export interface FiscalReferenceData {
  REUNION: FiscalRef;
  MADAGASCAR: FiscalRef;
}

@Injectable({ providedIn: 'root' })
export class FiscalReferenceService {
  private cache: FiscalReferenceData | null = null;
  constructor(private http: HttpClient) {}
  get() {
    if (this.cache) return new Promise<FiscalReferenceData>(r => r(this.cache!));
    return this.http.get<FiscalReferenceData>(`${environment.apiUrl}/fiscal-reference`).toPromise().then(d => { this.cache = d!; return d!; });
  }
}
