import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum BaseCalculRubrique {
  BRUT = 'BRUT',
  SALAIRE_BASE = 'SALAIRE_BASE',
  FIXE = 'FIXE',
}

export enum ImputationRubrique {
  COTISATION = 'COTISATION',
  PRIME = 'PRIME',
  RETENUE = 'RETENUE',
  AUTRE = 'AUTRE',
}

/**
 * Table de PARAMÉTRAGE des rubriques de paie (cotisations, primes fixes, retenues fixes...).
 *
 * Principe fondamental de ce module : aucun taux/plafond n'est codé en dur dans le moteur
 * de calcul (`moteur-calcul-paie.service.ts`). Tout passe par cette table, éditable depuis
 * l'admin, rattachée à un régime (pôle/pays) via `regimePaieCode` plutôt que par un
 * branchement conditionnel "if site === REUNION" dans le code.
 *
 * Les taux insérés automatiquement (`estPlaceholder = true`) sont des valeurs d'EXEMPLE non
 * vérifiées — voir Doc/MODULE_PAIE_NOTES.md avant toute utilisation en production réelle.
 */
@Entity('paie_rubriques')
export class RubriquePaie {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  @Column()
  code: string;

  @Column()
  libelle: string;

  /** 'REUNION' | 'MADAGASCAR' | 'TOUS' | tout autre code de régime créé par l'admin */
  @Column({ default: 'TOUS' })
  regimePaieCode: string;

  @Column({ type: 'enum', enum: BaseCalculRubrique, default: BaseCalculRubrique.BRUT })
  baseCalcul: BaseCalculRubrique;

  /** Plafond mensuel optionnel appliqué à la base de calcul (ex: plafond sécurité sociale) */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  plafondMensuel: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 3, nullable: true })
  tauxSalarial: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 3, nullable: true })
  tauxPatronal: number | null;

  /** Montant fixe part salariale (remplace le calcul par taux salarial si renseigné) */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  montantFixe: number | null;

  @Column({ type: 'enum', enum: ImputationRubrique, default: ImputationRubrique.COTISATION })
  imputation: ImputationRubrique;

  @Column({ type: 'int', default: 0 })
  ordreAffichage: number;

  @Column({ default: true })
  isActive: boolean;

  /** true = ligne d'exemple générée automatiquement, À VALIDER avant toute utilisation réelle */
  @Column({ default: false })
  estPlaceholder: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
