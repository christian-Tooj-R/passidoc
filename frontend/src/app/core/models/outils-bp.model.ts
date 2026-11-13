/**
 * Tableau de Bord BP — outils stratégiques Business Partner.
 * Source : « Outils stratégiques PASSIDOC x Business Partner » (6 nov. 2026), présentés comme
 * sur StratPilote (libellés, échelles et cotations repris de ses modules).
 * Structure du contenu identique à backend/src/business-partner/outils-bp.util.ts.
 */

export type OutilBpCode = 'SWOT' | 'PORTER' | 'BMC' | 'PESTEL' | 'CHAINE_VALEUR' | 'DIAGNOSTIC' | 'RISQUES' | 'PERSONA' | 'BCG';
export type StatutOutilBp = 'BROUILLON' | 'VALIDE';
export type OrigineOutilBp = 'ENREGISTRE' | 'REPRISE_N1' | 'REPRISE_ANCIENNE' | 'VIDE';

export interface ItemBp { id: string; texte: string; cle?: string }

export interface OutilBpVue {
  outil: OutilBpCode;
  contenu: any;
  statut: StatutOutilBp;
  valideLe: string | null;
  validePar: { id: number; nom: string } | null;
  modifieLe: string | null;
  origine: OrigineOutilBp;
}

export interface TableauBp {
  exercice: { id: number; annee: number; cloture: boolean };
  precedent: { id: number; annee: number; outils: Partial<Record<OutilBpCode, OutilBpVue>> } | null;
  outils: OutilBpVue[];
  droits: { modifier: boolean; valider: boolean };
}

export interface SuggestionBp {
  cle: string;
  outil: OutilBpCode;
  zone: string;
  texte: string;
  source: string;
  score?: number;
  risque?: { categorie: string; probabilite: number; gravite: number };
}

export interface ProfilAutoBp {
  secteur: string | null;
  effectif: number | null;
  capital: number | null;
  ca: number | null;
  croissanceCa: number | null;
  ancienneteRelationAns: number | null;
  nbExercices: number;
  dateCreationEntreprise: string | null;
  maturiteNumerique: number | null;
  disciplinePieces: { enRetard: number; appreciation: string };
  missionsAcceptees: number;
  cyclesMissions: string[];
}

export interface InfoOutilBp { code: OutilBpCode; label: string; court: string; icon: string; couleur: string; categorie: string; description: string }

/** Ordre des onglets du document (partie 5), plus la Matrice BCG. Catégories de StratPilote. */
export const OUTILS_BP: InfoOutilBp[] = [
  { code: 'SWOT', label: 'SWOT', court: 'SWOT', icon: 'grid_view', couleur: '#10b981', categorie: 'Analyse interne',
    description: 'Forces, faiblesses, opportunités, menaces' },
  { code: 'PORTER', label: '5 Forces de Porter', court: 'Porter', icon: 'hexagon', couleur: '#f97316', categorie: 'Analyse externe',
    description: 'Analyse concurrentielle micro-environnement' },
  { code: 'BMC', label: 'Business Model Canvas', court: 'BMC', icon: 'dashboard', couleur: '#8b5cf6', categorie: 'Business',
    description: "Le modèle d'affaires en 9 blocs" },
  { code: 'PESTEL', label: 'PESTEL', court: 'PESTEL', icon: 'public', couleur: '#ef4444', categorie: 'Analyse externe',
    description: 'Politique, économique, socioculturel, technologique, environnemental, légal' },
  { code: 'CHAINE_VALEUR', label: 'Chaîne de valeur', court: 'Chaîne valeur', icon: 'linear_scale', couleur: '#0ea5e9', categorie: 'Analyse interne',
    description: 'Activités génératrices de valeur et goulots' },
  { code: 'DIAGNOSTIC', label: 'Diagnostic interne', court: 'Diagnostic', icon: 'monitor_heart', couleur: '#14b8a6', categorie: 'Analyse interne',
    description: 'Ressources et capacités, axe par axe' },
  { code: 'RISQUES', label: 'Matrice de risques', court: 'Risques', icon: 'warning', couleur: '#dc2626', categorie: 'Stratégie',
    description: 'Évaluez probabilité et gravité de vos risques' },
  { code: 'PERSONA', label: 'Fiche Persona / ICP', court: 'Persona', icon: 'person_search', couleur: '#ec4899', categorie: 'Business',
    description: 'Profil du dirigeant et profil client idéal' },
  { code: 'BCG', label: 'Matrice BCG', court: 'BCG', icon: 'bubble_chart', couleur: '#3b82f6', categorie: 'Stratégie',
    description: 'Vedettes, dilemmes, vaches à lait, poids morts' },
];

