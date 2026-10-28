/**
 * Tests E2E — Module Missions (CDC_MODULE_MISSIONS_PASSIDOC, 19/10/2026) et saisie automatique du
 * temps d'une tâche terminée (module Travail).
 *
 *   MI-01 : Par cycle — recommandation + mission proposée depuis un cycle (résumé du cycle)
 *   MI-02 : Pipeline — mission reprise automatiquement, statut en ligne, historique, relance dépassée
 *   MI-03 : R7 — mission en discussion : archivage (pas de suppression), filtre « Archivées »
 *   MI-04 : Pipeline — mission hors cycle
 *   MI-05 : Vue cabinet (menu Dossiers › Missions) — KPI, filtre par statut, exports Excel / PDF
 *   TA-01 : Kanban — tâche terminée → temps chronométré ajouté à la saisie des temps
 *
 * Tenant test-e2e, dossier 2. Données marquées ZZMI, supprimées avant et après le scénario.
 */
import { test, expect, request as pwRequest } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

const API_URL = 'http://localhost:3000/api';
const APP_URL = process.env['BASE_URL'] ?? 'http://localhost:4200';
const TENANT = 'test-e2e';
const CLIENT_ID = 2;
const TAG = 'ZZMI';

function psql(sql: string[]) {
  const { spawnSync } = require('child_process');
  spawnSync('docker', ['exec', '-i', 'passidoc-postgres', 'psql', '-U', 'passidoc_user', '-d', 'passidoc_db'],
    { input: [...sql, '\\q'].join('\n'), encoding: 'utf-8' });
}
const MENAGE = [
  `DELETE FROM missions WHERE titre LIKE '${TAG}%';`,
  `DELETE FROM recommandations_cycles WHERE texte LIKE '${TAG}%';`,
  `DELETE FROM saisies_temps WHERE commentaire LIKE '${TAG}%';`,
  `DELETE FROM tasks WHERE titre LIKE '${TAG}%';`,
];

async function connexion(page: Page): Promise<{ token: string; api: APIRequestContext; userId: number }> {
  const api = await pwRequest.newContext();
  const body = await (await api.post(`${API_URL}/auth/login`, {
    headers: { 'x-tenant-slug': TENANT }, data: { email: 'e2e@test.com', password: 'Test1234!' },
  })).json();
  await page.goto(`${APP_URL}/auth/login?tenant=${TENANT}`);
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(({ token, user, tenant }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenant_slug', tenant);
  }, { token: body.access_token, user: body.user, tenant: TENANT });
  return { token: body.access_token, api, userId: body.user.id };
}
const h = (token: string) => ({ Authorization: `Bearer ${token}`, 'x-tenant-slug': TENANT });

async function ongletMissions(page: Page) {
  await page.goto(`${APP_URL}/clients/${CLIENT_ID}?tab=missions&tenant=${TENANT}`);
  await page.waitForLoadState('networkidle');
  const tab = page.locator('app-missions-tab');
  await expect(tab.locator('.mt-tab').first()).toBeVisible({ timeout: 10_000 });
  return tab;
}
async function ouvrirCycle(page: Page, nom: string) {
  const hd = page.locator('app-missions-tab .cy-h').filter({ hasText: nom }).first();
  if ((await hd.getAttribute('aria-expanded')) !== 'true') await hd.click();
}
const dialogue = (page: Page) => page.locator('app-mission-form-dialog');
async function creerDansDialogue(page: Page) {
  await Promise.all([
    page.waitForResponse(r => r.request().method() === 'POST' && /\/clients\/\d+\/missions$/.test(new URL(r.url()).pathname)),
    dialogue(page).locator('button').filter({ hasText: 'Créer la mission' }).click(),
  ]);
  await expect(dialogue(page)).toBeHidden();
}

