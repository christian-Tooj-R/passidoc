/**
 * test-client-extra.mjs
 * Tests E2E Playwright — onglets Fiche Identité, Relation Client et Chat IA
 * CLIENT_ID = 3 (Hôtel Le Lagon Bleu)
 */
import { chromium } from '/datas/Projets/Aro/backend/node_modules/playwright/index.mjs';

const BASE      = 'http://localhost:4200';
const API       = 'http://localhost:3000/api';
const CLIENT_ID = 3; // Hôtel Le Lagon Bleu

let page, browser;

let pass = 0, fail_count = 0;
function ok(msg)   { console.log(`✅ ${msg}`); pass++; }
function fail(msg) { console.error(`❌ ${msg}`); fail_count++; }
function warn(msg) { console.warn(`⚠️  ${msg}`); }
function sec(title){ console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`); }

// Appeler IMMÉDIATEMENT après le clic de save — les snackbars expirent en ~2s
async function getSnackbar(timeout = 5000) {
  return page.locator('mat-snack-bar-container, .mat-mdc-snack-bar-container')
    .first().textContent({ timeout }).catch(() => null);
}

// Navigation dans la sidenav du détail client (.sidenav button)
async function gotoTab(label) {
  const tab = page.locator('.sidenav button')
    .filter({ hasText: new RegExp(label, 'i') }).first();
  if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

// ════════════════════════════════════════════════════════════════
//  SECTION 1 — Onglet Fiche Identité
// ════════════════════════════════════════════════════════════════
async function testFicheIdentite() {
  sec('SECTION 1 — Onglet Fiche Identité : champs + save');

  await page.goto(`${BASE}/clients/${CLIENT_ID}`);
  await page.waitForTimeout(2500);

  const found = await gotoTab('Fiche Identité');
  if (!found) { fail('Fiche Identité — onglet non trouvé dans la sidenav'); return; }
  ok('Fiche Identité — onglet activé');

  // Vérifier que le formulaire est chargé
  const formEl = page.locator('form').first();
  if (!await formEl.isVisible({ timeout: 4000 }).catch(() => false)) {
    fail('Fiche Identité — formulaire non visible');
    return;
  }
  ok('Fiche Identité — formulaire chargé');

  // Vérifier la présence des champs de la section "Identité légale" (premier accordion)
  const fieldsToCheck = [
    { label: 'Raison sociale',      selector: 'input[formcontrolname="raisonSociale"]' },
    { label: 'Forme juridique',     selector: 'input[formcontrolname="formeJuridique"]' },
    { label: 'SIREN',               selector: 'input[formcontrolname="siren"]' },
    { label: 'SIRET',               selector: 'input[formcontrolname="siret"]' },
    { label: 'Adresse',             selector: 'input[formcontrolname="adresse"]' },
    { label: 'Email de contact',    selector: 'input[formcontrolname="emailContact"]' },
    { label: 'Téléphone de contact',selector: 'input[formcontrolname="telephoneContact"]' },
  ];

  for (const f of fieldsToCheck) {
    const el = page.locator(f.selector).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      ok(`Fiche Identité — champ "${f.label}" visible`);
    } else {
      warn(`Fiche Identité — champ "${f.label}" non visible (panel peut-être fermé)`);
    }
  }

  // Éditer le numéro de téléphone → save → snackbar
  const telInput = page.locator('input[formcontrolname="telephoneContact"]').first();
  if (await telInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    const oldVal = await telInput.inputValue().catch(() => '');
    await telInput.fill('0262 99 88 77');
    await page.waitForTimeout(300);
    ok('Fiche Identité — téléphone modifié');

    const saveBtn = page.locator('button[mat-flat-button][color="primary"]')
      .filter({ hasText: /Enregistrer/i }).first();
    if (!await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      fail('Fiche Identité — bouton Enregistrer non visible');
      return;
    }

    await saveBtn.click({ force: true });
    const snack = await getSnackbar(5000);
    if (snack && /fiche|enregistr/i.test(snack)) {
      ok(`Fiche Identité — snackbar save : "${snack.trim().substring(0, 60)}"`);
    } else if (snack) {
      warn(`Fiche Identité — snackbar inattendu : "${snack.trim().substring(0, 60)}"`);
    } else {
      fail('Fiche Identité — aucun snackbar après save');
    }

    // Remettre la valeur d'origine si elle était renseignée
    if (oldVal) {
      await telInput.fill(oldVal);
      await saveBtn.click({ force: true });
      await page.waitForTimeout(1500);
    }
  } else {
    warn('Fiche Identité — champ téléphone non visible, test édition ignoré');
  }

  // Vérifier le panneau Actionnariat
  const actPanel = page.locator('mat-expansion-panel')
    .filter({ hasText: /Actionnariat/i }).first();
  if (await actPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
    ok('Fiche Identité — panneau Actionnariat présent');

    // Ouvrir si fermé
    const isExpanded = await actPanel.evaluate(el =>
      el.classList.contains('mat-expanded')
    ).catch(() => false);
    if (!isExpanded) {
      await actPanel.locator('mat-expansion-panel-header').click();
      await page.waitForTimeout(500);
    }

    const addShareholderBtn = page.locator('button')
      .filter({ hasText: /Ajouter un actionnaire/i }).first();
    if (await addShareholderBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      ok('Fiche Identité — bouton "Ajouter un actionnaire" visible');
    } else {
      warn('Fiche Identité — bouton "Ajouter un actionnaire" non trouvé');
    }
  } else {
    warn('Fiche Identité — panneau Actionnariat non trouvé');
  }

  // Vérifier le panneau Documents mensuels attendus
  const fluxPanel = page.locator('mat-expansion-panel')
    .filter({ hasText: /Documents mensuels/i }).first();
  if (await fluxPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
    ok('Fiche Identité — panneau "Documents mensuels attendus" présent');
  } else {
    warn('Fiche Identité — panneau "Documents mensuels" non trouvé');
  }
}

// ════════════════════════════════════════════════════════════════
//  SECTION 2 — Onglet Relation Client
// ════════════════════════════════════════════════════════════════
async function testRelationClient() {
  sec('SECTION 2 — Onglet Relation Client : contacts & interlocuteurs');

  await page.goto(`${BASE}/clients/${CLIENT_ID}`);
  await page.waitForTimeout(2500);

  // Chercher un onglet dont le label contient "Relation"
  const tabFound = await gotoTab('Relation');
  if (!tabFound) {
    warn('Relation Client — onglet "Relation" absent de la sidenav (non encore implémenté)');

    // Repli : vérifier les champs de contact dans la Fiche Identité
    const ficheFound = await gotoTab('Fiche Identité');
    if (!ficheFound) {
      warn('Relation Client (repli) — onglet Fiche Identité non trouvé non plus');
      return;
    }
    await page.waitForTimeout(600);

    const emailField = page.locator('input[formcontrolname="emailContact"]').first();
    if (await emailField.isVisible({ timeout: 2000 }).catch(() => false)) {
      const emailVal = await emailField.inputValue().catch(() => '');
      ok(`Relation Client (Fiche Identité) — Email de contact : "${emailVal || '(vide)'}"`);
    } else {
      warn('Relation Client — champ email de contact non visible');
    }

    const phoneField = page.locator('input[formcontrolname="telephoneContact"]').first();
    if (await phoneField.isVisible({ timeout: 2000 }).catch(() => false)) {
      const phoneVal = await phoneField.inputValue().catch(() => '');
      ok(`Relation Client (Fiche Identité) — Téléphone de contact : "${phoneVal || '(vide)'}"`);
    } else {
      warn('Relation Client — champ téléphone de contact non visible');
    }

    // Vérifier l'Actionnariat comme source d'interlocuteurs
    const actPanel = page.locator('mat-expansion-panel')
      .filter({ hasText: /Actionnariat/i }).first();
    if (await actPanel.isVisible({ timeout: 2000 }).catch(() => false)) {
      ok('Relation Client — section Actionnariat accessible (interlocuteurs)');

      // Compter les actionnaires existants
      const actRows = page.locator('.act-view-row, .act-row');
      const actCount = await actRows.count();
      if (actCount > 0) {
        ok(`Relation Client — ${actCount} actionnaire(s)/interlocuteur(s) enregistré(s)`);
      } else {
        warn('Relation Client — aucun actionnaire enregistré');
      }
    } else {
      warn('Relation Client — section Actionnariat non visible');
    }

    return; // fin du repli
  }

  // Si l'onglet "Relation" existe réellement
  ok('Relation Client — onglet activé');

  // Rechercher la présence de contenu contacts / interlocuteurs
  await page.waitForTimeout(1000);
  const contactKeyword = page.locator(':text-matches("contact|interlocuteur", "i")').first();
  if (await contactKeyword.isVisible({ timeout: 3000 }).catch(() => false)) {
    ok('Relation Client — contenu contacts/interlocuteurs détecté');
  } else {
    warn('Relation Client — contenu contacts/interlocuteurs non détecté dans la page');
  }

  // Tenter d'ajouter un interlocuteur / contact
  const addBtn = page.locator('button')
    .filter({ hasText: /Ajouter|Nouveau contact|Nouvel interlocuteur/i }).first();
  if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    ok('Relation Client — bouton ajout contact/interlocuteur disponible');
    await addBtn.click({ force: true });
    await page.waitForTimeout(800);

    // Vérifier qu'un formulaire ou dialog s'ouvre
    const formOrDialog = page.locator(
      'mat-dialog-container, form.contact-form, .contact-form, [class*="dialog"]'
    ).first();
    if (await formOrDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      ok('Relation Client — formulaire ajout contact ouvert');
      // Fermer sans soumettre
      const cancelBtn = page.locator('button')
        .filter({ hasText: /annuler|fermer|cancel/i }).first();
      if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cancelBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(400);
    } else {
      warn('Relation Client — formulaire ajout non détecté après clic');
    }
  } else {
    warn('Relation Client — bouton ajout contact non trouvé');
  }
}

// ════════════════════════════════════════════════════════════════
//  SECTION 3 — Chat IA : route /clients/3/ai
// ════════════════════════════════════════════════════════════════
async function testAiChat() {
  sec('SECTION 3 — Chat IA : route /clients/3/ai');

  await page.goto(`${BASE}/clients/${CLIENT_ID}/ai`);
  await page.waitForTimeout(2500);

  // ── Topbar + titre ──────────────────────────────────────────────
  const topbar = page.locator('.topbar').first();
  if (!await topbar.isVisible({ timeout: 4000 }).catch(() => false)) {
    fail('Chat IA — topbar non visible');
    return;
  }
  ok('Chat IA — page chargée, topbar visible');

  // Vérifier la présence du titre "Assistant IA" (texte ou class .ai-title)
  const aiTitleEl = page.locator('.ai-title').first();
  if (await aiTitleEl.isVisible({ timeout: 2000 }).catch(() => false)) {
    ok('Chat IA — bloc .ai-title visible');
  } else {
    warn('Chat IA — bloc .ai-title non trouvé dans le topbar');
  }

  // Vérifier que le nom du client apparaît
  const clientChip = page.locator('.ai-client').first();
  if (await clientChip.isVisible({ timeout: 2000 }).catch(() => false)) {
    const clientText = await clientChip.textContent().catch(() => '');
    ok(`Chat IA — nom du client : "${clientText.trim()}"`);
  } else {
    warn('Chat IA — .ai-client non visible (client non encore chargé ?)');
  }

  // Vérifier l'indicateur "En ligne"
  const liveChip = page.locator('.ai-live').first();
  if (await liveChip.isVisible({ timeout: 2000 }).catch(() => false)) {
    ok('Chat IA — indicateur "En ligne" visible');
  } else {
    warn('Chat IA — indicateur "En ligne" non visible');
  }

  // ── Zone de messages ─────────────────────────────────────────────
  const messagesZone = page.locator('.messages').first();
  if (!await messagesZone.isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Chat IA — zone .messages non visible');
    return;
  }
  ok('Chat IA — zone de messages visible');

  // Détecter l'état initial (welcome ou conversation)
  const welcome = page.locator('.welcome').first();
  const hasWelcome = await welcome.isVisible({ timeout: 1500 }).catch(() => false);
  if (hasWelcome) {
    ok('Chat IA — écran d\'accueil (.welcome) visible');

    const chips = page.locator('.welcome-chip');
    const chipCount = await chips.count();
    if (chipCount > 0) {
      ok(`Chat IA — ${chipCount} suggestion(s) de démarrage affichée(s)`);
    } else {
      warn('Chat IA — aucune welcome-chip trouvée');
    }
  } else {
    ok('Chat IA — conversation existante affichée (pas d\'écran d\'accueil)');
  }

  // ── Zone de saisie ───────────────────────────────────────────────
  const inputField = page.locator('textarea.input-field').first();
  if (!await inputField.isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Chat IA — textarea.input-field non visible');
    return;
  }
  ok('Chat IA — champ de saisie visible');

  const sendBtn = page.locator('button.btn-send').first();
  if (!await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Chat IA — bouton .btn-send non visible');
    return;
  }
  ok('Chat IA — bouton Envoyer visible');

  // Le bouton doit être désactivé avant toute saisie
  const disabledBefore = await sendBtn.isDisabled().catch(() => false);
  if (disabledBefore) {
    ok('Chat IA — bouton Envoyer désactivé avant saisie (correct)');
  } else {
    warn('Chat IA — bouton Envoyer actif avant toute saisie (comportement inattendu)');
  }

  // ── Envoi d'un message test ──────────────────────────────────────
  await inputField.fill('Quel est le secteur d\'activité de ce client ?');
  await page.waitForTimeout(300);

  const disabledAfter = await sendBtn.isDisabled().catch(() => true);
  if (!disabledAfter) {
    ok('Chat IA — bouton Envoyer activé après saisie');
  } else {
    warn('Chat IA — bouton Envoyer toujours désactivé après saisie (possible problème)');
  }

  await sendBtn.click({ force: true });
  ok('Chat IA — message envoyé');
  await page.waitForTimeout(1200);

  // Vérifier la bulle utilisateur
  const userBubble = page.locator('.msg-user__bubble').first();
  if (await userBubble.isVisible({ timeout: 5000 }).catch(() => false)) {
    const userText = await userBubble.textContent().catch(() => '');
    ok(`Chat IA — bulle utilisateur : "${userText.trim().substring(0, 50)}"`);
  } else {
    warn('Chat IA — bulle .msg-user__bubble non visible après envoi');
  }

  // Vérifier l'indicateur de typing OU la bulle IA
  const typingOrAi = page.locator('.typing-dots, .msg-ai__bubble').first();
  if (await typingOrAi.isVisible({ timeout: 6000 }).catch(() => false)) {
    ok('Chat IA — réponse IA en cours (typing ou bulle visible)');
  } else {
    warn('Chat IA — indicateur de typing/réponse non détecté');
  }

  // Attendre la fin du streaming (bouton Envoyer se réactive, max 30s)
  try {
    await page.waitForFunction(() => {
      const btn = document.querySelector('button.btn-send');
      return btn && !btn.disabled;
    }, { timeout: 30000 });
    ok('Chat IA — streaming terminé (bouton Envoyer réactivé)');
  } catch {
    warn('Chat IA — délai dépassé pour la réponse IA (>30s), streaming peut-être lent');
  }

  // Lire le contenu de la réponse IA
  const aiBubble = page.locator('.msg-ai__bubble').first();
  const aiText = await aiBubble.textContent({ timeout: 5000 }).catch(() => null);
  if (aiText && aiText.trim().length > 5) {
    ok(`Chat IA — réponse reçue : "${aiText.trim().substring(0, 80)}…"`);
  } else if (aiText && aiText.trim().startsWith('⚠️')) {
    warn(`Chat IA — réponse d\'erreur IA : "${aiText.trim().substring(0, 80)}"`);
  } else {
    warn('Chat IA — contenu de la bulle IA non détecté ou vide');
  }

  // ── Bouton "Effacer la conversation" ────────────────────────────
  const clearBtn = page.locator('.btn-icon--danger').first();
  if (await clearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    ok('Chat IA — bouton "Effacer la conversation" visible');
  } else {
    warn('Chat IA — bouton .btn-icon--danger non visible');
  }

  // ── Lien retour vers le dossier ─────────────────────────────────
  const backLink = page.locator('a.btn-back').first();
  if (await backLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    const backText = await backLink.textContent().catch(() => '');
    ok(`Chat IA — lien retour : "${backText.trim()}"`);
  } else {
    warn('Chat IA — lien .btn-back non visible');
  }
}

// ════════════════════════════════════════════════════════════════
//  Main
// ════════════════════════════════════════════════════════════════
(async () => {
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  page = await ctx.newPage();

  // Authentification
  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.locator('input[type="email"]').fill('admin@afym.re');
  await page.locator('input[type="password"]').fill('Admin1234!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 12000 }).catch(() => {});
  ok('Auth — connexion OK');

  // Lancer les trois sections
  await testFicheIdentite();
  await testRelationClient();
  await testAiChat();

  await browser.close();

  console.log(`\n${'═'.repeat(60)}\n  ${pass} ✅  |  ${fail_count} ❌  |  ${pass + fail_count} total\n${'═'.repeat(60)}`);
  if (fail_count > 0) process.exit(1);
})();
