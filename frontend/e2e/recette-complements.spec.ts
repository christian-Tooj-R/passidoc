/**
 * Tests E2E — compléments de recette (28/10/2026) : parcours jusque-là couverts seulement par les
 * tests serveur ou unitaires.
 *
 *   RC-01 : inscription avec un email déjà utilisé → le message du serveur est affiché
 *   RC-02 : pipeline — filtres statut / cycle / relance / montant (CDC Missions §4.3)
 *   RC-03 : pipeline — « Dernière modif. » suit la modification des informations
 *   RC-04 : liste « Toutes les tâches » — tâche terminée → saisie automatique du temps
 *   RC-05 : Kanban — glisser une carte dans « Terminée » → saisie automatique du temps
 *   RC-06 : R5 — mission refusée l'an passé : « Déjà refusée en 2025 » puis « Reproposer »
 *   RC-07 : droits — collaborateur intervenant (cycles en écriture, pipeline et vue cabinet en lecture)
 *   RC-08 : droits — gérant de pôle (module en lecture seule, pas de vue cabinet)
 *
 * Tenant test-e2e, dossier 2. Données marquées ZZRC (missions, tâches, saisies, comptes
 * zzrc-*@example.com) supprimées avant et après le scénario ; RC-06 retire lui-même ses exercices.
 */
import { test, expect, request as pwRequest } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

const API_URL = 'http://localhost:3000/api';
const APP_URL = process.env['BASE_URL'] ?? 'http://localhost:4200';
const TENANT = 'test-e2e';
const CLIENT_ID = 2;
const TAG = 'ZZRC';
const MDP = 'Test1234!';

function psql(sql: string[]): string {
  const { spawnSync } = require('child_process');
  const r = spawnSync('docker', ['exec', '-i', 'passidoc-postgres', 'psql', '-U', 'passidoc_user', '-d', 'passidoc_db', '-tA'],
    { input: [...sql, '\\q'].join('\n'), encoding: 'utf-8' });
  return String(r.stdout ?? '').trim();
}
const MENAGE = [
  `DELETE FROM missions WHERE titre LIKE '${TAG}%';`,
  `DELETE FROM saisies_temps WHERE commentaire LIKE '${TAG}%';`,
  `DELETE FROM tasks WHERE titre LIKE '${TAG}%';`,
  `UPDATE clients SET "collaborateurOuestId" = NULL WHERE "collaborateurOuestId" IN (SELECT id FROM users WHERE email LIKE 'zzrc-%');`,
  `DELETE FROM notifications WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'zzrc-%');`,
  `DELETE FROM pause_pointages WHERE "pointageId" IN (SELECT p.id FROM pointages p JOIN users u ON u.id = p."userId" WHERE u.email LIKE 'zzrc-%');`,
  `DELETE FROM pointages WHERE "userId" IN (SELECT id FROM users WHERE email LIKE 'zzrc-%');`,
  `DELETE FROM users WHERE email LIKE 'zzrc-%';`,
];

