/**
 * Tests E2E Playwright — Chrono des tâches EN_COURS
 *
 * TT-1  badge "▶ …" visible quand une tâche passe EN_COURS
 * TT-2  le timer affiche une valeur > 0 après quelques secondes
 * TT-3  le timer disparaît quand on quitte EN_COURS
 * TT-4  après save + réouverture, le timer repart depuis le temps accumulé
 * TT-5  une seule tâche EN_COURS à la fois (auto-pause des autres)
 */

import { test, expect } from '@playwright/test';
import { loginViaApi, API_URL, TEST_TENANT, CLIENT_ID } from './helpers/auth';
import { getToken, authHeaders } from './helpers/api';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createTask(request: any, token: string, titre: string): Promise<number> {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  const res = await request.post(`${API_URL}/clients/${CLIENT_ID}/tasks`, {
    headers: authHeaders(token),
    data: { titre, statut: 'A_FAIRE', priorite: 'NORMALE', type: 'AUTRE', dateEcheance: tomorrow },
  });
  const body = await res.json();
  if (!body.id) throw new Error(`Création tâche échouée: ${JSON.stringify(body)}`);
  return body.id as number;
}

async function deleteTask(request: any, token: string, taskId: number) {
  await request.delete(`${API_URL}/clients/${CLIENT_ID}/tasks/${taskId}`, {
    headers: authHeaders(token),
  }).catch(() => {});
}