export const infoOutil = (code: OutilBpCode) => OUTILS_BP.find(o => o.code === code)!;

/** Menu du Tableau de bord BP : outils regroupés par catégorie, dans l'ordre d'affichage. */
export const groupesOutilsBp = () => ['Analyse interne', 'Analyse externe', 'Stratégie', 'Business']
  .map(categorie => ({ categorie, outils: OUTILS_BP.filter(o => o.categorie === categorie) }));

export const ZONES_SWOT = ['forces', 'faiblesses', 'opportunites', 'menaces'] as const;
export const ZONES_BMC = ['partenaires', 'activites', 'ressources', 'proposition', 'relations', 'canaux', 'segments', 'couts', 'revenus'] as const;
export const ZONES_PESTEL = ['politique', 'economique', 'socioculturel', 'technologique', 'environnemental', 'legal'] as const;
export const FORCES_PORTER = ['nouveauxEntrants', 'pouvoirClients', 'substituts', 'pouvoirFournisseurs', 'concurrence'] as const;
export const ACTIVITES_SOUTIEN = ['infrastructure', 'rh', 'technologie', 'approvisionnements'] as const;
export const ACTIVITES_PRIMAIRES = ['logistiqueInterne', 'production', 'logistiqueExterne', 'marketingVente', 'services'] as const;
export const AXES_DIAGNOSTIC = ['strategie', 'gouvernance', 'finance', 'rh', 'organisation', 'commercial', 'digital', 'reputation'] as const;
export const LISTES_PERSONA = ['objectifs', 'frustrations', 'motivations', 'comportements'] as const;
export const LISTES_ICP = ['secteurs', 'technologies', 'localisations', 'problemes', 'budget', 'criteres'] as const;

export const LIBELLES_ZONES: Record<string, string> = {
  forces: 'Forces', faiblesses: 'Faiblesses', opportunites: 'Opportunités', menaces: 'Menaces',
  partenaires: 'Partenaires clés', activites: 'Activités clés', ressources: 'Ressources clés',
  proposition: 'Proposition de valeur', relations: 'Relations clients', canaux: 'Canaux',
  segments: 'Segments clients', couts: 'Structure de coûts', revenus: 'Sources de revenus',
  politique: 'Politique', economique: 'Économique', socioculturel: 'Socioculturel',
  technologique: 'Technologique', environnemental: 'Environnemental', legal: 'Légal',
  nouveauxEntrants: 'Nouveaux entrants', pouvoirClients: 'Pouvoir clients', substituts: 'Produits substituts',
  pouvoirFournisseurs: 'Pouvoir fournisseurs', concurrence: 'Intensité concurrence',
  infrastructure: "Infrastructure de l'entreprise", rh: 'Gestion des ressources humaines',
  technologie: 'Développement technologique', approvisionnements: 'Approvisionnements',
  logistiqueInterne: 'Logistique interne', production: 'Production', logistiqueExterne: 'Logistique externe',
  marketingVente: 'Marketing & ventes', services: 'Services',
  strategie: 'Stratégie & vision', gouvernance: 'Gouvernance & direction', finance: 'Finance',
  organisation: 'Organisation & processus', commercial: 'Commercial & marketing',
  digital: "Systèmes d'information & digital", reputation: 'Réputation & relation client',
  objectifs: 'Objectifs', frustrations: 'Frustrations', motivations: 'Motivations', comportements: 'Comportements',
  secteurs: "Secteur d'activité", technologies: 'Technologie utilisée', localisations: 'Localisation',
  problemes: 'Problèmes rencontrés', budget: 'Budget disponible', criteres: 'Critères de décision',
  age: 'Âge', poste: 'Poste', lieu: 'Lieu', bio: 'Bio / Contexte',
  employes: 'Employés', caAnnuel: 'CA annuel', croissance: 'Croissance', marge: 'Marge',
};

