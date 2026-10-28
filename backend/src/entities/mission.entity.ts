import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { User } from './user.entity';

/** Origine historique de la mission (ancien module Mission) — le suivi passe par `statut`. */
export enum TypeMission {
  REALISEE = 'REALISEE',
  REFUSEE = 'REFUSEE',
  DETECTEE = 'DETECTEE',
  IA = 'IA',
}

/**
 * Mission proposée au client (CDC module Missions) : détectée pendant la révision d'un cycle
 * (onglet « Par cycle ») ou saisie directement (« hors cycle »), suivie dans le pipeline.
 */
@Entity('missions')
export class Mission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: TypeMission })
  type: TypeMission;

  @Column()
  titre: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  /** Montant estimé des honoraires, € HT (vide = non renseigné). */
  @Column({ type: 'float', nullable: true })
  honoraires: number | null;

  @Column({ type: 'text', nullable: true })
  arguments: string;

  @Column({ type: 'text', nullable: true })
  raisonRefus: string;

  @Column({ nullable: true })
  annee: number;

  @Column({ default: false })
  isProposee: boolean;

  /** PROPOSEE | EN_DISCUSSION | ACCEPTEE | REFUSEE | SANS_SUITE (missions/missions.util.ts).
   *  Nullable en base : les missions antérieures sont rattrapées au démarrage depuis `type`. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  statut: string | null;

  /** Cycle de révision d'origine (IMM, CAP…) ; null = mission hors cycle. */
  @Column({ type: 'varchar', length: 10, nullable: true })
  cycle: string | null;

  /** Exercice pendant la révision duquel la mission a été détectée. */
  @Column({ type: 'int', nullable: true })
  exerciceId: number | null;

  @Column({ type: 'date', nullable: true })
  dateRelance: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'responsableId' })
  responsable: User | null;

  @Column({ type: 'int', nullable: true })
  responsableId: number | null;

  /** Mission en discussion, acceptée ou refusée : jamais supprimée, seulement archivée (R7). */
  @Column({ default: false })
  archivee: boolean;

  @Column({ type: 'timestamp', nullable: true })
  statutModifieLe: Date | null;

  /** Date de relance pour laquelle les notifications J-3 et J0 ont été envoyées (une seule
   *  fois par date ; une nouvelle date de relance déclenche de nouvelles notifications). */
  @Column({ type: 'date', nullable: true })
  notifJ3Pour: string | null;

  @Column({ type: 'date', nullable: true })
  notifJ0Pour: string | null;

  @Column({ type: 'int', nullable: true })
  creeParId: number | null;

  /** Mission refusée d'un exercice antérieur que celle-ci repropose (R5). */
  @Column({ type: 'int', nullable: true })
  repriseDeId: number | null;

  @ManyToOne(() => Client, (client) => client.missions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({ nullable: true })
  clientId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
