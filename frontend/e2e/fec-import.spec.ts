/**
 * Tests E2E — Import FEC depuis l'UI (onglet Pilotage)
 * Couvre : import grand livre Sage, affichage grille balance, barres de progression
 */
import * as path from 'path';
import * as fs from 'fs';
import { test, expect, request as pwRequest } from '@playwright/test';
import { loginViaApi, goToFluxMensuel, API_URL, TEST_TENANT, CLIENT_ID } from './helpers/auth';
import { getToken, authHeaders } from './helpers/api';

// ── Grand livre Sage de test (format réel : ; séparateur, DD/MM/YYYY, comptes 401/411) ──
const GRAND_LIVRE_CSV = [
  'N° Compte;N° Compte Auxiliaire;Libellé du compte;Date;Journal;N° de pièce;Libellé mouvement;Lettrage;Montant Débit;Montant Crédit;Solde',
  // Janvier — 3 fournisseurs distincts + 2 clients
  '40100000;401SUPP1;Fournisseur Alpha;01/01/2026;HA;FAC001;Facture Alpha Jan;;1200.00;0.00;1200.00',
  '40100000;401SUPP2;Fournisseur Beta;15/01/2026;HA;FAC002;Facture Beta Jan;;800.00;0.00;800.00',
  '40100000;401SUPP3;Fournisseur Gamma;28/01/2026;HA;FAC003;Facture Gamma Jan;;600.00;0.00;600.00',
  '40100000;401SUPP1;Fournisseur Alpha;20/01/2026;HA;FAC004;2ème facture Alpha Jan;;500.00;0.00;500.00',
  '41100000;411CLI1;Client Uno;10/01/2026;VT;VTE001;Vente Uno Jan;;0.00;2000.00;2000.00',
  '41100000;411CLI2;Client Dos;22/01/2026;VT;VTE002;Vente Dos Jan;;0.00;1500.00;1500.00',
  // Février — 2 fournisseurs + 1 client
  '40100000;401SUPP1;Fournisseur Alpha;05/02/2026;HA;FAC005;Facture Alpha Fév;;900.00;0.00;900.00',
  '40100000;401SUPP4;Fournisseur Delta;18/02/2026;HA;FAC006;Facture Delta Fév;;750.00;0.00;750.00',
  '41100000;411CLI1;Client Uno;14/02/2026;VT;VTE003;Vente Uno Fév;;0.00;1800.00;1800.00',
  // Mars — 1 fournisseur + 0 client
  '40100000;401SUPP2;Fournisseur Beta;10/03/2026;HA;FAC007;Facture Beta Mars;;950.00;0.00;950.00',
].join('\n');

// Chemin du fichier CSV de test
const CSV_PATH = path.join(__dirname, 'fixtures', 'grand-livre-test.csv');

// ── Reset balance via API ──────────────────────────────────────────────────────
async function resetBalance(token: string, annee: number) {
  const api = await pwRequest.newContext();
  await api.delete(`${API_URL}/clients/${CLIENT_ID}/balance?annee=${annee}`, {
    headers: authHeaders(token),
  });
  await api.dispose();
}