test.describe.serial('Module Missions + saisie automatique des tâches', () => {
  const RECO = `${TAG} — Trésorerie tendue : mettre en place un suivi à 13 semaines`;
  const M_CYCLE = `${TAG} — Plan de trésorerie prévisionnel`;
  const M_HORS = `${TAG} — Tableau de bord mensuel`;

  test.beforeAll(() => psql(MENAGE));
  test.afterAll(() => psql(MENAGE));

  test('MI-01 — Par cycle : recommandation et mission proposée depuis le cycle Trésorerie', async ({ page }) => {
    await connexion(page);
    const tab = await ongletMissions(page);
    await expect(tab.locator('.cy')).toHaveCount(10);
    await ouvrirCycle(page, 'Trésorerie');

    const ta = tab.locator('.cy--open textarea');
    await ta.fill(RECO);
    // Enregistré à la sortie du champ ou via « Enregistrer » (le blur n'est pas fiable en headless).
    await Promise.all([
      page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes('/cycles/TRE/recommandation')),
      tab.locator('.cy--open .b-mini').filter({ hasText: 'Enregistrer' }).click(),
    ]);

    await tab.locator('.cy--open .b-add').click();
    await expect(dialogue(page)).toContainText('TRE · Trésorerie');
    await dialogue(page).locator('input[name="titre"]').fill(M_CYCLE);
    await dialogue(page).locator('input[name="honoraires"]').fill('2700');
    await creerDansDialogue(page);

    const entete = tab.locator('.cy-h').filter({ hasText: 'Trésorerie' });
    await expect(entete).toContainText('1 recommandation');
    await expect(entete).toContainText('1 mission');
    await expect(entete).toContainText(/2\s700\s€/);
    await expect(entete).toContainText('1 proposée');
    await expect(tab.locator('.cy--open .ml').filter({ hasText: M_CYCLE })).toBeVisible();
  });

  test('MI-02 — Pipeline : reprise automatique, statut en ligne, historique, relance dépassée', async ({ page }) => {
    await connexion(page);
    const tab = await ongletMissions(page);
    await tab.locator('.mt-tab').filter({ hasText: 'Pipeline' }).click();
    const ligne = tab.locator('tbody tr').filter({ hasText: M_CYCLE });
    await expect(ligne).toContainText('Trésorerie');
    await expect(ligne).toContainText(/2\s700\s€/);

    await Promise.all([
      page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes('/missions/')),
      ligne.locator('select').selectOption('EN_DISCUSSION'),
    ]);
    await expect(tab.locator('tbody tr').filter({ hasText: M_CYCLE }).locator('select')).toHaveValue('EN_DISCUSSION');

    // Détail : historique + date de relance dans le passé → « À relancer ».
    await tab.locator('tbody tr').filter({ hasText: M_CYCLE }).locator('.lnk').click();
    const dlg = dialogue(page);
    await expect(dlg.locator('.mf-histo')).toContainText('En discussion');
    await expect(dlg.locator('.mf-histo')).toContainText('Création');
    await dlg.locator('input[name="dateRelance"]').fill('2026-01-15');
    await Promise.all([
      page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes('/missions/')),
      dlg.locator('button').filter({ hasText: 'Enregistrer' }).click(),
    ]);
    await expect(dlg).toBeHidden();
    await expect(tab.locator('tbody tr').filter({ hasText: M_CYCLE }).locator('.badge-relance')).toBeVisible();
    await expect(tab.locator('.kpi--rel .kpi__v')).not.toHaveText('0');
  });

  test('MI-03 — R7 : une mission en discussion ne se supprime pas, elle s’archive', async ({ page }) => {
    await connexion(page);
    const tab = await ongletMissions(page);
    await tab.locator('.mt-tab').filter({ hasText: 'Pipeline' }).click();
    await tab.locator('tbody tr').filter({ hasText: M_CYCLE }).locator('.lnk').click();
    const dlg = dialogue(page);
    await expect(dlg.locator('button').filter({ hasText: 'Supprimer' })).toHaveCount(0);
    await Promise.all([
      page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes('/missions/')),
      dlg.locator('button').filter({ hasText: 'Archiver' }).click(),
    ]);
    await expect(dlg).toBeHidden();
    await expect(tab.locator('tbody tr').filter({ hasText: M_CYCLE })).toHaveCount(0);
    await tab.locator('label.chk').filter({ hasText: 'Archivées' }).locator('input').check();
    await expect(tab.locator('tbody tr').filter({ hasText: M_CYCLE })).toContainText('Archivée');
  });

  test('MI-04 — Pipeline : mission saisie directement, hors cycle', async ({ page }) => {
    await connexion(page);
    const tab = await ongletMissions(page);
    await tab.locator('.mt-tab').filter({ hasText: 'Pipeline' }).click();
    await tab.locator('.btn-new').click();
    await expect(dialogue(page)).toContainText('Hors cycle');
    await dialogue(page).locator('input[name="titre"]').fill(M_HORS);
    await dialogue(page).locator('select[name="statut"]').selectOption('ACCEPTEE');
    await creerDansDialogue(page);
    const ligne = tab.locator('tbody tr').filter({ hasText: M_HORS });
    await expect(ligne).toContainText('Hors cycle');
    await expect(ligne.locator('select')).toHaveValue('ACCEPTEE');
    await expect(ligne).toContainText('—');   // montant non renseigné (R6)
  });

  test('MI-05 — Vue cabinet : menu, KPI, filtre par statut, exports', async ({ page }) => {
    await connexion(page);
    await page.goto(`${APP_URL}/clients?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.locator('a[href^="/missions"]').first().click();
    await expect(page).toHaveURL(/\/missions/);
    await expect(page.locator('h1')).toHaveText('Missions');

    const ligne = page.locator('tbody tr').filter({ hasText: M_HORS });
    await expect(ligne).toBeVisible();
    await expect(ligne.locator('a')).toHaveAttribute('href', new RegExp(`/clients/${CLIENT_ID}`));
    await expect(page.locator('.kpis')).toContainText('Signé HT');

    await page.locator('.chip').filter({ hasText: 'Proposée' }).click();
    await expect(page.locator('tbody tr').filter({ hasText: M_HORS })).toHaveCount(0);
    await page.locator('.chip').filter({ hasText: 'Acceptée' }).click();
    await expect(page.locator('tbody tr').filter({ hasText: M_HORS })).toBeVisible();

    const [xlsx] = await Promise.all([page.waitForEvent('download'), page.locator('.btn-export').filter({ hasText: 'Excel' }).click()]);
    expect(xlsx.suggestedFilename()).toMatch(/^missions-\d{4}-\d{2}\.xlsx$/);
    const [pdf] = await Promise.all([page.waitForEvent('download'), page.locator('.btn-export').filter({ hasText: 'Rapport mensuel' }).click()]);
    expect(pdf.suggestedFilename()).toMatch(/^rapport-missions-\d{4}-\d{2}\.pdf$/);
  });

  test('TA-01 — Kanban : tâche terminée → temps chronométré ajouté à la saisie des temps', async ({ page }) => {
    const { token, api, userId } = await connexion(page);
    const titre = `${TAG} — Rapprochement bancaire ${Date.now()}`;
    const t = await (await api.post(`${API_URL}/clients/${CLIENT_ID}/tasks`, { headers: h(token), data: { titre, type: 'RB', assigneeId: userId } })).json();
    await api.patch(`${API_URL}/clients/${CLIENT_ID}/tasks/${t.id}`, { headers: h(token), data: { statut: 'EN_PAUSE' } });
    psql([`UPDATE tasks SET "tempsTotalSecondes" = 600 WHERE id = ${t.id};`]);   // 10 min chronométrées

    await page.goto(`${APP_URL}/travail/kanban?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    const carte = page.locator('.kanban-card').filter({ hasText: titre });
    await expect(carte).toBeVisible({ timeout: 10_000 });
    await carte.hover();   // actions de la carte affichées au survol
    await carte.locator('.card-act-btn').first().click();
    await page.locator('select.statut-select').selectOption('TERMINEE');
    await Promise.all([
      page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes(`/tasks/${t.id}`)),
      page.locator('.td-btn-save').click(),
    ]);
    // Le toast de la saisie automatique passe après « Tâche mise à jour ».
    await expect(page.locator('mat-snack-bar-container').filter({ hasText: 'Tâche terminée' }))
      .toContainText('Tâche terminée : 0h10 ajoutée à votre saisie des temps', { timeout: 8_000 });

    const saisies = await (await api.get(`${API_URL}/saisies-temps/moi`, { headers: h(token) })).json();
    const s = saisies.find((x: any) => x.taskId === t.id);
    expect(s, 'saisie liée à la tâche').toBeTruthy();
    expect(s).toMatchObject({ dureeHeures: 0.17, type: 'FACTURABLE', missionCode: 'TCO', clientId: CLIENT_ID });
    expect(s.commentaire).toContain(titre);
    await api.dispose();
  });
});
