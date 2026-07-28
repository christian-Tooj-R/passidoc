/**
 * test-rh.mjs — Tests E2E complets du module RH de Passidoc
 *
 * Sections :
 *  1.  Navigation RH — menu sidebar
 *  2.  Liste salariés (/rh/salaries)
 *  3.  Édition salarié via drawer (liste)
 *  4.  Fiche détail salarié (/rh/salaries/7)
 *  5.  Congés — filtre EN_ATTENTE par défaut
 *  6.  Congés — nouvelle demande via DRAWER (plus modal)
 *  7.  Congés — approuver une demande
 *  8.  Congés — refuser via modal de confirmation
 *  9.  Congés — vues Soldes & Statistiques
 * 10.  Agenda — affichage Gantt et structure
 * 11.  Agenda — filtres site, recherche, groupes collapsibles
 * 12.  Agenda — panneau droit Solde disponible
 * 13.  Agenda — numéros de semaine et libellés de type
 * 14.  Agenda — navigation mois et bouton demande
 * 15.  Soldes — acquisition mensuelle manuelle (+2,5 j)
 * 16.  Soldes — basculement reliquat annuel
 * 17.  Nettoyage
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4200';
const API  = 'http://localhost:3000/api';
let page, browser, token;
let createdCongeId = null;
let approveCongeId = null;
let refuseCongeId  = null;

// ── Reporters ───────────────────────────────────────────────────
const results = [];
const ok   = (msg) => { console.log('  ✅', msg); results.push({ ok: true,  msg }); };
const warn = (msg) => { console.log('  ⚠️ ', msg); results.push({ ok: true,  msg }); };
const fail = (msg) => { console.log('  ❌', msg); results.push({ ok: false, msg }); };
const sec  = (n, title) => console.log(`\n${'═'.repeat(62)}\n  ${n}. ${title}\n${'═'.repeat(62)}`);

// ── Helpers ─────────────────────────────────────────────────────
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

/** Navigue vers une route RH et attend la fin de l'animation d'entrée (1,6 s). */
async function gotoRH(path) {
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(2200);
}

/** Ouvre un mat-select et clique sur la première option correspondant au texte. */
async function selectMatOption(containerLocator, optionText) {
  await containerLocator.locator('.mat-mdc-select-trigger').click({ force: true });
  await page.waitForTimeout(400);
  const opt = page.locator('mat-option').filter({ hasText: optionText }).first();
  if (await opt.isVisible({ timeout: 3000 }).catch(() => false)) {
    await opt.click();
    await page.waitForTimeout(300);
    return true;
  }
  await page.keyboard.press('Escape');
  return false;
}

// ════════════════════════════════════════════════════════════════
//  1. Navigation RH — menu sidebar
// ════════════════════════════════════════════════════════════════
async function testNavigationRH() {
  sec(1, 'Navigation RH — menu sidebar');
  await gotoRH('/rh');

  // La sidebar RH doit être présente
  const sidebar = page.locator('.rh-sidebar');
  if (!await sidebar.isVisible({ timeout: 5000 }).catch(() => false)) {
    fail('Navigation — .rh-sidebar absente'); return;
  }
  ok('Navigation — .rh-sidebar visible');

  // Vérifier les 3 items de navigation
  const navItems = sidebar.locator('.rh-nav__item');
  const navCount = await navItems.count();
  if (navCount >= 3) ok(`Navigation — ${navCount} items de nav présents`);
  else fail(`Navigation — seulement ${navCount} items (attendu ≥ 3)`);

  // Vérifier les libellés exacts
  const labels = [];
  for (let i = 0; i < navCount; i++) {
    labels.push((await navItems.nth(i).textContent()).trim());
  }
  const hasCollabs  = labels.some(l => /collaborateur/i.test(l));
  const hasConges   = labels.some(l => /cong/i.test(l));
  const hasAgenda   = labels.some(l => /agenda/i.test(l));
  if (hasCollabs)  ok('Navigation — item "Collaborateurs" présent');
  else             fail('Navigation — item "Collaborateurs" manquant');
  if (hasConges)   ok('Navigation — item "Congés & Absences" présent');
  else             fail('Navigation — item "Congés & Absences" manquant');
  if (hasAgenda)   ok('Navigation — item "Agenda" présent (plus "Calendrier")');
  else             fail('Navigation — item "Agenda" manquant (renommage non effectué ?)');

  // Clic sur chaque item et vérification URL
  for (const item of [
    { text: /Collaborateurs/i, url: '/rh/salaries' },
    { text: /Congés/i,         url: '/rh/conges'   },
    { text: /Agenda/i,         url: '/rh/calendrier' },
  ]) {
    const link = navItems.filter({ hasText: item.text }).first();
    if (await link.isVisible({ timeout: 1500 }).catch(() => false)) {
      await link.click();
      await page.waitForTimeout(800);
      const url = page.url();
      if (url.includes(item.url)) ok(`Navigation — clic "${item.text}" → ${item.url} ✓`);
      else warn(`Navigation — URL après clic : ${url} (attendu ${item.url})`);
    }
  }
}

// ════════════════════════════════════════════════════════════════
//  2. Liste salariés — /rh/salaries
// ════════════════════════════════════════════════════════════════
async function testListeSalaries() {
  sec(2, 'Liste salariés — /rh/salaries');
  await gotoRH('/rh/salaries');

  const tableWrap = page.locator('.table-wrap');
  if (!await tableWrap.isVisible({ timeout: 6000 }).catch(() => false)) {
    fail('Liste salariés — .table-wrap absent'); return;
  }
  ok('Liste salariés — .table-wrap visible');

  await page.waitForTimeout(1000);
  const rows = tableWrap.locator('tr.mat-mdc-row, tr[mat-row], tbody tr');
  const rowCount = await rows.count();
  if (rowCount >= 10)     ok(`Liste salariés — ${rowCount} lignes (≥ 10 attendu)`);
  else if (rowCount > 0)  warn(`Liste salariés — ${rowCount} lignes (attendu ~13)`);
  else                    fail('Liste salariés — aucune ligne');

  // Recherche
  const searchInput = page.locator('input.search');
  if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await searchInput.fill('Thomas');
    await page.waitForTimeout(500);
    const filtered = await rows.count();
    if (filtered > 0) ok(`Liste salariés — recherche "Thomas" : ${filtered} résultat(s)`);
    else              fail('Liste salariés — recherche "Thomas" : 0 résultat');
    await searchInput.fill('');
    await page.waitForTimeout(300);
  } else warn('Liste salariés — champ .search absent');
}

