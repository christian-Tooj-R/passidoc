export type ClientSite = 'REUNION' | 'MADAGASCAR';

export type SecteurActivite =
  | 'RESTAURATION'
  | 'BTP'
  | 'ASSOCIATION'
  | 'HOLDING'
  | 'PROFESSION_LIBERALE'
  | 'SCI';

export const SECTEURS_LABELS: Record<SecteurActivite, string> = {
  RESTAURATION: 'Hôtellerie-Restauration & Métiers de bouche',
  BTP: 'BTP',
  ASSOCIATION: 'Association',
  HOLDING: 'Holding & Groupes',
  PROFESSION_LIBERALE: 'Profession Libérale',
  SCI: 'SCI (Société Civile Immobilière)',
};

export interface QuestionnaireAdnGlobal {
  id?: number;
  mission?: string;
  visionActivite?: string;
  valeurCle?: string;
  placeExploitation?: string;
  ambianceEquipe?: string;
  enjeuxRH?: string;
  canauxAcquisition?: string[];
  principalConcurrent?: string;
  saisonnalite?: string;
  caillouChaussure?: string;
  projetsInvestissement?: string[];
  niveauNumerique?: number;
  updatedAt?: string;
}

export interface QuestionnaireAdnSectoriel {
  id?: number;
  secteur?: SecteurActivite;
  reponses?: Record<string, any>;
  updatedAt?: string;
}

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
  secteurActivite?: SecteurActivite;
  santePassation: number;
  isActive: boolean;
  typesFluxActifs?: TypeFlux[];
  responsable?: Responsable;
  collaborateurMg?: Responsable;
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

export type TypeFlux =
  | 'RELEVE_BANCAIRE'
  | 'TVA_MENSUELLE'
  | 'TVA_TRIMESTRIELLE'
  | 'TVA_ANNUELLE'
  | 'PAIE'
  | 'RAPPORT_VENTE'
  | 'RECETTE_AMENITIZ'
  | 'PIECES_COMPTABLES';

export type StatutDepot = 'DEPOSE' | 'MANQUANT' | 'EN_RETARD';

export interface FluxMensuel {
  id: number;
  type: TypeFlux;
  mois: number;
  annee: number;
  statut: StatutDepot;
  dateDepot?: string;
  dateRelance?: string;
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
