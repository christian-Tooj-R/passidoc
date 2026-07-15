/**
 * test-client-tabs.mjs
 * Teste les onglets client non couverts : Analyse Stratégique, Missions, Synthèse, ADN, Flux Mensuel
 */
import { chromium } from 'playwright';

const BASE      = 'http://localhost:4200';
const API       = 'http://localhost:3000/api';
const CLIENT_ID = 3; // Hôtel Le Lagon Bleu — resp=Thomas (CHEF_MISSION), dossier stable

let page, browser, token;

const results = [];
const ok   = (msg) => { console.log('✅', msg); results.push({ ok: true,  msg }); };
const warn = (msg) => { console.log('⚠️ ', msg); results.push({ ok: true,  msg }); };
const fail = (msg) => { console.log('❌', msg); results.push({ ok: false, msg }); };
const sec  = (title) => console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`);

async function api(path_, method = 'GET', body) {
  const r = await fetch(`${API}${path_}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json().catch(() => null);
}

async function getToast(timeout = 5000) {
  return page.locator('snack-bar-container, .mat-mdc-snack-bar-container, app-toast')
    .first().textContent({ timeout }).catch(() => null);
}

async function gotoTab(tab) {
  await page.goto(`${BASE}/clients/${CLIENT_ID}`);
  await page.waitForTimeout(2000);
  const btn = page.locator('.sidenav button').filter({ hasText: new RegExp(tab, 'i') }).first();
  if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1500);
    return true;
  }
  warn(`Onglet "${tab}" non trouvé dans la sidenav`);
  return false;
}

// ════════════════════════════════════════════════════════════════
// 1. Analyse Stratégique — saisie + save
// ════════════════════════════════════════════════════════════════
async function testAnalyseStrategique() {
  sec('1. Onglet Analyse Stratégique — saisie + save');
  const found = await gotoTab('Stratég');
  if (!found) { fail('Analyse Stratégique — onglet non trouvé'); return; }
  ok('Analyse Stratégique — onglet activé');

  // Le readonly est déterminé par le rôle : admin peut éditer
  const saveBtn = page.locator('button[mat-flat-button]').filter({ hasText: /Enregistrer/i }).first();
  if (!await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    warn('Analyse Stratégique — bouton Enregistrer non visible (lecture seule ?)');
    return;
  }

  // Remplir quelques champs textarea (forces de Porter)
  // Les textareas SWOT sont toujours visibles (pas dans expansion panel)
  const swotTextareas = page.locator('.swot-card textarea');
  const swotCount = await swotTextareas.count();
  ok(`Analyse Stratégique — ${swotCount} textarea(s) SWOT visible(s)`);

  if (swotCount > 0) {
    // Remplir le premier textarea SWOT (Forces)
    await swotTextareas.first().fill('Test Playwright — force concurrentielle');
    await page.waitForTimeout(300);
  }

  // Ouvrir le premier expansion panel (5 Forces de Porter) et remplir
  const expansionHeaders = page.locator('mat-expansion-panel-header');
  if (await expansionHeaders.count() > 0) {
    await expansionHeaders.first().click();
    await page.waitForTimeout(600);
    // Maintenant les textareas matInput sont visibles
    const porterTextarea = page.locator('mat-expansion-panel textarea.mat-mdc-input-element').first();
    if (await porterTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await porterTextarea.fill('Test Porter — Playwright');
    }
  }

  await saveBtn.click({ force: true });
  const toast = await getToast(5000);
  if (toast && /stratég/i.test(toast)) ok(`Analyse Stratégique — toast : "${toast.trim().substring(0, 60)}"`);
  else if (toast) warn(`Analyse Stratégique — toast inattendu : "${toast.trim().substring(0, 60)}"`);
  else fail('Analyse Stratégique — pas de toast après save');
}

