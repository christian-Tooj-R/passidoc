/**
 * Utilitaires de durée partagés par le module Travail — mêmes règles de parsing
 * que la page "Saisie rapide" (1h30 / 1:30 / 1.5 / 1,5) et même formatage d'affichage
 * (Xh00) utilisé sur les pages "Par jour / Par semaine / Par mois / Détail".
 */

/** Accepte "1h30", "1:30", "1.5" ou "1,5" → durée en heures décimales, ou null si invalide. */
export function parseDuree(input: string): number | null {
  const s = input.trim().toLowerCase().replace(',', '.');
  if (!s) return null;
  const hMatch = s.match(/^(\d+)\s*h\s*(\d{0,2})$/);
  if (hMatch) {
    const h = parseInt(hMatch[1], 10);
    const m = hMatch[2] ? parseInt(hMatch[2], 10) : 0;
    return h + m / 60;
  }
  const hmMatch = s.match(/^(\d+):(\d{2})$/);
  if (hmMatch) {
    return parseInt(hmMatch[1], 10) + parseInt(hmMatch[2], 10) / 60;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Formate une durée décimale en "Xh00". */
export function formatHeures(h: number): string {
  if (!h || h <= 0) return '0h00';
  // Arrondi sur le total de minutes : 1,999 h donne « 2h00 » et non « 1h60 ».
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`;
}

/** Convertit une durée décimale en "HH:MM", pour la valeur d'un `<input type="time">`. */
export function toHHMM(h: number): string {
  if (!h || h <= 0) return '';
  const total = Math.round(h * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Convertit la valeur "HH:MM" d'un `<input type="time">` en heures décimales, ou null si vide/invalide. */
export function parseHHMM(input: string): number | null {
  if (!input) return null;
  const m = input.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const duree = parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
  return duree > 0 ? duree : null;
}

/** Durée en MINUTES (ex. `Task.tempsExecution`) → texte court de carte : 4 → « 4min »,
 *  65 → « 1h05 », 120 → « 2h » (arrondi sur le total : 119,6 donne « 2h », pas « 1h60 »). */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 1) return '< 1min';
  if (total < 60) return `${total}min`;
  const h = Math.floor(total / 60), m = total % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}
