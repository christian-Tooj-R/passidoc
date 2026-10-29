import { Raw } from 'typeorm';

/** Les emails sont comparés et enregistrés en minuscules : une saisie « Julie.R@… » (majuscule
 *  automatique des claviers mobiles) doit retrouver le même compte à la connexion, à la
 *  validation du code et au « mot de passe oublié ». */
export const normaliserEmail = (email: string): string => (email ?? '').trim().toLowerCase();

/** Condition `where` insensible à la casse — retrouve aussi les comptes enregistrés avant la
 *  normalisation, dont l'email peut contenir des majuscules. */
export const memeEmail = (email: string) =>
  Raw(col => `LOWER(${col}) = :email`, { email: normaliserEmail(email) });