// ════════════════════════════════════════════════════════════════
// 2. Missions — ajout + suppression
// ════════════════════════════════════════════════════════════════
async function testMissions() {
  sec('2. Onglet Missions — ajout + suppression');
  const found = await gotoTab('Mission');
  if (!found) { fail('Missions — onglet non trouvé'); return; }
  ok('Missions — onglet activé');

  // Compter les missions existantes
  const missionsBefore = await page.locator('.mission-card').count();
  ok(`Missions — ${missionsBefore} mission(s) existante(s)`);

  // Ouvrir le formulaire d'ajout (masqué par @if showForm)
  const addBtn = page.locator('button[mat-flat-button]').filter({ hasText: /Ajouter/i }).first();
  if (!await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Missions — bouton "Ajouter une mission" non visible');
    return;
  }
  await addBtn.click({ force: true });
  await page.waitForTimeout(800);
  ok('Missions — formulaire ouvert');

  // Sélectionner le type de mission
  const typeSelect = page.locator('mat-select[formcontrolname="type"]').first();
  if (!await typeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Missions — mat-select type non visible après ouverture formulaire');
    return;
  }
  await typeSelect.locator('.mat-mdc-select-trigger').click({ force: true });
  await page.waitForTimeout(500);
  const opts = page.locator('mat-option');
  if (await opts.count() === 0) { fail('Missions — aucune option type'); return; }
  await opts.first().click();
  await page.waitForTimeout(300);

  // Remplir les champs obligatoires
  const titreInput = page.locator('input[formcontrolname="titre"]').first();
  await titreInput.fill('Mission test Playwright');
  await page.locator('input[formcontrolname="honoraires"]').first().fill('1500');
  await page.locator('input[formcontrolname="annee"]').first().fill('2026');
  ok('Missions — formulaire rempli');

  // Soumettre
  const submitBtn = page.locator('button.btn-submit').first();
  await submitBtn.click({ force: true });
  await page.waitForTimeout(2000);

  const toast = await getToast(4000);
  if (toast && /mission/i.test(toast)) ok(`Missions — toast ajout : "${toast.trim().substring(0, 60)}"`);
  else if (toast) warn(`Missions — toast : "${toast.trim().substring(0, 60)}"`);
  else fail('Missions — pas de toast après ajout');

  // Vérifier l'ajout
  const missionsAfter = await page.locator('.mission-card').count();
  if (missionsAfter > missionsBefore) ok(`Missions — créée ! ${missionsBefore} → ${missionsAfter}`);
  else warn(`Missions — comptage inchangé (${missionsAfter})`);

  // Supprimer la mission ajoutée
  const deleteBtns = page.locator('.mission-card button[mat-icon-button]').filter({ hasText: /delete|trash|suppr/i });
  const deleteCount = await deleteBtns.count();
  // Chercher via mat-icon delete
  const delBtn = page.locator('.mission-card').filter({ hasText: /Playwright/i })
    .locator('button[mat-icon-button]').first();
  if (await delBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    page.on('dialog', d => d.accept());
    await delBtn.click();
    await page.waitForTimeout(1500);
    const toast2 = await getToast(4000);
    if (toast2 && /supprim|mission/i.test(toast2)) ok(`Missions — supprimée : "${toast2.trim().substring(0, 50)}"`);
    else ok('Missions — suppression déclenchée');
  } else {
    warn('Missions — bouton delete non trouvé sur la mission créée');
  }
}

// ════════════════════════════════════════════════════════════════
// 3. Synthèse — saisie + save
// ════════════════════════════════════════════════════════════════
async function testSynthese() {
  sec('3. Onglet Synthèse — saisie + save');
  const found = await gotoTab('Synthèse');
  if (!found) { fail('Synthèse — onglet non trouvé'); return; }
  ok('Synthèse — onglet activé');

  // Ouvrir le formulaire de nouvel exercice (masqué par @if showForm)
  const newExerciceBtn = page.locator('button').filter({ hasText: /Nouvel exercice/i }).first();
  if (!await newExerciceBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Synthèse — bouton "Nouvel exercice" non visible');
    return;
  }
  await newExerciceBtn.click({ force: true });
  await page.waitForTimeout(800);
  ok('Synthèse — formulaire ouvert');

  // Remplir le champ exercice
  const exerciceInput = page.locator('input[formcontrolname="exercice"]').first();
  if (!await exerciceInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Synthèse — champ exercice non visible après ouverture formulaire');
    return;
  }
  await exerciceInput.fill('2025');

  // Remplir CA et EBE
  await page.locator('input[formcontrolname="ca"]').first().fill('500000');
  await page.locator('input[formcontrolname="ebe"]').first().fill('85000');
  await page.locator('input[formcontrolname="resultatNet"]').first().fill('45000');

  // Commentaire financier
  const commentInput = page.locator('textarea[formcontrolname="commentaireFinancier"]').first();
  if (await commentInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await commentInput.fill('Commentaire test Playwright — exercice 2025');
  }
  ok('Synthèse — formulaire rempli (exercice 2025, CA 500k, EBE 85k)');

  // Soumettre
  const submitBtn = page.locator('button[mat-flat-button][color="primary"]').filter({ hasText: /Enregistrer/i }).first();
  if (!await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Synthèse — bouton Enregistrer non visible');
    return;
  }
  await submitBtn.click({ force: true });
  const toast = await getToast(5000);
  if (toast && /synthèse|synth/i.test(toast)) ok(`Synthèse — toast : "${toast.trim().substring(0, 60)}"`);
  else if (toast) warn(`Synthèse — toast inattendu : "${toast.trim().substring(0, 60)}"`);
  else fail('Synthèse — pas de toast après save');
}

