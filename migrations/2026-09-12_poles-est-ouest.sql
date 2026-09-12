-- ═══════════════════════════════════════════════════════════════════════════
-- Migration : passage aux deux pôles fixes EST / OUEST
-- Date       : 2026-09-12
-- Cible      : PostgreSQL 10+ (ALTER TYPE ... RENAME VALUE)
--
-- Le projet n'utilise pas les migrations TypeORM (DB_SYNC pilote le schéma en
-- dev). Ce script est donc à jouer À LA MAIN sur chaque environnement AVANT de
-- déployer le code renommé, sinon l'application écrira des valeurs d'enum
-- ('EST'/'OUEST') que le type PostgreSQL ne connaît pas encore.
--
--   psql "$DATABASE_URL" -f migrations/2026-09-12_poles-est-ouest.sql
--
-- Le script est idempotent : chaque bloc vérifie l'état avant d'agir, il peut
-- être rejoué sans erreur.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Valeurs d'enum : REUNION → EST, MADAGASCAR → OUEST ──────────────────
-- users.site, clients.site, site_locations.site
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

-- ── 2. Rôle GERANT_MADAGASCAR → GERANT_OUEST ───────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type y ON y.oid = e.enumtypid
             WHERE y.typname = 'users_role_enum' AND e.enumlabel = 'GERANT_MADAGASCAR') THEN
    ALTER TYPE users_role_enum RENAME VALUE 'GERANT_MADAGASCAR' TO 'GERANT_OUEST';
  END IF;
END $$;

-- ── 3. Colonne clients."collaborateurMgId" → "collaborateurOuestId" ────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'clients' AND column_name = 'collaborateurMgId') THEN
    ALTER TABLE clients RENAME COLUMN "collaborateurMgId" TO "collaborateurOuestId";
  END IF;
END $$;

-- ── 4. Libellés de pôles du tenant ─────────────────────────────────────────
-- Sans ça, les cabinets déjà configurés continuent d'afficher les anciens
-- libellés géographiques : ils sont stockés en base, pas déduits du code.
UPDATE tenant_config
SET "poleLabel1" = 'Pôle EST',
    "poleLabel2" = 'Pôle OUEST',
    "poleFlag1"  = '🔵',
    "poleFlag2"  = '🟠'
WHERE "poleLabel1" IN ('La Réunion', 'Réunion', 'Reunion')
   OR "poleLabel2" IN ('Madagascar', 'Mada')
   OR "poleFlag1"  = '🇷🇪'
   OR "poleFlag2"  = '🇲🇬';

-- ── 5. Fuseau horaire : plus de défaut géographique ────────────────────────
-- Le front retombe désormais sur le fuseau du navigateur quand la valeur est
-- nulle. Les lignes existantes ne sont pas touchées (choix explicite des
-- utilisateurs), seul le DEFAULT de la colonne est retiré.
ALTER TABLE users ALTER COLUMN timezone DROP DEFAULT;

COMMIT;

-- ── Vérification ───────────────────────────────────────────────────────────
-- SELECT unnest(enum_range(NULL::users_site_enum));      -- attendu : EST, OUEST
-- SELECT unnest(enum_range(NULL::users_role_enum));      -- attendu : … GERANT_OUEST
-- SELECT "poleLabel1", "poleLabel2" FROM tenant_config;  -- attendu : Pôle EST / Pôle OUEST
