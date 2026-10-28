-- ═══════════════════════════════════════════════════════════════════════════
-- Migration : module Missions restructuré + saisie automatique des tâches terminées
-- Date       : 2026-10-27
-- Cible      : PostgreSQL 10+
--
--   CDC_MODULE_MISSIONS_PASSIDOC.docx (19/10/2026) :
--     missions             → statut de suivi, cycle d'origine, relance, responsable, archivage
--     missions_historique  → historique des changements de statut (R4)
--     recommandations_cycles → recommandations par cycle de révision et par exercice
--   Module Travail :
--     saisies_temps.taskId → lien saisie ↔ tâche (pas de double saisie du temps chronométré)
--
-- À jouer À LA MAIN AVANT de déployer sur un environnement en DB_SYNC=false
-- (après 2026-10-23_evolutions-v2.sql) :
--
--   psql "$DATABASE_URL" -f migrations/2026-10-27_module-missions.sql
--
-- Idempotent : peut être rejoué sans erreur. Types, défauts et noms de contraintes identiques
-- à ceux que génère TypeORM (vérifiés sur une base synchronisée).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Missions : suivi (CDC §3.3, §3.4, §6) ──────────────────────────────────
ALTER TABLE missions ADD COLUMN IF NOT EXISTS "statut"          character varying(20);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS "cycle"           character varying(10);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS "exerciceId"      integer;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS "dateRelance"     date;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS "responsableId"   integer;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS "archivee"        boolean NOT NULL DEFAULT false;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS "statutModifieLe" timestamp without time zone;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS "notifJ3Pour"     date;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS "notifJ0Pour"     date;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS "creeParId"       integer;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS "repriseDeId"     integer;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS "updatedAt"       timestamp without time zone NOT NULL DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'FK_f491273ecfd8309d1032addc636' AND conrelid = 'missions'::regclass) THEN
    ALTER TABLE missions ADD CONSTRAINT "FK_f491273ecfd8309d1032addc636"
      FOREIGN KEY ("responsableId") REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Missions de l'ancien module : statut déduit du type (l'application le fait aussi au démarrage).
-- « Dernière modif. » reprend la date de création plutôt que celle de la migration.
UPDATE missions SET "statut" = CASE "type"
    WHEN 'REALISEE' THEN 'ACCEPTEE'
    WHEN 'REFUSEE'  THEN 'REFUSEE'
    ELSE 'PROPOSEE' END,
    "updatedAt" = "createdAt"
  WHERE "statut" IS NULL;

-- ── Historique des statuts (R4) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS missions_historique (
  "id"            SERIAL NOT NULL,
  "missionId"     integer NOT NULL,
  "ancienStatut"  character varying(20),
  "nouveauStatut" character varying(20) NOT NULL,
  "auteurId"      integer,
  "auteurNom"     character varying(120),
  "createdAt"     timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT "PK_89355147d3da60b058f1ce6007c" PRIMARY KEY ("id"),
  CONSTRAINT "FK_f163d8b9a3237aa5e022a47bee2" FOREIGN KEY ("missionId") REFERENCES missions(id) ON DELETE CASCADE
);

-- ── Recommandations par cycle (onglet « Par cycle ») ───────────────────────
CREATE TABLE IF NOT EXISTS recommandations_cycles (
  "id"         SERIAL NOT NULL,
  "clientId"   integer NOT NULL,
  "exerciceId" integer,
  "cycle"      character varying(10) NOT NULL,
  "texte"      text NOT NULL DEFAULT '',
  "auteurId"   integer,
  "updatedAt"  timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT "PK_cfe66e6899bd32624121140b30e" PRIMARY KEY ("id"),
  CONSTRAINT "FK_7c9f08eeddf74b4e40bb8af4589" FOREIGN KEY ("clientId") REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "IDX_269ff3556759755d01c3998202" ON recommandations_cycles ("clientId", "exerciceId", "cycle");

-- ── Module Travail : saisie liée à la tâche chronométrée ───────────────────
ALTER TABLE saisies_temps ADD COLUMN IF NOT EXISTS "taskId" integer;

COMMIT;
