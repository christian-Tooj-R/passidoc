import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';

/**
 * Statut d'une valeur d'activité journalière — reprend le principe RADIAN/URA :
 * "on doit initialiser les calculs avant de pouvoir faire le calcul", et une valeur
 * corrigée à la main reste protégée du recalcul automatique sauf case
 * "Recalculer les modifications manuelles" cochée.
 */
export enum StatutValeurActiviteRh {
  EN_ATTENTE = 'EN_ATTENTE',
  CALCULE = 'CALCULE',
  MODIFIE_MANUEL = 'MODIFIE_MANUEL',
}

/**
 * Une valeur d'activité journalière, pour un salarié / une variable / un jour donné
 * (~"Feuille d'activité" RADIAN — voir `ActiviteJourRhService`). Catalogue des variables
 * fixé en v1 (voir `CATALOGUE_VARIABLES_ACTIVITE` dans le service) — pas de "Gestion de
 * variables" générique/administrable comme dans RADIAN, hors scope pour l'instant.
 *
 * Distincte de `VariablePaieRh` (résumé MENSUEL par salarié — primes/absences/retenues en
 * lignes libres, entrée du moteur de calcul du bulletin) : celle-ci est un historique
 * JOURNALIER par variable nommée (Présence, Absence, Heures travaillées, Heures sup),
 * consultable en grille journalière/hebdomadaire/mensuelle/annuelle.
 */
@Entity('paie_rh_activite_jour')
@Unique(['salarieId', 'variableCode', 'date'])
export class ValeurActiviteRh {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  @Column()
  salarieId: number;

  @Column({ type: 'varchar', length: 40 })
  variableCode: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 })
  valeur: number;

  @Column({ type: 'enum', enum: StatutValeurActiviteRh, default: StatutValeurActiviteRh.EN_ATTENTE })
  statut: StatutValeurActiviteRh;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
