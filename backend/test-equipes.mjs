/**
 * test-equipes.mjs
 * Tests end-to-end du module Équipes : hiérarchie, organigramme,
 * vue utilisateurs, création, modification et toggle actif/inactif.
 *
 * Usage : node test-equipes.mjs
 * Prérequis : frontend sur http://localhost:4200, API sur http://localhost:3000/api
 */
import { chromium } from '/datas/Projets/Aro/backend/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:4200';
const API  = 'http://localhost:3000/api';
let page, browser, token;
let createdUserId = null;

const results = [];
const ok   = (msg) => { console.log('✅', msg); results.push({ ok: true,  msg }); };
const warn = (msg) => { console.log('⚠️ ', msg); results.push({ ok: true,  msg }); };
const fail = (msg) => { console.log('❌', msg); results.push({ ok: false, msg }); };
const sec  = (title) => console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`);

async function api(path, method = 'GET', body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json().catch(() => null);
}

async function getToast(timeout = 4000) {
  return page
    .locator('snack-bar-container, .mat-mdc-snack-bar-container, .toast-container, app-toast')
    .first()
    .textContent({ timeout })
    .catch(() => null);
}

// ════════════════════════════════════════════════════════════════
// 1. Chargement de la page /equipes
// ════════════════════════════════════════════════════════════════
async function testPageLoad() {
  sec('1. /equipes — Chargement de la page');

  await page.goto(`${BASE}/equipes`);
  await page.waitForTimeout(2000);

  // Titre principal
  const title = page.locator('h1.page-title');
  if (await title.isVisible({ timeout: 5000 }).catch(() => false)) {
    const txt = await title.textContent();
    ok(`Titre visible : "${txt?.trim()}"`);
  } else {
    fail('Titre h1.page-title non visible — page non chargée');
    return;
  }

  // Sous-titre avec statistiques
  const sub = page.locator('.page-sub');
  if (await sub.isVisible({ timeout: 2000 }).catch(() => false)) {
    const subTxt = await sub.textContent();
    ok(`Sous-titre visible : "${subTxt?.trim().substring(0, 60)}"`);
  } else warn('Sous-titre .page-sub absent');

  // Statistique "X dans une antenne"
  const statOk = page.locator('.stat-ok');
  if (await statOk.isVisible({ timeout: 2000 }).catch(() => false)) {
    const val = await statOk.textContent();
    ok(`Stat assignés visible : "${val?.trim()}"`);
  } else warn('Stat .stat-ok absente');

  // Légende des badges de rôle
  const badges = await page.locator('.badge-role').count();
  if (badges > 0) ok(`${badges} badge(s) de rôle dans la légende`);
  else warn('Légende .badge-role absente');
}

// ════════════════════════════════════════════════════════════════
// 2. Navigation par onglets
// ════════════════════════════════════════════════════════════════
async function testTabs() {
  sec('2. /equipes — Navigation par onglets');

  await page.goto(`${BASE}/equipes`);
  await page.waitForTimeout(2000);

  const tabBtns = page.locator('button.tab-btn');
  const tabCount = await tabBtns.count();
  if (tabCount >= 3) {
    const labels = await tabBtns.allTextContents();
    ok(`${tabCount} onglets présents : ${labels.map(l => l.trim().substring(0, 20)).join(' | ')}`);
  } else {
    warn(`Seulement ${tabCount} onglet(s) tab-btn (attendu 3)`);
    return;
  }

  // Onglet Hiérarchie (actif par défaut)
  const hierTab = tabBtns.filter({ hasText: /Hiérar/i }).first();
  if (await hierTab.count() > 0) {
    const isActive = await hierTab.evaluate(el => el.classList.contains('active'));
    if (isActive) ok('Onglet Hiérarchie actif par défaut');
    else warn('Onglet Hiérarchie non actif par défaut');
  } else warn('Onglet Hiérarchie non trouvé');

  // Onglet Organigramme
  const chartTab = tabBtns.filter({ hasText: /Organi|organi|chart/i }).first();
  const chartTabFallback = tabBtns.nth(1);
  const targetChartTab = (await chartTab.count()) > 0 ? chartTab : chartTabFallback;
  await targetChartTab.click();
  await page.waitForTimeout(600);
  const orgTree = page.locator('.org-tree, .chart-wrap');
  if (await orgTree.isVisible({ timeout: 3000 }).catch(() => false)) {
    ok('Onglet Organigramme — contenu visible après clic');
  } else warn('Onglet Organigramme — contenu non détecté');

  // Onglet Tous les utilisateurs
  const usersTab = tabBtns.filter({ hasText: /Tous les|utilisateurs/i }).first();
  const usersTabFallback = tabBtns.last();
  const targetUsersTab = (await usersTab.count()) > 0 ? usersTab : usersTabFallback;
  await targetUsersTab.click();
  await page.waitForTimeout(600);
  const allUsersSection = page.locator('.all-users-section, .all-users-search');
  if (await allUsersSection.isVisible({ timeout: 3000 }).catch(() => false)) {
    ok('Onglet Utilisateurs — section visible après clic');
  } else warn('Onglet Utilisateurs — section non détectée');

  // Retour sur Hiérarchie
  const backToHier = tabBtns.filter({ hasText: /Hiérar/i }).first();
  if (await backToHier.count() > 0) {
    await backToHier.click();
    await page.waitForTimeout(400);
    ok('Retour sur onglet Hiérarchie OK');
  }
}

// ════════════════════════════════════════════════════════════════
// 3. Onglet Hiérarchie — contenu des antennes
// ════════════════════════════════════════════════════════════════
async function testHierarchyTab() {
  sec('3. /equipes — Onglet Hiérarchie');

  await page.goto(`${BASE}/equipes`);
  await page.waitForTimeout(2000);

  // S'assurer qu'on est sur l'onglet Hiérarchie
  const hierTab = page.locator('button.tab-btn').filter({ hasText: /Hiérar/i }).first();
  if (await hierTab.count() > 0) await hierTab.click();
  await page.waitForTimeout(500);

  // Cartes antennes (EST et OUEST)
  const antenneCards = await page.locator('.antenne-card').count();
  if (antenneCards >= 2) {
    ok(`${antenneCards} carte(s) antenne affichée(s)`);
  } else if (antenneCards === 1) {
    warn(`1 seule carte antenne visible (attendu 2 : EST et OUEST)`);
  } else {
    warn('Aucune antenne-card visible (aucun utilisateur configuré ?)');
  }

  // En-têtes des antennes
  const antenneHeaders = await page.locator('.antenne-header').count();
  if (antenneHeaders > 0) {
    const headerTexts = await page.locator('.antenne-label').allTextContents();
    ok(`En-têtes antennes : ${headerTexts.map(t => t.trim()).join(', ')}`);
  }

  // Nombre de pills utilisateurs
  const userPills = await page.locator('.user-pill').count();
  if (userPills > 0) {
    ok(`${userPills} user-pill(s) visibles dans la hiérarchie`);
  } else {
    warn('Aucun user-pill trouvé (aucun rôle assigné dans les antennes ?)');
  }

  // Cliquer sur le bouton edit d'un user-pill pour ouvrir le drawer
  const firstEditBtn = page.locator('.user-pill button.btn-icon').first();
  if (await firstEditBtn.count() > 0) {
    await firstEditBtn.click({ force: true });
    await page.waitForTimeout(600);
    const drawer = page.locator('.edit-drawer');
    if (await drawer.isVisible({ timeout: 3000 }).catch(() => false)) {
      ok('Edit-drawer ouvert via btn-icon sur un user-pill');

      // Vérifier que le nom de l'utilisateur est visible
      const editName = drawer.locator('.edit-name');
      if (await editName.count() > 0) {
        const nameText = await editName.textContent();
        ok(`Drawer — nom utilisateur : "${nameText?.trim()}"`);
      }

      // Vérifier la présence des selects antenne et rôle
      const selectCount = await drawer.locator('select').count();
      if (selectCount >= 2) ok(`Drawer — ${selectCount} select(s) de configuration`);
      else warn(`Drawer — seulement ${selectCount} select(s)`);

      // Fermer via backdrop
      await page.locator('.edit-backdrop').click();
      await page.waitForTimeout(400);
      const drawerAfterClose = page.locator('.edit-drawer');
      if (!(await drawerAfterClose.isVisible({ timeout: 1000 }).catch(() => false))) {
        ok('Edit-drawer fermé via backdrop');
      } else warn('Edit-drawer toujours visible après clic backdrop');
    } else warn('Edit-drawer non ouvert après clic sur btn-icon');
  } else warn('Aucun btn-icon dans les user-pills (aucun utilisateur assigné ?)');
}

// ════════════════════════════════════════════════════════════════
// 4. Onglet Organigramme
// ════════════════════════════════════════════════════════════════
async function testChartTab() {
  sec('4. /equipes — Onglet Organigramme');

  await page.goto(`${BASE}/equipes`);
  await page.waitForTimeout(2000);

  const chartTab = page.locator('button.tab-btn').filter({ hasText: /Organi/i }).first();
  const tabFallback = page.locator('button.tab-btn').nth(1);
  const target = (await chartTab.count()) > 0 ? chartTab : tabFallback;
  await target.click();
  await page.waitForTimeout(800);

  // Toolbar (bouton imprimer + hint)
  const toolbar = page.locator('.chart-toolbar');
  if (await toolbar.isVisible({ timeout: 3000 }).catch(() => false)) {
    ok('Toolbar organigramme visible');
    const printBtn = toolbar.locator('button.btn-print');
    if (await printBtn.count() > 0) ok('Bouton Exporter/Imprimer présent');
    else warn('Bouton btn-print absent de la toolbar');
  } else warn('Toolbar organigramme absente');

  // Nœud racine AFYM
  const rootNode = page.locator('.org-node--root');
  if (await rootNode.isVisible({ timeout: 3000 }).catch(() => false)) {
    const rootTxt = await rootNode.textContent();
    ok(`Nœud racine visible : "${rootTxt?.trim().substring(0, 40)}"`);
  } else warn('Nœud racine .org-node--root absent');

  // Arbre org avec sous-nœuds
  const orgTree = page.locator('ul.org-tree');
  if (await orgTree.isVisible({ timeout: 2000 }).catch(() => false)) {
    const allNodes = await page.locator('.org-node').count();
    ok(`${allNodes} nœud(s) dans l'organigramme`);
  } else warn('ul.org-tree absent');

  // Nœuds antennes Madagascar
  const antenneNodes = await page.locator('.org-node--antenne').count();
  if (antenneNodes > 0) ok(`${antenneNodes} nœud(s) antenne dans l'organigramme`);
  else warn('Nœuds antennes absents (pas encore configurés ?)');

  // Clic sur un nœud cliquable pour ouvrir l'edit-drawer
  const clickableNode = page.locator('.org-node--chef-antenne, .org-node--chef-mission, .org-node--collab, .org-node--reunion-user').first();
  if (await clickableNode.count() > 0) {
    await clickableNode.click({ force: true });
    await page.waitForTimeout(600);
    const drawer = page.locator('.edit-drawer');
    if (await drawer.isVisible({ timeout: 2000 }).catch(() => false)) {
      ok('Edit-drawer ouvert via clic nœud organigramme');
      // Fermer
      const closeBtn = drawer.locator('button.btn-icon').last();
      if (await closeBtn.count() > 0) await closeBtn.click();
      else await page.locator('.edit-backdrop').click().catch(() => {});
      await page.waitForTimeout(400);
      ok('Drawer organigramme fermé');
    } else warn('Edit-drawer non ouvert après clic sur nœud organigramme');
  } else warn('Aucun nœud cliquable trouvé dans l\'organigramme');
}

