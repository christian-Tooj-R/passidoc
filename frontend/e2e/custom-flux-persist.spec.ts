import { test, expect, Page } from '@playwright/test';

/**
 * Scénario testé : persistance du document mensuel attendu personnalisé
 * après navigation hors du dossier client puis retour.
 *
 * Problème rapporté : créer un type custom → quitter le dossier → revenir
 * → le type a disparu (le GET /api/clients/:id renvoie les anciennes données).
 *
 * Le mock ici est STATEFUL : le PATCH met à jour l'état du mock,
 * les GET suivants renvoient l'état mis à jour — ce qui simule une vraie persistance.
 */

const FAKE_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJBRE1JTiJ9.fake';
const FAKE_USER  = { id: 1, email: 'admin@afym.eu', role: 'ADMIN', firstName: 'Admin', lastName: 'Test' };

const BASE_CLIENT = {
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

/**
 * Monte les mocks réseau avec un état partagé.
 * Retourne { getState, setState } pour inspecter/forcer l'état du mock.
 */
async function setupStatefulMocks(page: Page, initial = BASE_CLIENT) {
  let state = { ...initial, customFluxTypes: [...initial.customFluxTypes] };

  // Catch-all → renvoie [] pour tout ce qui n'est pas explicitement mocké
  await page.route('**/api/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  await page.route('**/api/pointage/mon-statut', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ estPointe: true, pointage: null }) }),
  );
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

  // Mock stateful pour GET et PATCH /api/clients/1
  await page.route('**/api/clients/1', async r => {
    const method = r.request().method();
    if (method === 'GET') {
      await r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(state),
      });
    } else if (method === 'PATCH') {
      const body = JSON.parse(r.request().postData() ?? '{}');
      state = { ...state, ...body };
      await r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(state),
      });
    } else {
      await r.continue();
    }
  });

  // Mock liste clients (nécessaire pour naviguer vers /clients puis revenir)
  await page.route('**/api/clients', async r => {
    if (r.request().method() === 'GET') {
      await r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([state]),
      });
    } else {
      await r.continue();
    }
  });

  return {
    getState: () => state,
    setState: (update: Partial<typeof state>) => { state = { ...state, ...update }; },
  };
}

async function initSession(page: Page) {
  await page.goto('http://localhost:4200');
  await page.evaluate(({ token, user }: { token: string; user: any }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenant_slug', 'afym-audit-expertise');
  }, { token: FAKE_TOKEN, user: FAKE_USER });
}

// ── Helper : aller sur le dossier client ─────────────────────────────────────

async function gotoClient(page: Page) {
  await page.goto('http://localhost:4200/clients/1');
  await page.waitForLoadState('networkidle');
}

// ── Helper : aller sur la liste clients ──────────────────────────────────────

async function gotoClientList(page: Page) {
  await page.goto('http://localhost:4200/clients');
  await page.waitForLoadState('networkidle');
}

// ── Helper : créer un type custom ────────────────────────────────────────────

async function addCustomFluxType(page: Page, label: string) {
  await page.locator('button.flux-add-btn').click();
  const input = page.locator('input.flux-add-input');
  await input.click();
  await input.pressSequentially(label, { delay: 30 });
  await expect(page.locator('button.flux-add-confirm')).toBeEnabled({ timeout: 3000 });
  await page.locator('button.flux-add-confirm').click();
  await expect(page.getByText(label)).toBeVisible({ timeout: 5000 });
}

// ── Tests de persistance ─────────────────────────────────────────────────────

