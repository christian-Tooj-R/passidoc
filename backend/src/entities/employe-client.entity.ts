import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';

export enum TypeContratEmployePaie {
  CDI = 'CDI',
  CDD = 'CDD',
  APPRENTISSAGE = 'APPRENTISSAGE',
  STAGE = 'STAGE',
  INTERIM = 'INTERIM',
  AUTRE = 'AUTRE',
}

/**
 * Employé d'une entreprise CLIENTE d'AFYM dont le cabinet gère la paie
 * (`FicheIdentite.cycleChargesPaie.gestionPaie === 'Internalisée cabinet'`).
 *
 * ⚠️ À NE PAS CONFONDRE avec :
 * - `Salarie` (backend/src/entities/salarie.entity.ts) : collaborateurs INTERNES AFYM (congés/absences),
 * - `User` : comptes utilisateurs de l'application Passidoc.
 *
 * Ce périmètre (employés des clients) est entièrement nouveau — voir Doc/MODULE_PAIE_NOTES.md.
 */
@Entity('paie_employes_clients')
export class EmployeClient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  @ManyToOne(() => Client, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column()
  clientId: number;

  @Column()
  matricule: string;

  @Column()
  nom: string;

  @Column()
  prenom: string;

  @Column({ nullable: true })
  poste: string;

  @Column({ type: 'date', nullable: true })
  dateEntree: string | null;

  @Column({ type: 'date', nullable: true })
  dateSortie: string | null;

  @Column({ type: 'enum', enum: TypeContratEmployePaie, default: TypeContratEmployePaie.CDI })
  typeContrat: TypeContratEmployePaie;

  /**
   * Salaire de base mensuel BRUT contractuel. Convention v1 : ce montant reflète déjà
   * la quotité de travail de l'employé (pas de recalcul automatique depuis un temps plein).
   * Voir Doc/MODULE_PAIE_NOTES.md — "Quotité de travail".
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  salaireBase: number;

  /** Quotité de travail en % (100 = temps plein). Champ informatif en v1. */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 100 })
  quotiteTravail: number;

  /**
   * Code de régime de paie utilisé pour sélectionner les rubriques/paramètres applicables
   * (ex: 'REUNION', 'MADAGASCAR', ou tout autre code créé dans l'admin). Initialisé depuis
   * `client.site` à la création mais surchargeable par employé — voir RubriquePaie.regimePaieCode.
   * Aucune règle Réunion/Madagascar n'est codée en dur : tout passe par ce code + les tables
   * de paramétrage (RubriquePaie, ParametrePaie).
   */
  @Column()
  regimePaieCode: string;

  @Column({ default: true })
  isActive: boolean;

  /** Champ extensible (IBAN, contact, n° sécurité sociale...) — pattern repris de Salarie.meta */
  @Column({ type: 'json', nullable: true })
  meta: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
