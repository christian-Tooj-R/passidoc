import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type TypeConge =
  'CONGES_PAYES' | 'RTT' | 'MALADIE' | 'MATERNITE' | 'PATERNITE' |
  'SANS_SOLDE' | 'EVENEMENT_FAMILIAL' | 'RECUPERATION' | 'AUTRE';

export type StatutConge = 'EN_ATTENTE' | 'APPROUVEE' | 'REFUSEE' | 'ANNULEE';

export interface CongeAbsence {
  id: number;
  userId: number;
  typeConge: TypeConge;
  dateDebut: string;
  dateFin: string;
  nombreJours: number;
  statut: StatutConge;
  motif: string | null;
  commentaireRH: string | null;
  approbateurId: number | null;
  dateApprobation: string | null;
  user?: { id: number; firstName: string; lastName: string; site: string };
  createdAt: string;
}

export interface SoldeConge {
  typeConge: TypeConge;
  annee: number;
  joursAcquis: number;
  joursPris: number;
  joursEnAttente: number;
  solde: number;
}

export interface CongeStats {
  annee: number;
  totalApprouves: number;
  enAttente: number;
  parType: { type: TypeConge; count: number; jours: number }[];
}

export const TYPE_CONGE_LABELS: Record<TypeConge, string> = {
  CONGES_PAYES:       'Congés payés',
  RTT:                'RTT',
  MALADIE:            'Maladie',
  MATERNITE:          'Maternité',
  PATERNITE:          'Paternité',
  SANS_SOLDE:         'Sans solde',
  EVENEMENT_FAMILIAL: 'Événement familial',
  RECUPERATION:       'Récupération',
  AUTRE:              'Autre',
};

export const TYPE_CONGE_COLORS: Record<TypeConge, string> = {
  CONGES_PAYES:       '#2563eb',
  RTT:                '#7c3aed',
  MALADIE:            '#dc2626',
  MATERNITE:          '#db2777',
  PATERNITE:          '#0891b2',
  SANS_SOLDE:         '#6b7280',
  EVENEMENT_FAMILIAL: '#d97706',
  RECUPERATION:       '#059669',
  AUTRE:              '#4b5563',
};

@Injectable({ providedIn: 'root' })
export class CongesAbsencesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/conges`;

  findAll(filters?: { userId?: number; statut?: StatutConge; annee?: number }) {
    let params = new HttpParams();
    if (filters?.userId)  params = params.set('userId', filters.userId);
    if (filters?.statut)  params = params.set('statut', filters.statut);
    if (filters?.annee)   params = params.set('annee', filters.annee);
    return this.http.get<CongeAbsence[]>(this.base, { params });
  }

  mesDemandes(annee?: number) {
    let params = new HttpParams();
    if (annee) params = params.set('annee', annee);
    return this.http.get<CongeAbsence[]>(`${this.base}/mes-demandes`, { params });
  }

  mesSoldes(annee?: number) {
    let params = new HttpParams();
    if (annee) params = params.set('annee', annee);
    return this.http.get<SoldeConge[]>(`${this.base}/mes-soldes`, { params });
  }

  getSoldes(userId: number, annee?: number) {
    let params = new HttpParams();
    if (annee) params = params.set('annee', annee);
    return this.http.get<SoldeConge[]>(`${this.base}/soldes/${userId}`, { params });
  }

  updateSolde(userId: number, dto: { typeConge: TypeConge; annee: number; joursAcquis: number }) {
    return this.http.patch<SoldeConge[]>(`${this.base}/soldes/${userId}`, dto);
  }

  getStats(annee?: number) {
    let params = new HttpParams();
    if (annee) params = params.set('annee', annee);
    return this.http.get<CongeStats>(`${this.base}/stats`, { params });
  }

  create(dto: {
    typeConge: TypeConge; dateDebut: string; dateFin: string;
    nombreJours: number; motif?: string; userId?: number;
  }) {
    return this.http.post<CongeAbsence>(this.base, dto);
  }

  approuver(id: number, commentaire?: string) {
    return this.http.patch<CongeAbsence>(`${this.base}/${id}/approuver`, { commentaire });
  }

  refuser(id: number, commentaire?: string) {
    return this.http.patch<CongeAbsence>(`${this.base}/${id}/refuser`, { commentaire });
  }

  annuler(id: number) {
    return this.http.patch<CongeAbsence>(`${this.base}/${id}/annuler`, {});
  }
}
