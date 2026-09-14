import { Client } from 'pg';

/**
 * Migration ponctuelle EST/OUEST — copie exécutable de
 * `migrations/2026-09-12_poles-est-ouest.sql` (source de vérité, à garder identique).
 *
 * Pourquoi ici et pas lancée à la main via psql : la base de production (Render) n'est
 * joignable en 5432 ni depuis l'environnement d'exécution de l'agent, ni depuis le réseau
 * du développeur (port bloqué en sortie des deux côtés) — alors que le backend déployé sur
 * Render, lui, s'y connecte sans problème depuis l'infra Render. On exécute donc la
 * migration au démarrage de l'appli, avec les mêmes identifiants qu'utilise déjà TypeORM.
 *
 * Appelée AVANT `NestFactory.create()` dans main.ts, donc avant toute requête applicative.
 * Idempotente (chaque bloc vérifie l'état avant d'agir) — sans danger à rejouer.
 *
 * ⚠️ TEMPORAIRE : à supprimer (fichier + appel dans main.ts) une fois la migration confirmée
 * réussie en production — ne pas laisser tourner indéfiniment à chaque démarrage.
 */
export async function runPoleMigrationIfNeeded(): Promise<void> {
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
    console.log('[bootstrap-pole-migration] OK — enums EST/OUEST vérifiés/migrés.');
  } catch (e: any) {
    // Ne bloque jamais le démarrage : si la migration échoue, l'app démarre quand même
    // (comportement identique à avant l'ajout de ce bootstrap) et l'erreur est journalisée
    // pour investigation.
    // eslint-disable-next-line no-console
    console.error('[bootstrap-pole-migration] ÉCHEC (démarrage poursuivi) :', e?.message ?? e);
  } finally {
    await client.end().catch(() => {});
  }
}

const MIGRATION_SQL = `
BEGIN;

-- 1. Valeurs d'enum : REUNION → EST, MADAGASCAR → OUEST (users/clients/site_locations)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users_site_enum', 'clients_site_enum', 'site_locations_site_enum']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = t) THEN
      IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type y ON y.oid = e.enumtypid
                 WHERE y.typname = t AND e.enumlabel = 'REUNION') THEN
        EXECUTE format('ALTER TYPE %I RENAME VALUE %L TO %L', t, 'REUNION', 'EST');
      END IF;
      IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type y ON y.oid = e.enumtypid
                 WHERE y.typname = t AND e.enumlabel = 'MADAGASCAR') THEN
        EXECUTE format('ALTER TYPE %I RENAME VALUE %L TO %L', t, 'MADAGASCAR', 'OUEST');
      END IF;
    END IF;
  END LOOP;
END $$;

-- 2. Rôle GERANT_MADAGASCAR → GERANT_OUEST
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type y ON y.oid = e.enumtypid
             WHERE y.typname = 'users_role_enum' AND e.enumlabel = 'GERANT_MADAGASCAR') THEN
    ALTER TYPE users_role_enum RENAME VALUE 'GERANT_MADAGASCAR' TO 'GERANT_OUEST';
  END IF;
END $$;

-- 3. Colonne clients."collaborateurMgId" → "collaborateurOuestId"
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'clients' AND column_name = 'collaborateurMgId') THEN
    ALTER TABLE clients RENAME COLUMN "collaborateurMgId" TO "collaborateurOuestId";
  END IF;
END $$;

-- 4. Libellés de pôles du tenant
UPDATE tenant_config
SET "poleLabel1" = 'Pôle EST',
    "poleLabel2" = 'Pôle OUEST',
    "poleFlag1"  = '🔵',
    "poleFlag2"  = '🟠'
WHERE "poleLabel1" IN ('La Réunion', 'Réunion', 'Reunion')
   OR "poleLabel2" IN ('Madagascar', 'Mada')
   OR "poleFlag1"  = '🇷🇪'
   OR "poleFlag2"  = '🇲🇬';

-- 5. Fuseau horaire : plus de défaut géographique
ALTER TABLE users ALTER COLUMN timezone DROP DEFAULT;

COMMIT;
`;
