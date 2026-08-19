-- ============================================================
-- SEED DE DONNÉES DE TEST — Compte COLLABORATEUR (Marie Dubois)
-- Usage : docker exec passidoc-postgres psql -U passidoc_user -d passidoc_db -f /tmp/seed_collab_test.sql
-- Compte collab : marie.dubois@afym.re / Passidoc2026!
-- Tenant : afym  — URL : http://localhost:4200/?tenant=afym
-- ============================================================

-- IDs de référence
--   Tenant  : 1
--   Marie (collab RE) : 5
--   Pierre (chef mission RE) : 6
--   Haja (collab MG) : 7
--   Admin : 1

-- ─────────────────────────────────────────────────────────────
-- 1. CLIENTS (dossiers)
-- ─────────────────────────────────────────────────────────────

-- Nettoyer les données de test précédentes (ordre FK)
DELETE FROM documents   WHERE "clientId" > 2;
DELETE FROM task_comments WHERE "taskId" IN (SELECT id FROM tasks WHERE "clientId" > 2);
DELETE FROM tasks       WHERE "clientId" > 2;
DELETE FROM exercices   WHERE "clientId" > 2;
DELETE FROM fiche_identite WHERE "clientId" > 2;
DELETE FROM clients     WHERE id > 2;

-- Dossiers Réunion
INSERT INTO clients (id, "tenantId", nom, site, "secteurActivite", "isActive", "responsableId", "directeurId", "collaborateurMgId")
VALUES
  (10, 1, 'Cabinet Réunion Expertise', 'REUNION', 'Comptabilité',      true, 5, 6, NULL),
  (11, 1, 'SARL Bourbon Digital',      'REUNION', 'Informatique',       true, 5, 6, NULL),
  (12, 1, 'Association Lire & Vivre',  'REUNION', 'Associatif',         true, 6, 6, NULL),
  (13, 1, 'EURL Soleil Tropic',        'REUNION', 'BTP',                true, 6, 6, NULL)
ON CONFLICT (id) DO UPDATE SET nom = EXCLUDED.nom, "responsableId" = EXCLUDED."responsableId";

-- Dossiers Madagascar (Marie est collaborateurMg)
INSERT INTO clients (id, "tenantId", nom, site, "secteurActivite", "isActive", "responsableId", "directeurId", "collaborateurMgId")
VALUES
  (14, 1, 'SGA Audit Madagascar',       'MADAGASCAR', 'Audit',           true, 7, 6, 5),
  (15, 1, 'Société Mada Commerce',      'MADAGASCAR', 'Commerce',        true, 7, 7, NULL)
ON CONFLICT (id) DO UPDATE SET nom = EXCLUDED.nom;

-- Mettre à jour la séquence
SELECT setval(pg_get_serial_sequence('clients', 'id'), 20, true);

-- ─────────────────────────────────────────────────────────────
-- 2. TÂCHES — variées (assignées à Marie, à Pierre, sans assigné)
-- ─────────────────────────────────────────────────────────────

DELETE FROM task_comments WHERE "taskId" > 6;
DELETE FROM tasks WHERE id > 6;

INSERT INTO tasks (id, "tenantId", titre, description, statut, priorite, type, "dateEcheance", "assigneeId", "clientId", "creePar", "anyoneCanTake")
VALUES
  -- Tâches assignées à Marie (id=5)
  (10, 1, 'Révision comptes clients T3',     'Vérifier les grands livres clients', 'EN_COURS',   'HAUTE',   'AUTRE', '2026-08-25', 5, 10, 6, false),
  (11, 1, 'Déclaration TVA août',             'Déclaration mensuelle TVA',          'EN_ATTENTE', 'NORMALE', 'TVA',   '2026-08-31', 5, 11, 6, false),
  (12, 1, 'Bilan intermédiaire S1',           'Préparation bilan semestriel',       'EN_COURS',   'HAUTE',   'AUTRE', '2026-09-05', 5, 10, 6, false),
  (13, 1, 'Relance client impayé',            'Contacter le client pour règlement', 'EN_ATTENTE', 'BASSE',   'AUTRE', '2026-08-20', 5, 12, 5, false),
  (14, 1, 'Saisie journaux juillet',          'Saisir les écritures du mois',       'TERMINEE',   'NORMALE', 'ACHATS','2026-08-10', 5, 10, 6, false),

  -- Tâches assignées à Pierre (id=6)
  (15, 1, 'Supervision dossiers Réunion',     'Revue mensuelle des dossiers',       'EN_COURS',   'HAUTE',   'AUTRE', '2026-08-22', 6, NULL, 1, false),
  (16, 1, 'Traitement paie équipe RE',        'Calcul et vérification paie',        'EN_ATTENTE', 'HAUTE',   'PAIE',  '2026-08-28', 6, 10,  6, false),

  -- Tâches sans assigné (anyoneCanTake)
  (17, 1, 'Archivage documents août',         'Classer les docs reçus en août',     'EN_ATTENTE', 'BASSE',   'AUTRE', '2026-08-30', NULL, NULL, 6, true),
  (18, 1, 'Mise à jour fiches clients',       'Actualiser les informations clients','EN_ATTENTE', 'NORMALE', 'AUTRE', '2026-09-01', NULL, NULL, 1, true),

  -- Tâche assignée à Haja (MG, id=7)
  (19, 1, 'Rapport ventes Madagascar',        'Synthèse mensuelle ventes Mada',     'EN_COURS',   'HAUTE',   'VENTES','2026-08-31', 7, 14, 7, false)
