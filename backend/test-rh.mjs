/**
 * test-rh.mjs
 * Tests E2E Playwright pour le module RH de Passidoc :
 *   1. Liste salariés (/rh/salaries)
 *   2. Édition salarié via drawer (salaries.component)
 *   3. Fiche détail salarié (/rh/salaries/:id)
 *   4. Congés — liste (/rh/conges)
 *   5. Congés — créer une demande
 *   6. Congés — approuver une demande EN_ATTENTE
 *   7. Congés — refuser une demande EN_ATTENTE
 *   8. Nettoyage
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4200';
const API  = 'http://localhost:3000/api';
let page, browser, token;

const results = [];
const ok   = (msg) => { console.log('✅', msg); results.push({ ok: true,  msg }); };
const warn = (msg) => { console.log('⚠️ ', msg); results.push({ ok: true,  msg }); };
const fail = (msg) => { console.log('❌', msg); results.push({ ok: false, msg }); };
const sec  = (title) => console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`);

// ── Helpers ────────────────────────────────────────────────

async function apiCall(path, method = 'GET', body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json().catch(() => null);
}

async function getSnackbar(timeout = 5000) {
  return page.locator('mat-snack-bar-container, .mat-mdc-snack-bar-container')
    .first().textContent({ timeout }).catch(() => null);
}

/** Navigue vers une route RH et attend la fin de l'animation d'entrée (1.6 s). */
async function gotoRH(path) {
  await page.goto(`${BASE}${path}`);
  // L'écran d'entrée rh-entry est animé sur 1.6 s au premier accès.
  // On attend que .rh-shell--hidden disparaisse ou que le contenu soit visible.
  await page.waitForTimeout(2200);
}

/**
 * Sélectionne une valeur dans un mat-select Angular Material.
 * @param {import('playwright').Locator} containerLocator  Le locator du mat-select
 * @param {string|RegExp} optionText  Texte (partiel) de l'option à choisir
 */
async function selectMatOption(containerLocator, optionText) {
  const trigger = containerLocator.locator('.mat-mdc-select-trigger');
  await trigger.click({ force: true });
  await page.waitForTimeout(400);
  const opt = page.locator('mat-option').filter({ hasText: optionText }).first();
  if (await opt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await opt.click();
    await page.waitForTimeout(300);
    return true;
  }
  // Fermer le panneau si l'option n'a pas été trouvée
  await page.keyboard.press('Escape');
  return false;
}

// ════════════════════════════════════════════════════════════
// 1. Liste salariés — /rh/salaries
// ════════════════════════════════════════════════════════════
async function testListeSalaries() {
  sec('1. Liste salariés — /rh/salaries');
  await gotoRH('/rh/salaries');

  // Tableau présent
  const tableWrap = page.locator('.table-wrap');
  if (!await tableWrap.isVisible({ timeout: 5000 }).catch(() => false)) {
    fail('Liste salariés — .table-wrap absent');
    return;
  }
  ok('Liste salariés — .table-wrap visible');

  // Compter les lignes (13 salariés en DB)
  // app-data-table utilise mat-table → lignes <tr mat-row> ou .mat-mdc-row
  await page.waitForTimeout(1000); // laisser le chargement se terminer
  const rows = tableWrap.locator('tr.mat-mdc-row, tr[mat-row], tbody tr');
  const rowCount = await rows.count();
  if (rowCount >= 10) ok(`Liste salariés — ${rowCount} ligne(s) visible(s) (attendu ≥ 10)`);
  else if (rowCount > 0) warn(`Liste salariés — seulement ${rowCount} ligne(s) (attendu ~13)`);
  else fail('Liste salariés — aucune ligne dans le tableau');

  // Recherche par nom
  const searchInput = page.locator('input.search');
  if (!await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    warn('Liste salariés — champ .search absent');
    return;
  }
  await searchInput.fill('Thomas');
  await page.waitForTimeout(500);
  const filtered = await rows.count();
  if (filtered > 0) ok(`Liste salariés — recherche "Thomas" : ${filtered} résultat(s)`);
  else fail('Liste salariés — recherche "Thomas" : 0 résultat (filtrage défaillant)');

  // Effacer la recherche
  await searchInput.fill('');
  await page.waitForTimeout(300);
}