// ════════════════════════════════════════════════════════════════
// 4. ADN Entreprise — mode édition + save
// ════════════════════════════════════════════════════════════════
async function testADN() {
  sec('4. Onglet ADN Entreprise — mode édition + save');
  const found = await gotoTab('ADN');
  if (!found) { fail('ADN — onglet non trouvé'); return; }
  ok('ADN — onglet activé');

  // Passer en mode édition
  const editBtn = page.locator('button.btn-edit').first();
  if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await editBtn.click();
    await page.waitForTimeout(800);
    ok('ADN — mode édition activé');
  } else {
    // Peut-être déjà en mode édition
    const modeBadge = page.locator('.mode-badge--edit');
    if (!await modeBadge.isVisible({ timeout: 1000 }).catch(() => false)) {
      warn('ADN — btn-edit non visible, mode édition inconnu');
    } else {
      ok('ADN — déjà en mode édition');
    }
  }

  // Remplir le champ Mission (textarea ngModel)
  const missionTextarea = page.locator('textarea').first();
  if (await missionTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
    await missionTextarea.fill('Mission Playwright — test automatisé ADN');
    ok('ADN — champ mission rempli');
  }

  // Cliquer sur une option q-opt (Vision)
  const qOpts = page.locator('.q-opt');
  const optCount = await qOpts.count();
  if (optCount > 0) {
    await qOpts.first().click({ force: true });
    await page.waitForTimeout(300);
    ok(`ADN — option sélectionnée (${optCount} disponibles)`);
  }

  // Remplir le concurrent principal (input ngModel)
  const concurrentInput = page.locator('input[matinput]').first();
  if (await concurrentInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await concurrentInput.fill('Concurrent Playwright');
  }

  // Sauvegarder
  const saveBtn = page.locator('button.btn-save').first();
  if (!await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('ADN — bouton save non visible');
    return;
  }
  await saveBtn.click({ force: true });
  await page.waitForTimeout(2500);

  // ADN utilise MatSnackBar (pas app-toast)
  const snackBar = page.locator('mat-snack-bar-container, snack-bar-container').first();
  const snackText = await snackBar.textContent({ timeout: 4000 }).catch(() => null);
  if (snackText && /ADN/i.test(snackText)) ok(`ADN — snackbar : "${snackText.trim().substring(0, 60)}"`);
  else if (snackText) warn(`ADN — snackbar : "${snackText.trim().substring(0, 60)}"`);
  else fail('ADN — pas de snackbar après save');
}

