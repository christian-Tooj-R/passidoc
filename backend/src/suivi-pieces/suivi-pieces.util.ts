import { FLUX_PERIODICITE } from '../entities/client.entity';
import { ApprocheClient } from '../fiche-identite/relation-client';

/**
 * Suivi des pièces manquantes (cahier v2 #1) — règles pures, testées dans suivi-pieces.util.spec.ts.
 *
 * Source des données : la grille des documents mensuels du dossier (flux mensuels). La
 * synchronisation TIIME viendra alimenter cette même grille une fois l'accès partenaire obtenu.
 *  - un document du mois M est attendu à partir du 1er du mois M+1 (échéance) ;
 *  - VERT : rien de manquant à échéance ; ORANGE : manquant mais dans le délai de relance ;
 *    ROUGE : au moins une pièce manquante depuis plus de X jours (délai paramétrable).
 */
export type Indicateur = 'VERT' | 'ORANGE' | 'ROUGE';
export const DELAI_RELANCE_DEFAUT = 15;

export const LIBELLES_FLUX: Record<string, string> = {
  RELEVE_BANCAIRE:   'Relevés bancaires',
  TVA_MENSUELLE:     'TVA mensuelle',
  TVA_TRIMESTRIELLE: 'TVA trimestrielle',
  TVA_ANNUELLE:      'TVA annuelle (DCA12)',
  PAIE:              'Éléments de paie',
  RAPPORT_VENTE:     'Rapport de vente',
  RECETTE_AMENITIZ:  'Recette Amenitiz',
  PIECES_COMPTABLES: 'Pièces comptables (achats / ventes)',
};

export interface TypeSuivi { key: string; label: string }
export interface FluxLu { type: string; mois: number; annee: number; statut: string; dateRelance?: Date | string | null }

export interface PieceManquante {
  type: string;
  libelle: string;
  mois: number;
  annee: number;
  /** Date à partir de laquelle le document est attendu (AAAA-MM-JJ). */
  echeance: string;
  joursRetard: number;
  statut: 'MANQUANT' | 'EN_RETARD';
}

