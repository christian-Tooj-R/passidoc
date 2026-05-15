import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { User } from './user.entity';

export enum TaskStatut {
  A_FAIRE = 'A_FAIRE',
  EN_COURS = 'EN_COURS',
  TERMINEE = 'TERMINEE',
  NON_FAIT = 'NON_FAIT',
  EN_ATTENTE = 'EN_ATTENTE',
}

export enum TaskPriorite {
  BASSE = 'BASSE',
  NORMALE = 'NORMALE',
  HAUTE = 'HAUTE',
}

export enum TaskType {
  TVA = 'TVA',
  PAIE = 'PAIE',
  ACHATS = 'ACHATS',
  VENTES = 'VENTES',
  RB = 'RB',
  GV = 'GV',
  DR = 'DR',
  AUTRE = 'AUTRE',
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  taskId: string; // Format T-2025-001

  @Column()
  titre: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: TaskStatut, default: TaskStatut.A_FAIRE })
  statut: TaskStatut;

  @Column({ type: 'enum', enum: TaskPriorite, default: TaskPriorite.NORMALE })
  priorite: TaskPriorite;

  @Column({ type: 'enum', enum: TaskType, nullable: true })
  type: TaskType;

  @Column({ nullable: true, type: 'date' })
  dateEcheance: string;

  // Suivi du temps
  @Column({ nullable: true, type: 'timestamp' })
  heureDebut: Date;

  @Column({ nullable: true, type: 'timestamp' })
  heureFin: Date;

  @Column({ nullable: true, type: 'float', default: 0 })
  tempsExecution: number; // en minutes

  @Column({ nullable: true, type: 'float', default: 0 })
  heuresSup: number;

  @Column({ nullable: true })
  semaine: number; // numéro de semaine ISO

  @Column({ nullable: true })
  mois: number; // 1-12 (grille mensuelle)

  @Column({ nullable: true })
  annee: number; // ex: 2025

  @Column({ nullable: true, type: 'text' })
  commentaire: string; // note libre par ligne de grille

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'assigneeId' })
  assignee: User;

  @Column({ nullable: true })
  assigneeId: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'creePar' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