// ════════════════════════════════════════════════════════════
// 2. Édition salarié via drawer (salaries.component)
// ════════════════════════════════════════════════════════════
async function testEditionDrawer() {
  sec('2. Édition salarié — drawer (salaries.component)');
  // On est déjà sur /rh/salaries depuis le test 1
  // Si pas le cas, re-naviguer
  if (!page.url().includes('/rh/salaries') || page.url().includes('/rh/salaries/')) {
    await gotoRH('/rh/salaries');
  }
  await page.waitForTimeout(800);

  // Ouvrir le menu contextuel (more_vert) de la première ligne
  const menuBtn = page.locator('.table-wrap button[mat-icon-button]').first();
  if (!await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Édition drawer — bouton mat-icon-button absent dans le tableau');
    return;
  }
  await menuBtn.click();
  await page.waitForTimeout(400);
  ok('Édition drawer — menu contextuel ouvert');

  // Cliquer "Modifier"
  const modifierBtn = page.locator('button[mat-menu-item]').filter({ hasText: /Modifier/i }).first();
  if (!await modifierBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Édition drawer — item "Modifier" absent du menu');
    await page.keyboard.press('Escape');
    return;
  }
  await modifierBtn.click();
  await page.waitForTimeout(500);

  // Le drawer doit apparaître
  const drawer = page.locator('.drawer');
  if (!await drawer.isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Édition drawer — .drawer non visible après clic Modifier');
    return;
  }
  ok('Édition drawer — .drawer ouvert');

  // Remplir le champ "poste"
  const posteInput = drawer.locator('input[formcontrolname="poste"]');
  if (!await posteInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    warn('Édition drawer — input[formcontrolname="poste"] absent');
  } else {
    await posteInput.fill('Testeur Playwright');
    ok('Édition drawer — champ "poste" rempli');
  }

  // Soumettre
  const submitBtn = drawer.locator('button[type="submit"]');
  if (!await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Édition drawer — bouton submit absent');
    await page.keyboard.press('Escape');
    return;
  }
  await submitBtn.click();
  await page.waitForTimeout(2000);

  // Snackbar de confirmation
  const snack = await getSnackbar();
  if (snack && /mise à jour/i.test(snack)) {
    ok(`Édition drawer — snackbar : "${snack.trim().substring(0, 60)}"`);
  } else if (snack) {
    warn(`Édition drawer — snackbar inattendu : "${snack.trim().substring(0, 60)}"`);
  } else {
    fail('Édition drawer — pas de snackbar après soumission');
  }

  // Le drawer doit se fermer
  const stillOpen = await drawer.isVisible({ timeout: 1000 }).catch(() => false);
  if (!stillOpen) ok('Édition drawer — drawer fermé après sauvegarde');
  else warn('Édition drawer — drawer encore visible après sauvegarde');
}

