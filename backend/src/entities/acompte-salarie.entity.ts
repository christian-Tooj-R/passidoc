import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum StatutAcompteSalarie {
  DEMANDE = 'DEMANDE',
  VALIDE = 'VALIDE',
  DEDUIT = 'DEDUIT',
  ANNULE = 'ANNULE',
}

/**
 * Acompte (avance sur salaire) demandé par ou pour un collaborateur INTERNE AFYM,
 * déductible du bulletin du mois indiqué (`periodeMois`/`periodeAnnee`) — CDC §9.3/§10.
 * Une fois le bulletin du mois généré, l'acompte VALIDE est automatiquement injecté comme
 * ligne `retenuesDiverses` (origine ACOMPTE) sur `VariablePaieRh` puis marqué DEDUIT.
 */
@Entity('paie_rh_acomptes')
export class AcompteSalarie {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'salarieId' })
  salarie: User;

  @Column()
  salarieId: number;

  /** Mois/année sur le bulletin duquel l'acompte sera déduit */
  @Column({ type: 'int' })
  periodeMois: number;

  @Column({ type: 'int' })
  periodeAnnee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  montant: number;

  @Column({ type: 'date' })
  dateDemande: string;

  @Column({ type: 'date', nullable: true })
  dateVersement: string | null;

  @Column({ type: 'enum', enum: StatutAcompteSalarie, default: StatutAcompteSalarie.DEMANDE })
  statut: StatutAcompteSalarie;

  @Column({ type: 'text', nullable: true })
  motif: string | null;

  @Column({ nullable: true })
  createdById: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