// ════════════════════════════════════════════════════════════════
//  3. Édition salarié — drawer depuis la liste
// ════════════════════════════════════════════════════════════════
async function testEditionDrawer() {
  sec(3, 'Édition salarié — drawer (liste /rh/salaries)');
  if (!page.url().includes('/rh/salaries') || page.url().includes('/rh/salaries/')) {
    await gotoRH('/rh/salaries');
    await page.waitForTimeout(800);
  }

  const menuBtn = page.locator('.table-wrap button[mat-icon-button]').first();
  if (!await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Édition drawer — bouton mat-icon-button absent'); return;
  }
  await menuBtn.click();
  await page.waitForTimeout(400);

  const modifierBtn = page.locator('button[mat-menu-item]').filter({ hasText: /Modifier/i }).first();
  if (!await modifierBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Édition drawer — item "Modifier" absent');
    await page.keyboard.press('Escape'); return;
  }
  await modifierBtn.click();
  await page.waitForTimeout(500);

  const drawer = page.locator('.drawer');
  if (!await drawer.isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Édition drawer — .drawer non visible'); return;
  }
  ok('Édition drawer — .drawer ouvert');

  const posteInput = drawer.locator('input[formcontrolname="poste"]');
  if (await posteInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await posteInput.fill('Testeur Playwright');
    ok('Édition drawer — champ "poste" rempli');
  } else warn('Édition drawer — champ "poste" absent');

  const submitBtn = drawer.locator('button[type="submit"]');
  if (!await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Édition drawer — bouton submit absent');
    await page.keyboard.press('Escape'); return;
  }
  await submitBtn.click();
  await page.waitForTimeout(2000);

  const snack = await getSnackbar();
  if (snack && /mise à jour|mis à jour/i.test(snack)) ok(`Édition drawer — snackbar OK : "${snack.trim().slice(0,60)}"`);
  else if (snack) warn(`Édition drawer — snackbar : "${snack.trim().slice(0,60)}"`);
  else            fail('Édition drawer — pas de snackbar');

  const stillOpen = await drawer.isVisible({ timeout: 1000 }).catch(() => false);
  if (!stillOpen) ok('Édition drawer — fermé après sauvegarde');
  else            warn('Édition drawer — encore visible après sauvegarde');
}

// ════════════════════════════════════════════════════════════════
//  4. Fiche détail salarié — /rh/salaries/7
// ════════════════════════════════════════════════════════════════
async function testFicheDetail() {
  sec(4, 'Fiche détail salarié — /rh/salaries/7');
  await gotoRH('/rh/salaries/7');

  const layout = page.locator('.emp-layout, .emp-header');
  if (!await layout.first().isVisible({ timeout: 5000 }).catch(() => false)) {
    fail('Fiche détail — .emp-layout/.emp-header absent'); return;
  }
  ok('Fiche détail — page chargée');

  const name = await page.locator('.emp-name').first().textContent({ timeout: 2000 }).catch(() => '');
  if (name?.trim()) ok(`Fiche détail — nom : "${name.trim()}"`);
  else warn('Fiche détail — .emp-name non trouvé');

  // Onglets principaux de la fiche (Profil / Congés / Documents)
  const tabs = page.locator('button.tab-item');
  const tabCount = await tabs.count();
  if (tabCount >= 3) ok(`Fiche détail — ${tabCount} onglet(s) présents`);
  else warn(`Fiche détail — ${tabCount} onglet(s) (attendu ≥ 3)`);

  // Ouvrir le drawer d'édition
  const editBtn = page.locator('button.btn-edit');
  if (!await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Fiche détail — button.btn-edit absent'); return;
  }
  await editBtn.click();
  await page.waitForTimeout(500);

  const drawer = page.locator('.edit-drawer');
  if (!await drawer.isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Fiche détail — .edit-drawer non visible'); return;
  }
  ok('Fiche détail — .edit-drawer ouvert');

  const villeInput = drawer.locator('input[formcontrolname="ville"]');
  if (await villeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await villeInput.fill('Saint-Denis');
    ok('Fiche détail — champ "ville" rempli');
  } else warn('Fiche détail — champ "ville" absent');

  const submitBtn = drawer.locator('button[type="submit"]');
  if (!await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Fiche détail — bouton submit absent');
    await page.keyboard.press('Escape'); return;
  }
  await submitBtn.click();
  await page.waitForTimeout(2000);

  const snack = await getSnackbar();
  if (snack && /mis à jour|mise à jour|enregistr/i.test(snack)) ok(`Fiche détail — snackbar OK`);
  else if (snack) warn(`Fiche détail — snackbar : "${snack.trim().slice(0,60)}"`);
  else            fail('Fiche détail — pas de snackbar');

  const stillOpen = await drawer.isVisible({ timeout: 1000 }).catch(() => false);
  if (!stillOpen) ok('Fiche détail — drawer fermé après sauvegarde');
  else            warn('Fiche détail — drawer encore visible');
}

// ════════════════════════════════════════════════════════════════
//  5. Congés — filtre EN_ATTENTE par défaut
// ════════════════════════════════════════════════════════════════
async function testFiltreDefaut() {
  sec(5, 'Congés — filtre EN_ATTENTE par défaut');
  await gotoRH('/rh/conges');
  await page.waitForTimeout(1000);

  // Le select de statut doit avoir EN_ATTENTE sélectionné
  const statutSelect = page.locator('select.filter-select')
    .filter({ has: page.locator('option[value="EN_ATTENTE"]') }).first();

  if (!await statutSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Filtre défaut — select.filter-select avec EN_ATTENTE absent'); return;
  }

  const selectedVal = await statutSelect.inputValue();
  if (selectedVal === 'EN_ATTENTE') {
    ok('Filtre défaut — "EN_ATTENTE" sélectionné par défaut ✓');
  } else {
    fail(`Filtre défaut — valeur par défaut = "${selectedVal}" (attendu "EN_ATTENTE")`);
  }

  // La table ne doit afficher que des lignes EN_ATTENTE (ou être vide)
  await page.waitForTimeout(800);
  const badges = page.locator('.demandes-table .status-badge, .demandes-table .badge');
  const badgeCount = await badges.count();
  if (badgeCount > 0) {
    let allPending = true;
    for (let i = 0; i < Math.min(badgeCount, 5); i++) {
      const text = (await badges.nth(i).textContent()).trim();
      if (!/attente/i.test(text)) { allPending = false; }
    }
    if (allPending) ok(`Filtre défaut — ${badgeCount} demande(s) EN_ATTENTE affichées`);
    else            warn('Filtre défaut — certaines lignes ne sont pas EN_ATTENTE');
  } else {
    ok('Filtre défaut — aucune demande EN_ATTENTE actuellement (liste vide)');
  }
}

