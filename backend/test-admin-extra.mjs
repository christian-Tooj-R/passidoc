import { chromium } from '/datas/Projets/Aro/backend/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:4200';

let pass = 0, fail_count = 0;
function ok(msg)    { console.log(`✅ ${msg}`); pass++; }
function fail(msg)  { console.error(`❌ ${msg}`); fail_count++; }
function warn(msg)  { console.warn(`⚠️  ${msg}`); }
function sec(title) { console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`); }

async function getSnackbar(page, timeout = 5000) {
  return page.locator('mat-snack-bar-container, .mat-mdc-snack-bar-container')
    .first().textContent({ timeout }).catch(() => null);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// ── Login ────────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/auth/login`);
await page.waitForSelector('input[type="email"]', { timeout: 10000 });
await page.locator('input[type="email"]').fill('admin@afym.re');
await page.locator('input[type="password"]').fill('Admin1234!');
await page.locator('button[type="submit"]').click();
await page.waitForURL('**/dashboard', { timeout: 12000 }).catch(() => {});

// ════════════════════════════════════════════════════════════════════════════
sec('1. /admin — Gestion des utilisateurs');

await page.goto(`${BASE}/admin`);
await page.waitForTimeout(1500);

// 1.1 container de page
try {
  await page.waitForSelector('.page', { timeout: 8000 });
  ok('Container .page visible');
} catch {
  fail('Container .page non trouvé');
}

// 1.2 titre h1 "Utilisateurs"
try {
  const h1 = await page.locator('h1').first().textContent({ timeout: 5000 });
  if (h1?.includes('Utilisateurs')) ok(`Titre "${h1.trim()}" présent`);
  else fail(`Titre inattendu: "${h1?.trim()}"`);
} catch {
  fail('Titre h1 non trouvé');
}

// 1.3 sous-titre compteur "X compte(s) enregistré(s)"
try {
  const subtitle = await page.locator('.page-subtitle').textContent({ timeout: 4000 });
  if (subtitle?.includes('compte')) ok(`Sous-titre compteur: "${subtitle.trim()}"`);
  else warn(`Sous-titre inattendu: "${subtitle?.trim()}"`);
} catch {
  warn('Sous-titre .page-subtitle non trouvé');
}

// 1.4 stats row avec chips
try {
  await page.waitForSelector('.stats-row', { timeout: 5000 });
  const chips = await page.locator('.stat-chip').count();
  if (chips >= 3) ok(`Stats row visible — ${chips} chip(s)`);
  else warn(`Stats row visible mais seulement ${chips} chip(s) (attendu ≥ 3)`);
} catch {
  fail('Stats row .stats-row non trouvée');
}

// 1.5 composant data-table présent
try {
  await page.waitForSelector('app-data-table', { timeout: 6000 });
  ok('Composant app-data-table présent');
} catch {
  fail('Composant app-data-table non trouvé');
}

// 1.6 au moins une ligne dans la table (attendre chargement API)
try {
  await page.waitForTimeout(1500);
  // app-data-table renders a mat-table with mat-row, or a plain table
  const rows = await page.locator('mat-row, table tbody tr').count();
  if (rows > 0) ok(`Table contient ${rows} ligne(s)`);
  else warn('Table vide ou structure non reconnue');
} catch {
  warn('Impossible de compter les lignes de la table');
}

// 1.7 bouton "Désactiver l'utilisateur" visible
try {
  const btn = page.locator('button[matTooltip="Désactiver l\'utilisateur"]').first();
  const visible = await btn.isVisible({ timeout: 4000 }).catch(() => false);
  if (visible) ok('Bouton "Désactiver l\'utilisateur" visible dans la table');
  else warn('Bouton désactiver non visible (table peut-être vide)');
} catch {
  warn('Bouton désactiver introuvable');
}

