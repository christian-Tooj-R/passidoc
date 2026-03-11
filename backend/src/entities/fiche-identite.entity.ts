import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, OneToOne, JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';

@Entity('fiche_identite')
export class FicheIdentite {
  @PrimaryGeneratedColumn()
  id: number;

  // Identité légale
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

  // Données physiques
  @Column({ type: 'float', nullable: true })
  surfaceCommerciale: number;

  @Column({ nullable: true })
  activite: string;

  // Structure humaine (gérants)
  @Column({ type: 'json', nullable: true })
  gerants: {
    nom: string;
    age: number;
    situationFamiliale: string;
    contratMariage: string;
    nbEnfants: number;
  }[];

  // Organigramme salariés
  @Column({ type: 'json', nullable: true })
  salaries: {
    nom: string;
    poste: string;
    typeContrat: string;
  }[];

  @OneToOne(() => Client, (client) => client.ficheIdentite)
  @JoinColumn()
  client: Client;

  @UpdateDateColumn()
  updatedAt: Date;
}
