/**
 * Module Missions (CDC « Module Missions — restructuration et enrichissement », 19/10/2026) :
 * cycles de révision, statuts de suivi et règles métier R1–R8, en fonctions pures.
 *
 * Dates manipulées en chaînes ISO (AAAA-MM-JJ) : pas de décalage de fuseau.
 */

/** Cycles de révision (CDC §3.2). Ordre d'affichage = ordre du tableau. */
export const CYCLES_MISSIONS = [
  { code: 'IMM', nom: 'Immobilisations & amortissements', exemples: 'Plan de financement, CIOP (art. 244 quater W CGI), audit actifs' },
  { code: 'CAP', nom: 'Capitaux propres & financement', exemples: 'Restructuration financière, reclassement de comptes' },
  { code: 'EMP', nom: 'Emprunts & dettes financières', exemples: 'Renégociation bancaire, analyse de covenant, plan de désendettement' },
  { code: 'FRS', nom: 'Fournisseurs & achats', exemples: 'Audit des contrats fournisseurs, plan de réduction des achats' },
  { code: 'CLI', nom: "Clients & chiffre d'affaires", exemples: 'Analyse de concentration clients, stratégie de diversification' },
  { code: 'SOC', nom: 'Social & charges de personnel', exemples: "Grille salariale, audit prévoyance/mutuelle, plan d'intéressement" },
  { code: 'FIS', nom: 'Fiscal & TVA', exemples: "Optimisation TVA, audit des crédits d'impôt, contrôle fiscal préventif" },
  { code: 'TRE', nom: 'Trésorerie', exemples: 'Plan de trésorerie prévisionnel, gestion des délais de paiement' },
  { code: 'STK', nom: 'Stocks & en-cours', exemples: 'Méthode de valorisation, optimisation des rotations' },
  { code: 'DIV', nom: 'Divers & autres postes', exemples: 'Toute autre observation non rattachée aux cycles précédents' },
] as const;

export type CodeCycle = typeof CYCLES_MISSIONS[number]['code'];
export const CODES_CYCLES = CYCLES_MISSIONS.map(c => c.code) as string[];

export function estCycle(v: unknown): v is CodeCycle {
  return typeof v === 'string' && CODES_CYCLES.includes(v);
}

export function nomCycle(code: string | null | undefined): string {
  return CYCLES_MISSIONS.find(c => c.code === code)?.nom ?? 'Hors cycle';
}

/** Statuts de suivi (CDC §3.4). */
export const STATUTS_MISSION = ['PROPOSEE', 'EN_DISCUSSION', 'ACCEPTEE', 'REFUSEE', 'SANS_SUITE'] as const;
export type StatutMission = typeof STATUTS_MISSION[number];
export const STATUT_PAR_DEFAUT: StatutMission = 'PROPOSEE';   // R2

export const LIBELLES_STATUT: Record<StatutMission, string> = {
  PROPOSEE: 'Proposée',
  EN_DISCUSSION: 'En discussion',
  ACCEPTEE: 'Acceptée',
  REFUSEE: 'Refusée',
  SANS_SUITE: 'Sans suite',
};

export function estStatut(v: unknown): v is StatutMission {
  return typeof v === 'string' && (STATUTS_MISSION as readonly string[]).includes(v);
}

/** Statut des missions de l'ancien module, déduit de leur type (rattrapage au démarrage). */
export function statutDepuisType(type: string | null | undefined): StatutMission {
  if (type === 'REALISEE') return 'ACCEPTEE';
  if (type === 'REFUSEE') return 'REFUSEE';
  return 'PROPOSEE';   // DETECTEE, IA
}

/** R7 : suppression possible seulement tant que le client n'a pas été sollicité. */
export function peutSupprimer(statut: string | null | undefined): boolean {
  return !statut || statut === 'PROPOSEE' || statut === 'SANS_SUITE';
}

export interface MissionPourRegles {
  statut: string | null;
  honoraires?: number | null;
  dateRelance?: string | null;
  archivee?: boolean;
}

/** R3 : date de relance dépassée sur une mission encore ouverte (proposée ou en discussion). */
export function estARelancer(m: MissionPourRegles, aujourdhui: string): boolean {
  return !m.archivee && !!m.dateRelance && m.dateRelance < aujourdhui
    && (m.statut === 'PROPOSEE' || m.statut === 'EN_DISCUSSION');
}

/** Mission « active » : ni refusée, ni sans suite, ni archivée — entre dans le potentiel. */
export function estActive(m: MissionPourRegles): boolean {
  return !m.archivee && (m.statut === 'PROPOSEE' || m.statut === 'EN_DISCUSSION' || m.statut === 'ACCEPTEE');
}

const montant = (m: MissionPourRegles) => Number(m.honoraires) || 0;   // R6 : vide = 0, compté quand même

export interface SyntheseMissions {
  total: number;
  potentiel: number;
  proposees: { nombre: number; montant: number };
  enDiscussion: { nombre: number; montant: number };
  acceptees: { nombre: number; montant: number };
  refusees: number;
  sansSuite: number;
  aRelancer: number;
  /** Acceptées / (Proposées + En discussion + Acceptées), en % arrondi ; null sans base. */
  tauxConversion: number | null;
}

