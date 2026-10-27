/**
 * Indicateurs de rentabilité d'une affaire — cahier v2 #6 « Suivi budgétaire et rentabilité
 * par dossier (Boni/Mali) ». Fonctions pures, testées unitairement.
 *
 * Formules du cahier :
 *   prix de vente horaire = honoraires annuels ÷ heures budget (sauf saisie manuelle)
 *   montant réalisé       = heures consommées × prix de vente horaire
 *   boni (> 0) / mali (< 0) = honoraires − montant réalisé
 * En complément (vue ADMIN) : marge sur valorisation = honoraires − Σ (temps × PV collaborateur),
 * c'est-à-dire la comparaison honoraires / « PV Col » du rapport Tempolia.
 */

/** Missions facturées par des honoraires distincts des honoraires comptables (sociaux,
 *  juridiques, conseil) : leur temps ne consomme pas le budget comptable du dossier. */
export const MISSIONS_HORS_COMPTA = ['SOC', 'JUR', 'CON'];

/** Seuil d'alerte « attention » (80 % du budget) ; l'alerte « dépassé » est à 100 %. */
export const SEUIL_ATTENTION = 0.8;

export type StatutBudget = 'NON_BUDGETE' | 'OK' | 'ATTENTION' | 'DEPASSE';

export interface EntreeIndicateurs {
  heuresBudget?: number | null;
  /** Honoraires saisis sur le budget de l'affaire (prioritaires). */
  honorairesBudget?: number | null;
  /** Honoraires comptables de la fiche identité (repli). */
  honorairesFiche?: number | null;
  prixVenteHoraireManuel?: number | null;
  heuresConsommees: number;
  valorisation: number;
}

export interface Indicateurs {
  honoraires: number | null;
  honorairesSource: 'BUDGET' | 'FICHE' | null;
  heuresBudget: number | null;
  prixVenteHoraire: number | null;
  prixVenteCalcule: boolean;
  heuresConsommees: number;
  heuresRestantes: number | null;
  /** Heures consommées ÷ heures budget (1 = 100 %). */
  tauxConsommation: number | null;
  statut: StatutBudget;
  montantRealise: number | null;
  boniMali: number | null;
  /** Boni/mali ÷ honoraires (0.15 = +15 %). */
  boniMaliPct: number | null;
  /** Σ temps × PV collaborateur — null quand masqué (profil non ADMIN). */
  valorisation: number | null;
  margeValorisation: number | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const positif = (n: number | null | undefined): n is number => typeof n === 'number' && isFinite(n) && n > 0;

export function estTempsCompta(type: string, missionCode?: string | null): boolean {
  return type === 'FACTURABLE' && !MISSIONS_HORS_COMPTA.includes(missionCode ?? '');
}

export function statutBudget(taux: number | null): StatutBudget {
  if (taux === null) return 'NON_BUDGETE';
  if (taux >= 1) return 'DEPASSE';
  if (taux >= SEUIL_ATTENTION) return 'ATTENTION';
  return 'OK';
}

export function calculerIndicateurs(e: EntreeIndicateurs): Indicateurs {
  const honoraires = positif(e.honorairesBudget) ? e.honorairesBudget : positif(e.honorairesFiche) ? e.honorairesFiche : null;
  const honorairesSource = positif(e.honorairesBudget) ? 'BUDGET' : positif(e.honorairesFiche) ? 'FICHE' : null;
  const heuresBudget = positif(e.heuresBudget) ? e.heuresBudget : null;
  const prixVenteCalcule = !positif(e.prixVenteHoraireManuel);
  const prixVenteHoraire = !prixVenteCalcule
    ? e.prixVenteHoraireManuel!
    : honoraires !== null && heuresBudget !== null ? r2(honoraires / heuresBudget) : null;

  const heures = e.heuresConsommees || 0;
  const tauxConsommation = heuresBudget !== null ? heures / heuresBudget : null;
  const montantRealise = prixVenteHoraire !== null ? r2(heures * prixVenteHoraire) : null;
  const boniMali = honoraires !== null && montantRealise !== null ? r2(honoraires - montantRealise) : null;
  const valorisation = r2(e.valorisation || 0);

  return {
    honoraires,
    honorairesSource,
    heuresBudget,
    prixVenteHoraire,
    prixVenteCalcule,
    heuresConsommees: r2(heures),
    heuresRestantes: heuresBudget !== null ? r2(heuresBudget - heures) : null,
    tauxConsommation,
    statut: statutBudget(tauxConsommation),
    montantRealise,
    boniMali,
    boniMaliPct: boniMali !== null && honoraires ? boniMali / honoraires : null,
    valorisation,
    margeValorisation: honoraires !== null ? r2(honoraires - valorisation) : null,
  };
}