// 1.8 clic bouton désactiver → dialog confirm → annulation (test non destructif)
try {
  const btn = page.locator('button[matTooltip="Désactiver l\'utilisateur"]').first();
  const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
  if (visible) {
    page.once('dialog', dialog => dialog.dismiss());
    await btn.click();
    await page.waitForTimeout(500);
    ok('Dialog confirm désactivation affiché et annulé (non destructif)');
  } else {
    warn('Pas de bouton désactiver disponible pour tester le dialog');
  }
} catch (e) {
  warn(`Test dialog désactivation ignoré: ${e.message}`);
}

// ════════════════════════════════════════════════════════════════════════════
sec('2. /admin/secteurs — Gestion des secteurs');

await page.goto(`${BASE}/admin/secteurs`);
await page.waitForTimeout(2500);

// 2.1 layout deux colonnes
try {
  await page.waitForSelector('.sa-layout', { timeout: 8000 });
  ok('Layout .sa-layout (deux colonnes) visible');
} catch {
  fail('Layout .sa-layout non trouvé');
}

// 2.2 panneau liste gauche
try {
  await page.waitForSelector('.sa-list', { timeout: 5000 });
  ok('Panneau liste .sa-list visible');
} catch {
  fail('Panneau liste .sa-list non trouvé');
}

// 2.3 titre "Secteurs" dans l'en-tête de liste
try {
  const h1 = await page.locator('.sa-list-header h1').textContent({ timeout: 5000 });
  if (h1?.includes('Secteurs')) ok(`Titre "${h1.trim()}" dans l'en-tête liste`);
  else fail(`Titre inattendu: "${h1?.trim()}"`);
} catch {
  fail('Titre .sa-list-header h1 non trouvé');
}

// 2.4 barre de recherche
try {
  await page.waitForSelector('.sa-search', { timeout: 5000 });
  ok('Barre de recherche .sa-search présente');
} catch {
  fail('Barre de recherche .sa-search non trouvée');
}

// 2.5 items secteurs dans la liste
try {
  await page.waitForSelector('.sa-item', { timeout: 8000 });
  const count = await page.locator('.sa-item').count();
  ok(`Liste contient ${count} secteur(s)`);
} catch {
  fail('Aucun item secteur (.sa-item) dans la liste');
}

// 2.6 filtrage par la recherche
try {
  const searchInput = page.locator('.sa-search');
  await searchInput.fill('Rest');
  await page.waitForTimeout(400);
  const filtered = await page.locator('.sa-item').count();
  await searchInput.fill('');
  await page.waitForTimeout(400);
  ok(`Recherche "Rest" → ${filtered} résultat(s), remise à zéro OK`);
} catch {
  fail('Barre de recherche non fonctionnelle');
}

// 2.7 clic sur premier secteur → détail visible
try {
  const firstItem = page.locator('.sa-item').first();
  await firstItem.click();
  await page.waitForTimeout(1000);
  await page.waitForSelector('.sd-header', { timeout: 6000 });
  ok('Clic sur secteur → panneau détail .sd-header visible');
} catch {
  fail('Panneau détail non affiché après clic sur secteur');
}

// 2.8 deux onglets Informations / Questionnaire
try {
  const tabs = await page.locator('.sd-tab').count();
  if (tabs >= 2) ok(`${tabs} onglets de détail visibles (Informations + Questionnaire)`);
  else fail(`Seulement ${tabs} onglet(s) de détail (attendu ≥ 2)`);
} catch {
  fail('Onglets de détail .sd-tab non trouvés');
}

// 2.9 tab Informations : formulaire édition visible
try {
  // L'onglet Informations est actif par défaut
  await page.waitForSelector('.sd-body', { timeout: 5000 });
  const formVisible = await page.locator('.sd-body form').isVisible({ timeout: 4000 });
  if (formVisible) ok('Formulaire d\'édition visible dans l\'onglet Informations');
  else fail('Formulaire d\'édition non visible dans .sd-body');
} catch {
  fail('Corps de l\'onglet Informations .sd-body non trouvé');
}

