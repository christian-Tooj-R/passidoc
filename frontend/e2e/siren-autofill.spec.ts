import { test, expect, Page } from '@playwright/test';

const FAKE_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJBRE1JTiJ9.fake';
const FAKE_USER  = { id: 1, email: 'admin@afym.eu', role: 'ADMIN', firstName: 'Admin', lastName: 'Test' };

const FAKE_CLIENT = {
  id: 1,
  nom: 'AFYM Test',
  site: 'REUNION',
  typesFluxActifs: ['RELEVE_BANCAIRE'],
  customFluxTypes: [],
  isActive: true,
  ficheIdentite: null,
  completudeAdn: 0,
  completudePilotage: 0,
  intervenants: [],
  responsable: null,
  directeur: null,
  collaborateurMg: null,
};

const FAKE_PAPPERS = {
  siren: '552120222',
  nomEntreprise: 'SOCIETE GENERALE (SG)',
  formeJuridique: "SA à conseil d'administration",
  adresse: '29 BOULEVARD HAUSSMANN 75009 PARIS',
  siret: '55212022200013',
  codeNaf: '64.19Z',
  libelleNaf: 'Autres intermédiations monétaires',
  dirigeants: [],
};

async function gotoFicheIdentite(page: Page) {
  // Catch-all
  await page.route('**/api/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  // Pointage
  await page.route('**/api/pointage/mon-statut', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ estPointe: true, pointage: null }) }),
  );
  // Setup status
  await page.route('**/api/setup/status', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ configured: true }) }),
  );
  // Exercices / fiscal
  await page.route('**/api/clients/1/exercices', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/api/fiscal-reference**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
  await page.route('**/api/fiche-identite/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
  );
  // Pappers SIREN lookup
  await page.route('**/api/pappers/siren/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(FAKE_PAPPERS) }),
  );
  // Client
  await page.route('**/api/clients/1', async r => {
    if (r.request().method() === 'GET') {
      await r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(FAKE_CLIENT) });
    } else {
      await r.continue();
    }
  });

  await page.goto('http://localhost:4200');
  await page.evaluate(({ token, user }: { token: string; user: any }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenant_slug', 'afym-audit-expertise');
  }, { token: FAKE_TOKEN, user: FAKE_USER });

  await page.goto('http://localhost:4200/clients/1');
  await page.waitForLoadState('networkidle');

  // Aller sur l'onglet Fiche d'identité
  const ficheTab = page.locator('mat-tab-header .mat-mdc-tab', { hasText: /fiche d.identit/i });
  if (await ficheTab.count() > 0) {
    await ficheTab.click();
    await page.waitForLoadState('networkidle');
  }
}

test.describe('Auto-remplissage SIREN → Forme juridique', () => {

  test('le champ Forme juridique est en lecture seule', async ({ page }) => {
    await gotoFicheIdentite(page);
    const formeInput = page.locator('input[formcontrolname="formeJuridique"]');
    await expect(formeInput).toBeVisible({ timeout: 8000 });
    const readOnly = await formeInput.getAttribute('readonly');
    // readonly="" ou "readonly" ou "true" — tous indiquent readonly
    expect(readOnly).not.toBeNull();
  });

  test('saisir un SIREN valide auto-remplit la forme juridique', async ({ page }) => {
    await gotoFicheIdentite(page);

    const sirenInput = page.locator('input[formcontrolname="siren"]');
    await expect(sirenInput).toBeVisible({ timeout: 8000 });

    await sirenInput.click();
    await sirenInput.fill('552120222');
    // Déclencher le blur
    await sirenInput.press('Tab');

    // Attendre que la forme juridique soit remplie
    const formeInput = page.locator('input[formcontrolname="formeJuridique"]');
    await expect(formeInput).toHaveValue(/SA|conseil|administration/, { timeout: 5000 });
  });

  test('un SIREN de moins de 9 chiffres ne déclenche pas le lookup', async ({ page }) => {
    await gotoFicheIdentite(page);

    let apiCalled = false;
    page.on('request', req => {
      if (req.url().includes('pappers/siren')) apiCalled = true;
    });

    const sirenInput = page.locator('input[formcontrolname="siren"]');
    await sirenInput.fill('12345');
    await sirenInput.press('Tab');

    await page.waitForTimeout(500);
    expect(apiCalled).toBe(false);
  });
});
