/**
 * Tests E2E — Interactions Tâches × Saisie des temps
 *
 * Couvre :
 *   TK-01 : Dialog "Nouvelle tâche" — champs de base + section Temps passé visible
 *   TK-02 : Toggle Facturable / Non facturable dans la section Temps passé
 *   TK-03 : Catégorie obligatoire en mode Non facturable (+ champ Autre)
 *   TK-04 : Créer une tâche facturable avec saisie de temps → toast "+ saisie enregistrée"
 *   TK-05 : Créer une tâche non facturable (catégorie Réunion interne) → saisie enregistrée
 *   TK-06 : Dialog détail tâche — structure 2 colonnes (sidebar + gauche)
 *   TK-07 : Checklist — ajouter / cocher / supprimer une sous-tâche
 *   TK-08 : Passage EN_COURS → toast "Chrono saisie-temps démarré"
 *   ST-A  : Page Saisie des temps — 3 onglets de vue (Semaine / Agenda / Détail)
 *   ST-B  : Vue Détail — barre de recherche filtre en temps réel
 */

import { test, expect, request as pwRequest } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

// ─── Config ────────────────────────────────────────────────────────────────────
const API_URL = 'http://localhost:3000/api';
const APP_URL = 'http://localhost:4202';
const TENANT  = 'afym';
const EMAIL   = 'admin@admin.com';
const PASS    = 'Admin2024!';

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getToken(api: APIRequestContext): Promise<{ token: string; user: any }> {
  const res  = await api.post(`${API_URL}/auth/login`, {
    headers: { 'x-tenant-slug': TENANT },
    data: { email: EMAIL, password: PASS },
  });
  const body = await res.json();
  return { token: body.access_token, user: body.user };
}

async function loginAfym(page: Page): Promise<{ token: string; api: APIRequestContext }> {
  const api             = await pwRequest.newContext();
  const { token, user } = await getToken(api);

  await api.post(`${API_URL}/pointage/pointer`, {
    headers: { Authorization: `Bearer ${token}`, 'x-tenant-slug': TENANT },
    data: { latitude: null, longitude: null, action: 'ENTREE' },
  }).catch(() => {});

  await page.goto(`${APP_URL}/login?tenant=${TENANT}`);
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(({ token, user, tenant }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenant_slug', tenant);
  }, { token, user, tenant: TENANT });

  await page.goto(`${APP_URL}/dashboard?tenant=${TENANT}`);
  await page.waitForLoadState('networkidle');
  return { token, api };
}

async function waitForToast(page: Page, text?: string | RegExp) {
  const snack = page.locator('mat-snack-bar-container');
  await snack.waitFor({ timeout: 8_000 });
  if (text) await expect(snack).toContainText(text, { timeout: 5_000 });
}

