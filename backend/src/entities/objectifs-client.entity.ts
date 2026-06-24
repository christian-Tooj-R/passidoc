import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';

@Entity('objectifs_client')
export class ObjectifsClient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true })
  objectifs12mois: string;

  @Column({ type: 'text', nullable: true })
  objectifs3a5ans: string;

  @Column({ type: 'text', nullable: true })
  objectifsLongTerme: string;

  // Mission expert-comptable
  @Column({ type: 'text', nullable: true })
  attentesClient: string;

  @Column({ nullable: true })
  depuisQuand: string;

  @Column({ type: 'text', nullable: true })
  qualiteRelation: string;

  @Column({ type: 'text', nullable: true })
  axesAmelioration: string;

  @Column({ type: 'text', nullable: true })
  recommandationsFaites: string;

  // Qualité de la relation par pôle (source : docx "NOTRE MISSION D'EXPERT COMPTABLE")
  @Column({ type: 'text', nullable: true })
  relationCollaborateur: string;

  @Column({ type: 'text', nullable: true })
  relationPoleSocial: string;

  @Column({ type: 'text', nullable: true })
  relationPoleJuridique: string;

  @Column({ type: 'text', nullable: true })
  relationDirecteur: string;

  @ManyToOne(() => Client, (c: any) => c.objectifsItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: number;

  @Column({ type: 'int', nullable: true })
  exerciceId: number | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
