import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn,
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

  // 5 forces de Porter (texte libre)
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

  // KPIs financiers
  @Column({ type: 'float', nullable: true })
  ca: number;

  @Column({ type: 'float', nullable: true })
  caPrecedent: number;

  @Column({ type: 'float', nullable: true })
  ebe: number;

  @Column({ type: 'float', nullable: true })
  resultatNet: number;

  @Column({ type: 'float', nullable: true })
  fluxTresorerie: number;

  @Column({ nullable: true })
  anneeExercice: number;

  @Column({ type: 'text', nullable: true })
  commentaireFinancier: string;

  // Concurrents & marché
  @Column({ nullable: true })
  nbConcurrentsQuartier: number;

  @Column({ nullable: true })
  nbConcurrentsCommune: number;

  @Column({ type: 'text', nullable: true })
  evolutionSecteur: string;

  // Présence digitale
  @Column({ type: 'json', nullable: true })
  reseauxSociaux: string[];

  @Column({ nullable: true })
  siteWeb: string;

  @OneToOne(() => Client, (client) => client.analyseStrategique)
  @JoinColumn()
  client: Client;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
