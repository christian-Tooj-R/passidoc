import {
  Entity, PrimaryGeneratedColumn, Column,
  UpdateDateColumn, ManyToOne, JoinColumn,
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

  @ManyToOne(() => Client, (c: any) => c.controlesInternes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: number;

  @Column({ type: 'int', nullable: true })
  exerciceId: number | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
