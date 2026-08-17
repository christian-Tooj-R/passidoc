import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class PasswordResetToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  email: string;

  @Column()
  code: string;

  @Column()
  tenantId: number;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