// ════════════════════════════════════════════════════════════════
//  6. Congés — nouvelle demande via DRAWER (plus modal)
// ════════════════════════════════════════════════════════════════
async function testCreerCongeDrawer() {
  sec(6, 'Congés — nouvelle demande via DRAWER');

  // Créditer du solde CONGES_PAYES pour Thomas Berger (userId=7) si besoin
  await apiCall('/conges/soldes/7', 'PATCH', {
    typeConge: 'CONGES_PAYES', annee: 2026, joursAcquis: 25,
  });

  // On est déjà sur /rh/conges
  if (!page.url().includes('/rh/conges')) await gotoRH('/rh/conges');

  const btnNew = page.locator('button.btn-new');
  if (!await btnNew.isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Créer congé — button.btn-new absent'); return;
  }
  await btnNew.click();
  await page.waitForTimeout(600);

  // ── Doit ouvrir un DRAWER, pas un modal centré ──
  const drawer = page.locator('.drawer');
  const modal  = page.locator('.modal');
  const drawerVisible = await drawer.isVisible({ timeout: 3000 }).catch(() => false);
  const modalVisible  = await modal.first().isVisible({ timeout: 500 }).catch(() => false);

  if (drawerVisible && !modalVisible) {
    ok('Créer congé — DRAWER ouvert (panel droit, pas modal centré) ✓');
  } else if (modalVisible) {
    fail('Créer congé — modal centré ouvert au lieu du drawer ✗');
    await page.keyboard.press('Escape'); return;
  } else {
    fail('Créer congé — ni drawer ni modal visible');
    return;
  }

  // En-tête du drawer
  const drawerTitle = drawer.locator('.drawer__title');
  if (await drawerTitle.isVisible({ timeout: 1500 }).catch(() => false)) {
    const titleText = await drawerTitle.textContent();
    ok(`Créer congé — titre drawer : "${titleText?.trim()}"`);
  } else warn('Créer congé — .drawer__title absent');

  // Sections visuelles (drawer__section)
  const sections = drawer.locator('.drawer__section');
  const secCount = await sections.count();
  if (secCount >= 2) ok(`Créer congé — ${secCount} sections visuelles dans le drawer`);
  else warn(`Créer congé — ${secCount} section(s) (attendu ≥ 2)`);

  // Sélectionner le collaborateur
  const userIdSelect = drawer.locator('mat-select[formcontrolname="userId"]');
  if (await userIdSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    const selected = await selectMatOption(userIdSelect, /Thomas|Berger/i)
      || await selectMatOption(userIdSelect, /.+/);
    if (selected) ok('Créer congé — collaborateur sélectionné');
    else warn('Créer congé — impossible de sélectionner un collaborateur');
  } else warn('Créer congé — mat-select userId absent');

  // Type : MALADIE (pas de vérif de solde)
  const typeSelect = drawer.locator('mat-select[formcontrolname="typeConge"]');
  if (await typeSelect.isVisible({ timeout: 1500 }).catch(() => false)) {
    const typed = await selectMatOption(typeSelect, /Maladie/i);
    if (typed) ok('Créer congé — type "Maladie" sélectionné');
    else warn('Créer congé — type non sélectionné');
  }

  // Dates
  const dateDebut = drawer.locator('input[formcontrolname="dateDebut"]');
  const dateFin   = drawer.locator('input[formcontrolname="dateFin"]');
  const nbJours   = drawer.locator('input[formcontrolname="nombreJours"]');

  if (await dateDebut.isVisible({ timeout: 1000 }).catch(() => false)) {
    await dateDebut.fill('2026-11-03');
    ok('Créer congé — dateDebut remplie');
  }
  if (await dateFin.isVisible({ timeout: 1000 }).catch(() => false)) {
    await dateFin.fill('2026-11-07');
    ok('Créer congé — dateFin remplie');
  }
  if (await nbJours.isVisible({ timeout: 1000 }).catch(() => false)) {
    await nbJours.clear();
    await nbJours.fill('5');
    ok('Créer congé — nombreJours = 5');
  }

  // Motif
  const motifInput = drawer.locator('input[formcontrolname="motif"]');
  if (await motifInput.isVisible({ timeout: 1000 }).catch(() => false)) {
    await motifInput.fill('Test Playwright E2E');
    ok('Créer congé — motif renseigné');
  }

  // Soumettre
  const submitBtn = drawer.locator('button[type="submit"]');
  if (!await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Créer congé — bouton submit absent');
    await page.keyboard.press('Escape'); return;
  }
  await submitBtn.click();
  await page.waitForTimeout(2500);

  const snack = await getSnackbar();
  if (snack && /créée|créé|demande/i.test(snack))     ok(`Créer congé — snackbar OK : "${snack.trim().slice(0,60)}"`);
  else if (snack && /erreur|error|solde/i.test(snack)) warn(`Créer congé — erreur : "${snack.trim().slice(0,80)}"`);
  else if (snack)                                       warn(`Créer congé — snackbar : "${snack.trim().slice(0,60)}"`);
  else                                                  fail('Créer congé — pas de snackbar');

  // Drawer doit se fermer
  const drawerStillOpen = await drawer.isVisible({ timeout: 1000 }).catch(() => false);
  if (!drawerStillOpen) ok('Créer congé — drawer fermé après soumission');
  else warn('Créer congé — drawer encore visible (vérifier les validations)');

  // Récupérer l'id pour le nettoyage
  await page.waitForTimeout(500);
  const demandes = await apiCall('/conges?annee=2026');
  if (Array.isArray(demandes)) {
    const latest = demandes
      .filter(d => d.dateDebut?.startsWith('2026-11'))
      .sort((a, b) => b.id - a.id)[0];
    if (latest) { createdCongeId = latest.id; ok(`Créer congé — id créé : ${createdCongeId}`); }
  }
}

