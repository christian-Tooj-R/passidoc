/**
 * Saisie automatique du temps d'une tâche terminée (module Travail).
 *
 * Quand une tâche passe à « Terminée », le temps chronométré sur la tâche (passages
 * EN_COURS → sortie, cumulés dans Task.tempsTotalSecondes) est enregistré dans la saisie des
 * temps du collaborateur qui l'a réalisée. Le temps déjà saisi pour la tâche (arrêt du
 * minuteur, terminaison précédente avant une réouverture) est déduit : jamais deux fois le
 * même temps.
 */
import { TypeTemps, CategorieNonFacturable } from '../entities/saisie-temps.entity';

export type MotifSansSaisie = 'AUCUN_TEMPS' | 'DEJA_SAISI' | 'REFUSEE';

export type SaisieAuto =
  | { creee: true; saisieId: number; dureeHeures: number; date: string; collaborateurId: number; collaborateur: string }
  | { creee: false; motif: MotifSansSaisie; message: string };

export const MESSAGES_SANS_SAISIE: Record<Exclude<MotifSansSaisie, 'REFUSEE'>, string> = {
  AUCUN_TEMPS: 'Aucun temps chronométré sur cette tâche : aucune saisie créée.',
  DEJA_SAISI: 'Le temps chronométré de cette tâche est déjà dans la saisie des temps.',
};

/** Type de tâche → code mission de la saisie des temps (null = laissé vide). */
const MISSION_PAR_TYPE: Record<string, string> = {
  TVA: 'FISC',
  PAIE: 'SOC',
  ACHATS: 'TCO',
  VENTES: 'TCO',
  RB: 'TCO',
  GV: 'TCO',
  DR: 'REV',
};

export function missionDeTache(type?: string | null): string | null {
  return (type && MISSION_PAR_TYPE[type]) || null;
}

/** Minutes chronométrées restant à saisir (arrondi à la minute ; 0 si tout est déjà saisi). */
export function minutesRestantes(totalSecondes: number, dejaSaisiHeures: number): number {
  const total = Math.round(Math.max(0, totalSecondes || 0) / 60);
  const deja = Math.round(Math.max(0, dejaSaisiHeures || 0) * 60);
  return Math.max(0, total - deja);
}

/** Durée décimale arrondie au centième d'heure, comme le formulaire du minuteur. */
export function heuresDeMinutes(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Date (AAAA-MM-JJ) et heure (HH:MM) d'un instant dans le fuseau donné. Sans fuseau (ou
 * fuseau inconnu) : heure locale du serveur.
 */
export function horodatageLocal(instant: Date, timeZone?: string | null): { date: string; heure: string } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || undefined,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(instant);
  } catch {
    return horodatageLocal(instant);
  }
  const v = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
  return { date: `${v('year')}-${v('month')}-${v('day')}`, heure: `${v('hour')}:${v('minute')}` };
}

/** Heure de début = fin − durée, si la plage reste dans la journée (sinon null). */
export function heureDebutAvant(heureFin: string, minutes: number): string | null {
  const [h, m] = heureFin.split(':').map(Number);
  const debut = h * 60 + m - minutes;
  if (!Number.isFinite(debut) || debut < 0) return null;
  return `${String(Math.floor(debut / 60)).padStart(2, '0')}:${String(debut % 60).padStart(2, '0')}`;
}

export interface TacheATerminer {
  id: number;
  taskId?: string | null;
  titre: string;
  type?: string | null;
  clientId?: number | null;
  estFacturable?: boolean | null;
}

/** Champs de la saisie générée (hors durée, date et heures). */
export function champsSaisieTache(tache: TacheATerminer): {
  type: TypeTemps; categorie?: CategorieNonFacturable; missionCode?: string; clientId?: number; commentaire: string;
} {
  // Sans dossier, le temps ne peut pas être facturé à un client.
  const facturable = tache.estFacturable !== false && !!tache.clientId;
  const missionCode = missionDeTache(tache.type);
  return {
    type: facturable ? TypeTemps.FACTURABLE : TypeTemps.NON_FACTURABLE,
    ...(facturable ? {} : { categorie: CategorieNonFacturable.AUTRE }),
    ...(missionCode ? { missionCode } : {}),
    ...(tache.clientId ? { clientId: tache.clientId } : {}),
    commentaire: tache.taskId ? `${tache.titre} (tâche ${tache.taskId})` : tache.titre,
  };
}
