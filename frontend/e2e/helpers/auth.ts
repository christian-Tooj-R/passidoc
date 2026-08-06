import { Page, request } from '@playwright/test';

export const TEST_TENANT = 'test-e2e';
export const TEST_EMAIL  = 'e2e@test.com';
export const TEST_PASS   = 'Test1234!';
export const API_URL     = 'http://localhost:3000/api';
export const CLIENT_ID   = 2; // Client Test Balance, créé dans le seed

/** Récupère un JWT via l'API et le stocke dans localStorage pour éviter le formulaire de login. */
export async function loginViaApi(page: Page): Promise<string> {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API_URL}/auth/login`, {
    headers: { 'x-tenant-slug': TEST_TENANT },
    data: { email: TEST_EMAIL, password: TEST_PASS },
  });
  const body = await res.json();
  const token: string = body.access_token;
  const user = body.user;

  // 1. Charger la page avec le tenant dans l'URL (initialise _detectSlug correctement)
  await page.goto(`http://localhost:4200/?tenant=${TEST_TENANT}`);
  await page.waitForLoadState('domcontentloaded');

  // 2. Injecter token + user + tenant_slug dans localStorage
  await page.evaluate(({ token, user, tenant }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenant_slug', tenant);
  }, { token, user, tenant: TEST_TENANT });

  // 3. Pointer le collaborateur pour éviter le guard de pointage
  await ctx.post(`${API_URL}/pointage/pointer`, {
    headers: { 'Authorization': `Bearer ${token}`, 'x-tenant-slug': TEST_TENANT },
    data: { latitude: null, longitude: null, action: 'ENTREE' },
  }).catch(() => { /* déjà pointé ou erreur ignorée */ });

  // 4. Recharger avec le tenant dans l'URL pour que Angular relise le localStorage
  await page.goto(`http://localhost:4200/?tenant=${TEST_TENANT}`);
  await page.waitForLoadState('networkidle');

  await ctx.dispose();
  return token;
}

/** Navigue sur le client de test et attend que le header soit visible. */
async function goToClient(page: Page) {
  await page.goto(`http://localhost:4200/clients/${CLIENT_ID}?tenant=${TEST_TENANT}`);
  await page.waitForLoadState('networkidle');
  // Attendre que la sidebar soit prête
  await page.waitForSelector('.sidenav__item', { timeout: 10_000 }).catch(() => {});
}

/** Navigue directement sur l'onglet Pilotage (Flux mensuel) du client de test. */
export async function goToFluxMensuel(page: Page) {
  await goToClient(page);
  // Cliquer sur l'item sidebar "Pilotage"
  const pilotageBtn = page.locator('.sidenav__item').filter({ hasText: /pilotage/i });
  if (await pilotageBtn.count() > 0) {
    await pilotageBtn.first().click();
    await page.waitForTimeout(500);
  }
}

/** Navigue sur l'onglet Documents du client de test. */
export async function goToDocuments(page: Page) {
  await goToClient(page);
  // Cliquer sur l'item sidebar "Documents"
  const docBtn = page.locator('.sidenav__item').filter({ hasText: /documents/i });
  if (await docBtn.count() > 0) {
    await docBtn.first().click();
    await page.waitForTimeout(500);
  }
}
