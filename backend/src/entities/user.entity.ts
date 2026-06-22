import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
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

  @Column({ nullable: true, default: 'Indian/Reunion' })
  timezone: string;

  // Collaborateur Réunion référent (pour les collaborateurs Madagascar)
  @Column({ nullable: true })
  referentId: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'referentId' })
  referent: User;

  /** Préférences d'apparence — stockées par utilisateur */
  @Column({ type: 'json', nullable: true })
  themePrefs: Record<string, any> | null;

  /* ── Champs RH ────────────────────────────────── */

  @Column({ type: 'varchar', nullable: true })
  poste: string | null;

  @Column({ type: 'varchar', nullable: true })
  typeContrat: string | null;

  @Column({ type: 'date', nullable: true })
  dateEntree: string | null;

  /** Date de départ — renseignée = ancien collaborateur */
  @Column({ type: 'date', nullable: true })
  dateSortie: string | null;

  @Column({ type: 'varchar', nullable: true })
  telephone: string | null;

  /* ─────────────────────────────────────────────── */

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
