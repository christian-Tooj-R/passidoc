export type ClientSite = 'REUNION' | 'MADAGASCAR';

/** @deprecated — utiliser le code dynamique depuis SecteurService */
export type SecteurActivite = string;

/** @deprecated — utiliser SecteurService.getAll() */
export const SECTEURS_LABELS: Record<string, string> = {
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

export type ExerciceStatut = 'OUVERT' | 'CLOTURE';

export interface Exercice {
  id: number;
  annee: number;
  dateOuverture: string;
  dateCloture: string;
  statut: ExerciceStatut;
  clotureLeAt?: string | null;
  clotureParId?: number | null;
  clientId: number;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: number;
  nom: string;
  logoUrl?: string;
  site: ClientSite;
  secteurActivite?: SecteurActivite;
  santePassation: number;
  completude: number;
  completudePilotage: number;
  isActive: boolean;
  typesFluxActifs?: TypeFlux[];
  customFluxTypes?: { key: string; label: string }[];
  directeur?: Responsable;
  responsable?: Responsable;
  collaborateurMg?: Responsable;
  ficheIdentite?: FicheIdentite;
  fluxMensuels?: FluxMensuel[];
  fournisseurs?: Fournisseur[];
  synthesesCloture?: SyntheseCloture[];
  documents?: ClientDocument[];
  dateClotureExercice?: string; // "MM-DD"
  createdAt: string;
  createdById?: number;
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
  actionnaires?: Actionnaire[];
  honoraires?: Honoraires;
  reseauxSociauxStructures?: ReseauSocial[];
  siteWeb?: string;
  evolutionSecteur?: string;
  nbConcurrentsQuartier?: number;
  nbConcurrentsCommune?: number;
  nbConcurrentsGeneral?: number;
  // TACHE-03
  activitePrincipale?: string;
  typeClientele?: string;
  saisonnalite?: string;
  pointsDeVente?: string;
  photos?: string[];
  // TACHE-04
  cycleTresorerie?: {
    nbComptesBancaires?: number;
    aEmprunts?: boolean;
    empruntsDetail?: string;
    modeTransmissionReleves?: string;
  };
  cycleAchats?: {
    modeDepotFacturesAchat?: string;
    frequenceVolume?: string;
  };
  cycleVentes?: {
    typeFacturation?: string;
    modeTransmissionVentes?: string;
    periodiciteDeclarationTva?: string;
  };
  cycleChargesPaie?: {
    nbSalaries?: number;
    gestionPaie?: string;
  };
  pointsVigilance?: string;
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

export interface Actionnaire {
  nom: string;
  prenom: string;
  pourcentage: number;
  regimeFiscal: string;
}

export interface Honoraires {
  comptables?: number;
  juridiques?: number;
  sociaux?: number;
  commissariatAuxComptes?: number;
}

export interface ReseauSocial {
  plateforme: string;
  url: string;
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

export interface RisqueIdentifie {
  description: string;
  niveauRisque: 'FAIBLE' | 'MOYEN' | 'ELEVE';
}

export interface Recommandation {
  description: string;
  statut: 'A_SOUMETTRE' | 'SOUMIS' | 'ACCEPTE' | 'EN_COURS' | 'MIS_EN_OEUVRE';
}

export interface ControleInterne {
  id?: number;
  processOk?: { description: string; raison: string }[];
  processDefaillants?: { description: string; raison: string; risques: string }[];
  outilsPilotage?: { nom: string; description: string }[];
  noteGenerale?: string;
  // TACHE-05
  risquesIdentifies?: RisqueIdentifie[];
  recommandations?: Recommandation[];
  missionConseilPotentielle?: boolean;
  clientId?: number;
  exerciceId?: number;
  updatedAt?: string;
}

export interface ClientDocument {
  id: number;
  nom: string;
  mimeType: string;
  taille: number;
  createdAt: string;
  uploadePar?: { firstName: string; lastName: string };
  typeDoc?: 'FACTURE_ACHAT' | 'FACTURE_VENTE' | 'AUTRE' | null;
  periodeMois?: number | null;
  periodeAnnee?: number | null;
}
