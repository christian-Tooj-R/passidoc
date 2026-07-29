import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('canvas')
export class Canvas {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  clientId: number;

  @Column({ nullable: true, type: 'text' })
  partenairesClés: string;

  @Column({ nullable: true, type: 'text' })
  activitesClés: string;

  @Column({ nullable: true, type: 'text' })
  ressourcesClés: string;

  @Column({ nullable: true, type: 'text' })
  propositionValeur: string;

  @Column({ nullable: true, type: 'text' })
  relationClient: string;

  @Column({ nullable: true, type: 'text' })
  canaux: string;

  @Column({ nullable: true, type: 'text' })
  segmentsClients: string;

  @Column({ nullable: true, type: 'text' })
  structureCouts: string;

  @Column({ nullable: true, type: 'text' })
  sourcesRevenus: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
