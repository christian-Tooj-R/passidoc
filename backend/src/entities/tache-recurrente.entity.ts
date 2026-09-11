import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Client } from './client.entity';
import { User } from './user.entity';

export enum FrequenceTache {
  MENSUELLE = 'MENSUELLE',
  TRIMESTRIELLE = 'TRIMESTRIELLE',
  SEMESTRIELLE = 'SEMESTRIELLE',
  ANNUELLE = 'ANNUELLE',
}

@Entity('taches_recurrentes')
export class TacheRecurrente {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  titre: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: FrequenceTache })
  frequence: FrequenceTache;

  @Column({ type: 'int', default: 7 })
  delaiAvantEcheanceJours: number;

  @Column({ nullable: true })
  serviceDestinataire: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigneAId' })
  assigneA: User;

  @Column({ nullable: true })
  assigneAId: number;

  @Column({ nullable: true })
  tenantId: number;

  @CreateDateColumn()
  createdAt: Date;
}
