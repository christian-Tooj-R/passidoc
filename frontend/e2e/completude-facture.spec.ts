import { test, expect, request } from '@playwright/test';
import { loginViaApi, goToFluxMensuel, goToDocuments, API_URL, CLIENT_ID, TEST_TENANT } from './helpers/auth';
import { getToken, importFec, uploadTaggedDoc, getBalance, resetTestData, authHeaders } from './helpers/api';
import * as path from 'path';
import * as fs from 'fs';

// ── Helpers ──────────────────────────────────────────────────────────────────

const ANNEE = 2024;

test.describe('Complétude Facture — Tests API', () => {
  let api: Awaited<ReturnType<typeof request.newContext>>;
  let token: string;

  test.beforeAll(async () => {
    api = await request.newContext();
    token = await getToken(api);
    // Supprime tous les documents (réinitialise les nbRecu à 0 automatiquement)
    await resetTestData(api, token);
    // Note: la balance_mensuelle est purgée via un endpoint dédié si disponible,
    // sinon le FEC upsert réécrit les attendus et les reçus viennent des documents
  });

  test.afterAll(async () => {
    await resetTestData(api, token);
    await api.dispose();
  });

  // ── 1. FEC Import ────────────────────────────────────────────────────────

  test('1.1 — Import FEC : retourne les périodes importées', async () => {
    const result = await importFec(api, token);
    expect(result.imported).toBeGreaterThan(0);
    expect(result.annee).toBe(ANNEE);
  });

  test('1.2 — Balance après FEC : nbFournisseursAttendu et nbClientsAttendu remplis', async () => {
    const balance = await getBalance(api, token, ANNEE);
    const jan = balance.find((m: any) => m.mois === 1);
    const fev = balance.find((m: any) => m.mois === 2);

    expect(jan).toBeDefined();
    expect(jan.nbFournisseursAttendu).toBeGreaterThan(0);
    expect(jan.nbClientsAttendu).toBeGreaterThan(0);
    expect(fev).toBeDefined();
    expect(fev.nbFournisseursAttendu).toBeGreaterThan(0);

    // Avant tout upload de document, reçus = 0
    expect(jan.nbFournisseursRecu).toBe(0);
    expect(jan.nbClientsRecu).toBe(0);
  });

  test('1.3 — Balance après FEC : taux = 0% sans documents', async () => {
    const balance = await getBalance(api, token, ANNEE);
    const moisActifs = balance.filter((m: any) => m.nbFournisseursAttendu > 0);
    for (const m of moisActifs) {
      expect(m.tauxFournisseurs).toBe(0);
      expect(m.tauxClients).toBe(0);
    }
  });

  // ── 2. Upload de documents taggués ───────────────────────────────────────

  test('2.1 — Upload facture achat Jan 2024 : document créé avec métadonnées', async () => {
    const id = await uploadTaggedDoc(api, token, {
      typeDoc: 'FACTURE_ACHAT',
      periodeMois: 1,
      periodeAnnee: ANNEE,
    });
    expect(id).toBeGreaterThan(0);

    // Vérifier que le document apparaît dans la liste avec les bons champs
    const docsRes = await api.get(`${API_URL}/clients/${CLIENT_ID}/documents`, {
      headers: authHeaders(token),
    });
    const docs = await docsRes.json();
    const doc = docs.find((d: any) => d.id === id);
    expect(doc).toBeDefined();
    expect(doc.typeDoc).toBe('FACTURE_ACHAT');
    expect(doc.periodeMois).toBe(1);
    expect(doc.periodeAnnee).toBe(ANNEE);
  });

  test('2.2 — Upload facture vente Jan 2024 : document créé', async () => {
    const id = await uploadTaggedDoc(api, token, {
      typeDoc: 'FACTURE_VENTE',
      periodeMois: 1,
      periodeAnnee: ANNEE,
    });
    expect(id).toBeGreaterThan(0);
  });

  test('2.3 — Upload 2 factures achat Fév 2024', async () => {
    await uploadTaggedDoc(api, token, { typeDoc: 'FACTURE_ACHAT', periodeMois: 2, periodeAnnee: ANNEE });
    await uploadTaggedDoc(api, token, { typeDoc: 'FACTURE_ACHAT', periodeMois: 2, periodeAnnee: ANNEE });
  });

  // ── 3. Calcul automatique nbRecu ─────────────────────────────────────────

  test('3.1 — Balance Jan : 1 facture achat reçue, 1 vente reçue', async () => {
    const balance = await getBalance(api, token, ANNEE);
    const jan = balance.find((m: any) => m.mois === 1);
    expect(jan.nbFournisseursRecu).toBe(1);
    expect(jan.nbClientsRecu).toBe(1);
  });

  test('3.2 — Balance Fév : 2 factures achat reçues', async () => {
    const balance = await getBalance(api, token, ANNEE);
    const fev = balance.find((m: any) => m.mois === 2);
    expect(fev.nbFournisseursRecu).toBe(2);
    expect(fev.nbClientsRecu).toBe(0);
  });

  test('3.3 — Taux calculé correctement', async () => {
    const balance = await getBalance(api, token, ANNEE);
    const jan = balance.find((m: any) => m.mois === 1);
    // jan: 1 achat reçu / nbFournisseursAttendu attendu
    const expectedTauxF = Math.round((1 / jan.nbFournisseursAttendu) * 100);
    expect(jan.tauxFournisseurs).toBe(expectedTauxF);
    const expectedTauxC = Math.round((1 / jan.nbClientsAttendu) * 100);
    expect(jan.tauxClients).toBe(expectedTauxC);
  });

  test('3.4 — Document non taggué (sans typeDoc) n\'influence pas le taux', async () => {
    const beforeBalance = await getBalance(api, token, ANNEE);
    const janBefore = beforeBalance.find((m: any) => m.mois === 1);

    // Upload sans typeDoc
    const content = Buffer.from('document sans tag');
    await api.post(`${API_URL}/clients/${CLIENT_ID}/documents/upload`, {
      headers: authHeaders(token),
      multipart: { file: { name: 'sans_tag.txt', mimeType: 'text/plain', buffer: content } },
    });

    const afterBalance = await getBalance(api, token, ANNEE);
    const janAfter = afterBalance.find((m: any) => m.mois === 1);
    // Le reçu ne doit pas changer
    expect(janAfter.nbFournisseursRecu).toBe(janBefore.nbFournisseursRecu);
    expect(janAfter.nbClientsRecu).toBe(janBefore.nbClientsRecu);
  });

  test('3.5 — Document autre année n\'influence pas la balance 2024', async () => {
    const beforeBalance = await getBalance(api, token, ANNEE);
    const janBefore = beforeBalance.find((m: any) => m.mois === 1);

    await uploadTaggedDoc(api, token, { typeDoc: 'FACTURE_ACHAT', periodeMois: 1, periodeAnnee: 2023 });

    const afterBalance = await getBalance(api, token, ANNEE);
    const janAfter = afterBalance.find((m: any) => m.mois === 1);
    expect(janAfter.nbFournisseursRecu).toBe(janBefore.nbFournisseursRecu);
  });

  test('3.6 — Import FEC nouvelle année ne perturbe pas 2024', async () => {
    // Créer un mini FEC 2023
    const fec2023 = Buffer.from(`JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|PieceRef|PieceDate|EcritureLib|Debit|Credit
AC|ACHATS|FAC999|20230301|401FOUR999|Fournisseur|FINV-999|20230301|Facture 2023|100.00|0.00
`, 'utf-8');
    const res = await api.post(
      `${API_URL}/clients/${CLIENT_ID}/balance/import-fec?annee=2023`,
      {
        headers: authHeaders(token),
        multipart: { fec: { name: 'fec2023.txt', mimeType: 'text/plain', buffer: fec2023 } },
      },
    );
    expect(res.ok()).toBeTruthy();

    // La balance 2024 reste inchangée
    const balance2024 = await getBalance(api, token, ANNEE);
    const jan = balance2024.find((m: any) => m.mois === 1);
    expect(jan.nbFournisseursAttendu).toBeGreaterThan(0);
    expect(jan.nbFournisseursRecu).toBeGreaterThan(0);
  });
});