ON CONFLICT (id) DO UPDATE SET titre = EXCLUDED.titre, "assigneeId" = EXCLUDED."assigneeId";

SELECT setval(pg_get_serial_sequence('tasks', 'id'), 25, true);

-- ─────────────────────────────────────────────────────────────
-- 3. NOTES — pour Marie et pour Pierre
-- ─────────────────────────────────────────────────────────────

DELETE FROM notes WHERE "userId" IN (5, 6);

INSERT INTO notes ("userId", title, content, color, pinned)
VALUES
  (5, 'Points à vérifier aujourd''hui',  'Comptes clients Cabinet RE\nTVA août SARL Bourbon\nRelancer M. Dumont', '#FFD700', true),
  (5, 'Contact client Lire & Vivre',     'Appeler Mme Rakoto le 20/08 à 14h pour signature bilan', '#90EE90', false),
  (5, 'Formation logiciel compta',       'Formation prévue le 25/08 - penser à préparer les accès', '#87CEEB', false),
  (5, 'Rappel congés',                   'Congés approuvés du 1er au 15 septembre', '#FFA07A', true),
  (6, 'Revue équipe septembre',          'Planifier les entretiens individuels\nMarie : bilan T3\nHaja : rapport MG', '#DDA0DD', false);

-- ─────────────────────────────────────────────────────────────
-- 4. CONGÉS — demandes pour Marie
-- ─────────────────────────────────────────────────────────────

DELETE FROM conges_absences WHERE "userId" = 5;

INSERT INTO conges_absences ("userId", "tenantId", "typeConge", "dateDebut", "dateFin", "nombreJours", statut, motif, "approbateurId", "dateApprobation")
VALUES
  (5, 1, 'CONGES_PAYES',    '2026-09-01', '2026-09-15', 11, 'APPROUVEE',   'Congés annuels été',    6, '2026-07-20'),
  (5, 1, 'RECUPERATION',    '2026-08-22', '2026-08-22',  1, 'EN_ATTENTE', 'Récupération vendredi', NULL, NULL),
  (5, 1, 'CONGES_PAYES',    '2026-10-20', '2026-10-24',  5, 'EN_ATTENTE', 'Déplacement famille',   NULL, NULL);

-- Soldes congés pour Marie (un solde par type)
DELETE FROM soldes_conges WHERE "userId" = 5;
INSERT INTO soldes_conges ("userId", "tenantId", "typeConge", annee, "joursAcquis", "joursPris", "joursEnAttente")
VALUES
  (5, 1, 'CONGES_PAYES', 2026, 25, 0,  11),
  (5, 1, 'RECUPERATION', 2026, 10, 0,   1);

-- ─────────────────────────────────────────────────────────────
-- 5. POINTAGE — Marie a déjà pointé aujourd'hui
-- ─────────────────────────────────────────────────────────────

DELETE FROM pointages WHERE "userId" = 5 AND date = CURRENT_DATE;

INSERT INTO pointages ("userId", "tenantId", date, "heureArrivee", "heureDebutPause", "heureFinPause")
VALUES (5, 1, CURRENT_DATE,
  CURRENT_DATE + INTERVAL '8 hours 30 minutes',
  CURRENT_DATE + INTERVAL '12 hours',
  CURRENT_DATE + INTERVAL '13 hours');

-- ─────────────────────────────────────────────────────────────
-- 6. DOCUMENTS — quelques docs liés à Marie
-- ─────────────────────────────────────────────────────────────

DELETE FROM documents WHERE "uploadeParId" = 5;

INSERT INTO documents (nom, "storagePath", "mimeType", taille, "clientId", "uploadeParId", "typeDoc", "periodeAnnee", "periodeMois")
VALUES
  ('Bilan 2025 Cabinet RE',   'uploads/bilan_2025.pdf',   'application/pdf', 245000, 10, 5, 'BILAN',   2025, 12),
  ('TVA Août 2026 Bourbon',   'uploads/tva_aout_2026.pdf','application/pdf', 125000, 11, 5, 'TVA',     2026,  8),
  ('Grand Livre T2 Lire&Vivre','uploads/gl_t2.pdf',       'application/pdf',  98000, 12, 5, 'GRAND_LIVRE', 2026, 6);

-- ─────────────────────────────────────────────────────────────
-- 7. PERMISSIONS RH — s'assurer que COLLABORATEUR a accès RH
-- ─────────────────────────────────────────────────────────────

INSERT INTO role_permissions (role, "menuItems")
VALUES ('COLLABORATEUR', '["dashboard","clients","tasks","documents","notes","equipes","rh"]')
ON CONFLICT (role) DO UPDATE
  SET "menuItems" = '["dashboard","clients","tasks","documents","notes","equipes","rh"]';

-- ─────────────────────────────────────────────────────────────
-- RÉSUMÉ
-- ─────────────────────────────────────────────────────────────
SELECT 'Clients'         AS table_, count(*) FROM clients WHERE "tenantId" = 1
UNION ALL
SELECT 'Tasks',           count(*) FROM tasks   WHERE "tenantId" = 1
UNION ALL
SELECT 'Notes (Marie)',   count(*) FROM notes   WHERE "userId"   = 5
UNION ALL
SELECT 'Congés (Marie)',  count(*) FROM conges_absences WHERE "userId" = 5
UNION ALL
SELECT 'Pointages today', count(*) FROM pointages WHERE "userId" = 5 AND date = CURRENT_DATE;
