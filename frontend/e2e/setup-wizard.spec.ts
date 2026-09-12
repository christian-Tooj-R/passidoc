import { test, expect, Page } from '@playwright/test';

/**
 * Assistant de configuration (/setup) — parcours complet.
 *
 * Non-régression principale : l'étape « Pôles » ne propose plus de saisie de pays.
 * Les deux pôles sont fixes (Pôle EST / Pôle OUEST) et affichés en lecture seule.
 *
 * Tout est mocké : aucun backend requis, aucun tenant réellement créé.
 */

const APP_URL = 'http://localhost:4200';

const POLE_LABEL_1 = 'Pôle EST';
const POLE_LABEL_2 = 'Pôle OUEST';
const POLE_FLAG_1  = '🔵';
const POLE_FLAG_2  = '🟠';

/** Corps de la requête POST /api/setup capturé par le mock. */
interface SetupPayload {
  slug: string;
  nomSociete: string;
  poleLabel1: string;
  poleLabel2: string;
  poleFlag1: string;
  poleFlag2: string;
  adminEmail: string;
}

/** Neutralise tous les appels backend de la page /setup. */
async function mockBackend(page: Page) {
  await page.route('**/api/setup/status', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ configured: false }),
    }),
  );
  await page.route('**/api/tenant/config', route =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }),
  );
}

/** Ouvre /setup et lance l'assistant depuis la landing page. */
async function openWizard(page: Page) {
  await page.goto(`${APP_URL}/setup`);
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /Créer mon espace/ }).first().click();

  // startSetup() bascule sur l'assistant après une animation de 700 ms.
  await expect(page.locator('.sw-card')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.sw-step-title')).toHaveText('Votre cabinet');
}

/** Remplit l'étape 0 (informations cabinet). */
async function fillStep0(page: Page, nom = 'Cabinet Test E2E') {
  await page.getByLabel('Nom du cabinet *').fill(nom);
  await page.getByLabel('Ville').fill('Saint-Denis');
  await page.getByLabel('Pays').fill('France');
}

/** Remplit l'étape 2 (compte administrateur). */
async function fillStep2(page: Page) {
  await page.getByLabel('Prénom *').fill('Alex');
  await page.getByLabel('Nom *', { exact: true }).fill('Martin');
  await page.getByLabel('Adresse e-mail *').fill('admin@cabinet-test.com');
  await page.getByLabel('Mot de passe *', { exact: true }).fill('MotDePasse1');
  await page.getByLabel('Confirmer le mot de passe *').fill('MotDePasse1');
}

const nextBtn = (page: Page) => page.locator('button.sw-next');

test.describe('Setup — assistant de configuration', () => {

  test.beforeEach(async ({ page }) => {
    await mockBackend(page);
  });

  test('la landing page /setup s\'affiche et permet de lancer l\'assistant', async ({ page }) => {
    await page.goto(`${APP_URL}/setup`);
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.lp-hero__ctas')).toBeVisible();

    await page.getByRole('button', { name: /Créer mon espace/ }).first().click();
    await expect(page.locator('.sw-card')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.sw-header__sub')).toContainText('Étape 1 sur 4');
  });

  test('l\'étape 0 bloque la navigation tant que le nom du cabinet est vide', async ({ page }) => {
    await openWizard(page);

    await nextBtn(page).click();

    // On reste sur l'étape 0 et l'erreur de champ obligatoire s'affiche.
    await expect(page.locator('.sw-step-title')).toHaveText('Votre cabinet');
    await expect(page.locator('mat-error')).toContainText('Le nom du cabinet est obligatoire');
  });

  test('l\'étape Pôles n\'a plus aucun champ de saisie de pays', async ({ page }) => {
    await openWizard(page);
    await fillStep0(page);
    await nextBtn(page).click();

    await expect(page.locator('.sw-step-title')).toHaveText('Pôles');

    // Plus d'autocomplete pays, plus de libellés « Pôle 1/2 — pays ».
    await expect(page.locator('mat-autocomplete')).toHaveCount(0);
    await expect(page.locator('.sw-body')).not.toContainText('— pays');
    await expect(page.getByText('Pôle 1 —')).toHaveCount(0);
    await expect(page.getByText('Pôle 2 —')).toHaveCount(0);

    // Les deux pôles fixes sont affichés en lecture seule.
    const poles = page.locator('[data-testid="poles-fixes"]');
    await expect(poles).toBeVisible();
    await expect(poles.locator('.pole-fixed__item')).toHaveCount(2);
    await expect(poles).toContainText(POLE_LABEL_1);
    await expect(poles).toContainText(POLE_LABEL_2);
    await expect(poles.locator('input')).toHaveCount(0);
  });

  test('l\'étape Pôles ne bloque pas la navigation (aucun champ requis caché)', async ({ page }) => {
    await openWizard(page);
    await fillStep0(page);
    await nextBtn(page).click();
    await expect(page.locator('.sw-step-title')).toHaveText('Pôles');

    // Rien à saisir : « Suivant » doit passer directement à l'étape administrateur.
    await nextBtn(page).click();
    await expect(page.locator('.sw-step-title')).toHaveText('Compte administrateur');
    await expect(page.locator('.sw-header__sub')).toContainText('Étape 3 sur 4');
  });

  test('le récapitulatif affiche les deux pôles fixes', async ({ page }) => {
    await openWizard(page);
    await fillStep0(page, 'Cabinet Récap');
    await nextBtn(page).click();
    await nextBtn(page).click();
    await fillStep2(page);
    await nextBtn(page).click();

    await expect(page.locator('.sw-step-title')).toHaveText('Tout est prêt !');

    const ligne = page.locator('.recap__row', { hasText: 'Pôles' });
    await expect(ligne).toContainText(POLE_LABEL_1);
    await expect(ligne).toContainText(POLE_LABEL_2);
    await expect(page.locator('.recap__row', { hasText: 'Cabinet' })).toContainText('Cabinet Récap');
  });

  test('la soumission envoie les pôles fixes et affiche l\'écran de succès', async ({ page }) => {
    let payload: SetupPayload | null = null;

    await page.route('**/api/setup', async route => {
      if (route.request().method() !== 'POST') return route.fallback();
      payload = route.request().postDataJSON() as SetupPayload;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Configuration terminée' }),
      });
    });

    await openWizard(page);
    await fillStep0(page, 'Cabinet Soumission');
    await nextBtn(page).click();
    await nextBtn(page).click();
    await fillStep2(page);
    await nextBtn(page).click();

    await page.locator('button.sw-launch').click();

    // Transition « feuille de cahier » (2200 ms) puis écran de succès.
    await expect(page.locator('.sc-card')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.sc-title')).toHaveText('Passidoc est configuré !');

    expect(payload).not.toBeNull();
    const body = payload as unknown as SetupPayload;
    expect(body.poleLabel1).toBe(POLE_LABEL_1);
    expect(body.poleLabel2).toBe(POLE_LABEL_2);
    expect(body.poleFlag1).toBe(POLE_FLAG_1);
    expect(body.poleFlag2).toBe(POLE_FLAG_2);
    expect(body.nomSociete).toBe('Cabinet Soumission');
    expect(body.adminEmail).toBe('admin@cabinet-test.com');
    // Aucun code pays ne doit subsister dans le payload.
    expect(Object.keys(body)).not.toContain('poleCode1');
    expect(Object.keys(body)).not.toContain('poleCode2');
  });
});
