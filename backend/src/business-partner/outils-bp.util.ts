/**
 * Tableau de Bord BP — structure et validation du contenu de chaque outil.
 * Source : « Outils stratégiques PASSIDOC x Business Partner » (6 nov. 2026), outils retenus
 * (dont la Matrice BCG, ajoutée en tête du document), présentés comme sur StratPilote.
 * Fonctions pures : le contenu reçu du navigateur est reconstruit champ par champ (rien d'inconnu
 * n'est conservé), textes tronqués, notes bornées.
 */
import { randomUUID } from 'crypto';
import { UserRole } from '../entities/user.entity';

export const OUTILS_BP = [
  'SWOT', 'PORTER', 'BMC', 'PESTEL', 'CHAINE_VALEUR', 'DIAGNOSTIC', 'RISQUES', 'PERSONA', 'BCG',
] as const;
export type OutilBpCode = typeof OUTILS_BP[number];

export const estOutilBp = (v: string): v is OutilBpCode => (OUTILS_BP as readonly string[]).includes(v);

/** « Seuls les collaborateurs BP+ peuvent valider et publier » (partie 5) : choix du cabinet. */
export const ROLES_VALIDATION_BP = [
  UserRole.ADMIN, UserRole.EXPERT_COMPTABLE, UserRole.CHEF_ANTENNE, UserRole.CHEF_MISSION,
];

export const ZONES_SWOT = ['forces', 'faiblesses', 'opportunites', 'menaces'] as const;
export const ZONES_BMC = [
  'partenaires', 'activites', 'ressources', 'proposition', 'relations', 'canaux', 'segments', 'couts', 'revenus',
] as const;
export const ZONES_PESTEL = [
  'politique', 'economique', 'socioculturel', 'technologique', 'environnemental', 'legal',
] as const;
export const FORCES_PORTER = [
  'nouveauxEntrants', 'pouvoirClients', 'substituts', 'pouvoirFournisseurs', 'concurrence',
] as const;
export const ACTIVITES_SOUTIEN = ['infrastructure', 'rh', 'technologie', 'approvisionnements'] as const;
export const ACTIVITES_PRIMAIRES = [
  'logistiqueInterne', 'production', 'logistiqueExterne', 'marketingVente', 'services',
] as const;
/** 8 axes : ceux de StratPilote (gouvernance, RH, finance, stratégie…) couvrant les capacités du
 *  document (financière, humaine, organisationnelle, technologique, réputation/relationnel). */
export const AXES_DIAGNOSTIC = [
  'strategie', 'gouvernance', 'finance', 'rh', 'organisation', 'commercial', 'digital', 'reputation',
] as const;
/** Catégories du document (fiscaux, conformité, fraude interne, opérationnels, marché) + financier. */
export const CATEGORIES_RISQUE = ['FISCAL', 'CONFORMITE', 'FRAUDE', 'OPERATIONNEL', 'MARCHE', 'FINANCIER', 'AUTRE'] as const;
export const QUADRANTS_BCG = ['VEDETTE', 'DILEMME', 'VACHE', 'POIDS_MORT'] as const;
export const LISTES_PERSONA = ['objectifs', 'frustrations', 'motivations', 'comportements'] as const;
export const CHAMPS_PERSONA = ['age', 'poste', 'lieu', 'bio'] as const;
export const LISTES_ICP = ['secteurs', 'technologies', 'localisations', 'problemes', 'budget', 'criteres'] as const;
export const CHAMPS_ICP = ['employes', 'caAnnuel', 'croissance'] as const;

const MAX_ITEMS = 50;
const MAX_TEXTE = 500;
const MAX_LONG = 3000;

export interface ItemBp { id: string; texte: string; cle?: string }

// ── Briques de normalisation ────────────────────────────────────────────────

const texte = (v: unknown, max = MAX_TEXTE): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' && Number.isFinite(v) ? String(v) : '';

const entier = (v: unknown, min: number, max: number, defaut = 0): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defaut;
};

const nouvelId = () => randomUUID().slice(0, 8);
const id = (v: unknown): string => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : nouvelId());
const cle = (v: unknown): string | undefined => (typeof v === 'string' && /^[\w.:-]{1,80}$/.test(v) ? v : undefined);

