/**
 * Date locale au format YYYY-MM-DD — À UTILISER À LA PLACE de `date.toISOString().split('T')[0]`.
 *
 * `toISOString()` convertit en UTC avant de formater : pour un fuseau en avance sur UTC
 * (Réunion UTC+4, Madagascar UTC+3), un minuit local ou une heure matinale bascule sur le
 * jour UTC précédent, ce qui décale silencieusement toutes les dates d'un jour (semaine du
 * pointage affichant les mauvais jours, "aujourd'hui" mal détecté, etc.).
 */
export function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM" local — équivalent de `toLocalIso(d).slice(0, 7)` mais sans passer par l'ISO UTC. */
export function toLocalMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
