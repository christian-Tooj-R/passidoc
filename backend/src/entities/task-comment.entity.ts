import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Task } from './task.entity';
import { User } from './user.entity';

@Entity('task_comments')
export class TaskComment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  contenu: string;

  @Column({ type: 'json', nullable: true })
  mentions: number[];

  @Column()
  taskId: number;

  @ManyToOne(() => Task, (t) => t.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column()
  auteurId: number;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auteurId' })
  auteur: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
