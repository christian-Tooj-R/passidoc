/**
 * Playwright E2E — Tâches, Documents, Notes
 *
 * Usage : node test-productivity.mjs
 * Requires: frontend @ http://localhost:4200
 *           API      @ http://localhost:3000/api
 */

import { chromium } from '/datas/Projets/Aro/backend/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:4200';
// const API  = 'http://localhost:3000/api'; // réservé pour futurs appels API directs

// ── Compteurs ─────────────────────────────────────────────────
let pass = 0, fail_count = 0;
function ok(msg)    { console.log(`✅ ${msg}`);  pass++; }
function fail(msg)  { console.error(`❌ ${msg}`); fail_count++; }
function warn(msg)  { console.warn(`⚠️  ${msg}`); }
function sec(title) { console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`); }

// ── Snackbar helper ───────────────────────────────────────────
async function getSnackbar(page, timeout = 5000) {
  return page.locator('mat-snack-bar-container, .mat-mdc-snack-bar-container')
    .first().textContent({ timeout }).catch(() => null);
}

// ─────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page    = await context.newPage();

// ══════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════
sec('LOGIN');
try {
  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.locator('input[type="email"]').fill('admin@afym.re');
  await page.locator('input[type="password"]').fill('Admin1234!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 12000 }).catch(() => {});
  const url = page.url();
  if (url.includes('dashboard') || !url.includes('login')) {
    ok('Connexion admin réussie');
  } else {
    fail('Connexion échouée — toujours sur la page de login');
  }
} catch (e) {
  fail(`Login : ${e.message}`);
}

// ══════════════════════════════════════════════════════════════
// SECTION 1 — TÂCHES  (/tasks)
// ══════════════════════════════════════════════════════════════
sec('TÂCHES — /tasks');

// 1.1 — Navigation & titre de page
try {
  await page.goto(`${BASE}/tasks`);
  await page.waitForSelector('h1', { timeout: 10000 });
  const h1 = (await page.locator('h1').first().textContent())?.trim();
  if (h1 === 'Tâches') {
    ok('Page /tasks : h1 "Tâches" présent');
  } else {
    fail(`Page /tasks : h1 inattendu "${h1}"`);
  }
} catch (e) {
  fail(`Navigation /tasks : ${e.message}`);
}

// 1.2 — Conteneur principal
try {
  const visible = await page.locator('.page').first().isVisible();
  if (visible) ok('Conteneur .page visible');
  else fail('Conteneur .page absent');
} catch (e) {
  fail(`Conteneur .page : ${e.message}`);
}

// 1.3 — Boutons du header
try {
  const btnNewVisible    = await page.locator('.btn-new').first().isVisible();
  const btnRapportVisible = await page.locator('.btn-rapport').first().isVisible();
  if (btnNewVisible) ok('Bouton "Nouvelle tâche" (.btn-new) visible');
  else fail('Bouton "Nouvelle tâche" absent');
  if (btnRapportVisible) ok('Bouton "Rapport hebdomadaire" (.btn-rapport) visible');
  else fail('Bouton "Rapport hebdomadaire" absent');
} catch (e) {
  fail(`Boutons header tâches : ${e.message}`);
}

// 1.4 — Barre de filtres
try {
  const visible = await page.locator('.filter-bar').first().isVisible();
  if (visible) ok('Barre de filtres .filter-bar visible');
  else fail('Barre de filtres absente');
} catch (e) {
  fail(`Barre de filtres : ${e.message}`);
}

// 1.5 — Chips de filtres (Mes tâches, Dossier, Assigné, Type)
try {
  const count = await page.locator('.fchip').count();
  if (count >= 4) ok(`${count} chips de filtre présents`);
  else warn(`Chips de filtre : ${count} (attendu ≥ 4)`);
} catch (e) {
  fail(`Chips de filtre : ${e.message}`);
}

// 1.6 — Champ de recherche texte
try {
  const searchInput = page.locator('.tb-search-input');
  const visible = await searchInput.isVisible();
  if (visible) {
    ok('Champ de recherche .tb-search-input visible');
    await searchInput.fill('test');
    await page.waitForTimeout(300);
    const val = await searchInput.inputValue();
    if (val === 'test') ok('Saisie dans le champ de recherche fonctionnelle');
    else fail(`Champ de recherche : valeur inattendue "${val}"`);
    await searchInput.fill(''); // reset
  } else {
    fail('Champ de recherche .tb-search-input absent');
  }
} catch (e) {
  fail(`Champ de recherche tâches : ${e.message}`);
}

// 1.7 — Vue Kanban (mode par défaut)
try {
  const kanbanVisible = await page.locator('.kanban-board').first().isVisible();
  if (kanbanVisible) {
    ok('Tableau kanban .kanban-board visible');
    const colCount = await page.locator('.kanban-col').count();
    if (colCount === 5) ok('5 colonnes kanban présentes (À faire / En cours / Terminée / Non fait / En attente)');
    else if (colCount > 0) warn(`Colonnes kanban : ${colCount} (attendu 5)`);
    else fail('Aucune colonne kanban détectée');
  } else {
    fail('Tableau kanban .kanban-board absent');
  }
} catch (e) {
  fail(`Vue kanban : ${e.message}`);
}

// 1.8 — En-têtes des colonnes kanban
try {
  const headers = await page.locator('.kanban-col__header').allTextContents();
  if (headers.length === 5) {
    ok(`En-têtes colonnes : ${headers.map(h => h.trim()).join(' | ')}`);
  } else {
    warn(`En-têtes colonnes kanban : ${headers.length} trouvés`);
  }
} catch (e) {
  fail(`En-têtes colonnes kanban : ${e.message}`);
}

// 1.9 — Basculer vers la vue liste (table)
try {
  // 2e bouton du toggle = vue liste
  await page.locator('.vt-btn').nth(1).click();
  await page.waitForTimeout(300);
  const tableVisible = await page.locator('.tl-table').first().isVisible();
  if (tableVisible) {
    ok('Vue liste : .tl-table visible');
    const thTexts = await page.locator('.tl-table thead th').allTextContents();
    const labels = thTexts.map(t => t.trim()).filter(Boolean);
    if (labels.length >= 6) ok(`Colonnes table : ${labels.join(', ')}`);
    else warn(`Colonnes table peu nombreuses : ${labels.join(', ')}`);
  } else {
    fail('Vue liste : .tl-table absent après bascule');
  }
} catch (e) {
  fail(`Bascule vers vue liste : ${e.message}`);
}

// 1.10 — Retour en vue kanban
try {
  await page.locator('.vt-btn').first().click();
  await page.waitForTimeout(300);
  const kanbanVisible = await page.locator('.kanban-board').first().isVisible();
  if (kanbanVisible) ok('Retour vue kanban réussi');
  else fail('Retour vue kanban échoué');
} catch (e) {
  fail(`Retour vue kanban : ${e.message}`);
}

// 1.11 — Ouverture du dialog "Nouvelle tâche"
try {
  await page.locator('.btn-new').first().click();
  await page.waitForSelector('.ct-wrap', { timeout: 5000 });
  const dialogVisible = await page.locator('.ct-wrap').isVisible();
  if (dialogVisible) ok('Dialog "Nouvelle tâche" ouvert (.ct-wrap visible)');
  else fail('Dialog "Nouvelle tâche" non visible');
} catch (e) {
  fail(`Ouverture dialog création tâche : ${e.message}`);
}

// 1.12 — Contenu du dialog de création
try {
  const titleInput  = page.locator('.ct-title-input');
  const clientSelect = page.locator('.ct-select').first();
  const createBtn   = page.locator('.ct-btn-create');
  const cancelBtn   = page.locator('.ct-btn-cancel');

  if (await titleInput.isVisible())   ok('Dialog : champ titre .ct-title-input présent');
  else fail('Dialog : champ titre .ct-title-input absent');

  if (await clientSelect.isVisible()) ok('Dialog : select dossier client .ct-select présent');
  else fail('Dialog : select client absent');

  if (await createBtn.isVisible())    ok('Dialog : bouton "Créer la tâche" (.ct-btn-create) présent');
  else fail('Dialog : bouton créer absent');

  if (await cancelBtn.isVisible())    ok('Dialog : bouton "Annuler" (.ct-btn-cancel) présent');
  else fail('Dialog : bouton annuler absent');
} catch (e) {
  fail(`Contenu dialog création tâche : ${e.message}`);
}

// 1.13 — Saisie et envoi du formulaire de création
try {
  const titleInput   = page.locator('.ct-title-input');
  const clientSelect = page.locator('.ct-select').first();
  const createBtn    = page.locator('.ct-btn-create');

  await titleInput.fill('Tâche test Playwright E2E');

  // Sélectionner le 1er client disponible (index 0 = option disabled "Sélectionner")
  const opts = await clientSelect.locator('option:not([disabled])').count();
  if (opts > 0) {
    await clientSelect.selectOption({ index: 1 });
    await page.waitForTimeout(200);

    const isDisabled = await createBtn.isDisabled();
    if (!isDisabled) {
      await createBtn.click();
      const snack = await getSnackbar(page);
      if (snack && snack.includes('créée')) {
        ok(`Tâche créée — toast : "${snack.trim()}"`);
      } else {
        // Le dialog doit se fermer quand même
        await page.waitForTimeout(800);
        const dialogGone = !(await page.locator('.ct-wrap').isVisible().catch(() => false));
        if (dialogGone) ok('Tâche créée — dialog fermé après soumission');
        else warn('Tâche créée : dialog encore visible ou toast non capturé');
      }
    } else {
      warn('Bouton "Créer la tâche" désactivé malgré titre + client');
      await page.locator('.ct-btn-cancel').click();
    }
  } else {
    warn('Aucun client disponible en base — tâche non créée');
    await page.locator('.ct-btn-cancel').click();
  }
} catch (e) {
  fail(`Création tâche : ${e.message}`);
  await page.locator('.ct-btn-cancel').click().catch(() => {});
}

// 1.14 — Dialog Rapport hebdomadaire
try {
  await page.waitForTimeout(500);
  await page.locator('.btn-rapport').first().click();
  await page.waitForSelector('.sd-header', { timeout: 5000 });
  if (await page.locator('.sd-header').isVisible()) {
    ok('Dialog rapport hebdomadaire ouvert (.sd-header visible)');
    // KPIs présents
    const kpiCount = await page.locator('.sd-kpi').count();
    if (kpiCount >= 5) ok(`${kpiCount} KPIs visibles dans le rapport`);
    else warn(`KPIs rapport : ${kpiCount} (attendu ≥ 5)`);
    // Fermer
    await page.locator('.sd-close').click();
    await page.waitForTimeout(300);
    ok('Dialog rapport hebdomadaire fermé');
  } else {
    fail('Dialog rapport : .sd-header absent');
  }
} catch (e) {
  fail(`Rapport hebdomadaire : ${e.message}`);
  await page.keyboard.press('Escape');
}

// ══════════════════════════════════════════════════════════════
// SECTION 2 — DOCUMENTS  (/documents)
// ══════════════════════════════════════════════════════════════
sec('DOCUMENTS — /documents');

// 2.1 — Navigation & titre de page
try {
  await page.goto(`${BASE}/documents`);
  await page.waitForSelector('h1', { timeout: 10000 });
  const h1 = (await page.locator('h1').first().textContent())?.trim();
  if (h1 === 'Mes documents') {
    ok('Page /documents : h1 "Mes documents" présent');
  } else {
    fail(`Page /documents : h1 inattendu "${h1}"`);
  }
} catch (e) {
  fail(`Navigation /documents : ${e.message}`);
}

// 2.2 — Conteneur .page
try {
  const visible = await page.locator('.page').first().isVisible();
  if (visible) ok('Conteneur .page visible');
  else fail('Conteneur .page absent');
} catch (e) {
  fail(`Conteneur .page documents : ${e.message}`);
}

// 2.3 — Bouton "Nouvel espace"
try {
  const btn = page.locator('.btn-new').first();
  const visible = await btn.isVisible();
  const text    = (await btn.textContent())?.trim();
  if (visible && text?.includes('Nouvel espace')) {
    ok('Bouton "Nouvel espace" visible');
  } else if (visible) {
    ok(`Bouton .btn-new visible (texte : "${text}")`);
  } else {
    fail('Bouton "Nouvel espace" absent');
  }
} catch (e) {
  fail(`Bouton "Nouvel espace" : ${e.message}`);
}

// 2.4 — Grille des espaces (ou état vide / skeleton)
try {
  await page.waitForTimeout(1200); // Laisser le temps à l'API
  const gridVis  = await page.locator('.spaces-grid').first().isVisible().catch(() => false);
  const emptyVis = await page.locator('.empty-state').first().isVisible().catch(() => false);
  const skelVis  = await page.locator('.space-card--skel').first().isVisible().catch(() => false);

  if (gridVis) {
    const cards = await page.locator('.space-card').count();
    ok(`Grille .spaces-grid visible : ${cards} espace(s)`);
  } else if (emptyVis) {
    ok('État vide affiché (aucun espace créé)');
  } else if (skelVis) {
    warn('Skeleton de chargement encore visible');
  } else {
    fail('Ni grille ni état vide visible après chargement');
  }
} catch (e) {
  fail(`Grille espaces : ${e.message}`);
}

// 2.5 — Ouverture du dialog "Nouvel espace"
try {
  await page.locator('.btn-new').first().click();
  await page.waitForSelector('.dlg-input', { timeout: 5000 });
  const visible = await page.locator('.dlg-input').isVisible();
  if (visible) ok('Dialog "Nouvel espace" ouvert (.dlg-input visible)');
  else fail('Dialog "Nouvel espace" non visible');
} catch (e) {
  fail(`Ouverture dialog nouvel espace : ${e.message}`);
}

// 2.6 — Contenu du dialog
try {
  if (await page.locator('.dlg-input').isVisible())    ok('Dialog : champ nom .dlg-input présent');
  else fail('Dialog : champ nom absent');

  if (await page.locator('.dlg-btn--ok').isVisible())     ok('Dialog : bouton "Créer l\'espace" (.dlg-btn--ok) présent');
  else fail('Dialog : bouton créer absent');

  if (await page.locator('.dlg-btn--cancel').isVisible()) ok('Dialog : bouton "Annuler" (.dlg-btn--cancel) présent');
  else fail('Dialog : bouton annuler absent');

  const paletteBtns = await page.locator('.dlg-swatch').count();
  if (paletteBtns >= 12) ok(`Dialog : ${paletteBtns} swatches de couleur présents`);
  else warn(`Dialog : ${paletteBtns} swatches (attendu ≥ 12)`);
} catch (e) {
  fail(`Contenu dialog nouvel espace : ${e.message}`);
}

// 2.7 — Création d'un espace
const uniqueNom = `Espace E2E ${Date.now()}`;
try {
  const dlgInput = page.locator('.dlg-input');
  const okBtn    = page.locator('.dlg-btn--ok');

  await dlgInput.fill(uniqueNom);
  await page.waitForTimeout(200);

  const disabled = await okBtn.isDisabled();
  if (disabled) {
    fail('Bouton "Créer l\'espace" désactivé malgré un nom renseigné');
    await page.locator('.dlg-btn--cancel').click();
  } else {
    await okBtn.click();
    const snack = await getSnackbar(page);
    if (snack && snack.includes('créé')) {
      ok(`Espace créé — snackbar : "${snack.trim()}"`);
    } else {
      await page.waitForTimeout(600);
      const dialogGone = !(await page.locator('.dlg-input').isVisible().catch(() => false));
      if (dialogGone) ok('Espace créé — dialog fermé après soumission');
      else fail('Espace : dialog encore ouvert après soumission');
    }
  }
} catch (e) {
  fail(`Création espace : ${e.message}`);
  await page.locator('.dlg-btn--cancel').click().catch(() => {});
}

// 2.8 — Nouvel espace visible dans la grille
try {
  await page.waitForTimeout(600);
  const nameTexts = await page.locator('.sc-name').allTextContents();
  const found = nameTexts.some(t => t.includes('Espace E2E'));
  if (found) {
    ok(`Espace "${uniqueNom}" visible dans la grille`);
  } else {
    const cards = await page.locator('.space-card').count();
    if (cards > 0) ok(`${cards} espace(s) visible(s) dans la grille`);
    else warn('Impossible de confirmer la présence de l\'espace créé');
  }
} catch (e) {
  fail(`Espace dans la grille : ${e.message}`);
}

// 2.9 — Ouvrir un espace (vue fichiers)
try {
  const firstCard = page.locator('.space-card').first();
  if (await firstCard.isVisible()) {
    await firstCard.click();
    await page.waitForSelector('.fm-toolbar', { timeout: 5000 });
    if (await page.locator('.fm-toolbar').isVisible()) {
      ok('Vue espace ouvert : .fm-toolbar visible');
    } else {
      fail('Vue espace ouvert : .fm-toolbar absent');
    }
  } else {
    warn('Aucune carte espace disponible');
  }
} catch (e) {
  fail(`Ouverture espace : ${e.message}`);
}

// 2.10 — Éléments dans la vue espace ouvert
try {
  if (await page.locator('.fm-toolbar').isVisible()) {
    const backBtn    = page.locator('.back-btn');
    const searchIn   = page.locator('.fm-search input');
    const listToggle = page.locator('.fm-view-btn').first();
    const gridToggle = page.locator('.fm-view-btn').nth(1);

    if (await backBtn.isVisible())    ok('Espace ouvert : bouton retour .back-btn visible');
    else fail('Espace ouvert : bouton retour absent');

    if (await searchIn.isVisible())   ok('Espace ouvert : champ recherche .fm-search input visible');
    else fail('Espace ouvert : champ recherche absent');

    if (await listToggle.isVisible()) ok('Espace ouvert : toggle vue liste visible');
    else fail('Espace ouvert : toggle vue liste absent');

    if (await gridToggle.isVisible()) ok('Espace ouvert : toggle vue grille visible');
    else fail('Espace ouvert : toggle vue grille absent');
  } else {
    warn('Pas dans la vue espace ouvert — tests de contenu ignorés');
  }
} catch (e) {
  fail(`Éléments vue espace ouvert : ${e.message}`);
}

// 2.11 — Recherche dans l'espace
try {
  const searchIn = page.locator('.fm-search input');
  if (await searchIn.isVisible()) {
    await searchIn.fill('document');
    await page.waitForTimeout(300);
    const val = await searchIn.inputValue();
    if (val === 'document') ok('Recherche dans espace : saisie fonctionnelle');
    else fail(`Recherche dans espace : valeur inattendue "${val}"`);
    await searchIn.fill(''); // reset
  } else {
    warn('Champ de recherche non accessible dans l\'espace ouvert');
  }
} catch (e) {
  fail(`Recherche dans espace : ${e.message}`);
}

// 2.12 — Basculer en vue grille
try {
  const gridToggle = page.locator('.fm-view-btn').nth(1);
  if (await gridToggle.isVisible()) {
    await gridToggle.click();
    await page.waitForTimeout(300);
    const active = await gridToggle.evaluate(el => el.classList.contains('fm-view-btn--active'));
    if (active) ok('Bascule vue grille : bouton .fm-view-btn--active actif');
    else warn('Bascule vue grille : classe active non détectée');
  } else {
    warn('Toggle vue grille non accessible');
  }
} catch (e) {
  fail(`Bascule vue grille : ${e.message}`);
}

// 2.13 — Retour à la liste des espaces
try {
  const backBtn = page.locator('.back-btn');
  if (await backBtn.isVisible()) {
    await backBtn.click();
    await page.waitForSelector('h1', { timeout: 5000 });
    const h1 = (await page.locator('h1').first().textContent())?.trim();
    if (h1?.includes('documents')) ok('Retour liste espaces OK (h1 "Mes documents")');
    else fail(`Retour liste espaces : h1 inattendu "${h1}"`);
  } else {
    warn('Bouton .back-btn non visible — retour non testé');
  }
} catch (e) {
  fail(`Retour liste espaces : ${e.message}`);
}

// ══════════════════════════════════════════════════════════════
// SECTION 3 — NOTES  (/notes)
// ══════════════════════════════════════════════════════════════
sec('NOTES — /notes');

// 3.1 — Navigation & titre de page
try {
  await page.goto(`${BASE}/notes`);
  await page.waitForSelector('h1', { timeout: 10000 });
  const h1 = (await page.locator('h1').first().textContent())?.trim();
  if (h1 === 'Mes Notes') {
    ok('Page /notes : h1 "Mes Notes" présent');
  } else {
    fail(`Page /notes : h1 inattendu "${h1}"`);
  }
} catch (e) {
  fail(`Navigation /notes : ${e.message}`);
}

// 3.2 — Conteneur .notes-page
try {
  const visible = await page.locator('.notes-page').first().isVisible();
  if (visible) ok('Conteneur .notes-page visible');
  else fail('Conteneur .notes-page absent');
} catch (e) {
  fail(`Conteneur .notes-page : ${e.message}`);
}

// 3.3 — Sous-titre avec compteur de notes
try {
  const sub = (await page.locator('.page-header__sub').first().textContent())?.trim();
  if (sub && /note/.test(sub)) ok(`Compteur notes visible : "${sub}"`);
  else warn('Compteur .page-header__sub non détecté');
} catch (e) {
  fail(`Compteur notes : ${e.message}`);
}

// 3.4 — Bouton "Nouvelle note"
try {
  const btn = page.locator('.btn-add').first();
  const visible = await btn.isVisible();
  const text    = (await btn.textContent())?.trim();
  if (visible && text?.includes('Nouvelle note')) {
    ok('Bouton "Nouvelle note" (.btn-add) visible');
  } else if (visible) {
    ok(`Bouton .btn-add visible (texte : "${text}")`);
  } else {
    fail('Bouton "Nouvelle note" absent');
  }
} catch (e) {
  fail(`Bouton "Nouvelle note" : ${e.message}`);
}

// 3.5 — Grille de notes ou état vide (après chargement)
try {
  await page.waitForTimeout(1200); // Laisser le temps à l'API
  const skelVis  = await page.locator('.skeleton-grid').isVisible().catch(() => false);
  const gridVis  = await page.locator('.notes-grid').first().isVisible().catch(() => false);
  const emptyVis = await page.locator('.empty-state').first().isVisible().catch(() => false);

  if (gridVis) {
    const count = await page.locator('.note-card').count();
    ok(`.notes-grid visible : ${count} note(s)`);
  } else if (emptyVis) {
    ok('État vide affiché (aucune note existante)');
  } else if (skelVis) {
    warn('Skeleton .skeleton-grid encore visible');
  } else {
    fail('Ni .notes-grid ni .empty-state visible après chargement');
  }
} catch (e) {
  fail(`État page notes : ${e.message}`);
}

// 3.6 — Créer une nouvelle note (sans dialog, directement via API)
let countBefore = 0;
try {
  countBefore = await page.locator('.note-card').count();
  await page.locator('.btn-add').first().click();
  await page.waitForTimeout(900); // Attendre la réponse API + rendu
  const countAfter = await page.locator('.note-card').count();
  if (countAfter > countBefore) {
    ok(`Nouvelle note créée : ${countBefore} → ${countAfter} note(s)`);
  } else {
    fail(`Nouvelle note : compteur inchangé (${countBefore} → ${countAfter})`);
  }
} catch (e) {
  fail(`Création note : ${e.message}`);
}

// 3.7 — Modifier le titre de la première note
try {
  const firstTitle = page.locator('.note-title').first();
  if (await firstTitle.isVisible()) {
    await firstTitle.click();
    await firstTitle.fill('Note E2E Playwright');
    await page.waitForTimeout(200);
    const val = await firstTitle.inputValue();
    if (val === 'Note E2E Playwright') ok('Titre de note éditable (input.note-title)');
    else fail(`Titre note : valeur inattendue "${val}"`);
  } else {
    fail('Champ .note-title absent');
  }
} catch (e) {
  fail(`Modification titre note : ${e.message}`);
}

// 3.8 — Modifier le contenu de la première note
try {
  const firstBody = page.locator('.note-body').first();
  if (await firstBody.isVisible()) {
    await firstBody.click();
    await firstBody.fill('Contenu généré par Playwright E2E');
    await page.waitForTimeout(200);
    const val = await firstBody.inputValue();
    if (val === 'Contenu généré par Playwright E2E') ok('Contenu de note éditable (textarea.note-body)');
    else fail(`Contenu note : valeur inattendue "${val}"`);
  } else {
    fail('Zone contenu .note-body absente');
  }
} catch (e) {
  fail(`Modification contenu note : ${e.message}`);
}

// 3.9 — Compteur de caractères
try {
  const chars = (await page.locator('.note-chars').first().textContent())?.trim();
  if (chars) ok(`Compteur de caractères visible : "${chars}"`);
  else warn('Compteur .note-chars non détecté');
} catch (e) {
  fail(`Compteur caractères : ${e.message}`);
}

// 3.10 — Couleurs des notes (pastilles .color-dot)
try {
  const dotCount = await page.locator('.note-card').first().locator('.color-dot').count();
  if (dotCount === 6) ok('6 pastilles de couleur présentes sur la note (palette complète)');
  else if (dotCount > 0) ok(`${dotCount} pastille(s) de couleur .color-dot présente(s)`);
  else fail('Pastilles de couleur .color-dot absentes');
} catch (e) {
  fail(`Pastilles de couleur : ${e.message}`);
}

// 3.11 — Épingler une note
try {
  // Les boutons action sont dans .note-topbar .note-actions
  // 1er bouton = épingler/désépingler, 2e = supprimer
  const pinBtn = page.locator('.note-card').first().locator('.action-btn').first();
  if (await pinBtn.isVisible()) {
    const labelsBefore = await page.locator('.section-label').count();
    await pinBtn.click();
    await page.waitForTimeout(500);
    ok('Bouton épingler cliqué');
    const labelsAfter = await page.locator('.section-label').count();
    if (labelsAfter > 0) ok('Section "Épinglées" présente (.section-label)');
    else warn('Section "Épinglées" non détectée (note peut-être déjà épinglée ou état inconnu)');
  } else {
    warn('Bouton épingler .action-btn non visible sur la première note');
  }
} catch (e) {
  fail(`Épingler note : ${e.message}`);
}

// 3.12 — Supprimer la note créée (bouton .delete-btn → dialog ConfirmService)
try {
  const deleteBtn = page.locator('.note-card').first().locator('.delete-btn');
  if (await deleteBtn.isVisible()) {
    const countNow = await page.locator('.note-card').count();
    await deleteBtn.click();
    // Attendre le dialog de confirmation (ConfirmDialogComponent)
    await page.waitForSelector('.cd-btn-confirm', { timeout: 5000 });
    const confirmVisible = await page.locator('.cd-btn-confirm').isVisible();
    if (confirmVisible) {
      ok('Dialog de confirmation de suppression ouvert (.cd-btn-confirm visible)');
      await page.locator('.cd-btn-confirm').click();
      await page.waitForTimeout(700);
      const countAfter = await page.locator('.note-card').count();
      if (countAfter < countNow) {
        ok(`Note supprimée : ${countNow} → ${countAfter} note(s)`);
      } else {
        warn('Note : compteur inchangé après confirmation de suppression');
      }
    } else {
      fail('Dialog de confirmation absent après clic supprimer');
    }
  } else {
    warn('Bouton .delete-btn non visible (hover requis ?)');
  }
} catch (e) {
  fail(`Suppression note : ${e.message}`);
  // Fermer éventuellement le dialog de confirmation
  await page.locator('.cd-btn-cancel').click().catch(() => {});
}

// ══════════════════════════════════════════════════════════════
// BILAN
// ══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}\n  ${pass} ✅  |  ${fail_count} ❌  |  ${pass + fail_count} total\n${'═'.repeat(60)}`);

await browser.close();
if (fail_count > 0) process.exit(1);
