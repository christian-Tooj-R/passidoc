import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

/**
 * Nature de la rubrique — reprend le vocabulaire du CDC Sage (PAY-002) : une cotisation
 * porte à la fois un taux salarial et un taux patronal sur la même ligne (comme le
 * fait `RubriquePaie` du module paie clients), COTISATION seule donc plutôt que deux
 * variantes salariale/patronale séparées.
 */
export enum ImputationRubriqueRh {
  COTISATION = 'COTISATION',
  PRIME = 'PRIME',
  RETENUE = 'RETENUE',
  AVANTAGE = 'AVANTAGE',
  INFORMATION = 'INFORMATION',
}

/**
 * Nature « arborescence » telle qu'observée dans le panneau gauche de la fenêtre Sage
 * « Liste des rubriques » (Toutes les rubriques > de brut / de cotisation / non soumises).
 * ⚠️ Volontairement PAS une colonne stockée en base : c'est une fonction pure dérivée de
 * `ImputationRubriqueRh`, pour ne jamais avoir deux champs qui peuvent se désynchroniser
 * (une seule source de vérité pour "à quoi sert cette rubrique dans le calcul") — voir
 * `deriverNatureRubriqueRh()` ci-dessous et Doc/MODULE_PAIE_RH_NOTES.md.
 */
export enum NatureRubriqueRh {
  DE_BRUT = 'DE_BRUT',
  DE_COTISATION = 'DE_COTISATION',
  NON_SOUMISE = 'NON_SOUMISE',
}

export function deriverNatureRubriqueRh(imputation: ImputationRubriqueRh): NatureRubriqueRh {
  switch (imputation) {
    case ImputationRubriqueRh.COTISATION:
      return NatureRubriqueRh.DE_COTISATION;
    case ImputationRubriqueRh.PRIME:
    case ImputationRubriqueRh.AVANTAGE:
      return NatureRubriqueRh.DE_BRUT;
    case ImputationRubriqueRh.RETENUE:
    case ImputationRubriqueRh.INFORMATION:
    default:
      return NatureRubriqueRh.NON_SOUMISE;
  }
}

/**
 * Type de calcul d'une rubrique — LISTE FERMÉE (enum), jamais un texte libre. Reprend le
 * menu déroulant fermé observé dans l'onglet « Éléments constitutifs » Sage (analyse
 * vidéo, voir Doc/MODULE_PAIE_RH_NOTES.md), simplifié : Sage distingue aussi des variantes
 * symétriques (Taux/Base, Nombre/Base, Taux×Nombre/Base) jugées redondantes pour notre
 * moteur — voir note "Simplifications" dans Doc/MODULE_PAIE_RH_NOTES.md pour le détail de
 * ce choix.
 */
export enum TypeCalculRubriqueRh {
  /** "Montant pris tel quel" — le champ Base porte directement le montant (littéral ou constante) */
  MONTANT_FIXE = 'MONTANT_FIXE',
  NOMBRE_X_BASE = 'NOMBRE_X_BASE',
  NOMBRE_X_BASE_X_TAUX = 'NOMBRE_X_BASE_X_TAUX',
  NOMBRE_X_TAUX = 'NOMBRE_X_TAUX',
  BASE_X_TAUX = 'BASE_X_TAUX',
  BASE_DIV_NOMBRE = 'BASE_DIV_NOMBRE',
  NOMBRE_DIV_TAUX = 'NOMBRE_DIV_TAUX',
  BASE_DIV_TAUX = 'BASE_DIV_TAUX',
  /** Totalise une autre rubrique (assiette) déjà calculée dans le bulletin — voir moteur */
  TOTALISATION = 'TOTALISATION',
}

/**
 * D'où provient la valeur d'un opérande Nombre/Base/Taux : une valeur saisie en dur, une
 * constante référencée (`ConstantePaieRh`, ouvre le "picker" côté front — jamais de texte
 * libre), ou une des deux grandeurs calculées disponibles pendant le calcul du bulletin.
 */
export enum SourceOperandeRubriqueRh {
  VALEUR = 'VALEUR',
  CONSTANTE = 'CONSTANTE',
  BRUT = 'BRUT',
  SALAIRE_BASE = 'SALAIRE_BASE',
}

export interface OperandeCalculRubriqueRh {
  source: SourceOperandeRubriqueRh;
  /** requis si source = VALEUR */
  valeur: number | null;
  /** requis si source = CONSTANTE — code de la ConstantePaieRh référencée */
  constanteCode: string | null;
}

