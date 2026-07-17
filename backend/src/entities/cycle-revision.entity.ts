import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { DossierTravail } from './dossier-travail.entity';

export enum TypeCycle {
  VENTE  = 'VENTE',
  ACHAT  = 'ACHAT',
  SOCIAL = 'SOCIAL',
}

@Entity('cycles_revision')
export class CycleRevision {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: TypeCycle })
  typeCycle: TypeCycle;

  @Column({ type: 'int', default: 0 })
  pourcentageCouverture: number;

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
