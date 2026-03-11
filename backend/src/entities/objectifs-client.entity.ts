import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, OneToOne, JoinColumn,
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

  @OneToOne(() => Client, (client) => client.objectifs)
  @JoinColumn()
  client: Client;

  @UpdateDateColumn()
  updatedAt: Date;
}
