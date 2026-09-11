import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum TypeContratTravail {
  CDI = 'CDI',
  CDD = 'CDD',
  APPRENTISSAGE = 'APPRENTISSAGE',
  STAGE = 'STAGE',
  INTERIM = 'INTERIM',
  AUTRE = 'AUTRE',
}

export enum StatutContratTravail {
  ACTIF = 'ACTIF',
  SUSPENDU = 'SUSPENDU',
  ROMPU = 'ROMPU',
}

export interface HistoriqueContratEntry {
  date: string;
  champ: string;
  ancienneValeur: unknown;
  nouvelleValeur: unknown;
  auteurId: number | null;
  motif: string | null;
}

/**
 * Contrat de travail d'un collaborateur INTERNE AFYM (`User`).
 *
 * ⚠️ À NE PAS CONFONDRE avec :
 * - `EmployeClient` (backend/src/entities/employe-client.entity.ts) : employés des
 *   entreprises CLIENTES d'AFYM dont le cabinet gère la paie externalisée (module
 *   `backend/src/paie/`, non modifié) ;
 * - `Salarie` (backend/src/entities/salarie.entity.ts, table `salaries_dossier`) : dossier
 *   KYC d'un employé d'un CLIENT (rattaché à `Client`), sans lien avec les collaborateurs AFYM.
 *
 * Le salarié AFYM lui-même est un `User` (voir `user.entity.ts` — il porte déjà `site`,
 * `salaireBase`, `typeContrat`, `matricule`, `banque`, `iban`...). Ce module (`paie-rh`)
 * ajoute la couche CONTRAT + MOTEUR DE CALCUL + BULLETIN par-dessus `User`, sans dupliquer
 * ses champs d'identité. Voir Doc/MODULE_PAIE_RH_NOTES.md pour le détail de cette décision.
 *
 * Historisation (MVP1, simplifiée) : les avenants ne créent pas une nouvelle ligne — les
 * changements de champs sensibles (salaire, quotité, poste contractuel...) sont journalisés
 * dans `historique` (JSON) à chaque modification, avec ancienne/nouvelle valeur, auteur, date
 * et motif. Une vraie ligne d'avenant versionnée est un axe d'amélioration V-suivant.
 */
@Entity('paie_rh_contrats')
export class ContratTravail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'salarieId' })
  salarie: User;

  @Column()
  salarieId: number;

  @Column({ type: 'enum', enum: TypeContratTravail, default: TypeContratTravail.CDI })
  typeContrat: TypeContratTravail;

  @Column({ type: 'date' })
  dateDebut: string;

  @Column({ type: 'date', nullable: true })
  dateFin: string | null;

  @Column({ type: 'enum', enum: StatutContratTravail, default: StatutContratTravail.ACTIF })
  statut: StatutContratTravail;

  /** Quotité de travail en % (100 = temps plein). Champ informatif en v1 (cf. EmployeClient). */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 100 })
  quotiteTravail: number;

  /** Salaire de base mensuel BRUT contractuel. */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  salaireBase: number;

  /**
   * Code de régime de paie utilisé pour sélectionner les rubriques/paramètres applicables
   * (ex: 'REUNION', 'MADAGASCAR', ou tout autre code créé dans l'admin). Initialisé depuis
   * `user.site` à la création mais surchargeable par contrat — voir RubriquePaieRh.regimePaieCode.
   * Aucune règle Réunion/Madagascar n'est codée en dur : tout passe par ce code + les tables
   * de paramétrage (RubriquePaieRh, ConstantePaieRh).
   */
  @Column()
  regimePaieCode: string;

  @Column({ type: 'text', nullable: true })
  motifFin: string | null;

  @Column({ type: 'json', nullable: true })
  historique: HistoriqueContratEntry[] | null;

  @Column({ nullable: true })
  createdById: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