async function connexion(page: Page, email = 'e2e@test.com'): Promise<{ token: string; api: APIRequestContext; userId: number }> {
  const api = await pwRequest.newContext();
  const body = await (await api.post(`${API_URL}/auth/login`, {
    headers: { 'x-tenant-slug': TENANT }, data: { email, password: MDP },
  })).json();
  expect(body.access_token, `connexion ${email}`).toBeTruthy();
  // Pointer l'arrivée du jour : sinon la fenêtre de pointage bloque tous les clics.
  await api.post(`${API_URL}/pointage/pointer`, { headers: { Authorization: `Bearer ${body.access_token}` }, data: {} }).catch(() => {});
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
const M = `${API_URL}/clients/${CLIENT_ID}/missions`;

async function ongletMissions(page: Page) {
  await page.goto(`${APP_URL}/clients/${CLIENT_ID}?tab=missions&tenant=${TENANT}`);
  await page.waitForLoadState('networkidle');
  const tab = page.locator('app-missions-tab');
  await expect(tab.locator('.mt-tab').first()).toBeVisible({ timeout: 10_000 });
  return tab;
}
async function pipeline(page: Page) {
  const tab = await ongletMissions(page);
  await tab.locator('.mt-tab').filter({ hasText: 'Pipeline' }).click();
  return tab;
}
async function ouvrirCycle(page: Page, nom: string) {
  const hd = page.locator('app-missions-tab .cy-h').filter({ hasText: nom }).first();
  if ((await hd.getAttribute('aria-expanded')) !== 'true') await hd.click();
}
const dialogue = (page: Page) => page.locator('app-mission-form-dialog');
const toastTache = (page: Page) => page.locator('mat-snack-bar-container').filter({ hasText: 'Tâche terminée' });

/** Tâche du dossier assignée à l'utilisateur, en pause, avec `secondes` déjà chronométrées. */
async function tacheChronometree(api: APIRequestContext, token: string, userId: number, titre: string, secondes: number) {
  const t = await (await api.post(`${API_URL}/clients/${CLIENT_ID}/tasks`, { headers: h(token), data: { titre, type: 'RB', assigneeId: userId } })).json();
  await api.patch(`${API_URL}/clients/${CLIENT_ID}/tasks/${t.id}`, { headers: h(token), data: { statut: 'EN_PAUSE' } });
  psql([`UPDATE tasks SET "tempsTotalSecondes" = ${secondes} WHERE id = ${t.id};`]);
  return t as { id: number };
}

test.describe.serial('Compléments de recette — Missions, saisie automatique, droits', () => {
  test.beforeAll(() => { psql(MENAGE); });
  test.afterAll(() => { psql(MENAGE); });

  test('RC-01 — inscription avec un email déjà utilisé : le vrai motif est affiché', async ({ page }) => {
    await page.goto(`${APP_URL}/auth/login?tenant=${TENANT}`);
    await page.locator('button').filter({ hasText: 'Créer un compte' }).first().click();
    const f = (n: string) => page.locator(`input[formcontrolname="${n}"]`);
    await f('firstName').fill('Zz');
    await f('lastName').fill('Recette');
    await f('email').fill('e2e@test.com');   // compte existant du cabinet test-e2e
    await f('password').fill('MotDePasse!2026');
    await f('confirmPassword').fill('MotDePasse!2026');
    const [rep] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/auth/register')),
      page.locator('button[type="submit"]').filter({ hasText: 'Créer mon compte' }).click(),
    ]);
    expect(rep.status()).toBe(409);
    await expect(page.getByText('Cet email est déjà utilisé dans ce cabinet')).toBeVisible();
    await expect(page.getByText('Erreur lors de la création du compte')).toHaveCount(0);
  });

  test('RC-02 — pipeline : filtres par statut, cycle, relance dépassée et montant', async ({ page }) => {
    const { token, api } = await connexion(page);
    const A = `${TAG} — Analyse concentration clients`, B = `${TAG} — Mission ponctuelle`, C = `${TAG} — Plan de trésorerie`;
    for (const data of [
      { titre: A, statut: 'EN_DISCUSSION', cycle: 'CLI', honoraires: 2500, dateRelance: '2026-01-10' },
      { titre: B, statut: 'PROPOSEE' },
      { titre: C, statut: 'ACCEPTEE', cycle: 'TRE', honoraires: 1000, dateRelance: '2099-12-31' },
    ]) expect((await api.post(M, { headers: h(token), data })).status()).toBe(201);

    const tab = await pipeline(page);
    const ligne = (t: string) => tab.locator('tbody tr').filter({ hasText: t });
    const visibles = async (attendues: string[], cachees: string[]) => {
      for (const t of attendues) await expect(ligne(t)).toHaveCount(1);
      for (const t of cachees) await expect(ligne(t)).toHaveCount(0);
    };
    await visibles([A, B, C], []);

    const filtre = (label: string) => tab.locator(`.bar select[aria-label="${label}"]`);
    await filtre('Filtrer par statut').selectOption('EN_DISCUSSION');
    await visibles([A], [B, C]);
    await filtre('Filtrer par statut').selectOption('');

    await filtre("Filtrer par cycle d'origine").selectOption('HORS_CYCLE');
    await visibles([B], [A, C]);
    await expect(ligne(B)).toContainText('Hors cycle');
    await filtre("Filtrer par cycle d'origine").selectOption('CLI');
    await visibles([A], [B, C]);
    await filtre("Filtrer par cycle d'origine").selectOption('');

    await filtre('Filtrer par date de relance').selectOption('RETARD');
    await visibles([A], [B, C]);
    await expect(ligne(A).locator('.badge-relance')).toHaveText('À relancer');
    await filtre('Filtrer par date de relance').selectOption('');

    await tab.locator('.bar label.chk').filter({ hasText: 'Avec montant' }).locator('input').check();
    await visibles([A, C], [B]);
    await api.dispose();
  });

  test('RC-03 — pipeline : « Dernière modif. » prend la date de la modification', async ({ page }) => {
    const { api } = await connexion(page);
    const B = `${TAG} — Mission ponctuelle`;
    psql([`UPDATE missions SET "updatedAt" = '2026-01-05 10:00', "statutModifieLe" = '2026-01-05 10:00' WHERE titre = '${B}';`]);
    const tab = await pipeline(page);
    const ligne = tab.locator('tbody tr').filter({ hasText: B });
    await expect(ligne.locator('td').last()).toHaveText('05/01/2026');

    await ligne.locator('.lnk').click();
    await dialogue(page).locator('textarea[name="description"]').fill(`${TAG} — précision ajoutée`);
    await Promise.all([
      page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes('/missions/')),
      dialogue(page).locator('button').filter({ hasText: 'Enregistrer' }).click(),
    ]);
    await expect(dialogue(page)).toBeHidden();
    await expect(tab.locator('tbody tr').filter({ hasText: B }).locator('td').last())
      .toHaveText(new Date().toLocaleDateString('fr-FR'));
    await api.dispose();
  });

  test('RC-04 — « Toutes les tâches » : tâche terminée → temps ajouté à la saisie', async ({ page }) => {
    const { token, api, userId } = await connexion(page);
    const titre = `${TAG} — Lettrage fournisseurs ${Date.now()}`;
    const t = await tacheChronometree(api, token, userId, titre, 300);

    await page.goto(`${APP_URL}/travail/taches?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.locator('tr.data-row').filter({ hasText: titre }).click();
    await page.locator('select.statut-select').selectOption('TERMINEE');
    await Promise.all([
      page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes(`/tasks/${t.id}`)),
      page.locator('.td-btn-save').click(),
    ]);
    await expect(toastTache(page)).toContainText('Tâche terminée : 0h05 ajoutée à votre saisie des temps', { timeout: 8_000 });

    const saisies = await (await api.get(`${API_URL}/saisies-temps/moi`, { headers: h(token) })).json();
    expect(saisies.find((x: any) => x.taskId === t.id)).toMatchObject({ dureeHeures: 0.08, clientId: CLIENT_ID });
    await api.dispose();
  });

  test('RC-05 — Kanban : glisser la carte dans « Terminée » → temps ajouté à la saisie', async ({ page }) => {
    const { token, api, userId } = await connexion(page);
    const titre = `${TAG} — Révision TVA ${Date.now()}`;
    const t = await tacheChronometree(api, token, userId, titre, 240);

    await page.goto(`${APP_URL}/travail/kanban?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    const carte = page.locator('.kanban-card').filter({ hasText: titre });
    await expect(carte).toBeVisible({ timeout: 10_000 });
    const cible = page.locator('.kanban-col').filter({ has: page.locator('text=Terminée') }).locator('.col-body');
    // Le glisser part de la poignée (cdkDragHandle) ; carte centrée pour ne pas passer sous le menu.
    await carte.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
    const poignee = carte.locator('.card-drag-handle');
    const a = (await poignee.boundingBox())!, b = (await cible.boundingBox())!;
    const [rep] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes(`/tasks/${t.id}`)),
      (async () => {
        await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
        await page.mouse.down();
        await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, { steps: 5 });
        await page.mouse.move(b.x + b.width / 2, b.y + 40, { steps: 25 });
        await page.mouse.up();
      })(),
    ]);
    expect(rep.ok()).toBeTruthy();
    await expect(toastTache(page)).toContainText('Tâche terminée : 0h04 ajoutée à votre saisie des temps', { timeout: 8_000 });
    await api.dispose();
  });

  test('RC-06 — R5 : la mission refusée en 2025 réapparaît, et se repropose', async ({ page }) => {
    const { token, api } = await connexion(page);
    const ids = psql([
      `INSERT INTO exercices (annee, "dateOuverture", "dateCloture", statut, "clientId") VALUES
         (2025, '2025-01-01', '2025-12-31', 'OUVERT', ${CLIENT_ID}), (2026, '2026-01-01', '2026-12-31', 'OUVERT', ${CLIENT_ID}) RETURNING id;`,
    ]).split('\n').map(Number).filter(Boolean);
    expect(ids).toHaveLength(2);
    const [e25, e26] = ids;
    try {
      const refusee = `${TAG} — Audit prévoyance / mutuelle`;
      expect((await api.post(M, { headers: h(token), data: { titre: refusee, statut: 'REFUSEE', cycle: 'SOC', exerciceId: e25, honoraires: 1500 } })).status()).toBe(201);
      psql([`UPDATE exercices SET statut = 'CLOTURE' WHERE id = ${e25};`]);

      const tab = await ongletMissions(page);
      await expect(tab.locator('.mt-ctx')).toContainText('Exercice 2026');
      await ouvrirCycle(page, 'Social');
      const memo = tab.locator('.cy--open .memo').filter({ hasText: refusee });
      await expect(memo).toContainText('Déjà refusée en 2025');
      await memo.locator('button').filter({ hasText: 'Reproposer' }).click();
      await expect(dialogue(page).locator('input[name="titre"]')).toHaveValue(refusee);
      await Promise.all([
        page.waitForResponse(r => r.request().method() === 'POST' && /\/clients\/\d+\/missions$/.test(new URL(r.url()).pathname)),
        dialogue(page).locator('button').filter({ hasText: 'Créer la mission' }).click(),
      ]);
      await expect(dialogue(page)).toBeHidden();
      await expect(tab.locator('.cy--open .memo').filter({ hasText: refusee })).toHaveCount(0);
      await expect(tab.locator('.cy--open .ml').filter({ hasText: refusee })).toBeVisible();
      const repris = psql([`SELECT count(*) FROM missions WHERE "repriseDeId" IS NOT NULL AND "exerciceId" = ${e26} AND titre = '${refusee}';`]);
      expect(repris).toBe('1');
    } finally {
      psql([`DELETE FROM missions WHERE titre LIKE '${TAG}%' AND "exerciceId" IN (${e25}, ${e26});`, `DELETE FROM exercices WHERE id IN (${e25}, ${e26});`]);
      await api.dispose();
    }
  });

  test.describe('Droits par rôle', () => {
    const stamp = Date.now();
    const COLLAB = `zzrc-collab-${stamp}@example.com`, GERANT = `zzrc-gerant-${stamp}@example.com`;
    const M_COLLAB = `${TAG} — Mission du collaborateur`, M_AUTRE = `${TAG} — Mission d'un autre responsable`;

    test.beforeAll(async () => {
      const api = await pwRequest.newContext();
      const admin = await (await api.post(`${API_URL}/auth/login`, { headers: { 'x-tenant-slug': TENANT }, data: { email: 'e2e@test.com', password: MDP } })).json();
      const creer = async (email: string, role: string, site: string) => {
        const r = await api.post(`${API_URL}/users`, { headers: h(admin.access_token), data: { email, firstName: 'ZZRC', lastName: role, password: MDP, role, site } });
        expect(r.status(), `création ${role}`).toBe(201);
        return (await r.json()).id as number;
      };
      const collabId = await creer(COLLAB, 'COLLABORATEUR', 'EST');
      await creer(GERANT, 'GERANT_OUEST', 'OUEST');
      psql([`UPDATE clients SET "collaborateurOuestId" = ${collabId} WHERE id = ${CLIENT_ID} AND "collaborateurOuestId" IS NULL;`]);
      for (const data of [{ titre: M_COLLAB, cycle: 'CLI', responsableId: collabId }, { titre: M_AUTRE }]) {
        expect((await api.post(M, { headers: h(admin.access_token), data })).status()).toBe(201);
      }
      await api.dispose();
    });

    test('RC-07 — collaborateur intervenant : cycles en écriture, pipeline et vue cabinet en lecture', async ({ page }) => {
      const { api } = await connexion(page, COLLAB);
      const tab = await ongletMissions(page);
      await ouvrirCycle(page, 'Clients');
      await expect(tab.locator('.cy--open .b-add')).toBeVisible();
      await expect(tab.locator('.cy--open textarea')).toBeEnabled();

      await tab.locator('.mt-tab').filter({ hasText: 'Pipeline' }).click();
      await expect(tab.locator('.btn-new')).toHaveCount(0);
      await expect(tab.locator('tbody tr').filter({ hasText: M_COLLAB }).locator('select')).toHaveCount(0);

      await page.goto(`${APP_URL}/missions?tenant=${TENANT}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('tbody tr').filter({ hasText: M_COLLAB })).toBeVisible();
      await expect(page.locator('tbody tr').filter({ hasText: M_AUTRE })).toHaveCount(0);
      await expect(page.locator('.foot')).toContainText('lecture seule');
      await api.dispose();
    });

    test('RC-08 — gérant de pôle : module Missions en lecture seule, pas de vue cabinet', async ({ page }) => {
      const { api } = await connexion(page, GERANT);
      const tab = await ongletMissions(page);
      await expect(tab.locator('.mt-ctx')).toContainText('Lecture seule');
      await expect(page.locator('a[href^="/missions"]')).toHaveCount(0);
      await ouvrirCycle(page, 'Clients');
      await expect(tab.locator('.cy--open .b-add')).toHaveCount(0);
      await expect(tab.locator('.cy--open textarea')).toBeDisabled();
      await tab.locator('.mt-tab').filter({ hasText: 'Pipeline' }).click();
      await expect(tab.locator('.btn-new')).toHaveCount(0);
      // Consultation d'une mission : détail ouvert, champs non modifiables.
      await tab.locator('tbody tr').filter({ hasText: M_COLLAB }).locator('.lnk').click();
      await expect(dialogue(page).locator('input[name="titre"]')).toBeDisabled();
      await page.keyboard.press('Escape');
      await expect(dialogue(page)).toBeHidden();

      await page.goto(`${APP_URL}/missions?tenant=${TENANT}`);
      await page.waitForLoadState('networkidle');
      await expect(page).not.toHaveURL(/\/missions(\?|$)/);
      await api.dispose();
    });
  });
});