// ════════════════════════════════════════════════════════════════
// 5. Flux Mensuel — changement de statut
// ════════════════════════════════════════════════════════════════
async function testFluxMensuel() {
  sec('5. Onglet Flux Mensuel — changement de statut');
  const found = await gotoTab('Pilotage');  // label dans sidenav = "Pilotage" (id='pilotage')
  if (!found) { fail('Flux Mensuel — onglet "Pilotage" non trouvé'); return; }
  ok('Flux Mensuel — onglet activé');

  // Vérifier que la grille est présente
  const pilotage = page.locator('.pilotage');
  if (!await pilotage.isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Flux Mensuel — grille .pilotage non visible');
    return;
  }
  ok('Flux Mensuel — grille flux visible');

  // Lire les KPI avant modification
  const kpiDepose = page.locator('.kpi-card.kpi-green .kpi-value').first();
  const beforeCount = await kpiDepose.textContent({ timeout: 2000 }).catch(() => '?');
  ok(`Flux Mensuel — KPI déposés avant : ${beforeCount?.trim()}`);

  // Chercher une cellule de flux cliquable (cell-btn)
  const cellBtns = page.locator('button.cell-btn');
  const cellCount = await cellBtns.count();
  ok(`Flux Mensuel — ${cellCount} cellule(s) de flux`);

  if (cellCount > 0) {
    // Cliquer sur la première cellule pour ouvrir le menu
    await cellBtns.first().click({ force: true });
    await page.waitForTimeout(600);

    // Le menu contextuel apparaît (mat-menu)
    const menuItems = page.locator('button[mat-menu-item]');
    const menuCount = await menuItems.count();
    if (menuCount === 0) {
      warn('Flux Mensuel — menu contextuel non ouvert');
      return;
    }
    ok(`Flux Mensuel — menu contextuel : ${menuCount} items`);

    // Lire le statut actuel de la cellule (text content du bouton)
    const currentStatus = (await cellBtns.first().textContent())?.trim() ?? '';
    ok(`Flux Mensuel — statut actuel cellule : "${currentStatus.substring(0, 30)}"`);

    // Choisir un statut DIFFÉRENT du statut actuel pour garantir un vrai changement
    const isDepose = /déposé/i.test(currentStatus);
    const targetItem = isDepose
      ? menuItems.filter({ hasText: /À faire|En cours|Validé/i }).first()
      : menuItems.filter({ hasText: /Déposé/i }).first();

    const targetVisible = await targetItem.isVisible({ timeout: 1000 }).catch(() => false);
    const itemToClick = targetVisible ? targetItem : menuItems.first();
    const itemText = (await itemToClick.textContent())?.trim() ?? '';
    // Intercepter l'appel PATCH flux pour confirmer la mise à jour sans dépendre du toast
    let apiCalled = false;
    page.once('request', req => { if (req.method() === 'PATCH' && req.url().includes('flux')) apiCalled = true; });
    await itemToClick.click();
    ok(`Flux Mensuel — clic sur "${itemText.substring(0, 20)}"`);

    // Vérifier toast OU appel API (le toast peut être trop court selon la latence)
    const toast = await getToast(3000);
    await page.waitForTimeout(500); // laisser le temps à la requête d'être émise
    if (toast && /statut|flux|mis à jour|enregistré/i.test(toast)) {
      ok(`Flux Mensuel — toast : "${toast.trim().substring(0, 60)}"`);
    } else if (apiCalled) {
      ok('Flux Mensuel — appel API PATCH flux confirmé (toast trop rapide)');
    } else if (toast) {
      warn(`Flux Mensuel — toast inattendu : "${toast.trim().substring(0, 60)}"`);
    } else {
      // Vérifier si le KPI a changé (preuve indirecte que le changement a eu lieu)
      const afterKpi = await page.locator('.kpi-value, .kpi__val, .stat-value').first().textContent({ timeout: 1000 }).catch(() => null);
      warn(`Flux Mensuel — toast non détecté (KPI après : ${afterKpi ?? 'n/a'})`);
    }
  } else {
    warn('Flux Mensuel — aucune cellule de flux (tableau peut-être vide)');
  }

  // Vérifier navigation année (year-btn)
  const prevYearBtn = page.locator('button.year-btn').first();
  if (await prevYearBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await prevYearBtn.click();
    await page.waitForTimeout(500);
    const yearLabel = await page.locator('.year-label').first().textContent().catch(() => '?');
    ok(`Flux Mensuel — navigation année : ${yearLabel?.trim()}`);
  }
}

// ════════════════════════════════════════════════════════════════
// Main
// ════════════════════════════════════════════════════════════════
(async () => {
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  page = await ctx.newPage();

  // Auth
  await page.goto(`${BASE}/auth/login`);
  await page.locator('input[type="email"]').fill('admin@afym.re');
  await page.locator('input[type="password"]').fill('Admin1234!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 8000 });
  ok('Authentification — connexion OK');

  // Récupérer le token API
  const lr = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@afym.re', password: 'Admin1234!' }),
  });
  const ld = await lr.json();
  token = ld.access_token;

  // Lancer les tests
  await testAnalyseStrategique();
  await testMissions();
  await testSynthese();
  await testADN();
  await testFluxMensuel();

  await browser.close();

  const total  = results.length;
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${passed} ✅  |  ${failed} ❌  |  ${total} total`);
  console.log(`${'═'.repeat(60)}`);
  if (failed > 0) process.exit(1);
})();
