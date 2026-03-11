import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'ADMIN',
  EXPERT_COMPTABLE = 'EXPERT_COMPTABLE',
  COLLABORATEUR = 'COLLABORATEUR',
}

export enum UserSite {
  REUNION = 'REUNION',
  MADAGASCAR = 'MADAGASCAR',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.COLLABORATEUR })
  role: UserRole;

  @Column({ type: 'enum', enum: UserSite })
  site: UserSite;

  @Column({ default: false })
  isTwoFactorEnabled: boolean;

  @Column({ nullable: true })
  twoFactorSecret: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
