/**
 * Tests E2E — Remplissage complet via UI + clôture exercice (client 21, tenant afym)
 *
 * Scénario séquentiel (workers: 1) :
 *  1. EC-FILL-*    : remplissage de chaque onglet via l'UI + vérification persistance
 *  2. EC-CLOTURE   : clôture de l'exercice 2027 via le bouton UI
 *  3. EC-VERIFOLD-*: vérification des données sur l'exercice 2027 clôturé
 *  4. EC-VERIFNEW-*: vérification des données sur le nouvel exercice 2028
 *
 * Onglets liés à l'exercice  → changent selon 2027 / 2028 :
 *   Objectifs, Tableau de bord BP (SWOT, Porter, BMC…), Contrôle Interne, Missions › Par cycle
 *
 * Onglets permanents (données client, indépendants de l'exercice) :
 *   Missions, Fiche Identité, Fournisseurs, ADN, Synthèse
 *
 * Ce qui bascule vers 2028 : Objectifs (copiés intégralement)
 * Ce qui reste sur 2027    : Tableau de bord BP, Contrôle Interne, Missions › Par cycle (lecture seule)
 * Repris en brouillon 2028 : Tableau de bord BP (outils de 2027, à mettre à jour puis enregistrer)
 * Ce qui est vierge 2028   : Contrôle Interne, Missions › Par cycle (10 cycles sans recommandation)
 * Permanent inchangé       : Missions › Pipeline (visible sur tous les exercices)
 *
 * (L'ancien « Dossier de travail » est fusionné dans Missions › Par cycle — CDC module Missions ;
 *  les anciens onglets « Stratégie » et « Modèle Canvas » dans le Tableau de bord BP.)
 */

import { test, expect, request as pwRequest } from '@playwright/test';
import type { APIRequestContext, Locator, Page } from '@playwright/test';

// ─── Configuration ─────────────────────────────────────────────────────────────
const API_URL  = 'http://localhost:3000/api';
const APP_URL  = 'http://localhost:4200';
const TENANT   = 'afym';
const EMAIL    = 'admin@admin.com';
const PASS     = 'Admin2024!';
const CLIENT_ID             = 21;
const EXERCICE_OUVERT_ID    = 2;
const EXERCICE_OUVERT_ANNEE = 2027;

const TAG = 'E2E-FULL';