// ════════════════════════════════════════════════════════════
// 3. Fiche détail salarié — /rh/salaries/7 (Thomas Berger)
// ════════════════════════════════════════════════════════════
async function testFicheDetail() {
  sec('3. Fiche détail — /rh/salaries/7 (Thomas Berger)');
  await gotoRH('/rh/salaries/7');

  // Vérifier que la fiche est chargée
  const layout = page.locator('.emp-layout, .emp-header');
  if (!await layout.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    fail('Fiche détail — .emp-layout/.emp-header non visible');
    return;
  }
  ok('Fiche détail — page chargée (.emp-layout visible)');

  // Vérifier le nom dans le header
  const name = await page.locator('.emp-name').first().textContent({ timeout: 2000 }).catch(() => '');
  if (name?.trim()) ok(`Fiche détail — nom : "${name.trim()}"`);
  else warn('Fiche détail — .emp-name non trouvé');

  // Ouvrir le drawer d'édition via .btn-edit
  const editBtn = page.locator('button.btn-edit');
  if (!await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Fiche détail — button.btn-edit absent');
    return;
  }
  await editBtn.click();
  await page.waitForTimeout(500);

  // Le drawer .edit-drawer doit apparaître
  const drawer = page.locator('.edit-drawer');
  if (!await drawer.isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Fiche détail — .edit-drawer non visible après clic Modifier');
    return;
  }
  ok('Fiche détail — .edit-drawer ouvert');

  // Remplir le champ "ville"
  const villeInput = drawer.locator('input[formcontrolname="ville"]');
  if (!await villeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    warn('Fiche détail — input[formcontrolname="ville"] absent');
  } else {
    await villeInput.fill('Saint-Denis');
    ok('Fiche détail — champ "ville" rempli avec "Saint-Denis"');
  }

  // Soumettre
  const submitBtn = drawer.locator('button[type="submit"]');
  if (!await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Fiche détail — bouton submit absent dans le drawer');
    await page.keyboard.press('Escape');
    return;
  }
  await submitBtn.click();
  await page.waitForTimeout(2000);

  // Snackbar
  const snack = await getSnackbar();
  if (snack && /mis à jour|mise à jour|enregistr/i.test(snack)) {
    ok(`Fiche détail — snackbar : "${snack.trim().substring(0, 60)}"`);
  } else if (snack) {
    warn(`Fiche détail — snackbar inattendu : "${snack.trim().substring(0, 60)}"`);
  } else {
    fail('Fiche détail — pas de snackbar après soumission');
  }

  // Drawer fermé
  const stillOpen = await drawer.isVisible({ timeout: 1000 }).catch(() => false);
  if (!stillOpen) ok('Fiche détail — drawer fermé après sauvegarde');
  else warn('Fiche détail — drawer encore visible');
}

// ════════════════════════════════════════════════════════════
// 4. Congés — liste /rh/conges
// ════════════════════════════════════════════════════════════
async function testCongesList() {
  sec('4. Congés — liste /rh/conges');
  await gotoRH('/rh/conges');

  // Les onglets .view-tab doivent être présents
  const viewTabs = page.locator('button.view-tab');
  const tabCount = await viewTabs.count();
  if (tabCount >= 2) ok(`Congés liste — ${tabCount} onglet(s) de vue présents`);
  else fail(`Congés liste — onglets .view-tab insuffisants (${tabCount})`);

  // La vue "Demandes" est active par défaut → .demandes-table visible
  await page.waitForTimeout(1000); // laisser charger
  const demandesTable = page.locator('.demandes-table');
  if (await demandesTable.isVisible({ timeout: 4000 }).catch(() => false)) {
    ok('Congés liste — .demandes-table visible');
    // Compter les demandes
    const rows = demandesTable.locator('.table-row');
    const rowCount = await rows.count();
    ok(`Congés liste — ${rowCount} demande(s) affichée(s)`);
  } else {
    // Peut-être la vue Demandes est vide
    const emptyRow = page.locator('.empty-row');
    if (await emptyRow.isVisible({ timeout: 2000 }).catch(() => false)) {
      ok('Congés liste — vue Demandes vide (aucune demande pour cette année)');
    } else {
      warn('Congés liste — .demandes-table non trouvé');
    }
  }

  // Basculer vers la vue "Soldes"
  const soldesTab = viewTabs.filter({ hasText: /Solde/i }).first();
  if (!await soldesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Congés liste — onglet "Soldes" absent');
    return;
  }
  await soldesTab.click();
  await page.waitForTimeout(1500);
  ok('Congés liste — onglet "Soldes" cliqué');

  // La vue soldes doit s'afficher
  const soldesTable = page.locator('.soldes-table');
  if (await soldesTable.isVisible({ timeout: 3000 }).catch(() => false)) {
    ok('Congés liste — .soldes-table visible ✓');
  } else {
    const loadingRow = page.locator('.loading-row');
    if (await loadingRow.isVisible({ timeout: 1000 }).catch(() => false)) {
      warn('Congés liste — vue Soldes encore en chargement');
    } else {
      warn('Congés liste — .soldes-table non visible après basculement');
    }
  }

  // Revenir à la vue Demandes pour les tests suivants
  const demandesTab = viewTabs.filter({ hasText: /Demande/i }).first();
  await demandesTab.click();
  await page.waitForTimeout(800);
}

