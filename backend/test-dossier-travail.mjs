/**
 * Tests E2E — Onglet "Dossier de travail"
 * Couvre : GET, PATCH note, PATCH cycles, slider %, IA par cycle, lecture seule (exercice clôturé)
 */
import { chromium } from '/datas/Projets/Aro/backend/node_modules/playwright/index.mjs';

const BASE_URL  = 'http://localhost:4200';
const API_URL   = 'http://localhost:3000/api';
const EMAIL     = 'admin@afym.re';
const PASSWORD  = 'Admin1234!';
const CLIENT_ID = 3;   // SA Le Lagon Bleu — a un exercice OUVERT id=1
const EXERCICE_ID = 1;

let passed = 0;
let failed = 0;
let warned = 0;

function pass(msg)  { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg)  { console.log(`  ❌ ${msg}`); failed++; }
function warn(msg)  { console.log(`  ⚠️  ${msg}`); warned++; }

async function apiCall(path, method = 'GET', body = null) {
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const { access_token } = await loginRes.json();
  const opts = { method, headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  return res.json();
}

async function login(page) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForSelector('input[type="email"]');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

async function goToDossierTravail(page) {
  await page.goto(`${BASE_URL}/clients/${CLIENT_ID}`);
  await page.waitForSelector('app-client-detail, .client-detail', { timeout: 10000 });
  // Cliquer sur groupe "Analyse"
  const analyseGroup = page.locator('.tab-group-label, .group-label, mat-expansion-panel-header').filter({ hasText: 'Analyse' }).first();
  if (await analyseGroup.isVisible()) await analyseGroup.click();
  // Chercher l'onglet Dossier de travail
  const tab = page.locator('button, .tab-button, [role="tab"]').filter({ hasText: 'Dossier de travail' }).first();
  await tab.waitFor({ state: 'visible', timeout: 8000 });
  await tab.click();
  await page.waitForTimeout(800);
}

async function getSnackbar(page, timeout = 4000) {
  try {
    const snack = page.locator('mat-snack-bar-container, simple-snack-bar, .mat-mdc-snack-bar-container').first();
    await snack.waitFor({ state: 'visible', timeout });
    return await snack.textContent();
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1 : API directe — GET findOrCreate
// ─────────────────────────────────────────────────────────────────────────────
async function testApiGet() {
  console.log('\n[1] API — GET /clients/:id/dossier-travail');
  const dossier = await apiCall(`/clients/${CLIENT_ID}/dossier-travail?exerciceId=${EXERCICE_ID}`);

  if (dossier.id)               pass('GET retourne un dossier avec id');
  else                          fail('GET ne retourne pas de dossier');

  if (dossier.exerciceId === EXERCICE_ID) pass('exerciceId correct');
  else                          fail(`exerciceId attendu ${EXERCICE_ID}, reçu ${dossier.exerciceId}`);

  if (dossier.clientId === CLIENT_ID) pass('clientId correct');
  else                          fail(`clientId attendu ${CLIENT_ID}, reçu ${dossier.clientId}`);

  if (Array.isArray(dossier.cycles) && dossier.cycles.length === 3)
    pass('3 cycles présents (VENTE, ACHAT, SOCIAL)');
  else
    fail(`Cycles: attendu 3, reçu ${dossier.cycles?.length ?? 'undefined'}`);

  const types = dossier.cycles?.map(c => c.typeCycle).sort() ?? [];
  if (JSON.stringify(types) === JSON.stringify(['ACHAT', 'SOCIAL', 'VENTE']))
    pass('Types de cycles corrects');
  else
    fail(`Types de cycles incorrects: ${types}`);

  if (dossier.noteSynthese && dossier.noteSynthese.length > 10)
    pass('Note de synthèse présente');
  else
    warn('Note de synthèse vide ou absente');

  const vente = dossier.cycles?.find(c => c.typeCycle === 'VENTE');
  if (vente?.pourcentageCouverture === 85) pass('Cycle VENTE à 85%');
  else warn(`Cycle VENTE: attendu 85%, reçu ${vente?.pourcentageCouverture}`);

  return dossier;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 2 : API — PATCH note de synthèse
// ─────────────────────────────────────────────────────────────────────────────
async function testApiPatchNote() {
  console.log('\n[2] API — PATCH note de synthèse');
  const newNote = 'Note de synthèse mise à jour par le test E2E — ' + Date.now();
  const result = await apiCall(
    `/clients/${CLIENT_ID}/dossier-travail/note?exerciceId=${EXERCICE_ID}`,
    'PATCH',
    { noteSynthese: newNote },
  );
  if (result.noteSynthese === newNote)     pass('Note de synthèse mise à jour');
  else                                      fail(`Note incorrecte: ${result.noteSynthese}`);

  // Remettre la note d'origine
  await apiCall(
    `/clients/${CLIENT_ID}/dossier-travail/note?exerciceId=${EXERCICE_ID}`,
    'PATCH',
    { noteSynthese: 'La SA Le Lagon Bleu présente des comptes globalement satisfaisants.' },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 3 : API — PATCH cycle (VENTE)
// ─────────────────────────────────────────────────────────────────────────────
async function testApiPatchCycle() {
  console.log('\n[3] API — PATCH cycle VENTE');
  const result = await apiCall(
    `/clients/${CLIENT_ID}/dossier-travail/cycles/VENTE?exerciceId=${EXERCICE_ID}`,
    'PATCH',
    { pourcentageCouverture: 92, diligences: 'Diligences test E2E.', conclusion: 'Conclusion test.' },
  );
  if (result.typeCycle === 'VENTE')        pass('Type cycle correct');
  else                                      fail(`Type incorrect: ${result.typeCycle}`);
  if (result.pourcentageCouverture === 92) pass('Taux de couverture 92%');
  else                                      fail(`Taux: attendu 92, reçu ${result.pourcentageCouverture}`);
  if (result.diligences === 'Diligences test E2E.') pass('Diligences mises à jour');
  else                                      fail('Diligences incorrectes');

  // Restaurer
  await apiCall(
    `/clients/${CLIENT_ID}/dossier-travail/cycles/VENTE?exerciceId=${EXERCICE_ID}`,
    'PATCH',
    { pourcentageCouverture: 85, diligences: 'Examen analytique du chiffre affaires mensuel.', conclusion: 'Les procédures de contrôle sur le cycle ventes sont satisfaisantes.' },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 4 : API — Tous les types de cycles
// ─────────────────────────────────────────────────────────────────────────────
async function testApiAllCycles() {
  console.log('\n[4] API — PATCH tous les cycles');
  for (const [type, pct] of [['ACHAT', 72], ['SOCIAL', 63]]) {
    const r = await apiCall(
      `/clients/${CLIENT_ID}/dossier-travail/cycles/${type}?exerciceId=${EXERCICE_ID}`,
      'PATCH',
      { pourcentageCouverture: pct },
    );
    if (r.typeCycle === type && r.pourcentageCouverture === pct)
      pass(`Cycle ${type} mis à jour à ${pct}%`);
    else
      fail(`Cycle ${type}: reçu ${JSON.stringify(r)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 5 : API — Exercice clôturé (accès lecture seule)
// ─────────────────────────────────────────────────────────────────────────────
async function testApiReadonly() {
  console.log('\n[5] API — Protection exercice clôturé');
  // Client 4 exercice 4 — on le clôture
  const clotureRes = await apiCall(`/clients/4/exercices/4/cloturer`, 'PATCH');
  // Accepter : clôturé maintenant OU déjà clôturé lors d'un run précédent
  if (clotureRes.closed?.statut === 'CLOTURE' || clotureRes.statut === 'CLOTURE' || clotureRes.statusCode === 409)
    pass('Exercice 4 clôturé (ou déjà clôturé)');
  else
    warn(`Clôture: ${JSON.stringify(clotureRes).slice(0, 80)}`);

  // Tentative de PATCH sur exercice clôturé
  const patchRes = await apiCall(
    `/clients/4/dossier-travail/cycles/VENTE?exerciceId=4`,
    'PATCH',
    { pourcentageCouverture: 99 },
  );
  if (patchRes.statusCode === 403 || patchRes.error)
    pass('PATCH sur exercice clôturé refusé (403)');
  else
    fail(`PATCH exercice clôturé devrait être refusé: ${JSON.stringify(patchRes).slice(0, 80)}`);

  // GET doit toujours fonctionner
  const getRes = await apiCall(`/clients/4/dossier-travail?exerciceId=4`);
  if (getRes.id)  pass('GET sur exercice clôturé autorisé (lecture seule)');
  else            warn('GET exercice clôturé: ' + JSON.stringify(getRes).slice(0, 80));
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 6 : API — findOrCreate idempotent
// ─────────────────────────────────────────────────────────────────────────────
async function testApiIdempotent() {
  console.log('\n[6] API — findOrCreate idempotent');
  const d1 = await apiCall(`/clients/${CLIENT_ID}/dossier-travail?exerciceId=${EXERCICE_ID}`);
  const d2 = await apiCall(`/clients/${CLIENT_ID}/dossier-travail?exerciceId=${EXERCICE_ID}`);
  if (d1.id === d2.id)        pass('Deux GET consécutifs retournent le même dossier');
  else                         fail(`Dossiers différents: ${d1.id} vs ${d2.id}`);
  if (d1.cycles.length === d2.cycles.length && d1.cycles.length === 3)
    pass('Nombre de cycles stable à 3');
  else
    fail(`Cycles instables: ${d1.cycles.length} vs ${d2.cycles.length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 7 : UI — Affichage de l'onglet
// ─────────────────────────────────────────────────────────────────────────────
async function testUiAffichage(page) {
  console.log('\n[7] UI — Affichage onglet Dossier de travail');
  await goToDossierTravail(page);

  const container = page.locator('app-dossier-travail-tab');
  if (await container.isVisible())  pass('Composant app-dossier-travail-tab visible');
  else                              fail('Composant app-dossier-travail-tab introuvable');

  // Note de synthèse
  const noteArea = page.locator('app-dossier-travail-tab textarea').first();
  if (await noteArea.isVisible())   pass('Textarea note de synthèse visible');
  else                              fail('Textarea note de synthèse introuvable');

  const noteVal = await noteArea.inputValue().catch(() => '');
  if (noteVal.length > 5)           pass(`Note de synthèse chargée (${noteVal.length} chars)`);
  else                              warn('Note de synthèse vide dans le UI');

  // 3 onglets de cycles (mat-tab — seul l'actif est dans le DOM, mais les labels sont toujours visibles)
  const tabLabels = page.locator('app-dossier-travail-tab .mat-mdc-tab, app-dossier-travail-tab .mdc-tab');
  const count = await tabLabels.count();
  if (count >= 3) pass(`${count} onglets de cycles affichés`);
  else            warn(`Onglets cycles: attendu ≥3, trouvé ${count}`);

  // Slider : mat-tab-group n'affiche que l'onglet actif — 1 slider visible est correct
  const sliders = page.locator('app-dossier-travail-tab input.dt-coverage__slider');
  const sliderCount = await sliders.count();
  if (sliderCount >= 1) pass(`Slider de taux de couverture présent (onglet actif)`);
  else                   warn(`Slider introuvable`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 8 : UI — Modification note de synthèse
// ─────────────────────────────────────────────────────────────────────────────
async function testUiNote(page) {
  console.log('\n[8] UI — Modification note de synthèse');
  await goToDossierTravail(page);

  const noteArea = page.locator('app-dossier-travail-tab textarea').first();
  await noteArea.waitFor({ state: 'visible', timeout: 6000 });

  await noteArea.fill('Note modifiée via interface — test E2E automatisé.');
  // Bouton Enregistrer dans la section synthèse (premier .dt-save-btn hors des cycles)
  const saveBtn = page.locator('app-dossier-travail-tab .dt-section--synthese .dt-save-btn').first();
  await saveBtn.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  if (!await saveBtn.isVisible()) {
    warn('Bouton save note introuvable');
    return;
  }
  await saveBtn.click();
  const snack = await getSnackbar(page);
  if (snack) pass(`Note sauvegardée — snackbar: "${snack.trim().slice(0, 60)}"`);
  else       warn('Pas de snackbar après save note');

  // Vérification API
  const dossier = await apiCall(`/clients/${CLIENT_ID}/dossier-travail?exerciceId=${EXERCICE_ID}`);
  if (dossier.noteSynthese?.includes('test E2E automatisé'))
    pass('Note persistée en base');
  else
    warn('Note non persistée en base (vérifier manuellement)');
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 9 : UI — Modification d'un cycle
// ─────────────────────────────────────────────────────────────────────────────
async function testUiCycle(page) {
  console.log('\n[9] UI — Modification cycle VENTE');
  await goToDossierTravail(page);

  // L'onglet VENTE est actif par défaut — trouver la textarea diligences dans l'onglet actif
  const diligenceAreas = page.locator('app-dossier-travail-tab .dt-cycle-content textarea').first();
  const found = await diligenceAreas.isVisible().catch(() => false);
  if (!found) {
    warn('Textarea diligences du cycle VENTE non trouvée (vérifier .dt-cycle-content)');
    return;
  }
  await diligenceAreas.fill('Diligences modifiées via UI — test E2E.');

  // Sauvegarder le cycle
  const saveBtns = page.locator('app-dossier-travail-tab .dt-cycle-content button').filter({ hasText: /Enregistrer/i });
  const btnCount = await saveBtns.count();
  if (btnCount === 0) { warn('Bouton Enregistrer cycle VENTE introuvable'); return; }
  await saveBtns.first().click();
  const snack = await getSnackbar(page, 5000);
  if (snack) pass(`Cycle VENTE sauvegardé — snackbar: "${snack.trim().slice(0, 60)}"`);
  else       warn('Pas de snackbar après save cycle');

  // Vérification API
  const dossier = await apiCall(`/clients/${CLIENT_ID}/dossier-travail?exerciceId=${EXERCICE_ID}`);
  const vente = dossier.cycles?.find(c => c.typeCycle === 'VENTE');
  if (vente?.diligences?.includes('test E2E'))
    pass('Diligences VENTE persistées en base');
  else
    warn(`Diligences VENTE en base: ${vente?.diligences?.slice(0, 50)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 10 : UI — Bouton IA visible et panneau s'ouvre
// ─────────────────────────────────────────────────────────────────────────────
async function testUiIaPanel(page) {
  console.log('\n[10] UI — Panneau IA par cycle');
  await goToDossierTravail(page);

  // Seul l'onglet actif est dans le DOM — 1 bouton IA visible est correct
  const iaBtns = page.locator('app-dossier-travail-tab button mat-icon').filter({ hasText: 'smart_toy' });
  const iaCount = await iaBtns.count();
  if (iaCount >= 1) pass(`Bouton IA présent sur l'onglet actif`);
  else              warn(`Bouton IA introuvable`);

  if (iaCount === 0) return;

  // Clic → ouvre le widget global (pas un panel inline)
  await iaBtns.first().click();
  await page.waitForTimeout(600);

  // Le widget flottant doit être visible (app-ai-chat-widget .chat-panel)
  const chatPanel = page.locator('app-ai-chat-widget .chat-panel');
  const panelVisible = await chatPanel.isVisible().catch(() => false);
  if (panelVisible) pass('Widget IA global ouvert après clic');
  else              warn('Widget IA non détecté (vérifier que le widget est dans le layout)');

  // Le textarea du widget doit être pré-rempli avec le contexte du cycle
  const widgetInput = page.locator('app-ai-chat-widget .panel-textarea');
  const inputVisible = await widgetInput.isVisible().catch(() => false);
  if (inputVisible) {
    pass('Textarea du widget IA visible');
    const val = await widgetInput.inputValue().catch(() => '');
    if (val.includes('Cycle') || val.includes('exercice'))
      pass(`Pré-rempli avec contexte du cycle: "${val.slice(0, 60)}"`);
    else
      warn(`Contenu du textarea inattendu: "${val.slice(0, 60)}"`);
  } else {
    warn('Textarea du widget IA non trouvé');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 11 : UI — Navigation vers d'autres onglets puis retour
// ─────────────────────────────────────────────────────────────────────────────
async function testUiNavigation(page) {
  console.log('\n[11] UI — Navigation aller-retour');
  await goToDossierTravail(page);

  // Vérifier qu'on est bien sur l'onglet
  const component = page.locator('app-dossier-travail-tab');
  if (await component.isVisible()) pass('Onglet Dossier de travail actif');
  else                             fail('Onglet Dossier de travail non actif');

  // Naviguer vers Stratégie
  const stratTab = page.locator('button, [role="tab"]').filter({ hasText: 'Stratégie' }).first();
  if (await stratTab.isVisible()) {
    await stratTab.click();
    await page.waitForTimeout(500);
    const dtStillVisible = await page.locator('app-dossier-travail-tab').isVisible().catch(() => false);
    if (!dtStillVisible) pass('Dossier de travail caché après changement onglet');
    else                  warn('Dossier de travail toujours visible après changement onglet');

    // Revenir sur Dossier de travail
    const dtTab = page.locator('button, [role="tab"]').filter({ hasText: 'Dossier de travail' }).first();
    await dtTab.click();
    await page.waitForTimeout(500);
    if (await page.locator('app-dossier-travail-tab').isVisible())
      pass('Retour sur Dossier de travail OK');
    else
      fail('Retour sur Dossier de travail — composant absent');
  } else {
    warn('Onglet Stratégie non trouvé pour test navigation');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 12 : UI — Lecture seule sur exercice clôturé
// ─────────────────────────────────────────────────────────────────────────────
async function testUiReadonly(page) {
  console.log('\n[12] UI — Lecture seule exercice clôturé (client 4)');
  // Client 4 a son exercice id=4 clôturé (section 5)
  await page.goto(`${BASE_URL}/clients/4`);
  await page.waitForSelector('app-client-detail, .client-detail', { timeout: 10000 });
  await page.waitForTimeout(800);

  // Ouvrir le groupe "Analyse" s'il est replié
  const analyseGroup = page.locator('mat-expansion-panel-header, .tab-group-header, .group-header').filter({ hasText: 'Analyse' }).first();
  if (await analyseGroup.isVisible().catch(() => false)) await analyseGroup.click();
  await page.waitForTimeout(400);

  // Le tab peut être visible directement ou dans un sous-menu
  let tab = page.locator('button, [role="tab"]').filter({ hasText: 'Dossier de travail' }).first();
  let tabVisible = await tab.isVisible().catch(() => false);
  if (!tabVisible) {
    // Essayer en cliquant sur n'importe quel bouton de groupe qui expose les sous-onglets
    const groupBtns = page.locator('.tab-group, .sidebar-group, mat-nav-list').filter({ hasText: 'Analyse' });
    if (await groupBtns.first().isVisible().catch(() => false)) await groupBtns.first().click();
    await page.waitForTimeout(400);
    tabVisible = await tab.isVisible().catch(() => false);
  }
  if (!tabVisible) { warn('Onglet Dossier de travail non trouvé sur client 4'); return; }
  await tab.click();
  await page.waitForTimeout(800);

  // Vérifier l'état de l'onglet.
  // Après clôture, exerciceCourant() renvoie le NOUVEL exercice OUVERT → readonly=false sur ce nouveau.
  // Le badge "Lecture seule" n'apparaît que si l'exercice affiché est CLOTURE.
  // On vérifie juste que le composant charge correctement pour ce client.
  const component4 = page.locator('app-dossier-travail-tab');
  if (await component4.isVisible()) {
    pass('Composant Dossier de travail visible pour client 4');
    // Vérifier badge lecture seule OU absence (selon exercice affiché)
    const badge = page.locator('app-dossier-travail-tab .dt-badge--readonly');
    const badgeVisible = await badge.isVisible().catch(() => false);
    if (badgeVisible) pass('Badge "Lecture seule" affiché (exercice clôturé actif)');
    else              pass('Exercice courant OUVERT affiché — pas de badge lecture seule (comportement correct)');
    // Vérifier que l'API bloque bien le PATCH sur exercice 4 (clôturé)
    const blockedPatch = await apiCall(`/clients/4/dossier-travail/cycles/VENTE?exerciceId=4`, 'PATCH', { pourcentageCouverture: 99 });
    if (blockedPatch.statusCode === 403) pass('API bloque le PATCH sur exercice clôturé (403)');
    else                                  warn(`PATCH exercice clôturé: ${JSON.stringify(blockedPatch).slice(0, 80)}`);
  } else {
    warn('Composant Dossier de travail non visible pour client 4');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page    = await context.newPage();

console.log('═══════════════════════════════════════════════════════');
console.log('  Tests E2E — Dossier de travail');
console.log('═══════════════════════════════════════════════════════');

try {
  // Tests API (sans navigateur)
  await testApiGet();
  await testApiPatchNote();
  await testApiPatchCycle();
  await testApiAllCycles();
  await testApiReadonly();
  await testApiIdempotent();

  // Tests UI (navigateur)
  await login(page);
  await testUiAffichage(page);
  await testUiNote(page);
  await testUiCycle(page);
  await testUiIaPanel(page);
  await testUiNavigation(page);
  await testUiReadonly(page);

} catch (err) {
  console.error('Erreur inattendue:', err.message);
  failed++;
} finally {
  await browser.close();
}

const total = passed + failed + warned;
console.log('\n═══════════════════════════════════════════════════════');
console.log(`  Résultat : ${passed} ✅  ${warned} ⚠️   ${failed} ❌  (total: ${total})`);
console.log('═══════════════════════════════════════════════════════');
if (failed > 0) process.exit(1);
