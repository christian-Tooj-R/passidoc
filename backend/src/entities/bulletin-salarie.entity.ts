import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export interface LigneBulletinRh {
  code: string;
  libelle: string;
  imputation: string;
  /**
   * Nombre résolu (Nombre/Base/Taux) — optionnel : absent des bulletins générés AVANT
   * l'ajout de ce champ (onglet "Rubriques" du dialogue "Bulletin du salarié", voir
   * Doc/MODULE_PAIE_RH_NOTES.md) et `null` pour un type de calcul où "Nombre" n'a pas de
   * sens (ex: MONTANT_FIXE, BASE_X_TAUX) — dans les deux cas, affiché "-" côté front.
   */
  nombreSalarial?: number | null;
  base: number;
  tauxSalarial: number | null;
  montantSalarial: number;
  nombrePatronal?: number | null;
  tauxPatronal: number | null;
  montantPatronal: number;
  /**
   * Refonte ~Sage (voir Doc/MODULE_PAIE_RH_NOTES.md) : correspond au flag "Impression
   * bulletin" (I) de `ElementCalculPartRubriqueRh` — true si au moins une des deux parts
   * (salariale/patronale) de la rubrique a `impressionBulletin = true`. Câblé réellement
   * dans le PDF et l'aperçu front (contrairement aux flags R/report et S/saisie, stockés
   * mais non consommés en v1 — limitation documentée).
   */
  imprimable: boolean;
  /** Type de calcul appliqué (ex. "BASE_X_TAUX") — purement informatif pour l'affichage/debug. */
  typeCalcul?: string;
}

/**
 * Bulletin de salaire généré et figé pour un collaborateur INTERNE AFYM, pour un
 * mois/année donné. `detailRubriques` est un SNAPSHOT des lignes calculées au moment de
 * la génération : si les rubriques/paramètres sont modifiés plus tard, les bulletins déjà
 * générés ne changent pas rétroactivement (traçabilité — CDC §9.2 PAY-009/critères
 * d'acceptation §34).
 *
 * Distincte de `BulletinPaie` (module `backend/src/paie/`, employés des clients).
 *
 * V1 (best-effort) : `version`/`estRegularisation`/`bulletinOrigineId` permettent un
 * duplicata ou un bulletin correctif SANS écraser l'original (CDC BUL-007/BUL-008).
 */
@Entity('paie_rh_bulletins')
export class BulletinSalarie {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'salarieId' })
  salarie: User;

  @Column()
  salarieId: number;

  @Column({ type: 'int', nullable: true })
  contratTravailId: number | null;

  @Column({ type: 'int', nullable: true })
  variablePaieRhId: number | null;

  @Column({ type: 'int', nullable: true })
  cyclePaieRhId: number | null;

  @Column({ type: 'int' })
  mois: number;

  @Column({ type: 'int' })
  annee: number;

  @Column({ nullable: true })
  regimePaieCode: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  salaireBase: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalBrut: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalCotisationsSalariales: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalCotisationsPatronales: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  netImposable: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  netAPayer: number;

  /** Coût total employeur = totalBrut + totalCotisationsPatronales (CDC §9.1) */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  coutEmployeur: number;

  @Column({ type: 'json' })
  detailRubriques: LigneBulletinRh[];

  /* ── Paiement (MVP2) — donnée informative, PAS d'intégration bancaire réelle ────── */

  @Column({ type: 'date', nullable: true })
  datePaiement: string | null;

  @Column({ type: 'varchar', nullable: true })
  modePaiement: string | null; // VIREMENT | ESPECES | CHEQUE — mêmes valeurs que User.modePaiement

  @Column({ type: 'varchar', nullable: true })
  referencePaiement: string | null;

  /* ── Duplicata / régularisation (V1, best-effort) ──────────────────────────────── */

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ default: false })
  estRegularisation: boolean;

  @Column({ type: 'int', nullable: true })
  bulletinOrigineId: number | null;

  /** Hash SHA-256 du PDF généré, pour traçabilité documentaire (CDC BUL-006) */
  @Column({ type: 'varchar', nullable: true })
  pdfHash: string | null;

  /** true = calculé avec au moins une rubrique/un paramètre marqué estPlaceholder */
  @Column({ default: false })
  estPlaceholder: boolean;

  @CreateDateColumn()
  dateGeneration: Date;
}