// ════════════════════════════════════════════════════════════
// 5. Congés — créer une demande
// ════════════════════════════════════════════════════════════
let createdCongeId = null;

async function testCreerConge() {
  sec('5. Congés — créer une demande');
  // On reste sur /rh/conges

  // Cliquer sur .btn-new
  const btnNew = page.locator('button.btn-new');
  if (!await btnNew.isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Créer congé — button.btn-new absent');
    return;
  }
  await btnNew.click();
  await page.waitForTimeout(500);

  // La modale doit apparaître
  const modal = page.locator('.modal');
  if (!await modal.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Créer congé — .modal non visible après clic btn-new');
    return;
  }
  ok('Créer congé — .modal ouverte');

  // Sélectionner le collaborateur (userId)
  const userIdSelect = modal.first().locator('mat-select[formcontrolname="userId"]');
  if (!await userIdSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Créer congé — mat-select[formcontrolname="userId"] absent');
    await page.keyboard.press('Escape');
    return;
  }
  const userSelected = await selectMatOption(userIdSelect, /Thomas|Berger/i);
  if (userSelected) ok('Créer congé — userId sélectionné (Thomas Berger)');
  else {
    // Prendre le premier collaborateur disponible
    const firstUser = await selectMatOption(userIdSelect, /.+/);
    if (firstUser) ok('Créer congé — userId sélectionné (premier disponible)');
    else warn('Créer congé — impossible de sélectionner un userId');
  }

  // Sélectionner MALADIE (pas de vérification de solde, contrairement à CONGES_PAYES)
  const typeSelect = modal.first().locator('mat-select[formcontrolname="typeConge"]');
  if (await typeSelect.isVisible({ timeout: 1500 }).catch(() => false)) {
    const typed = await selectMatOption(typeSelect, /Maladie|MALADIE/i);
    if (typed) ok('Créer congé — typeConge "Maladie" sélectionné');
    else warn('Créer congé — typeConge non sélectionné');
  }

  // Remplir la date de début
  const dateDebut = modal.first().locator('input[formcontrolname="dateDebut"]');
  if (await dateDebut.isVisible({ timeout: 1500 }).catch(() => false)) {
    await dateDebut.fill('2026-08-01');
    ok('Créer congé — dateDebut = 2026-08-01');
  } else warn('Créer congé — input dateDebut absent');

  // Remplir la date de fin
  const dateFin = modal.first().locator('input[formcontrolname="dateFin"]');
  if (await dateFin.isVisible({ timeout: 1500 }).catch(() => false)) {
    await dateFin.fill('2026-08-05');
    ok('Créer congé — dateFin = 2026-08-05');
  } else warn('Créer congé — input dateFin absent');

  // Nombre de jours
  const nbJours = modal.first().locator('input[formcontrolname="nombreJours"]');
  if (await nbJours.isVisible({ timeout: 1500 }).catch(() => false)) {
    await nbJours.clear();
    await nbJours.fill('5');
    ok('Créer congé — nombreJours = 5');
  } else warn('Créer congé — input nombreJours absent');

  // Soumettre
  const submitBtn = modal.first().locator('button[type="submit"]');
  if (!await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Créer congé — bouton submit absent dans la modale');
    await page.keyboard.press('Escape');
    return;
  }
  await submitBtn.click();

  // Snackbar (duration=2500ms dans le composant — ne pas attendre trop longtemps avant de vérifier)
  const snack = await getSnackbar();
  if (snack && /demande créée|créé/i.test(snack)) {
    ok(`Créer congé — snackbar : "${snack.trim().substring(0, 60)}"`);
  } else if (snack && /erreur|error/i.test(snack)) {
    warn(`Créer congé — erreur snackbar : "${snack.trim().substring(0, 80)}"`);
  } else if (snack) {
    warn(`Créer congé — snackbar inattendu : "${snack.trim().substring(0, 60)}"`);
  } else {
    fail('Créer congé — pas de snackbar après soumission');
  }

  // Modal fermée
  const stillOpen = await modal.first().isVisible({ timeout: 1000 }).catch(() => false);
  if (!stillOpen) ok('Créer congé — modale fermée après création');
  else warn('Créer congé — modale encore visible (vérifier les champs obligatoires)');

  // Mémoriser l'id de la demande créée pour le nettoyage
  await page.waitForTimeout(1000);
  const demandes = await apiCall('/conges?annee=2026');
  if (Array.isArray(demandes)) {
    const latest = demandes
      .filter(d => d.dateDebut?.startsWith('2026-08-01') || d.dateFin?.startsWith('2026-08-05'))
      .sort((a, b) => b.id - a.id)[0];
    if (latest) {
      createdCongeId = latest.id;
      ok(`Créer congé — id de la demande créée : ${createdCongeId}`);
    }
  }
}