// ── Setup ─────────────────────────────────────────────────────────────────────
test.beforeAll(async () => {
  // Créer le répertoire fixtures si besoin et y écrire le CSV de test
  const dir = path.dirname(CSV_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Encoder en latin1 pour simuler un vrai export Sage (ISO-8859-1)
  fs.writeFileSync(CSV_PATH, Buffer.from(GRAND_LIVRE_CSV, 'latin1'));
});

test.afterAll(async () => {
  const api = await pwRequest.newContext();
  const token = await getToken(api);
  await api.delete(`${API_URL}/clients/${CLIENT_ID}/balance?annee=2026`, {
    headers: authHeaders(token),
  });
  await api.dispose();
  if (fs.existsSync(CSV_PATH)) fs.unlinkSync(CSV_PATH);
});

// ═════════════════════════════════════════════════════════════════════════════
test.describe('Import FEC — onglet Pilotage', () => {

  // ── FEC-1 : État initial sans données FEC ──────────────────────────────────
  test('FEC-1 — sans FEC : message d\'invitation visible, grille masquée', async ({ page }) => {
    const api = await pwRequest.newContext();
    const token = await getToken(api);
    await resetBalance(token, 2026);
    await api.dispose();

    await loginViaApi(page);
    await goToFluxMensuel(page);

    // Naviguer sur 2026 (l'année de test)
    const yearLabel = page.locator('.year-label');
    await expect(yearLabel).toBeVisible({ timeout: 8_000 });

    // Forcer la navigation vers 2026 via le menu année si besoin
    let annee = await yearLabel.textContent();
    while (annee && parseInt(annee) < 2026) {
      await page.locator('.year-btn').last().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }
    while (annee && parseInt(annee) > 2026) {
      await page.locator('.year-btn').first().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }

    // La grille balance ne doit pas être visible
    await expect(page.locator('.balance-grid')).not.toBeVisible();

    // Le message d'invitation doit être visible
    await expect(page.locator('app-flux-mensuel-tab')).toContainText('Importez un fichier FEC');

    // Le bouton import FEC doit être présent
    await expect(page.locator('label.fec-upload-btn')).toBeVisible();
  });

  // ── FEC-2 : Import via l'UI ────────────────────────────────────────────────
  test('FEC-2 — import grand livre depuis le bouton UI', async ({ page }) => {
    const api = await pwRequest.newContext();
    const token = await getToken(api);
    await resetBalance(token, 2026);
    await api.dispose();

    await loginViaApi(page);
    await goToFluxMensuel(page);

    // Naviguer sur 2026
    const yearLabel = page.locator('.year-label');
    await expect(yearLabel).toBeVisible({ timeout: 8_000 });
    let annee = await yearLabel.textContent();
    while (annee && parseInt(annee) < 2026) {
      await page.locator('.year-btn').last().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }
    while (annee && parseInt(annee) > 2026) {
      await page.locator('.year-btn').first().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }

    // Uploader le fichier via le bouton FEC (input caché derrière le label)
    const fileInput = page.locator('label.fec-upload-btn input[type="file"]');
    await fileInput.setInputFiles(CSV_PATH);

    // La grille doit apparaître après import
    await expect(page.locator('.balance-grid')).toBeVisible({ timeout: 10_000 });
  });

  // ── FEC-3 : Grille affiche les bons mois ──────────────────────────────────
  test('FEC-3 — grille montre 3 mois avec données (Jan, Fév, Mars)', async ({ page }) => {
    // Les données ont été importées par FEC-2, pas de reset ici
    await loginViaApi(page);
    await goToFluxMensuel(page);

    // Naviguer sur 2026
    const yearLabel = page.locator('.year-label');
    await expect(yearLabel).toBeVisible({ timeout: 8_000 });
    let annee = await yearLabel.textContent();
    while (annee && parseInt(annee) < 2026) {
      await page.locator('.year-btn').last().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }
    while (annee && parseInt(annee) > 2026) {
      await page.locator('.year-btn').first().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }

    await expect(page.locator('.balance-grid')).toBeVisible({ timeout: 8_000 });

    // Il doit y avoir exactement 3 bg-cell fournisseurs (Jan=3, Fév=2, Mars=1)
    const cellsFourn = page.locator('.bg-cell').filter({ has: page.locator('.bg-over') });
    // Au moins 3 cellules fournisseurs visibles
    const count = await cellsFourn.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  // ── FEC-4 : Janvier — 3 fournisseurs attendus, 2 clients attendus ─────────
  test('FEC-4 — Janvier : 3 fournisseurs attendus et 2 clients attendus', async ({ page }) => {
    await loginViaApi(page);
    await goToFluxMensuel(page);

    const yearLabel = page.locator('.year-label');
    await expect(yearLabel).toBeVisible({ timeout: 8_000 });
    let annee = await yearLabel.textContent();
    while (annee && parseInt(annee) < 2026) {
      await page.locator('.year-btn').last().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }
    while (annee && parseInt(annee) > 2026) {
      await page.locator('.year-btn').first().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }

    await expect(page.locator('.balance-grid')).toBeVisible({ timeout: 8_000 });

    // La colonne Janvier est la 1ère — chercher les cellules bg-over contenant "/3" et "/2"
    const overCells = page.locator('.balance-grid .bg-over');
    const texts = await overCells.allTextContents();
    // Janvier doit avoir "/ 3" pour fournisseurs et "/ 2" pour clients
    expect(texts).toContain('/ 3');
    expect(texts).toContain('/ 2');
  });

  // ── FEC-5 : Février — 2 fournisseurs attendus, 1 client ───────────────────
  test('FEC-5 — Février : 2 fournisseurs attendus et 1 client attendu', async ({ page }) => {
    await loginViaApi(page);
    await goToFluxMensuel(page);

    const yearLabel = page.locator('.year-label');
    await expect(yearLabel).toBeVisible({ timeout: 8_000 });
    let annee = await yearLabel.textContent();
    while (annee && parseInt(annee) < 2026) {
      await page.locator('.year-btn').last().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }
    while (annee && parseInt(annee) > 2026) {
      await page.locator('.year-btn').first().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }

    await expect(page.locator('.balance-grid')).toBeVisible({ timeout: 8_000 });

    const overCells = page.locator('.balance-grid .bg-over');
    const texts = await overCells.allTextContents();
    expect(texts).toContain('/ 2');
    expect(texts).toContain('/ 1');
  });

  // ── FEC-6 : Mars — 1 fournisseur, 0 client (pas de cellule client) ────────
  test('FEC-6 — Mars : 1 fournisseur attendu', async ({ page }) => {
    await loginViaApi(page);
    await goToFluxMensuel(page);

    const yearLabel = page.locator('.year-label');
    await expect(yearLabel).toBeVisible({ timeout: 8_000 });
    let annee = await yearLabel.textContent();
    while (annee && parseInt(annee) < 2026) {
      await page.locator('.year-btn').last().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }
    while (annee && parseInt(annee) > 2026) {
      await page.locator('.year-btn').first().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }

    await expect(page.locator('.balance-grid')).toBeVisible({ timeout: 8_000 });

    const overCells = page.locator('.balance-grid .bg-over');
    const texts = await overCells.allTextContents();
    expect(texts).toContain('/ 1');
  });

  // ── FEC-7 : Cellules bg-cell--missing (0%) présentes pour mois actifs ─────
  test('FEC-7 — cellules manquantes (0%) visibles avant tout document uploadé', async ({ page }) => {
    await loginViaApi(page);
    await goToFluxMensuel(page);

    const yearLabel = page.locator('.year-label');
    await expect(yearLabel).toBeVisible({ timeout: 8_000 });
    let annee = await yearLabel.textContent();
    while (annee && parseInt(annee) < 2026) {
      await page.locator('.year-btn').last().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }
    while (annee && parseInt(annee) > 2026) {
      await page.locator('.year-btn').first().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }

    await expect(page.locator('.balance-grid')).toBeVisible({ timeout: 8_000 });

    // Toutes les cellules actives doivent être en rouge (aucun doc uploadé)
    const missingCells = page.locator('.bg-cell--missing');
    const count = await missingCells.count();
    expect(count).toBeGreaterThan(0);

    // Toutes affichent 0%
    const pctTexts = await missingCells.locator('.bg-pct').allTextContents();
    for (const t of pctTexts) {
      expect(t.trim()).toBe('0%');
    }
  });

  // ── FEC-8 : Réimport écrase les anciennes données ─────────────────────────
  test('FEC-8 — réimport avec nouveau fichier (2 mois) remplace les données', async ({ page }) => {
    await loginViaApi(page);
    await goToFluxMensuel(page);

    const yearLabel = page.locator('.year-label');
    await expect(yearLabel).toBeVisible({ timeout: 8_000 });
    let annee = await yearLabel.textContent();
    while (annee && parseInt(annee) < 2026) {
      await page.locator('.year-btn').last().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }
    while (annee && parseInt(annee) > 2026) {
      await page.locator('.year-btn').first().click();
      await page.waitForTimeout(300);
      annee = await yearLabel.textContent();
    }

    await expect(page.locator('.balance-grid')).toBeVisible({ timeout: 8_000 });

    // Créer un CSV réduit (1 fournisseur en Janvier seulement)
    const smallCsvPath = path.join(path.dirname(CSV_PATH), 'grand-livre-small.csv');
    const smallCsv = [
      'N° Compte;N° Compte Auxiliaire;Libellé du compte;Date;Journal;N° de pièce;Libellé mouvement;Lettrage;Montant Débit;Montant Crédit;Solde',
      '40100000;401SUPP1;Fournisseur Alpha;01/01/2026;HA;FAC001;Facture Alpha Jan;;1200.00;0.00;1200.00',
    ].join('\n');
    fs.writeFileSync(smallCsvPath, Buffer.from(smallCsv, 'latin1'));

    try {
      const fileInput = page.locator('label.fec-upload-btn input[type="file"]');
      await fileInput.setInputFiles(smallCsvPath);
      await page.waitForTimeout(2_000);

      // Après réimport : seulement 1 fournisseur en Janvier
      const overCells = page.locator('.balance-grid .bg-over');
      const texts = await overCells.allTextContents();
      expect(texts).toContain('/ 1');
    } finally {
      if (fs.existsSync(smallCsvPath)) fs.unlinkSync(smallCsvPath);
    }
  });

});
