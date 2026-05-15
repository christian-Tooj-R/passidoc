import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';

export enum TypeMission {
  REALISEE = 'REALISEE',
  REFUSEE = 'REFUSEE',
  DETECTEE = 'DETECTEE',
  IA = 'IA',
}

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

  @Column({ type: 'float', nullable: true })
  honoraires: number;

  @Column({ type: 'text', nullable: true })
  arguments: string;

  @Column({ type: 'text', nullable: true })
  raisonRefus: string;

  @Column({ nullable: true })
  annee: number;

  @Column({ default: false })
  isProposee: boolean;

  @ManyToOne(() => Client, (client) => client.missions, { onDelete: 'CASCADE' })
  @JoinColumn()
  client: Client;

  @CreateDateColumn()
  createdAt: Date;
}
