import { test, expect } from '@playwright/test';

// Assistant IA "Mes temps" accessible depuis le module Travail (sans clientId dans l'URL).
// Compte e2e@test.com / Test1234! (ADMIN)

async function loginAndGoto(page: any, path: string) {
  const resp = await page.request.post('http://localhost:3000/api/auth/login', {
    data: { email: 'e2e@test.com', password: 'Test1234!' },
  });
  const body = await resp.json();

  await page.request.post('http://localhost:3000/api/pointage/pointer', {
    headers: { Authorization: `Bearer ${body.access_token}` },
    data: {},
  }).catch(() => { /* déjà pointé ou erreur réseau — on continue */ });

  await page.goto('/');
  await page.evaluate(({ t, u }: { t: string; u: any }) => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
  }, { t: body.access_token, u: body.user });
  await page.goto(path);
  await page.waitForTimeout(2500);

  const backdrop = page.locator('.pointage-backdrop');
  if (await backdrop.isVisible().catch(() => false)) {
    const btn = page.locator('.pm-btn').first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(800);
    }
  }
}

test.describe('Assistant IA — mode "Mes temps" (module Travail)', () => {

  test('Le bouton IA est visible sur /travail et bascule en mode "Mes temps"', async ({ page }) => {
    await loginAndGoto(page, '/travail/taches');

    const fab = page.locator('.fab');
    await expect(fab).toBeVisible({ timeout: 8_000 });

    await fab.click();
    await expect(page.locator('.chat-panel')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.panel-subtitle')).toContainText('Mes temps');

    // Suggestions "temps" présentes (différentes des suggestions "dossier client")
    await expect(page.locator('.sugg-chip', { hasText: 'heures' }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('Poser une question sur ses temps renvoie une réponse de l\'assistant', async ({ page }) => {
    await loginAndGoto(page, '/travail/taches');

    await page.locator('.fab').click();
    await expect(page.locator('.chat-panel')).toBeVisible({ timeout: 5_000 });

    const suggestion = page.locator('.sugg-chip', { hasText: 'semaine' }).first();
    await expect(suggestion).toBeVisible({ timeout: 5_000 });
    await suggestion.click();

    // Un message utilisateur doit apparaître
    await expect(page.locator('.msg--user').first()).toBeVisible({ timeout: 5_000 });

    // Puis une réponse de l'assistant (non vide) doit finir par arriver
    await expect(async () => {
      const aiBubble = page.locator('.msg--ai .msg-bubble').last();
      const text = await aiBubble.textContent();
      expect(text?.trim().length ?? 0).toBeGreaterThan(0);
    }).toPass({ timeout: 20_000 });
  });

  test('Le comportement existant sur une fiche client (mode dossier) n\'est pas cassé', async ({ page }) => {
    await loginAndGoto(page, '/clients');
    const firstClientCard = page.locator('.folder-item').first();
    await expect(firstClientCard).toBeVisible({ timeout: 8_000 });
    await firstClientCard.click();
    await page.waitForTimeout(2_000);

    const fab = page.locator('.fab');
    await expect(fab).toBeVisible({ timeout: 8_000 });
    await fab.click();
    await expect(page.locator('.chat-panel')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.panel-subtitle')).toContainText('Dossier');
  });
});