// ── Tests UI avec Playwright ─────────────────────────────────────────────────

test.describe('Complétude Facture — Interface utilisateur', () => {
  // Crée un fichier FEC temporaire pour les tests UI
  const fecPath = path.join('/tmp', 'test_ui_fec.txt');

  test.beforeAll(async () => {
    fs.writeFileSync(fecPath, `JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|PieceRef|PieceDate|EcritureLib|Debit|Credit
AC|ACHATS|FAC001|20240115|401FOUR001|Fournisseur 1|FINV-001|20240115|Facture achat Jan|1000.00|0.00
AC|ACHATS|FAC002|20240120|401FOUR002|Fournisseur 2|FINV-002|20240120|Facture 2|500.00|0.00
VT|VENTES|VTE001|20240118|411CLI001|Client 1|VINV-001|20240118|Facture vente Jan|0.00|2000.00
AC|ACHATS|FAC003|20240215|401FOUR001|Fournisseur 1|FINV-003|20240215|Facture Fev|800.00|0.00
VT|VENTES|VTE002|20240220|411CLI002|Client 2|VINV-002|20240220|Vente Fev|0.00|1500.00
`);
  });

  test.afterAll(async () => {
    try { fs.unlinkSync(fecPath); } catch { /* silent */ }
  });

  test('UI-1 — Login via URL tenant redirige vers le tableau de bord', async ({ page }) => {
    await loginViaApi(page);
    await page.goto(`http://localhost:4200/dashboard?tenant=${TEST_TENANT}`);
    await page.waitForLoadState('networkidle');
    // L'utilisateur doit voir le dashboard et non le setup
    await expect(page).not.toHaveURL(/\/setup/);
    await expect(page.locator('body')).not.toContainText('Configuration initiale');
  });

  test('UI-2 — Onglet Flux mensuel : section Balance visible', async ({ page }) => {
    await loginViaApi(page);
    await goToFluxMensuel(page);
    // La section balance doit exister
    const balanceSection = page.locator('.balance-section');
    await expect(balanceSection).toBeVisible({ timeout: 10_000 });
    // Label d'import FEC présent (c'est un <label> avec input[type=file])
    await expect(page.locator('.fec-upload-btn')).toBeVisible();
  });

  test('UI-3 — Import FEC : tableau de balance se remplit', async ({ page }) => {
    await loginViaApi(page);
    await goToFluxMensuel(page);

    // Naviguer à l'année 2024 si nécessaire
    const yearLabel = page.locator('.year-label');
    const currentYear = await yearLabel.textContent();
    if (currentYear?.trim() !== '2024') {
      // Clique sur chevron_left jusqu'à arriver à 2024
      while ((await yearLabel.textContent())?.trim() !== '2024') {
        await page.locator('.year-btn').first().click();
        await page.waitForTimeout(200);
      }
    }

    // Importer le FEC (label avec input[type=file] caché)
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('.fec-upload-btn').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fecPath);

    // Attendre que le tableau se charge
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Vérifier que des cellules de balance sont visibles (bg-cell)
    const bgCells = page.locator('.bg-cell');
    await expect(bgCells.first()).toBeVisible({ timeout: 8_000 });
    const count = await bgCells.count();
    expect(count).toBeGreaterThan(0);
  });

  test('UI-4 — Onglet Documents : panneau de qualification visible après sélection', async ({ page }) => {
    await loginViaApi(page);
    await goToDocuments(page);

    // Sélectionner un fichier
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('label.upload-btn').click();
    const fileChooser = await fileChooserPromise;

    // Créer un fichier temporaire
    const tmpFile = path.join('/tmp', 'test_doc.txt');
    fs.writeFileSync(tmpFile, 'Facture test');
    await fileChooser.setFiles(tmpFile);

    // Le panneau de qualification doit apparaître
    const metaPanel = page.locator('.meta-panel');
    await expect(metaPanel).toBeVisible({ timeout: 5_000 });

    // Le sélecteur de type doit être présent (mat-select dans le panel)
    await expect(page.locator('.meta-panel mat-select').first()).toBeVisible();

    fs.unlinkSync(tmpFile);
  });

  test('UI-5 — Upload document taggué : badge type affiché dans le tableau', async ({ page }) => {
    await loginViaApi(page);
    await goToDocuments(page);

    const tmpFile = path.join('/tmp', 'facture_achat.txt');
    fs.writeFileSync(tmpFile, 'Contenu facture achat');

    // Sélectionner le fichier
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('label.upload-btn').click();
    const fc = await fileChooserPromise;
    await fc.setFiles(tmpFile);

    // Le panneau de qualification doit apparaître
    const metaPanel = page.locator('.meta-panel');
    await expect(metaPanel).toBeVisible({ timeout: 5_000 });

    // Choisir type de document (1er mat-select dans le panel)
    const typeSelect = page.locator('.meta-panel mat-select').first();
    await typeSelect.click();
    // Attendre les options dans le CDK overlay
    await page.waitForSelector('.cdk-overlay-pane mat-option', { timeout: 5_000 });
    await page.locator('.cdk-overlay-pane mat-option').filter({ hasText: /facture achat/i }).click();
    // Attendre la fermeture du dropdown
    await page.waitForSelector('.cdk-overlay-pane mat-option', { state: 'detached', timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(400);

    // Ne pas sélectionner de mois (test badge type seul)
    // Confirmer l'upload
    await page.locator('.meta-panel__actions button[color="primary"]').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Le document doit apparaître avec le badge "Achat"
    await expect(page.locator('.doc-badge--achat').first()).toBeVisible({ timeout: 8_000 });

    fs.unlinkSync(tmpFile);
  });

  test('UI-6 — Balance : cellule Janvier montre nbFournisseursRecu > 0 après upload', async ({ page }) => {
    // D'abord uploader un document taggué via API pour que la balance se mette à jour
    const api2 = await request.newContext();
    const tok2 = await getToken(api2);
    // S'assurer qu'il y a un FEC importé pour 2024
    await importFec(api2, tok2);
    // Uploader une facture achat Jan 2024
    await uploadTaggedDoc(api2, tok2, { typeDoc: 'FACTURE_ACHAT', periodeMois: 1, periodeAnnee: ANNEE });
    await api2.dispose();

    await loginViaApi(page);
    await goToFluxMensuel(page);

    // Naviguer à 2024
    const yearLabel = page.locator('.year-label');
    let attempts = 0;
    while ((await yearLabel.textContent())?.trim() !== '2024' && attempts < 10) {
      await page.locator('.year-btn').first().click();
      await page.waitForTimeout(300);
      attempts++;
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // La première cellule active de la ligne Factures achats doit afficher une valeur > 0
    const firstBgCell = page.locator('tr.bg-row').first().locator('.bg-cell').first();
    await expect(firstBgCell).toBeVisible({ timeout: 8_000 });

    // La valeur reçue (bg-input-val) doit être >= 1
    const inputVal = firstBgCell.locator('.bg-input-val');
    const text = await inputVal.textContent();
    expect(Number(text?.trim())).toBeGreaterThanOrEqual(1);
  });

  test('UI-7 — Cellule balance est en lecture seule (pas d\'input éditable)', async ({ page }) => {
    await loginViaApi(page);
    await goToFluxMensuel(page);

    const yearLabel = page.locator('.year-label');
    while ((await yearLabel.textContent())?.trim() !== '2024') {
      await page.locator('.year-btn').first().click();
      await page.waitForTimeout(200);
    }

    await page.waitForTimeout(500);

    // Aucun input de type number ne doit être présent dans les cellules bg-cell
    const editableInputs = page.locator('.bg-cell input[type="number"]');
    await expect(editableInputs).toHaveCount(0);

    // Des spans bg-input-val doivent être présents à la place
    const readonlyVals = page.locator('.bg-cell .bg-input-val');
    const count = await readonlyVals.count();
    expect(count).toBeGreaterThan(0);
  });
});