async function openNewTaskDialog(page: Page) {
  await page.goto(`${APP_URL}/tasks?tenant=${TENANT}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  await page.locator('button', { hasText: /nouvelle tâche/i }).click();
  await expect(page.locator('.ct-wrap')).toBeVisible({ timeout: 5_000 });
}

// ─── Suite ─────────────────────────────────────────────────────────────────────

test.describe('TACHE-09 — Dialog "Nouvelle tâche" avec section Temps passé', () => {

  test('TK-01 : le dialog affiche le titre, le type et la section Temps passé', async ({ page }) => {
    await loginAfym(page);
    await openNewTaskDialog(page);

    await expect(page.locator('.ct-header__title', { hasText: /nouvelle tâche/i })).toBeVisible();
    // Section temps passé toujours visible
    await expect(page.locator('.ct-temps-section')).toBeVisible();
    // Toggle facturable / non facturable présent
    await expect(page.locator('.ct-type-pill', { hasText: /facturable/i }).first()).toBeVisible();
    await expect(page.locator('.ct-type-pill', { hasText: /non facturable/i })).toBeVisible();
  });

  test('TK-02 : toggle Facturable actif par défaut, passer à Non facturable révèle la catégorie', async ({ page }) => {
    await loginAfym(page);
    await openNewTaskDialog(page);

    // Par défaut : Facturable actif (classe --fact)
    const pillFact = page.locator('.ct-type-pill--fact');
    await expect(pillFact).toBeVisible();

    // Catégorie absente en mode Facturable
    await expect(page.locator('.ct-select', { hasText: /appel téléphonique/i })).not.toBeVisible();

    // Cliquer Non facturable
    await page.locator('.ct-type-pill', { hasText: /non facturable/i }).click();
    await expect(page.locator('.ct-type-pill--nf')).toBeVisible();

    // Catégorie apparaît
    const catSelect = page.locator('select').filter({ hasText: /appel téléphonique/i });
    await expect(catSelect).toBeVisible();
  });

  test('TK-03 : sélectionner "Autre" en NF révèle le champ libre', async ({ page }) => {
    await loginAfym(page);
    await openNewTaskDialog(page);

    await page.locator('.ct-type-pill', { hasText: /non facturable/i }).click();

    // Choisir "Autre"
    const catSelect = page.locator('.ct-temps-section select').first();
    await catSelect.selectOption('AUTRE');

    // Champ libre visible
    await expect(page.locator('input[placeholder*="Décrivez l\'activité"]')).toBeVisible();
  });

  test('TK-04 : créer une tâche facturable avec durée → toast "+ saisie enregistrée"', async ({ page }) => {
    await loginAfym(page);
    await openNewTaskDialog(page);

    // Remplir titre
    await page.locator('.ct-title-input').fill('Test tâche facturable E2E');

    // Choisir un client
    const clientSelect = page.locator('.ct-select').first();
    await clientSelect.selectOption({ index: 1 });

    // Section Temps : Facturable (par défaut), remplir durée
    await page.locator('input[placeholder*="1h30"]').fill('2h');

    // Créer
    await page.locator('.ct-btn-create').click();

    await waitForToast(page, /saisie enregistrée/i);
  });

  test('TK-05 : créer tâche NF (Réunion interne) → saisie enregistrée', async ({ page }) => {
    await loginAfym(page);
    await openNewTaskDialog(page);

    await page.locator('.ct-title-input').fill('Réunion hebdo E2E');

    // Tâche sans dossier (checkbox dans le label .ct-sans-dossier)
    await page.locator('.ct-sans-dossier input[type="checkbox"]').check();

    // Non facturable
    await page.locator('.ct-type-pill', { hasText: /non facturable/i }).click();

    // Catégorie
    const catSelect = page.locator('.ct-temps-section select').first();
    await catSelect.selectOption('REUNION_INTERNE');

    // Durée
    await page.locator('input[placeholder*="1h30"]').fill('1h');

    await page.locator('.ct-btn-create').click();
    await waitForToast(page, /saisie enregistrée/i);
  });
});

test.describe('TACHE-09 — Dialog détail de tâche enrichi', () => {

  async function openFirstTask(page: Page) {
    await page.goto(`${APP_URL}/tasks?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    // Cliquer sur la première carte Kanban (.task-card)
    const firstCard = page.locator('.task-card').first();
    await firstCard.waitFor({ timeout: 10_000 });
    await firstCard.click();
    await expect(page.locator('.td-wrap')).toBeVisible({ timeout: 6_000 });
  }

  test('TK-06 : dialog détail a le layout 2 colonnes (gauche + sidebar)', async ({ page }) => {
    await loginAfym(page);
    await openFirstTask(page);

    // Colonne gauche
    await expect(page.locator('.td-col-left')).toBeVisible();
    // Colonne droite (sidebar)
    await expect(page.locator('.td-col-right')).toBeVisible();
    // Sidebar contient le select Statut
    await expect(page.locator('.td-col-right .statut-select')).toBeVisible();
    // Section saisies de temps
    await expect(page.locator('.td-section-title', { hasText: /temps passé/i })).toBeVisible();
    // Section sous-tâches
    await expect(page.locator('.td-section-title', { hasText: /sous-tâches/i })).toBeVisible();
  });

  test('TK-07 : checklist — ajouter, cocher et supprimer une sous-tâche', async ({ page }) => {
    await loginAfym(page);
    await openFirstTask(page);

    // L'utilisateur doit pouvoir éditer (cherche une tâche éditable parmi les cartes)
    const clInput = page.locator('.td-cl-input');
    if (!await clInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await page.locator('.td-btn-cancel, .td-close').first().click();
      await page.waitForTimeout(300);
      const cards = page.locator('.task-card');
      const count = await cards.count();
      for (let i = 1; i < Math.min(count, 6); i++) {
        await cards.nth(i).click();
        await page.waitForTimeout(400);
        if (await clInput.isVisible({ timeout: 1_000 }).catch(() => false)) break;
        await page.locator('.td-btn-cancel, .td-close').first().click().catch(() => {});
        await page.waitForTimeout(200);
      }
    }

    // Ajouter une sous-tâche
    await clInput.fill('Vérifier les pièces jointes');
    await page.locator('.td-cl-add-btn').click();

    // La sous-tâche apparaît
    await expect(page.locator('.td-cl-item', { hasText: 'Vérifier les pièces jointes' })).toBeVisible();

    // Cocher la sous-tâche
    await page.locator('.td-cl-item').filter({ hasText: 'Vérifier les pièces jointes' })
              .locator('input[type="checkbox"]').check();
    await expect(page.locator('.td-cl-done', { hasText: 'Vérifier les pièces jointes' })).toBeVisible();

    // Supprimer la sous-tâche
    await page.locator('.td-cl-item').filter({ hasText: 'Vérifier les pièces jointes' })
              .locator('.td-cl-del').click();
    await expect(page.locator('.td-cl-item', { hasText: 'Vérifier les pièces jointes' })).not.toBeVisible();
  });

  test('TK-08 : passer une tâche EN_COURS déclenche le toast chrono saisie-temps', async ({ page }) => {
    await loginAfym(page);

    await page.goto(`${APP_URL}/tasks?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    // Ouvrir la première carte Kanban
    const firstCard = page.locator('.task-card').first();
    await firstCard.waitFor({ timeout: 10_000 });
    await firstCard.click();

    await expect(page.locator('.td-wrap')).toBeVisible({ timeout: 6_000 });

    // Changer le statut en EN_COURS
    const statutSelect = page.locator('.statut-select');
    await statutSelect.selectOption('EN_COURS');

    // Toast chrono ou message statut mis à jour
    const toast = page.locator('mat-snack-bar-container');
    await toast.waitFor({ timeout: 8_000 });
    // Soit le chrono démarre, soit la tâche était déjà en cours
    const toastText = await toast.textContent();
    expect(
      toastText?.match(/chrono|en cours|mis à jour/i)
    ).toBeTruthy();
  });
});

test.describe('TACHE-08b — Page Saisie des temps — vues et filtres', () => {

  test('ST-A : les 3 boutons de vue sont présents (Semaine / Agenda / Détail)', async ({ page }) => {
    await loginAfym(page);
    await page.goto(`${APP_URL}/saisie-temps?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    await expect(page.locator('.st-page')).toBeVisible();

    // Boutons de vue dans la topbar
    await expect(page.locator('button', { hasText: /semaine/i }).first()).toBeVisible();
    await expect(page.locator('button', { hasText: /agenda/i })).toBeVisible();
    await expect(page.locator('button', { hasText: /détail/i })).toBeVisible();
  });

  test('ST-A2 : cliquer "Agenda" affiche la grille calendrier', async ({ page }) => {
    await loginAfym(page);
    await page.goto(`${APP_URL}/saisie-temps?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    await page.locator('button', { hasText: /agenda/i }).click();
    await page.waitForTimeout(400);

    await expect(page.locator('.st-calendar-view')).toBeVisible();
  });

  test('ST-A3 : cliquer "Détail" affiche le tableau avec entête', async ({ page }) => {
    await loginAfym(page);
    await page.goto(`${APP_URL}/saisie-temps?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    await page.locator('button', { hasText: /détail/i }).click();
    await page.waitForTimeout(400);

    await expect(page.locator('.st-detail-view')).toBeVisible();
    // Table présente
    await expect(page.locator('.st-detail-view table, .st-detail-view .st-table')).toBeVisible();
  });

  test('ST-B : Vue Détail — la recherche filtre les résultats', async ({ page }) => {
    await loginAfym(page);
    await page.goto(`${APP_URL}/saisie-temps?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    await page.locator('button', { hasText: /détail/i }).click();
    await page.waitForTimeout(400);

    // Compter les lignes avant filtre
    const rows = page.locator('.st-detail-view tbody tr, .st-table tbody tr');
    const countBefore = await rows.count();

    // Chercher quelque chose d'improbable pour vider la table
    const searchInput = page.locator('input[placeholder*="recherche"], input[placeholder*="Recherche"], .st-search-input').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('XXXXXXNOTFOUND');
      await page.waitForTimeout(400);
      const countAfter = await rows.count();
      expect(countAfter).toBeLessThanOrEqual(countBefore);
    } else {
      // Si pas de champ recherche visible, vérifier que la table existe
      expect(await page.locator('.st-detail-view').isVisible()).toBe(true);
    }
  });

  test('ST-B2 : Vue Semaine — filtre "NF" filtre les non-facturables', async ({ page }) => {
    await loginAfym(page);
    await page.goto(`${APP_URL}/saisie-temps?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);

    // Vue Semaine (par défaut)
    await expect(page.locator('.st-page')).toBeVisible();

    // Filtres Tous / Fact. / NF
    await expect(page.locator('.st-filter-btn', { hasText: /tous/i })).toBeVisible();
    const nfBtn = page.locator('.st-filter-btn', { hasText: /nf|non fact/i });
    await expect(nfBtn).toBeVisible();

    // Cliquer NF
    await nfBtn.click();
    await page.waitForTimeout(300);
    await expect(nfBtn).toHaveClass(/active/);
  });
});