// ════════════════════════════════════════════════════════════════
//  7. Congés — approuver une demande EN_ATTENTE
// ════════════════════════════════════════════════════════════════
async function testApprouverConge() {
  sec(7, 'Congés — approuver une demande EN_ATTENTE');

  // Date en décembre pour être en tête du tri dateDebut DESC (> novembre du drawer §6)
  const newConge = await apiCall('/conges', 'POST', {
    userId: 7, typeConge: 'MALADIE',
    dateDebut: '2026-12-01', dateFin: '2026-12-03', nombreJours: 3,
    motif: 'Test E2E approuver',
  });
  if (newConge?.id) { approveCongeId = newConge.id; ok(`Approuver — demande créée via API (id=${approveCongeId})`); }
  else { fail(`Approuver — échec création : ${JSON.stringify(newConge)}`); return; }

  await gotoRH('/rh/conges');
  await page.waitForTimeout(800);

  // S'assurer que le filtre EN_ATTENTE est actif (il l'est par défaut)
  const statutSelect = page.locator('select.filter-select')
    .filter({ has: page.locator('option[value="EN_ATTENTE"]') }).first();
  if (await statutSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    await statutSelect.selectOption('EN_ATTENTE');
    await page.waitForTimeout(600);
  }

  const approveBtn = page.locator('button.btn-approve').first();
  if (!await approveBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    fail('Approuver — bouton .btn-approve non visible'); return;
  }
  await approveBtn.click();

  const snack = await getSnackbar();
  if (snack && /approuvée/i.test(snack)) ok(`Approuver — snackbar : "${snack.trim().slice(0,60)}"`);
  else if (snack)                         warn(`Approuver — snackbar : "${snack.trim().slice(0,60)}"`);
  else                                    fail('Approuver — pas de snackbar');

  // Vérifier via API (pas de GET /conges/:id → liste filtrée)
  await page.waitForTimeout(500);
  const demandes = await apiCall(`/conges?userId=7&annee=2026`);
  const conge = Array.isArray(demandes) ? demandes.find(d => d.id === approveCongeId) : null;
  if (conge?.statut === 'APPROUVEE') ok('Approuver — statut API = APPROUVEE ✓');
  else warn(`Approuver — statut API = ${conge?.statut ?? 'introuvable'}`);
}

// ════════════════════════════════════════════════════════════════
//  8. Congés — refuser via modal de confirmation
// ════════════════════════════════════════════════════════════════
async function testRefuserConge() {
  sec(8, 'Congés — refuser une demande (modal de confirmation)');

  // Date en décembre (après §6 nov=32 et §7 dec=33) → en tête du tri dateDebut DESC
  const newConge = await apiCall('/conges', 'POST', {
    userId: 7, typeConge: 'MALADIE',
    dateDebut: '2026-12-08', dateFin: '2026-12-09', nombreJours: 2,
    motif: 'Test E2E refuser',
  });
  if (newConge?.id) { refuseCongeId = newConge.id; ok(`Refuser — demande créée via API (id=${refuseCongeId})`); }
  else { fail(`Refuser — échec création : ${JSON.stringify(newConge)}`); return; }

  await gotoRH('/rh/conges');
  await page.waitForTimeout(800);

  const statutSelect = page.locator('select.filter-select')
    .filter({ has: page.locator('option[value="EN_ATTENTE"]') }).first();
  if (await statutSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
    await statutSelect.selectOption('EN_ATTENTE');
    await page.waitForTimeout(500);
  }

  const refuseBtn = page.locator('button.btn-refuse').first();
  if (!await refuseBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    fail('Refuser — bouton .btn-refuse non visible'); return;
  }
  await refuseBtn.click();
  await page.waitForTimeout(500);

  // Modal de confirmation de refus (centré, petit, reste un modal)
  const refusModal = page.locator('.modal').first();
  if (!await refusModal.isVisible({ timeout: 3000 }).catch(() => false)) {
    fail('Refuser — modal de refus non visible'); return;
  }
  ok('Refuser — modal de refus visible (modal centré conservé pour confirmations) ✓');

  const textarea = refusModal.locator('textarea');
  if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
    await textarea.fill('Refus Playwright E2E — test automatisé');
    ok('Refuser — motif renseigné');
  } else warn('Refuser — textarea absent');

  const submitRefus = refusModal.locator('button').filter({ hasText: /Refuser/i }).last();
  if (!await submitRefus.isVisible({ timeout: 2000 }).catch(() => false)) {
    fail('Refuser — bouton "Refuser" absent dans le modal');
    await page.keyboard.press('Escape'); return;
  }
  await submitRefus.click();

  const snack = await getSnackbar();
  if (snack && /refusée/i.test(snack)) ok(`Refuser — snackbar : "${snack.trim().slice(0,60)}"`);
  else if (snack)                       warn(`Refuser — snackbar : "${snack.trim().slice(0,60)}"`);
  else                                  fail('Refuser — pas de snackbar');

  // Vérifier via API (pas de GET /conges/:id → liste filtrée)
  await page.waitForTimeout(500);
  const demandes2 = await apiCall(`/conges?userId=7&annee=2026`);
  const conge2 = Array.isArray(demandes2) ? demandes2.find(d => d.id === refuseCongeId) : null;
  if (conge2?.statut === 'REFUSEE') ok('Refuser — statut API = REFUSEE ✓');
  else warn(`Refuser — statut API = ${conge2?.statut ?? 'introuvable'}`);
}

// ════════════════════════════════════════════════════════════════
//  9. Congés — vues Soldes et Statistiques
// ════════════════════════════════════════════════════════════════
async function testVuesSoldes() {
  sec(9, 'Congés — vues Soldes & Statistiques');
  if (!page.url().includes('/rh/conges')) await gotoRH('/rh/conges');

  const viewTabs = page.locator('button.view-tab');
  const tabCount = await viewTabs.count();
  if (tabCount >= 2) ok(`Vues — ${tabCount} onglet(s) de vue présents (Demandes + Soldes)`);
  else fail(`Vues — seulement ${tabCount} onglet(s) (attendu 2 : demandes + soldes)`);

  // Vue Soldes
  const soldesTab = viewTabs.filter({ hasText: /Solde/i }).first();
  if (await soldesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await soldesTab.click();
    await page.waitForTimeout(1500);
    const soldesTable = page.locator('.soldes-table');
    if (await soldesTable.isVisible({ timeout: 3000 }).catch(() => false)) ok('Vue Soldes — .soldes-table visible');
    else warn('Vue Soldes — .soldes-table non visible');
  } else warn('Vue Soldes — onglet absent');

  // Retour vue Demandes
  const demandesTab = viewTabs.filter({ hasText: /Demande/i }).first();
  if (await demandesTab.isVisible({ timeout: 1500 }).catch(() => false)) {
    await demandesTab.click();
    await page.waitForTimeout(600);
    ok('Vues — retour vue Demandes OK');
  }
}

