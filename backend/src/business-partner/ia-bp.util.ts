/**
 * Suggestions IA du Tableau de bord BP — « L'IA PASSIDOC propose des alertes et suggestions »
 * (document client, partie 5). Fonctions pures : consigne envoyée au modèle, puis lecture stricte
 * de sa réponse (zones autorisées seulement, textes bornés, doublons écartés).
 */
import { createHash } from 'crypto';
import {
  CATEGORIES_RISQUE, FORCES_PORTER, LIBELLES_OUTILS, LIBELLES_ZONES, LISTES_ICP, LISTES_PERSONA, OutilBpCode,
  QUADRANTS_BCG, ZONES_BMC, ZONES_PESTEL, ZONES_SWOT,
} from './outils-bp.util';
import { SuggestionBp } from './suggestions-bp.util';

const LIB_PERSONA: Record<string, string> = {
  'persona.objectifs': 'Persona — objectifs', 'persona.frustrations': 'Persona — frustrations',
  'persona.motivations': 'Persona — motivations', 'persona.comportements': 'Persona — comportements',
  'icp.secteurs': 'ICP — secteurs', 'icp.technologies': 'ICP — technologies', 'icp.localisations': 'ICP — localisations',
  'icp.problemes': 'ICP — problèmes', 'icp.budget': 'ICP — budget', 'icp.criteres': 'ICP — critères de décision',
};

const LIB_BCG: Record<string, string> = {
  VEDETTE: 'Vedette : part de marché forte, croissance forte', DILEMME: 'Dilemme : part de marché faible, croissance forte',
  VACHE: 'Vache à lait : part de marché forte, croissance faible', POIDS_MORT: 'Poids mort : part de marché faible, croissance faible',
};

/** Zones que l'IA peut alimenter pour chaque outil (aucune pour l'entretien, qui est la source). */
export function zonesIa(outil: OutilBpCode): Record<string, string> {
  const lib = (codes: readonly string[]) => Object.fromEntries(codes.map(z => [z, LIBELLES_ZONES[z] ?? z]));
  switch (outil) {
    case 'SWOT': return lib(ZONES_SWOT);
    case 'PESTEL': return lib(ZONES_PESTEL);
    case 'BMC': return lib(ZONES_BMC);
    case 'PORTER': return lib(FORCES_PORTER);
    case 'CHAINE_VALEUR': case 'DIAGNOSTIC': return lib(['forces', 'faiblesses']);
    case 'RISQUES': return { risques: 'Registre des risques' };
    case 'BCG': return Object.fromEntries(QUADRANTS_BCG.map(q => [q, LIB_BCG[q]]));
    case 'PERSONA': return Object.fromEntries([...LISTES_PERSONA.map(k => `persona.${k}`), ...LISTES_ICP.map(k => `icp.${k}`)].map(z => [z, LIB_PERSONA[z]]));
    default: return {};
  }
}

export function consigneIa(outil: OutilBpCode, contexte: string[]): { systeme: string; utilisateur: string } {
  const zones = zonesIa(outil);
  const risque = outil === 'RISQUES'
    ? `, "categorie": un de ${CATEGORIES_RISQUE.join('|')}, "probabilite": 1 à 5, "gravite": 1 à 5`
    : '';
  const bcg = outil === 'BCG'
    ? ["Matrice BCG : « texte » = une ligne de produits ou de services VENDUE aux clients de l'entreprise (ex. : pain, snacking, traiteur ;",
      'maintenance informatique, vente de matériel), 40 caractères maximum ; « zone » = son quadrant.',
      "Jamais une tâche interne (comptabilité, gestion, administration, digitalisation, mise à jour d'outils).",
      "Ne propose que des activités commerciales citées dans les données du dossier. S'il n'y en a aucune, réponds {\"suggestions\": []}.",
      "Le chiffre d'affaires de chaque activité sera saisi par le collaborateur."]
    : [];
  return {
    systeme: [
      "Tu es Business Partner dans un cabinet d'expertise comptable (La Réunion et Madagascar).",
      'Tu aides le collaborateur à compléter un outil stratégique pour une PME cliente.',
      "Appuie-toi uniquement sur les données du dossier fournies ; n'invente ni chiffre ni nom propre.",
      'Réponds uniquement par un objet JSON, sans texte autour.',
    ].join(' '),
    utilisateur: [
      `Outil : ${LIBELLES_OUTILS[outil]}.`,
      `Zones possibles : ${Object.entries(zones).map(([k, v]) => `"${k}" (${v})`).join(', ')}.`,
      'Propose de 3 à 6 éléments NOUVEAUX (absents de ce qui est déjà saisi), concrets, en français, 160 caractères maximum chacun.',
      ...bcg,
      `Format : {"suggestions": [{"zone": "...", "texte": "...", "pourquoi": "donnée du dossier qui le justifie, 80 caractères maximum"${risque}}]}`,
      '',
      'Données du dossier :',
      ...contexte,
    ].join('\n'),
  };
}

const borne = (v: unknown, min: number, max: number, defaut: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut;
};
const normal = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\W+/g, ' ').trim();

/** Lit la réponse du modèle ; tout ce qui sort du cadre (zone inconnue, texte vide, doublon) est ignoré. */
export function lireReponseIa(outil: OutilBpCode, reponse: string, dejaSaisis: string[]): SuggestionBp[] {
  const debut = reponse.indexOf('{'), fin = reponse.lastIndexOf('}');
  if (debut < 0 || fin <= debut) return [];
  let brut: any;
  try { brut = JSON.parse(reponse.slice(debut, fin + 1)); } catch { return []; }
  const zones = zonesIa(outil);
  const vus = new Set(dejaSaisis.map(normal));
  const out: SuggestionBp[] = [];
  for (const s of Array.isArray(brut?.suggestions) ? brut.suggestions.slice(0, 8) : []) {
    const zone = typeof s?.zone === 'string' ? s.zone.trim() : '';
    const texte = typeof s?.texte === 'string' ? s.texte.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
    if (!zones[zone] || !texte || vus.has(normal(texte))) continue;
    vus.add(normal(texte));
    const pourquoi = typeof s?.pourquoi === 'string' ? s.pourquoi.replace(/\s+/g, ' ').trim().slice(0, 100) : '';
    const cle = `ia.${outil.toLowerCase()}.${createHash('sha1').update(`${zone}|${normal(texte)}`).digest('hex').slice(0, 10)}`;
    out.push({
      cle, outil, zone, texte, source: pourquoi ? `IA PASSIDOC — ${pourquoi}` : 'IA PASSIDOC',
      ...(outil === 'RISQUES' ? {
        risque: {
          categorie: (CATEGORIES_RISQUE as readonly string[]).includes(s?.categorie) ? s.categorie : 'AUTRE',
          probabilite: borne(s?.probabilite, 1, 5, 3), gravite: borne(s?.gravite, 1, 5, 3),
        },
      } : {}),
    });
  }
  return out;
}