// Données injectées dans chaque onglet — identifiables via TAG
const D = {
  // Tableau de bord BP › Business Model Canvas (exercice → repris en brouillon sur 2028)
  canvas_partenaires : `${TAG} — Partenaires clés : fournisseur X, banque Y`,
  canvas_proposition : `${TAG} — Proposition de valeur : expertise locale et réactivité`,

  // Objectifs (exercice → copié vers 2028)
  obj_12m    : `${TAG} — Objectifs 12 mois : augmenter le CA de 15 %`,
  obj_3a5    : `${TAG} — Objectifs 3-5 ans : ouvrir une deuxième enseigne`,
  obj_attentes: `${TAG} — Attentes : suivi mensuel et tableau de bord trimestriel`,

  // Tableau de bord BP › SWOT et Porter (exercice → reste sur 2027, repris en brouillon sur 2028)
  strat_forces      : `${TAG} — Forces : équipe expérimentée, clientèle fidèle`,
  strat_faiblesses  : `${TAG} — Faiblesses : trésorerie tendue, dépendance fournisseur unique`,
  strat_opportunites: `${TAG} — Opportunités : expansion zone nord`,
  strat_menaces     : `${TAG} — Menaces : inflation des matières premières`,
  strat_porter      : `${TAG} — Concurrence : forte, 15 concurrents locaux identifiés`,

  // Contrôle Interne (exercice → reste sur 2027, vierge sur 2028)
  ci_note: `${TAG} — Note CI : processus de clôture caisse formalisé et contrôlé`,

  // Missions › Par cycle (exercice → reste sur 2027, vierge sur 2028) — unique par exécution
  reco_cli: `${TAG} — Recommandation 2027 : diversifier le portefeuille clients (${Date.now()})`,

  // Missions › Pipeline (permanent)
  mission_titre: `${TAG} — Mission test : mise en place tableau de bord`,

  // Fournisseurs (permanent)
  fourn_nom  : `${TAG} — Fournisseur Test`,
  fourn_email: 'fourn-e2e@test.local',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getToken(api: APIRequestContext): Promise<string> {
  const res = await api.post(`${API_URL}/auth/login`, {
    headers: { 'x-tenant-slug': TENANT },
    data: { email: EMAIL, password: PASS },
  });
  return (await res.json()).access_token;
}

function h(token: string) {
  return { Authorization: `Bearer ${token}`, 'x-tenant-slug': TENANT };
}

async function loginAfym(page: Page): Promise<void> {
  const ctx  = await pwRequest.newContext();
  const token = await getToken(ctx);
  const body  = await (await ctx.post(`${API_URL}/auth/login`, {
    headers: { 'x-tenant-slug': TENANT },
    data: { email: EMAIL, password: PASS },
  })).json();

  await page.goto(`${APP_URL}/?tenant=${TENANT}`);
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(({ token, user, tenant }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenant_slug', tenant);
  }, { token, user: body.user, tenant: TENANT });

  await ctx.post(`${API_URL}/pointage/pointer`, {
    headers: h(token),
    data: { latitude: null, longitude: null, action: 'ENTREE' },
  }).catch(() => {});

  await page.goto(`${APP_URL}/?tenant=${TENANT}`);
  await page.waitForLoadState('networkidle');
  await ctx.dispose();
}

async function goToClient(page: Page): Promise<void> {
  await page.goto(`${APP_URL}/clients/${CLIENT_ID}?tenant=${TENANT}`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.exercice-banner', { timeout: 10_000 }).catch(() => {});
}

async function clickTab(page: Page, label: string): Promise<void> {
  // Le Tableau de bord BP remplace le menu du dossier : en sortir d'abord.
  const retour = page.locator('.bpnav__retour');
  if (await retour.isVisible()) { await retour.click(); await page.waitForTimeout(300); }
  await page.locator('.sidenav__item').filter({ hasText: new RegExp(label, 'i') }).first().click();
  await page.waitForTimeout(800);
}

/** Onglets en mode « Modifier / Enregistrer » : passer en édition via l'en-tête du dossier. */
async function modifierViaEntete(page: Page): Promise<void> {
  const btn = page.locator('.ch-edit-btn');
  await expect(btn).toBeVisible({ timeout: 8_000 });
  await btn.click();
  await page.waitForTimeout(400);
}

/** Enregistrer via l'en-tête du dossier (TabSaveService) et attendre la réponse de l'API. */
async function enregistrerViaEntete(page: Page): Promise<void> {
  const btn = page.locator('.ch-save-btn');
  await expect(btn).toBeVisible({ timeout: 8_000 });
  await Promise.all([
    page.waitForResponse(r => ['PATCH', 'PUT', 'POST'].includes(r.request().method()) && r.url().includes('/api/'), { timeout: 10_000 }).catch(() => null),
    btn.click(),
  ]);
  await page.waitForTimeout(800);
}

/** Missions › Par cycle : déplier un cycle de révision (accordéon). */
async function ouvrirCycle(page: Page, nom: string): Promise<void> {
  const h = page.locator('app-missions-tab .cy-h').filter({ hasText: nom }).first();
  await expect(h).toBeVisible({ timeout: 8_000 });
  if ((await h.getAttribute('aria-expanded')) !== 'true') await h.click();
  await page.waitForTimeout(300);
}

/** Supprime les missions et recommandations créées par ce scénario (tag E2E-FULL). */
const MENAGE_MISSIONS = [
  `DELETE FROM missions WHERE "clientId" = ${CLIENT_ID} AND titre LIKE '${TAG}%';`,
  `DELETE FROM recommandations_cycles WHERE "clientId" = ${CLIENT_ID} AND texte LIKE '${TAG}%';`,
  `DELETE FROM outils_bp WHERE "clientId" = ${CLIENT_ID} AND contenu::text LIKE '%${TAG}%';`,
];

/** Tableau de bord BP : ouvre un outil depuis son menu (il remplace celui du dossier). */
async function ouvrirOutilBp(page: Page, outil: string): Promise<void> {
  if (!(await page.locator('.bpnav').isVisible())) await clickTab(page, 'Tableau de bord BP');
  const lien = page.locator('.bpnav__outil').filter({ hasText: outil }).first();
  await expect(lien).toBeVisible({ timeout: 10_000 });
  await lien.click();
  await page.waitForTimeout(300);
}

/** Tableau de bord BP : « Enregistrer » de l'outil, attendre la réponse de l'API. */
async function enregistrerBp(page: Page): Promise<void> {
  const btn = page.locator('app-bp-tab .bp__enregistrer');
  await expect(btn).toBeVisible({ timeout: 8_000 });
  await Promise.all([
    page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes('/bp/'), { timeout: 10_000 }).catch(() => null),
    btn.click(),
  ]);
  await page.waitForTimeout(800);
}

/** Ajoute un élément à une liste d'un outil BP (quadrant, bloc, force) par « + Ajouter ». */
async function ajouterElementBp(zone: Locator, texte: string): Promise<void> {
  await zone.locator('.bl__ajouter').click();
  const champ = zone.locator('.bl__input--nouveau');
  await champ.fill(texte);
  await champ.press('Enter');
}

/** Textes d'une liste d'un outil BP, en édition (champs) comme en lecture (attend l'affichage de l'outil). */
async function textesBp(zone: Locator): Promise<string[]> {
  await expect(zone).toBeVisible({ timeout: 8_000 });
  await expect(zone.locator('.bl__item').first()).toBeVisible({ timeout: 8_000 }).catch(() => {});
  return zone.locator('.bl__item').evaluateAll(items => items.map(li =>
    (li.querySelector('textarea') as HTMLTextAreaElement | null)?.value ?? li.querySelector('.bl__texte')?.textContent?.trim() ?? ''));
}

async function switchToExercice(page: Page, annee: number): Promise<void> {
  await expect(page.locator('.exercice-banner')).toBeVisible({ timeout: 15_000 });
  const current = await page.locator('.eb-period').textContent().catch(() => '');
  if (current?.includes(String(annee))) return;

  const select = page.locator('.eb-select');
  // Le select n'est affiché que si exercices().length > 1 (template Angular)
  const selectVisible = await select.isVisible().catch(() => false);
  if (!selectVisible) {
    // Un seul exercice : vérifier qu'on est déjà dessus
    const period = await page.locator('.eb-period').textContent().catch(() => '');
    if (!period?.includes(String(annee)))
      throw new Error(`Select non visible et period=${period?.trim()} ≠ ${annee}`);
    return;
  }

  // Sélectionner l'option via evaluate pour utiliser la propriété DOM (pas l'attribut HTML)
  // et dispatcher change dans le contexte de la page (zone.js intercepte)
  const found = await page.evaluate((yr: number) => {
    const sel = document.querySelector('.eb-select') as HTMLSelectElement | null;
    if (!sel) return false;
    const opt = Array.from(sel.options).find(o => o.text.includes(String(yr)));
    if (!opt) return false;
    sel.value = opt.value;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, annee);

  if (!found) throw new Error(`Option exercice ${annee} introuvable dans le select`);
  await expect(page.locator('.eb-period')).toContainText(String(annee), { timeout: 10_000 });
  // Laisser Angular appliquer les classes (statut CLOTURE/OUVERT)
  await page.waitForTimeout(600);
}

// ─── Suite ─────────────────────────────────────────────────────────────────────

test.describe('Remplissage complet UI + clôture exercice client 21', () => {
  let token = '';

  test.beforeAll(async () => {
    // Nettoyage préventif : garantir l'état initial avant chaque run
    const { spawnSync } = require('child_process');
    spawnSync(
      'docker',
      ['exec', '-i', 'passidoc-postgres', 'psql', '-U', 'passidoc_user', '-d', 'passidoc_db'],
      {
        input: [
          `DELETE FROM exercices WHERE "clientId" = ${CLIENT_ID} AND annee = ${EXERCICE_OUVERT_ANNEE + 1};`,
          `UPDATE exercices SET statut='OUVERT', "clotureLeAt"=NULL, "clotureParId"=NULL WHERE id = ${EXERCICE_OUVERT_ID};`,
          ...MENAGE_MISSIONS,
          '\\q',
        ].join('\n'),
        encoding: 'utf-8',
      },
    );

    const api = await pwRequest.newContext();
    token = await getToken(api);
    const exercices = await (await api.get(
      `${API_URL}/clients/${CLIENT_ID}/exercices`, { headers: h(token) }
    )).json();
    const ouvert = exercices.find((e: { id: number; statut: string }) =>
      e.id === EXERCICE_OUVERT_ID && e.statut === 'OUVERT');
    if (!ouvert) throw new Error(`Exercice ${EXERCICE_OUVERT_ID} n'est pas OUVERT — réinitialisez la DB`);
    await api.dispose();
  });

  test.afterAll(async () => {
    const { spawnSync } = require('child_process');
    spawnSync('docker', ['exec', '-i', 'passidoc-postgres', 'psql', '-U', 'passidoc_user', '-d', 'passidoc_db'], {
      input: [
        `DELETE FROM exercices WHERE "clientId" = ${CLIENT_ID} AND annee = ${EXERCICE_OUVERT_ANNEE + 1};`,
        `UPDATE exercices SET statut='OUVERT', "clotureLeAt"=NULL, "clotureParId"=NULL WHERE id = ${EXERCICE_OUVERT_ID};`,
        ...MENAGE_MISSIONS,
      ].join('\n'),
      encoding: 'utf-8',
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REMPLISSAGE — un test par onglet, chacun vérifie la persistance
  // ═══════════════════════════════════════════════════════════════════════════

  test('EC-FILL-1 — Tableau de bord BP › BMC : partenaires + proposition de valeur', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await ouvrirOutilBp(page, 'Business Model Canvas');

    const bmc = page.locator('app-bp-bmc');
    await expect(bmc).toBeVisible({ timeout: 8_000 });
    await ajouterElementBp(bmc.locator('[data-zone="partenaires"]'), D.canvas_partenaires);
    await ajouterElementBp(bmc.locator('[data-zone="proposition"]'), D.canvas_proposition);

    await enregistrerBp(page);

    // Persistance : recharger et revérifier
    await goToClient(page);
    await ouvrirOutilBp(page, 'Business Model Canvas');
    expect(await textesBp(page.locator('app-bp-bmc [data-zone="partenaires"]'))).toContain(D.canvas_partenaires);
    expect(await textesBp(page.locator('app-bp-bmc [data-zone="proposition"]'))).toContain(D.canvas_proposition);
  });

  test('EC-FILL-2 — Objectifs : remplir objectifs 12 mois, 3-5 ans, attentes', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await clickTab(page, 'Objectifs');

    const tab = page.locator('app-objectifs-tab');
    await expect(tab).toBeVisible({ timeout: 8_000 });

    // Les 3 premiers textareas = objectifs12mois, objectifs3a5ans, objectifsLongTerme
    // puis 2 inputs (depuisQuand, qualiteRelation), puis attentesClient (textarea[3])
    const tas = tab.locator('textarea');
    await expect(tas.first()).toBeVisible({ timeout: 6_000 });
    await tas.nth(0).fill(D.obj_12m);
    await tas.nth(1).fill(D.obj_3a5);
    await tas.nth(3).fill(D.obj_attentes);

    await enregistrerViaEntete(page);

    // Persistance
    await goToClient(page);
    await clickTab(page, 'Objectifs');
    await expect(page.locator('app-objectifs-tab textarea').nth(0)).toHaveValue(D.obj_12m);
    await expect(page.locator('app-objectifs-tab textarea').nth(1)).toHaveValue(D.obj_3a5);
    await expect(page.locator('app-objectifs-tab textarea').nth(3)).toHaveValue(D.obj_attentes);
  });

  test('EC-FILL-3 — Tableau de bord BP : remplir SWOT et Porter', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await ouvrirOutilBp(page, 'SWOT');

    const swot = page.locator('app-bp-swot');
    await expect(swot).toBeVisible({ timeout: 8_000 });
    await ajouterElementBp(swot.locator('[data-zone="forces"]'), D.strat_forces);
    await ajouterElementBp(swot.locator('[data-zone="faiblesses"]'), D.strat_faiblesses);
    await ajouterElementBp(swot.locator('[data-zone="opportunites"]'), D.strat_opportunites);
    await ajouterElementBp(swot.locator('[data-zone="menaces"]'), D.strat_menaces);

    // Porter : élément identifié sur l'intensité concurrentielle (enregistré avec le SWOT)
    await ouvrirOutilBp(page, 'Porter');
    await ajouterElementBp(page.locator('app-bp-porter [data-force="concurrence"]'), D.strat_porter);

    await enregistrerBp(page);

    // Persistance
    await goToClient(page);
    await ouvrirOutilBp(page, 'SWOT');
    const relu = page.locator('app-bp-swot');
    expect(await textesBp(relu.locator('[data-zone="forces"]'))).toContain(D.strat_forces);
    expect(await textesBp(relu.locator('[data-zone="faiblesses"]'))).toContain(D.strat_faiblesses);
    expect(await textesBp(relu.locator('[data-zone="opportunites"]'))).toContain(D.strat_opportunites);
    expect(await textesBp(relu.locator('[data-zone="menaces"]'))).toContain(D.strat_menaces);
    await ouvrirOutilBp(page, 'Porter');
    expect(await textesBp(page.locator('app-bp-porter [data-force="concurrence"]'))).toContain(D.strat_porter);
  });

  test('EC-FILL-4 — Contrôle Interne : remplir note générale', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await clickTab(page, 'Contrôle');

    const tab = page.locator('app-controle-interne-tab');
    await expect(tab).toBeVisible({ timeout: 8_000 });

    // Note générale — placeholder "Observations générales..."
    await tab.locator('textarea[placeholder*="Observations"]').fill(D.ci_note);

    await enregistrerViaEntete(page);

    // Persistance
    await goToClient(page);
    await clickTab(page, 'Contrôle');
    await expect(page.locator('app-controle-interne-tab textarea[placeholder*="Observations"]')).toHaveValue(D.ci_note);
  });

  test('EC-FILL-5 — Missions › Par cycle : recommandation sur le cycle Clients', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await clickTab(page, 'Missions');

    const tab = page.locator('app-missions-tab');
    await expect(tab).toBeVisible({ timeout: 8_000 });
    await expect(tab.locator('.cy')).toHaveCount(10);
    await ouvrirCycle(page, 'Clients');

    const ta = tab.locator('.cy--open textarea');
    await ta.fill(D.reco_cli);
    // Enregistré à la sortie du champ ou via « Enregistrer » (le blur n'est pas fiable en headless).
    await Promise.all([
      page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes('/cycles/CLI/recommandation'), { timeout: 10_000 }),
      tab.locator('.cy--open .b-mini').filter({ hasText: 'Enregistrer' }).click(),
    ]);
    await expect(tab.locator('.cy--open .ok')).toContainText('Enregistré');

    // Persistance : recharger et revérifier
    await goToClient(page);
    await clickTab(page, 'Missions');
    await ouvrirCycle(page, 'Clients');
    await expect(page.locator('app-missions-tab .cy--open textarea')).toHaveValue(D.reco_cli);
    await expect(page.locator('app-missions-tab .cy-h').filter({ hasText: 'Clients' })).toContainText('1 recommandation');
  });

  test('EC-FILL-6 — Missions : proposer une mission depuis un cycle, visible dans le pipeline', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await clickTab(page, 'Missions');

    const tab = page.locator('app-missions-tab');
    await expect(tab).toBeVisible({ timeout: 8_000 });
    await ouvrirCycle(page, 'Clients');
    await tab.locator('.cy--open .b-add').click();

    const dlg = page.locator('app-mission-form-dialog');
    await expect(dlg).toBeVisible({ timeout: 6_000 });
    await expect(dlg).toContainText('CLI');
    await dlg.locator('input[name="titre"]').fill(D.mission_titre);
    await dlg.locator('input[name="honoraires"]').fill('2500');
    await Promise.all([
      page.waitForResponse(r => r.request().method() === 'POST' && /\/clients\/\d+\/missions$/.test(new URL(r.url()).pathname), { timeout: 10_000 }),
      dlg.locator('button').filter({ hasText: 'Créer la mission' }).click(),
    ]);
    await expect(dlg).toBeHidden({ timeout: 6_000 });

    await expect(tab.locator('.cy--open .ml').filter({ hasText: D.mission_titre }).first()).toBeVisible({ timeout: 6_000 });
    // R1 : la mission apparaît automatiquement dans le pipeline, avec son cycle d'origine.
    await tab.locator('.mt-tab').filter({ hasText: 'Pipeline' }).click();
    const ligne = tab.locator('tbody tr').filter({ hasText: D.mission_titre }).first();
    await expect(ligne).toBeVisible({ timeout: 6_000 });
    await expect(ligne).toContainText('Clients');
    await expect(ligne).toContainText('Proposée');
  });

  test('EC-FILL-7 — Fournisseurs : ajouter un fournisseur', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await clickTab(page, 'Fournisseurs');

    const tab = page.locator('app-fournisseurs-tab');
    await expect(tab).toBeVisible({ timeout: 8_000 });

    // Ouvrir le formulaire d'ajout (bouton btn-add, texte "Ajouter un fournisseur" ou similaire)
    const addBtn = tab.locator('button.btn-add').first();
    await expect(addBtn).toBeVisible({ timeout: 6_000 });
    await addBtn.click();
    await page.waitForTimeout(400);

    // Remplir le formulaire (match exact pour éviter le conflit avec contact@société.fr)
    await tab.locator('input[placeholder="Nom de la société"]').fill(D.fourn_nom);
    await tab.locator('input[type="email"]').fill(D.fourn_email);

    await tab.locator('button[type="submit"]').click();
    await page.waitForTimeout(1_000);

    // Vérifier qu'au moins un fournisseur avec ce nom est listé (first() évite le strict mode si déjà créé)
    await expect(tab.getByText(D.fourn_nom, { exact: false }).first()).toBeVisible({ timeout: 6_000 });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLÔTURE
  // ═══════════════════════════════════════════════════════════════════════════

  test('EC-CLOTURE — clôturer l\'exercice 2027 via le bouton UI', async ({ page }) => {
    page.on('dialog', d => d.accept());

    await loginAfym(page);
    await goToClient(page);

    await expect(page.locator('.eb-btn-cloture')).toBeVisible({ timeout: 8_000 });
    await page.locator('.eb-btn-cloture').click();

    // L'app bascule automatiquement sur le nouvel exercice 2028 ouvert
    await expect(page.locator('.eb-period')).toContainText(String(EXERCICE_OUVERT_ANNEE + 1), { timeout: 15_000 });
    await expect(page.locator('.eb-label')).toContainText(/exercice en cours/i);

    // Vérification API : 2027 clôturé et 2028 créé
    const api = await pwRequest.newContext();
    const exs = await (await api.get(
      `${API_URL}/clients/${CLIENT_ID}/exercices`, { headers: h(token) }
    )).json();
    const closed = exs.find((e: { id: number; statut: string }) => e.id === EXERCICE_OUVERT_ID);
    expect(closed?.statut, 'Exercice 2027 doit être CLOTURE').toBe('CLOTURE');
    const next = exs.find((e: { annee: number; statut: string }) =>
      e.annee === EXERCICE_OUVERT_ANNEE + 1 && e.statut === 'OUVERT');
    expect(next?.id, 'Exercice 2028 doit exister').toBeGreaterThan(0);
    await api.dispose();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VÉRIFICATIONS — exercice 2027 clôturé (données préservées, lecture seule)
  // ═══════════════════════════════════════════════════════════════════════════

  test('EC-VERIFOLD-1 — 2027 : bannière clôturée + badge lecture seule', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE);

    await expect(page.locator('.exercice-banner--cloture')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.eb-readonly-badge')).toBeVisible();
    await expect(page.locator('.eb-label')).toContainText(/exercice clôturé/i);
    await expect(page.locator('.eb-btn-cloture')).not.toBeVisible();
  });

  test('EC-VERIFOLD-2 — 2027 : objectifs préservés et en lecture seule', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE);
    await expect(page.locator('.exercice-banner--cloture')).toBeVisible({ timeout: 15_000 });

    await clickTab(page, 'Objectifs');
    const tab = page.locator('app-objectifs-tab');
    await expect(tab).toBeVisible({ timeout: 8_000 });

    await expect(tab.locator('textarea').nth(0)).toHaveValue(D.obj_12m);
    await expect(tab.locator('textarea').nth(1)).toHaveValue(D.obj_3a5);
    await expect(tab.locator('textarea').nth(3)).toHaveValue(D.obj_attentes);

    // L'app utilise pointer-events:none (CSS) et non l'attribut HTML readonly
    const pointerEvents = await tab.locator('textarea').first().evaluate(
      (el: HTMLElement) => window.getComputedStyle(el).pointerEvents
    );
    expect(pointerEvents, 'Objectifs 2027 doit être non-interactif').toBe('none');
  });

  test('EC-VERIFOLD-3 — 2027 : Tableau de bord BP préservé, en lecture seule', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE);
    await expect(page.locator('.exercice-banner--cloture')).toBeVisible({ timeout: 15_000 });

    await ouvrirOutilBp(page, 'SWOT');
    const swot = page.locator('app-bp-swot');
    await expect(swot).toBeVisible({ timeout: 8_000 });

    // Exercice clôturé : lecture seule (ni champ, ni « + Ajouter », ni Enregistrer)
    expect(await textesBp(swot.locator('[data-zone="forces"]'))).toContain(D.strat_forces);
    expect(await textesBp(swot.locator('[data-zone="faiblesses"]'))).toContain(D.strat_faiblesses);
    expect(await textesBp(swot.locator('[data-zone="opportunites"]'))).toContain(D.strat_opportunites);
    expect(await textesBp(swot.locator('[data-zone="menaces"]'))).toContain(D.strat_menaces);
    await expect(swot.locator('textarea')).toHaveCount(0);
    await expect(swot.locator('.bl__ajouter')).toHaveCount(0);
    await expect(page.locator('app-bp-tab .bp__enregistrer')).toHaveCount(0);
    await expect(page.locator('app-bp-tab .bp__info').filter({ hasText: 'Exercice clôturé' })).toBeVisible();
    // Le menu du BP reste utilisable en consultation
    await ouvrirOutilBp(page, 'Business Model Canvas');
    await expect(page.locator('app-bp-bmc')).toBeVisible();
  });

  test('EC-VERIFOLD-4 — 2027 : contrôle interne préservé', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE);
    await expect(page.locator('.exercice-banner--cloture')).toBeVisible({ timeout: 15_000 });

    await clickTab(page, 'Contrôle');
    const tab = page.locator('app-controle-interne-tab');
    await expect(tab).toBeVisible({ timeout: 8_000 });
    await expect(tab.locator('textarea[placeholder*="Observations"]')).toHaveValue(D.ci_note);
  });

  test('EC-VERIFOLD-5 — 2027 : recommandations et missions du cycle préservées, en lecture seule', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE);
    await expect(page.locator('.exercice-banner--cloture')).toBeVisible({ timeout: 15_000 });

    await clickTab(page, 'Missions');
    const tab = page.locator('app-missions-tab');
    await expect(tab.locator('app-missions-cycles .ro')).toContainText('Exercice clôturé');
    await ouvrirCycle(page, 'Clients');
    const ta = tab.locator('.cy--open textarea');
    await expect(ta).toHaveValue(D.reco_cli);
    await expect(ta).toBeDisabled();
    await expect(tab.locator('.cy--open .b-add')).toHaveCount(0);
    await expect(tab.locator('.cy--open .ml').filter({ hasText: D.mission_titre }).first()).toBeVisible();
    // Pipeline consultable (filtres, détail) mais pas modifiable depuis l'exercice clôturé.
    await tab.locator('.mt-tab').filter({ hasText: 'Pipeline' }).click();
    await expect(tab.locator('tbody tr').filter({ hasText: D.mission_titre }).first()).toBeVisible();
    await expect(tab.locator('.btn-new')).toHaveCount(0);
    await expect(tab.locator('tbody select')).toHaveCount(0);
  });

  test('EC-VERIFOLD-6 — 2027 : grayscale actif (body.exercice-cloture)', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE);
    await expect(page.locator('.exercice-banner--cloture')).toBeVisible({ timeout: 15_000 });
    await clickTab(page, 'Missions');
    await page.waitForTimeout(500);
    const hasClass = await page.evaluate(() => document.body.classList.contains('exercice-cloture'));
    expect(hasClass, 'body doit avoir exercice-cloture').toBe(true);
  });

  test('EC-VERIFOLD-7 — 2027 : BMC du Tableau de bord BP préservé', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE);

    await ouvrirOutilBp(page, 'Business Model Canvas');
    expect(await textesBp(page.locator('app-bp-bmc [data-zone="partenaires"]'))).toContain(D.canvas_partenaires);
    expect(await textesBp(page.locator('app-bp-bmc [data-zone="proposition"]'))).toContain(D.canvas_proposition);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VÉRIFICATIONS — exercice 2028 ouvert (bascule et vierge)
  // ═══════════════════════════════════════════════════════════════════════════

  test('EC-VERIFNEW-1 — 2028 : objectifs copiés intégralement depuis 2027', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE + 1);
    await expect(page.locator('.eb-label')).toContainText(/exercice en cours/i);

    await clickTab(page, 'Objectifs');
    const tab = page.locator('app-objectifs-tab');
    await expect(tab).toBeVisible({ timeout: 8_000 });

    // Copiés depuis 2027
    await expect(tab.locator('textarea').nth(0)).toHaveValue(D.obj_12m);
    await expect(tab.locator('textarea').nth(1)).toHaveValue(D.obj_3a5);
    await expect(tab.locator('textarea').nth(3)).toHaveValue(D.obj_attentes);

    // Éditables (exercice ouvert)
    const isReadonly = await tab.locator('textarea').first().evaluate(el => el.hasAttribute('readonly'));
    expect(isReadonly, 'Objectifs 2028 doit être éditable').toBe(false);
  });

  test('EC-VERIFNEW-2 — 2028 : SWOT repris de 2027 en brouillon, modifiable', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE + 1);

    await ouvrirOutilBp(page, 'SWOT');
    const swot = page.locator('app-bp-swot');
    await expect(swot).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('app-bp-tab .bp__info').filter({ hasText: `Repris de l'exercice ${EXERCICE_OUVERT_ANNEE}` })).toBeVisible();
    expect(await textesBp(swot.locator('[data-zone="forces"]'))).toContain(D.strat_forces);
    await expect(swot.locator('.bl__ajouter').first()).toBeVisible();
  });

  test('EC-VERIFNEW-3 — 2028 : contrôle interne vierge (non copié)', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE + 1);

    await clickTab(page, 'Contrôle');
    const tab = page.locator('app-controle-interne-tab');
    await expect(tab).toBeVisible({ timeout: 8_000 });

    const note = await tab.locator('textarea[placeholder*="Observations"]').inputValue();
    expect(note.includes(TAG), 'Contrôle interne 2028 doit être vierge').toBe(false);
  });

  test('EC-VERIFNEW-4 — 2028 : cycles vierges et modifiables, mission toujours au pipeline', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE + 1);

    await clickTab(page, 'Missions');
    const tab = page.locator('app-missions-tab');
    await expect(tab.locator('.cy')).toHaveCount(10, { timeout: 8_000 });
    const recos = await tab.locator('.cy-h .pill').filter({ hasText: 'recommandation' }).allTextContents();
    expect(recos).toHaveLength(10);
    for (const r of recos) expect(r.trim(), 'Cycle 2028 sans recommandation').toMatch(/^\D*0 recommandation/);

    await ouvrirCycle(page, 'Clients');
    const ta = tab.locator('.cy--open textarea');
    expect((await ta.inputValue()).includes(TAG), 'Recommandations 2028 vierges').toBe(false);
    await expect(ta).toBeEnabled();
    await expect(tab.locator('.cy--open .b-add')).toBeVisible();
    // La mission 2027 n'est pas une mission du cycle 2028…
    await expect(tab.locator('.cy--open .ml').filter({ hasText: D.mission_titre })).toHaveCount(0);
    // … mais le pipeline est permanent.
    await tab.locator('.mt-tab').filter({ hasText: 'Pipeline' }).click();
    await expect(tab.locator('tbody tr').filter({ hasText: D.mission_titre }).first()).toBeVisible({ timeout: 6_000 });
  });

  test('EC-VERIFNEW-5 — 2028 : interface éditable, pas de grayscale, bouton clôturer présent', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE + 1);
    await expect(page.locator('.eb-label')).toContainText(/exercice en cours/i);

    await clickTab(page, 'Missions');
    await page.waitForTimeout(500);

    const hasClass = await page.evaluate(() => document.body.classList.contains('exercice-cloture'));
    expect(hasClass, 'body ne doit PAS avoir exercice-cloture sur 2028').toBe(false);
    await expect(page.locator('.eb-btn-cloture')).toBeVisible();
    await expect(page.locator('.eb-readonly-badge')).not.toBeVisible();
  });

  test('EC-VERIFNEW-6 — 2028 : BMC repris de 2027 en brouillon', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE + 1);

    await ouvrirOutilBp(page, 'Business Model Canvas');
    await expect(page.locator('app-bp-tab .bp__info').filter({ hasText: `Repris de l'exercice ${EXERCICE_OUVERT_ANNEE}` })).toBeVisible();
    expect(await textesBp(page.locator('app-bp-bmc [data-zone="partenaires"]'))).toContain(D.canvas_partenaires);
    expect(await textesBp(page.locator('app-bp-bmc [data-zone="proposition"]'))).toContain(D.canvas_proposition);
  });

  test('EC-VERIFNEW-7 — select exercices : 2027 clôturé et 2028 ouvert présents', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await expect(page.locator('.exercice-banner')).toBeVisible({ timeout: 8_000 });

    const select = page.locator('.eb-select');
    await expect(select).toBeVisible();
    const texts = await select.locator('option').allTextContents();
    expect(texts.some(t => t.includes(String(EXERCICE_OUVERT_ANNEE))), '2027 manquant').toBe(true);
    expect(texts.some(t => t.includes(String(EXERCICE_OUVERT_ANNEE + 1))), '2028 manquant').toBe(true);
  });
});