/** Porter (StratPilote) : niveau de menace par force. */
export const NIVEAUX_PORTER = [
  { valeur: 0, label: 'Non évalué', couleur: '#94a3b8' },
  { valeur: 1, label: 'Faible', couleur: '#10b981' },
  { valeur: 2, label: 'Moyen', couleur: '#f59e0b' },
  { valeur: 3, label: 'Élevé', couleur: '#ef4444' },
];

/** Matrice de risques (StratPilote) : échelles 1 à 5. */
export const ECHELLE_PROBABILITE = ['1 - Très rare', '2 - Rare', '3 - Occasionnel', '4 - Fréquent', '5 - Continu'];
export const ECHELLE_GRAVITE = ['1 - Gênant', '2 - Bloquant', '3 - Handicapant', '4 - Vital', '5 - Catastrophique'];
export const ZONES_CRITICITE = {
  ACCEPTABLE: { label: 'Acceptable', couleur: '#22c55e', fond: '#dcfce7' },
  TOLERABLE: { label: 'Tolérable', couleur: '#eab308', fond: '#fef9c3' },
  A_TRAITER: { label: 'À traiter', couleur: '#f97316', fond: '#ffedd5' },
  INACCEPTABLE: { label: 'Inacceptable', couleur: '#dc2626', fond: '#fee2e2' },
} as const;
export type ZoneCriticite = keyof typeof ZONES_CRITICITE;
export const CATEGORIES_RISQUE: { code: string; label: string }[] = [
  { code: 'FISCAL', label: 'Fiscal' }, { code: 'CONFORMITE', label: 'Conformité' }, { code: 'FRAUDE', label: 'Fraude interne' },
  { code: 'OPERATIONNEL', label: 'Opérationnel' }, { code: 'MARCHE', label: 'Marché' }, { code: 'FINANCIER', label: 'Financier' },
  { code: 'AUTRE', label: 'Autre' },
];

/** Matrice BCG (StratPilote). */
export const QUADRANTS_BCG = [
  { code: 'VEDETTE', label: 'Vedettes', couleur: '#f59e0b', description: 'Part de marché forte, croissance forte. Nécessite des investissements, génère des revenus importants' },
  { code: 'DILEMME', label: 'Dilemmes', couleur: '#8b5cf6', description: 'Part de marché faible, croissance forte. Incertitude, nécessite des investissements' },
  { code: 'VACHE', label: 'Vaches à lait', couleur: '#10b981', description: "Part de marché forte, croissance faible. Génère du cash avec peu d'investissement" },
  { code: 'POIDS_MORT', label: 'Poids morts', couleur: '#64748b', description: 'Part de marché faible, croissance faible. Peu rentable, à envisager de désinvestir' },
] as const;

/** Diagnostic interne / chaîne de valeur (StratPilote) : échelles 1 à 5. */
export const ECHELLE_DIAGNOSTIC = ['1 - Très faible', '2 - Faible', '3 - Moyen', '4 - Bon', '5 - Excellent'];

// ── Calculs (identiques au backend) ─────────────────────────────────────────

export const nouvelId = () => Math.random().toString(36).slice(2, 10);

export function criticite(probabilite: number, gravite: number): { valeur: number; zone: ZoneCriticite } {
  const valeur = probabilite * gravite;
  const zone: ZoneCriticite = valeur >= 15 ? 'INACCEPTABLE' : valeur >= 10 ? 'A_TRAITER' : valeur >= 5 ? 'TOLERABLE' : 'ACCEPTABLE';
  return { valeur, zone };
}

export function menaceGlobalePorter(contenu: any): { score: number; max: number; evaluees: number; label: string } {
  const niveaux = FORCES_PORTER.map(f => Number(contenu?.forces?.[f]?.niveau) || 0);
  const evaluees = niveaux.filter(n => n > 0).length;
  const score = niveaux.reduce((a, n) => a + n, 0);
  const label = !evaluees ? 'Aucune évaluation' : score <= 6 ? 'Menace faible' : score <= 10 ? 'Menace modérée' : 'Menace forte';
  return { score, max: 15, evaluees, label };
}

export function scoreDiagnostic(contenu: any): number | null {
  const notes = AXES_DIAGNOSTIC.map(a => Number(contenu?.axes?.[a]?.score) || 0).filter(n => n > 0);
  return notes.length ? Math.round((notes.reduce((a, n) => a + n, 0) / notes.length) * 10) / 10 : null;
}