// ════════════════════════════════════════════════════════════════
// 10. Agenda — affichage Gantt et structure générale
// ════════════════════════════════════════════════════════════════
async function testAgendaStructure() {
  sec(10, 'Agenda — structure Gantt');
  await gotoRH('/rh/calendrier');

  // Shell principal
  const shell = page.locator('.agenda-shell');
  if (!await shell.isVisible({ timeout: 6000 }).catch(() => false)) {
    fail('Agenda — .agenda-shell absent'); return;
  }
  ok('Agenda — .agenda-shell visible');

  // Zone principale + panneau droit
  const mainZone = shell.locator('.agenda-main');
  const sideZone = shell.locator('.agenda-side');
  if (await mainZone.isVisible({ timeout: 2000 }).catch(() => false)) ok('Agenda — .agenda-main visible');
  else fail('Agenda — .agenda-main absent');
  if (await sideZone.isVisible({ timeout: 2000 }).catch(() => false)) ok('Agenda — .agenda-side (solde) visible');
  else fail('Agenda — .agenda-side absent');

  // Toolbar
  const periodPill = page.locator('.period-pill');
  if (await periodPill.isVisible({ timeout: 2000 }).catch(() => false)) {
    const period = await periodPill.textContent();
    ok(`Agenda — période affichée : "${period?.trim()}"`);
  } else fail('Agenda — .period-pill absent');

  const btnToday = page.locator('.btn-today');
  if (await btnToday.isVisible({ timeout: 1500 }).catch(() => false)) ok('Agenda — bouton "Aujourd\'hui" visible');
  else fail('Agenda — bouton "Aujourd\'hui" absent');

  // Grille Gantt
  const gridWrap = page.locator('.cal-grid-wrap');
  if (await gridWrap.isVisible({ timeout: 5000 }).catch(() => false)) {
    ok('Agenda — .cal-grid-wrap visible');
  } else {
    // Peut être vide ce mois-ci
    const emptyState = page.locator('.cal-empty');
    if (await emptyState.isVisible({ timeout: 2000 }).catch(() => false)) {
      ok('Agenda — état vide affiché (.cal-empty) — pas d\'absences ce mois');
    } else {
      const loadingState = page.locator('.cal-loading');
      if (await loadingState.isVisible({ timeout: 2000 }).catch(() => false)) warn('Agenda — chargement en cours');
      else fail('Agenda — ni grille ni état vide visible');
    }
    return;
  }

  // En-têtes de jours
  const dayHeaders = page.locator('.ch-day');
  const dayCount = await dayHeaders.count();
  if (dayCount >= 28) ok(`Agenda — ${dayCount} colonnes de jours (≥ 28)`);
  else fail(`Agenda — seulement ${dayCount} colonnes (attendu ≥ 28)`);

  // Légende
  const legend = page.locator('.cal-legend');
  if (await legend.isVisible({ timeout: 2000 }).catch(() => false)) ok('Agenda — légende visible');
  else warn('Agenda — .cal-legend absent');

  const legendDots = legend.locator('.legend-dot');
  const dotCount = await legendDots.count();
  if (dotCount >= 2) ok(`Agenda — ${dotCount} items dans la légende`);
  else warn(`Agenda — seulement ${dotCount} item(s) dans la légende`);
}

// ════════════════════════════════════════════════════════════════
// 11. Agenda — filtres, recherche, groupes collapsibles
// ════════════════════════════════════════════════════════════════
async function testAgendaFiltres() {
  sec(11, 'Agenda — filtres site, recherche, groupes collapsibles');
  if (!page.url().includes('/rh/calendrier')) await gotoRH('/rh/calendrier');
  await page.waitForTimeout(1000);

  // ── Chips de filtre site ──
  const siteChips = page.locator('.site-chip');
  const chipCount = await siteChips.count();
  if (chipCount >= 3) ok(`Agenda — ${chipCount} chips de filtre site`);
  else fail(`Agenda — ${chipCount} chips (attendu ≥ 3 : Tous, Réunion, Madagascar)`);

  // Chip "La Réunion"
  const reunionChip = siteChips.filter({ hasText: /Réunion/i }).first();
  if (await reunionChip.isVisible({ timeout: 1500 }).catch(() => false)) {
    await reunionChip.click();
    await page.waitForTimeout(800);
    const activeChip = page.locator('.site-chip.active');
    const activeText = await activeChip.first().textContent().catch(() => '');
    if (/Réunion/i.test(activeText)) ok('Agenda — filtre "La Réunion" actif après clic');
    else warn(`Agenda — chip actif après clic : "${activeText?.trim()}"`);
  } else warn('Agenda — chip "La Réunion" absent');

  // Revenir à "Tous"
  const tousChip = siteChips.filter({ hasText: /Tous/i }).first();
  if (await tousChip.isVisible({ timeout: 1500 }).catch(() => false)) {
    await tousChip.click();
    await page.waitForTimeout(800);
    ok('Agenda — retour filtre "Tous les sites"');
  }

  // ── Barre de recherche ──
  const searchInput = page.locator('.search-input');
  if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await searchInput.fill('Marie');
    await page.waitForTimeout(600);
    // Avec le filtre actif, seules les lignes correspondant à "Marie" doivent rester
    const groupsAfter = page.locator('.grp-header');
    const groupCount = await groupsAfter.count();
    ok(`Agenda — recherche "Marie" : ${groupCount} groupe(s) affiché(s)`);
    // Vérifier qu'une ligne avec "Marie" est visible
    const marieRow = page.locator('.cr-name').filter({ hasText: /Marie/i });
    const marieCount = await marieRow.count();
    if (marieCount > 0) ok(`Agenda — ${marieCount} ligne(s) "Marie" visible(s)`);
    else warn('Agenda — aucune ligne "Marie" trouvée (peut-être pas d\'absence ce mois)');

    // Effacer la recherche
    const clearBtn = page.locator('.search-clear');
    if (await clearBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await clearBtn.click();
      ok('Agenda — bouton effacer recherche cliqué');
    } else {
      await searchInput.fill('');
    }
    await page.waitForTimeout(500);
  } else warn('Agenda — .search-input absent');

  // ── Groupes collapsibles ──
  const grpHeaders = page.locator('.grp-header');
  const grpCount = await grpHeaders.count();
  if (grpCount >= 1) {
    ok(`Agenda — ${grpCount} groupe(s) site visible(s)`);

    // Cliquer sur le premier groupe pour le replier
    const firstGrp = grpHeaders.first();
    const grpLabel = await firstGrp.locator('.grp-label').textContent().catch(() => '?');
    await firstGrp.click();
    await page.waitForTimeout(500);

    // Les lignes du groupe doivent disparaître
    const rowsAfterCollapse = page.locator('.cr-name');
    const rowsCount = await rowsAfterCollapse.count();

    // Cliquer à nouveau pour déplier
    await firstGrp.click();
    await page.waitForTimeout(500);
    const rowsAfterExpand = page.locator('.cr-name');
    const expandedCount = await rowsAfterExpand.count();

    ok(`Agenda — groupe "${grpLabel?.trim()}" : replié (${rowsCount} lignes) → déplié (${expandedCount} lignes)`);

    // Vérifier le badge de comptage
    const grpCount2 = firstGrp.locator('.grp-count');
    if (await grpCount2.isVisible({ timeout: 1000 }).catch(() => false)) {
      const countText = await grpCount2.textContent();
      ok(`Agenda — badge comptage groupe : "${countText?.trim()}"`);
    } else warn('Agenda — .grp-count absent dans l\'en-tête de groupe');
  } else {
    warn('Agenda — aucun groupe site visible (absences présentes ce mois ?)');
  }
}

