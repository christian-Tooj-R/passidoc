import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Client } from './client.entity';

export enum TypeTemps {
  FACTURABLE = 'FACTURABLE',
  NON_FACTURABLE = 'NON_FACTURABLE',
}

export enum CategorieNonFacturable {
  APPEL_CLIENT = 'APPEL_CLIENT',
  REUNION_INTERNE = 'REUNION_INTERNE',
  FORMATION = 'FORMATION',
  ADMINISTRATIF = 'ADMINISTRATIF',
  AUTRE = 'AUTRE',
}

export enum MissionCode {
  TCO  = 'TCO',
  REV  = 'REV',
  FISC = 'FISC',
  SOC  = 'SOC',
  JUR  = 'JUR',
  CON  = 'CON',
  FORM = 'FORM',
  ADM  = 'ADM',
}

@Entity('saisies_temps')
export class SaisieTemps {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'float' })
  dureeHeures: number;

  @Column({ type: 'enum', enum: TypeTemps })
  type: TypeTemps;

  @Column({ type: 'enum', enum: CategorieNonFacturable, nullable: true })
  categorie: CategorieNonFacturable;

  @Column({ type: 'varchar', length: 10, nullable: true })
  missionCode: string;

  @Column({ nullable: true })
  dossierId: number;

  @Column({ type: 'text', nullable: true })
  commentaire: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  heureDebut: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  heureFin: string;

  @Column({ default: false })
  isLocked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lockedAt: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lockedBy: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collaborateurId' })
  collaborateur: User;

  @Column()
  collaborateurId: number;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({ nullable: true })
  clientId: number;

  @Column({ nullable: true })
  tenantId: number;

  @CreateDateColumn()
  createdAt: Date;
}