// ── Suggestions PASSIDOC ────────────────────────────────────────────────────

const copie = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Une suggestion est traitée si elle a été ajoutée (élément portant sa clé) ou écartée. */
export function suggestionTraitee(contenu: any, s: SuggestionBp): boolean {
  if ((contenu?.ecartees ?? []).includes(s.cle)) return true;
  return JSON.stringify(contenu ?? {}).includes(`"cle":"${s.cle}"`);
}

export function ecarterSuggestion(contenu: any, s: SuggestionBp): any {
  const c = copie(contenu);
  c.ecartees = [...new Set([...(c.ecartees ?? []), s.cle])];
  return c;
}

/**
 * Ajoute une suggestion à sa zone. Pour les champs simples (axe du diagnostic, activité de la
 * chaîne de valeur, champ du persona) la clé rejoint les suggestions traitées.
 */
export function appliquerSuggestion(outil: OutilBpCode, contenu: any, s: SuggestionBp): any {
  const c = copie(contenu);
  const item: ItemBp = { id: nouvelId(), texte: s.texte, cle: s.cle };
  const traitee = () => { c.ecartees = [...new Set([...(c.ecartees ?? []), s.cle])]; };
  const [zone, sous] = s.zone.includes(':') ? s.zone.split(':') : s.zone.split('.');
  switch (outil) {
    case 'SWOT': case 'BMC': case 'PESTEL':
      (c[s.zone] ??= []).push(item);
      break;
    case 'PORTER':
      c.forces[s.zone].elements.push(item);
      break;
    case 'CHAINE_VALEUR':
      if (s.zone === 'marge') c.marge = c.marge ? `${c.marge} ; ${s.texte}` : s.texte;
      else if (zone === 'activite') {
        const a = c.activites[sous];
        a.description = a.description ? `${a.description}\n${s.texte}` : s.texte;
      } else (c[s.zone] ??= []).push(item);
      traitee();
      break;
    case 'DIAGNOSTIC':
      if (zone === 'axe') {
        const a = c.axes[sous];
        if (s.score) a.score = s.score;
        a.note = a.note ? `${a.note}\n${s.texte}` : s.texte;
        traitee();
      } else (c[s.zone] ??= []).push(item);
      break;
    case 'RISQUES':
      c.risques.push({
        id: nouvelId(), nom: s.texte, description: `Détecté par PASSIDOC (${s.source})`,
        categorie: s.risque?.categorie ?? 'AUTRE', probabilite: s.risque?.probabilite ?? 3, gravite: s.risque?.gravite ?? 3,
        planAction: '', responsable: '', dateCible: '', cle: s.cle,
      });
      break;
    case 'PERSONA': {
      const bloc = c[zone];
      if (Array.isArray(bloc[sous])) bloc[sous].push(item);
      else { bloc[sous] = bloc[sous] ? `${bloc[sous]} ${s.texte}` : s.texte; traitee(); }
      break;
    }
    case 'BCG':
      break;
  }
  return c;
}

// ── Comparaison N / N-1 ─────────────────────────────────────────────────────

export interface EvolutionBp { ajouts: string[]; retraits: string[]; changements: string[] }

const norm = (t: string) => t.trim().toLowerCase();

function diffListes(zone: string, n: ItemBp[] = [], n1: ItemBp[] = [], e: EvolutionBp) {
  const a = new Set(n1.map(i => norm(i.texte)));
  const b = new Set(n.map(i => norm(i.texte)));
  const lib = LIBELLES_ZONES[zone] ?? zone;
  n.filter(i => !a.has(norm(i.texte))).forEach(i => e.ajouts.push(`${lib} : ${i.texte}`));
  n1.filter(i => !b.has(norm(i.texte))).forEach(i => e.retraits.push(`${lib} : ${i.texte}`));
}

const changement = (e: EvolutionBp, lib: string, avant: unknown, apres: unknown) => {
  if ((avant ?? '') !== (apres ?? '')) e.changements.push(`${lib} : ${avant || '—'} → ${apres || '—'}`);
};