/** KPI du bandeau (CDC §4.4 pour un dossier, §5.2 pour le cabinet) — missions archivées exclues. */
export function synthese(missions: MissionPourRegles[], aujourdhui: string): SyntheseMissions {
  const vivantes = missions.filter(m => !m.archivee);
  const groupe = (s: StatutMission) => {
    const l = vivantes.filter(m => m.statut === s);
    return { nombre: l.length, montant: l.reduce((a, m) => a + montant(m), 0) };
  };
  const proposees = groupe('PROPOSEE');
  const enDiscussion = groupe('EN_DISCUSSION');
  const acceptees = groupe('ACCEPTEE');
  const base = proposees.nombre + enDiscussion.nombre + acceptees.nombre;
  return {
    total: vivantes.length,
    potentiel: proposees.montant + enDiscussion.montant + acceptees.montant,
    proposees, enDiscussion, acceptees,
    refusees: vivantes.filter(m => m.statut === 'REFUSEE').length,
    sansSuite: vivantes.filter(m => m.statut === 'SANS_SUITE').length,
    aRelancer: vivantes.filter(m => estARelancer(m, aujourdhui)).length,
    tauxConversion: base ? Math.round((acceptees.nombre / base) * 100) : null,
  };
}

// ── Filtres de la vue cabinet (CDC §5.4) ────────────────────────────────────

export type TrancheMontant = 'MOINS_1000' | 'DE_1000_A_5000' | 'PLUS_5000';
export type FiltreRelance = 'SEMAINE' | 'MOIS' | 'RETARD';

export interface FiltresMissions {
  statuts?: string[];
  responsableId?: number;
  /** Code cycle, ou « HORS_CYCLE ». */
  cycle?: string;
  tranche?: TrancheMontant;
  relance?: FiltreRelance;
  secteur?: string;
  avecMontant?: boolean;
  inclureArchivees?: boolean;
}

export interface MissionFiltrable extends MissionPourRegles {
  cycle?: string | null;
  responsableId?: number | null;
  secteur?: string | null;
}

export function ajouterJoursIso(iso: string, jours: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

/** Fin de la semaine (dimanche) et du mois calendaire contenant `iso`. */
export function finSemaine(iso: string): string {
  const jour = new Date(`${iso}T00:00:00Z`).getUTCDay();   // 0 = dimanche
  return ajouterJoursIso(iso, jour === 0 ? 0 : 7 - jour);
}

export function finMois(iso: string): string {
  const [a, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

export function correspondTranche(honoraires: number | null | undefined, tranche: TrancheMontant): boolean {
  if (honoraires == null || honoraires === ('' as any)) return false;
  const v = Number(honoraires);
  if (tranche === 'MOINS_1000') return v < 1000;
  if (tranche === 'DE_1000_A_5000') return v >= 1000 && v <= 5000;
  return v > 5000;
}

export function filtrerMissions<T extends MissionFiltrable>(missions: T[], f: FiltresMissions, aujourdhui: string): T[] {
  return missions.filter(m => {
    if (!f.inclureArchivees && m.archivee) return false;
    if (f.statuts?.length && !f.statuts.includes(m.statut ?? '')) return false;
    if (f.responsableId && m.responsableId !== f.responsableId) return false;
    if (f.cycle && (f.cycle === 'HORS_CYCLE' ? !!m.cycle : m.cycle !== f.cycle)) return false;
    if (f.tranche && !correspondTranche(m.honoraires, f.tranche)) return false;
    if (f.avecMontant && m.honoraires == null) return false;
    if (f.secteur && m.secteur !== f.secteur) return false;
    if (f.relance) {
      const ouverte = m.statut === 'PROPOSEE' || m.statut === 'EN_DISCUSSION';
      if (!m.dateRelance || !ouverte) return false;
      if (f.relance === 'RETARD' && !estARelancer(m, aujourdhui)) return false;
      if (f.relance === 'SEMAINE' && (m.dateRelance < aujourdhui || m.dateRelance > finSemaine(aujourdhui))) return false;
      if (f.relance === 'MOIS' && (m.dateRelance < aujourdhui || m.dateRelance > finMois(aujourdhui))) return false;
    }
    return true;
  });
}

// ── Notifications de relance (R8) ───────────────────────────────────────────

export type EcheanceRelance = 'J3' | 'J0' | null;

/**
 * Notification à envoyer pour une mission, la nuit du jour `aujourdhui` :
 *  - J0 : la date de relance est atteinte (ou dépassée, rattrapage) et pas encore notifiée ;
 *  - J3 : la date de relance arrive dans les 3 jours et le rappel n'a pas encore été envoyé.
 */
export function echeanceANotifier(
  m: MissionPourRegles & { notifJ3Pour?: string | null; notifJ0Pour?: string | null },
  aujourdhui: string,
): EcheanceRelance {
  if (m.archivee || !m.dateRelance || !(m.statut === 'PROPOSEE' || m.statut === 'EN_DISCUSSION')) return null;
  if (m.dateRelance <= aujourdhui) return m.notifJ0Pour === m.dateRelance ? null : 'J0';
  if (ajouterJoursIso(m.dateRelance, -3) <= aujourdhui) return m.notifJ3Pour === m.dateRelance ? null : 'J3';
  return null;
}
