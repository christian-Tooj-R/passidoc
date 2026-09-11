import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';
import { EmployeClient } from './employe-client.entity';

export enum StatutVariablePaie {
  BROUILLON = 'BROUILLON',
  VALIDEE = 'VALIDEE',
  BULLETIN_GENERE = 'BULLETIN_GENERE',
}

export interface LignePaieLibre {
  libelle: string;
  montant: number;
}

/**
 * Variables de paie saisies pour un employé client, pour un mois/année donné
 * (heures sup, primes, absences, avantages en nature, retenues diverses).
 * Sert d'entrée au moteur de calcul du bulletin.
 */
@Entity('paie_variables_mensuelles')
@Unique(['employeClientId', 'mois', 'annee'])
export class VariablePaie {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  @ManyToOne(() => EmployeClient, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'employeClientId' })
  employeClient: EmployeClient;

  @Column()
  employeClientId: number;

  @Column({ type: 'int' })
  mois: number; // 1-12

  @Column({ type: 'int' })
  annee: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  heuresSupplementaires: number;

  /** % de majoration des heures sup — si non renseigné, valeur par défaut de ParametrePaie utilisée */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  tauxMajorationHeuresSup: number | null;

  @Column({ type: 'json', nullable: true })
  primes: LignePaieLibre[] | null;

  @Column({ type: 'json', nullable: true })
  absences: LignePaieLibre[] | null;

  @Column({ type: 'json', nullable: true })
  avantagesNature: LignePaieLibre[] | null;

  @Column({ type: 'json', nullable: true })
  retenuesDiverses: LignePaieLibre[] | null;

  @Column({ type: 'text', nullable: true })
  commentaire: string | null;

  @Column({ type: 'enum', enum: StatutVariablePaie, default: StatutVariablePaie.BROUILLON })
  statut: StatutVariablePaie;

  @Column({ nullable: true })
  createdById: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
