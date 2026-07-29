-- =============================================================================
-- SEED : Collaborateurs + Congés/Absences — Passidoc
-- Date  : 2026-07-29
-- Usage : docker exec passidoc-postgres psql -U passidoc_user -d passidoc_db -f /tmp/seed-collaborateurs.sql
-- Mot de passe commun : Passidoc2026!
-- =============================================================================

-- ─── 1. COLLABORATEURS ────────────────────────────────────────────────────────

INSERT INTO users (
  email, password, "firstName", "lastName", role, site,
  "isActive", "isTwoFactorEnabled", timezone, matricule,
  poste, "typeContrat", "dateEntree", statut, "tempsTravail",
  "heuresHebdo", devise
) VALUES
  -- Réunion — Collaborateur
  (
    'marie.dubois@afym.re',
    '$2b$10$rYNNXRkK1WZJnbQEau8mmueruWFOpTFc4EjaOaqURhGG2X9EPEFh.',
    'Marie', 'Dubois',
    'COLLABORATEUR', 'REUNION',
    true, false, 'Indian/Reunion', 'RE-001',
    'Collaboratrice comptable', 'CDI', '2022-03-15', 'NON_CADRE', 'PLEIN',
    39, 'EUR'
  ),
  -- Réunion — Chef de Mission
  (
    'pierre.martin@afym.re',
    '$2b$10$99DkunzsCGJy9MSp0C50a.QlnVUFeqsQziLnFPVO2kTahSF7SAKqa',
    'Pierre', 'Martin',
    'CHEF_MISSION', 'REUNION',
    true, false, 'Indian/Reunion', 'RE-002',
    'Chef de mission', 'CDI', '2019-06-01', 'CADRE', 'PLEIN',
    39, 'EUR'
  ),
  -- Madagascar — Collaborateur
  (
    'haja.rasolofo@afym.mg',
    '$2b$10$d0G/aEm3FhyE1pAue078c.J8fgkThvHPSDH7bsgmzJ/rSIpFYnaSy',
    'Haja', 'Rasolofo',
    'COLLABORATEUR', 'MADAGASCAR',
    true, false, 'Indian/Antananarivo', 'MG-001',
    'Collaborateur comptable', 'CDI', '2021-09-01', 'NON_CADRE', 'PLEIN',
    40, 'MGA'
  ),
  -- Madagascar — Gérant
  (
    'fara.andriamaro@afym.mg',
    '$2b$10$B/6QuuC6JW2tYaDkqh.llOU2NN2JmstzGOPBMfxZtU8JMRwivv1fK',
    'Fara', 'Andriamaro',
    'GERANT_MADAGASCAR', 'MADAGASCAR',
    true, false, 'Indian/Antananarivo', 'MG-002',
    'Gérante bureau Madagascar', 'CDI', '2018-01-10', 'CADRE', 'PLEIN',
    40, 'MGA'
  )
ON CONFLICT (email) DO NOTHING;

-- ─── 2. SOLDES CONGÉS 2026 ────────────────────────────────────────────────────
-- Récupère les IDs dynamiquement pour éviter les conflits

DO $$
DECLARE
  id_marie   INT;
  id_pierre  INT;
  id_haja    INT;
  id_fara    INT;