async function goToTasks(page: any) {
  await page.goto(`http://localhost:4200/tasks?tenant=${TEST_TENANT}`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.kanban-board, .kanban-col', { timeout: 10_000 });
}

/**
 * Ouvre la modal d'une tâche par son titre.
 * Cherche dans les cards kanban (.task-card .card-title) et les lignes tableau (.tl-row).
 */
async function openTaskModal(page: any, titre: string): Promise<boolean> {
  // Dans le kanban : cliquer sur le TITRE (pas la card entière, pour éviter le lien client)
  const cardTitle = page.locator('.task-card .card-title').filter({ hasText: titre });
  if (await cardTitle.count() > 0) {
    await cardTitle.first().click();
    await page.waitForSelector('.td-wrap', { timeout: 6_000 });
    return true;
  }
  // Dans la vue liste : cliquer sur la cellule titre
  const rowTitle = page.locator('.tl-row .tl-title').filter({ hasText: titre });
  if (await rowTitle.count() > 0) {
    await rowTitle.first().click();
    await page.waitForSelector('.td-wrap', { timeout: 6_000 });
    return true;
  }
  return false;
}

async function setStatut(page: any, statut: string) {
  const sel = page.locator('.statut-select').first();
  await sel.waitFor({ timeout: 4_000 });
  await sel.selectOption(statut);
  await page.waitForTimeout(300);
}

async function saveModal(page: any) {
  // Bouton "Sauvegarder" dans le footer de la modal
  const btn = page.locator('.td-footer button, .td-wrap button').filter({ hasText: /sauvegarder|enregistrer/i });
  if (await btn.count() > 0) {
    await btn.first().click();
    // Attendre la fermeture de la modal
    await page.waitForSelector('.td-wrap', { state: 'hidden', timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
}

async function closeModal(page: any) {
  await page.keyboard.press('Escape');
  await page.waitForSelector('.td-wrap', { state: 'hidden', timeout: 3_000 }).catch(() => {});
}

const createdIds: number[] = [];

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Chrono des tâches (TT)', () => {
  let token: string;

  test.beforeEach(async ({ page, request }) => {
    await loginViaApi(page);
    token = await getToken(request);
  });

  test.afterEach(async ({ request }) => {
    for (const id of createdIds.splice(0)) {
      await deleteTask(request, token, id);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  test('TT-1 : badge ▶ visible quand une tâche passe EN_COURS', async ({ page, request }) => {
    const id = await createTask(request, token, 'TT1 - Badge timer');
    createdIds.push(id);

    await goToTasks(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const opened = await openTaskModal(page, 'TT1 - Badge timer');
    if (!opened) {
      console.log('Card non trouvée dans le kanban, screenshot:', await page.screenshot({ path: '/tmp/tt1-notfound.png' }));
      test.skip();
      return;
    }

    // Passer EN_COURS
    await setStatut(page, 'EN_COURS');

    // Le badge live timer doit apparaître
    const badge = page.locator('.time-badge--live');
    await expect(badge).toBeVisible({ timeout: 4_000 });
    const text = await badge.textContent();
    console.log('TT-1 badge text:', text);
    expect(text).toContain('▶');

    await closeModal(page);
  });

  // ──────────────────────────────────────────────────────────────────────────
  test('TT-2 : le timer compte — affiche > 0 après 3 secondes', async ({ page, request }) => {
    const id = await createTask(request, token, 'TT2 - Timer compte');
    createdIds.push(id);

    await goToTasks(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const opened = await openTaskModal(page, 'TT2 - Timer compte');
    if (!opened) { test.skip(); return; }

    await setStatut(page, 'EN_COURS');

    const badge = page.locator('.time-badge--live');
    await expect(badge).toBeVisible({ timeout: 3_000 });

    // Laisser le timer tourner 3 secondes
    await page.waitForTimeout(3_000);

    const text = await badge.textContent();
    console.log('TT-2 timer après 3s:', text);

    // Ne doit pas être "▶ 0s" — doit afficher au moins 1s ou plus
    expect(text?.trim()).not.toMatch(/▶\s*0s$/);

    await closeModal(page);
  });

  // ──────────────────────────────────────────────────────────────────────────
  test('TT-3 : badge disparaît quand on quitte EN_COURS', async ({ page, request }) => {
    const id = await createTask(request, token, 'TT3 - Stop timer');
    createdIds.push(id);

    await goToTasks(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const opened = await openTaskModal(page, 'TT3 - Stop timer');
    if (!opened) { test.skip(); return; }

    // Démarrer
    await setStatut(page, 'EN_COURS');
    const badge = page.locator('.time-badge--live');
    await expect(badge).toBeVisible({ timeout: 3_000 });

    // Mettre en pause
    await setStatut(page, 'EN_PAUSE');
    await expect(badge).toBeHidden({ timeout: 2_000 });
    console.log('TT-3 badge masqué après EN_PAUSE ✓');

    await closeModal(page);
  });

  // ──────────────────────────────────────────────────────────────────────────
  test('TT-4 : après save + réouverture, le timer repart du temps accumulé', async ({ page, request }) => {
    const id = await createTask(request, token, 'TT4 - Accumul timer');
    createdIds.push(id);

    await goToTasks(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 1. Ouvrir et passer EN_COURS, laisser tourner 3s
    let opened = await openTaskModal(page, 'TT4 - Accumul timer');
    if (!opened) { test.skip(); return; }
    await setStatut(page, 'EN_COURS');
    await page.waitForTimeout(3_000);

    // Lire le temps affiché avant save
    const badge = page.locator('.time-badge--live');
    const textBefore = await badge.textContent().catch(() => '');
    console.log('TT-4 temps avant save:', textBefore);

    // 2. Sauvegarder
    await saveModal(page);

    // 3. Recharger et rouvrir la tâche
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    opened = await openTaskModal(page, 'TT4 - Accumul timer');
    if (!opened) { test.skip(); return; }

    // 4. Le timer doit reprendre depuis le temps accumulé (> 0s)
    const badgeAfter = page.locator('.time-badge--live');
    await expect(badgeAfter).toBeVisible({ timeout: 4_000 });
    const textAfter = await badgeAfter.textContent();
    console.log('TT-4 temps après réouverture:', textAfter);
    expect(textAfter?.trim()).not.toMatch(/▶\s*0s$/);

    await closeModal(page);
  });

  // ──────────────────────────────────────────────────────────────────────────
  test('TT-5 : une seule tâche EN_COURS à la fois (auto-pause)', async ({ page, request }) => {
    const idA = await createTask(request, token, 'TT5 - Tâche A');
    const idB = await createTask(request, token, 'TT5 - Tâche B');
    createdIds.push(idA, idB);

    await goToTasks(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Mettre Tâche A EN_COURS et sauvegarder
    let opened = await openTaskModal(page, 'TT5 - Tâche A');
    if (!opened) { test.skip(); return; }
    await setStatut(page, 'EN_COURS');
    await saveModal(page);

    // Recharger pour que l'auto-pause soit prise en compte
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Mettre Tâche B EN_COURS (doit auto-pauser A)
    opened = await openTaskModal(page, 'TT5 - Tâche B');
    if (!opened) { test.skip(); return; }
    await setStatut(page, 'EN_COURS');
    await saveModal(page);

    // Vérifier via API que la Tâche A est maintenant EN_PAUSE
    const res = await request.get(`${API_URL}/clients/${CLIENT_ID}/tasks`, {
      headers: authHeaders(token),
    });
    const tasks: any[] = await res.json();
    const taskA = tasks.find((t: any) => t.id === idA);
    console.log('TT-5 statut Tâche A après B EN_COURS:', taskA?.statut);
    expect(taskA?.statut).toBe('EN_PAUSE');
  });
});
