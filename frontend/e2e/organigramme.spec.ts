/**
 * Test E2E — Organigramme fiche d'identité
 * Vérifie : ajout de racines, ajout d'enfants, édition, persistance après save+reload
 */
import { test, expect } from '@playwright/test';
import { loginViaApi, API_URL, TEST_TENANT, CLIENT_ID } from './helpers/auth';

test.describe('Organigramme fiche d\'identité', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    // Naviguer sur la fiche d'identité du client de test
    await page.goto(`http://localhost:4200/clients/${CLIENT_ID}?tenant=${TEST_TENANT}`);
    await page.waitForLoadState('networkidle');

    // Cliquer sur "Fiche d'identité" dans la sidebar
    const ficheBtn = page.locator('.sidenav__item').filter({ hasText: /fiche|identit/i });
    if (await ficheBtn.count() > 0) {
      await ficheBtn.first().click();
      await page.waitForTimeout(800);
    }

    // Ouvrir le panneau Organigramme (mat-expansion-panel)
    const orgPanel = page.locator('mat-expansion-panel').filter({ hasText: /organigramme/i });
    await orgPanel.waitFor({ timeout: 8_000 });
    const header = orgPanel.locator('mat-expansion-panel-header');
    const isExpanded = await orgPanel.getAttribute('aria-expanded').catch(() => null)
      ?? await orgPanel.evaluate(el => el.classList.contains('mat-expanded')).catch(() => false);
    if (!isExpanded) {
      await header.click();
      await page.waitForTimeout(500);
    }
  });

  test('ORG-1 : état vide initial — bouton "Ajouter une racine" visible', async ({ page }) => {
    // Le bouton doit exister dans la section organigramme
    const btn = page.locator('.orgchart-header button').filter({ hasText: /ajouter une racine/i });
    await expect(btn).toBeVisible({ timeout: 6_000 });
  });

  test('ORG-2 : ajouter une racine crée un nœud visible', async ({ page }) => {
    const btn = page.locator('.orgchart-header button').filter({ hasText: /ajouter une racine/i });
    await btn.click();
    await page.waitForTimeout(300);

    const node = page.locator('.org-node').first();
    await expect(node).toBeVisible({ timeout: 4_000 });
    await expect(node).toContainText(/nouveau nœud/i);
  });

  test('ORG-3 : éditer un nœud change son contenu', async ({ page }) => {
    // Ajouter une racine
    await page.locator('.orgchart-header button').filter({ hasText: /ajouter une racine/i }).click();
    await page.waitForTimeout(300);

    // Cliquer sur le nœud pour l'éditer
    const nodeView = page.locator('.org-node__view').first();
    await nodeView.click();
    await page.waitForTimeout(200);

    // Remplir nom et poste
    const inputs = page.locator('.org-node__edit .org-input');
    await inputs.nth(0).clear();
    await inputs.nth(0).fill('Directeur Général');
    await inputs.nth(1).clear();
    await inputs.nth(1).fill('PDG');

    // Valider
    await page.locator('.org-btn--save').first().click();
    await page.waitForTimeout(200);

    await expect(page.locator('.org-node__nom').first()).toHaveText('Directeur Général');
    await expect(page.locator('.org-node__poste').first()).toHaveText('PDG');
  });

  test('ORG-4 : ajouter un enfant crée un nœud subordonné', async ({ page }) => {
    await page.locator('.orgchart-header button').filter({ hasText: /ajouter une racine/i }).click();
    await page.waitForTimeout(300);

    // Survoler le nœud pour faire apparaître les actions
    const node = page.locator('.org-node').first();
    await node.hover();
    await page.waitForTimeout(200);

    // Cliquer sur "ajouter un subordonné"
    const addBtn = node.locator('.org-btn[title*="subordonn"]').first();
    await addBtn.click();
    await page.waitForTimeout(300);

    // Il doit maintenant y avoir 2 nœuds
    const nodes = page.locator('.org-node');
    await expect(nodes).toHaveCount(2);
  });

  test('ORG-5 : plusieurs racines côte à côte', async ({ page }) => {
    const addBtn = page.locator('.orgchart-header button').filter({ hasText: /ajouter une racine/i });

    await addBtn.click();
    await page.waitForTimeout(200);
    await addBtn.click();
    await page.waitForTimeout(200);

    const nodes = page.locator('.org-node');
    await expect(nodes).toHaveCount(2);

    // Les deux racines sont dans org-forest (côte à côte)
    const forest = page.locator('.org-forest');
    await expect(forest).toBeVisible();
    const rootWraps = forest.locator(':scope > .org-node-wrap');
    await expect(rootWraps).toHaveCount(2);
  });

  test('ORG-6 : supprimer une racine retire le nœud', async ({ page }) => {
    await page.locator('.orgchart-header button').filter({ hasText: /ajouter une racine/i }).click();
    await page.waitForTimeout(300);

    const node = page.locator('.org-node').first();
    await node.hover();
    await page.waitForTimeout(200);

    await node.locator('.org-btn--del').first().click();
    await page.waitForTimeout(300);

    // Retour à l'état vide
    const emptyMsg = page.locator('.orgchart-empty');
    await expect(emptyMsg).toBeVisible({ timeout: 3_000 });
  });

  test('ORG-7 : persistance — save puis reload conserve les données', async ({ page }) => {
    // 1. Ajouter 2 racines
    const addBtn = page.locator('.orgchart-header button').filter({ hasText: /ajouter une racine/i });
    await addBtn.click();
    await page.waitForTimeout(200);
    await addBtn.click();
    await page.waitForTimeout(200);

    // 2. Renommer la première racine
    await page.locator('.org-node__view').first().click();
    await page.waitForTimeout(150);
    const input = page.locator('.org-node__edit .org-input').first();
    await input.clear();
    await input.fill('DG Test Persist');
    await page.locator('.org-btn--save').first().click();
    await page.waitForTimeout(200);

    // 3. Enregistrer le formulaire
    const saveBtn = page.locator('button[type=submit]').filter({ hasText: /enregistrer/i });
    await saveBtn.click();
    await page.waitForTimeout(1_500);

    // 4. Recharger la page et re-naviguer sur la fiche d'identité
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Re-cliquer sur fiche d'identité dans la sidebar
    const ficheBtn2 = page.locator('.sidenav__item').filter({ hasText: /fiche|identit/i });
    if (await ficheBtn2.count() > 0) {
      await ficheBtn2.first().click();
      await page.waitForTimeout(800);
    }

    // Rouvrir le panneau organigramme
    const orgPanel = page.locator('mat-expansion-panel').filter({ hasText: /organigramme/i });
    await orgPanel.waitFor({ timeout: 8_000 });
    const header = orgPanel.locator('mat-expansion-panel-header');
    const isExpanded = await orgPanel.evaluate(el => el.classList.contains('mat-expanded')).catch(() => false);
    if (!isExpanded) {
      await header.click();
      await page.waitForTimeout(600);
    }

    // 5. Vérifier les données
    await expect(page.locator('.org-node')).toHaveCount(2, { timeout: 6_000 });
    await expect(page.locator('.org-node__nom').first()).toHaveText('DG Test Persist');
  });
});
