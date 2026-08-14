import { test, expect } from '@playwright/test';

/**
 * Tests du panneau "Cabinet déjà configuré ?" sur la page /setup
 */
test.describe('Setup — accès login depuis la landing page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4200/setup');
    await page.waitForLoadState('networkidle');
  });

  test('la landing page s\'affiche même si le tenant est déjà configuré', async ({ page }) => {
    // Simuler tenant configuré
    await page.route('**/api/setup/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: true }),
      });
    });
    await page.evaluate(() => localStorage.setItem('tenant_slug', 'afym'));
    await page.goto('http://localhost:4200/setup');
    await page.waitForLoadState('networkidle');

    // La landing doit s'afficher (pas de redirection vers /auth/login)
    await expect(page).toHaveURL(/\/setup/);
    await expect(page.locator('.wb-login__input')).toBeVisible();
  });

  test('le champ "identifiant" est visible sur la landing page', async ({ page }) => {
    const input = page.locator('.wb-login__input');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'identifiant de votre cabinet');
  });

  test('cliquer "Accéder" sans slug affiche un message d\'erreur', async ({ page }) => {
    await page.locator('.wb-login__btn').click();
    const error = page.locator('.wb-login__error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('Entrez l\'identifiant de votre cabinet');
  });

  test('taper Entrée sans slug affiche un message d\'erreur', async ({ page }) => {
    await page.locator('.wb-login__input').press('Enter');
    const error = page.locator('.wb-login__error');
    await expect(error).toBeVisible();
  });

  test('entrer un slug valide (afym) navigue vers /auth/login', async ({ page }) => {
    // Intercepter l'appel /setup/status pour simuler tenant configuré
    await page.route('**/api/setup/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: true }),
      });
    });

    await page.locator('.wb-login__input').fill('afym');
    await page.locator('.wb-login__btn').click();

    // Vérifier que l'URL change vers /auth/login
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 5000 });
  });

  test('slug inconnu affiche un message d\'erreur clair', async ({ page }) => {
    await page.route('**/api/setup/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: false }),
      });
    });

    await page.locator('.wb-login__input').fill('cabinet-inconnu');
    await page.locator('.wb-login__btn').click();

    // Doit rester sur /setup
    await expect(page).toHaveURL(/\/setup/);
    // Doit afficher un message mentionnant le slug
    const error = page.locator('.wb-login__error');
    await expect(error).toBeVisible({ timeout: 5000 });
    await expect(error).toContainText('cabinet-inconnu');
    await expect(error).toContainText('pas encore inscrit');
  });

  test('erreur réseau affiche un message de connexion', async ({ page }) => {
    await page.route('**/api/setup/status', async route => {
      await route.abort('failed');
    });

    await page.locator('.wb-login__input').fill('afym');
    await page.locator('.wb-login__btn').click();

    const error = page.locator('.wb-login__error');
    await expect(error).toBeVisible({ timeout: 5000 });
    await expect(error).toContainText('Impossible de joindre');
  });

  test('le localStorage est bien mis à jour avec le slug entré', async ({ page }) => {
    await page.route('**/api/setup/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: true }),
      });
    });

    await page.locator('.wb-login__input').fill('afym');
    await page.locator('.wb-login__btn').click();

    const storedSlug = await page.evaluate(() => localStorage.getItem('tenant_slug'));
    expect(storedSlug).toBe('afym');
  });
});
