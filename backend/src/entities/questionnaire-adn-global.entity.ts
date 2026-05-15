import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, OneToOne, JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';

@Entity('questionnaires_adn_global')
export class QuestionnaireAdnGlobal {
  @PrimaryGeneratedColumn()
  id: number;

  // Section I — Vision et Identité
  @Column({ type: 'text', nullable: true })
  mission: string;

  @Column({ nullable: true })
  visionActivite: string; // STABLE | CROISSANCE_MODEREE | FORTE_EXPANSION | TRANSMISSION

  @Column({ nullable: true })
  valeurCle: string; // QUALITE | RAPIDITE | PROXIMITE | RAPPORT_QUALITE_PRIX

  // Section II — Capital Humain
  @Column({ nullable: true })
  placeExploitation: string; // OPERATIONNELLE | MIXTE | SUPERVISION

  @Column({ nullable: true })
  ambianceEquipe: string; // FAMILIALE | PROFESSIONNELLE | TENSION | SANS_SALARIES

  @Column({ nullable: true })
  enjeuxRH: string; // RECRUTER | FIDELISER | FORMER

  // Section III — Modèle Économique
  @Column({ type: 'simple-json', nullable: true })
  canauxAcquisition: string[];

  @Column({ type: 'text', nullable: true })
  principalConcurrent: string;

  @Column({ nullable: true })
  saisonnalite: string; // LINEAIRE | SAISONNIERE | CYCLIQUE

  // Section IV — Vigilance et Projets
  @Column({ nullable: true })
  caillouChaussure: string; // TRESORERIE | ADMINISTRATIF | VISIBILITE_RENTABILITE | MANQUE_TEMPS

  @Column({ type: 'simple-json', nullable: true })
  projetsInvestissement: string[];

  @Column({ type: 'tinyint', nullable: true })
  niveauNumerique: number; // 1 à 5

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: number;
}
