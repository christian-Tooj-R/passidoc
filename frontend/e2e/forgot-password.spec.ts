import { test, expect } from '@playwright/test';

/**
 * Tests E2E — Mot de passe oublié
 * Flux complet : lien sur login → saisie email → saisie code → succès
 */
test.describe('Mot de passe oublié', () => {

  test.beforeEach(async ({ page }) => {
    // Simuler un tenant configuré pour accéder à /auth/login
    await page.route('**/api/setup/status', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ configured: true }) }),
    );
    await page.evaluate(() => localStorage.setItem('tenant_slug', 'afym-audit-expertise'));
    await page.goto('http://localhost:4200/auth/login');
    await page.waitForLoadState('networkidle');
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  test('le lien "Mot de passe oublié ?" est visible sur la page login', async ({ page }) => {
    const link = page.getByRole('button', { name: /mot de passe oublié/i });
    await expect(link).toBeVisible();
  });

  test('cliquer sur "Mot de passe oublié ?" navigue vers /auth/forgot-password', async ({ page }) => {
    await page.getByRole('button', { name: /mot de passe oublié/i }).click();
    await expect(page).toHaveURL(/\/auth\/forgot-password/);
  });

  test('la page forgot-password affiche le formulaire email', async ({ page }) => {
    await page.goto('http://localhost:4200/auth/forgot-password');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: /mot de passe oublié/i })).toBeVisible();
    await expect(page.getByLabel(/adresse email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /envoyer le code/i })).toBeVisible();
  });

  test('le lien "Retour à la connexion" ramène sur /auth/login', async ({ page }) => {
    await page.goto('http://localhost:4200/auth/forgot-password');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /retour à la connexion/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  // ── Étape 1 : saisie email ──────────────────────────────────────────────────

  test('soumettre un email invalide affiche une erreur de validation', async ({ page }) => {
    await page.goto('http://localhost:4200/auth/forgot-password');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/adresse email/i).fill('pas-un-email');
    await page.getByLabel(/adresse email/i).blur();

    await expect(page.getByText(/email invalide/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /envoyer le code/i })).toBeDisabled();
  });

  test('email valide → appel API et passage à l\'étape code', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Si cet email existe, un code vous a été envoyé.' }) }),
    );

    await page.goto('http://localhost:4200/auth/forgot-password');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/adresse email/i).fill('aro@afym.eu');
    await page.getByRole('button', { name: /envoyer le code/i }).click();

    // Doit passer à l'étape 2
    await expect(page.getByRole('heading', { name: /vérification/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/aro@afym\.eu/)).toBeVisible();
  });

  test('erreur serveur sur /forgot-password affiche un message d\'erreur', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', route =>
      route.abort('failed'),
    );

    await page.goto('http://localhost:4200/auth/forgot-password');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/adresse email/i).fill('aro@afym.eu');
    await page.getByRole('button', { name: /envoyer le code/i }).click();

    await expect(page.getByText(/impossible de contacter/i)).toBeVisible({ timeout: 5000 });
  });

  // ── Étape 2 : saisie code + nouveau mot de passe ───────────────────────────

  test('un code de moins de 6 chiffres désactive le bouton', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'ok' }) }),
    );

    await page.goto('http://localhost:4200/auth/forgot-password');
    await page.waitForLoadState('networkidle');
    await page.getByLabel(/adresse email/i).fill('aro@afym.eu');
    await page.getByRole('button', { name: /envoyer le code/i }).click();
    await expect(page.getByRole('heading', { name: /vérification/i })).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/code de vérification/i).fill('123');
    await page.getByLabel(/nouveau mot de passe/i).fill('NouveauMdp123!');
    await expect(page.getByRole('button', { name: /réinitialiser/i })).toBeDisabled();
  });

  test('un mot de passe trop court désactive le bouton', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'ok' }) }),
    );

    await page.goto('http://localhost:4200/auth/forgot-password');
    await page.waitForLoadState('networkidle');
    await page.getByLabel(/adresse email/i).fill('aro@afym.eu');
    await page.getByRole('button', { name: /envoyer le code/i }).click();
    await expect(page.getByRole('heading', { name: /vérification/i })).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/code de vérification/i).fill('123456');
    await page.getByLabel(/nouveau mot de passe/i).fill('court');
    await expect(page.getByRole('button', { name: /réinitialiser/i })).toBeDisabled();
  });

  test('code valide + nouveau mdp → succès', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'ok' }) }),
    );
    await page.route('**/api/auth/reset-password', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Mot de passe réinitialisé avec succès.' }) }),
    );

    await page.goto('http://localhost:4200/auth/forgot-password');
    await page.waitForLoadState('networkidle');
    await page.getByLabel(/adresse email/i).fill('aro@afym.eu');
    await page.getByRole('button', { name: /envoyer le code/i }).click();
    await expect(page.getByRole('heading', { name: /vérification/i })).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/code de vérification/i).fill('123456');
    await page.getByLabel(/nouveau mot de passe/i).fill('NouveauMdp123!');
    await page.getByRole('button', { name: /réinitialiser/i }).click();

    // Étape succès
    await expect(page.getByRole('heading', { name: /mot de passe réinitialisé/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /se connecter/i })).toBeVisible();
  });

  test('code invalide affiche le message d\'erreur du serveur', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'ok' }) }),
    );
    await page.route('**/api/auth/reset-password', route =>
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Code invalide ou expiré' }) }),
    );

    await page.goto('http://localhost:4200/auth/forgot-password');
    await page.waitForLoadState('networkidle');
    await page.getByLabel(/adresse email/i).fill('aro@afym.eu');
    await page.getByRole('button', { name: /envoyer le code/i }).click();
    await expect(page.getByRole('heading', { name: /vérification/i })).toBeVisible({ timeout: 5000 });

    await page.getByLabel(/code de vérification/i).fill('000000');
    await page.getByLabel(/nouveau mot de passe/i).fill('NouveauMdp123!');
    await page.getByRole('button', { name: /réinitialiser/i }).click();

    await expect(page.getByText(/code invalide ou expiré/i)).toBeVisible({ timeout: 5000 });
    // Doit rester sur l'étape code, pas passer au succès
    await expect(page.getByRole('heading', { name: /vérification/i })).toBeVisible();
  });

  // ── Étape 2 : navigation ────────────────────────────────────────────────────

  test('"Changer d\'email" revient à l\'étape 1 et vide le formulaire code', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'ok' }) }),
    );

    await page.goto('http://localhost:4200/auth/forgot-password');
    await page.waitForLoadState('networkidle');
    await page.getByLabel(/adresse email/i).fill('aro@afym.eu');
    await page.getByRole('button', { name: /envoyer le code/i }).click();
    await expect(page.getByRole('heading', { name: /vérification/i })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /changer d.email/i }).click();

    await expect(page.getByRole('heading', { name: /mot de passe oublié/i })).toBeVisible();
    await expect(page.getByLabel(/adresse email/i)).toBeVisible();
  });

  // ── Étape 3 : succès ────────────────────────────────────────────────────────

  test('bouton "Se connecter" sur l\'écran succès redirige vers /auth/login', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'ok' }) }),
    );
    await page.route('**/api/auth/reset-password', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'ok' }) }),
    );

    await page.goto('http://localhost:4200/auth/forgot-password');
    await page.waitForLoadState('networkidle');
    await page.getByLabel(/adresse email/i).fill('aro@afym.eu');
    await page.getByRole('button', { name: /envoyer le code/i }).click();
    await expect(page.getByRole('heading', { name: /vérification/i })).toBeVisible({ timeout: 5000 });
    await page.getByLabel(/code de vérification/i).fill('123456');
    await page.getByLabel(/nouveau mot de passe/i).fill('NouveauMdp123!');
    await page.getByRole('button', { name: /réinitialiser/i }).click();
    await expect(page.getByRole('heading', { name: /mot de passe réinitialisé/i })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /se connecter/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
