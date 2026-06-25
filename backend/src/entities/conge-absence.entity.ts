import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum StatutConge {
  EN_ATTENTE = 'EN_ATTENTE',
  APPROUVEE  = 'APPROUVEE',
  REFUSEE    = 'REFUSEE',
  ANNULEE    = 'ANNULEE',
}

export enum TypeConge {
  CONGES_PAYES      = 'CONGES_PAYES',
  RTT               = 'RTT',
  MALADIE           = 'MALADIE',
  MATERNITE         = 'MATERNITE',
  PATERNITE         = 'PATERNITE',
  SANS_SOLDE        = 'SANS_SOLDE',
  EVENEMENT_FAMILIAL= 'EVENEMENT_FAMILIAL',
  RECUPERATION      = 'RECUPERATION',
  AUTRE             = 'AUTRE',
}

@Entity('conges_absences')
export class CongeAbsence {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: TypeConge })
  typeConge: TypeConge;

  @Column({ type: 'date' })
  dateDebut: string;

  @Column({ type: 'date' })
  dateFin: string;

  @Column({ type: 'decimal', precision: 5, scale: 1 })
  nombreJours: number;

  @Column({ type: 'enum', enum: StatutConge, default: StatutConge.EN_ATTENTE })
  statut: StatutConge;

  @Column({ type: 'text', nullable: true })
  motif: string | null;

  @Column({ type: 'text', nullable: true })
  commentaireRH: string | null;

  @Column({ type: 'int', nullable: true })
  approbateurId: number | null;

  @Column({ type: 'date', nullable: true })
  dateApprobation: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
