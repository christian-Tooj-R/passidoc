/**
 * Tests E2E — Onglet Documents (Ressources > Documents)
 * Couvre : panneau de qualification, upload, badges, suppression
 */
import { test, expect, request as pwRequest } from '@playwright/test';
import { loginViaApi, goToDocuments, API_URL, TEST_TENANT, CLIENT_ID } from './helpers/auth';
import { getToken, authHeaders, resetTestData } from './helpers/api';

// ──────────────────────────────────────────────────────────
// Setup / teardown
// ──────────────────────────────────────────────────────────

test.describe('Documents — onglet', () => {
  let token = '';

  test.beforeAll(async () => {
    const api = await pwRequest.newContext();
    token = await getToken(api);
    await resetTestData(api, token);
    await api.dispose();
  });

  test.afterAll(async () => {
    const api = await pwRequest.newContext();
    const t = await getToken(api);
    await resetTestData(api, t);
    await api.dispose();
  });

  // ──────────────────────────────────────────────────────────
  // DOC-1 : Accès à l'onglet
  // ──────────────────────────────────────────────────────────
  test('DOC-1 — onglet Documents accessible depuis la sidebar', async ({ page }) => {
    await loginViaApi(page);
    await goToDocuments(page);
    // Le bouton upload et le titre Documents doivent être visibles
    // Le bouton import est dans l'onglet Documents (app-documents-tab)
    await expect(page.locator('app-documents-tab label.upload-btn')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('app-documents-tab h3')).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────
  // DOC-2 : Panneau de qualification apparaît après sélection
  // ──────────────────────────────────────────────────────────
  test('DOC-2 — panneau qualif apparaît après sélection de fichier', async ({ page }) => {
    await loginViaApi(page);
    await goToDocuments(page);

    await expect(page.locator('.meta-panel')).not.toBeVisible();

    await page.locator('label.upload-btn input[type="file"]').setInputFiles({
      name: 'test.txt', mimeType: 'text/plain', buffer: Buffer.from('contenu test'),
    });

    await expect(page.locator('.meta-panel')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.meta-panel__filename')).toContainText('test.txt');
  });

  // ──────────────────────────────────────────────────────────
  // DOC-3 : "Non classé" par défaut → pas de mois/année
  // ──────────────────────────────────────────────────────────
  test('DOC-3 — défaut Non classé : champs mois/année masqués', async ({ page }) => {
    await loginViaApi(page);
    await goToDocuments(page);

    await page.locator('label.upload-btn input[type="file"]').setInputFiles({
      name: 'test.txt', mimeType: 'text/plain', buffer: Buffer.from('x'),
    });
    await expect(page.locator('.meta-panel')).toBeVisible({ timeout: 5_000 });

    // Le type select existe et affiche "Non classé"
    const typeSelect = page.locator('.meta-panel mat-select').first();
    await expect(typeSelect).toBeVisible();
    await expect(typeSelect).toContainText('Non classé');

    // Les champs période ne doivent pas être là
    await expect(page.locator('.meta-period-row')).not.toBeVisible();
  });

  // ──────────────────────────────────────────────────────────
  // DOC-4 : FACTURE_ACHAT → champs période apparaissent
  // ──────────────────────────────────────────────────────────
  test('DOC-4 — Facture achat : mois et année apparaissent', async ({ page }) => {
    await loginViaApi(page);
    await goToDocuments(page);

    await page.locator('label.upload-btn input[type="file"]').setInputFiles({
      name: 'facture.txt', mimeType: 'text/plain', buffer: Buffer.from('x'),
    });
    await expect(page.locator('.meta-panel')).toBeVisible({ timeout: 5_000 });

    // Sélectionner Facture achat
    await page.locator('.meta-panel mat-select').first().click();
    await page.waitForTimeout(300);
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: /facture achat/i }).first().click();
    await page.waitForTimeout(500);

    // La rangée période doit apparaître
    await expect(page.locator('.meta-period-row')).toBeVisible({ timeout: 3_000 });
    await expect(page.locator('.meta-mois-ff')).toBeVisible();
    await expect(page.locator('.meta-annee-ff')).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────
  // DOC-5 : FACTURE_VENTE → champs période apparaissent
  // ──────────────────────────────────────────────────────────
  test('DOC-5 — Facture vente : mois et année apparaissent', async ({ page }) => {
    await loginViaApi(page);
    await goToDocuments(page);

    await page.locator('label.upload-btn input[type="file"]').setInputFiles({
      name: 'vente.txt', mimeType: 'text/plain', buffer: Buffer.from('x'),
    });
    await expect(page.locator('.meta-panel')).toBeVisible({ timeout: 5_000 });

    await page.locator('.meta-panel mat-select').first().click();
    await page.waitForTimeout(300);
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: /facture vente/i }).first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('.meta-period-row')).toBeVisible({ timeout: 3_000 });
  });

  // ──────────────────────────────────────────────────────────
  // DOC-6 : AUTRE → champs période masqués
  // ──────────────────────────────────────────────────────────
  test('DOC-6 — Autre : champs mois/année masqués', async ({ page }) => {
    await loginViaApi(page);
    await goToDocuments(page);

    await page.locator('label.upload-btn input[type="file"]').setInputFiles({
      name: 'autre.txt', mimeType: 'text/plain', buffer: Buffer.from('x'),
    });
    await expect(page.locator('.meta-panel')).toBeVisible({ timeout: 5_000 });

    await page.locator('.meta-panel mat-select').first().click();
    await page.waitForTimeout(300);
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: /autre/i }).first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('.meta-period-row')).not.toBeVisible();
  });

  // ──────────────────────────────────────────────────────────
  // DOC-7 : Retour à Non classé → champs période masqués
  // ──────────────────────────────────────────────────────────
  test('DOC-7 — retour Non classé après facture : mois/année masqués', async ({ page }) => {
    await loginViaApi(page);
    await goToDocuments(page);

    await page.locator('label.upload-btn input[type="file"]').setInputFiles({
      name: 'test.txt', mimeType: 'text/plain', buffer: Buffer.from('x'),
    });
    await expect(page.locator('.meta-panel')).toBeVisible({ timeout: 5_000 });

    // Passer à Facture achat
    await page.locator('.meta-panel mat-select').first().click();
    await page.waitForTimeout(300);
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: /facture achat/i }).first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('.meta-period-row')).toBeVisible({ timeout: 3_000 });

    // Repasser à Non classé
    await page.locator('.meta-panel mat-select').first().click();
    await page.waitForTimeout(300);
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: /non classé/i }).first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('.meta-period-row')).not.toBeVisible();
  });

  // ──────────────────────────────────────────────────────────
  // DOC-8 : Annuler ferme le panneau
  // ──────────────────────────────────────────────────────────
  test('DOC-8 — Annuler referme le panneau sans uploader', async ({ page }) => {
    await loginViaApi(page);
    await goToDocuments(page);

    await page.locator('label.upload-btn input[type="file"]').setInputFiles({
      name: 'annule.txt', mimeType: 'text/plain', buffer: Buffer.from('x'),
    });
    await expect(page.locator('.meta-panel')).toBeVisible({ timeout: 5_000 });

    await page.locator('.meta-panel button').filter({ hasText: /annuler/i }).click();

    await expect(page.locator('.meta-panel')).not.toBeVisible({ timeout: 3_000 });
  });

  // ──────────────────────────────────────────────────────────
  // DOC-9 : Upload Non classé → doc ajouté au tableau
  // ──────────────────────────────────────────────────────────
  test('DOC-9 — upload Non classé : document apparaît dans le tableau', async ({ page }) => {
    await loginViaApi(page);
    await goToDocuments(page);

    const uniqueName = `sans-type-${Date.now()}.txt`;

    await page.locator('label.upload-btn input[type="file"]').setInputFiles({
      name: uniqueName, mimeType: 'text/plain', buffer: Buffer.from('contenu'),
    });
    await expect(page.locator('.meta-panel')).toBeVisible({ timeout: 5_000 });

    await page.locator('.meta-panel button').filter({ hasText: /importer/i }).click();
    await expect(page.locator('.meta-panel')).not.toBeVisible({ timeout: 8_000 });

    // Vérifier que le fichier apparaît dans le tableau
    await expect(page.locator('app-data-table').getByText(uniqueName)).toBeVisible({ timeout: 12_000 });
  });

  // ──────────────────────────────────────────────────────────
  // DOC-10 : Upload Facture achat + Janvier 2024 → badge Achat + période
  // ──────────────────────────────────────────────────────────
  test('DOC-10 — upload Facture achat avec période : badge et mois affichés', async ({ page }) => {
    await loginViaApi(page);
    await goToDocuments(page);

    await page.locator('label.upload-btn input[type="file"]').setInputFiles({
      name: 'facture-jan.txt', mimeType: 'text/plain', buffer: Buffer.from('facture janvier'),
    });
    await expect(page.locator('.meta-panel')).toBeVisible({ timeout: 5_000 });

    // Choisir Facture achat
    await page.locator('.meta-panel mat-select').first().click();
    await page.waitForTimeout(300);
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: /facture achat/i }).first().click();
    await page.waitForTimeout(500);

    // Choisir Janvier
    await expect(page.locator('.meta-mois-ff')).toBeVisible({ timeout: 3_000 });
    await page.locator('.meta-mois-ff mat-select').click();
    await page.waitForTimeout(300);
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: 'Janvier' }).first().click();
    await page.waitForTimeout(300);

    // Corriger l'année à 2024
    const anneeInput = page.locator('.meta-annee-ff input');
    await anneeInput.fill('2024');
    await page.waitForTimeout(200);

    // Importer
    await page.locator('.meta-panel button').filter({ hasText: /importer/i }).click();
    await expect(page.locator('.meta-panel')).not.toBeVisible({ timeout: 8_000 });

    // Badge "Achat" et période "Janvier 2024" dans le tableau
    await expect(page.locator('.doc-badge--achat').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.doc-period').filter({ hasText: /janvier.*2024/i }).first()).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────
  // DOC-11 : Suppression d'un document
  // ──────────────────────────────────────────────────────────
  test('DOC-11 — supprimer un document retire la ligne du tableau', async ({ page }) => {
    // Créer un document via API pour avoir quelque chose à supprimer
    const api = await pwRequest.newContext();
    const t = await getToken(api);
    const content = Buffer.from('a supprimer');
    await api.post(`${API_URL}/clients/${CLIENT_ID}/documents/upload`, {
      headers: authHeaders(t),
      multipart: { file: { name: 'delete-me.txt', mimeType: 'text/plain', buffer: content } },
    });
    await api.dispose();

    await loginViaApi(page);
    await goToDocuments(page);

    const countBefore = await page.locator('app-data-table tbody tr').count();
    expect(countBefore).toBeGreaterThan(0);

    // Cliquer sur le premier bouton supprimer
    await page.locator('app-data-table button[mattooltip="Supprimer"]').first().click();

    // Confirmer dans la dialog
    const confirmBtn = page.locator('mat-dialog-container button').filter({ hasText: /confirm|ok|oui|supprim/i });
    if (await confirmBtn.count() > 0) await confirmBtn.first().click();

    await expect(page.locator('app-data-table tbody tr')).toHaveCount(countBefore - 1, { timeout: 8_000 });
  });
});
