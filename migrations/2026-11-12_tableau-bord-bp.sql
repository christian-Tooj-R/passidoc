-- ═══════════════════════════════════════════════════════════════════════════
-- Migration : Tableau de Bord BP (outils stratégiques Business Partner)
-- Date       : 2026-11-12
-- Cible      : PostgreSQL 10+
--
--   « Outils stratégiques PASSIDOC x Business Partner » (6 nov. 2026) :
--     outils_bp → SWOT, Porter, BMC, PESTEL, chaîne de valeur, diagnostic interne,
--                 matrice de risques, persona / ICP, matrice BCG, par dossier et par exercice
--
-- À jouer À LA MAIN AVANT de déployer sur un environnement en DB_SYNC=false
-- (après 2026-10-27_module-missions.sql) :
--
--   psql "$DATABASE_URL" -f migrations/2026-11-12_tableau-bord-bp.sql
--
-- Idempotent : peut être rejoué sans erreur. Types, défauts et noms de contraintes identiques
-- à ceux que génère TypeORM (vérifiés sur une base synchronisée).
-- Les anciens onglets (analyses_strategiques, canvas) ne sont pas modifiés : leur contenu est
-- repris à la lecture tant que l'outil correspondant n'a pas été enregistré.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS outils_bp (
  id              SERIAL NOT NULL,
  "clientId"      integer NOT NULL,
  "exerciceId"    integer NOT NULL,
  outil           character varying(20) NOT NULL,
  contenu         json NOT NULL,
  statut          character varying(12) NOT NULL DEFAULT 'BROUILLON',
  "valideParId"   integer,
  "valideLe"      timestamp without time zone,
  "modifieParId"  integer,
  "createdAt"     timestamp without time zone NOT NULL DEFAULT now(),
  "updatedAt"     timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT "PK_0f9b409e7e40c2aa8749b115c84" PRIMARY KEY (id),
  CONSTRAINT "UQ_6ecb27539e1dbe9c51f77843696" UNIQUE ("clientId", "exerciceId", outil),
  CONSTRAINT "FK_6264f02bc0cc024b7b25bac55a5" FOREIGN KEY ("clientId") REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT "FK_014739edc72fcbf665d1bfdd300" FOREIGN KEY ("exerciceId") REFERENCES exercices(id) ON DELETE CASCADE
);

COMMIT;