function items(v: unknown): ItemBp[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, MAX_ITEMS).flatMap(i => {
    const t = texte(typeof i === 'string' ? i : i?.texte);
    if (!t) return [];
    const c = cle(i?.cle);
    return [c ? { id: id(i?.id), texte: t, cle: c } : { id: id(i?.id), texte: t }];
  });
}

const objet = (v: unknown): Record<string, any> => (v && typeof v === 'object' && !Array.isArray(v) ? v as any : {});

const listes = (src: unknown, zones: readonly string[]) =>
  Object.fromEntries(zones.map(z => [z, items(objet(src)[z])]));

const ecartees = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map(cle).filter((c): c is string => !!c))].slice(0, 200) : [];

const date = (v: unknown): string => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');

const couleur = (v: unknown): string => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#3b82f6');

// ── Contenu par outil ───────────────────────────────────────────────────────

/** Reconstruit le contenu d'un outil à partir de ce que le navigateur envoie. */
export function normaliserContenu(outil: OutilBpCode, brut: unknown): Record<string, any> {
  const c = objet(brut);
  const base = { ecartees: ecartees(c.ecartees) };
  switch (outil) {
    case 'SWOT': return { ...listes(c, ZONES_SWOT), ...base };
    case 'BMC': return { ...listes(c, ZONES_BMC), ...base };
    case 'PESTEL': return { ...listes(c, ZONES_PESTEL), ...base };
    case 'PORTER':
      return {
        forces: Object.fromEntries(FORCES_PORTER.map(f => {
          const v = objet(objet(c.forces)[f]);
          return [f, { niveau: entier(v.niveau, 0, 3), elements: items(v.elements) }];
        })),
        ...base,
      };
    case 'CHAINE_VALEUR':
      return {
        activites: Object.fromEntries([...ACTIVITES_SOUTIEN, ...ACTIVITES_PRIMAIRES].map(a => {
          const v = objet(objet(c.activites)[a]);
          return [a, {
            description: texte(v.description, MAX_LONG),
            importance: entier(v.importance, 0, 5),
            performance: entier(v.performance, 0, 5),
          }];
        })),
        marge: texte(c.marge),
        forces: items(c.forces),
        faiblesses: items(c.faiblesses),
        ...base,
      };
    case 'DIAGNOSTIC':
      return {
        axes: Object.fromEntries(AXES_DIAGNOSTIC.map(a => {
          const v = objet(objet(c.axes)[a]);
          return [a, { score: entier(v.score, 0, 5), note: texte(v.note, MAX_LONG) }];
        })),
        forces: items(c.forces),
        faiblesses: items(c.faiblesses),
        ...base,
      };
    case 'RISQUES':
      return {
        risques: (Array.isArray(c.risques) ? c.risques : []).slice(0, 100).flatMap((r: any) => {
          const nom = texte(r?.nom, 200);
          if (!nom) return [];
          const categorie = (CATEGORIES_RISQUE as readonly string[]).includes(r?.categorie) ? r.categorie : 'AUTRE';
          const k = cle(r?.cle);
          return [{
            id: id(r?.id), nom, description: texte(r?.description, MAX_LONG), categorie,
            probabilite: entier(r?.probabilite, 1, 5, 1), gravite: entier(r?.gravite, 1, 5, 1),
            planAction: texte(r?.planAction, MAX_LONG), responsable: texte(r?.responsable, 120),
            dateCible: date(r?.dateCible), ...(k ? { cle: k } : {}),
          }];
        }),
        ...base,
      };
    case 'PERSONA': {
      const p = objet(c.persona);
      const i = objet(c.icp);
      return {
        persona: {
          ...Object.fromEntries(CHAMPS_PERSONA.map(k => [k, texte(p[k], k === 'bio' ? MAX_LONG : 200)])),
          ...listes(p, LISTES_PERSONA),
        },
        icp: {
          ...Object.fromEntries(CHAMPS_ICP.map(k => [k, texte(i[k], 200)])),
          ...listes(i, LISTES_ICP),
        },
        ...base,
      };
    }
    case 'BCG':
      return {
        activites: (Array.isArray(c.activites) ? c.activites : []).slice(0, 30).flatMap((a: any) => {
          const nom = texte(a?.nom, 120);
          if (!nom) return [];
          const ca = Number(a?.ca);
          return [{
            id: id(a?.id), nom,
            ca: a?.ca === null || a?.ca === '' || !Number.isFinite(ca) ? null : Math.max(0, ca),
            quadrant: (QUADRANTS_BCG as readonly string[]).includes(a?.quadrant) ? a.quadrant : 'DILEMME',
            couleur: couleur(a?.couleur),
          }];
        }),
        ...base,
      };
  }
}