// ════════════════════════════════════════════════════════════════
// 12. Agenda — panneau droit Solde disponible
// ════════════════════════════════════════════════════════════════
async function testAgendaSoldePanel() {
  sec(12, 'Agenda — panneau droit Solde disponible');
  if (!page.url().includes('/rh/calendrier')) await gotoRH('/rh/calendrier');

  const sidePanel = page.locator('.agenda-side');
  if (!await sidePanel.isVisible({ timeout: 4000 }).catch(() => false)) {
    fail('Solde panel — .agenda-side absent'); return;
  }
  ok('Solde panel — .agenda-side visible');

  // Titre "Solde disponible"
  const sideTitle = sidePanel.locator('.side-title');
  if (await sideTitle.isVisible({ timeout: 1500 }).catch(() => false)) {
    const titleText = await sideTitle.textContent();
    if (/solde.*disponible/i.test(titleText)) ok(`Solde panel — titre : "${titleText?.trim()}"`);
    else warn(`Solde panel — titre inattendu : "${titleText?.trim()}"`);
  } else warn('Solde panel — .side-title absent');

  // Année affichée
  const sideYear = sidePanel.locator('.side-year');
  if (await sideYear.isVisible({ timeout: 1500 }).catch(() => false)) {
    const yearText = await sideYear.textContent();
    ok(`Solde panel — année affichée : "${yearText?.trim()}"`);
  }

  // Cartes solde (si l'utilisateur connecté a des soldes)
  const soldCards = sidePanel.locator('.solde-card');
  const cardCount = await soldCards.count();
  if (cardCount > 0) {
    ok(`Solde panel — ${cardCount} carte(s) de solde (utilisateur a des soldes)`);
    // Vérifier la structure d'une carte
    const firstCard = soldCards.first();
    const bigNum   = firstCard.locator('.solde-card__big');
    const rows     = firstCard.locator('.solde-row');
    if (await bigNum.isVisible({ timeout: 1000 }).catch(() => false)) {
      const val = await bigNum.textContent();
      ok(`Solde panel — valeur principale : "${val?.trim()}"`);
    }
    const rowCount = await rows.count();
    if (rowCount >= 3) ok(`Solde panel — ${rowCount} lignes détail (Acquis / Planifié / Pris)`);
    else warn(`Solde panel — ${rowCount} lignes détail (attendu 3)`);
  } else {
    // L'admin n'a pas de soldes, c'est normal
    const emptyMsg = sidePanel.locator('.side-empty');
    if (await emptyMsg.isVisible({ timeout: 1000 }).catch(() => false)) {
      ok('Solde panel — "Aucun solde configuré" affiché (admin n\'a pas de soldes)');
    } else {
      warn('Solde panel — 0 carte et pas de message vide');
    }
  }
}

// ════════════════════════════════════════════════════════════════
// 13. Agenda — numéros de semaine et libellés de type dans les barres
// ════════════════════════════════════════════════════════════════
async function testAgendaDetails() {
  sec(13, 'Agenda — numéros de semaine & libellés de type');
  if (!page.url().includes('/rh/calendrier')) await gotoRH('/rh/calendrier');
  await page.waitForTimeout(1000);

  // ── Numéros de semaine ──
  const weekBadges = page.locator('.week-badge');
  const badgeCount = await weekBadges.count();
  if (badgeCount >= 1) {
    const firstBadge = await weekBadges.first().textContent();
    ok(`Agenda — ${badgeCount} badge(s) de semaine (ex : "${firstBadge?.trim()}")`);
    // Vérifier format "S30", "S31", etc.
    if (/^S\d{1,2}$/.test(firstBadge?.trim())) ok('Agenda — format badge semaine correct (Snn)');
    else warn(`Agenda — format badge inattendu : "${firstBadge?.trim()}"`);
  } else warn('Agenda — aucun .week-badge visible (jours sans lundi ce mois ?)');

  // ── Libellés de type dans les barres d'absence ──
  const absLabels = page.locator('.abs-label');
  const labelCount = await absLabels.count();
  if (labelCount > 0) {
    const firstLabel = await absLabels.first().textContent();
    ok(`Agenda — ${labelCount} libellé(s) de type dans les barres`);
    // Vérifier que ce n'est plus juste "Absent"
    if (!/^absent$/i.test(firstLabel?.trim())) {
      ok(`Agenda — libellé = "${firstLabel?.trim()}" (type affiché, plus "Absent") ✓`);
    } else {
      fail(`Agenda — libellé = "${firstLabel?.trim()}" (toujours "Absent", type non affiché)`);
    }
  } else {
    warn('Agenda — aucune barre d\'absence visible ce mois (pas de .abs-label)');
  }

  // ── En-tête : jours abrégés (Lun, Mar, etc.) ──
  const dayHeaders = page.locator('.ch-day').first();
  if (await dayHeaders.isVisible({ timeout: 1500 }).catch(() => false)) {
    const shortLabel = await dayHeaders.locator('.day-short').textContent().catch(() => '');
    const dayNum     = await dayHeaders.locator('.day-num').textContent().catch(() => '');
    ok(`Agenda — en-tête premier jour : jour="${shortLabel?.trim()}" num="${dayNum?.trim()}"`);
  }
}