/**
 * Quelle PART d'une rubrique (salariale ou patronale) — utilisé par le mécanisme de
 * "surcharge ponctuelle par bulletin" (`SurchargeRubriquePaieRh`, voir
 * `variable-paie-rh.entity.ts`) pour désigner sans ambiguïté quel `ElementCalculPartRubriqueRh`
 * (`elementSalarial` ou `elementPatronal`) est visé. Voir Doc/MODULE_PAIE_RH_NOTES.md,
 * section "Bulletin du salarié — dialogue riche".
 */
export enum PartRubriqueRh {
  SALARIALE = 'SALARIALE',
  PATRONALE = 'PATRONALE',
}

/**
 * Quel champ de la grille Nombre/Base/Taux d'une part est surchargé pour UN bulletin
 * précis — voir `SurchargeRubriquePaieRh`.
 */
export enum ChampCalculRubriqueRh {
  NOMBRE = 'nombre',
  BASE = 'base',
  TAUX = 'taux',
}

/**
 * Une "ligne" (part salariale OU part patronale) de la grille Nombre/Base/Taux/Montant de
 * l'onglet "Éléments constitutifs" Sage. Le Montant n'est JAMAIS stocké ici : toujours
 * "(Calculé)" au moment du bulletin par le moteur de calcul.
 *
 * Flags R/I/S — SIMPLIFICATION ASSUMÉE par rapport à Sage (qui a 3 cases par COLONNE
 * Nombre/Base/Taux/Montant, soit 9 cases par part) : nous n'avons gardé qu'un seul jeu de
 * 3 cases PAR PART (6 cases au total pour une cotisation), le niveau "par colonne" n'
 * apportant pas de valeur réelle dans notre moteur (Nombre/Base/Taux sont des objets
 * structurés {source, valeur, constanteCode}, pas des cellules de saisie libre indépendantes
 * les unes des autres). Voir Doc/MODULE_PAIE_RH_NOTES.md.
 * - `reportApresCloture` (R) : information stockée, NON câblée dans le moteur v1 (le report
 *   d'un solde après clôture de période nécessiterait une logique inter-période hors
 *   périmètre de cette refonte) — limitation documentée, pas une fonctionnalité inventée.
 * - `impressionBulletin` (I) : câblée réellement — contrôle `LigneBulletinRh.imprimable`,
 *   consommée par la génération PDF et l'aperçu front (voir moteur-calcul-paie-rh.service.ts).
 * - `saisieAutorisee` (S) : information stockée, NON câblée dans le moteur v1 (permettrait
 *   une saisie variable de dérogation ligne à ligne à la génération du bulletin — hors
 *   périmètre, mais le champ existe pour ne pas refermer la porte).
 */
export interface ElementCalculPartRubriqueRh {
  nombre: OperandeCalculRubriqueRh;
  base: OperandeCalculRubriqueRh;
  taux: OperandeCalculRubriqueRh;
  reportApresCloture: boolean;
  impressionBulletin: boolean;
  saisieAutorisee: boolean;
}

export const operandeParDefaut = (valeur: number | null = null): OperandeCalculRubriqueRh => ({
  source: SourceOperandeRubriqueRh.VALEUR,
  valeur,
  constanteCode: null,
});

export const elementParDefaut = (): ElementCalculPartRubriqueRh => ({
  nombre: operandeParDefaut(1),
  base: operandeParDefaut(0),
  taux: operandeParDefaut(0),
  reportApresCloture: false,
  impressionBulletin: true,
  saisieAutorisee: false,
});

/**
 * Table de PARAMÉTRAGE des rubriques de paie des collaborateurs INTERNES AFYM
 * (distincte de `RubriquePaie` du module `backend/src/paie/`, qui concerne les employés
 * des CLIENTS d'AFYM — voir Doc/MODULE_PAIE_RH_NOTES.md).
 *
 * REFONTE (~Sage 100 Paie & RH, voir Doc/MODULE_PAIE_RH_NOTES.md section dédiée) : le
 * modèle "un taux OU un montant fixe" a été remplacé par un calcul GUIDÉ (`typeCalcul`
 * fermé + grille Nombre/Base/Taux par part salariale/patronale, chaque opérande pouvant
 * référencer une `ConstantePaieRh` au lieu d'une valeur en dur).
 *
 * Principe fondamental inchangé : aucun taux/plafond n'est codé en dur dans le moteur de
 * calcul (`moteur-calcul-paie-rh.service.ts`). Tout passe par cette table + par
 * `ConstantePaieRh`, éditables depuis l'admin RH, rattachées à un régime (pôle/pays) via
 * `regimePaieCode` plutôt que par un branchement conditionnel "if site === REUNION".
 *
 * Les rubriques insérées automatiquement (`estPlaceholder = true`) sont des valeurs
 * d'EXEMPLE non vérifiées — voir Doc/MODULE_PAIE_RH_NOTES.md avant toute utilisation
 * en production réelle.
 */
