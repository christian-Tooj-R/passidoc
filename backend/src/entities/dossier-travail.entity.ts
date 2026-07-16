import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Client } from './client.entity';
import { CycleRevision } from './cycle-revision.entity';

@Entity('dossiers_travail')
export class DossierTravail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true })
  noteSynthese: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: number;

  @Column({ type: 'int' })
  exerciceId: number;

  @OneToMany(() => CycleRevision, (c) => c.dossierTravail, { cascade: true, eager: true })
  cycles: CycleRevision[];

  @UpdateDateColumn()
  updatedAt: Date;
}
