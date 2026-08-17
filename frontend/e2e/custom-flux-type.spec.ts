import { test, expect, Page } from '@playwright/test';

// ── Données mockées ─────────────────────────────────────────────────────────
const FAKE_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJBRE1JTiJ9.fake';
const FAKE_USER  = { id: 1, email: 'admin@afym.eu', role: 'ADMIN', firstName: 'Admin', lastName: 'Test' };

const FAKE_CLIENT = {
  id: 1,
  nom: 'AFYM Test',
  site: 'REUNION',
  typesFluxActifs: ['RELEVE_BANCAIRE', 'PAIE'],
  customFluxTypes: [] as { key: string; label: string }[],
  isActive: true,
  ficheIdentite: null,
  completudeAdn: 0,
  completudePilotage: 0,
  intervenants: [],
  responsable: null,
  directeur: null,
  collaborateurMg: null,
};

// ── Helper : mocke les routes puis navigue ───────────────────────────────────
async function gotoClient(page: Page, clientOverride: typeof FAKE_CLIENT = FAKE_CLIENT) {
  // Catch-all en premier → priorité la plus basse (LIFO Playwright)
  await page.route('**/api/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  // Pointage : simuler que l'utilisateur est déjà pointé → pas de modal bloquant
  await page.route('**/api/pointage/mon-statut', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ estPointe: true, pointage: null }) }),
  );

  // Routes spécifiques en dernier → priorité la plus haute
  await page.route('**/api/setup/status', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ configured: true }) }),
  );
  await page.route('**/api/clients/1/exercices', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/fiscal-reference**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.route('**/api/fiche-identite/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
  );
  await page.route('**/api/clients/1', async r => {
    if (r.request().method() === 'GET') {
      await r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(clientOverride) });
    } else if (r.request().method() === 'PATCH') {
      const body = JSON.parse(r.request().postData() ?? '{}');
      await r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ...clientOverride, ...body }) });
    } else {
      await r.continue();
    }
  });

  // Mettre localStorage AVANT le goto final pour que Angular lise le token au boot
  await page.goto('http://localhost:4200');
  await page.evaluate(({ token, user }: { token: string; user: any }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenant_slug', 'afym-audit-expertise');
  }, { token: FAKE_TOKEN, user: FAKE_USER });

  await page.goto('http://localhost:4200/clients/1');
  await page.waitForLoadState('networkidle');
}

// ── Section attendue ─────────────────────────────────────────────────────────
async function getAddBtn(page: Page) {
  return page.locator('button.flux-add-btn');
}

// ── Tests ────────────────────────────────────────────────────────────────────
test.describe('Documents mensuels — type personnalisé', () => {

  test('le bouton "Ajouter" est visible dans la section Documents mensuels', async ({ page }) => {
    await gotoClient(page);
    await expect(page.locator('button.flux-add-btn')).toBeVisible({ timeout: 8000 });
  });

  test('cliquer sur "Ajouter" affiche le formulaire inline', async ({ page }) => {
    await gotoClient(page);
    await page.locator('button.flux-add-btn').click();
    await expect(page.locator('input.flux-add-input')).toBeVisible();
    await expect(page.locator('button.flux-add-confirm')).toBeVisible();
  });

  test('le bouton OK est désactivé si le champ est vide', async ({ page }) => {
    await gotoClient(page);
    await page.locator('button.flux-add-btn').click();
    await expect(page.locator('button.flux-add-confirm')).toBeDisabled();
  });

  test('annuler referme le formulaire sans sauvegarder', async ({ page }) => {
    await gotoClient(page);

    await page.locator('button.flux-add-btn').click();
    const input = page.locator('input.flux-add-input');
    await input.click();
    await input.pressSequentially('Test annulation', { delay: 30 });
    await page.locator('button.flux-add-cancel').click();

    // Formulaire fermé et bouton "+" de retour
    await expect(page.locator('button.flux-add-btn')).toBeVisible();
    await expect(page.locator('input.flux-add-input')).not.toBeVisible();
    // Le texte ne doit PAS apparaître dans la liste custom
    await expect(page.locator('.flux-type-label', { hasText: 'Test annulation' })).not.toBeVisible();
  });

  test('valider avec OK crée le document et l\'affiche', async ({ page }) => {
    let patchBody: any = null;
    // Intercepter PATCH AVANT gotoClient (sera évalué en dernier = priorité plus basse que le route de gotoClient)
    // → on utilise une approche différente : écouter l'event réseau
    await gotoClient(page);

    page.on('request', req => {
      if (req.method() === 'PATCH' && req.url().includes('/clients/1')) {
        patchBody = JSON.parse(req.postData() ?? '{}');
      }
    });

    await page.locator('button.flux-add-btn').click();
    const input = page.locator('input.flux-add-input');
    await input.click();
    await input.pressSequentially('Relevé de charges', { delay: 30 });

    // Le bouton doit être activé après la saisie
    await expect(page.locator('button.flux-add-confirm')).toBeEnabled({ timeout: 3000 });
    await page.locator('button.flux-add-confirm').click();

    // Le texte doit apparaître dans la liste
    await expect(page.getByText('Relevé de charges')).toBeVisible({ timeout: 5000 });
    // Formulaire refermé
    await expect(page.locator('button.flux-add-btn')).toBeVisible();
    // Payload correct
    expect(patchBody?.customFluxTypes?.[0]?.label).toBe('Relevé de charges');
    expect(patchBody?.customFluxTypes?.[0]?.key).toMatch(/^CUSTOM_/);
  });

  test('valider avec Entrée fonctionne aussi', async ({ page }) => {
    await gotoClient(page);
    await page.locator('button.flux-add-btn').click();
    const input = page.locator('input.flux-add-input');
    await input.click();
    await input.pressSequentially('Doc via Entrée', { delay: 30 });
    await input.press('Enter');
    await expect(page.getByText('Doc via Entrée')).toBeVisible({ timeout: 5000 });
  });

  test('un document existant peut être supprimé avec ×', async ({ page }) => {
    const clientWithCustom = {
      ...FAKE_CLIENT,
      customFluxTypes: [{ key: 'CUSTOM_TEST_1', label: 'Doc à supprimer' }],
    };
    await gotoClient(page, clientWithCustom);

    await expect(page.getByText('Doc à supprimer')).toBeVisible({ timeout: 5000 });
    await page.locator('button.custom-del-btn').first().click();
    await expect(page.getByText('Doc à supprimer')).not.toBeVisible({ timeout: 3000 });
  });
});
