import { FicheIdentite } from '../entities/fiche-identite.entity';

/**
 * Relation client (cahier Évolutions v2) :
 *  - #2 deux interlocuteurs : le contact légal (gérant, président…) et le contact
 *    opérationnel du quotidien (secrétaire, assistante, comptable interne…) ;
 *  - #3 l'approche commerciale, qui fixe le registre de communication.
 */

export const APPROCHES_CLIENT = ['FORMEL', 'PROFESSIONNEL', 'AMICAL', 'INFORMEL'] as const;
export type ApprocheClient = typeof APPROCHES_CLIENT[number];
export const APPROCHE_PAR_DEFAUT: ApprocheClient = 'PROFESSIONNEL';

export const LIBELLES_APPROCHE: Record<ApprocheClient, { libelle: string; description: string }> = {
  FORMEL:        { libelle: 'Formel',        description: 'Communications officielles, vouvoiement systématique' },
  PROFESSIONNEL: { libelle: 'Professionnel', description: 'Ton neutre et courtois, orienté résultats' },
  AMICAL:        { libelle: 'Amical',        description: 'Relation de confiance établie, ton chaleureux' },
  INFORMEL:      { libelle: 'Informel',      description: 'Échanges décontractés, tutoiement possible' },
};

export function approcheDe(fiche?: Pick<FicheIdentite, 'approcheClient'> | null): ApprocheClient {
  const a = fiche?.approcheClient;
  return a && (APPROCHES_CLIENT as readonly string[]).includes(a) ? (a as ApprocheClient) : APPROCHE_PAR_DEFAUT;
}

export interface ContactDossier {
  nom: string | null;
  fonction: string | null;
  email: string | null;
  telephone: string | null;
}

const net = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Contact légal : nom/fonction saisis, à défaut le premier gérant connu (repris de Pappers à la
 * création du dossier) ; e-mail et téléphone = les champs « contact » historiques de la fiche.
 */
export function contactLegal(fiche?: FicheIdentite | null): ContactDossier {
  const gerant = (fiche?.gerants ?? []).find(g => net(g?.nom));
  const nom = net(fiche?.contactLegalNom) ?? net(gerant?.nom);
  return {
    nom,
    fonction: net(fiche?.contactLegalFonction) ?? (nom && !net(fiche?.contactLegalNom) ? 'Gérant' : null),
    email: net(fiche?.emailContact),
    telephone: net(fiche?.telephoneContact),
  };
}

export function contactOperationnel(fiche?: FicheIdentite | null): ContactDossier {
  const c = fiche?.contactOperationnel;
  return { nom: net(c?.nom), fonction: net(c?.poste), email: net(c?.email), telephone: net(c?.telephone) };
}

/** Nature d'une communication : juridique → contact légal ; échanges courants → opérationnel. */
export type NatureCommunication = 'JURIDIQUE' | 'COURANTE';

/**
 * Interlocuteur à qui adresser une communication automatique selon sa nature, avec repli sur
 * l'autre contact s'il est le seul à avoir une adresse e-mail. `null` si aucun e-mail connu.
 */
export function destinataireCommunication(
  fiche: FicheIdentite | null | undefined, nature: NatureCommunication,
): (ContactDossier & { email: string; role: 'LEGAL' | 'OPERATIONNEL' }) | null {
  const legal = { ...contactLegal(fiche), role: 'LEGAL' as const };
  const oper = { ...contactOperationnel(fiche), role: 'OPERATIONNEL' as const };
  const ordre = nature === 'JURIDIQUE' ? [legal, oper] : [oper, legal];
  const choisi = ordre.find(c => c.email);
  return choisi ? { ...choisi, email: choisi.email! } : null;
}
