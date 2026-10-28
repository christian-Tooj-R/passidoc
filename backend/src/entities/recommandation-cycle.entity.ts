import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Client } from './client.entity';

/**
 * Recommandations émises au client sur un cycle de révision, pour un exercice (onglet
 * « Par cycle » du module Missions). Ne recopie aucune écriture : observations métier
 * uniquement. Remplace, pour cet usage, les champs de l'ancien « Dossier de travail ».
 */
@Entity('recommandations_cycles')
@Index(['clientId', 'exerciceId', 'cycle'])
export class RecommandationCycle {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: number;

  /** Null si le dossier n'a pas encore d'exercice. */
  @Column({ type: 'int', nullable: true })
  exerciceId: number | null;

  @Column({ type: 'varchar', length: 10 })
  cycle: string;

  @Column({ type: 'text', default: '' })
  texte: string;

  @Column({ type: 'int', nullable: true })
  auteurId: number | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