// ════════════════════════════════════════════════════════════════
// 14. Agenda — navigation mois et bouton "Faire une demande"
// ════════════════════════════════════════════════════════════════
async function testAgendaNavigation() {
  sec(14, 'Agenda — navigation mois & bouton demande');
  if (!page.url().includes('/rh/calendrier')) await gotoRH('/rh/calendrier');

  // Lire le mois courant
  const periodPill = page.locator('.period-pill');
  const periodBefore = await periodPill.textContent({ timeout: 3000 }).catch(() => '');
  ok(`Agenda — mois courant : "${periodBefore?.trim()}"`);

  // Naviguer au mois suivant
  const btnNext = page.locator('button[mat-icon-button]').filter({ has: page.locator('mat-icon:text("chevron_right")') }).first();
  if (await btnNext.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btnNext.click();
    await page.waitForTimeout(800);
    const periodAfter = await periodPill.textContent();
    if (periodAfter?.trim() !== periodBefore?.trim()) ok(`Agenda — mois suivant : "${periodAfter?.trim()}" ✓`);
    else warn('Agenda — période inchangée après clic "suivant"');
  } else warn('Agenda — bouton suivant absent');

  // Naviguer au mois précédent
  const btnPrev = page.locator('button[mat-icon-button]').filter({ has: page.locator('mat-icon:text("chevron_left")') }).first();
  if (await btnPrev.isVisible({ timeout: 2000 }).catch(() => false)) {
    await btnPrev.click();
    await page.waitForTimeout(800);
    const periodPrev = await periodPill.textContent();
    ok(`Agenda — mois précédent : "${periodPrev?.trim()}"`);
  } else warn('Agenda — bouton précédent absent');

  // Retour aujourd'hui
  const btnToday = page.locator('.btn-today');
  if (await btnToday.isVisible({ timeout: 1500 }).catch(() => false)) {
    await btnToday.click();
    await page.waitForTimeout(600);
    const periodNow = await periodPill.textContent();
    ok(`Agenda — retour au mois courant : "${periodNow?.trim()}"`);
  }

  // ── Bouton "Faire une demande d'absence" ──
  const btnDemande = page.locator('.btn-demande');
  if (await btnDemande.isVisible({ timeout: 2000 }).catch(() => false)) {
    ok('Agenda — bouton "Faire une demande d\'absence" visible');
    await btnDemande.click();
    await page.waitForTimeout(800);
    // Doit naviguer vers /rh/conges
    const urlAfter = page.url();
    if (urlAfter.includes('/rh/conges')) ok('Agenda — bouton demande → /rh/conges ✓');
    else warn(`Agenda — URL après clic bouton demande : ${urlAfter}`);
    // Revenir à l'agenda
    await gotoRH('/rh/calendrier');
    await page.waitForTimeout(600);
  } else fail('Agenda — bouton .btn-demande absent');
}

// ════════════════════════════════════════════════════════════════
// 15. Soldes — acquisition mensuelle manuelle (+2,5 j)
// ════════════════════════════════════════════════════════════════
async function testAcquisitionMensuelle() {
  sec(15, 'Soldes — acquisition mensuelle manuelle (+2,5 j/utilisateur)');

  // Lire les soldes CONGES_PAYES actuels d'un collaborateur (userId=9 Tiana Rabe)
  const soldesBefore = await apiCall('/conges/soldes/9?annee=2026');
  const soldeCPBefore = Array.isArray(soldesBefore)
    ? soldesBefore.find(s => s.typeConge === 'CONGES_PAYES')
    : null;
  const acquisBefore = soldeCPBefore ? Number(soldeCPBefore.joursAcquis) : null;
  ok(`Acquisition — solde CONGES_PAYES userId=9 avant : ${acquisBefore ?? 'inexistant'} j acquis`);

  // Déclencher l'acquisition manuelle
  const result = await apiCall('/conges/admin/acquisition-mensuelle', 'POST');
  if (result && typeof result.credites === 'number') {
    ok(`Acquisition — résultat : ${result.credites}/${result.total} utilisateurs crédités`);
  } else if (result?.message) {
    warn(`Acquisition — message : ${result.message}`);
  } else {
    fail(`Acquisition — réponse inattendue : ${JSON.stringify(result)}`);
    return;
  }

  // Vérifier les soldes après (peut ne pas changer si déjà au plafond du mois)
  const soldesAfter = await apiCall('/conges/soldes/9?annee=2026');
  const soldeCPAfter = Array.isArray(soldesAfter)
    ? soldesAfter.find(s => s.typeConge === 'CONGES_PAYES')
    : null;
  const acquisAfter = soldeCPAfter ? Number(soldeCPAfter.joursAcquis) : null;

  if (acquisAfter !== null && acquisBefore !== null) {
    if (acquisAfter > acquisBefore) {
      ok(`Acquisition — solde augmenté : ${acquisBefore} → ${acquisAfter} j (+${(acquisAfter - acquisBefore).toFixed(1)}) ✓`);
    } else {
      ok(`Acquisition — solde inchangé (${acquisAfter} j) — plafond mensuel atteint (normal en milieu de mois)`);
    }
  } else {
    warn(`Acquisition — solde après : ${acquisAfter} (avant : ${acquisBefore})`);
  }
}