/** Contenu vide d'un outil (même structure que normaliserContenu). */
export const contenuVide = (outil: OutilBpCode) => normaliserContenu(outil, {});

/** Un outil est « vide » tant qu'aucune saisie n'y figure (les éléments écartés ne comptent pas). */
export function estVide(outil: OutilBpCode, contenu: Record<string, any>): boolean {
  const { ecartees: _e, ...reste } = normaliserContenu(outil, contenu);
  return JSON.stringify(reste) === JSON.stringify((({ ecartees: _x, ...r }) => r)(contenuVide(outil)));
}

// ── Reprise des anciens onglets « Stratégie » et « Modèle Canvas » ──────────

const lignes = (t: unknown): ItemBp[] =>
  texte(t, 20000).split(/\r?\n/).map(l => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean)
    .map(l => ({ id: nouvelId(), texte: l.slice(0, MAX_TEXTE) }));

export interface AncienneAnalyse {
  forces?: string[] | null; faiblesses?: string[] | null; opportunites?: string[] | null; menaces?: string[] | null;
  porterConcurrence?: string | null; porterNouveauxEntrants?: string | null; porterClients?: string | null;
  porterFournisseurs?: string | null; porterSubstituts?: string | null; businessModelCanvas?: string | null;
}

export interface AncienCanvas {
  'partenairesClés'?: string | null; 'activitesClés'?: string | null; 'ressourcesClés'?: string | null;
  propositionValeur?: string | null; relationClient?: string | null; canaux?: string | null;
  segmentsClients?: string | null; structureCouts?: string | null; sourcesRevenus?: string | null;
}

/**
 * Contenu repris des anciens onglets pour SWOT, Porter et BMC (null si rien à reprendre).
 * Le BMC vient du « Modèle Canvas » (9 cases) ; à défaut, le texte libre du BMC de l'onglet
 * Stratégie est rangé dans « Proposition de valeur ».
 */
export function repriseAncienne(
  outil: OutilBpCode, analyse: AncienneAnalyse | null, canvas: AncienCanvas | null,
): Record<string, any> | null {
  let contenu: Record<string, any> | null = null;
  if (outil === 'SWOT' && analyse) {
    contenu = normaliserContenu('SWOT', Object.fromEntries(ZONES_SWOT.map(z => [z, (analyse[z] ?? []).flatMap(lignes)])));
  } else if (outil === 'PORTER' && analyse) {
    const sources: Record<string, unknown> = {
      nouveauxEntrants: analyse.porterNouveauxEntrants, pouvoirClients: analyse.porterClients,
      substituts: analyse.porterSubstituts, pouvoirFournisseurs: analyse.porterFournisseurs,
      concurrence: analyse.porterConcurrence,
    };
    contenu = normaliserContenu('PORTER', {
      forces: Object.fromEntries(FORCES_PORTER.map(f => [f, { niveau: 0, elements: lignes(sources[f]) }])),
    });
  } else if (outil === 'BMC') {
    const cv: Record<string, unknown> = canvas ? {
      partenaires: canvas['partenairesClés'], activites: canvas['activitesClés'], ressources: canvas['ressourcesClés'],
      proposition: canvas.propositionValeur, relations: canvas.relationClient, canaux: canvas.canaux,
      segments: canvas.segmentsClients, couts: canvas.structureCouts, revenus: canvas.sourcesRevenus,
    } : {};
    const depuisCanvas = normaliserContenu('BMC', Object.fromEntries(ZONES_BMC.map(z => [z, lignes(cv[z])])));
    contenu = !estVide('BMC', depuisCanvas) ? depuisCanvas
      : normaliserContenu('BMC', { proposition: lignes(analyse?.businessModelCanvas) });
  }
  return contenu && !estVide(outil, contenu) ? contenu : null;
}

