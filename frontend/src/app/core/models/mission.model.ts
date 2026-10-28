/**
 * Module Missions (CDC « Module Missions — restructuration et enrichissement », 19/10/2026) :
 * cycles de révision, statuts de suivi et règles d'affichage. Les règles de calcul font foi
 * côté serveur (backend/src/missions/missions.util.ts) ; celles-ci servent à l'affichage.
 */

export const CYCLES_MISSIONS = [
  { code: 'IMM', nom: 'Immobilisations & amortissements', exemples: 'Plan de financement, CIOP (art. 244 quater W CGI), audit actifs', icon: 'domain' },
  { code: 'CAP', nom: 'Capitaux propres & financement', exemples: 'Restructuration financière, reclassement de comptes', icon: 'account_balance' },
  { code: 'EMP', nom: 'Emprunts & dettes financières', exemples: 'Renégociation bancaire, analyse de covenant, plan de désendettement', icon: 'credit_score' },
  { code: 'FRS', nom: 'Fournisseurs & achats', exemples: 'Audit des contrats fournisseurs, plan de réduction des achats', icon: 'local_shipping' },
  { code: 'CLI', nom: "Clients & chiffre d'affaires", exemples: 'Analyse de concentration clients, stratégie de diversification', icon: 'storefront' },
  { code: 'SOC', nom: 'Social & charges de personnel', exemples: "Grille salariale, audit prévoyance/mutuelle, plan d'intéressement", icon: 'groups' },
  { code: 'FIS', nom: 'Fiscal & TVA', exemples: "Optimisation TVA, audit des crédits d'impôt, contrôle fiscal préventif", icon: 'receipt_long' },
  { code: 'TRE', nom: 'Trésorerie', exemples: 'Plan de trésorerie prévisionnel, gestion des délais de paiement', icon: 'savings' },
  { code: 'STK', nom: 'Stocks & en-cours', exemples: 'Méthode de valorisation, optimisation des rotations', icon: 'inventory_2' },
  { code: 'DIV', nom: 'Divers & autres postes', exemples: 'Toute autre observation non rattachée aux cycles précédents', icon: 'more_horiz' },
] as const;

export type CodeCycle = typeof CYCLES_MISSIONS[number]['code'];

export function nomCycle(code: string | null | undefined): string {
  return CYCLES_MISSIONS.find(c => c.code === code)?.nom ?? 'Hors cycle';
}

export type StatutMission = 'PROPOSEE' | 'EN_DISCUSSION' | 'ACCEPTEE' | 'REFUSEE' | 'SANS_SUITE';

/** Statuts et codes couleur du CDC §3.4. */
export const STATUTS_MISSION: { code: StatutMission; libelle: string; definition: string }[] = [
  { code: 'PROPOSEE', libelle: 'Proposée', definition: 'Identifiée et formalisée dans PASSIDOC, pas encore présentée au client.' },
  { code: 'EN_DISCUSSION', libelle: 'En discussion', definition: 'Présentée au client, échanges en cours, décision non prise.' },
  { code: 'ACCEPTEE', libelle: 'Acceptée', definition: 'Validée par le client — lettre de mission signée ou en cours de signature.' },
  { code: 'REFUSEE', libelle: 'Refusée', definition: 'Le client a été sollicité et a dit non. Conservée pour réexamen l’année suivante.' },
  { code: 'SANS_SUITE', libelle: 'Sans suite', definition: 'Notée mais jamais soumise au client — opportunité non exploitée.' },
];

export function libelleStatut(s: string | null | undefined): string {
  return STATUTS_MISSION.find(x => x.code === s)?.libelle ?? '—';
}

export interface PersonneMission { id: number; firstName: string; lastName: string }

