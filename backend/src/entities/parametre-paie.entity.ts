import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * Paramètres scalaires du moteur de paie (diviseur horaire mensuel, taux de majoration
 * par défaut des heures supplémentaires, plafond sécurité sociale, etc.).
 *
 * Complète `RubriquePaie` : ici on stocke des CONSTANTES utilisées par le calcul plutôt
 * que des lignes de bulletin. Paramétrable par régime (`regimePaieCode`) — rien n'est
 * codé en dur dans le moteur. Voir Doc/MODULE_PAIE_NOTES.md.
 */
@Entity('paie_parametres')
export class ParametrePaie {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  /** ex: 'HEURES_LEGALES_MOIS', 'TAUX_MAJORATION_HS_DEFAUT', 'PLAFOND_SECU_MENSUEL' */
  @Column()
  code: string;

  @Column()
  libelle: string;

  @Column({ default: 'TOUS' })
  regimePaieCode: string;

  @Column({ type: 'decimal', precision: 12, scale: 4 })
  valeur: number;

  /** true = valeur d'exemple générée automatiquement, À VALIDER avant toute utilisation réelle */
  @Column({ default: false })
  estPlaceholder: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
