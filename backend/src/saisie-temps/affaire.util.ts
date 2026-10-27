/**
 * Affaire = exercice comptable d'un dossier, codée comme dans Tempolia : « C » + année et
 * mois de clôture (C2026-09 = exercice clos fin 09/2026).
 *
 * Règle d'attribution d'une saisie (validée avec l'utilisateur le 2026-10-19) :
 *  1. Exercices présents dans PASSIDOC → le plus ANCIEN exercice encore OUVERT dont
 *     l'ouverture est ≤ date et dont la clôture remonte à moins de DELAI_REVISION_MOIS : les
 *     travaux faits après la date de clôture (révision, bilan) restent sur l'exercice tant
 *     qu'il n'est pas clôturé dans PASSIDOC. À défaut, l'exercice qui contient la date.
 *  2. Aucun exercice ne couvre la date → calcul depuis la date de clôture annuelle du dossier
 *     (MM-JJ, 31/12 par défaut) ; une saisie de révision (REV) faite dans les
 *     DELAI_REVISION_MOIS qui suivent une clôture reste sur l'exercice qui vient de se clore.
 *
 * Calculs sur chaînes ISO (AAAA-MM-JJ) uniquement, sans objet Date local : pas de décalage
 * de fuseau horaire (serveur en UTC, utilisateurs en UTC+3/+4).
 */
export const DELAI_REVISION_MOIS = 6;
export const CLOTURE_PAR_DEFAUT = '12-31';

export type EtatAffaire = 'O' | 'C';

export interface ExercicePourAffaire {
  dateOuverture: string;
  dateCloture: string;
  statut: string; // 'OUVERT' | 'CLOTURE'
}

export interface ContexteAffaire {
  exercices?: ExercicePourAffaire[];
  /** Date de clôture annuelle du dossier, format « MM-JJ » (Client.dateClotureExercice). */
  dateClotureExercice?: string | null;
}

export interface AffaireInfo {
  code: string;
  dateOuverture: string;
  dateCloture: string;
  etat: EtatAffaire;
  source: 'EXERCICE' | 'CALCUL';
}

const pad = (n: number) => String(n).padStart(2, '0');

function dernierJourDuMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