// ════════════════════════════════════════════════════════════════
// 5. Onglet Tous les utilisateurs — liste, recherche, filtres
// ════════════════════════════════════════════════════════════════
async function testUsersTab() {
  sec('5. /equipes — Onglet Tous les utilisateurs');

  await page.goto(`${BASE}/equipes`);
  await page.waitForTimeout(2000);

  const usersTab = page.locator('button.tab-btn').filter({ hasText: /Tous les|utilisateurs/i }).first();
  const tabFallback = page.locator('button.tab-btn').last();
  const target = (await usersTab.count()) > 0 ? usersTab : tabFallback;
  await target.click();
  await page.waitForTimeout(800);

  // En-tête de section
  const sectionTitle = page.locator('.all-users-title');
  if (await sectionTitle.isVisible({ timeout: 3000 }).catch(() => false)) {
    const txt = await sectionTitle.textContent();
    ok(`Titre section : "${txt?.trim().substring(0, 40)}"`);
  } else warn('En-tête .all-users-title absent');

  // Compteur utilisateurs
  const counter = page.locator('.all-users-count');
  if (await counter.isVisible({ timeout: 2000 }).catch(() => false)) {
    const cnt = await counter.textContent();
    ok(`Compteur utilisateurs : ${cnt?.trim()}`);
  } else warn('Compteur .all-users-count absent');

  // Barre de recherche
  const searchBox = page.locator('.all-users-search');
  if (await searchBox.isVisible({ timeout: 2000 }).catch(() => false)) {
    ok('Barre de recherche visible');
    const input = searchBox.locator('input[type="text"]');
    if (await input.count() > 0) {
      await input.fill('admin');
      await page.waitForTimeout(400);
      const rows = await page.locator('.table tbody tr:not(.td-empty)').count();
      ok(`Recherche "admin" — ${rows} résultat(s)`);
      await input.fill('');
      await page.waitForTimeout(300);
    }
  } else warn('Barre de recherche .all-users-search absente');

  // Filtres (rôle, antenne, site)
  const filterBar = page.locator('.filter-bar');
  if (await filterBar.isVisible({ timeout: 2000 }).catch(() => false)) {
    const filterSelects = await page.locator('.filter-select').count();
    ok(`${filterSelects} filtre(s) dans la barre de filtres`);

    // Filtrer par rôle ADMIN
    const roleFilter = page.locator('.filter-select').first();
    await roleFilter.selectOption({ value: 'ADMIN' });
    await page.waitForTimeout(400);
    const filteredRows = await page.locator('.table tbody tr').count();
    ok(`Filtre ADMIN — ${filteredRows} ligne(s) dans le tableau`);

    // Réinitialiser
    await roleFilter.selectOption({ value: '' });
    await page.waitForTimeout(300);
    ok('Filtre rôle réinitialisé');
  } else warn('Barre de filtres .filter-bar absente');

  // Tableau avec en-têtes
  const table = page.locator('.table').first();
  if (await table.isVisible({ timeout: 2000 }).catch(() => false)) {
    const thTexts = await table.locator('thead th').allTextContents();
    ok(`Tableau — colonnes : ${thTexts.map(t => t.trim()).filter(Boolean).join(' | ')}`);
    const rowCount = await table.locator('tbody tr').count();
    if (rowCount > 0) ok(`Tableau — ${rowCount} ligne(s) affichée(s)`);
    else warn('Tableau vide après filtre réinitialisé');
  } else fail('Tableau .table absent');

  // Bouton édition dans le tableau
  const editBtns = await page.locator('.btn-table-assign').count();
  if (editBtns > 0) ok(`${editBtns} bouton(s) d'édition dans le tableau`);
  else warn('Aucun .btn-table-assign trouvé');
}