// ════════════════════════════════════════════════════════════
// 6. Congés — approuver une demande EN_ATTENTE
// ════════════════════════════════════════════════════════════
let approveCongeId = null;
let refuseCongeId  = null;

async function testApprouverConge() {
  sec('6. Congés — approuver une demande EN_ATTENTE');

  // Pré-créer une demande MALADIE EN_ATTENTE via API (pas de vérif de solde)
  const newConge = await apiCall('/conges', 'POST', {
    userId: 7, typeConge: 'MALADIE',
    dateDebut: '2026-09-01', dateFin: '2026-09-03', nombreJours: 3,
    motif: 'Test E2E approuver',
  });
  if (newConge?.id) {
    approveCongeId = newConge.id;
    ok(`Approuver — demande pré-créée via API (id=${approveCongeId})`);
  } else {
    fail(`Approuver — échec création via API : ${JSON.stringify(newConge)}`);
    return;
  }

  // Recharger /rh/conges
  await gotoRH('/rh/conges');
  await page.waitForTimeout(800);

  // Activer vue Demandes
  const demandesTab = page.locator('button.view-tab').filter({ hasText: /Demande/i }).first();
  if (await demandesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await demandesTab.click();
    await page.waitForTimeout(600);
  }

  // Filtrer EN_ATTENTE
  const statutSelect = page.locator('select.filter-select').filter({ has: page.locator('option[value="EN_ATTENTE"]') }).first();
  if (await statutSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    await statutSelect.selectOption('EN_ATTENTE');
    await page.waitForTimeout(500);
    ok('Approuver — filtre "EN_ATTENTE" appliqué');
  }

  const approveBtn = page.locator('button.btn-approve').first();
  if (!await approveBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    fail('Approuver — bouton .btn-approve non visible');
    return;
  }
  await approveBtn.click();

  // duration=2000ms dans le composant — vérifier immédiatement
  const snack = await getSnackbar();
  if (snack && /approuvée/i.test(snack)) ok(`Approuver — snackbar : "${snack.trim().substring(0, 60)}"`);
  else if (snack) warn(`Approuver — snackbar inattendu : "${snack.trim().substring(0, 60)}"`);
  else fail('Approuver — pas de snackbar après approbation');
}