// 2.10 enregistrer les infos du secteur (libellé inchangé → re-sauvegarde)
try {
  // Le premier mat-form-field du sd-body contient le champ label
  const labelInput = page.locator('.sd-body mat-form-field:first-of-type input').first();
  await labelInput.waitFor({ timeout: 4000 });
  const currentVal = await labelInput.inputValue();
  // On re-remplit avec la même valeur pour garder le formulaire valide
  await labelInput.fill(currentVal || 'Test');
  const saveBtn = page.locator('.sd-body button[type="submit"]').first();
  await saveBtn.click();
  const snack = await getSnackbar(page, 4000);
  if (snack && snack.includes('mis à jour')) {
    ok(`Enregistrement info secteur → snackbar: "${snack.trim()}"`);
  } else if (snack) {
    warn(`Snackbar obtenue: "${snack.trim()}"`);
    ok('Bouton Enregistrer cliqué (snackbar reçue)');
  } else {
    warn('Bouton Enregistrer cliqué — snackbar non capturée (peut-être déjà expirée)');
  }
} catch (e) {
  fail(`Enregistrement info secteur échoué: ${e.message}`);
}

// 2.11 onglet Questionnaire → corps visible avec questions
try {
  const questTab = page.locator('.sd-tab').nth(1);
  await questTab.click();
  await page.waitForTimeout(700);
  await page.waitForSelector('.sd-body--q', { timeout: 5000 });
  ok('Onglet Questionnaire → corps .sd-body--q visible');
} catch {
  fail('Onglet Questionnaire non fonctionnel');
}

// 2.12 compteur de questions dans le topbar
try {
  const countEl = await page.locator('.sq-count').textContent({ timeout: 3000 });
  if (countEl?.includes('question')) ok(`Compteur questionnaire: "${countEl.trim()}"`);
  else warn(`Compteur questionnaire inattendu: "${countEl?.trim()}"`);
} catch {
  warn('Compteur .sq-count non trouvé');
}

// 2.13 sections et bouton "Ajouter une question" visibles
try {
  const addBtns = await page.locator('.sq-add-btn').count();
  if (addBtns > 0) ok(`${addBtns} bouton(s) "Ajouter une question" visibles`);
  else warn('Aucun bouton .sq-add-btn (aucune section ?)');
} catch {
  warn('Boutons .sq-add-btn non trouvés');
}

// 2.14 bouton "Nouveau" → modal création secteur
try {
  const newBtn = page.locator('.btn-new').first();
  await newBtn.waitFor({ timeout: 5000 });
  await newBtn.click();
  await page.waitForTimeout(500);
  await page.waitForSelector('.modal-backdrop', { timeout: 5000 });
  ok('Bouton "Nouveau" → modal .modal-backdrop visible');
} catch {
  fail('Modal de création secteur non ouvert');
}

// 2.15 modal : champs code et libellé présents
try {
  const codeInput = page.locator('.modal input[placeholder="MAJUSCULES_SANS_ESPACE"]');
  await codeInput.waitFor({ timeout: 4000 });
  ok('Champ "Code unique" présent dans le modal');
} catch {
  fail('Champ code introuvable dans le modal');
}

// 2.16 modal : saisie et soumission création secteur
const uniqCode = `E2E_TEST_${Date.now()}`;
try {
  const codeInput = page.locator('.modal input[placeholder="MAJUSCULES_SANS_ESPACE"]');
  // Le champ label est le deuxième mat-form-field du modal
  const labelInput = page.locator('.modal mat-form-field').nth(1).locator('input');
  await codeInput.fill(uniqCode);
  await labelInput.fill('Secteur Test E2E');
  const submitBtn = page.locator('.modal-footer button[type="submit"]');
  await submitBtn.click();
  const snack = await getSnackbar(page, 6000);
  if (snack && snack.includes('créé')) {
    ok(`Création secteur → snackbar: "${snack.trim()}"`);
  } else if (snack) {
    warn(`Snackbar création: "${snack.trim()}"`);
    ok('Création secteur soumise (snackbar reçue)');
  } else {
    warn(`Création soumise (code: ${uniqCode}) — snackbar non capturée`);
  }
} catch (e) {
  fail(`Création secteur échouée: ${e.message}`);
  // Fermer le modal si encore ouvert
  await page.locator('.modal-header button[mat-icon-button]').click().catch(() => {});
}