export function ajouterMois(iso: string, n: number): string {
  const [a, m, j] = iso.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  const na = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${na}-${pad(nm)}-${pad(Math.min(j, dernierJourDuMois(na, nm)))}`;
}

export function ajouterJours(iso: string, n: number): string {
  const [a, m, j] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + n));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function codeAffaire(dateCloture: string): string {
  return `C${dateCloture.slice(0, 4)}-${dateCloture.slice(5, 7)}`;
}

export function estCodeAffaire(code: unknown): code is string {
  return typeof code === 'string' && /^C\d{4}-(0[1-9]|1[0-2])$/.test(code);
}

function mmjjValide(mmjj?: string | null): mmjj is string {
  if (!mmjj || !/^\d{2}-\d{2}$/.test(mmjj)) return false;
  const [m, j] = mmjj.split('-').map(Number);
  return m >= 1 && m <= 12 && j >= 1 && j <= 31;
}

function clotureDeLAnnee(annee: number, mmjj: string): string {
  const [m, j] = mmjj.split('-').map(Number);
  return `${annee}-${pad(m)}-${pad(Math.min(j, dernierJourDuMois(annee, m)))}`;
}

function mmjjDuDossier(ctx: ContexteAffaire): string {
  return mmjjValide(ctx.dateClotureExercice) ? ctx.dateClotureExercice : CLOTURE_PAR_DEFAUT;
}

/** Première date de clôture annuelle (MM-JJ) postérieure ou égale à `date`. */
export function clotureSuivante(date: string, mmjj: string): string {
  const annee = Number(date.slice(0, 4));
  const c = clotureDeLAnnee(annee, mmjj);
  return c >= date ? c : clotureDeLAnnee(annee + 1, mmjj);
}

function exercicesTries(ctx: ContexteAffaire): ExercicePourAffaire[] {
  return [...(ctx.exercices ?? [])].sort((a, b) => a.dateCloture.localeCompare(b.dateCloture));
}

export function resoudreAffaire(date: string, ctx: ContexteAffaire, missionCode?: string | null): string {
  const exercices = exercicesTries(ctx);
  const enCours = exercices.find(e =>
    e.statut === 'OUVERT' && e.dateOuverture <= date && date <= ajouterMois(e.dateCloture, DELAI_REVISION_MOIS));
  if (enCours) return codeAffaire(enCours.dateCloture);
  const contenant = exercices.find(e => e.dateOuverture <= date && date <= e.dateCloture);
  if (contenant) return codeAffaire(contenant.dateCloture);

  const mmjj = mmjjDuDossier(ctx);
  const cloture = clotureSuivante(date, mmjj);
  if (missionCode === 'REV') {
    const precedente = clotureDeLAnnee(Number(cloture.slice(0, 4)) - 1, mmjj);
    if (date <= ajouterMois(precedente, DELAI_REVISION_MOIS)) return codeAffaire(precedente);
  }
  return codeAffaire(cloture);
}

/** Période (ouverture → clôture) d'une affaire : celle de l'exercice PASSIDOC s'il existe,
 *  sinon reconstituée depuis la date de clôture annuelle du dossier. */
export function periodeAffaire(code: string, ctx: ContexteAffaire): { dateOuverture: string; dateCloture: string; source: 'EXERCICE' | 'CALCUL' } {
  const ex = exercicesTries(ctx).find(e => codeAffaire(e.dateCloture) === code);
  if (ex) return { dateOuverture: ex.dateOuverture, dateCloture: ex.dateCloture, source: 'EXERCICE' };
  const annee = Number(code.slice(1, 5));
  const mois = Number(code.slice(6, 8));
  const mmjj = mmjjDuDossier(ctx);
  // Si la clôture du dossier a changé de mois depuis, on retombe sur la fin du mois du code.
  const mmjjCode = Number(mmjj.slice(0, 2)) === mois ? mmjj : `${pad(mois)}-31`;
  const dateCloture = clotureDeLAnnee(annee, mmjjCode);
  const dateOuverture = ajouterJours(clotureDeLAnnee(annee - 1, mmjjCode), 1);
  return { dateOuverture, dateCloture, source: 'CALCUL' };
}

/** O = ouverte, C = clôturée. Sans exercice PASSIDOC, l'affaire est réputée ouverte jusqu'à
 *  la fin du délai de révision qui suit sa date de clôture. */
export function etatAffaire(code: string, ctx: ContexteAffaire, aujourdhui: string): EtatAffaire {
  const ex = exercicesTries(ctx).find(e => codeAffaire(e.dateCloture) === code);
  if (ex) return ex.statut === 'CLOTURE' ? 'C' : 'O';
  const { dateCloture } = periodeAffaire(code, ctx);
  return aujourdhui <= ajouterMois(dateCloture, DELAI_REVISION_MOIS) ? 'O' : 'C';
}

/** Affaires proposées pour un dossier : ses exercices PASSIDOC + l'affaire précédente, en
 *  cours et suivante à la date du jour + `autres` (codes déjà portés par des saisies). */
export function listerAffaires(ctx: ContexteAffaire, aujourdhui: string, autres: string[] = []): AffaireInfo[] {
  const courante = resoudreAffaire(aujourdhui, ctx);
  const anneeCourante = Number(courante.slice(1, 5));
  const moisCourant = courante.slice(6, 8);
  const codes = new Set<string>([
    ...exercicesTries(ctx).map(e => codeAffaire(e.dateCloture)),
    `C${anneeCourante - 1}-${moisCourant}`, courante, `C${anneeCourante + 1}-${moisCourant}`,
    ...autres.filter(estCodeAffaire),
  ]);
  return [...codes]
    .map(code => ({ code, ...periodeAffaire(code, ctx), etat: etatAffaire(code, ctx, aujourdhui) }))
    .sort((a, b) => b.code.localeCompare(a.code));
}