BEGIN
  SELECT id INTO id_marie  FROM users WHERE email = 'marie.dubois@afym.re';
  SELECT id INTO id_pierre FROM users WHERE email = 'pierre.martin@afym.re';
  SELECT id INTO id_haja   FROM users WHERE email = 'haja.rasolofo@afym.mg';
  SELECT id INTO id_fara   FROM users WHERE email = 'fara.andriamaro@afym.mg';

  -- Soldes CP 2026
  INSERT INTO soldes_conges ("userId", "typeConge", annee, "joursAcquis", "joursPris", "joursEnAttente")
  VALUES
    (id_marie,  'CONGES_PAYES', 2026, 25.0, 10.0, 5.0),
    (id_pierre, 'CONGES_PAYES', 2026, 25.0, 10.0, 0.0),
    (id_haja,   'CONGES_PAYES', 2026, 25.0, 0.0,  10.0),
    (id_fara,   'CONGES_PAYES', 2026, 25.0, 5.0,  0.0),
    -- RTT / Récupération
    (id_marie,  'RECUPERATION', 2026, 10.0, 5.0,  5.0),
    (id_pierre, 'RECUPERATION', 2026, 10.0, 3.0,  0.0),
    (id_fara,   'RECUPERATION', 2026, 8.0,  3.0,  0.0),
    -- Maladie (compteur informationnel)
    (id_haja,   'MALADIE',      2026, 0.0,  5.0,  0.0)
  ON CONFLICT ("userId", "typeConge", annee) DO NOTHING;

  -- ─── 3. CONGÉS/ABSENCES — visibles dans le Gantt ────────────────────────
  INSERT INTO conges_absences (
    "userId", "typeConge", "dateDebut", "dateFin", "nombreJours",
    statut, motif, "commentaireRH", "approbateurId", "dateApprobation"
  ) VALUES

    -- Marie Dubois — CP Juillet (approuvé)
    (id_marie, 'CONGES_PAYES', '2026-07-06', '2026-07-17', 10.0,
     'APPROUVEE', 'Congés d''été', 'Accordé — bon repos !', 1, '2026-06-15'),

    -- Marie Dubois — RTT Août (approuvé)
    (id_marie, 'RECUPERATION', '2026-08-03', '2026-08-07', 5.0,
     'APPROUVEE', 'Récupération heures supplémentaires', NULL, 1, '2026-07-20'),

    -- Marie Dubois — CP fin août (en attente)
    (id_marie, 'CONGES_PAYES', '2026-08-24', '2026-08-28', 5.0,
     'EN_ATTENTE', 'Fin de saison', NULL, NULL, NULL),

    -- Pierre Martin — CP chevauchant juillet/août (approuvé)
    (id_pierre, 'CONGES_PAYES', '2026-07-20', '2026-07-31', 10.0,
     'APPROUVEE', 'Vacances familiales', 'RAS', 1, '2026-06-20'),

    -- Pierre Martin — RTT déjà pris en juin (approuvé)
    (id_pierre, 'RECUPERATION', '2026-06-23', '2026-06-25', 3.0,
     'APPROUVEE', NULL, NULL, 1, '2026-06-01'),

    -- Haja Rasolofo — Maladie juillet (approuvé)
    (id_haja, 'MALADIE', '2026-07-07', '2026-07-11', 5.0,
     'APPROUVEE', 'Certificat médical fourni', 'Arrêt validé', 1, '2026-07-08'),

    -- Haja Rasolofo — CP Août (approuvé)
    (id_haja, 'CONGES_PAYES', '2026-08-10', '2026-08-21', 10.0,
     'APPROUVEE', 'Congés annuels', NULL, 1, '2026-07-15'),

    -- Fara Andriamaro — CP fin juin (approuvé)
    (id_fara, 'CONGES_PAYES', '2026-06-29', '2026-07-03', 5.0,
     'APPROUVEE', 'Fête nationale Madagascar', NULL, 1, '2026-06-10'),

    -- Fara Andriamaro — Récupération fin juillet (approuvé)
    (id_fara, 'RECUPERATION', '2026-07-27', '2026-07-29', 3.0,
     'APPROUVEE', NULL, NULL, 1, '2026-07-14'),

    -- Fara Andriamaro — Congé maternité futur (en attente)
    (id_fara, 'MATERNITE', '2026-09-01', '2026-11-30', 65.0,
     'EN_ATTENTE', 'Congé maternité prévu', NULL, NULL, NULL);

END $$;

-- ─── 4. VÉRIFICATION ──────────────────────────────────────────────────────────

SELECT
  u.email,
  u.role,
  u.site,
  COUNT(ca.id) AS nb_conges
FROM users u
LEFT JOIN conges_absences ca ON ca."userId" = u.id
WHERE u.email IN (
  'marie.dubois@afym.re',
  'pierre.martin@afym.re',
  'haja.rasolofo@afym.mg',
  'fara.andriamaro@afym.mg'
)
GROUP BY u.id, u.email, u.role, u.site
ORDER BY u.site, u.email;
