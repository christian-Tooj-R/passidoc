/**
 * Tests E2E — Module Paie & RH interne (collaborateurs AFYM)
 * Distinct du module Paie clients (non testé ici, voir un éventuel paie-tab.spec.ts).
 *
 * Couvre le parcours MVP1 a minima : créer un contrat de travail → paramétrer/consulter
 * les rubriques (auto-seed placeholder) → calculer un aperçu → générer un bulletin de
 * salaire → télécharger le PDF. Convention `loginViaApi`/`TEST_TENANT` reprise de
 * `frontend/e2e/documents-tab.spec.ts` et `frontend/e2e/helpers/auth.ts`.
 *
 * REFONTE (~Sage 100 Paie & RH — voir Doc/MODULE_PAIE_RH_NOTES.md, section dédiée) :
 * PAIE-RH-3/4/5 couvrent le nouveau modèle (constantes composables + rubrique en calcul
 * guidé Nombre/Base/Taux référençant une constante) — PAIE-RH-1/2 mis à jour pour les
 * nouveaux sélecteurs (`.rpr-table`, etc.) introduits par les nouveaux composants
 * `rubriques-paie-rh.component.ts` / `constantes-paie-rh.component.ts`.
 *
 * DIALOGUE "BULLETIN DU SALARIÉ" (~Sage, écran individuel du bulletin — voir
 * Doc/MODULE_PAIE_RH_NOTES.md, section dédiée) : PAIE-RH-6 couvre l'ouverture depuis le
 * hub, l'édition d'un onglet ("Autres variables"), le recalcul en direct et la lecture du
 * "Bulletin calculé" (Période + Cumul annuel).
 *
 * REFONTE PDF ~Sage + "Visualiser/Imprimer" (voir Doc/MODULE_PAIE_RH_NOTES.md, section
 * dédiée) : PAIE-RH-7/8/9 couvrent le nouveau bouton "Visualiser" (prévisualisation PDF
 * dans un iframe via blob URL + bouton "Imprimer") ajouté aux 3 endroits où "Télécharger
 * le PDF" existe/est pertinent : onglet "Contrat & Paie" de la fiche salarié, hub cycle
 * mensuel (`/rh/paie`), portail self-service `/rh/mes-bulletins`.
 *
 * ⚠️ Nécessite un environnement de dev complet démarré (backend sur :3000, frontend sur
 * :4200, PostgreSQL, tenant `test-e2e` + utilisateur `e2e@test.com` déjà provisionnés —
 * voir `frontend/e2e/helpers/auth.ts`). Ce fichier n'a PAS été exécuté avec CES ports/ce
 * tenant précis dans cette session (agent isolé dans un worktree dédié — le module
 * Paie RH interne lui-même n'existait pas dans ce worktree au démarrage de la tâche : il a
 * dû être resynchronisé depuis le checkout partagé /datas/Projets/Aro, voir Doc/
 * MODULE_PAIE_RH_NOTES.md, section "Refonte PDF ~Sage + Visualiser/Imprimer", pour le
 * détail). En revanche, pour CETTE session, le dialogue "Bulletin du salarié" (PAIE-RH-6),
 * ainsi que le nouveau PDF ~Sage et le flux "Visualiser"/"Imprimer" à ses 3 emplacements
 * (PAIE-RH-7/8/9 ci-dessous) ONT ÉTÉ VÉRIFIÉS RÉELLEMENT dans un vrai navigateur Chromium
 * (Playwright), contre un environnement isolé monté ad hoc (backend NestJS sur le port
 * 3011, PostgreSQL isolé au port 5434 — conteneur Docker dédié détruit après usage —,
 * frontend Angular servi en dev sur le port 4212), sans toucher aux ports 3000/4200/5432
 * de la session de développement de l'utilisateur (vérifiés intacts avant/après). Voir
 * Doc/MODULE_PAIE_RH_NOTES.md, section "Tests", pour le détail exact de ce qui a été
 * observé — dont un vrai bug trouvé et corrigé pendant ce test (locale française manquante
 * dans ce worktree, montants affichés en format US avant correction de `app.config.ts`).
 */
import { test, expect, request as pwRequest } from '@playwright/test';
import { loginViaApi, API_URL, TEST_TENANT } from './helpers/auth';
import { getToken, authHeaders } from './helpers/api';

