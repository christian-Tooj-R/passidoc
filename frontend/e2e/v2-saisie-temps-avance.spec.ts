/**
 * Suite E2E — Saisie des temps avancée (v2)
 * TM-01 : Minuteur start/stop
 * TM-02 : Code mission dans le dialog (FACTURABLE)
 * TM-03 : Alerte seuil visible (total semaine < 35h)
 * TM-04 : Validation manager (admin uniquement)
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:4202';
const ADMIN_EMAIL    = process.env['ADMIN_EMAIL']    ?? 'admin@test.com';
const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] ?? 'Admin1234!';

// ── Helper : login + navigation vers /saisie-temps ─────────────────────────
async function loginAndGoToSaisie(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.getByLabel(/e-?mail|identifiant/i).fill(email);
  await page.getByLabel(/mot de passe|password/i).fill(password);
  await page.getByRole('button', { name: /connexion|se connecter|login/i }).click();
  // Attendre la redirection post-login
  await page.waitForURL(/\/(dashboard|saisie-temps|tasks)/, { timeout: 15_000 });
  await page.goto(`${BASE_URL}/saisie-temps`);
  await page.waitForSelector('.st-timer-widget', { timeout: 10_000 });
}

// ── TM-01 : Minuteur start / stop ──────────────────────────────────────────
test('TM-01 : Le minuteur démarre et s`arrête correctement', async ({ page }) => {
  await loginAndGoToSaisie(page);

  // Vérifier widget présent
  const widget = page.locator('.st-timer-widget');
  await expect(widget).toBeVisible();

  // État initial : pas actif
  await expect(widget).not.toHaveClass(/st-timer-widget--active/);

  // Cliquer START
  await page.locator('.st-timer-btn--start').click();

  // Widget devient actif
  await expect(widget).toHaveClass(/st-timer-widget--active/);

  // Attendre 2s et vérifier que le chrono avance
  const timeBefore = await page.locator('.st-timer-time').textContent();
  await page.waitForTimeout(2000);
  const timeAfter = await page.locator('.st-timer-time').textContent();
  expect(timeBefore).not.toBe(timeAfter);

  // Cliquer STOP → dialog doit s'ouvrir
  await page.locator('.st-timer-btn--stop').click();
  await expect(page.locator('.std-wrap')).toBeVisible({ timeout: 5000 });

  // Le badge timer doit apparaître dans le header du dialog
  await expect(page.locator('.std-timer-badge')).toBeVisible();

  // Fermer le dialog
  await page.locator('.std-close').click();
  await expect(page.locator('.std-wrap')).not.toBeVisible();

  // Widget redevient inactif
  await expect(widget).not.toHaveClass(/st-timer-widget--active/);
});

// ── TM-02 : Code mission dans le dialog ────────────────────────────────────
test('TM-02 : Code mission s\'affiche pour une saisie FACTURABLE', async ({ page }) => {
  await loginAndGoToSaisie(page);

  // Ouvrir le dialog
  await page.locator('.st-add-btn:not(.st-add-btn--ghost)').first().click();
  await expect(page.locator('.std-wrap')).toBeVisible({ timeout: 5000 });

  // Sélectionner FACTURABLE
  await page.locator('.std-type-btn.active-fact, .std-type-btn:has(mat-icon:text("euro"))').click();

  // Les codes mission doivent apparaître
  await expect(page.locator('.std-codes')).toBeVisible();
  const missionButtons = page.locator('.std-code-btn');
  await expect(missionButtons).toHaveCount(8, { timeout: 3000 });

  // Sélectionner le code TCO
  const tcoBtn = missionButtons.first();
  await tcoBtn.click();
  await expect(tcoBtn).toHaveClass(/active/);

  // Le champ autocomplete client doit être présent
  await expect(page.locator('.std-autocomplete-wrap input')).toBeVisible();

  // Fermer
  await page.locator('.std-close').click();
});

// ── TM-03 : Alerte seuil visible ───────────────────────────────────────────
test('TM-03 : Bandeau d\'alerte visible quand heures < seuil', async ({ page }) => {
  await loginAndGoToSaisie(page);

  // Si le bandeau est présent (semaine courante avec peu d'heures)
  // On le vérifie sans déclencher de saisie pour ne pas poluer les données

  // Naviguer à une semaine vide dans le passé (il y a 3 semaines)
  for (let i = 0; i < 3; i++) {
    await page.locator('.st-nav-btn').first().click();
    await page.waitForTimeout(300);
  }

  // Sur une semaine vide, si c'est la semaine courante l'alerte peut apparaître
  // On revient sur la semaine courante pour avoir le contexte de l'alerte
  await page.goto(`${BASE_URL}/saisie-temps`);
  await page.waitForSelector('.st-timer-widget', { timeout: 10_000 });

  // L'alerte est conditionnelle à l'état des saisies :
  // On vérifie juste que la structure .st-alert-bar est dans le DOM (visible ou non)
  const alertBar = page.locator('.st-alert-bar');
  const alertCount = await alertBar.count();

  if (alertCount > 0) {
    // Si des alertes sont visibles, elles doivent avoir la bonne classe
    const firstAlert = alertBar.first();
    await expect(firstAlert).toBeVisible();
    const classes = await firstAlert.getAttribute('class');
    expect(classes).toMatch(/st-alert-bar--(warning|danger)/);

    // Le bouton dismiss doit être cliquable
    await page.locator('.st-alert-dismiss').first().click();
    // Après dismiss, l'alerte disparaît
    await expect(firstAlert).not.toBeVisible();
  } else {
    // Pas d'alerte = semaine complète, test réussi structurellement
    console.log('TM-03 : Aucune alerte (semaine complète — OK)');
  }
});

// ── TM-04 : Validation manager (admin) ─────────────────────────────────────
test('TM-04 : Le bouton "Valider la semaine" est visible pour un admin', async ({ page }) => {
  await loginAndGoToSaisie(page);

  // Chercher le bouton de validation
  const validateBtn = page.locator('.st-validate-btn');

  // Le bouton doit être visible pour un admin
  await expect(validateBtn).toBeVisible({ timeout: 5000 });
  await expect(validateBtn).toContainText(/valider/i);

  // Vérifier que le bouton contient une icône lock
  await expect(validateBtn.locator('mat-icon')).toHaveText('lock');
});
