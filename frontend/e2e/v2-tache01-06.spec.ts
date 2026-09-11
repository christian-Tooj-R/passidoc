/**
 * Tests E2E — TACHE-01 (Pôles Est/Ouest) + TACHE-06 (Tâches récurrentes)
 * Tenant: afym / Client: 21
 */

import { test, expect, request as pwRequest } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

const API_URL   = 'http://localhost:3000/api';
const APP_URL   = 'http://localhost:4202';
const TENANT    = 'afym';
const EMAIL     = 'admin@admin.com';
const PASS      = 'Admin2024!';
const CLIENT_ID = 21;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getToken(api: APIRequestContext): Promise<{ token: string; user: any }> {
  const res  = await api.post(`${API_URL}/auth/login`, {
    headers: { 'x-tenant-slug': TENANT },
    data: { email: EMAIL, password: PASS },
  });
  const body = await res.json();
  return { token: body.access_token, user: body.user };
}

function h(token: string) {
  return { Authorization: `Bearer ${token}`, 'x-tenant-slug': TENANT };
}

async function loginAfym(page: Page): Promise<{ token: string; api: APIRequestContext }> {
  const api             = await pwRequest.newContext();
  const { token, user } = await getToken(api);

  await api.post(`${API_URL}/pointage/pointer`, {
    headers: h(token),
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

async function goToClientTab(page: Page, tabLabel: string) {
  await page.goto(`${APP_URL}/clients/${CLIENT_ID}?tenant=${TENANT}`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.sidenav__item', { timeout: 12_000 });
  const tab = page.locator('.sidenav__item').filter({ hasText: new RegExp(tabLabel, 'i') });
  await tab.first().click();
  await page.waitForTimeout(800);
}

async function waitForToast(page: Page, text?: string) {
  const snack = page.locator('mat-snack-bar-container');
  await snack.waitFor({ timeout: 8_000 });
  if (text) await expect(snack).toContainText(text, { timeout: 5_000 });
}

// ═══════════════════════════════════════════════════════════════════════════
// TACHE-01 — Pôles Est / Ouest
// ═══════════════════════════════════════════════════════════════════════════
test.describe('TACHE-01 — Pôles Est / Ouest', () => {
  test.beforeEach(async ({ page }) => { await loginAfym(page); });

  test('P01 : le wizard de création affiche "Pôle EST" et "Pôle OUEST"', async ({ page }) => {
    // setupGuard charge désormais /tenant/config avant de rendre la route
    await page.goto(`${APP_URL}/clients?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');

    const createBtn = page.locator('button.btn-new-folder');
    await createBtn.waitFor({ timeout: 10_000 });
    await createBtn.click();
    await page.waitForTimeout(600);

    const siteCards = page.locator('.site-cards');
    await siteCards.waitFor({ timeout: 10_000 });
    await siteCards.scrollIntoViewIfNeeded();

    const cards = page.locator('.site-card');
    await expect(cards).toHaveCount(2);
    const texts = await cards.allTextContents();
    const combined = texts.join('|');
    expect(combined).toMatch(/Pôle EST/i);
    expect(combined).toMatch(/Pôle OUEST/i);
  });

  test('P02 : sélectionner la première carte (Pôle EST) la marque comme active', async ({ page }) => {
    await page.goto(`${APP_URL}/clients?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const createBtn = page.locator('button.btn-new-folder');
    await createBtn.waitFor({ timeout: 10_000 });
    await createBtn.click();
    await page.waitForTimeout(800);

    const siteCards = page.locator('.site-cards');
    await siteCards.waitFor({ timeout: 10_000 });
    await siteCards.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const cards = page.locator('.site-card');
    await cards.first().click();
    await page.waitForTimeout(300);

    await expect(cards.first()).toHaveClass(/selected/, { timeout: 3_000 });
  });

  test('P03 : API tenant/config retourne les nouveaux labels', async () => {
    const api  = await pwRequest.newContext();
    const resp = await api.get(`${API_URL}/tenant/config`, {
      headers: { 'x-tenant-slug': TENANT },
    });
    const cfg = await resp.json();
    expect(cfg.poleLabel1).toBe('Pôle EST');
    expect(cfg.poleLabel2).toBe('Pôle OUEST');
    await api.dispose();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TACHE-06 — Tâches récurrentes
// ═══════════════════════════════════════════════════════════════════════════
test.describe('TACHE-06 — Tâches récurrentes', () => {
  let createdTrId: number | null = null;
  let createdTaskId: number | null = null;

  test.afterAll(async () => {
    const api = await pwRequest.newContext();
    const { token } = await getToken(api);
    if (createdTrId)   await api.delete(`${API_URL}/taches-recurrentes/${createdTrId}`, { headers: h(token) }).catch(() => {});
    if (createdTaskId) await api.delete(`${API_URL}/tasks/${createdTaskId}`, { headers: h(token) }).catch(() => {});
    await api.dispose();
  });

  test('TR-01 : l\'onglet "Tâches récurrentes" s\'affiche dans le dossier client', async ({ page }) => {
    await loginAfym(page);
    await goToClientTab(page, 'Tâches récurrentes');

    await expect(page.locator('.tr-tab')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.tr-title')).toContainText(/tâches récurrentes/i);
    await expect(page.locator('.tr-form')).toBeVisible();
  });

  test('TR-02 : créer une tâche récurrente via le formulaire', async ({ page }) => {
    await loginAfym(page);
    await goToClientTab(page, 'Tâches récurrentes');
    await page.waitForSelector('.tr-form', { timeout: 10_000 });

    // Remplir le titre
    const titreInput = page.locator('.tr-form mat-form-field').filter({ hasText: /Titre/i }).locator('input');
    await titreInput.fill('E2E-TVA mensuelle');

    // Sélectionner la fréquence "Mensuelle"
    const freqSelect = page.locator('.tr-form mat-form-field').filter({ hasText: /Fréquence/i }).locator('mat-select');
    await freqSelect.click();
    await page.waitForTimeout(300);
    await page.locator('mat-option', { hasText: /Mensuelle/i }).first().click();
    await page.waitForTimeout(200);

    // Saisir le délai (5 jours)
    const delaiInput = page.locator('.tr-form mat-form-field').filter({ hasText: /Délai/i }).locator('input');
    await delaiInput.clear();
    await delaiInput.fill('5');

    // Enregistrer
    await page.locator('.tr-btn-add').click();
    await waitForToast(page, 'enregistrée');

    // La tâche doit apparaître dans la liste
    const liste = page.locator('.tr-list .tr-item');
    await expect(liste.filter({ hasText: /E2E-TVA mensuelle/i })).toBeVisible({ timeout: 8_000 });

    // Récupérer l'ID pour cleanup
    const api = await pwRequest.newContext();
    const { token } = await getToken(api);
    const resp = await api.get(`${API_URL}/taches-recurrentes?clientId=${CLIENT_ID}`, { headers: h(token) });
    const list = await resp.json();
    const found = (Array.isArray(list) ? list : []).find((t: any) => t.titre?.includes('E2E-TVA mensuelle'));
    if (found) createdTrId = found.id;
    await api.dispose();
  });

  test('TR-03 : supprimer la tâche récurrente créée', async ({ page }) => {
    // Prérequis : la tâche doit exister
    const api = await pwRequest.newContext();
    const { token } = await getToken(api);
    const resp = await api.get(`${API_URL}/taches-recurrentes?clientId=${CLIENT_ID}`, { headers: h(token) });
    const list = await resp.json();
    const found = (Array.isArray(list) ? list : []).find((t: any) => t.titre?.includes('E2E-TVA mensuelle'));
    if (!found) { await api.dispose(); test.skip(); return; }
    createdTrId = found.id;
    await api.dispose();

    await loginAfym(page);
    await goToClientTab(page, 'Tâches récurrentes');
    await page.waitForSelector('.tr-list', { timeout: 10_000 });

    const item = page.locator('.tr-item').filter({ hasText: /E2E-TVA mensuelle/i });
    await item.waitFor({ timeout: 8_000 });

    const countBefore = await page.locator('.tr-item').count();
    await item.locator('button[mattooltip="Supprimer"]').click();
    await waitForToast(page, 'supprimée');

    await page.waitForTimeout(500);
    const countAfter = await page.locator('.tr-item').count();
    expect(countAfter).toBeLessThan(countBefore);
    createdTrId = null;
  });

  test('TR-04 : badge REC visible sur une tâche récurrente dans le Kanban', async ({ page }) => {
    const { token } = await loginAfym(page);

    // Créer une tâche avec estRecurrente=true via API
    const api = await pwRequest.newContext();
    const createResp = await api.post(`${API_URL}/tasks`, {
      headers: h(token),
      data: {
        titre: 'E2E-Tâche récurrente badge',
        statut: 'A_FAIRE',
        priorite: 'NORMALE',
        estRecurrente: true,
        anyoneCanTake: true,
      },
    });
    const created = await createResp.json();
    createdTaskId = created.id;
    await api.dispose();

    // Naviguer vers la page Kanban
    await page.goto(`${APP_URL}/tasks?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Trouver la carte et vérifier le badge REC (first() pour éviter l'erreur strict mode)
    const card = page.locator('.task-card').filter({ hasText: /E2E-Tâche récurrente badge/i }).first();
    await card.waitFor({ timeout: 10_000 });
    await expect(card.locator('.card-svc-badge--rec')).toBeVisible({ timeout: 5_000 });
    await expect(card.locator('.card-svc-badge--rec')).toContainText('REC');
  });
});