export interface Mission {
  id: number;
  titre: string;
  description?: string | null;
  /** Montant estimé € HT ; null = non renseigné (affiché « — »). */
  honoraires: number | null;
  statut: StatutMission;
  cycle: CodeCycle | null;
  exerciceId: number | null;
  annee?: number | null;
  dateRelance: string | null;
  responsableId: number | null;
  responsable: PersonneMission | null;
  archivee: boolean;
  aRelancer: boolean;
  type?: 'REALISEE' | 'REFUSEE' | 'DETECTEE' | 'IA';
  arguments?: string | null;
  raisonRefus?: string | null;
  repriseDeId?: number | null;
  statutModifieLe?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MissionDejaRefusee extends Mission { anneeRefus: number }

export interface SyntheseMissions {
  total: number;
  potentiel: number;
  proposees: { nombre: number; montant: number };
  enDiscussion: { nombre: number; montant: number };
  acceptees: { nombre: number; montant: number };
  refusees: number;
  sansSuite: number;
  aRelancer: number;
  tauxConversion: number | null;
}

export interface CyclesDossier {
  cycles: { code: CodeCycle; nom: string; exemples: string }[];
  recommandations: Partial<Record<CodeCycle, { texte: string; updatedAt: string }>>;
  dejaRefusees: MissionDejaRefusee[];
}

export interface HistoriqueStatut {
  id: number;
  ancienStatut: StatutMission | null;
  nouveauStatut: StatutMission;
  auteurNom: string | null;
  createdAt: string;
}

export interface MissionCabinet extends Mission {
  secteur: string | null;
  client: { id: number; nom: string; secteur: string | null };
}

export interface TableauMissionsCabinet {
  aujourdhui: string;
  peutModifier: boolean;
  kpi: SyntheseMissions;
  missions: MissionCabinet[];
  responsables: { id: number; nom: string }[];
  secteurs: { code: string; label: string }[];
}

export interface FiltresMissionsCabinet {
  statuts?: StatutMission[];
  responsableId?: number | null;
  cycle?: string;
  tranche?: '' | 'MOINS_1000' | 'DE_1000_A_5000' | 'PLUS_5000';
  relance?: '' | 'SEMAINE' | 'MOIS' | 'RETARD';
  secteur?: string;
  avecMontant?: boolean;
  inclureArchivees?: boolean;
}

/** R7 : suppression possible seulement tant que le client n'a pas été sollicité. */
export function peutSupprimerMission(statut: string | null | undefined): boolean {
  return !statut || statut === 'PROPOSEE' || statut === 'SANS_SUITE';
}

/** Montant en euros avec séparateur de milliers, « — » si non renseigné (R6). */
export function formatMontant(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${Math.round(Number(v)).toLocaleString('fr-FR')} €`;
}

export function initialesPersonne(p: PersonneMission | null | undefined): string {
  return p ? `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase() : '';
}

export function nomPersonne(p: PersonneMission | null | undefined): string {
  return p ? `${p.firstName} ${p.lastName}`.trim() : '';
}

/** Nombre de recommandations dans le texte d'un cycle : une par ligne non vide. */
export function compterRecommandations(texte: string | null | undefined): number {
  return (texte ?? '').split('\n').map(l => l.replace(/^[\s\-•*]+/, '').trim()).filter(Boolean).length;
}

/** Résumé d'un cycle replié (CDC §3.5) : « 2 en discussion, 1 acceptée ». */
export function resumeStatuts(missions: Pick<Mission, 'statut' | 'archivee'>[]): { code: StatutMission; libelle: string; nombre: number }[] {
  const pluriel: Record<StatutMission, [string, string]> = {
    PROPOSEE: ['proposée', 'proposées'],
    EN_DISCUSSION: ['en discussion', 'en discussion'],
    ACCEPTEE: ['acceptée', 'acceptées'],
    REFUSEE: ['refusée', 'refusées'],
    SANS_SUITE: ['sans suite', 'sans suite'],
  };
  return STATUTS_MISSION
    .map(s => ({ code: s.code, nombre: missions.filter(m => !m.archivee && m.statut === s.code).length }))
    .filter(x => x.nombre > 0)
    .sort((a, b) => b.nombre - a.nombre)
    .map(x => ({ ...x, libelle: `${x.nombre} ${pluriel[x.code][x.nombre > 1 ? 1 : 0]}` }));
}
