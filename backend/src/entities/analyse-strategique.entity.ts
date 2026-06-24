import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';

@Entity('analyses_strategiques')
export class AnalyseStrategique {
  @PrimaryGeneratedColumn()
  id: number;

  // SWOT
  @Column({ type: 'json', nullable: true })
  forces: string[];

  @Column({ type: 'json', nullable: true })
  faiblesses: string[];

  @Column({ type: 'json', nullable: true })
  opportunites: string[];

  @Column({ type: 'json', nullable: true })
  menaces: string[];

  // 5 forces de Porter
  @Column({ type: 'text', nullable: true })
  porterConcurrence: string;

  @Column({ type: 'text', nullable: true })
  porterNouveauxEntrants: string;

  @Column({ type: 'text', nullable: true })
  porterClients: string;

  @Column({ type: 'text', nullable: true })
  porterFournisseurs: string;

  @Column({ type: 'text', nullable: true })
  porterSubstituts: string;

  // Business Model Canvas
  @Column({ type: 'text', nullable: true })
  businessModelCanvas: string;

  @ManyToOne(() => Client, (c: any) => c.analysesStrategiques, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: number;

  @Column({ type: 'int', nullable: true })
  exerciceId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
