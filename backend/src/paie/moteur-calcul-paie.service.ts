import { Injectable } from '@nestjs/common';
import { EmployeClient } from '../entities/employe-client.entity';
import { VariablePaie, LignePaieLibre } from '../entities/variable-paie.entity';
import { BaseCalculRubrique, ImputationRubrique, RubriquePaie } from '../entities/rubrique-paie.entity';
import { ParametrePaie } from '../entities/parametre-paie.entity';
import { LigneBulletin } from '../entities/bulletin-paie.entity';

export interface ResultatCalculPaie {
  salaireBase: number;
  totalBrut: number;
  totalCotisationsSalariales: number;
  totalCotisationsPatronales: number;
  netImposable: number;
  netAPayer: number;
  detailRubriques: LigneBulletin[];
  /** décomposition intermédiaire, utile pour l'affichage/preview côté front */
  detailBrut: {
    salaireBase: number;
    montantHeuresSupplementaires: number;
    totalPrimesVariables: number;
    totalAvantagesNature: number;
    totalAbsences: number;
  };
}

const sommeLignes = (lignes: LignePaieLibre[] | null | undefined): number =>
  (lignes ?? []).reduce((acc, l) => acc + (Number(l.montant) || 0), 0);

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Moteur de calcul du bulletin de paie.
 *
 * ⚠️ AUCUN taux, plafond ni règle Réunion/Madagascar n'est codé en dur ici : toutes les
 * valeurs viennent des tables de paramétrage (`RubriquePaie`, `ParametrePaie`), sélectionnées
 * via `employe.regimePaieCode`. Voir Doc/MODULE_PAIE_NOTES.md pour le détail des hypothèses
 * de simplification prises (heures sup, avantages en nature, net imposable...) — cette classe
 * démontre une architecture de calcul solide, pas des montants légaux certifiés.
 */
@Injectable()
export class MoteurCalculPaieService {
  calculer(
    employe: EmployeClient,
    variable: VariablePaie | null,
    rubriques: RubriquePaie[],
    parametres: ParametrePaie[],
  ): ResultatCalculPaie {
    const salaireBase = Number(employe.salaireBase) || 0;

    const heuresSup = Number(variable?.heuresSupplementaires) || 0;
    const tauxMajorationHS =
      variable?.tauxMajorationHeuresSup != null
        ? Number(variable.tauxMajorationHeuresSup)
        : this.getParametre(parametres, 'TAUX_MAJORATION_HS_DEFAUT', 25);
    const heuresLegalesMois = this.getParametre(parametres, 'HEURES_LEGALES_MOIS', 151.67);

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

    const detailRubriques: LigneBulletin[] = [];
    let totalCotisationsSalariales = 0;
    let totalCotisationsPatronales = 0;
    let totalAutresPrimesRubriques = 0;
    let totalAutresRetenuesRubriques = 0;

    const rubriquesActives = rubriques
      .filter((r) => r.isActive)
      .sort((a, b) => a.ordreAffichage - b.ordreAffichage);

    for (const r of rubriquesActives) {
      let base = 0;
      switch (r.baseCalcul) {
        case BaseCalculRubrique.BRUT:
          base = totalBrut;
          break;
        case BaseCalculRubrique.SALAIRE_BASE:
          base = salaireBase;
          break;
        case BaseCalculRubrique.FIXE:
          base = 0;
          break;
      }
      if (r.plafondMensuel != null && r.baseCalcul !== BaseCalculRubrique.FIXE) {
        base = Math.min(base, Number(r.plafondMensuel));
      }

      const montantSalarial =
        r.montantFixe != null
          ? Number(r.montantFixe)
          : round2((base * (Number(r.tauxSalarial) || 0)) / 100);
      const montantPatronal = round2((base * (Number(r.tauxPatronal) || 0)) / 100);

      detailRubriques.push({
        code: r.code,
        libelle: r.libelle,
        imputation: r.imputation,
        base: round2(base),
        tauxSalarial: r.tauxSalarial != null ? Number(r.tauxSalarial) : null,
        montantSalarial: round2(montantSalarial),
        tauxPatronal: r.tauxPatronal != null ? Number(r.tauxPatronal) : null,
        montantPatronal: round2(montantPatronal),
      });

      switch (r.imputation) {
        case ImputationRubrique.COTISATION:
          totalCotisationsSalariales += montantSalarial;
          totalCotisationsPatronales += montantPatronal;
          break;
        case ImputationRubrique.RETENUE:
          totalAutresRetenuesRubriques += montantSalarial;
          break;
        case ImputationRubrique.PRIME:
        case ImputationRubrique.AUTRE:
          totalAutresPrimesRubriques += montantSalarial;
          break;
      }
    }

    totalCotisationsSalariales = round2(totalCotisationsSalariales);
    totalCotisationsPatronales = round2(totalCotisationsPatronales);

    // Simplification v1 : net imposable = brut - cotisations salariales (pas de distinction
    // CSG/CRDS déductible vs non déductible). Voir Doc/MODULE_PAIE_NOTES.md.
    const netImposable = round2(totalBrut - totalCotisationsSalariales);

    // Net à payer = net imposable
    //   - avantages en nature (non versés en espèces, déjà inclus dans le brut/imposable)
    //   - retenues diverses saisies dans les variables du mois (acompte, saisie...)
    //   - retenues paramétrées au niveau rubrique
    //   + primes/indemnités paramétrées au niveau rubrique (ex: prime de transport fixe non cotisée)
    const netAPayer = round2(
      netImposable -
        totalAvantagesNature -
        totalRetenuesDiversesSaisies -
        totalAutresRetenuesRubriques +
        totalAutresPrimesRubriques,
    );

    return {
      salaireBase: round2(salaireBase),
      totalBrut,
      totalCotisationsSalariales,
      totalCotisationsPatronales,
      netImposable,
      netAPayer,
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

  private getParametre(parametres: ParametrePaie[], code: string, defaut: number): number {
    const p = parametres.find((x) => x.code === code);
    return p ? Number(p.valeur) : defaut;
  }
}