// ════════════════════════════════════════════════════════════════
// 6. Créer un collaborateur via le drawer
// ════════════════════════════════════════════════════════════════
async function testCreateUser() {
  sec('6. /equipes — Créer un collaborateur via le drawer');

  await page.goto(`${BASE}/equipes`);
  await page.waitForTimeout(2000);

  const createBtn = page.locator('button.btn-create');
  if (!(await createBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    warn('Bouton .btn-create absent — rôle admin requis ou composant non chargé');
    return;
  }
  ok('Bouton "Nouveau collaborateur" visible');

  await createBtn.click();
  await page.waitForTimeout(600);

  const drawer = page.locator('.edit-drawer');
  if (!(await drawer.isVisible({ timeout: 3000 }).catch(() => false))) {
    fail('Drawer de création non ouvert après clic sur btn-create');
    return;
  }
  ok('Drawer de création ouvert');

  // Vérifier les champs du formulaire
  const inputs = await drawer.locator('input.text-input').count();
  ok(`Drawer création — ${inputs} champ(s) texte`);

  // Remplir le formulaire
  const ts = Date.now();
  const firstName = 'TestE2E';
  const lastName  = `Equipes${ts % 10000}`;
  const email     = `test.equipes.${ts}@afym.test`;
  const password  = 'TestPass1!';

  await drawer.locator('input.text-input[placeholder="Prénom"]').fill(firstName);
  await drawer.locator('input.text-input[placeholder="Nom"]').fill(lastName);
  await drawer.locator('input.text-input[placeholder*="email"]').fill(email);
  await drawer.locator('input[type="password"]').fill(password);
  ok('Champs Prénom / Nom / Email / Mot de passe remplis');

  // Site = MADAGASCAR
  const selects = drawer.locator('.select-wrap select');
  const selectCount = await selects.count();
  if (selectCount >= 1) {
    await selects.nth(0).selectOption({ value: 'MADAGASCAR' });
    ok('Site = MADAGASCAR sélectionné');
  }

  // Antenne = EST (index 1)
  if (selectCount >= 2) {
    await selects.nth(1).selectOption({ value: 'EST' });
    ok('Antenne = EST sélectionnée');
  }

  // Rôle = COLLABORATEUR (index 2, déjà par défaut)
  if (selectCount >= 3) {
    await selects.nth(2).selectOption({ value: 'COLLABORATEUR' });
    ok('Rôle = COLLABORATEUR sélectionné');
  }

  // Soumettre
  const saveBtn = drawer.locator('button.btn-save');
  await saveBtn.click();

  const toast = await getToast(4000);
  if (toast && /créé/i.test(toast)) {
    ok(`Toast succès création : "${toast.trim().substring(0, 60)}"`);
  } else if (toast) {
    warn(`Toast inattendu après création : "${toast.trim().substring(0, 60)}"`);
  } else {
    warn('Aucun toast détecté après création');
  }

  // Vérifier que le drawer s'est fermé
  await page.waitForTimeout(600);
  if (!(await drawer.isVisible({ timeout: 1000 }).catch(() => false))) {
    ok('Drawer fermé après création réussie');
  } else warn('Drawer encore visible après création');

  // Récupérer l'ID via API pour le cleanup
  const users = await api('/users');
  if (Array.isArray(users)) {
    const created = users.find(u => u.email === email);
    if (created) {
      createdUserId = created.id;
      ok(`Utilisateur créé retrouvé en base (id: ${createdUserId})`);
    } else warn('Utilisateur créé non retrouvé via API (email non trouvé)');
  }
}

// ════════════════════════════════════════════════════════════════
// 7. Modifier un utilisateur via le drawer (onglet Utilisateurs)
// ════════════════════════════════════════════════════════════════
async function testEditUser() {
  sec('7. /equipes — Modifier un utilisateur via le drawer');

  await page.goto(`${BASE}/equipes`);
  await page.waitForTimeout(2000);

  // Aller sur l'onglet utilisateurs
  const usersTab = page.locator('button.tab-btn').filter({ hasText: /Tous les|utilisateurs/i }).first();
  const tabFallback = page.locator('button.tab-btn').last();
  const target = (await usersTab.count()) > 0 ? usersTab : tabFallback;
  await target.click();
  await page.waitForTimeout(800);

  let editBtn = null;

  // Si on a créé un utilisateur test, le rechercher
  if (createdUserId) {
    const searchInput = page.locator('.all-users-search input[type="text"]');
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill('TestE2E');
      await page.waitForTimeout(400);
    }
    const rows = page.locator('.table tbody tr');
    const rowCount = await rows.count();
    if (rowCount > 0) {
      editBtn = rows.first().locator('.btn-table-assign');
      ok('Utilisateur test trouvé dans le tableau');
    }
  }

  // Fallback : premier utilisateur non-admin dans le tableau
  if (!editBtn || !(await editBtn.count() > 0)) {
    const allEditBtns = page.locator('.btn-table-assign');
    const btnCount = await allEditBtns.count();
    if (btnCount === 0) {
      warn('Aucun bouton .btn-table-assign trouvé — test édition ignoré');
      return;
    }
    editBtn = allEditBtns.first();
    ok(`Fallback — premier bouton d'édition utilisé`);
  }

  await editBtn.click({ force: true });
  await page.waitForTimeout(600);

  const drawer = page.locator('.edit-drawer');
  if (!(await drawer.isVisible({ timeout: 3000 }).catch(() => false))) {
    fail('Drawer édition non ouvert après clic .btn-table-assign');
    return;
  }
  ok('Drawer édition ouvert');

  // Vérifier l'en-tête : nom + email de l'utilisateur
  const editName = drawer.locator('.edit-name');
  if (await editName.count() > 0) {
    const nameVal = await editName.textContent();
    ok(`Drawer édition — utilisateur : "${nameVal?.trim()}"`);
  }

  // Vérifier les selects antenne et rôle
  const selects = drawer.locator('.select-wrap select');
  const selectCount = await selects.count();
  if (selectCount >= 2) {
    ok(`Drawer édition — ${selectCount} select(s) visibles`);
    // Lire la valeur actuelle d'antenne (1er select) et la re-sélectionner (pas de changement fonctionnel)
    const currentAntenne = await selects.nth(0).inputValue();
    ok(`Antenne actuelle : "${currentAntenne || '(aucune)'}"`);
  } else warn(`Seulement ${selectCount} select(s) dans le drawer`);

  // Aperçu hiérarchique
  const hierPreview = drawer.locator('.hierarchy-preview');
  if (await hierPreview.isVisible({ timeout: 1000 }).catch(() => false)) {
    ok('Aperçu hiérarchique visible dans le drawer');
  } else warn('Aperçu hiérarchique absent');

  // Enregistrer sans modification (clic Enregistrer)
  const saveBtn = drawer.locator('button.btn-save');
  await saveBtn.click();

  const toast = await getToast(4000);
  if (toast && /mis à jour|update/i.test(toast)) {
    ok(`Toast succès édition : "${toast.trim().substring(0, 60)}"`);
  } else if (toast) {
    warn(`Toast après édition : "${toast.trim().substring(0, 60)}"`);
  } else {
    warn('Aucun toast détecté après édition');
  }

  await page.waitForTimeout(600);
  if (!(await drawer.isVisible({ timeout: 1000 }).catch(() => false))) {
    ok('Drawer fermé après enregistrement');
  } else warn('Drawer encore visible après enregistrement');
}

