import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

/**
 * Budget temps d'un dossier pour UNE affaire (exercice comptable, code « C2026-09 ») —
 * cahier v2 #6 « Suivi budgétaire et rentabilité par dossier (Boni/Mali) ».
 *
 * Porte sur la mission comptable (honoraires comptables) : le temps consommé est le temps
 * FACTURABLE saisi sur le dossier pour cette affaire, hors missions facturées à part
 * (social, juridique, conseil — cf. MISSIONS_HORS_COMPTA dans rentabilite.service.ts).
 *
 * Un budget par affaire (et non un seul par dossier) pour que la révision des honoraires
 * d'une année ne fausse pas le boni/mali des années précédentes.
 */
@Entity('budgets_dossiers')
@Unique(['clientId', 'affaire'])
export class BudgetDossier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  @Column()
  clientId: number;

  @Column({ type: 'varchar', length: 10 })
  affaire: string;

  /** Budget temps alloué (heures). */
  @Column({ type: 'float' })
  heuresBudget: number;

  /** Honoraires comptables de l'affaire (€ HT). Null = reprendre ceux de la fiche identité. */
  @Column({ type: 'float', nullable: true })
  honoraires: number | null;

  /** Prix de vente horaire saisi manuellement. Null = calculé (honoraires ÷ heures budget). */
  @Column({ type: 'float', nullable: true })
  prixVenteHoraire: number | null;

  /** Alertes de consommation déjà envoyées (80 % puis 100 % du budget) — évite de
   *  re-notifier à chaque saisie ; remises à zéro si le budget est relevé. */
  @Column({ type: 'timestamp', nullable: true })
  alerte80At: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  alerte100At: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