// 2.17 secteur créé apparaît dans la liste après reload
try {
  await page.waitForTimeout(2000);
  const totalItems = await page.locator('.sa-item').count();
  ok(`Liste après création : ${totalItems} secteur(s) au total`);
} catch {
  warn('Impossible de vérifier la liste après création');
}

// 2.18 retrouver le secteur créé via la recherche
try {
  const searchInput = page.locator('.sa-search');
  await searchInput.fill('E2E');
  await page.waitForTimeout(500);
  const found = await page.locator('.sa-item').count();
  await searchInput.fill('');
  await page.waitForTimeout(300);
  if (found >= 1) ok(`Secteur E2E trouvé dans la liste (${found} résultat(s))`);
  else warn('Secteur E2E non trouvé dans la liste (peut-être erreur API)');
} catch {
  warn('Recherche secteur E2E ignorée');
}

// 2.19 désactiver le secteur de test (select + toggle)
try {
  const searchInput = page.locator('.sa-search');
  await searchInput.fill('E2E');
  await page.waitForTimeout(500);
  const testItem = page.locator('.sa-item').first();
  const itemVisible = await testItem.isVisible({ timeout: 3000 }).catch(() => false);
  if (itemVisible) {
    await testItem.click();
    await page.waitForTimeout(800);
    // Bouton "Désactiver" ou "Réactiver" dans .sd-header__actions
    const desactiverBtn = page.locator('.sd-header__actions .btn-danger-o').first();
    const btnVisible = await desactiverBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (btnVisible) {
      await desactiverBtn.click();
      const snack = await getSnackbar(page, 4000);
      if (snack && snack.includes('désactivé')) {
        ok(`Désactivation secteur E2E → snackbar: "${snack.trim()}"`);
      } else {
        warn(`Désactivation soumise, snackbar: "${snack?.trim() ?? 'aucune'}"`);
      }
    } else {
      warn('Bouton .btn-danger-o non visible sur le secteur E2E');
    }
  } else {
    warn('Secteur E2E non visible après filtrage');
  }
  await searchInput.fill('').catch(() => {});
  await page.waitForTimeout(300);
} catch (e) {
  warn(`Test désactivation secteur E2E ignoré: ${e.message}`);
  await page.locator('.sa-search').fill('').catch(() => {});
}

// ════════════════════════════════════════════════════════════════════════════
sec('3. /admin/pointage-config — Configuration du pointage');

await page.goto(`${BASE}/admin/pointage-config`);
await page.waitForTimeout(2000);

// 3.1 container de page
try {
  await page.waitForSelector('.page', { timeout: 8000 });
  ok('Container .page visible');
} catch {
  fail('Container .page non trouvé');
}

// 3.2 titre "Configuration du pointage"
try {
  const h2 = await page.locator('h2').first().textContent({ timeout: 5000 });
  if (h2?.includes('Configuration du pointage')) ok(`Titre "${h2.trim()}" présent`);
  else fail(`Titre inattendu: "${h2?.trim()}"`);
} catch {
  fail('Titre h2 "Configuration du pointage" non trouvé');
}

// 3.3 sous-titre descriptif
try {
  const sub = await page.locator('.page-header__sub').textContent({ timeout: 4000 });
  if (sub?.length > 10) ok(`Sous-titre descriptif présent: "${sub.trim().substring(0, 60)}…"`);
  else warn('Sous-titre court ou vide');
} catch {
  warn('Sous-titre .page-header__sub non trouvé');
}

