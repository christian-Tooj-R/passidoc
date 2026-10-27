import { User } from '../entities/user.entity';

/**
 * Pôle de travail d'une saisie de temps (cahier v2 #5) : où le travail a été réalisé —
 * au pôle Est, au pôle Ouest ou hors bureau (déplacement client, télétravail…).
 * Par défaut : le site de rattachement du collaborateur.
 */
export const LIEUX_TRAVAIL = ['EST', 'OUEST', 'HORS_BUREAU'] as const;
export type LieuTravail = typeof LIEUX_TRAVAIL[number];

export function estLieuTravail(v: unknown): v is LieuTravail {
  return typeof v === 'string' && (LIEUX_TRAVAIL as readonly string[]).includes(v);
}

export function lieuParDefaut(user?: Pick<User, 'site'> | null): LieuTravail {
  return user?.site === 'OUEST' ? 'OUEST' : 'EST';
}
