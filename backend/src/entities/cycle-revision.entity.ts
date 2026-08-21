import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { DossierTravail } from './dossier-travail.entity';

export enum TypeCycle {
  A = 'A', // Régularités formelles et synthèse
  B = 'B', // Trésorerie et financement
  C = 'C', // Achats et fournisseurs
  D = 'D', // Charges externes
  E = 'E', // Ventes et clients
  F = 'F', // Stock et en cours
  G = 'G', // Immobilisations
  H = 'H', // Social
  I = 'I', // Impôts
  J = 'J', // Capitaux propres et provisions
  K = 'K', // Autres comptes
}

@Entity('cycles_revision')
export class CycleRevision {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  typeCycle: TypeCycle;

  @Column({ type: 'int', default: 0 })
  pourcentageCouverture: number;

  @Column({ type: 'text', nullable: true })
  commentaireLogiciel: string;

  @Column({ type: 'text', nullable: true })
  diligences: string;

  @Column({ type: 'text', nullable: true })
  conclusion: string;

  @ManyToOne(() => DossierTravail, (d) => d.cycles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dossierTravailId' })
  dossierTravail: DossierTravail;

  @Column()
  dossierTravailId: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