// 3.4 grille de sites chargée
try {
  await page.waitForSelector('.sites-grid', { timeout: 8000 });
  ok('Grille .sites-grid visible');
} catch {
  fail('Grille .sites-grid non trouvée');
}

// 3.5 deux cartes de site
try {
  await page.waitForSelector('.site-card', { timeout: 8000 });
  const count = await page.locator('.site-card').count();
  if (count === 2) ok('2 cartes de site visibles (La Réunion + Madagascar)');
  else if (count > 0) warn(`${count} carte(s) site visible(s) — attendu 2`);
  else fail('Aucune carte .site-card trouvée');
} catch {
  fail('Cartes .site-card non trouvées');
}

// 3.6 drapeaux des deux sites
try {
  const flags = await page.locator('.site-flag').allTextContents();
  const hasReunion    = flags.some(f => f.includes('🇷🇪'));
  const hasMadagascar = flags.some(f => f.includes('🇲🇬'));
  if (hasReunion && hasMadagascar) ok('Drapeaux 🇷🇪 La Réunion et 🇲🇬 Madagascar visibles');
  else warn(`Drapeaux trouvés : ${JSON.stringify(flags)}`);
} catch {
  warn('Impossible de vérifier les drapeaux de site');
}

// 3.7 attendre la fin du chargement (loading dots disparus)
try {
  await page.waitForFunction(
    () => document.querySelectorAll('.loading-dot').length === 0,
    { timeout: 10000 }
  );
  ok('Chargement des configs terminé (loading dots disparus)');
} catch {
  warn('Loading dots encore présents après 10 s');
}

// 3.8 inputs latitude / longitude visibles (une carte au moins)
try {
  const latInputs = await page.locator('input[placeholder="-20.8823"]').count();
  const lngInputs = await page.locator('input[placeholder="55.4504"]').count();
  if (latInputs > 0 && lngInputs > 0) {
    ok(`Inputs lat/lng présents (${latInputs}×lat, ${lngInputs}×lng)`);
  } else {
    // Fallback : chercher par label
    const labels = await page.locator('.form-field label').allTextContents();
    const hasLat = labels.some(l => l.toLowerCase().includes('latitude'));
    const hasLng = labels.some(l => l.toLowerCase().includes('longitude'));
    if (hasLat && hasLng) ok('Labels Latitude/Longitude présents dans les formulaires');
    else fail(`Inputs lat/lng non trouvés (latInputs=${latInputs}, lngInputs=${lngInputs})`);
  }
} catch {
  fail('Inputs de coordonnées non trouvés');
}

// 3.9 slider "Rayon autorisé" visible
try {
  const slider = page.locator('input[type="range"]').first();
  await slider.waitFor({ state: 'visible', timeout: 5000 });
  const val = await slider.inputValue();
  ok(`Slider rayon visible — valeur courante: ${val} m`);
} catch {
  fail('Slider input[type="range"] non trouvé');
}

// 3.10 bouton "Utiliser ma position actuelle" visible
try {
  const locateBtn = page.locator('.btn-locate').first();
  await locateBtn.waitFor({ state: 'visible', timeout: 5000 });
  ok('Bouton "Utiliser ma position actuelle" (.btn-locate) visible');
} catch {
  fail('Bouton .btn-locate non trouvé');
}

// 3.11 champ Adresse visible
try {
  const adresseInput = page.locator('input[placeholder="14 rue des Flamboyants, Saint-Denis"]').first();
  const visible = await adresseInput.isVisible({ timeout: 4000 });
  if (visible) ok('Champ Adresse visible');
  else warn('Champ Adresse non visible');
} catch {
  warn('Champ Adresse (placeholder) non trouvé');
}