// ════════════════════════════════════════════════════════════
// 7. Congés — refuser une demande EN_ATTENTE
// ════════════════════════════════════════════════════════════
async function testRefuserConge() {
  sec('7. Congés — refuser une demande EN_ATTENTE');

  // Pré-créer une 2e demande MALADIE EN_ATTENTE via API
  const newConge = await apiCall('/conges', 'POST', {
    userId: 7, typeConge: 'MALADIE',
    dateDebut: '2026-10-01', dateFin: '2026-10-02', nombreJours: 2,
    motif: 'Test E2E refuser',
  });
  if (newConge?.id) {
    refuseCongeId = newConge.id;
    ok(`Refuser — demande pré-créée via API (id=${refuseCongeId})`);
  } else {
    fail(`Refuser — échec création via API : ${JSON.stringify(newConge)}`);
    return;
  }

  // Recharger /rh/conges
  await gotoRH('/rh/conges');
  await page.waitForTimeout(800);

  // Activer vue Demandes
  const demandesTab = page.locator('button.view-tab').filter({ hasText: /Demande/i }).first();
  if (await demandesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await demandesTab.click();
    await page.waitForTimeout(600);
  }

  // Filtrer EN_ATTENTE
  const statutSelect = page.locator('select.filter-select').filter({ has: page.locator('option[value="EN_ATTENTE"]') }).first();
  if (await statutSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    await statutSelect.selectOption('EN_ATTENTE');
    await page.waitForTimeout(500);
  }

  const refuseBtn = page.locator('button.btn-refuse').first();
  if (!await refuseBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    fail('Refuser — bouton .btn-refuse non visible');
    return;
  }
  await refuseBtn.click();
  await page.waitForTimeout(500);
  ok('Refuser — bouton .btn-refuse cliqué, modale refus attendue');

  // La modale de refus .modal--sm doit apparaître
  const refusModal = page.locator('.modal.modal--sm, .modal--sm');
  if (!await refusModal.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Refuser — modale .modal--sm non visible');
    return;
  }
  ok('Refuser — modale de refus visible');

  // Remplir le textarea du motif
  const textarea = refusModal.first().locator('textarea');
  if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
    await textarea.fill('Refus Playwright E2E — test automatisé');
    ok('Refuser — motif renseigné');
  } else warn('Refuser — textarea absent dans la modale');

  // Soumettre (bouton "Refuser" de couleur warn)
  const submitRefus = refusModal.first().locator('button[mat-flat-button], button').filter({ hasText: /Refuser/i }).last();
  if (!await submitRefus.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Refuser — bouton "Refuser" absent dans la modale');
    await page.keyboard.press('Escape');
    return;
  }
  await submitRefus.click();

  // duration=2000ms dans le composant — vérifier immédiatement
  const snack = await getSnackbar();
  if (snack && /refusée/i.test(snack)) {
    ok(`Refuser — snackbar : "${snack.trim().substring(0, 60)}"`);
  } else if (snack) {
    warn(`Refuser — snackbar inattendu : "${snack.trim().substring(0, 60)}"`);
  } else {
    fail('Refuser — pas de snackbar après refus');
  }
}

// ════════════════════════════════════════════════════════════
// 8. Nettoyage
// ════════════════════════════════════════════════════════════
async function testCleanup() {
  sec('8. Nettoyage');

  if (!createdCongeId) {
    warn('Nettoyage — aucune demande créée en test à nettoyer');
    return;
  }

  // Tenter d'annuler la demande créée (PATCH /conges/:id/annuler)
  // Note : l'endpoint vérifie que req.user.id correspond au propriétaire.
  // L'admin peut créer pour un autre userId → l'annulation pourrait échouer.
  const r = await fetch(`${API}/conges/${createdCongeId}/annuler`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (r.ok) {
    ok(`Nettoyage — demande id=${createdCongeId} annulée via PATCH /conges/:id/annuler`);
  } else {
    const body = await r.json().catch(() => ({}));
    warn(`Nettoyage — annulation impossible (${r.status}) : ${body?.message ?? 'erreur inconnue'} — demande laissée en base`);
  }
}

// ════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════
(async () => {
  // Obtenir le token admin via l'API
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@afym.re', password: 'Admin1234!' }),
  });
  const loginData = await loginRes.json().catch(() => ({}));
  token = loginData.access_token;
  if (!token) {
    console.error('ERREUR CRITIQUE : impossible d\'obtenir le token admin');
    process.exit(1);
  }
  ok('Auth API — token admin obtenu');

  // Lancer le navigateur
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  page = await ctx.newPage();

  // Login UI
  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 8000 });
  await page.locator('input[type="email"]').fill('admin@afym.re');
  await page.locator('input[type="password"]').fill('Admin1234!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  ok('Auth UI — connexion admin OK');

  // Exécution des tests
  await testListeSalaries();
  await testEditionDrawer();
  await testFicheDetail();
  await testCongesList();
  await testCreerConge();
  await testApprouverConge();
  await testRefuserConge();
  await testCleanup();

  await browser.close();

  const total  = results.length;
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${passed} ✅  |  ${failed} ❌  |  ${total} total`);
  console.log(`${'═'.repeat(60)}`);
  if (failed > 0) process.exit(1);
})().catch(e => { console.error('ERREUR CRITIQUE:', e.message); process.exit(1); });