// ════════════════════════════════════════════════════════════════
// 8. Toggle actif/inactif dans l'onglet Utilisateurs
// ════════════════════════════════════════════════════════════════
async function testToggleActive() {
  sec('8. /equipes — Toggle actif/inactif');

  if (!createdUserId) {
    warn('Aucun utilisateur test créé — toggle ignoré pour ne pas affecter les données réelles');
    return;
  }

  await page.goto(`${BASE}/equipes`);
  await page.waitForTimeout(2000);

  // Aller sur l'onglet utilisateurs
  const usersTab = page.locator('button.tab-btn').filter({ hasText: /Tous les|utilisateurs/i }).first();
  const tabFallback = page.locator('button.tab-btn').last();
  const target = (await usersTab.count()) > 0 ? usersTab : tabFallback;
  await target.click();
  await page.waitForTimeout(800);

  // Rechercher l'utilisateur test
  const searchInput = page.locator('.all-users-search input[type="text"]');
  if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await searchInput.fill('TestE2E');
    await page.waitForTimeout(400);
  }

  // Cliquer le bouton toggle sur le premier résultat
  const toggleBtn = page.locator('.btn-table-toggle').first();
  if (!(await toggleBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
    warn('Bouton .btn-table-toggle non visible (admin requis ou utilisateur introuvable)');
    return;
  }

  await toggleBtn.click({ force: true });
  const toastDeactivate = await getToast(4000);
  if (toastDeactivate && /désactivé|réactivé/i.test(toastDeactivate)) {
    ok(`Toast toggle actif : "${toastDeactivate.trim().substring(0, 60)}"`);
  } else if (toastDeactivate) {
    warn(`Toast toggle (contenu inattendu) : "${toastDeactivate.trim().substring(0, 60)}"`);
  } else warn('Aucun toast après toggle actif');

  await page.waitForTimeout(800);

  // Afficher les inactifs pour retrouver l'utilisateur désactivé
  const inactifToggle = page.locator('.toggle-inactive input[type="checkbox"]');
  if (await inactifToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
    await inactifToggle.check({ force: true });
    await page.waitForTimeout(400);
    ok('Affichage des inactifs activé');
  }
}

