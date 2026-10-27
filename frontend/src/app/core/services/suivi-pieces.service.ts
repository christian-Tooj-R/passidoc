import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApprocheClient } from '../models/client.model';

/** Suivi des pièces manquantes et relances clients (cahier v2 #1). */
export type IndicateurPieces = 'VERT' | 'ORANGE' | 'ROUGE' | 'NON_SUIVI';

export interface PieceManquante {
  type: string;
  libelle: string;
  mois: number;
  annee: number;
  echeance: string;
  joursRetard: number;
  statut: 'MANQUANT' | 'EN_RETARD';
}

export interface DestinataireRelance { nom: string | null; email: string; role: 'LEGAL' | 'OPERATIONNEL' }

export interface LigneSuiviPieces {
  clientId: number;
  client: string;
  site: string;
  intervenants: { directeur: string | null; responsable: string | null; collaborateurOuest: string | null };
  attendus: number;
  deposes: number;
  taux: number;
  manquantes: PieceManquante[];
  plusAncienRetard: number;
  horsDelai: number;
  indicateur: IndicateurPieces;
  derniereRelance: string | null;
  approche: ApprocheClient;
  destinataire: DestinataireRelance | null;
  contactOperationnel: { nom: string | null; telephone: string | null; email: string | null };
}

export interface TableauSuiviPieces {
  annee: number;
  delaiJours: number;
  relanceAutoActive: boolean;
  /** Source des pièces : la grille des documents mensuels PASSIDOC (TIIME : en attente d'accès partenaire). */
  sourceDonnees: 'PASSIDOC' | 'TIIME';
  lignes: LigneSuiviPieces[];
  totaux: { dossiers: number; rouge: number; orange: number; vert: number; nonSuivi: number; piecesManquantes: number };
}

export interface ApercuRelance {
  clientId: number;
  client: string;
  approche: ApprocheClient;
  destinataire: DestinataireRelance | null;
  manquantes: PieceManquante[];
  objet: string;
  texte: string;
}

export interface ResultatRelance { envoyeA: string; destinataire: DestinataireRelance; nbPieces: number; dateRelance: string }

export const LIBELLES_INDICATEUR: Record<IndicateurPieces, string> = {
  ROUGE: 'À relancer', ORANGE: 'En attente', VERT: 'Complet', NON_SUIVI: 'Non suivi',
};

@Injectable({ providedIn: 'root' })
export class SuiviPiecesService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  tableau(annee?: number): Observable<TableauSuiviPieces> {
    const params = annee ? new HttpParams().set('annee', annee) : undefined;
    return this.http.get<TableauSuiviPieces>(`${this.api}/suivi-pieces`, { params });
  }

  apercuRelance(clientId: number, annee?: number): Observable<ApercuRelance> {
    const params = annee ? new HttpParams().set('annee', annee) : undefined;
    return this.http.get<ApercuRelance>(`${this.api}/clients/${clientId}/suivi-pieces/relance`, { params });
  }

  envoyerRelance(clientId: number, contenu: { objet?: string; texte?: string }, annee?: number): Observable<ResultatRelance> {
    const params = annee ? new HttpParams().set('annee', annee) : undefined;
    return this.http.post<ResultatRelance>(`${this.api}/clients/${clientId}/suivi-pieces/relance`, contenu, { params });
  }
}