export interface AnalysePieces {
  attendus: number;
  deposes: number;
  /** Complétude en % des documents arrivés à échéance (100 si rien n'est encore attendu). */
  taux: number;
  manquantes: PieceManquante[];
  plusAncienRetard: number;
  horsDelai: number;
  indicateur: Indicateur;
  derniereRelance: string | null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Échéance du document d'un mois : le 1er du mois suivant. */
export function echeance(annee: number, mois: number): string {
  return iso(new Date(Date.UTC(annee, mois, 1)));
}

export function joursEntre(debut: string, fin: string): number {
  return Math.floor((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86_400_000);
}

/** Mois de l'année pour lesquels le document est attendu (périodicité) et déjà échu. */
export function moisEchus(type: string, annee: number, aujourdhui: string): number[] {
  const p = FLUX_PERIODICITE[type] ?? 'monthly';
  const mois: number[] = [];
  for (let m = 1; m <= 12; m++) {
    if (p === 'quarterly' && m % 3 !== 0) continue;
    if (p === 'annual' && m !== 12) continue;
    if (echeance(annee, m) <= aujourdhui) mois.push(m);
  }
  return mois;
}

export function analyserPieces(o: {
  types: TypeSuivi[]; flux: FluxLu[]; annee: number; aujourdhui: string; delaiJours?: number;
}): AnalysePieces {
  const delai = o.delaiJours ?? DELAI_RELANCE_DEFAUT;
  const parCle = new Map(o.flux.filter(f => f.annee === o.annee).map(f => [`${f.type}|${f.mois}`, f]));
  const manquantes: PieceManquante[] = [];
  let attendus = 0;
  for (const t of o.types) {
    for (const m of moisEchus(t.key, o.annee, o.aujourdhui)) {
      attendus++;
      const f = parCle.get(`${t.key}|${m}`);
      if (f?.statut === 'DEPOSE') continue;
      const ech = echeance(o.annee, m);
      manquantes.push({
        type: t.key, libelle: t.label, mois: m, annee: o.annee, echeance: ech,
        joursRetard: Math.max(0, joursEntre(ech, o.aujourdhui)),
        statut: f?.statut === 'EN_RETARD' ? 'EN_RETARD' : 'MANQUANT',
      });
    }
  }
  manquantes.sort((a, b) => b.joursRetard - a.joursRetard || a.libelle.localeCompare(b.libelle));
  const plusAncienRetard = manquantes[0]?.joursRetard ?? 0;
  const horsDelai = manquantes.filter(p => p.joursRetard > delai).length;
  const relances = o.flux.map(f => f.dateRelance).filter(Boolean).map(d => new Date(d as any).toISOString());
  return {
    attendus,
    deposes: attendus - manquantes.length,
    taux: attendus ? Math.round(((attendus - manquantes.length) / attendus) * 100) : 100,
    manquantes,
    plusAncienRetard,
    horsDelai,
    indicateur: !manquantes.length ? 'VERT' : horsDelai ? 'ROUGE' : 'ORANGE',
    derniereRelance: relances.length ? relances.sort()[relances.length - 1] : null,
  };
}

// ── Rédaction de la relance (ton selon l'approche client, cahier v2 #3) ──

const libelleMois = (annee: number, mois: number) =>
  new Date(Date.UTC(annee, mois - 1, 1)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Prénom probable : « DUBOIS Marie » (format Pappers) → Marie ; « Marie Dubois » → Marie. */
export function prenomDe(nom?: string | null): string | null {
  const mots = (nom ?? '').trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return null;
  if (mots.length > 1 && mots[0] === mots[0].toUpperCase() && /[A-Z]/.test(mots[0])) {
    const p = mots.find(m => m !== m.toUpperCase());
    if (p) return p;
  }
  return mots[0];
}

/** Liste à puces : une ligne par type de document avec ses périodes manquantes. */
export function listePieces(manquantes: PieceManquante[]): string {
  const parType = new Map<string, PieceManquante[]>();
  for (const p of [...manquantes].sort((a, b) => a.annee - b.annee || a.mois - b.mois)) {
    parType.set(p.libelle, [...(parType.get(p.libelle) ?? []), p]);
  }
  return [...parType].map(([lib, ps]) => `• ${lib} : ${ps.map(p => libelleMois(p.annee, p.mois)).join(', ')}`).join('\n');
}

export function redigerRelance(o: {
  approche: ApprocheClient; contactNom: string | null; dossier: string; cabinet: string;
  signataire: string; manquantes: PieceManquante[];
}): { objet: string; texte: string } {
  const liste = listePieces(o.manquantes);
  const prenom = prenomDe(o.contactNom);
  const signature = `${o.signataire}\n${o.cabinet}`;
  const objet = o.approche === 'FORMEL'
    ? `Documents comptables manquants — ${o.dossier}`
    : `${o.approche === 'INFORMEL' || o.approche === 'AMICAL' ? 'Petit rappel' : 'Rappel'} : documents en attente — ${o.dossier}`;
  const corps: Record<ApprocheClient, string[]> = {
    FORMEL: [
      'Madame, Monsieur,',
      "Sauf erreur de notre part, nous n'avons pas encore reçu les documents suivants, nécessaires à la tenue de votre comptabilité :",
      liste,
      'Nous vous serions reconnaissants de bien vouloir nous les transmettre dans les meilleurs délais.',
      "Nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.",
    ],
    PROFESSIONNEL: [
      o.contactNom ? `Bonjour ${o.contactNom},` : 'Bonjour,',
      'Sauf erreur de notre part, il nous manque les documents suivants pour avancer sur votre comptabilité :',
      liste,
      'Pourriez-vous nous les transmettre dès que possible ?',
      'Cordialement,',
    ],
    AMICAL: [
      prenom ? `Bonjour ${prenom},` : 'Bonjour,',
      'Petit rappel : pour avancer sur votre dossier, il nous manque encore les documents suivants :',
      liste,
      "Merci d'avance pour votre envoi, et n'hésitez pas à nous appeler si besoin.",
      'Belle journée,',
    ],
    INFORMEL: [
      prenom ? `Bonjour ${prenom},` : 'Bonjour,',
      'Petit rappel : il nous manque encore ces documents pour avancer sur ta compta :',
      liste,
      'Tu peux nous les envoyer quand tu as un moment ? Merci beaucoup !',
      'À bientôt,',
    ],
  };
  return { objet, texte: [...corps[o.approche], signature].join('\n\n') };
}
