export type ClientSite = 'REUNION' | 'MADAGASCAR';

export interface Responsable {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Client {
  id: number;
  nom: string;
  logoUrl?: string;
  site: ClientSite;
  santePassation: number;
  isActive: boolean;
  responsable?: Responsable;
  ficheIdentite?: FicheIdentite;
  fluxMensuels?: FluxMensuel[];
  fournisseurs?: Fournisseur[];
  synthesesCloture?: SyntheseCloture[];
  documents?: ClientDocument[];
  createdAt: string;
}

export interface FicheIdentite {
  id: number;
  raisonSociale?: string;
  siren?: string;
  siret?: string;
  formeJuridique?: string;
  adresse?: string;
  surfaceCommerciale?: number;
  activite?: string;
  emailContact?: string;
  telephoneContact?: string;
  gerants?: Gerant[];
  salaries?: Salarie[];
}

export interface Gerant {
  nom: string;
  age: number;
  situationFamiliale: string;
  contratMariage: string;
  nbEnfants: number;
}

export interface Salarie {
  nom: string;
  poste: string;
  typeContrat: string;
}

export type TypeFlux = 'RELEVE_BANCAIRE' | 'RAPPORT_VENTE' | 'RAPPORT_REGLEMENT';
export type StatutDepot = 'DEPOSE' | 'MANQUANT' | 'EN_RETARD';

export interface FluxMensuel {
  id: number;
  type: TypeFlux;
  mois: number;
  annee: number;
  statut: StatutDepot;
  dateDepot?: string;
  commentaire?: string;
  createdAt: string;
}

export interface Fournisseur {
  id: number;
  nom: string;
  email: string;
  telephone?: string;
  categorie?: string;
}

export interface SyntheseCloture {
  id: number;
  exercice: number;
  pointsIS?: string;
  pointsEBE?: string;
  notesSynthese?: string;
  businessModel?: string;
  strategieVente?: string;
  canauxDistribution?: string;
  zonesExoneration?: string[];
  zonesRisque?: string[];
}

export interface ClientDocument {
  id: number;
  nom: string;
  mimeType: string;
  taille: number;
  createdAt: string;
  uploadePar?: { firstName: string; lastName: string };
}
