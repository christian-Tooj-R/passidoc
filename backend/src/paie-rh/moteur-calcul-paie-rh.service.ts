import { Injectable } from '@nestjs/common';
import { ContratTravail } from '../entities/contrat-travail.entity';
import { VariablePaieRh, LignePaieLibreRh } from '../entities/variable-paie-rh.entity';
import {
  ChampCalculRubriqueRh, ElementCalculPartRubriqueRh, ImputationRubriqueRh, OperandeCalculRubriqueRh,
  PartRubriqueRh, RubriquePaieRh, SourceOperandeRubriqueRh, TypeCalculRubriqueRh,
} from '../entities/rubrique-paie-rh.entity';
import { ConstantePaieRh } from '../entities/constante-paie-rh.entity';
import { LigneBulletinRh } from '../entities/bulletin-salarie.entity';
import { resoudreConstante } from './constante-resolution.util';

export interface ResultatCalculPaieRh {
  salaireBase: number;
  totalBrut: number;
  totalCotisationsSalariales: number;
  totalCotisationsPatronales: number;
  netImposable: number;
  netAPayer: number;
  coutEmployeur: number;
  detailRubriques: LigneBulletinRh[];
  /** décomposition intermédiaire, utile pour l'affichage/preview côté front */
  detailBrut: {
    salaireBase: number;
    montantHeuresSupplementaires: number;
    totalPrimesVariables: number;
    totalAvantagesNature: number;
    totalAbsences: number;
  };
}

const sommeLignes = (lignes: LignePaieLibreRh[] | null | undefined): number =>
  (lignes ?? []).reduce((acc, l) => acc + (Number(l.montant) || 0), 0);

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Types de calcul pour lesquels un "taux" a un sens à l'affichage (les autres montrent "-"). */
const TYPES_CALCUL_AVEC_TAUX = new Set<TypeCalculRubriqueRh>([
  TypeCalculRubriqueRh.BASE_X_TAUX,
  TypeCalculRubriqueRh.NOMBRE_X_BASE_X_TAUX,
  TypeCalculRubriqueRh.NOMBRE_X_TAUX,
  TypeCalculRubriqueRh.NOMBRE_DIV_TAUX,
  TypeCalculRubriqueRh.BASE_DIV_TAUX,
]);

/** Types de calcul pour lesquels un "nombre" a un sens à l'affichage (les autres montrent "-"). */
const TYPES_CALCUL_AVEC_NOMBRE = new Set<TypeCalculRubriqueRh>([
  TypeCalculRubriqueRh.NOMBRE_X_BASE,
  TypeCalculRubriqueRh.NOMBRE_X_BASE_X_TAUX,
  TypeCalculRubriqueRh.NOMBRE_X_TAUX,
  TypeCalculRubriqueRh.NOMBRE_DIV_TAUX,
  TypeCalculRubriqueRh.BASE_DIV_NOMBRE,
]);

/**
 * Moteur de calcul du bulletin de salaire des collaborateurs INTERNES AFYM.
 *
 * ⚠️ AUCUN taux, plafond ni règle Réunion/Madagascar n'est codé en dur ici : toutes les
 * valeurs viennent des tables de paramétrage (`RubriquePaieRh`, `ConstantePaieRh`),
 * sélectionnées via `contrat.regimePaieCode`. Voir
 * Doc/MODULE_PAIE_RH_NOTES.md pour le détail des hypothèses de simplification prises.
 *
 * REFONTE (~Sage 100 Paie & RH) : chaque `RubriquePaieRh` porte désormais un `typeCalcul`
 * (liste fermée) et une grille Nombre/Base/Taux par part salariale/patronale (au lieu d'un
 * simple taux ou montant fixe) — voir Doc/MODULE_PAIE_RH_NOTES.md, section dédiée, pour le
 * détail de cette évolution et les simplifications assumées par rapport à l'analyse vidéo
 * de référence. L'ARCHITECTURE GLOBALE de la méthode `calculer()` (brut → boucle rubriques
 * → cotisations → net imposable → net à payer → coût employeur) est INCHANGÉE : seule la
 * façon de calculer le montant d'UNE rubrique a été remplacée (voir `calculerPart()`
 * ci-dessous), pour ne pas casser l'intégration congés/absences, acomptes, cycle mensuel et
 * génération PDF qui consomment le résultat de cette méthode.
 */
