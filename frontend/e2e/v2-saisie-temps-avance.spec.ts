/**
 * Suite E2E — Saisie des temps avancée (v2), réorientée vers le module Travail.
 *
 * L'ancienne page /saisie-temps (features/saisie-temps/saisie-temps.component.ts) n'est
 * plus routée depuis l'arrivée du module Travail : ces scénarios vérifient désormais les
 * mêmes fonctions là où elles vivent aujourd'hui.
 *  TM-01 : Minuteur start / stop (barre latérale du module Travail)
 *  TM-02 : Codes mission pour une saisie FACTURABLE (Saisie rapide)
 *  TM-03 / TM-04 : bandeau « heures < seuil » et « Valider la semaine » — n'existent que
 *          dans l'ancienne page : en attente d'une décision (réintroduire dans Travail ?)
 */
import { test, expect, Page } from '@playwright/test';
import { loginViaApi, TEST_TENANT } from './helpers/auth';

// Libellés des 8 codes mission (MISSION_CODES, core/services/saisie-temps.service.ts)
const MISSIONS = ['Tenue comptabilité', 'Révision des comptes', 'Déclarations fiscales', 'Social / Paie',
  'Juridique', 'Conseil', 'Formation', 'Administration cabinet'];

async function ouvrirTravail(page: Page, chemin = '/travail/saisie') {
  await loginViaApi(page);
  await page.goto(`${chemin}?tenant=${TEST_TENANT}`);
  await expect(page.locator('.tw-sidebar')).toBeVisible({ timeout: 10_000 });
}

test.beforeEach(async ({ page }) => {
  // Minuteur persisté en localStorage : repartir d'un état neutre
  await page.addInitScript(() => {
    for (const k of ['st_timer', 'st_timer_task_ctx', 'st_timer_paused_tasks']) localStorage.removeItem(k);
  });
});

test('TM-01 : Le minuteur démarre, avance, et l’arrêt propose d’enregistrer le temps', async ({ page }) => {
  await ouvrirTravail(page);
  const temps = page.locator('.tw-timer__time');

  await page.locator('.tw-timer__btn--start').click();
  await expect(page.locator('.tw-timer__btn--pause')).toBeVisible();
  const avant = await temps.textContent();
  await page.waitForTimeout(2_100);
  expect(await temps.textContent()).not.toBe(avant);

  // Pause puis reprise
  await page.locator('.tw-timer__btn--pause').click();
  await expect(page.locator('.tw-timer__btn--start', { hasText: 'Reprendre' })).toBeVisible();
  await page.locator('.tw-timer__btn--start', { hasText: 'Reprendre' }).click();

  // Arrêt → formulaire d'enregistrement du temps
  await page.locator('.tw-timer__btn--stop').click();
  await expect(page.locator('.tw-tsave')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('.tw-tsave__type button', { hasText: 'Facturable' })).toBeVisible();

  // Abandon : le formulaire se ferme et le minuteur revient à zéro
  await page.locator('.tw-tsave__close').click();
  await expect(page.locator('.tw-tsave')).toHaveCount(0);
  await expect(page.locator('.tw-timer__btn--start', { hasText: 'Démarrer' })).toBeVisible();
});

test('TM-02 : Les codes mission sont proposés pour une saisie FACTURABLE', async ({ page }) => {
  await ouvrirTravail(page);
  const form = page.locator('.line-form').first();
  await form.locator('.lf-type__btn', { hasText: 'Facturable' }).click();

  const mission = form.locator('select').filter({ has: page.locator('option', { hasText: 'Tenue comptabilité' }) }).first();
  await expect(mission).toBeVisible();
  const libelles = await mission.locator('option').allTextContents();
  for (const m of MISSIONS) expect(libelles.some(l => l.includes(m)), m).toBe(true);
  await mission.selectOption({ label: 'Tenue comptabilité' });

  // Le choix du client reste disponible
  await expect(form.locator('input[placeholder*="Client" i]').first()).toBeVisible();
});

test.fixme('TM-03 : Bandeau d’alerte quand heures < seuil — absent du module Travail', async () => {
  // L'alerte existe côté serveur (notification hebdomadaire HEURES_HEBDO_INSUFFISANTES),
  // mais le bandeau à l'écran n'existait que dans l'ancienne page /saisie-temps.
});

test.fixme('TM-04 : Bouton « Valider la semaine » (verrouillage) — absent du module Travail', async () => {
  // L'API POST /saisies-temps/valider-periode existe, mais aucun écran du module Travail
  // ne l'appelle depuis la suppression de l'ancienne page /saisie-temps.
});