// ── Indicateurs (identiques côté navigateur) ────────────────────────────────

/** Criticité = probabilité × gravité (1 à 25) et zone de la matrice 5×5. */
export function criticite(probabilite: number, gravite: number) {
  const valeur = probabilite * gravite;
  const zone = valeur >= 15 ? 'INACCEPTABLE' : valeur >= 10 ? 'A_TRAITER' : valeur >= 5 ? 'TOLERABLE' : 'ACCEPTABLE';
  return { valeur, zone };
}

/** Menace globale de Porter : somme des niveaux (faible 1, moyen 2, élevé 3), sur 15. */
export function menaceGlobalePorter(contenu: Record<string, any>) {
  const niveaux = FORCES_PORTER.map(f => Number(contenu?.forces?.[f]?.niveau) || 0);
  const evaluees = niveaux.filter(n => n > 0).length;
  return { score: niveaux.reduce((a, n) => a + n, 0), max: 15, evaluees };
}

/** Score global du diagnostic : moyenne des axes notés (sur 5), arrondie au dixième. */
export function scoreDiagnostic(contenu: Record<string, any>): number | null {
  const notes = AXES_DIAGNOSTIC.map(a => Number(contenu?.axes?.[a]?.score) || 0).filter(n => n > 0);
  return notes.length ? Math.round((notes.reduce((a, n) => a + n, 0) / notes.length) * 10) / 10 : null;
}

// ── Résumé texte (assistant IA du dossier) ──────────────────────────────────

export const LIBELLES_OUTILS: Record<OutilBpCode, string> = {
  SWOT: 'SWOT', PORTER: '5 Forces de Porter', BMC: 'Business Model Canvas', PESTEL: 'PESTEL',
  CHAINE_VALEUR: 'Chaîne de valeur', DIAGNOSTIC: 'Diagnostic interne', RISQUES: 'Matrice de risques',
  PERSONA: 'Fiche Persona / ICP', BCG: 'Matrice BCG',
};

export const LIBELLES_ZONES: Record<string, string> = {
  forces: 'Forces', faiblesses: 'Faiblesses', opportunites: 'Opportunités', menaces: 'Menaces',
  partenaires: 'Partenaires clés', activites: 'Activités clés', ressources: 'Ressources clés',
  proposition: 'Proposition de valeur', relations: 'Relations clients', canaux: 'Canaux',
  segments: 'Segments clients', couts: 'Structure de coûts', revenus: 'Sources de revenus',
  politique: 'Politique', economique: 'Économique', socioculturel: 'Socioculturel',
  technologique: 'Technologique', environnemental: 'Environnemental', legal: 'Légal',
  nouveauxEntrants: 'Nouveaux entrants', pouvoirClients: 'Pouvoir des clients', substituts: 'Produits de substitution',
  pouvoirFournisseurs: 'Pouvoir des fournisseurs', concurrence: 'Intensité concurrentielle',
  infrastructure: "Infrastructure de l'entreprise", rh: 'Gestion des ressources humaines',
  technologie: 'Développement technologique', approvisionnements: 'Approvisionnements',
  logistiqueInterne: 'Logistique interne', production: 'Production', logistiqueExterne: 'Logistique externe',
  marketingVente: 'Marketing & ventes', services: 'Services',
  strategie: 'Stratégie & vision', gouvernance: 'Gouvernance & direction', finance: 'Finance',
  organisation: 'Organisation & processus', commercial: 'Commercial & marketing',
  digital: 'Systèmes d’information & digital', reputation: 'Réputation & relation client',
};

const NIVEAUX_PORTER = ['non évalué', 'faible', 'moyen', 'élevé'];
const QUADRANTS: Record<string, string> = { VEDETTE: 'Vedette', DILEMME: 'Dilemme', VACHE: 'Vache à lait', POIDS_MORT: 'Poids mort' };