/** Ce qui a changé entre l'édition N-1 et l'édition N d'un outil. */
export function evolutionN1(outil: OutilBpCode, n: any, n1: any): EvolutionBp {
  const e: EvolutionBp = { ajouts: [], retraits: [], changements: [] };
  if (!n || !n1) return e;
  switch (outil) {
    case 'SWOT': ZONES_SWOT.forEach(z => diffListes(z, n[z], n1[z], e)); break;
    case 'BMC': ZONES_BMC.forEach(z => diffListes(z, n[z], n1[z], e)); break;
    case 'PESTEL': ZONES_PESTEL.forEach(z => diffListes(z, n[z], n1[z], e)); break;
    case 'PORTER':
      FORCES_PORTER.forEach(f => {
        diffListes(f, n.forces?.[f]?.elements, n1.forces?.[f]?.elements, e);
        changement(e, LIBELLES_ZONES[f], NIVEAUX_PORTER[n1.forces?.[f]?.niveau ?? 0].label, NIVEAUX_PORTER[n.forces?.[f]?.niveau ?? 0].label);
      });
      changement(e, 'Menace globale', `${menaceGlobalePorter(n1).score}/15`, `${menaceGlobalePorter(n).score}/15`);
      break;
    case 'CHAINE_VALEUR':
      [...ACTIVITES_SOUTIEN, ...ACTIVITES_PRIMAIRES].forEach(a => {
        changement(e, `${LIBELLES_ZONES[a]} — importance`, n1.activites?.[a]?.importance || '', n.activites?.[a]?.importance || '');
        changement(e, `${LIBELLES_ZONES[a]} — performance`, n1.activites?.[a]?.performance || '', n.activites?.[a]?.performance || '');
      });
      changement(e, 'Marge', n1.marge, n.marge);
      diffListes('forces', n.forces, n1.forces, e);
      diffListes('faiblesses', n.faiblesses, n1.faiblesses, e);
      break;
    case 'DIAGNOSTIC':
      AXES_DIAGNOSTIC.forEach(a => changement(e, LIBELLES_ZONES[a], n1.axes?.[a]?.score ? `${n1.axes[a].score}/5` : '', n.axes?.[a]?.score ? `${n.axes[a].score}/5` : ''));
      changement(e, 'Score global', scoreDiagnostic(n1) ?? '', scoreDiagnostic(n) ?? '');
      diffListes('forces', n.forces, n1.forces, e);
      diffListes('faiblesses', n.faiblesses, n1.faiblesses, e);
      break;
    case 'RISQUES': {
      const avant = new Map<string, any>((n1.risques ?? []).map((r: any) => [norm(r.nom), r]));
      const apres = new Map<string, any>((n.risques ?? []).map((r: any) => [norm(r.nom), r]));
      apres.forEach((r, k) => {
        const old = avant.get(k);
        if (!old) e.ajouts.push(`Risque : ${r.nom}`);
        else changement(e, `Criticité « ${r.nom} »`, criticite(old.probabilite, old.gravite).valeur, criticite(r.probabilite, r.gravite).valeur);
      });
      avant.forEach((r, k) => { if (!apres.has(k)) e.retraits.push(`Risque : ${r.nom}`); });
      break;
    }
    case 'PERSONA':
      (['age', 'poste', 'lieu', 'bio'] as const).forEach(k => changement(e, LIBELLES_ZONES[k], n1.persona?.[k], n.persona?.[k]));
      LISTES_PERSONA.forEach(k => diffListes(k, n.persona?.[k], n1.persona?.[k], e));
      (['employes', 'caAnnuel', 'croissance'] as const).forEach(k => changement(e, LIBELLES_ZONES[k], n1.icp?.[k], n.icp?.[k]));
      LISTES_ICP.forEach(k => diffListes(k, n.icp?.[k], n1.icp?.[k], e));
      break;
    case 'BCG': {
      const lib = (q: string) => QUADRANTS_BCG.find(x => x.code === q)?.label ?? q;
      const avant = new Map<string, any>((n1.activites ?? []).map((a: any) => [norm(a.nom), a]));
      const apres = new Map<string, any>((n.activites ?? []).map((a: any) => [norm(a.nom), a]));
      apres.forEach((a, k) => {
        const old = avant.get(k);
        if (!old) e.ajouts.push(`Activité : ${a.nom}`);
        else changement(e, a.nom, lib(old.quadrant), lib(a.quadrant));
      });
      avant.forEach((a, k) => { if (!apres.has(k)) e.retraits.push(`Activité : ${a.nom}`); });
      break;
    }
  }
  return e;
}
