-- ═══════════════════════════════════════════════════════════════════════════
-- Migration : évolutions v2 du cahier AFYM (PASSIDOC_Ameliorations_v2.docx)
-- Date       : 2026-10-23
-- Cible      : PostgreSQL 10+
--
--   #4 / #6  temps passés façon Tempolia, affaire, PV Col figé, budgets et boni/mali
--   #2 / #3  contact légal + contact opérationnel, approche client
--   #5       pôle de travail des saisies de temps
--   #7       intitulés des intervenants (distincts des libellés de pôle)
--   #1       relances des pièces manquantes (délai, relance automatique)
--
-- Le projet n'utilise pas les migrations TypeORM : en dev, DB_SYNC=true crée ces colonnes.
-- Sur un environnement en DB_SYNC=false, jouer ce script À LA MAIN AVANT de déployer :
--
--   psql "$DATABASE_URL" -f migrations/2026-10-23_evolutions-v2.sql
--
-- Idempotent (IF NOT EXISTS partout) : peut être rejoué sans erreur. Types et valeurs par
-- défaut identiques à ceux que génère TypeORM (vérifiés sur une base synchronisée).
-- Les données existantes sont rattrapées au démarrage de l'application (affaire et pôle de
-- travail des anciennes saisies) — rien à faire ici.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── #4 / #6 : temps passés et rentabilité ──────────────────────────────────
ALTER TABLE saisies_temps ADD COLUMN IF NOT EXISTS "affaire"      character varying(10);
ALTER TABLE saisies_temps ADD COLUMN IF NOT EXISTS "tauxHoraire"  double precision;
ALTER TABLE users         ADD COLUMN IF NOT EXISTS "prixVenteHoraire" numeric(10,2);

CREATE TABLE IF NOT EXISTS budgets_dossiers (
  "id"               SERIAL PRIMARY KEY,
  "tenantId"         integer,
  "clientId"         integer NOT NULL,
  "affaire"          character varying(10) NOT NULL,
  "heuresBudget"     double precision NOT NULL,
  "honoraires"       double precision,
  "prixVenteHoraire" double precision,
  "alerte80At"       timestamp without time zone,
  "alerte100At"      timestamp without time zone,
  "createdAt"        timestamp without time zone NOT NULL DEFAULT now(),
  "updatedAt"        timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_0e8f09ddae66ddbb7f974f06618" UNIQUE ("clientId", "affaire")
);

-- ── #5 : pôle de travail (EST | OUEST | HORS_BUREAU) ───────────────────────
ALTER TABLE saisies_temps ADD COLUMN IF NOT EXISTS "lieuTravail" character varying(12);

-- ── #2 / #3 : contacts et approche client ──────────────────────────────────
ALTER TABLE fiche_identite ADD COLUMN IF NOT EXISTS "contactLegalNom"      character varying;
ALTER TABLE fiche_identite ADD COLUMN IF NOT EXISTS "contactLegalFonction" character varying;
ALTER TABLE fiche_identite ADD COLUMN IF NOT EXISTS "contactOperationnel"  json;
ALTER TABLE fiche_identite ADD COLUMN IF NOT EXISTS "approcheClient"       character varying(20) NOT NULL DEFAULT 'PROFESSIONNEL';

-- ── #7 : intitulés des intervenants ────────────────────────────────────────
ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS "intervenantLabel1" character varying NOT NULL DEFAULT 'Collaborateur Réunion';
ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS "intervenantLabel2" character varying NOT NULL DEFAULT 'Collaborateur Madagascar';

-- ── #1 : relances des pièces manquantes (relance automatique désactivée par défaut) ──
ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS "relanceDelaiJours" integer NOT NULL DEFAULT 15;
ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS "relanceAutoActive" boolean NOT NULL DEFAULT false;

COMMIT;
