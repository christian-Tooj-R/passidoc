import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';
import { User } from './user.entity';
import { PartRubriqueRh, ChampCalculRubriqueRh } from './rubrique-paie-rh.entity';

export enum StatutVariablePaieRh {
  BROUILLON = 'BROUILLON',
  VALIDEE = 'VALIDEE',
  BULLETIN_GENERE = 'BULLETIN_GENERE',
}

export enum OrigineLignePaieRh {
  MANUELLE = 'MANUELLE',
  CONGE_ABSENCE = 'CONGE_ABSENCE',
  ACOMPTE = 'ACOMPTE',
}

export interface LignePaieLibreRh {
  libelle: string;
  montant: number;
  /** D'où vient cette ligne — permet de distinguer une saisie manuelle d'une donnée
   *  synchronisée automatiquement depuis les congés/absences ou les acomptes (MVP2). */
  origine?: OrigineLignePaieRh;
  /** Id de la ressource source (CongeAbsence.id ou AcompteSalarie.id) si origine !== MANUELLE */
  sourceId?: number;
}

/**
 * Surcharge PONCTUELLE, pour CE bulletin (salarié/mois/année) uniquement, d'une valeur
 * Nombre/Base/Taux d'une rubrique dont la part concernée a `saisieAutorisee = true`
 * (flag "S" de `ElementCalculPartRubriqueRh`, voir `rubrique-paie-rh.entity.ts`) — sans
 * modifier le paramétrage général de la rubrique (`RubriquePaieRh`), qui reste inchangé
 * pour tous les autres salariés/mois. Correspond à l'onglet "Rubriques" du dialogue
 * "Bulletin du salarié" (~Sage 100 Paie & RH, voir Doc/MODULE_PAIE_RH_NOTES.md).
 *
 * Stockée ici (sur `VariablePaieRh`, le conteneur mensuel déjà existant par salarié), plutôt
 * que dans une nouvelle entité dédiée, pour rester cohérent avec le reste du mécanisme de
 * variables mensuelles et être automatiquement rechargée/appliquée par
 * `MoteurCalculPaieRhService.calculer()` à chaque calcul (aperçu ET génération) via
 * `BulletinsSalarieService.chargerContexte()`, sans changement de signature nécessaire.
 *
 * Ignorée silencieusement par le moteur si la rubrique n'existe plus, si la part visée n'a
 * pas `saisieAutorisee = true`, ou si `imputation !== COTISATION` pour une surcharge
 * `PATRONALE` — filet de sécurité serveur, ne fait jamais confiance à ce qu'envoie le
 * client sans revalidation contre le paramétrage réel de la rubrique.
 */
export interface SurchargeRubriquePaieRh {
  rubriqueCode: string;
  part: PartRubriqueRh;
  champ: ChampCalculRubriqueRh;
  valeur: number;
}

/**
 * Variables de paie saisies pour un collaborateur INTERNE AFYM, pour un mois/année donné
 * (heures sup, primes, absences, avantages en nature, retenues diverses). Sert d'entrée
 * au moteur de calcul du bulletin de salaire.
 *
 * Distincte de `VariablePaie` (module `backend/src/paie/`, employés des clients).
 *
 * MVP2 — intégration congés/absences : `absences` peut contenir des lignes `origine:
 * CONGE_ABSENCE` synchronisées automatiquement depuis `CongeAbsence` (statut APPROUVEE)
 * via `VariablesPaieRhService.synchroniserAbsences()`, en plus des lignes saisies à la
 * main. De même, `retenuesDiverses` peut contenir des lignes `origine: ACOMPTE`
 * synchronisées depuis `AcompteSalarie` via `synchroniserAcomptes()`.
 */
@Entity('paie_rh_variables')
@Unique(['salarieId', 'mois', 'annee'])
export class VariablePaieRh {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'salarieId' })
  salarie: User;

  @Column()
  salarieId: number;

  @Column({ type: 'int' })
  mois: number; // 1-12

  @Column({ type: 'int' })
  annee: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  heuresSupplementaires: number;

  /** % de majoration des heures sup — si non renseigné, valeur par défaut de ConstantePaieRh utilisée */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  tauxMajorationHeuresSup: number | null;

  @Column({ type: 'json', nullable: true })
  primes: LignePaieLibreRh[] | null;

  @Column({ type: 'json', nullable: true })
  absences: LignePaieLibreRh[] | null;

  @Column({ type: 'json', nullable: true })
  avantagesNature: LignePaieLibreRh[] | null;

  @Column({ type: 'json', nullable: true })
  retenuesDiverses: LignePaieLibreRh[] | null;

  /** Surcharges ponctuelles Nombre/Base/Taux pour CE bulletin — voir `SurchargeRubriquePaieRh`. */
  @Column({ type: 'json', nullable: true })
  surchargesRubriques: SurchargeRubriquePaieRh[] | null;

  @Column({ type: 'text', nullable: true })
  commentaire: string | null;

  @Column({ type: 'enum', enum: StatutVariablePaieRh, default: StatutVariablePaieRh.BROUILLON })
  statut: StatutVariablePaieRh;

  @Column({ nullable: true })
  createdById: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
