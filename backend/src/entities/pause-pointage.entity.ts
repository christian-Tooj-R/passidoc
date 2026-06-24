import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Pointage } from './pointage.entity';

@Entity('pause_pointages')
export class PausePointage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Pointage, (p) => p.pauses, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'pointageId' })
  pointage: Pointage;

  @Column()
  pointageId: number;

  @Column({ type: 'timestamp' })
  heureDebut: Date;

  @Column({ type: 'timestamp', nullable: true })
  heureFin: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
