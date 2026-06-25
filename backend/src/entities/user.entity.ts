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

  /* ── Identité personnelle ─────────────────────── */

  @Column({ type: 'date', nullable: true })
  dateNaissance: string | null;

  @Column({ type: 'varchar', nullable: true })
  lieuNaissance: string | null;

  @Column({ type: 'varchar', nullable: true })
  sexe: string | null; // M | F | Autre

  @Column({ type: 'varchar', nullable: true })
  nationalite: string | null;

  @Column({ type: 'varchar', nullable: true })
  situationMatrimoniale: string | null;

  @Column({ type: 'int', nullable: true })
  nbEnfantsCharge: number | null;

  /* ── Coordonnées ──────────────────────────────── */

  @Column({ type: 'varchar', nullable: true })
  adresse: string | null;

  @Column({ type: 'varchar', nullable: true })
  codePostal: string | null;

  @Column({ type: 'varchar', nullable: true })
  ville: string | null;

  @Column({ type: 'varchar', nullable: true })
  pays: string | null;

  @Column({ type: 'varchar', nullable: true })
  telephone: string | null;

  /* ── Informations professionnelles ────────────── */

  @Column({ type: 'varchar', nullable: true })
  poste: string | null;

  @Column({ type: 'varchar', nullable: true })
  departement: string | null;

  @Column({ type: 'varchar', nullable: true })
  typeContrat: string | null;

  @Column({ type: 'date', nullable: true })
  dateEntree: string | null;

  @Column({ type: 'date', nullable: true })
  dateFinContrat: string | null;

  /** Date de départ — renseignée = ancien collaborateur */
  @Column({ type: 'date', nullable: true })
  dateSortie: string | null;

  @Column({ type: 'varchar', nullable: true })
  statut: string | null; // CADRE | NON_CADRE | EMPLOYE | AGENT_MAITRISE

  @Column({ type: 'varchar', nullable: true })
  tempsTravail: string | null; // PLEIN | PARTIEL

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  heuresHebdo: number | null;

  /* ── Identification administrative ────────────── */

  @Column({ type: 'varchar', nullable: true, unique: true })
  matricule: string | null;

  @Column({ type: 'varchar', nullable: true })
  numeroCIN: string | null;

  @Column({ type: 'varchar', nullable: true })
  numeroSS: string | null;

  @Column({ type: 'varchar', nullable: true })
  numeroFiscal: string | null;

  /* ── Informations de paie ──────────────────────── */

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  salaireBase: number | null;

  @Column({ type: 'varchar', nullable: true })
  modePaiement: string | null; // VIREMENT | ESPECES | CHEQUE

  @Column({ type: 'varchar', nullable: true })
  banque: string | null;

  @Column({ type: 'varchar', nullable: true })
  iban: string | null;

  @Column({ type: 'varchar', nullable: true, default: 'EUR' })
  devise: string | null;

  /* ─────────────────────────────────────────────── */

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
