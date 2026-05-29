import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('pointages')
export class Pointage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ type: 'date' })
  date: string; // YYYY-MM-DD

  @Column({ type: 'timestamp' })
  heureArrivee: Date;

  @Column({ type: 'timestamp', nullable: true })
  heureDebutPause: Date;

  @Column({ type: 'timestamp', nullable: true })
  heureFinPause: Date;

  @Column({ type: 'timestamp', nullable: true })
  heureDepart: Date;

  /** Coordonnées GPS enregistrées au moment du pointage (audit) */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