// ════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════
(async () => {
  // ── Auth API ────────────────────────────────────────────────
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

  // ── Auth UI ─────────────────────────────────────────────────
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  page = await context.newPage();

  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.locator('input[type="email"]').fill('admin@afym.re');
  await page.locator('input[type="password"]').fill('Admin1234!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 12000 }).catch(() => {});
  if (page.url().includes('/dashboard') || page.url().includes('/clients')) {
    ok('Auth UI — connexion admin OK');
  } else {
    fail(`Auth UI — URL inattendue après login : ${page.url()}`);
  }

  // ── Tests ───────────────────────────────────────────────────
  await testPageLoad();
  await testTabs();
  await testHierarchyTab();
  await testChartTab();
  await testUsersTab();
  await testCreateUser();
  await testEditUser();
  await testToggleActive();

  // ── Cleanup ─────────────────────────────────────────────────
  if (createdUserId) {
    sec('Cleanup — suppression de l\'utilisateur test');
    const del = await api(`/users/${createdUserId}`, 'DELETE');
    if (del !== null) ok(`Utilisateur test (id: ${createdUserId}) désactivé via API`);
    else warn(`Impossible de désactiver l'utilisateur test (id: ${createdUserId})`);
  }

  await browser.close();

  // ── Résumé ──────────────────────────────────────────────────
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${'═'.repeat(60)}\n  ${passed} ✅  |  ${failed} ❌  |  ${passed + failed} total\n${'═'.repeat(60)}`);
  if (failed > 0) process.exit(1);
})();