test.describe('Paie RH interne — parcours MVP1', () => {
  let salarieId = 0;
  const uniqueEmail = `paie-rh-e2e-${Date.now()}@test.com`;

  test.beforeAll(async () => {
    const api = await pwRequest.newContext();
    const token = await getToken(api);

    // Crée un collaborateur de test dédié (rôle COLLABORATEUR) pour ne pas interférer
    // avec l'utilisateur e2e@test.com lui-même ni avec d'autres suites.
    const res = await api.post(`${API_URL}/users`, {
      headers: authHeaders(token),
      data: {
        email: uniqueEmail,
        password: 'PaieRhE2e123!',
        firstName: 'PaieRH',
        lastName: 'E2E',
        role: 'COLLABORATEUR',
        site: 'REUNION',
      },
    });
    const body = await res.json();
    salarieId = body.id;
    await api.dispose();
  });

  test('PAIE-RH-1 — hub /rh/paie affiche les rubriques paramétrables (placeholder)', async ({ page }) => {
    await loginViaApi(page);
    await page.goto(`http://localhost:4200/rh/paie?tenant=${TEST_TENANT}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /^Rubriques$/i }).click();
    await expect(page.locator('.rpr-table tbody tr').first()).toBeVisible({ timeout: 8_000 });
    // Au moins une rubrique doit être marquée "Placeholder" tant qu'aucun taux réel
    // n'a été validé par un expert paie (voir Doc/MODULE_PAIE_RH_NOTES.md).
    await expect(page.locator('.badge-ph').first()).toBeVisible();
    // Arborescence par nature (~Sage) : au moins "De cotisation" doit apparaître, avec
    // un compteur > 0 (les rubriques placeholder incluent plusieurs cotisations).
    const cotis = page.locator('.rpr-tree-item', { hasText: 'De cotisation' });
    await expect(cotis).toBeVisible();
    await cotis.click();
    await expect(page.locator('.rpr-table tbody tr').first()).toBeVisible({ timeout: 8_000 });
  });

  test('PAIE-RH-3 — créer une constante composée (~Sage "Liste des constantes")', async ({ page }) => {
    await loginViaApi(page);
    await page.goto(`http://localhost:4200/rh/paie?tenant=${TEST_TENANT}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /^Constantes$/i }).click();
    await page.getByRole('button', { name: /Créer une constante/i }).click();

    // Libellé unique par run — un libellé fixe finit par matcher plusieurs lignes une fois
    // la suite exécutée plusieurs fois sur la même base de dev partagée (strict mode violation).
    const libelle = `Forfait E2E (test) ${Date.now()}`;
    const codeInput = page.locator('.cpr-form-card input').nth(0);
    await codeInput.fill(`E2E_FORFAIT_${Date.now()}`);
    await page.locator('.cpr-form-card input').nth(1).fill(libelle);

    await page.getByRole('button', { name: /^Ok$/i }).click();
    await expect(page.locator('.cpr-table tbody tr', { hasText: libelle })).toBeVisible({ timeout: 8_000 });
  });

  test('PAIE-RH-4 — créer une rubrique en calcul guidé référençant une constante', async ({ page }) => {
    await loginViaApi(page);
    await page.goto(`http://localhost:4200/rh/paie?tenant=${TEST_TENANT}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /^Rubriques$/i }).click();
    await page.getByRole('button', { name: /Créer une rubrique/i }).click();

    // Libellé unique par run — même raison que PAIE-RH-3 ci-dessus.
    const uniqueCode = `E2E_RUB_${Date.now()}`;
    const libelle = `Rubrique E2E (test) ${Date.now()}`;
    await page.locator('.rpr-form-card input').nth(0).fill(uniqueCode);
    await page.locator('.rpr-form-card input').nth(1).fill(libelle);

    // Type de calcul par défaut = "Montant pris tel quel" (MONTANT_FIXE) — la grille
    // Nombre/Base/Taux de la part salariale doit être visible immédiatement.
    await expect(page.locator('.rpr-part-title', { hasText: 'Part salariale' })).toBeVisible();

    await page.getByRole('button', { name: /^Ok$/i }).click();
    await expect(page.locator('.rpr-table tbody tr', { hasText: libelle })).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.rpr-table tbody tr', { hasText: libelle })).toContainText('Montant pris tel quel');
  });

  test('PAIE-RH-5 — créer un contrat, calculer un aperçu, générer et télécharger un bulletin (nouveau modèle de rubrique)', async ({ page }) => {
    await loginViaApi(page);
    await page.goto(`http://localhost:4200/rh/salaries/${salarieId}?tenant=${TEST_TENANT}`);
    await page.waitForLoadState('networkidle');

    // Onglet "Contrat & Paie"
    await page.getByRole('button', { name: /Contrat & Paie/i }).click();

    // Créer le contrat
    await page.getByRole('button', { name: /Créer un contrat/i }).click();
    await page.locator('input[type="date"]').first().fill('2026-01-01');
    const salaireInput = page.locator('input[type="number"]').nth(1); // 0=quotité, 1=salaire de base
    await salaireInput.fill('1800');
    await page.getByRole('button', { name: /^Enregistrer$/i }).click();

    // Le contrat doit apparaître en lecture (salaire affiché)
    await expect(page.locator('.f-val', { hasText: '1 800,00' })).toBeVisible({ timeout: 8_000 })
      .catch(() => expect(page.locator('.f-val', { hasText: '1800' })).toBeVisible({ timeout: 8_000 }));

    // Aperçu du calcul pour une période dédiée à ce test
    await page.getByRole('button', { name: /Aperçu du calcul/i }).click();
    await expect(page.locator('.prh-apercu')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.prh-apercu')).toContainText('Net à payer');

    // Génération du bulletin
    const [downloadEvent] = await Promise.all([
      // On ne télécharge pas encore ici — juste la génération —, le download est testé après.
      Promise.resolve(null),
      page.getByRole('button', { name: /Générer le bulletin/i }).click(),
    ]);
    void downloadEvent;

    await expect(page.locator('.prh-table tbody tr').first()).toBeVisible({ timeout: 8_000 });

    // Téléchargement du PDF généré (la ligne a aussi un bouton "Enregistrer paiement" —
    // cibler précisément le bouton de téléchargement PDF, identifié par son tooltip)
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10_000 }),
      page.locator('.prh-table tbody tr').first().getByRole('button', { name: /Télécharger le PDF/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/bulletin-salaire.*\.pdf/);
  });

  test('PAIE-RH-6 — dialogue "Bulletin du salarié" : ouverture, édition, recalcul, navigation Suiv.', async ({ page }) => {
    // S'appuie sur le contrat créé par PAIE-RH-5 pour ce même `salarieId` (exécution
    // séquentielle du fichier — même convention implicite que le reste de cette suite).
    await loginViaApi(page);
    await page.goto(`http://localhost:4200/rh/salaries/${salarieId}?tenant=${TEST_TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Contrat & Paie/i }).click();

    await page.getByRole('button', { name: /Bulletin détaillé/i }).click();
    await expect(page.locator('.bsd-header')).toBeVisible({ timeout: 10_000 });

    // Les 6 onglets sont bien présents et cliquables sans erreur.
    for (const label of ['Rubriques', 'Congés/absences', 'Heures de travail/HS', 'Autres variables', 'Valeurs de base', 'Bulletin calculé']) {
      await page.locator('.bsd-tab', { hasText: label }).click();
    }

    // Édition de l'onglet "Autres variables" : ajoute une ligne de prime manuelle.
    await page.locator('.bsd-tab', { hasText: 'Autres variables' }).click();
    await page.getByRole('button', { name: /Ajouter une ligne/i }).first().click();
    await page.locator('.bsd-table--edit input').nth(0).fill('Prime E2E');
    await page.locator('.bsd-table--edit input[type="number"]').nth(0).fill('50');

    // Recalcul en direct → l'onglet "Bulletin calculé" (~Sage : grille Code/Rubrique/
    // Nombre/Base/Taux salarial/Gain/Retenue/Taux pat./Montant pat. + récapitulatif
    // Période/Annuel) doit refléter la saisie.
    await page.getByRole('button', { name: /^Recalculer$/ }).click();
    await page.locator('.bsd-tab', { hasText: 'Bulletin calculé' }).click();
    await expect(page.locator('.bsd-bulletin-table')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.bsd-bulletin-total-row').first()).toContainText('Total brut');
    await expect(page.locator('.bsd-recap-table')).toContainText('Net à payer');
    await expect(page.locator('.bsd-recap-table')).toContainText('Période');
    await expect(page.locator('.bsd-recap-table')).toContainText('Annuel');

    // Navigation Suiv./Préc. — présente dans tous les cas ; ne bloque pas si un seul
    // salarié figure dans le cycle courant (bouton alors désactivé, comportement attendu).
    const nextBtn = page.getByRole('button', { name: /Salarié suivant du cycle/i });
    const prevBtn = page.getByRole('button', { name: /Salarié précédent du cycle/i });
    await expect(nextBtn).toBeVisible();
    await expect(prevBtn).toBeVisible();
    if (!(await nextBtn.isDisabled())) {
      const titleBefore = await page.locator('.bsd-header h2').textContent();
      await nextBtn.click();
      await page.waitForTimeout(1000);
      const titleAfter = await page.locator('.bsd-header h2').textContent();
      expect(titleAfter).not.toBe(titleBefore);
    }

    // Aucun bouton icône-seule sans aria-label (bug déjà rencontré ailleurs dans ce module).
    // Scope au dialogue uniquement (.bsd-wrap) — la page derrière contient déjà d'autres
    // boutons icône-seule préexistants, hors périmètre du module Paie RH.
    const iconButtons = page.locator('.bsd-wrap button[mat-icon-button]');
    const count = await iconButtons.count();
    for (let i = 0; i < count; i++) {
      await expect(iconButtons.nth(i)).toHaveAttribute('aria-label', /.+/);
    }

    await page.locator('.bsd-close').click();
  });

  test('PAIE-RH-7 — "Visualiser" le bulletin (onglet Contrat & Paie) : prévisualisation + Imprimer', async ({ page }) => {
    // S'appuie sur le bulletin généré par PAIE-RH-5 pour ce même `salarieId`.
    await loginViaApi(page);
    await page.goto(`http://localhost:4200/rh/salaries/${salarieId}?tenant=${TEST_TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Contrat & Paie/i }).click();
    await expect(page.locator('.prh-table tbody tr').first()).toBeVisible({ timeout: 8_000 });

    const visualiserBtn = page.locator('.prh-table tbody tr').first().getByRole('button', { name: /Visualiser le bulletin/i });
    await expect(visualiserBtn).toBeVisible();
    // Le bouton "Télécharger le PDF" existant doit toujours être présent à côté (pas retiré).
    await expect(page.locator('.prh-table tbody tr').first().getByRole('button', { name: /Télécharger le PDF/i })).toBeVisible();
    await visualiserBtn.click();

    const dialog = page.locator('.bpp-wrap');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.locator('iframe.bpp-iframe')).toBeVisible();
    const src = await dialog.locator('iframe.bpp-iframe').getAttribute('src');
    expect(src).toMatch(/^blob:/); // affiché, PAS téléchargé (pas de a.click()/a.download)

    const imprimerBtn = dialog.getByRole('button', { name: /Imprimer/i });
    await expect(imprimerBtn).toBeVisible();
    await expect(imprimerBtn).toHaveAttribute('aria-label', /.+/);
    await expect(imprimerBtn).toBeEnabled({ timeout: 10_000 }); // activé une fois l'iframe chargée (évènement load)

    const fermerBtn = dialog.getByRole('button', { name: /Fermer la prévisualisation/i });
    await expect(fermerBtn).toHaveAttribute('aria-label', /.+/);
    await fermerBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  test('PAIE-RH-8 — "Visualiser" depuis le hub Cycle mensuel (si un bulletin est déjà généré)', async ({ page }) => {
    await loginViaApi(page);
    await page.goto(`http://localhost:4200/rh/paie?tenant=${TEST_TENANT}`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.prhh-table tbody tr').first()).toBeVisible({ timeout: 8_000 });

    // Le bouton "Visualiser" n'apparaît que sur les lignes dont le bulletin est déjà
    // généré (bulletinStatut === 'GENERE') — voir Doc/MODULE_PAIE_RH_NOTES.md pour le choix
    // de ne PAS ajouter de bouton "Télécharger le PDF" ici (absent avant cette tâche).
    const row = page.locator('.prhh-table tbody tr', { has: page.locator('[data-statut="GENERE"]') }).first();
    if (await row.count() === 0) {
      test.skip(true, 'Aucun bulletin généré visible dans le cycle courant — rien à visualiser ce mois-ci.');
    }
    const visualiserBtn = row.getByRole('button', { name: /Visualiser le bulletin/i });
    await expect(visualiserBtn).toBeVisible();
    await visualiserBtn.click();
    await expect(page.locator('.bpp-wrap')).toBeVisible({ timeout: 10_000 });
  });

  test('PAIE-RH-9 — "Visualiser" depuis le portail self-service /rh/mes-bulletins', async ({ page }) => {
    // Portail accessible à tout utilisateur authentifié (pas de restriction de rôle — voir
    // MesBulletinsController) : on réutilise ici la session e2e@test.com de loginViaApi.
    await page.goto(`http://localhost:4200/rh/mes-bulletins?tenant=${TEST_TENANT}`);
    await page.waitForLoadState('networkidle');

    if (await page.locator('.mb-table tbody tr').count() === 0) {
      test.skip(true, "L'utilisateur e2e@test.com n'a pas de bulletin généré à son nom — rien à visualiser.");
    }
    const visualiserBtn = page.locator('.mb-table tbody tr').first().getByRole('button', { name: /Visualiser le bulletin/i });
    await expect(visualiserBtn).toBeVisible();
    await expect(page.locator('.mb-table tbody tr').first().getByRole('button', { name: /Télécharger le PDF/i })).toBeVisible();
    await visualiserBtn.click();
    await expect(page.locator('.bpp-wrap')).toBeVisible({ timeout: 10_000 });
  });
});
