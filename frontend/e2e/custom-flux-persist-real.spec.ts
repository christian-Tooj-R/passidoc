import { test, expect, request } from '@playwright/test';
import { loginViaApi, API_URL, CLIENT_ID, TEST_TENANT } from './helpers/auth';
import { getToken, authHeaders } from './helpers/api';

/**
 * Tests de persistance SANS MOCK — tape sur le vrai backend.
 * Valide que repo.save() persiste correctement customFluxTypes en base.
 *
 * Prérequis : backend sur :3000, frontend sur :4200, tenant test-e2e configuré.
 */

const LABEL = `Doc E2E ${Date.now()}`;

// ── Cleanup : supprime le type ajouté après chaque test ──────────────────────

async function resetCustomFluxTypes(token: string, originalTypes: { key: string; label: string }[]) {
  const ctx = await request.newContext();
  await ctx.patch(`${API_URL}/clients/${CLIENT_ID}`, {
    headers: authHeaders(token),
    data: { customFluxTypes: originalTypes },
  });
  await ctx.dispose();
}

async function getCustomFluxTypes(token: string): Promise<{ key: string; label: string }[]> {
  const ctx = await request.newContext();
  const res = await ctx.get(`${API_URL}/clients/${CLIENT_ID}`, {
    headers: authHeaders(token),
  });
  const body = await res.json();
  await ctx.dispose();
  return body.customFluxTypes ?? [];
}

// ── Helper : aller sur l'onglet Fiche Identité du client ─────────────────────

async function goToFicheTab(page: any) {
  await page.goto(`http://localhost:4200/clients/${CLIENT_ID}?tenant=${TEST_TENANT}`);
  await page.waitForLoadState('networkidle');
  // L'onglet Fiche Identité est actif par défaut — vérifier qu'il est chargé
  await expect(page.locator('app-fiche-identite-tab')).toBeVisible({ timeout: 10_000 });
}

// ── Helper : ajouter un type custom ──────────────────────────────────────────

async function addCustomFluxType(page: any, label: string) {
  // Scroller jusqu'au bouton d'ajout (il peut être en bas de la fiche)
  const addBtn = page.locator('button.flux-add-btn');
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();

  const input = page.locator('input.flux-add-input');
  await input.waitFor({ state: 'visible', timeout: 5_000 });
  await input.fill(label);

  const confirmBtn = page.locator('button.flux-add-confirm');
  await expect(confirmBtn).toBeEnabled({ timeout: 3_000 });
  await confirmBtn.click();

  // Attendre que le type apparaisse dans la liste
  await expect(page.getByText(label)).toBeVisible({ timeout: 8_000 });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Persistance document mensuel — VRAI backend (sans mock)', () => {

  test('ajouter un type custom → quitter → revenir : toujours en base', async ({ page }) => {
    const token = await loginViaApi(page);
    const originalTypes = await getCustomFluxTypes(token);

    try {
      await goToFicheTab(page);
      await addCustomFluxType(page, LABEL);

      // Attendre que le PATCH soit bien envoyé (petit délai réseau réel)
      await page.waitForTimeout(1_000);

      // Naviguer vers la liste clients (hors du dossier)
      await page.goto(`http://localhost:4200/clients?tenant=${TEST_TENANT}`);
      await page.waitForLoadState('networkidle');

      // Revenir sur le dossier → Angular recharge depuis le vrai backend
      await goToFicheTab(page);

      // Le type doit toujours être là — il vient du GET /api/clients/:id
      await expect(page.getByText(LABEL)).toBeVisible({ timeout: 8_000 });

      // Vérification directe en base via API
      const types = await getCustomFluxTypes(token);
      const found = types.find(t => t.label === LABEL);
      expect(found).toBeDefined();
    } finally {
      // Nettoyage — restaure l'état initial
      await resetCustomFluxTypes(token, originalTypes);
    }
  });

  test('naviguer vers dashboard puis revenir : le type persiste en base', async ({ page }) => {
    const token = await loginViaApi(page);
    const originalTypes = await getCustomFluxTypes(token);
    const label = `Doc Dashboard ${Date.now()}`;

    try {
      await goToFicheTab(page);
      await addCustomFluxType(page, label);

      await page.waitForTimeout(1_000);

      await page.goto(`http://localhost:4200/dashboard?tenant=${TEST_TENANT}`);
      await page.waitForLoadState('networkidle');

      await goToFicheTab(page);
      await expect(page.getByText(label)).toBeVisible({ timeout: 8_000 });

      // Double confirmation : vérifier directement via l'API
      const types = await getCustomFluxTypes(token);
      expect(types.find(t => t.label === label)).toBeDefined();
    } finally {
      await resetCustomFluxTypes(token, originalTypes);
    }
  });

  test('plusieurs allers-retours : le type reste en base', async ({ page }) => {
    const token = await loginViaApi(page);
    const originalTypes = await getCustomFluxTypes(token);
    const label = `Doc Multi ${Date.now()}`;

    try {
      await goToFicheTab(page);
      await addCustomFluxType(page, label);

      await page.waitForTimeout(1_000);

      // 1er aller-retour
      await page.goto(`http://localhost:4200/clients?tenant=${TEST_TENANT}`);
      await page.waitForLoadState('networkidle');
      await goToFicheTab(page);
      await expect(page.getByText(label)).toBeVisible({ timeout: 8_000 });

      // 2e aller-retour
      await page.goto(`http://localhost:4200/clients?tenant=${TEST_TENANT}`);
      await page.waitForLoadState('networkidle');
      await goToFicheTab(page);
      await expect(page.getByText(label)).toBeVisible({ timeout: 8_000 });

      // Vérification API après tout
      const types = await getCustomFluxTypes(token);
      expect(types.find(t => t.label === label)).toBeDefined();
    } finally {
      await resetCustomFluxTypes(token, originalTypes);
    }
  });

});
