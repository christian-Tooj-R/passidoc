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
  heureDepart: Date;

  @CreateDateColumn()
  createdAt: Date;
}