/** Résumé des outils BP enregistrés d'un exercice, pour le contexte de l'assistant IA. */
export function texteOutilsBp(annee: number, lignes: { outil: string; statut: string; contenu: Record<string, any> }[]): string[] {
  const out: string[] = [];
  const liste = (l: ItemBp[] = []) => l.map(i => i.texte).join(' | ');
  const zones = (c: Record<string, any>, codes: readonly string[]) =>
    codes.filter(z => c[z]?.length).map(z => `  ${LIBELLES_ZONES[z]} : ${liste(c[z])}`);
  for (const code of OUTILS_BP) {
    const l = lignes.find(x => x.outil === code);
    if (!l) continue;
    const c = normaliserContenu(code, l.contenu);
    const corps: string[] = [];
    if (code === 'SWOT') corps.push(...zones(c, ZONES_SWOT));
    if (code === 'BMC') corps.push(...zones(c, ZONES_BMC));
    if (code === 'PESTEL') corps.push(...zones(c, ZONES_PESTEL));
    if (code === 'PORTER') {
      FORCES_PORTER.forEach(f => {
        const v = c.forces[f];
        if (v.niveau || v.elements.length) corps.push(`  ${LIBELLES_ZONES[f]} (${NIVEAUX_PORTER[v.niveau]}) : ${liste(v.elements)}`);
      });
      const m = menaceGlobalePorter(c);
      if (m.evaluees) corps.push(`  Menace globale : ${m.score}/${m.max}`);
    }
    if (code === 'CHAINE_VALEUR') {
      [...ACTIVITES_SOUTIEN, ...ACTIVITES_PRIMAIRES].forEach(a => {
        const v = c.activites[a];
        if (v.description || v.importance || v.performance) {
          corps.push(`  ${LIBELLES_ZONES[a]} (importance ${v.importance}/5, performance ${v.performance}/5) : ${v.description}`);
        }
      });
      if (c.marge) corps.push(`  Marge : ${c.marge}`);
      corps.push(...zones(c, ['forces', 'faiblesses']));
    }
    if (code === 'DIAGNOSTIC') {
      const s = scoreDiagnostic(c);
      if (s !== null) corps.push(`  Score global : ${s}/5`);
      AXES_DIAGNOSTIC.forEach(a => {
        const v = c.axes[a];
        if (v.score || v.note) corps.push(`  ${LIBELLES_ZONES[a]} : ${v.score ? `${v.score}/5` : 'non noté'}${v.note ? ` — ${v.note}` : ''}`);
      });
      corps.push(...zones(c, ['forces', 'faiblesses']));
    }
    if (code === 'RISQUES') {
      c.risques.forEach((r: any) => {
        const k = criticite(r.probabilite, r.gravite);
        corps.push(`  ${r.nom} (${r.categorie}, probabilité ${r.probabilite} × gravité ${r.gravite} = ${k.valeur})${r.planAction ? ` — plan d'action : ${r.planAction}` : ''}`);
      });
    }
    if (code === 'PERSONA') {
      const p = c.persona, i = c.icp;
      const champs = [p.age && `âge ${p.age}`, p.poste, p.lieu].filter(Boolean).join(', ');
      if (champs) corps.push(`  Dirigeant : ${champs}`);
      if (p.bio) corps.push(`  Contexte : ${p.bio}`);
      corps.push(...LISTES_PERSONA.filter(k => p[k].length).map(k => `  ${k[0].toUpperCase()}${k.slice(1)} : ${liste(p[k])}`));
      const icp = [i.employes && `${i.employes} employés`, i.caAnnuel && `CA ${i.caAnnuel}`, i.croissance && `croissance ${i.croissance}`].filter(Boolean).join(', ');
      if (icp) corps.push(`  ICP : ${icp}`);
    }
    if (code === 'BCG') {
      c.activites.forEach((a: any) => corps.push(`  ${a.nom} : ${QUADRANTS[a.quadrant]}${a.ca !== null ? ` (CA ${a.ca})` : ''}`));
    }
    if (corps.length) out.push(`${LIBELLES_OUTILS[code]}${l.statut === 'VALIDE' ? ' [validé]' : ' [brouillon]'} :`, ...corps);
  }
  return out.length ? [`\n=== TABLEAU DE BORD BP (exercice ${annee}) ===`, ...out] : [];
}
