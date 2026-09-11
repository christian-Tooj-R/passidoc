import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

/**
 * Type d'une constante de paie RH — reprend la distinction observée dans la « Liste des
 * constantes » Sage 100 Paie & RH (analyse vidéo — voir Doc/MODULE_PAIE_RH_NOTES.md,
 * section "Refonte rubriques/constantes ~Sage") : soit une valeur saisie directement
 * (`VALEUR`), soit une valeur calculée par composition d'autres constantes/valeurs
 * (`CALCUL`, ex. Sage "EV_HP22", "EV_HRSCAL").
 */
export enum TypeConstantePaieRh {
  VALEUR = 'VALEUR',
  CALCUL = 'CALCUL',
}

/** Arrondi appliqué à la valeur résolue d'une constante — options observées dans Sage. */
export enum ArrondiConstantePaieRh {
  AUCUN = 'AUCUN',
  PLUS_PROCHE = 'PLUS_PROCHE',
}

export enum OperateurCalculConstante {
  ADDITION = '+',
  SOUSTRACTION = '-',
  MULTIPLICATION = '*',
  DIVISION = '/',
}

export enum SourceOperandeConstante {
  /** Référence une autre constante par son code (chaînage — jamais de texte libre) */
  CONSTANTE = 'CONSTANTE',
  /** Valeur littérale saisie directement dans la grille d'opérandes */
  VALEUR = 'VALEUR',
}

/**
 * Un « opérande » de la grille de composition d'une constante `CALCUL` — reproduit la
 * grille Sage "op / Code / Intitulé" avec les boutons "Insérer constante(s)" / "Insérer
 * valeur". Résolution (voir `resoudreConstante()` dans `paie-rh/constante-resolution.util.ts`) :
 * le 1er opérande de la liste fixe la valeur de départ (son opérateur n'a de sens que pour
 * un signe négatif via SOUSTRACTION), puis chaque opérande suivant applique son opérateur
 * à l'accumulateur — permet de chaîner additions/soustractions ET multiplications/divisions.
 */
export interface OperandeConstantePaieRh {
  operateur: OperateurCalculConstante;
  source: SourceOperandeConstante;
  /** requis si source = CONSTANTE */
  constanteCode: string | null;
  /** requis si source = VALEUR */
  valeur: number | null;
}

/**
 * « Liste des constantes » (Sage) — objet séparé et composable référencé depuis les
 * rubriques de paie (`RubriquePaieRh`, champs Nombre/Base/Taux) au lieu d'une valeur en
 * dur. Historisée par date d'effet : plusieurs lignes peuvent partager le même `code`
 * avec des `dateEffet` différentes — le moteur de calcul résout toujours la ligne dont
 * `dateEffet` est la plus récente ≤ la date de référence du calcul (fin de la période
 * paie concernée). Voir `ConstantesPaieRhService.resoudre()`.
 *
 * ⚠️ Aucune valeur n'est inventée : les constantes générées automatiquement
 * (`estPlaceholder = true`) sont des EXEMPLES à valider — voir
 * Doc/MODULE_PAIE_RH_NOTES.md.
 */
@Entity('paie_rh_constantes')
@Index(['tenantId', 'code'])
export class ConstantePaieRh {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  @Column()
  code: string;

  @Column()
  libelle: string;

  /** Mémo — code court affiché dans les grilles, ex. "PLAF_SECU" */
  @Column({ type: 'varchar', nullable: true })
  memo: string | null;

  /** 'REUNION' | 'MADAGASCAR' | 'TOUS' | tout autre code de régime créé par l'admin */
  @Column({ default: 'TOUS' })
  regimePaieCode: string;

  @Column({ type: 'enum', enum: TypeConstantePaieRh, default: TypeConstantePaieRh.VALEUR })
  typeConstante: TypeConstantePaieRh;

  /** Valeur directe — utilisée si typeConstante = VALEUR ; ignorée (null) si CALCUL. */
  @Column({ type: 'decimal', precision: 14, scale: 4, nullable: true })
  valeur: number | null;

  /** Grille d'opérandes — utilisée uniquement si typeConstante = CALCUL. */
  @Column({ type: 'json', nullable: true })
  operandes: OperandeConstantePaieRh[] | null;

  @Column({ type: 'enum', enum: ArrondiConstantePaieRh, default: ArrondiConstantePaieRh.AUCUN })
  arrondi: ArrondiConstantePaieRh;

  /** Date d'effet — permet l'historisation (plusieurs lignes du même code dans le temps) */
  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  dateEffet: string;

  /** Visible dans la liste/le picker de constantes (case "Visible" du formulaire Sage) */
  @Column({ default: true })
  visible: boolean;

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