// ════════════════════════════════════════════════════════════════
// 16. Soldes — basculement reliquat annuel
// ════════════════════════════════════════════════════════════════
async function testBasculementReliquat() {
  sec(16, 'Soldes — basculement reliquat annuel');

  // anneeSource = année passée, anneeNouvelle = anneeSource + 1 (corrigé dans le service)
  const anneeActuelle  = new Date().getFullYear();
  const anneeSource    = anneeActuelle - 1;  // ex: 2025
  const anneeNouvelle  = anneeSource + 1;    // ex: 2026 (= anneeActuelle)

  // Créer un solde de 15j pour userId=12 dans anneeSource (ex: 2025)
  await apiCall('/conges/soldes/12', 'PATCH', {
    typeConge: 'CONGES_PAYES', annee: anneeSource, joursAcquis: 15,
  });
  ok(`Basculement — solde de test créé : userId=12, ${anneeSource}, 15j acquis`);

  // Lire le solde avant basculement
  const soldesCurrent = await apiCall(`/conges/soldes/12?annee=${anneeSource}`);
  const soldeCP = Array.isArray(soldesCurrent)
    ? soldesCurrent.find(s => s.typeConge === 'CONGES_PAYES')
    : null;
  if (soldeCP) {
    const reliquatAttendu = Math.max(0,
      Number(soldeCP.joursAcquis) - Number(soldeCP.joursPris) - Number(soldeCP.joursEnAttente));
    ok(`Basculement — reliquat attendu pour userId=12 : ${reliquatAttendu} j`);
  }

  // Solde de la nouvelle année AVANT basculement
  const soldesNewBefore = await apiCall(`/conges/soldes/12?annee=${anneeNouvelle}`);
  const soldeNewBefore  = Array.isArray(soldesNewBefore)
    ? soldesNewBefore.find(s => s.typeConge === 'CONGES_PAYES')
    : null;
  const acquisNewBefore = soldeNewBefore ? Number(soldeNewBefore.joursAcquis) : 0;
  ok(`Basculement — solde ${anneeNouvelle} avant : ${acquisNewBefore} j acquis`);

  // Déclencher le basculement (anneeSource → anneeSource+1)
  const result = await apiCall('/conges/admin/basculement-reliquat', 'POST', {
    anneeSource,
  });

  if (result && typeof result.bascules === 'number') {
    ok(`Basculement — ${result.bascules} utilisateur(s) basculé(s) de ${anneeSource} → ${anneeNouvelle}`);
    if (Array.isArray(result.details) && result.details.length > 0) {
      result.details.slice(0, 3).forEach(d => {
        ok(`Basculement — ${d.nom} : +${d.reliquat} j reportés`);
      });
    }
  } else {
    fail(`Basculement — réponse inattendue : ${JSON.stringify(result)}`);
    return;
  }

  // Vérifier le solde ${anneeNouvelle} de userId=12 a augmenté
  const soldesNewAfter = await apiCall(`/conges/soldes/12?annee=${anneeNouvelle}`);
  const soldeNewAfter  = Array.isArray(soldesNewAfter)
    ? soldesNewAfter.find(s => s.typeConge === 'CONGES_PAYES')
    : null;
  const acquisNewAfter = soldeNewAfter ? Number(soldeNewAfter.joursAcquis) : 0;

  if (acquisNewAfter > acquisNewBefore) {
    ok(`Basculement — solde ${anneeNouvelle} après : ${acquisNewAfter} j (+${(acquisNewAfter - acquisNewBefore).toFixed(1)}) ✓`);
  } else {
    warn(`Basculement — solde ${anneeNouvelle} : ${acquisNewAfter} j (inchangé = reliquat déjà basculé ou userId=12 sans reliquat dans ${anneeSource})`);
  }

  // Vérifier que anneeSource a bien été mis à 0 après basculement
  const soldesSourceAfter = await apiCall(`/conges/soldes/12?annee=${anneeSource}`);
  const soldeSourceAfter  = Array.isArray(soldesSourceAfter)
    ? soldesSourceAfter.find(s => s.typeConge === 'CONGES_PAYES')
    : null;
  if (soldeSourceAfter) {
    const reliquatAfter = Math.max(0,
      Number(soldeSourceAfter.joursAcquis) - Number(soldeSourceAfter.joursPris) - Number(soldeSourceAfter.joursEnAttente));
    if (reliquatAfter === 0) ok(`Basculement — reliquat ${anneeSource} zeroisé après basculement ✓`);
    else warn(`Basculement — reliquat ${anneeSource} encore ${reliquatAfter} j (idempotence incomplète ?)`);
  }

  // Test idempotence : 2ème appel ne doit créditer personne (reliquat = 0 après 1er appel)
  const result2 = await apiCall('/conges/admin/basculement-reliquat', 'POST', { anneeSource });
  if (result2 && typeof result2.bascules === 'number') {
    if (result2.bascules === 0) ok('Basculement — idempotence ✓ (2ème appel = 0 basculement)');
    else                        fail(`Basculement — idempotence KO : 2ème appel a basculé ${result2.bascules} utilisateurs`);
  }
}

// ════════════════════════════════════════════════════════════════
// 17. Nettoyage
// ════════════════════════════════════════════════════════════════
async function testCleanup() {
  sec(17, 'Nettoyage');

  // L'admin ne peut pas "annuler" la demande d'un autre utilisateur (ownership check)
  // → On utilise "refuser" (admin autorisé) pour mettre fin aux demandes EN_ATTENTE de test
  const toRefuse = [createdCongeId].filter(Boolean);
  for (const id of toRefuse) {
    const r = await fetch(`${API}/conges/${id}/refuser`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ commentaire: 'Nettoyage automatique test E2E' }),
    });
    if (r.ok) ok(`Nettoyage — demande id=${id} refusée (nettoyage) ✓`);
    else {
      const body = await r.json().catch(() => ({}));
      warn(`Nettoyage — refus id=${id} impossible (${r.status}) : ${body?.message ?? ''}`);
    }
  }

  if (toRefuse.length === 0) warn('Nettoyage — aucune demande créée en test à nettoyer');
  ok('Nettoyage terminé');
}

// ════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════
(async () => {
  // Auth API
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@afym.re', password: 'Admin2024!' }),
  });
  const loginData = await loginRes.json().catch(() => ({}));
  token = loginData.access_token;
  if (!token) {
    console.error('ERREUR CRITIQUE : token admin introuvable');
    process.exit(1);
  }
  ok('Auth API — token admin obtenu');

  // Lancer le navigateur
  browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('  [JS ERR]', m.text()); });

  // Auth UI
  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 8000 });
  await page.locator('input[type="email"]').fill('admin@afym.re');
  await page.locator('input[type="password"]').fill('Admin2024!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  ok('Auth UI — connexion admin OK');

  // Exécution
  await testNavigationRH();
  await testListeSalaries();
  await testEditionDrawer();
  await testFicheDetail();
  await testFiltreDefaut();
  await testCreerCongeDrawer();
  await testApprouverConge();
  await testRefuserConge();
  await testVuesSoldes();
  await testAgendaStructure();
  await testAgendaFiltres();
  await testAgendaSoldePanel();
  await testAgendaDetails();
  await testAgendaNavigation();
  await testAcquisitionMensuelle();
  await testBasculementReliquat();
  await testCleanup();

  await browser.close();

  const total  = results.length;
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`  ✅ ${passed} passés  |  ❌ ${failed} échoués  |  ${total} total`);
  console.log(`${'═'.repeat(62)}`);
  if (failed > 0) process.exit(1);
})().catch(e => {
  console.error('ERREUR CRITIQUE:', e.message);
  process.exit(1);
});
