import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn() id: number;
  @Column() action: string; // CREATE | UPDATE | DELETE
  @Column() ressource: string; // 'Client' | 'FicheIdentite' | 'Task' ...
  @Column({ nullable: true }) ressourceId: number;
  @Column({ nullable: true }) clientId: number;
  @Column({ type: 'json', nullable: true }) avant: any;
  @Column({ type: 'json', nullable: true }) apres: any;
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', eager: true })
  @JoinColumn({ name: 'userId' }) user: User;
  @Column({ nullable: true }) userId: number;
  @Column({ nullable: true }) ipAddress: string;
  @CreateDateColumn() createdAt: Date;
}