@Entity('paie_rh_rubriques')
export class RubriquePaieRh {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  tenantId: number;

  @Column()
  code: string;

  @Column()
  libelle: string;

  /** Mémo — code court affiché dans les grilles (ex. Sage "INDLOG") */
  @Column({ type: 'varchar', nullable: true })
  memo: string | null;

  /** 'REUNION' | 'MADAGASCAR' | 'TOUS' | tout autre code de régime créé par l'admin */
  @Column({ default: 'TOUS' })
  regimePaieCode: string;

  /**
   * Date d'effet — historisation par date, à l'image de `ConstantePaieRh.dateEffet` :
   * plusieurs lignes peuvent partager le même `code`, le moteur résout toujours la ligne
   * dont `dateEffet` est la plus récente ≤ la date de référence du calcul (fin de la
   * période paie concernée). Voir `RubriquesPaieRhService.findByRegime()`.
   */
  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  dateEffet: string;

  @Column({ type: 'enum', enum: TypeCalculRubriqueRh, default: TypeCalculRubriqueRh.MONTANT_FIXE })
  typeCalcul: TypeCalculRubriqueRh;

  /**
   * Part salariale — toujours renseignée pour toute rubrique créée via l'application
   * (imposé par le DTO/service, pas par une contrainte SQL) ; nullable en base pour ne
   * pas casser les lignes créées avant l'introduction de ce champ (ancien modèle taux/montant).
   */
  @Column({ type: 'json', nullable: true })
  elementSalarial: ElementCalculPartRubriqueRh | null;

  /** Part patronale — renseignée uniquement si `imputation = COTISATION` */
  @Column({ type: 'json', nullable: true })
  elementPatronal: ElementCalculPartRubriqueRh | null;

  /**
   * "Assiette de calcul des bases de cotisation" (Sage) — code d'une AUTRE rubrique (ou
   * pseudo-code 'BRUT'/'SALAIRE_BASE') dont le montant déjà calculé sert de Base commune
   * aux deux parts de CETTE rubrique, à la place des opérandes Base propres à chaque part.
   * SIMPLIFICATION : une assiette référence le montant TOTAL (calculé) d'une autre
   * rubrique (généralement une rubrique de type TOTALISATION représentant le "Brut
   * soumis"), appliqué IDENTIQUEMENT aux deux parts — pas de sélection arbitraire de
   * plusieurs rubriques ni de filtre par nature. Voir Doc/MODULE_PAIE_RH_NOTES.md.
   */
  @Column({ type: 'varchar', nullable: true })
  assietteRubriqueCode: string | null;

  /**
   * "Report de l'assiette" (Sage) — case cochée mais NON câblée dans le moteur v1 (le
   * report d'assiette d'une période sur l'autre est hors périmètre de cette refonte,
   * limitation documentée plutôt qu'un comportement inventé).
   */
  @Column({ default: false })
  reportAssiette: boolean;

  /** Plafond mensuel optionnel appliqué à la Base résolue (ex: plafond sécurité sociale) */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  plafondMensuel: number | null;

  @Column({ type: 'enum', enum: ImputationRubriqueRh, default: ImputationRubriqueRh.COTISATION })
  imputation: ImputationRubriqueRh;

  @Column({ type: 'int', default: 0 })
  ordreAffichage: number;

  @Column({ default: true })
  isActive: boolean;

  /** true = ligne d'exemple générée automatiquement, À VALIDER avant toute utilisation réelle */
  @Column({ default: false })
  estPlaceholder: boolean;

  /** Code d'imputation comptable (ex: 641, 645...) — informatif, pour l'export comptable V1 */
  @Column({ type: 'varchar', nullable: true })
  compteComptable: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
