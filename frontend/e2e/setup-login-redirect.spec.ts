import { test, expect, Page } from '@playwright/test';

/**
 * Accès au login depuis la landing page /setup : l'identifiant du cabinet se saisit dans la
 * fenêtre « Se connecter » (bouton de la barre de navigation) — refonte de la landing.
 */
const champ  = (page: Page) => page.locator('.lp-modal__input');
const valider = (page: Page) => page.locator('.lp-modal .lp-btn--primary');
const erreur = (page: Page) => page.locator('.lp-modal__error');

async function ouvrirConnexion(page: Page) {
  await page.locator('.lp-btn--outline', { hasText: 'Se connecter' }).click();
  await expect(champ(page)).toBeVisible();
}

test.describe('Setup — accès login depuis la landing page', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4200/setup');
    await page.waitForLoadState('networkidle');
  });

  test('arriver sur /setup efface le tenant_slug du localStorage', async ({ page }) => {
    // Simuler un ancien browser avec tenant_slug déjà en localStorage
    await page.evaluate(() => localStorage.setItem('tenant_slug', 'ancien-cabinet'));
    await page.goto('http://localhost:4200/setup');
    await page.waitForLoadState('networkidle');

    const slug = await page.evaluate(() => localStorage.getItem('tenant_slug'));
    expect(slug).toBeNull();
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
    await expect(page.locator('.lp-btn--outline', { hasText: 'Se connecter' })).toBeVisible();
  });

  test('le champ "identifiant" est proposé dans la fenêtre Se connecter', async ({ page }) => {
    await ouvrirConnexion(page);
    await expect(champ(page)).toHaveAttribute('placeholder', 'Identifiant de votre cabinet');
  });

  test('cliquer "Continuer" sans slug affiche un message d\'erreur', async ({ page }) => {
    await ouvrirConnexion(page);
    await valider(page).click();
    await expect(erreur(page)).toBeVisible();
    await expect(erreur(page)).toContainText('Entrez l\'identifiant de votre cabinet');
  });

  test('taper Entrée sans slug affiche un message d\'erreur', async ({ page }) => {
    await ouvrirConnexion(page);
    await champ(page).press('Enter');
    await expect(erreur(page)).toBeVisible();
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

    await ouvrirConnexion(page);
    await champ(page).fill('afym');
    await valider(page).click();

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

    await ouvrirConnexion(page);
    await champ(page).fill('cabinet-inconnu');
    await valider(page).click();

    // Doit rester sur /setup
    await expect(page).toHaveURL(/\/setup/);
    // Doit afficher un message mentionnant le slug
    const error = erreur(page);
    await expect(error).toBeVisible({ timeout: 5000 });
    await expect(error).toContainText('cabinet-inconnu');
    await expect(error).toContainText('pas encore inscrit');
  });

  test('erreur réseau affiche un message de connexion', async ({ page }) => {
    await page.route('**/api/setup/status', async route => {
      await route.abort('failed');
    });

    await ouvrirConnexion(page);
    await champ(page).fill('afym');
    await valider(page).click();

    const error = erreur(page);
    await expect(error).toBeVisible({ timeout: 5000 });
    await expect(error).toContainText('Impossible de joindre');
  });

  test('le localStorage n\'est PAS écrit depuis la landing page (seulement après login)', async ({ page }) => {
    await page.route('**/api/setup/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: true }),
      });
    });

    await page.evaluate(() => localStorage.removeItem('tenant_slug'));
    await ouvrirConnexion(page);
    await champ(page).fill('afym');
    await valider(page).click();

    // localStorage ne doit pas être écrit avant le login
    const storedSlug = await page.evaluate(() => localStorage.getItem('tenant_slug'));
    expect(storedSlug).toBeNull();
  });
});
