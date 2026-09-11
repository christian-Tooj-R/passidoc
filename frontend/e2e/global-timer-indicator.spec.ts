import { test, expect } from '@playwright/test';

// Minuteur visible partout dans l'appli — même en dehors de /travail/*.
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

test.describe('Minuteur global (visible hors module Travail)', () => {

  test('Le minuteur démarré dans Travail reste visible et arrêtable sur une fiche client', async ({ page }) => {
    // 1. Démarrer le minuteur depuis le module Travail
    await loginAndGoto(page, '/travail/taches');
    await expect(page.locator('.tw-timer')).toBeVisible({ timeout: 8_000 });

    const startBtn = page.locator('.tw-timer__btn--start');
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
      await page.waitForTimeout(1_200);
    }
    await expect(page.locator('.tw-timer--running')).toBeVisible({ timeout: 5_000 });

    // 2. Naviguer ailleurs dans l'appli (dashboard, hors /travail)
    await page.goto('/dashboard');
    await page.waitForTimeout(1_500);

    // 3. L'indicateur compact doit être visible dans la topbar principale, avec un temps qui tourne
    const indicator = page.locator('app-global-timer-indicator .gti');
    await expect(indicator).toBeVisible({ timeout: 8_000 });
    await expect(indicator.locator('.gti-time')).toBeVisible();

    // 4. Il doit rester visible sur une fiche client (scénario Tempolia)
    // On récupère un id client existant via la liste
    await page.goto('/clients');
    await page.waitForTimeout(1_500);
    const firstClientCard = page.locator('.folder-item').first();
    await expect(firstClientCard).toBeVisible({ timeout: 8_000 });
    await firstClientCard.click();
    await page.waitForTimeout(2_000);
    await expect(page.locator('app-global-timer-indicator .gti')).toBeVisible({ timeout: 8_000 });

    // 5. Arrêter le minuteur depuis l'indicateur global
    const stopBtn = page.locator('.gti-btn--stop').first();
    await expect(stopBtn).toBeVisible({ timeout: 5_000 });
    await stopBtn.click();
    await page.waitForTimeout(800);
    await expect(page.locator('app-global-timer-indicator .gti')).toHaveCount(0);
  });

  test('Aucun indicateur global affiché quand le minuteur est arrêté', async ({ page }) => {
    await loginAndGoto(page, '/dashboard');
    await expect(page.locator('app-global-timer-indicator .gti')).toHaveCount(0);
  });
});
