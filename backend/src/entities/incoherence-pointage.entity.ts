import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('incoherences_pointage')
export class IncoherencePointage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  collaborateurId: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'collaborateurId' })
  collaborateur: User;

  @Column({ nullable: true })
  tenantId: number;

  /** Jour concerné (YYYY-MM-DD) */
  @Column({ type: 'date' })
  date: string;

  /** Durée de présence pointée ce jour (heures) */
  @Column({ type: 'float', nullable: true })
  heuresPointees: number;

  /** Total heures déjà saisies avant cette tentative */
  @Column({ type: 'float', nullable: true })
  heuresDejaSaisies: number;

  /** Durée de la saisie tentée (heures) */
  @Column({ type: 'float', nullable: true })
  tentativeDuree: number;

  @CreateDateColumn()
  createdAt: Date;
}
