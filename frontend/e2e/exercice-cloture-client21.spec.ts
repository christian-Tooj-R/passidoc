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
 *   Objectifs, Stratégie (SWOT + Porter), Contrôle Interne, Missions › Par cycle
 *
 * Onglets permanents (données client, indépendants de l'exercice) :
 *   Canvas, Missions, Fiche Identité, Fournisseurs, ADN, Synthèse
 *
 * Ce qui bascule vers 2028 : Objectifs (copiés intégralement)
 * Ce qui reste sur 2027    : Stratégie, Contrôle Interne, Missions › Par cycle (lecture seule)
 * Ce qui est vierge 2028   : Stratégie, Contrôle Interne, Missions › Par cycle (10 cycles sans recommandation)
 * Permanent inchangé       : Canvas, Missions › Pipeline (visible sur tous les exercices)
 *
 * (L'ancien « Dossier de travail » est fusionné dans Missions › Par cycle — CDC module Missions.)
 */

import { test, expect, request as pwRequest } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

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
  // Canvas (permanent)
  canvas_partenaires : `${TAG} — Partenaires clés : fournisseur X, banque Y`,
  canvas_proposition : `${TAG} — Proposition de valeur : expertise locale et réactivité`,

  // Objectifs (exercice → copié vers 2028)
  obj_12m    : `${TAG} — Objectifs 12 mois : augmenter le CA de 15 %`,
  obj_3a5    : `${TAG} — Objectifs 3-5 ans : ouvrir une deuxième enseigne`,
  obj_attentes: `${TAG} — Attentes : suivi mensuel et tableau de bord trimestriel`,

  // Analyse Stratégique (exercice → reste sur 2027, vierge sur 2028)
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
];

/** Texte affiché (mode lecture) d'une case du Canvas, repérée par son libellé. */
function caseCanvas(page: Page, libelle: string) {
  return page.locator('app-canvas-tab .cv-box').filter({ hasText: libelle }).locator('.cv-box__read');
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

  test('EC-FILL-1 — Canvas : remplir partenaires + proposition de valeur', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await clickTab(page, 'Canvas');

    const tab = page.locator('app-canvas-tab');
    await expect(tab).toBeVisible({ timeout: 8_000 });

    // Placeholders générés en minuscule : "saisir partenaires clés..." (mode édition)
    await modifierViaEntete(page);
    await tab.locator('textarea[placeholder*="partenaires"]').fill(D.canvas_partenaires);
    await tab.locator('textarea[placeholder*="proposition"]').fill(D.canvas_proposition);

    await enregistrerViaEntete(page);

    // Persistance : recharger et revérifier (en mode édition, pour relire les champs)
    await goToClient(page);
    await clickTab(page, 'Canvas');
    await modifierViaEntete(page);
    await expect(page.locator('app-canvas-tab textarea[placeholder*="partenaires"]')).toHaveValue(D.canvas_partenaires);
    await expect(page.locator('app-canvas-tab textarea[placeholder*="proposition"]')).toHaveValue(D.canvas_proposition);
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

  test('EC-FILL-3 — Stratégie : remplir SWOT et Porter', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await clickTab(page, 'Stratégie');

    const tab = page.locator('app-analyse-strategique-tab');
    await expect(tab).toBeVisible({ timeout: 8_000 });

    // SWOT et Porter ne sont saisissables qu'en mode édition
    await modifierViaEntete(page);

    // SWOT — utiliser evaluate pour contourner le one-way [value] Angular
    // (Control+a + pressSequentially échoue car Angular re-render efface les caractères)
    const fillTA = async (sel: string, val: string) => {
      const ta = tab.locator(sel);
      await expect(ta).toBeVisible({ timeout: 6_000 });
      await ta.evaluate((el: HTMLTextAreaElement, v: string) => {
        el.value = v;
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      }, val);
    };
    await fillTA('textarea[placeholder*="force"]', D.strat_forces);
    await fillTA('textarea[placeholder*="faiblesse"]', D.strat_faiblesses);
    await fillTA('textarea[placeholder*="opportunit"]', D.strat_opportunites);
    await fillTA('textarea[placeholder*="menace"]', D.strat_menaces);

    // Ouvrir le panneau Porter (2ème mat-expansion-panel, fermé par défaut)
    const panels = tab.locator('mat-expansion-panel-header');
    await expect(panels.nth(1)).toBeVisible({ timeout: 6_000 });
    const porterExpanded = await panels.nth(1).getAttribute('aria-expanded');
    if (porterExpanded !== 'true') await panels.nth(1).click();
    await page.waitForTimeout(400);

    // Porter — même approche evaluate
    const porterTA = tab.locator('mat-expansion-panel').nth(1).locator('textarea').first();
    await expect(porterTA).toBeVisible({ timeout: 6_000 });
    await porterTA.evaluate((el: HTMLTextAreaElement, v: string) => {
      el.value = v;
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }, D.strat_porter);

    await enregistrerViaEntete(page);

    // Persistance (relue en mode édition)
    await goToClient(page);
    await clickTab(page, 'Stratégie');
    await modifierViaEntete(page);
    await expect(page.locator('app-analyse-strategique-tab textarea[placeholder*="force"]')).toHaveValue(D.strat_forces);
    await expect(page.locator('app-analyse-strategique-tab textarea[placeholder*="faiblesse"]')).toHaveValue(D.strat_faiblesses);
    await expect(page.locator('app-analyse-strategique-tab textarea[placeholder*="opportunit"]')).toHaveValue(D.strat_opportunites);
    await expect(page.locator('app-analyse-strategique-tab textarea[placeholder*="menace"]')).toHaveValue(D.strat_menaces);
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

  test('EC-VERIFOLD-3 — 2027 : analyse stratégique préservée', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE);
    await expect(page.locator('.exercice-banner--cloture')).toBeVisible({ timeout: 15_000 });

    await clickTab(page, 'Stratégie');
    const tab = page.locator('app-analyse-strategique-tab');
    await expect(tab).toBeVisible({ timeout: 8_000 });

    // Exercice clôturé : affichage en lecture seule (pas de mode édition)
    await expect(tab.locator('.swot-forces .swot-read-text')).toHaveText(D.strat_forces);
    await expect(tab.locator('.swot-faiblesses .swot-read-text')).toHaveText(D.strat_faiblesses);
    await expect(tab.locator('.swot-opportunites .swot-read-text')).toHaveText(D.strat_opportunites);
    await expect(tab.locator('.swot-menaces .swot-read-text')).toHaveText(D.strat_menaces);
    await expect(page.locator('.ch-edit-btn')).toHaveCount(0);
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

  test('EC-VERIFOLD-7 — 2027 : Canvas permanent inchangé', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE);

    await clickTab(page, 'Canvas');
    await expect(caseCanvas(page, 'Partenaires clés')).toHaveText(D.canvas_partenaires);
    await expect(caseCanvas(page, 'Proposition de valeur')).toHaveText(D.canvas_proposition);
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

  test('EC-VERIFNEW-2 — 2028 : stratégie vierge (non copiée)', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE + 1);

    await clickTab(page, 'Stratégie');
    const tab = page.locator('app-analyse-strategique-tab');
    await expect(tab).toBeVisible({ timeout: 8_000 });

    const forces = (await tab.locator('.swot-forces .swot-read-text').textContent()) ?? '';
    expect(forces.includes(TAG), 'Stratégie 2028 doit être vierge').toBe(false);
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

  test('EC-VERIFNEW-6 — 2028 : Canvas permanent inchangé', async ({ page }) => {
    await loginAfym(page);
    await goToClient(page);
    await switchToExercice(page, EXERCICE_OUVERT_ANNEE + 1);

    await clickTab(page, 'Canvas');
    await expect(caseCanvas(page, 'Partenaires clés')).toHaveText(D.canvas_partenaires);
    await expect(caseCanvas(page, 'Proposition de valeur')).toHaveText(D.canvas_proposition);
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
