import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, OneToOne, JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';

export interface OrgNode {
  id: string;
  nom: string;
  poste: string;
  children?: OrgNode[];
}

@Entity('fiche_identite')
export class FicheIdentite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  raisonSociale: string;

  @Column({ nullable: true })
  siren: string;

  @Column({ nullable: true })
  siret: string;

  @Column({ nullable: true })
  formeJuridique: string;

  @Column({ nullable: true })
  adresse: string;

  @Column({ nullable: true })
  dateCreation: string;

  @Column({ type: 'float', nullable: true })
  capital: number;

  @Column({ type: 'float', nullable: true })
  surfaceCommerciale: number;

  @Column({ nullable: true })
  activite: string;

  // ── TACHE-03 : activité et mode de fonctionnement ──
  @Column({ type: 'text', nullable: true })
  activitePrincipale: string;

  @Column({ type: 'text', nullable: true })
  typeClientele: string;

  @Column({ type: 'text', nullable: true })
  saisonnalite: string;

  @Column({ type: 'text', nullable: true })
  pointsDeVente: string;

  @Column({ type: 'json', nullable: true })
  photos: string[];

  @Column({ nullable: true })
  emailContact: string;

  @Column({ nullable: true })
  telephoneContact: string;

  @Column({ nullable: true })
  entrepriseFamiliale: string;

  @Column({ type: 'json', nullable: true })
  gerants: {
    nom: string;
    age: number;
    situationFamiliale: string;
    contratMariage: string;
    nbEnfants: number;
    agesEnfants: string;
    parts: number;
    proprietaireLogement: boolean;
  }[];

  @Column({ type: 'json', nullable: true })
  salaries: {
    nom: string;
    poste: string;
    typeContrat: string;
    age: number;
    anciennete: string;
  }[];

  @Column({ type: 'json', nullable: true })
  reglementations: string[];

  @Column({ type: 'json', nullable: true })
  actionnaires: {
    nom: string;
    prenom: string;
    pourcentage: number;
    regimeFiscal: string;
  }[];

  @Column({ type: 'json', nullable: true })
  honoraires: {
    comptables?: number;
    juridiques?: number;
    sociaux?: number;
    commissariatAuxComptes?: number;
  };

  @Column({ nullable: true })
  siteWeb: string;

  /** @deprecated Utiliser reseauxSociauxStructures */
  @Column({ type: 'json', nullable: true })
  reseauxSociaux: string[];

  @Column({ type: 'json', nullable: true })
  reseauxSociauxStructures: {
    plateforme: string;
    url: string;
  }[];

  @Column({ nullable: true })
  nbConcurrentsQuartier: number;

  @Column({ nullable: true })
  nbConcurrentsCommune: number;

  @Column({ nullable: true })
  nbConcurrentsGeneral: number;

  @Column({ type: 'text', nullable: true })
  evolutionSecteur: string;

  @Column({ type: 'json', nullable: true })
  organigramme: OrgNode | OrgNode[] | null;

  // ── TACHE-04 : cycles opérationnels ──
  @Column({ type: 'json', nullable: true })
  cycleTresorerie: {
    nbComptesBancaires?: number;
    aEmprunts?: boolean;
    empruntsDetail?: string;
    modeTransmissionReleves?: string;
  };

  @Column({ type: 'json', nullable: true })
  cycleAchats: {
    modeDepotFacturesAchat?: string;
    frequenceVolume?: string;
  };

  @Column({ type: 'json', nullable: true })
  cycleVentes: {
    typeFacturation?: string;
    modeTransmissionVentes?: string;
    periodiciteDeclarationTva?: string;
  };

  @Column({ type: 'json', nullable: true })
  cycleChargesPaie: {
    nbSalaries?: number;
    gestionPaie?: string;
  };

  @Column({ type: 'text', nullable: true })
  pointsVigilance: string;

  @OneToOne(() => Client, (client) => client.ficheIdentite)
  @JoinColumn()
  client: Client;

  @UpdateDateColumn()
  updatedAt: Date;
}
