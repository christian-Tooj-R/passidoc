import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Client } from './client.entity';

export enum ExerciceStatut {
  OUVERT   = 'OUVERT',
  CLOTURE  = 'CLOTURE',
}

@Entity('exercices')
export class Exercice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  annee: number;

  @Column({ type: 'date' })
  dateOuverture: string;

  @Column({ type: 'date' })
  dateCloture: string;

  @Column({ type: 'enum', enum: ExerciceStatut, default: ExerciceStatut.OUVERT })
  statut: ExerciceStatut;

  @Column({ type: 'timestamp', nullable: true })
  clotureLeAt: Date | null;

  @Column({ type: 'int', nullable: true })
  clotureParId: number | null;

  @ManyToOne(() => Client, (c: any) => c.exercices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