test.describe('Persistance document mensuel — navigation hors du dossier', () => {

  test('quitter le dossier via le menu puis revenir : le document est toujours là', async ({ page }) => {
    await setupStatefulMocks(page);
    await initSession(page);
    await gotoClient(page);

    // 1. Créer le type custom
    await addCustomFluxType(page, 'Rapport de trésorerie');

    // 2. Naviguer vers la liste clients (simule "sortir du dossier")
    await gotoClientList(page);
    await expect(page.locator('body')).toBeVisible();

    // 3. Revenir sur le dossier client
    await gotoClient(page);

    // 4. Le document doit toujours être présent (GET renverra l'état mis à jour par le PATCH)
    await expect(page.getByText('Rapport de trésorerie')).toBeVisible({ timeout: 8000 });
  });

  test('naviguer vers la page d\'accueil puis revenir au dossier : le document persiste', async ({ page }) => {
    await setupStatefulMocks(page);
    await initSession(page);
    await gotoClient(page);

    await addCustomFluxType(page, 'Balance mensuelle');

    // Naviguer vers l'accueil
    await page.goto('http://localhost:4200/dashboard');
    await page.waitForLoadState('networkidle');

    // Revenir
    await gotoClient(page);
    await expect(page.getByText('Balance mensuelle')).toBeVisible({ timeout: 8000 });
  });

  test('plusieurs allers-retours : le document reste présent', async ({ page }) => {
    await setupStatefulMocks(page);
    await initSession(page);
    await gotoClient(page);

    await addCustomFluxType(page, 'Doc multi-nav');

    // 1er aller-retour
    await gotoClientList(page);
    await gotoClient(page);
    await expect(page.getByText('Doc multi-nav')).toBeVisible({ timeout: 8000 });

    // 2e aller-retour
    await gotoClientList(page);
    await gotoClient(page);
    await expect(page.getByText('Doc multi-nav')).toBeVisible({ timeout: 8000 });
  });

  test('le PATCH envoie bien les customFluxTypes au backend', async ({ page }) => {
    let patchedPayload: any = null;

    await setupStatefulMocks(page);
    await initSession(page);
    await gotoClient(page);

    page.on('request', req => {
      if (req.method() === 'PATCH' && req.url().includes('/clients/1')) {
        patchedPayload = JSON.parse(req.postData() ?? '{}');
      }
    });

    await addCustomFluxType(page, 'Suivi de caisse');

    // Vérifier que le PATCH contient bien les données attendues
    expect(patchedPayload).not.toBeNull();
    expect(patchedPayload?.customFluxTypes).toBeDefined();
    const added = patchedPayload.customFluxTypes.find((t: any) => t.label === 'Suivi de caisse');
    expect(added).toBeDefined();
    expect(added?.key).toMatch(/^CUSTOM_/);
  });

  test('si le PATCH échoue, le type custom disparaît (rollback optimiste)', async ({ page }) => {
    await setupStatefulMocks(page);
    await initSession(page);
    await gotoClient(page);

    // Remplacer le mock PATCH par une erreur 500
    await page.route('**/api/clients/1', async r => {
      if (r.request().method() === 'PATCH') {
        await r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"Erreur serveur"}' });
      } else {
        await r.continue();
      }
    }, { times: 1 }); // Seulement le prochain PATCH

    await page.locator('button.flux-add-btn').click();
    const input = page.locator('input.flux-add-input');
    await input.click();
    await input.pressSequentially('Doc qui échoue', { delay: 30 });
    await page.locator('button.flux-add-confirm').click();

    // Après échec, le type doit avoir disparu (rollback optimiste côté frontend)
    await expect(page.getByText('Doc qui échoue')).not.toBeVisible({ timeout: 5000 });
  });

  test('un client chargé avec des customFluxTypes existants les affiche dès l\'arrivée', async ({ page }) => {
    await setupStatefulMocks(page, {
      ...BASE_CLIENT,
      customFluxTypes: [
        { key: 'CUSTOM_EXIST_1', label: 'Doc préexistant A' },
        { key: 'CUSTOM_EXIST_2', label: 'Doc préexistant B' },
      ],
    });
    await initSession(page);
    await gotoClient(page);

    await expect(page.getByText('Doc préexistant A')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Doc préexistant B')).toBeVisible({ timeout: 8000 });
  });

});
