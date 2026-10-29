import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, BeforeInsert, BeforeUpdate,
} from 'typeorm';
import { TenantConfig } from './tenant-config.entity';

export enum UserRole {
  ADMIN = 'ADMIN',
  EXPERT_COMPTABLE = 'EXPERT_COMPTABLE',
  CHEF_ANTENNE = 'CHEF_ANTENNE',
  CHEF_MISSION = 'CHEF_MISSION',
  COLLABORATEUR = 'COLLABORATEUR',
  GERANT_OUEST = 'GERANT_OUEST',
}

export enum UserSite {
  EST = 'EST',
  OUEST = 'OUEST',
}

export enum UserAntenne {
  EST = 'EST',
  OUEST = 'OUEST',
}

export enum PoleService {
  COMPTA   = 'COMPTA',
  SOCIAL   = 'SOCIAL',
  JURIDIQUE = 'JURIDIQUE',
  ADMIN    = 'ADMIN',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  @ManyToOne(() => TenantConfig, { nullable: true, onDelete: 'SET NULL', eager: false })
  @JoinColumn({ name: 'tenantId' })
  tenant: TenantConfig;

  @Column({ unique: true })
  email: string;

  /** Stocké en minuscules (cf. auth/email.util.ts) — `save()` uniquement, `update()` ne passe pas ici. */
  @BeforeInsert() @BeforeUpdate()
  normaliserEmail() { if (this.email) this.email = this.email.trim().toLowerCase(); }

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

  /**
   * Fuseau horaire de l'utilisateur. Plus de défaut géographique codé en dur :
   * si la valeur est nulle, le front retombe sur le fuseau du navigateur.
   */
  @Column({ nullable: true })
  timezone: string;

  /** Antenne rattachée — EST ou OUEST (null si l'utilisateur n'est rattaché à aucune antenne) */
  @Column({ type: 'enum', enum: UserAntenne, nullable: true })
  antenne: UserAntenne | null;

  /** Pôle métier du collaborateur — détermine les notifications inter-service */
  @Column({ type: 'enum', enum: PoleService, nullable: true })
  poleService: PoleService | null;

  /** Superviseur direct : Chef de mission pour un Collaborateur, Chef d'antenne pour un Chef de mission */
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

  /* ── Facturation ───────────────────────────────── */

  /** Prix de vente horaire (€/h) — valorise les temps passés du collaborateur (« PV Col »
   *  du rapport des temps). Modifiable par l'ADMIN uniquement, masqué aux autres profils. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  prixVenteHoraire: number | null;

  /* ─────────────────────────────────────────────── */

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** Un utilisateur imbriqué dans une réponse (assignee d'une tâche, collaborateur d'une saisie,
   *  auteur, salarie…) ne sort qu'avec son identité professionnelle : jamais le hash du mot de
   *  passe, le secret 2FA, la paie ni l'état civil. Les routes /users renvoient des objets
   *  simples (`sanitize`, `pourLecteur`), non concernés : ce sont elles qui appliquent la
   *  politique RH (ADMIN ou soi-même). */
  toJSON() {
    const {
      password, twoFactorSecret,
      salaireBase, modePaiement, banque, iban, prixVenteHoraire,
      numeroSS, numeroCIN, numeroFiscal,
      dateNaissance, lieuNaissance, sexe, nationalite, situationMatrimoniale, nbEnfantsCharge,
      adresse, codePostal, ville,
      ...pro
    } = this;
    return pro;
  }
}
