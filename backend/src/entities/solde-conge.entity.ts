import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { User } from './user.entity';
import { TypeConge } from './conge-absence.entity';

@Entity('soldes_conges')
@Unique(['userId', 'typeConge', 'annee'])
export class SoldeConge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: TypeConge })
  typeConge: TypeConge;

  @Column({ type: 'int' })
  annee: number;

  @Column({ type: 'decimal', precision: 6, scale: 1, default: 0 })
  joursAcquis: number;

  @Column({ type: 'decimal', precision: 6, scale: 1, default: 0 })
  joursPris: number;

  @Column({ type: 'decimal', precision: 6, scale: 1, default: 0 })
  joursEnAttente: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
