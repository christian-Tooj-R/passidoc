import { LigneRapportDetail, MISSION_CODES } from '../../../core/services/saisie-temps.service';
import { LIEUX_TRAVAIL, LieuTravail } from '../../../core/models/lieu-travail';

/**
 * Moteur de regroupement du rapport « Détail des temps passés » (format Tempolia) :
 * jusqu'à 3 niveaux de regroupement choisis par l'utilisateur, sous-totaux Temps + PV Col
 * à chaque niveau. Fonctions pures — testées dans rapport-temps.util.spec.ts.
 */
export type Dimension = 'presence' | 'client' | 'affaire' | 'collaborateur' | 'mission' | 'mois' | 'lieu';

export const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: 'presence',      label: 'Présence facturable / non facturable / Absence' },
  { key: 'client',        label: 'Client / TNF' },
  { key: 'affaire',       label: 'Affaire' },
  { key: 'collaborateur', label: 'Collaborateur' },
  { key: 'mission',       label: 'Tâche' },
  { key: 'mois',          label: 'Mois' },
  { key: 'lieu',          label: 'Pôle de travail' },
];

/** Libellés des pôles de travail (cahier v2 #5) — remplaçables par ceux du cabinet. */
let libellesLieu: Record<LieuTravail, string> = Object.fromEntries(LIEUX_TRAVAIL.map(l => [l.code, l.label])) as Record<LieuTravail, string>;
export function definirLibellesLieu(libelles: Partial<Record<LieuTravail, string>>) {
  libellesLieu = { ...libellesLieu, ...libelles };
}
export function libelleLieu(code?: string | null): string {
  return (code && libellesLieu[code as LieuTravail]) || 'Non précisé';
}

/** Libellé court d'une dimension, pour les en-têtes de groupe (« Client / TNF : TRANSMAS »). */
export function libelleDimension(d: Dimension): string {
  return d === 'presence' ? 'Présence' : DIMENSIONS.find(x => x.key === d)?.label ?? d;
}

/** Regroupement par défaut, identique au rapport Tempolia d'AFYM. */
export const REGROUPEMENT_TEMPOLIA: Dimension[] = ['presence', 'client', 'affaire'];

export const LIBELLES_PRESENCE: Record<LigneRapportDetail['presence'], string> = {
  FACTURABLE: 'Présence facturable',
  NON_FACTURABLE: 'Présence non facturable',
  ABSENCE: 'Absence',
};
const ORDRE_PRESENCE = ['FACTURABLE', 'NON_FACTURABLE', 'ABSENCE'];

const MOIS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export interface Groupe {
  dimension: Dimension;
  cle: string;
  libelle: string;
  /** 1 = premier niveau de regroupement. */
  niveau: number;
  /** Clé unique (ancêtres + soi), pour le suivi Angular et le repli des sections. */
  chemin: string;
  enfants: Groupe[];
  /** Toutes les lignes du groupe (y compris celles des sous-groupes), triées. */
  lignes: LigneRapportDetail[];
  totalHeures: number;
  totalPv: number;
}

export function libelleMission(code: string | null): string {
  if (!code) return 'Sans tâche';
  return MISSION_CODES.find(m => m.code === code)?.label ?? code;
}

export function libelleMois(yyyyMm: string): string {
  const [a, m] = yyyyMm.split('-');
  return `${MOIS_FR[+m - 1] ?? m} ${a}`;
}

const arrondi = (n: number) => Math.round(n * 100) / 100;

export function totaux(lignes: LigneRapportDetail[]): { heures: number; pv: number } {
  return {
    heures: arrondi(lignes.reduce((s, l) => s + l.dureeHeures, 0)),
    pv: arrondi(lignes.reduce((s, l) => s + l.pv, 0)),
  };
}

