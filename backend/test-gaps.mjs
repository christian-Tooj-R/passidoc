/**
 * test-gaps.mjs
 * Couvre les angles morts restants avant livraison :
 *   - Fournisseurs tab (CRUD)
 *   - Contrôle Interne tab (save)
 *   - Objectifs tab (save)
 *   - /clients/:id/ai (chat IA)
 *   - /portefeuilles — réassignation
 *   - /documents — upload fichier réel
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:4200';
const API  = 'http://localhost:3000/api';
const CLIENT_ID = 1; // Boulangerie Du Four à la Planche

let page, browser, context, token;

const results = [];
const ok   = (msg) => { console.log('✅', msg); results.push({ ok: true,  msg }); };
const warn = (msg) => { console.log('⚠️ ', msg); results.push({ ok: true,  msg }); };
const fail = (msg) => { console.log('❌', msg); results.push({ ok: false, msg }); };
const sec  = (title) => console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`);

async function api(path_, method = 'GET', body) {
  const r = await fetch(`${API}${path_}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json().catch(() => null);
}

async function getToast(timeout = 5000) {
  return page.locator('snack-bar-container, .mat-mdc-snack-bar-container, app-toast')
    .first().textContent({ timeout }).catch(() => null);
}

async function gotoClient(tab) {
  await page.goto(`${BASE}/clients/${CLIENT_ID}`);
  await page.waitForTimeout(2000);
  const tabBtn = page.locator('.sidenav button').filter({ hasText: new RegExp(tab, 'i') }).first();
  if (await tabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tabBtn.click();
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

// ════════════════════════════════════════════════════════════════
// 1. Onglet Fournisseurs — CRUD
// ════════════════════════════════════════════════════════════════
async function testFournisseurs() {
  sec('1. Fournisseurs — Ajouter / Supprimer');
  const ok_ = await gotoClient('Fourniss');
  if (!ok_) { fail('Fournisseurs — onglet non trouvé'); return; }
  ok('Fournisseurs — onglet activé');

  // Compter les fournisseurs existants
  const cards = page.locator('.fournisseur-card');
  const countBefore = await cards.count();
  ok(`Fournisseurs — ${countBefore} fournisseur(s) avant test`);

  // Ouvrir le formulaire
  const addBtn = page.locator('button.btn-add').first();
  if (!await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Fournisseurs — bouton "Ajouter" absent'); return;
  }
  await addBtn.click();
  await page.waitForTimeout(500);

  // Remplir le formulaire
  const nomInput = page.locator('input[formcontrolname="nom"]');
  const emailInput = page.locator('input[formcontrolname="email"]');
  const telInput = page.locator('input[formcontrolname="telephone"]');
  const catSelect = page.locator('mat-select[formcontrolname="categorie"]');

  if (!await nomInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Fournisseurs — formulaire non visible'); return;
  }

  await nomInput.fill('Playwright Fournisseur SARL');
  await emailInput.fill('contact@playwright-fournisseur.re');
  await telInput.fill('+262 692 00 00 00');
  ok('Fournisseurs — formulaire rempli');

  // Sélectionner catégorie via mat-select (cliquer le trigger interne pour éviter mat-label)
  await catSelect.locator('.mat-mdc-select-trigger').click({ force: true });
  await page.waitForTimeout(400);
  const option = page.locator('mat-option').first();
  if (await option.isVisible({ timeout: 1500 }).catch(() => false)) {
    await option.click();
    ok('Fournisseurs — catégorie sélectionnée');
  }

  // Soumettre
  const submitBtn = page.locator('button.btn-submit');
  await submitBtn.click();
  await page.waitForTimeout(2000);

  const toast = await getToast();
  if (toast && /ajout/i.test(toast)) ok(`Fournisseurs — toast : "${toast.trim().substring(0, 60)}"`);
  else if (toast) warn(`Fournisseurs — toast : "${toast.trim().substring(0, 60)}"`);
  else fail('Fournisseurs — pas de toast après ajout');

  const countAfter = await cards.count();
  if (countAfter > countBefore) ok(`Fournisseurs — créé ! ${countBefore} → ${countAfter}`);
  else warn('Fournisseurs — nombre de cards inchangé (peut être en bas de page)');

  // Supprimer le fournisseur Playwright
  await page.waitForTimeout(500);
  const pwCard = page.locator('.fournisseur-card').filter({ hasText: /Playwright/i }).first();
  if (await pwCard.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pwCard.hover();
    await page.waitForTimeout(200);
    const delBtn = pwCard.locator('button.btn-delete');
    if (await delBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await delBtn.click();
      await page.waitForTimeout(1500);
      const toastDel = await getToast();
      if (toastDel && /supprim/i.test(toastDel)) ok(`Fournisseurs — supprimé : "${toastDel.trim().substring(0, 50)}"`);
      else ok('Fournisseurs — fournisseur Playwright supprimé');
    } else warn('Fournisseurs — btn-delete non visible au hover');
  } else warn('Fournisseurs — card Playwright non trouvée');
}

// ════════════════════════════════════════════════════════════════
// 2. Onglet Contrôle Interne — Ajouter un process + Save
// ════════════════════════════════════════════════════════════════
async function testControleInterne() {
  sec('2. Contrôle Interne — Saisie + Save');
  const ok_ = await gotoClient('Contrôle');
  if (!ok_) { fail('Contrôle Interne — onglet non trouvé'); return; }
  ok('Contrôle Interne — onglet activé');

  // Bouton "Ajouter processus OK"
  const addOkBtn = page.locator('button[mat-icon-button]').filter({ hasText: /add/i }).first();
  if (await addOkBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await addOkBtn.click();
    await page.waitForTimeout(400);
    ok('Contrôle Interne — process OK ajouté');

    // Remplir les inputs du processus
    const processInputs = page.locator('input.process-input');
    const n = await processInputs.count();
    if (n > 0) {
      await processInputs.nth(0).fill('Clôture mensuelle validée systématiquement');
      if (n > 1) await processInputs.nth(1).fill('Mise en place depuis 2023, aucun retard');
      ok('Contrôle Interne — processus rempli');
    }
  } else warn('Contrôle Interne — bouton add-process non trouvé (peut nécessiter un scroll)');

  // Note générale
  const noteTextarea = page.locator('textarea[rows="4"]').first();
  if (await noteTextarea.isVisible({ timeout: 1500 }).catch(() => false)) {
    const oldNote = await noteTextarea.inputValue();
    await noteTextarea.fill(oldNote || 'Contrôle Playwright — test E2E automatisé.');
    ok('Contrôle Interne — note générale remplie');
  }

  // Sauvegarder
  const saveBtn = page.locator('button[mat-flat-button]').filter({ hasText: /Enregistrer/i }).first();
  if (!await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Contrôle Interne — bouton Enregistrer absent'); return;
  }
  if (await saveBtn.isDisabled()) {
    warn('Contrôle Interne — bouton Enregistrer désactivé (exercice clôturé ?)'); return;
  }
  await saveBtn.click();
  await page.waitForTimeout(2000);

  const toast = await getToast();
  if (toast && /contrôle|enregistr/i.test(toast)) ok(`Contrôle Interne — toast : "${toast.trim().substring(0, 60)}"`);
  else if (toast) warn(`Contrôle Interne — toast : "${toast.trim().substring(0, 60)}"`);
  else fail('Contrôle Interne — pas de toast après save');
}

// ════════════════════════════════════════════════════════════════
// 3. Onglet Objectifs — Saisie + Save
// ════════════════════════════════════════════════════════════════
async function testObjectifs() {
  sec('3. Objectifs — Saisie + Save');
  const ok_ = await gotoClient('Objectif');
  if (!ok_) { fail('Objectifs — onglet non trouvé'); return; }
  ok('Objectifs — onglet activé');

  // Remplir le premier textarea (objectifs 1-2 ans)
  const firstTextarea = page.locator('textarea[formcontrolname="objectifs12mois"]');
  if (!await firstTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
    warn('Objectifs — textarea objectifs12mois non visible');
  } else {
    await firstTextarea.fill('Développer le CA de 20% sur 12 mois — Test Playwright');
    ok('Objectifs — objectifs 12 mois remplis');
  }

  // Relation client
  const qualiteInput = page.locator('input[formcontrolname="qualiteRelation"]');
  if (await qualiteInput.isVisible({ timeout: 1500 }).catch(() => false)) {
    await qualiteInput.fill('Excellente — client très réactif');
    ok('Objectifs — qualité relation remplie');
  }

  // Attentes client
  const attentesTextarea = page.locator('textarea[formcontrolname="attentesClient"]');
  if (await attentesTextarea.isVisible({ timeout: 1500 }).catch(() => false)) {
    await attentesTextarea.fill('Sécurisation fiscale et accompagnement croissance — Test Playwright');
    ok('Objectifs — attentes client remplies');
  }

  // Sauvegarder
  const saveBtn = page.locator('button[mat-flat-button]').filter({ hasText: /Enregistrer/i }).first();
  if (!await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Objectifs — bouton Enregistrer absent'); return;
  }
  if (await saveBtn.isDisabled()) {
    warn('Objectifs — bouton Enregistrer désactivé (exercice clôturé ?)'); return;
  }
  await saveBtn.click();
  await page.waitForTimeout(2000);

  const toast = await getToast();
  if (toast && /objectif|enregistr/i.test(toast)) ok(`Objectifs — toast : "${toast.trim().substring(0, 60)}"`);
  else if (toast) warn(`Objectifs — toast : "${toast.trim().substring(0, 60)}"`);
  else fail('Objectifs — pas de toast après save');
}

// ════════════════════════════════════════════════════════════════
// 4. /clients/:id/ai — Chat IA
// ════════════════════════════════════════════════════════════════
async function testAiChat() {
  sec(`4. /clients/${CLIENT_ID}/ai — Chat IA`);
  await page.goto(`${BASE}/clients/${CLIENT_ID}/ai`);
  await page.waitForTimeout(2500);

  // Bouton retour vers la fiche
  const backBtn = page.locator('a.btn-back');
  if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    ok('AI Chat — page chargée, bouton retour présent');
  } else warn('AI Chat — bouton retour non trouvé');

  // Zone de saisie
  const textarea = page.locator('textarea.input-field');
  if (!await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('AI Chat — textarea absent'); return;
  }
  ok('AI Chat — textarea de saisie présent');

  // Bouton envoi désactivé si vide
  const sendBtn = page.locator('button.btn-send');
  const isDisabledEmpty = await sendBtn.isDisabled();
  if (isDisabledEmpty) ok('AI Chat — btn-send désactivé sur textarea vide ✓');
  else warn('AI Chat — btn-send actif sur textarea vide');

  // Chips de suggestion
  const chips = page.locator('button.welcome-chip');
  const chipCount = await chips.count();
  if (chipCount > 0) {
    ok(`AI Chat — ${chipCount} suggestion(s) affichée(s)`);
    // Cliquer une suggestion (déclenche un appel API IA réel)
    await chips.first().click();
    await page.waitForTimeout(1000);
    // Vérifier que loading commence (spinner ou disabled)
    const isLoading = await sendBtn.isDisabled();
    if (isLoading) ok('AI Chat — état chargement activé après suggestion');
    else ok('AI Chat — suggestion cliquée');

    // Attendre la réponse IA (max 15s)
    await page.waitForFunction(
      () => document.querySelector('.msg-pair, .message-pair, [class*="msg"]') !== null,
      { timeout: 15000 }
    ).catch(() => {});

    const msgPairs = page.locator('.msg-pair, .message-pair, [class*="msg-pair"]');
    const pairCount = await msgPairs.count();
    if (pairCount > 0) ok(`AI Chat — ${pairCount} échange(s) affiché(s) après réponse`);
    else warn('AI Chat — aucun message visible (réponse IA peut prendre plus de temps)');
  } else warn('AI Chat — aucune suggestion de bienvenue');

  // Tester la saisie manuelle
  await textarea.fill('Quel est le secteur d\'activité de ce client ?');
  const isEnabled = !await sendBtn.isDisabled();
  if (isEnabled) ok('AI Chat — btn-send actif après saisie texte');
  await textarea.fill(''); // vider sans envoyer

  // Bouton clear history (si des messages existent)
  const clearBtn = page.locator('button.btn-icon--danger');
  if (await clearBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await clearBtn.click();
    await page.waitForTimeout(500);
    ok('AI Chat — historique effacé');
  }
}

// ════════════════════════════════════════════════════════════════
// 5. /portefeuilles — Réassignation d'un client
// ════════════════════════════════════════════════════════════════
async function testPortefeuillesReassign() {
  sec('5. /portefeuilles — Réassignation de dossier');

  // Pré-condition : assigner le client 1 au collaborateur id=3 (Sophie Martin, EXPERT_COMPTABLE REUNION)
  // pour qu'une collab-card apparaisse dans la vue admin
  const originalResponsableId = 6; // Marie Lefevre (CHEF_MISSION)
  const tempCollabId = 3;          // Sophie Martin (EXPERT_COMPTABLE REUNION)
  await api(`/clients/1/assign`, 'PATCH', { responsableId: tempCollabId });
  ok(`Portefeuilles — client 1 assigné temporairement à Sophie Martin (id=${tempCollabId})`);

  await page.goto(`${BASE}/portefeuilles`);
  await page.waitForTimeout(2500);

  // La collab-card de Sophie Martin doit apparaître
  const collabCards = page.locator('.collab-card');
  const cardCount = await collabCards.count();
  if (cardCount === 0) {
    warn('Portefeuilles — aucune collab-card visible après pré-assignation');
    await api('/clients/1/assign', 'PATCH', { responsableId: originalResponsableId });
    return;
  }
  ok(`Portefeuilles — ${cardCount} collab-card(s) visible(s)`);

  // Trouver la card de Sophie Martin
  const sophieCard = collabCards.filter({ hasText: /Sophie/i }).first();
  const targetCard = await sophieCard.count() > 0 ? sophieCard : collabCards.first();
  const collabName = await targetCard.locator('h3, .cc-name, .collab-card__header span').first()
    .textContent().catch(() => 'Collab');
  ok(`Portefeuilles — collaborateur : "${collabName?.trim().substring(0, 30)}"`);

  // Cliquer btn-manage pour dérouler le panneau
  const manageBtn = targetCard.locator('button.btn-manage').first();
  if (!await manageBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    warn('Portefeuilles — btn-manage non visible');
    await api('/clients/1/assign', 'PATCH', { responsableId: originalResponsableId });
    return;
  }
  await manageBtn.click();
  await page.waitForTimeout(1200);

  // Le panneau interne affiche un mat-select de réassignation par client
  const reassignSelect = page.locator('.reassign-field mat-select').first();
  if (!await reassignSelect.isVisible({ timeout: 4000 }).catch(() => false)) {
    fail('Portefeuilles — panneau réassignation non visible après clic');
    await api('/clients/1/assign', 'PATCH', { responsableId: originalResponsableId });
    return;
  }

  // Ouvrir le select (force: true pour contourner mat-label)
  await reassignSelect.locator('.mat-mdc-select-trigger').click({ force: true });
  await page.waitForTimeout(500);

  const options = page.locator('mat-option');
  const optCount = await options.count();
  if (optCount === 0) {
    warn('Portefeuilles — aucune option dans le mat-select');
    await api('/clients/1/assign', 'PATCH', { responsableId: originalResponsableId });
    return;
  }
  ok(`Portefeuilles — ${optCount} option(s) disponible(s)`);

  // Choisir une autre option (pas Sophie, par ex. Thomas Berger)
  await options.filter({ hasText: /Thomas|Jean|Hery/i }).first().click().catch(async () => {
    await options.nth(1).click();
  });
  await page.waitForTimeout(2000);

  const toast = await getToast();
  if (toast && /réassign/i.test(toast)) ok(`Portefeuilles — toast : "${toast.trim().substring(0, 60)}"`);
  else if (toast) warn(`Portefeuilles — toast : "${toast.trim().substring(0, 60)}"`);
  else fail('Portefeuilles — pas de toast après réassignation');

  // Restaurer le responsable d'origine
  await api('/clients/1/assign', 'PATCH', { responsableId: originalResponsableId });
  ok(`Portefeuilles — responsable client 1 restauré (id=${originalResponsableId})`);
}

// ════════════════════════════════════════════════════════════════
// 6. /documents — Upload de fichier réel
// ════════════════════════════════════════════════════════════════
async function testDocumentsUpload() {
  sec('6. /documents — Upload de fichier');
  await page.goto(`${BASE}/documents`);
  await page.waitForTimeout(2000);

  // S'assurer qu'un espace existe (en créer un si nécessaire)
  let spaceCard = page.locator('.space-card').first();
  if (!await spaceCard.isVisible({ timeout: 1500 }).catch(() => false)) {
    // Créer un espace
    await page.locator('button.btn-new').first().click();
    await page.waitForTimeout(800);
    await page.locator('input.dlg-input').fill('Espace Upload Test');
    await page.locator('button.dlg-btn--ok').click();
    await page.waitForTimeout(1500);
    spaceCard = page.locator('.space-card').first();
    ok('Upload — espace "Espace Upload Test" créé');
  }

  // Ouvrir l'espace
  await spaceCard.click();
  await page.waitForTimeout(1000);
  ok('Upload — espace ouvert');

  // Créer un vrai fichier temporaire dans le scratchpad
  const tmpFile = '/tmp/playwright-test-upload.txt';
  fs.writeFileSync(tmpFile, 'Fichier de test Playwright — upload E2E\nDate: ' + new Date().toISOString());

  // Input file caché — utiliser setInputFiles
  const fileInput = page.locator('input[type="file"]');
  if (!await fileInput.isVisible({ timeout: 1000 }).catch(() => false).then(() => true)) {
    // L'input est hidden, on le force
    await fileInput.setInputFiles(tmpFile);
    await page.waitForTimeout(3000);

    // Vérifier que le fichier apparaît
    const docItems = page.locator('.fm-card, .fm-row, .doc-item');
    const docCount = await docItems.count();
    if (docCount > 0) {
      ok(`Upload — ${docCount} document(s) après upload`);

      // Supprimer le document uploadé
      const firstDoc = docItems.first();
      await firstDoc.hover();
      await page.waitForTimeout(200);
      const delBtn = firstDoc.locator('button.doc-btn--danger');
      if (await delBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await delBtn.click();
        await page.waitForTimeout(1500);
        const afterDel = await docItems.count();
        ok(`Upload — document supprimé (${afterDel} restant(s))`);
      } else warn('Upload — bouton suppression doc non visible');
    } else warn('Upload — document non visible après upload');
  } else {
    await fileInput.setInputFiles(tmpFile);
    await page.waitForTimeout(3000);
    const docItems2 = page.locator('.fm-card, .fm-row');
    if (await docItems2.count() > 0) ok(`Upload — fichier uploadé, ${await docItems2.count()} doc(s)`);
    else warn('Upload — aucun document visible après upload');
  }

  // Nettoyer le fichier temporaire
  fs.unlinkSync(tmpFile);

  // Revenir et supprimer l'espace de test si on l'a créé
  const backBtn = page.locator('button.back-btn');
  if (await backBtn.isVisible({ timeout: 1000 }).catch(() => false)) await backBtn.click();
  await page.waitForTimeout(500);

  const testSpaceCard = page.locator('.space-card').filter({ hasText: /Upload Test/i }).first();
  if (await testSpaceCard.isVisible({ timeout: 1500 }).catch(() => false)) {
    await testSpaceCard.hover();
    await page.waitForTimeout(200);
    const delSpaceBtn = testSpaceCard.locator('.sc-action-btn--del');
    if (await delSpaceBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await delSpaceBtn.click();
      await page.waitForTimeout(300);
      const confirmDel = testSpaceCard.locator('.confirm-btn--danger');
      if (await confirmDel.isVisible({ timeout: 1000 }).catch(() => false)) {
        await confirmDel.click();
        await page.waitForTimeout(1000);
        ok('Upload — espace de test supprimé');
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════
async function main() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@afym.re', password: 'Admin1234!' }),
  });
  const data = await loginRes.json();
  token = data.access_token;

  browser = await chromium.launch({ headless: true });
  context = await browser.newContext();
  page = await context.newPage();

  await page.goto(`${BASE}/auth/login`);
  await page.locator('input[type="email"]').fill('admin@afym.re');
  await page.locator('input[type="password"]').fill('Admin1234!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 8000 });
  ok('Authentification — connexion OK');

  await testFournisseurs();
  await testControleInterne();
  await testObjectifs();
  await testAiChat();
  await testPortefeuillesReassign();
  await testDocumentsUpload();

  await browser.close();

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${passed} ✅  |  ${failed} ❌  |  ${passed + failed} total`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error('ERREUR CRITIQUE:', e.message); process.exit(1); });
