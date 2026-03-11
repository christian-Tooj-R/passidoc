import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, OneToOne, JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';

@Entity('controle_interne')
export class ControleInterne {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'json', nullable: true })
  processOk: { description: string; raison: string }[];

  @Column({ type: 'json', nullable: true })
  processDefaillants: { description: string; raison: string; risques: string }[];

  @Column({ type: 'json', nullable: true })
  outilsPilotage: { nom: string; description: string }[];

  @Column({ type: 'text', nullable: true })
  noteGenerale: string;

  @OneToOne(() => Client, (client) => client.controleInterne)
  @JoinColumn()
  client: Client;

  @UpdateDateColumn()
  updatedAt: Date;
}