/** Clé, libellé et rang de tri d'une ligne pour une dimension. Les « sans … » vont en dernier. */
export function valeurDimension(l: LigneRapportDetail, d: Dimension): { cle: string; libelle: string; tri: string } {
  switch (d) {
    case 'presence':
      return { cle: l.presence, libelle: LIBELLES_PRESENCE[l.presence], tri: String(ORDRE_PRESENCE.indexOf(l.presence)) };
    case 'client':
      return l.clientId
        ? { cle: `c${l.clientId}`, libelle: l.clientTnf, tri: `0${l.clientTnf}` }
        : { cle: `t${l.clientTnf}`, libelle: l.clientTnf, tri: `1${l.clientTnf}` };
    case 'affaire':
      // Affaires de la plus récente à la plus ancienne (tri inversé sur le code).
      return l.affaire
        ? { cle: l.affaire, libelle: l.affaire, tri: `0${9999 - +l.affaire.slice(1, 5)}${12 - +l.affaire.slice(6, 8)}` }
        : { cle: '—', libelle: 'Sans affaire', tri: '1' };
    case 'collaborateur':
      return { cle: String(l.collaborateurId), libelle: l.collaborateur, tri: l.collaborateur };
    case 'mission': {
      const i = MISSION_CODES.findIndex(m => m.code === l.missionCode);
      return { cle: l.missionCode ?? '—', libelle: libelleMission(l.missionCode), tri: i >= 0 ? String(i).padStart(2, '0') : '99' };
    }
    case 'mois': {
      const ym = l.date.slice(0, 7);
      return { cle: ym, libelle: libelleMois(ym), tri: String(999999 - +ym.replace('-', '')) };
    }
    case 'lieu': {
      if (l.presence === 'ABSENCE') return { cle: 'ABSENCE', libelle: 'Absence', tri: '8' };
      const i = LIEUX_TRAVAIL.findIndex(x => x.code === l.lieuTravail);
      return i >= 0 ? { cle: l.lieuTravail!, libelle: libelleLieu(l.lieuTravail), tri: String(i) } : { cle: '—', libelle: 'Non précisé', tri: '9' };
    }
  }
}

/** Tri des lignes de détail : par collaborateur puis date décroissante (comme Tempolia), ou par date. */
export function trierLignes(lignes: LigneRapportDetail[], tri: 'collaborateur' | 'date' = 'collaborateur'): LigneRapportDetail[] {
  return [...lignes].sort((a, b) => {
    if (tri === 'collaborateur') {
      const c = a.collaborateur.localeCompare(b.collaborateur, 'fr', { sensitivity: 'base' });
      if (c) return c;
    }
    return b.date.localeCompare(a.date) || a.id - b.id;
  });
}

export function grouper(
  lignes: LigneRapportDetail[], dimensions: Dimension[],
  tri: 'collaborateur' | 'date' = 'collaborateur', niveau = 1, parent = '',
): Groupe[] {
  const [d, ...reste] = dimensions;
  if (!d) return [];
  const map = new Map<string, { libelle: string; tri: string; lignes: LigneRapportDetail[] }>();
  for (const l of lignes) {
    const v = valeurDimension(l, d);
    const g = map.get(v.cle) ?? { libelle: v.libelle, tri: v.tri, lignes: [] };
    g.lignes.push(l);
    map.set(v.cle, g);
  }
  return [...map.entries()]
    .sort(([, a], [, b]) => a.tri.localeCompare(b.tri, 'fr', { sensitivity: 'base' }))
    .map(([cle, g]) => {
      const chemin = `${parent}/${d}:${cle}`;
      const t = totaux(g.lignes);
      return {
        dimension: d, cle, libelle: g.libelle, niveau, chemin,
        enfants: grouper(g.lignes, reste, tri, niveau + 1, chemin),
        lignes: trierLignes(g.lignes, tri),
        totalHeures: t.heures,
        totalPv: t.pv,
      };
    });
}

/** Aplatit l'arbre (parcours en profondeur) — utilisé par l'export PDF/Excel et l'affichage. */
export function aplatir(groupes: Groupe[]): Groupe[] {
  return groupes.flatMap(g => [g, ...aplatir(g.enfants)]);
}

/** Récapitulatif d'une dimension : temps, PV et part du temps total. */
export function recapitulatif(lignes: LigneRapportDetail[], d: Dimension): { libelle: string; heures: number; pv: number; part: number }[] {
  const total = totaux(lignes).heures || 1;
  return grouper(lignes, [d]).map(g => ({ libelle: g.libelle, heures: g.totalHeures, pv: g.totalPv, part: g.totalHeures / total }));
}

/** Pour jsPDF : sa police Helvetica n'a pas l'espace fine insécable des milliers (« 2 910,00 »). */
export function textePdf(t: string): string {
  return t.replace(/[\u202f\u00a0]/g, ' ');
}

export function formatEuros(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