@Injectable()
export class MoteurCalculPaieRhService {
  calculer(
    contrat: ContratTravail,
    variable: VariablePaieRh | null,
    rubriques: RubriquePaieRh[],
    constantes: ConstantePaieRh[] = [],
  ): ResultatCalculPaieRh {
    // Le salaire de base du contrat est une référence temps plein (100%) ; la quotité de
    // travail (%) le proratise en salaire mensuel effectif. Actuellement tous les contrats
    // de démo ont quotiteTravail=100 (aucun changement de comportement visible), mais un
    // salarié à temps partiel doit voir son brut réellement réduit en proportion.
    const quotiteTravail = Number(contrat.quotiteTravail) || 100;
    const salaireBase = round2((Number(contrat.salaireBase) || 0) * (quotiteTravail / 100));

    const heuresSup = Number(variable?.heuresSupplementaires) || 0;
    const tauxMajorationHS =
      variable?.tauxMajorationHeuresSup != null
        ? Number(variable.tauxMajorationHeuresSup)
        : this.getConstanteValeur(constantes, 'TAUX_MAJORATION_HS_DEFAUT', 25);
    const heuresLegalesMois = this.getConstanteValeur(constantes, 'HEURES_LEGALES_MOIS', 151.67);

    const montantHeuresSupplementaires =
      heuresSup > 0 && heuresLegalesMois > 0
        ? round2((salaireBase / heuresLegalesMois) * (1 + tauxMajorationHS / 100) * heuresSup)
        : 0;

    const totalPrimesVariables = round2(sommeLignes(variable?.primes));
    const totalAvantagesNature = round2(sommeLignes(variable?.avantagesNature));
    const totalAbsences = round2(sommeLignes(variable?.absences));
    const totalRetenuesDiversesSaisies = round2(sommeLignes(variable?.retenuesDiverses));

    // Brut = base contractuelle - absences + heures sup + primes variables + avantages en nature
    const totalBrut = round2(
      salaireBase - totalAbsences + montantHeuresSupplementaires + totalPrimesVariables + totalAvantagesNature,
    );

    const detailRubriques: LigneBulletinRh[] = [];
    let totalCotisationsSalariales = 0;
    let totalCotisationsPatronales = 0;
    let totalAutresPrimesRubriques = 0;
    let totalAutresRetenuesRubriques = 0;

    const rubriquesActives = rubriques
      .filter((r) => r.isActive)
      .sort((a, b) => a.ordreAffichage - b.ordreAffichage);

    /**
     * Résout un opérande Nombre/Base/Taux : valeur littérale, constante référencée (via
     * `resoudreConstante()`, best-effort — une constante introuvable ne bloque pas tout le
     * bulletin, elle vaut 0, à l'image du comportement pré-existant pour un taux non
     * renseigné), ou grandeur globale déjà calculée (Brut / Salaire de base).
     */
    const resoudreOperande = (op: OperandeCalculRubriqueRh): number => {
      switch (op.source) {
        case SourceOperandeRubriqueRh.VALEUR:
          return Number(op.valeur) || 0;
        case SourceOperandeRubriqueRh.CONSTANTE:
          if (!op.constanteCode) return 0;
          try {
            return resoudreConstante(op.constanteCode, constantes);
          } catch {
            return 0;
          }
        case SourceOperandeRubriqueRh.BRUT:
          return totalBrut;
        case SourceOperandeRubriqueRh.SALAIRE_BASE:
          return salaireBase;
        default:
          return 0;
      }
    };

    // "Assiette de calcul des bases de cotisation" (Sage) : montants (calculés) des
    // rubriques déjà traitées, disponibles comme Base commune pour les rubriques
    // suivantes via `assietteRubriqueCode` — pré-alimenté avec les deux pseudo-codes
    // toujours disponibles ('BRUT', 'SALAIRE_BASE'), puis complété au fil du traitement.
    const montantsParCode = new Map<string, number>([
      ['BRUT', totalBrut],
      ['SALAIRE_BASE', salaireBase],
    ]);

    // Surcharges ponctuelles Nombre/Base/Taux "pour ce bulletin" (onglet "Rubriques" du
    // dialogue "Bulletin du salarié" — voir SurchargeRubriquePaieRh). Indexées par
    // `code|part|champ` pour un accès direct dans `calculerPart()`. Une surcharge n'est
    // JAMAIS appliquée si la part visée n'a pas `saisieAutorisee = true` — revalidation
    // serveur systématique, on ne fait jamais confiance à ce qu'envoie le client sans
    // vérifier contre le paramétrage réel de la rubrique (voir Doc/MODULE_PAIE_RH_NOTES.md).
    const surcharges = new Map<string, number>(
      (variable?.surchargesRubriques ?? []).map((s) => [`${s.rubriqueCode}|${s.part}|${s.champ}`, Number(s.valeur)]),
    );

    const calculerPart = (
      rubrique: RubriquePaieRh,
      element: ElementCalculPartRubriqueRh,
      part: PartRubriqueRh,
    ): { nombre: number; base: number; taux: number; montant: number } => {
      const valeurEffective = (champ: ChampCalculRubriqueRh, operande: OperandeCalculRubriqueRh): number => {
        if (element.saisieAutorisee) {
          const surcharge = surcharges.get(`${rubrique.code}|${part}|${champ}`);
          if (surcharge != null) return surcharge;
        }
        return resoudreOperande(operande);
      };

      const nombre = valeurEffective(ChampCalculRubriqueRh.NOMBRE, element.nombre);
      const taux = valeurEffective(ChampCalculRubriqueRh.TAUX, element.taux);

      let base: number;
      const baseSurchargee = element.saisieAutorisee
        ? surcharges.get(`${rubrique.code}|${part}|${ChampCalculRubriqueRh.BASE}`)
        : undefined;
      if (baseSurchargee != null) {
        base = baseSurchargee;
      } else if (rubrique.assietteRubriqueCode) {
        base = montantsParCode.get(rubrique.assietteRubriqueCode) ?? resoudreOperande(element.base);
      } else {
        base = resoudreOperande(element.base);
      }

      if (rubrique.plafondMensuel != null && rubrique.typeCalcul !== TypeCalculRubriqueRh.TOTALISATION) {
        base = Math.min(base, Number(rubrique.plafondMensuel));
      }

      let montant = 0;
      switch (rubrique.typeCalcul) {
        case TypeCalculRubriqueRh.MONTANT_FIXE:
          montant = base;
          break;
        case TypeCalculRubriqueRh.NOMBRE_X_BASE:
          montant = nombre * base;
          break;
        case TypeCalculRubriqueRh.NOMBRE_X_BASE_X_TAUX:
          montant = nombre * base * (taux / 100);
          break;
        case TypeCalculRubriqueRh.NOMBRE_X_TAUX:
          montant = nombre * (taux / 100);
          break;
        case TypeCalculRubriqueRh.BASE_X_TAUX:
          montant = base * (taux / 100);
          break;
        case TypeCalculRubriqueRh.BASE_DIV_NOMBRE:
          montant = nombre !== 0 ? base / nombre : 0;
          break;
        case TypeCalculRubriqueRh.NOMBRE_DIV_TAUX:
          montant = taux !== 0 ? nombre / (taux / 100) : 0;
          break;
        case TypeCalculRubriqueRh.BASE_DIV_TAUX:
          montant = taux !== 0 ? base / (taux / 100) : 0;
          break;
        case TypeCalculRubriqueRh.TOTALISATION:
          // Simplification assumée : notre moteur ne totalise QUE le Brut global déjà
          // calculé (pas de sélection arbitraire de rubriques par assiette pour ce type)
          // — voir Doc/MODULE_PAIE_RH_NOTES.md.
          base = totalBrut;
          montant = totalBrut;
          break;
      }
      return { nombre, base: round2(base), taux, montant: round2(montant) };
    };

    for (const r of rubriquesActives) {
      // `elementSalarial` peut être null pour une rubrique créée avant l'introduction de ce
      // champ (ancien modèle taux/montant) — traitée comme sans effet plutôt que de planter.
      const salarial = r.elementSalarial
        ? calculerPart(r, r.elementSalarial, PartRubriqueRh.SALARIALE)
        : { nombre: 0, base: 0, taux: 0, montant: 0 };
      const estCotisation = r.imputation === ImputationRubriqueRh.COTISATION;
      const patronal = estCotisation && r.elementPatronal
        ? calculerPart(r, r.elementPatronal, PartRubriqueRh.PATRONALE)
        : { nombre: 0, base: 0, taux: 0, montant: 0 };

      montantsParCode.set(r.code, round2(salarial.montant + patronal.montant));

      const avecTaux = TYPES_CALCUL_AVEC_TAUX.has(r.typeCalcul);
      const avecNombre = TYPES_CALCUL_AVEC_NOMBRE.has(r.typeCalcul);
      const imprimable = (r.elementSalarial?.impressionBulletin ?? false) || (r.elementPatronal?.impressionBulletin ?? false);

      detailRubriques.push({
        code: r.code,
        libelle: r.libelle,
        imputation: r.imputation,
        nombreSalarial: avecNombre ? salarial.nombre : null,
        base: salarial.base,
        tauxSalarial: avecTaux ? salarial.taux : null,
        montantSalarial: salarial.montant,
        nombrePatronal: estCotisation && avecNombre ? patronal.nombre : null,
        tauxPatronal: estCotisation && avecTaux ? patronal.taux : null,
        montantPatronal: patronal.montant,
        imprimable,
        typeCalcul: r.typeCalcul,
      });

      switch (r.imputation) {
        case ImputationRubriqueRh.COTISATION:
          totalCotisationsSalariales += salarial.montant;
          totalCotisationsPatronales += patronal.montant;
          break;
        case ImputationRubriqueRh.RETENUE:
          totalAutresRetenuesRubriques += salarial.montant;
          break;
        case ImputationRubriqueRh.PRIME:
        case ImputationRubriqueRh.AVANTAGE:
          totalAutresPrimesRubriques += salarial.montant;
          break;
        case ImputationRubriqueRh.INFORMATION:
          // Ligne informative uniquement (ex: total brut affiché) : n'impacte aucun total.
          break;
      }
    }

    totalCotisationsSalariales = round2(totalCotisationsSalariales);
    totalCotisationsPatronales = round2(totalCotisationsPatronales);

    // Simplification v1 : net imposable = brut - cotisations salariales (pas de distinction
    // CSG/CRDS déductible vs non déductible pour un futur régime France ; sans objet en
    // l'absence de régime France paramétré). Voir Doc/MODULE_PAIE_RH_NOTES.md.
    const netImposable = round2(totalBrut - totalCotisationsSalariales);

    // Net à payer = net imposable
    //   - avantages en nature (non versés en espèces, déjà inclus dans le brut/imposable)
    //   - retenues diverses saisies dans les variables du mois (acompte, saisie...)
    //   - retenues paramétrées au niveau rubrique
    //   + primes/avantages paramétrés au niveau rubrique
    const netAPayer = round2(
      netImposable -
        totalAvantagesNature -
        totalRetenuesDiversesSaisies -
        totalAutresRetenuesRubriques +
        totalAutresPrimesRubriques,
    );

    // Coût total employeur = brut + cotisations patronales (CDC §9.1 "calculer net à payer et
    // coût employeur"). N'inclut pas d'éventuelles charges hors paie (mutuelle collective,
    // taxes sur salaires...) qui ne seraient pas modélisées comme RubriquePaieRh.
    const coutEmployeur = round2(totalBrut + totalCotisationsPatronales);

    return {
      salaireBase: round2(salaireBase),
      totalBrut,
      totalCotisationsSalariales,
      totalCotisationsPatronales,
      netImposable,
      netAPayer,
      coutEmployeur,
      detailRubriques,
      detailBrut: {
        salaireBase: round2(salaireBase),
        montantHeuresSupplementaires,
        totalPrimesVariables,
        totalAvantagesNature,
        totalAbsences,
      },
    };
  }

  /**
   * Valeur d'une constante (~fusion Paramètres/Constantes — voir
   * Doc/MODULE_PAIE_RH_NOTES.md) avec repli sur un défaut si absente ou en erreur de
   * résolution (ex. référence circulaire) plutôt que de faire planter tout le calcul du
   * bulletin pour un réglage moteur manquant.
   */
  private getConstanteValeur(constantes: ConstantePaieRh[], code: string, defaut: number): number {
    try {
      return resoudreConstante(code, constantes);
    } catch {
      return defaut;
    }
  }
}
