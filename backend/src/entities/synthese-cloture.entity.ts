import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Client } from './client.entity';

@Entity('syntheses_cloture')
export class SyntheseCloture {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  exercice: number; // ex: 2024

  // Analyse financière N-1
  @Column({ type: 'text', nullable: true })
  pointsIS: string;

  @Column({ type: 'text', nullable: true })
  pointsEBE: string;

  @Column({ type: 'text', nullable: true })
  notesSynthese: string;

  // Business model
  @Column({ type: 'text', nullable: true })
  businessModel: string;

  @Column({ type: 'text', nullable: true })
  strategieVente: string;

  @Column({ type: 'text', nullable: true })
  canauxDistribution: string;

  // Spécificités fiscales
  @Column({ type: 'json', nullable: true })
  zonesExoneration: string[]; // ex: ['ZFA NG']

  @Column({ type: 'json', nullable: true })
  zonesRisque: string[]; // ex: ['flux d\'espèces']

  @ManyToOne(() => Client, (client) => client.synthesesCloture)
  client: Client;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
