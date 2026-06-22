import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, OneToOne, JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';

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

  // ── Actionnariat ─────────────────────────────────────────────
  @Column({ type: 'json', nullable: true })
  actionnaires: {
    nom: string;
    prenom: string;
    pourcentage: number;
    regimeFiscal: string;
  }[];

  // ── Honoraires ───────────────────────────────────────────────
  @Column({ type: 'json', nullable: true })
  honoraires: {
    comptables?: number;
    juridiques?: number;
    sociaux?: number;
    commissariatAuxComptes?: number;
  };

  // ── Présence digitale & marché ────────────────────────────────
  @Column({ nullable: true })
  siteWeb: string;

  /** @deprecated Utiliser reseauxSociauxStructures */
  @Column({ type: 'json', nullable: true })
  reseauxSociaux: string[];

  @Column({ type: 'json', nullable: true })
  reseauxSociauxStructures: {
    plateforme: string;  // 'facebook' | 'instagram' | 'linkedin' | 'twitter' | 'youtube' | 'tiktok' | 'autre'
    url: string;
  }[];

  @Column({ nullable: true })
  nbConcurrentsQuartier: number;

  @Column({ nullable: true })
  nbConcurrentsCommune: number;

  /** Remplacement de nbConcurrentsCommune — concurrence générale */
  @Column({ nullable: true })
  nbConcurrentsGeneral: number;

  @Column({ type: 'text', nullable: true })
  evolutionSecteur: string;

  @OneToOne(() => Client, (client) => client.ficheIdentite)
  @JoinColumn()
  client: Client;

  @UpdateDateColumn()
  updatedAt: Date;
}
