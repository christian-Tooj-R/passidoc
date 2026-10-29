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
const APP_URL = process.env['BASE_URL'] ?? 'http://localhost:4200'; // même port que playwright.config.ts
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

  await page.goto(`${APP_URL}/auth/login?tenant=${TENANT}`);
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

/** Champ « Durée » de la section Temps passé du dialogue de création de tâche. */
function dureeTache(page: Page) {
  return page.locator('.ct-temps-section .ct-field').filter({ hasText: 'Durée' }).locator('input[type="time"]');
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

    // Choisir un client (champ à autocomplétion)
    const client = page.locator('input[name="ctClientSearch"]');
    await client.click();
    await page.locator('.cdk-overlay-pane mat-option').nth(1).click();

    // Section Temps : Facturable (par défaut), durée au format HH:MM (<input type="time">)
    await dureeTache(page).fill('02:00');

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

    // Durée (<input type="time">)
    await dureeTache(page).fill('01:00');

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
    // Cliquer le titre : le centre de la carte peut tomber sur le lien du dossier client
    await firstCard.locator('.card-title').click();
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

// L'ancienne page /saisie-temps (onglets Semaine / Agenda / Détail) n'est plus routée :
// ses vues vivent désormais dans le module Travail (Agenda réalisé, Par semaine, Détail des temps).
test.describe('TACHE-08b — Module Travail — vues et filtres des temps', () => {

  test('ST-A : les vues Agenda / Par semaine / Détail sont dans la navigation', async ({ page }) => {
    await loginAfym(page);
    await page.goto(`${APP_URL}/travail/saisie?tenant=${TENANT}`);
    await expect(page.locator('.tw-sidebar')).toBeVisible({ timeout: 10_000 });
    for (const label of ['Agenda réalisé', 'Par semaine', 'Détail des temps']) {
      await expect(page.locator('.tw-nav__item', { hasText: label }).first()).toBeVisible();
    }
  });

  test('ST-A2 : « Agenda réalisé » affiche la semaine et sa navigation', async ({ page }) => {
    await loginAfym(page);
    await page.goto(`${APP_URL}/travail/saisie?tenant=${TENANT}`);
    await page.locator('.tw-nav__item', { hasText: 'Agenda réalisé' }).first().click();
    await expect(page.locator('.ag-title')).toHaveText('Agenda réalisé', { timeout: 10_000 });
    const semaine = page.locator('.week-txt');
    const avant = await semaine.textContent();
    await page.locator('.ag-header__center .nav-btn').first().click();
    await expect(semaine).not.toHaveText(avant ?? '');
    await page.locator('.btn-today').click();
    await expect(semaine).toHaveText(avant ?? '');
  });

  test('ST-A3 : « Détail des temps » affiche le rapport et ses paramètres', async ({ page }) => {
    await loginAfym(page);
    await page.goto(`${APP_URL}/travail/saisie?tenant=${TENANT}`);
    await page.locator('.tw-nav__item', { hasText: 'Détail des temps' }).first().click();
    await expect(page.getByRole('heading', { name: 'Détail des temps passés' })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.params')).toBeVisible();
    await expect(page.locator('.report table.data-table thead, .report .empty-state').first()).toBeVisible({ timeout: 10_000 });
  });

  test('ST-B : Détail — la recherche filtre les résultats', async ({ page }) => {
    await loginAfym(page);
    await page.goto(`${APP_URL}/travail/temps/detail?tenant=${TENANT}`);
    await expect(page.locator('.params')).toBeVisible({ timeout: 10_000 });
    await page.locator('.params input[placeholder*="Libellé" i]').fill('XXXXXXNOTFOUND');
    await expect(page.locator('.report .empty-state')).toContainText('Aucun temps pour ces critères');
    await expect(page.locator('tr.data-row')).toHaveCount(0);
  });

  test('ST-B2 : Détail — ne garder que le non facturable', async ({ page }) => {
    await loginAfym(page);
    await page.goto(`${APP_URL}/travail/temps/detail?tenant=${TENANT}`);
    await expect(page.locator('.params')).toBeVisible({ timeout: 10_000 });
    await page.locator('.seg__btn--FACTURABLE').click();
    await page.locator('.seg__btn--ABSENCE').click();
    await expect(page.locator('.seg__btn--FACTURABLE')).not.toHaveClass(/seg__btn--on/);
    await expect(page.locator('.seg__btn--NON_FACTURABLE')).toHaveClass(/seg__btn--on/);
    // Le rapport se recalcule après le clic : `allTextContents()` n'attend pas, d'où un poll.
    await expect.poll(async () => {
      const presences = await page.locator('tr.data-row .pres').allTextContents();
      return presences.every(p => p.includes('non facturable'));
    }, { timeout: 10_000 }).toBe(true);
  });
});
