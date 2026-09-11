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
  const hrs = Math.floor(h);
  const min = Math.round((h - hrs) * 60);
  return `${hrs}h${String(min).padStart(2, '0')}`;
}
