-- Ajoute les 2 colonnes nullable nécessaires au calcul du "Salaire de base" (Nombre +
-- Montant) à partir de la présence réelle (feuille d'activité) plutôt que des jours ouvrés
-- théoriques seuls. Purement additif (colonnes nullable) — aucune donnée existante modifiée,
-- aucun risque sur les bulletins déjà générés (repli automatique sur le calcul théorique
-- tant que ces colonnes sont NULL). Idempotent (IF NOT EXISTS).

ALTER TABLE paie_rh_variables
  ADD COLUMN IF NOT EXISTS "joursJustifiesActivite" numeric(6,2);

ALTER TABLE paie_rh_bulletins
  ADD COLUMN IF NOT EXISTS "joursSalaireBase" numeric(6,2);
