import { Client } from 'pg';

/**
 * Migration ponctuelle "Salaire de base sur présence réelle" — copie exécutable de
 * `migrations/2026-09-14_salaire-base-presence-reelle.sql` (source de vérité, à garder
 * identique) : 2 colonnes nullable, purement additives.
 *
 * Pourquoi ici et pas lancée à la main via psql : la base de production (Render) n'est
 * joignable en 5432 ni depuis l'environnement d'exécution de l'agent, ni depuis le réseau
 * du développeur (port bloqué en sortie des deux côtés) — alors que le backend déployé sur
 * Render, lui, s'y connecte sans problème depuis l'infra Render. On exécute donc la
 * migration au démarrage de l'appli, avec les mêmes identifiants qu'utilise déjà TypeORM.
 * Voir le précédent similaire : bootstrap-pole-migration.ts (retiré une fois confirmé).
 *
 * Appelée AVANT `NestFactory.create()` dans main.ts, donc avant toute requête applicative.
 * Idempotente (`ADD COLUMN IF NOT EXISTS`) — sans danger à rejouer.
 *
 * ⚠️ TEMPORAIRE : à supprimer (fichier + appel dans main.ts) une fois la migration confirmée
 * réussie en production — ne pas laisser tourner indéfiniment à chaque démarrage.
 */
export async function runSalaireBaseMigrationIfNeeded(): Promise<void> {
  if ((process.env.DB_TYPE || '').toLowerCase() !== 'postgres') return;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  const client = new Client({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    await client.query(MIGRATION_SQL);
    // eslint-disable-next-line no-console
    console.log('[bootstrap-salaire-base-migration] OK — colonnes joursJustifiesActivite/joursSalaireBase vérifiées/créées.');
  } catch (e: any) {
    // Ne bloque jamais le démarrage : si la migration échoue, l'app démarre quand même
    // (comportement identique à avant l'ajout de ce bootstrap) et l'erreur est journalisée
    // pour investigation.
    // eslint-disable-next-line no-console
    console.error('[bootstrap-salaire-base-migration] ÉCHEC (démarrage poursuivi) :', e?.message ?? e);
  } finally {
    await client.end().catch(() => {});
  }
}

const MIGRATION_SQL = `
ALTER TABLE paie_rh_variables
  ADD COLUMN IF NOT EXISTS "joursJustifiesActivite" numeric(6,2);

ALTER TABLE paie_rh_bulletins
  ADD COLUMN IF NOT EXISTS "joursSalaireBase" numeric(6,2);
`;