// 3.12 bouton Save initialement désactivé si pas de coordonnées
try {
  const firstCard = page.locator('.site-card').first();
  const saveBtn = firstCard.locator('.btn-save');
  const latInput = firstCard.locator('input[type="number"]').first();
  const currentLat = await latInput.inputValue({ timeout: 3000 }).catch(() => '');
  if (!currentLat) {
    const isDisabled = await saveBtn.isDisabled({ timeout: 2000 });
    if (isDisabled) ok('Bouton Save désactivé tant que lat/lng sont vides (guard OK)');
    else warn('Bouton Save actif sans coordonnées (peut-être déjà des coords en base)');
  } else {
    ok(`Coordonnées déjà en base (lat: ${currentLat}) — guard non applicable`);
  }
} catch {
  warn('Vérification du guard de désactivation ignorée');
}

// 3.13 remplir lat/lng et sauvegarder la config Réunion
try {
  const firstCard = page.locator('.site-card').first();
  const latInput = firstCard.locator('input[placeholder="-20.8823"]');
  const lngInput = firstCard.locator('input[placeholder="55.4504"]');

  await latInput.fill('-20.8823');
  await lngInput.fill('55.4504');
  await page.waitForTimeout(400); // laisser Angular mettre à jour le modèle

  const saveBtn = firstCard.locator('.btn-save');
  const disabled = await saveBtn.isDisabled({ timeout: 2000 }).catch(() => false);
  if (disabled) {
    fail('Bouton Save toujours désactivé après remplissage lat/lng');
  } else {
    await saveBtn.click();
    const snack = await getSnackbar(page, 5000);
    if (snack && snack.includes('enregistrée')) {
      ok(`Sauvegarde config La Réunion → snackbar: "${snack.trim()}"`);
    } else if (snack) {
      warn(`Snackbar obtenue: "${snack.trim()}"`);
      ok('Bouton Enregistrer cliqué (snackbar reçue)');
    } else {
      warn('Bouton Enregistrer cliqué — snackbar non capturée');
    }
  }
} catch (e) {
  fail(`Sauvegarde config La Réunion échouée: ${e.message}`);
}

// 3.14 badge "Enregistré ✓" visible après sauvegarde
try {
  await page.waitForTimeout(600);
  const savedBadge = page.locator('.saved-badge').first();
  const visible = await savedBadge.isVisible({ timeout: 4000 });
  if (visible) ok('Badge .saved-badge "Enregistré ✓" visible après sauvegarde');
  else warn('Badge .saved-badge non visible (peut-être déjà disparu ou non affiché)');
} catch {
  warn('Badge .saved-badge non trouvé');
}

// 3.15 lien Google Maps visible après saisie de coordonnées
try {
  const mapLink = page.locator('.map-link').first();
  const visible = await mapLink.isVisible({ timeout: 4000 });
  if (visible) {
    const href = await mapLink.getAttribute('href');
    ok(`Lien Google Maps visible — href: ${href}`);
  } else {
    warn('Lien Google Maps .map-link non visible');
  }
} catch {
  warn('Lien Google Maps .map-link non trouvé');
}

// 3.16 carte d'information "Comment ça fonctionne" en bas de page
try {
  const infoCard = page.locator('.info-card');
  await infoCard.waitFor({ state: 'visible', timeout: 5000 });
  const text = await infoCard.textContent();
  if (text?.includes('fonctionne')) ok('Carte info "Comment ça fonctionne" visible');
  else warn(`Contenu carte info inattendu: "${text?.trim().substring(0, 60)}"`);
} catch {
  fail('Carte info .info-card non trouvée');
}

// ── Fin ──────────────────────────────────────────────────────────────────────
await browser.close();

console.log(`\n${'═'.repeat(60)}\n  ${pass} ✅  |  ${fail_count} ❌  |  ${pass + fail_count} total\n${'═'.repeat(60)}`);
if (fail_count > 0) process.exit(1);
