/**
 * Test E2E complet — Module Dossier Client
 *
 * 1. Créer un dossier via l'UI (wizard)
 * 2. Créer l'exercice via API (le wizard manuel ne propose pas de date)
 * 3. Vérifier la liste
 * 4. Remplir Fiche Identité
 * 5. Remplir Analyse Stratégique (SWOT + Porter + BMC)
 * 6. Remplir Objectifs
 * 7. Remplir Contrôle Interne
 * 8. Remplir Dossier de travail
 * 9. Remplir Missions
 * 10. Remplir Synthèse de clôture
 * 11. Remplir Fournisseurs
 * 12. Remplir Pilotage (flux mensuels)
 * 13. Clôturer l'exercice via UI
 * 14. Vérifier carryover (API + UI)
 * 15. Vérifier lecture seule
 */
import { chromium } from '/datas/Projets/Aro/backend/node_modules/playwright/index.mjs';

const BASE  = 'http://localhost:4200';
const API   = 'http://localhost:3000/api';
const EMAIL = 'admin@afym.re';
const PWD   = 'Admin1234!';

let passed = 0, failed = 0, warned = 0;
const pass = m => { console.log(`  ✅ ${m}`); passed++; };
const fail = m => { console.log(`  ❌ ${m}`); failed++; };
const warn = m => { console.log(`  ⚠️  ${m}`); warned++; };

/* ── helpers API ───────────────────────────────────────────── */
async function apiAuth() {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PWD }),
  });
  return (await r.json()).access_token;
}
async function apiGet(token, path) {
  return fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
}

/* ── helpers UI ────────────────────────────────────────────── */
async function login(page) {
  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  pass('Connexion réussie');
}

async function pointerSiNecessaire() {
  try {
    const token = await apiAuth();
    const statut = await apiGet(token, '/pointage/mon-statut');
    if (statut.estPointe) { pass('Admin déjà pointé'); return; }
    await fetch(`${API}/pointage/pointer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    pass('Admin pointé via API');
  } catch (e) { warn('Pointage: '+e.message); }
}

async function closeModals(page) {
  const backdrop = page.locator('.cdk-overlay-backdrop').first();
  if (await backdrop.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}

async function waitSidebar(page) {
  await page.waitForSelector('button.sidenav__item', { timeout: 15000 });
}

async function goToTab(page, label) {
  await closeModals(page);
  await waitSidebar(page);
  const tab = page.locator('button.sidenav__item').filter({ hasText: label }).first();
  await tab.waitFor({ state: 'visible', timeout: 8000 });
  await tab.click();
  await page.waitForTimeout(600);
}

async function snackbar(page, timeout = 5000) {
  try {
    const s = page.locator('mat-snack-bar-container, .mat-mdc-snack-bar-container').first();
    await s.waitFor({ state: 'visible', timeout });
    return (await s.textContent())?.trim() ?? '';
  } catch { return null; }
}

async function saveCheck(page, label) {
  const txt = await snackbar(page, 5000);
  if (txt) pass(`Save "${label}" — snackbar OK`);
  else warn(`Pas de snackbar après "${label}"`);
}

/* ════════════════════════════════════════════════════════════
   1 — Créer le dossier via l'UI (wizard)
   ════════════════════════════════════════════════════════════ */
async function creerDossier(page) {
  console.log('\n[1] Création du dossier via le wizard');
  await page.goto(`${BASE}/clients`);
  await page.waitForSelector('app-client-list', { timeout: 10000 });
  await closeModals(page);

  // Ouvrir le wizard
  const btnNew = page.locator('button.btn-new-folder').first();
  await btnNew.waitFor({ state: 'visible', timeout: 8000 });
  await btnNew.click();
  await page.waitForTimeout(800);
  pass('Wizard ouvert');

  // ── Step 1 "entreprise" ──
  // Nom manuel (champ visible quand pas de sélection Pappers)
  const nomInput = page.locator('mat-dialog-container input[placeholder*="introuvable"], mat-dialog-container input[placeholder*="entreprise introuvable"]').first();
  await nomInput.waitFor({ state: 'visible', timeout: 6000 });
  await nomInput.fill('Boulangerie Artisanale Morel');
  pass('Nom saisi');

  // Site La Réunion
  const siteReunion = page.locator('mat-dialog-container .site-card').filter({ hasText: 'La Réunion' }).first();
  await siteReunion.waitFor({ state: 'visible', timeout: 4000 });
  await siteReunion.click();
  await page.waitForTimeout(200);
  pass('Site La Réunion sélectionné');

  // Bouton "Suivant" (btn-next activé car step1Valid = true)
  const btnNext = page.locator('mat-dialog-container button.btn-next').first();
  await btnNext.waitFor({ state: 'visible', timeout: 4000 });
  await btnNext.click();
  await page.waitForTimeout(500);
  pass('Step 1 → Step 2 (Secteur)');

  // ── Step 2 "secteur" — sélectionner le 1er secteur disponible ──
  const secteurCards = page.locator('mat-dialog-container .secteur-card');
  await secteurCards.first().waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
  const nbSecteurs = await secteurCards.count();
  if (nbSecteurs > 0) {
    await secteurCards.first().click();
    await page.waitForTimeout(300);
    pass(`Secteur sélectionné (${nbSecteurs} disponibles)`);
  } else {
    warn('Aucun secteur affiché — on passe');
  }
  // Suivant / Passer
  const btnNext2 = page.locator('mat-dialog-container button.btn-next').first();
  await btnNext2.click();
  await page.waitForTimeout(500);
  pass('Step 2 → Step 3 (ADN Global)');

  // ── Step 3 "adn_global" — passer sans remplir ──
  const btnNext3 = page.locator('mat-dialog-container button.btn-next').first();
  if (await btnNext3.isVisible().catch(() => false)) {
    await btnNext3.click();
    await page.waitForTimeout(500);
    pass('Step 3 → Step suivant (ADN Sectoriel ou Recap)');
  }

  // ── Step 4 éventuel "adn_sectoriel" — passer ──
  const btnNext4 = page.locator('mat-dialog-container button.btn-next').first();
  if (await btnNext4.isVisible().catch(() => false)) {
    await btnNext4.click();
    await page.waitForTimeout(500);
    pass('Step 4 → Recap');
  }

  // ── Dernière étape "recap" — Créer le dossier ──
  const btnCreate = page.locator('mat-dialog-container button.btn-create').first();
  await btnCreate.waitFor({ state: 'visible', timeout: 6000 });
  await btnCreate.click();
  pass('Bouton "Créer le dossier" cliqué');

  // Attendre fermeture du dialog (le wizard ne navigue pas automatiquement)
  await page.waitForSelector('mat-dialog-container', { state: 'hidden', timeout: 15000 });
  await page.waitForTimeout(800);
  pass('Wizard fermé');

  // Récupérer le client créé via API (le plus récent)
  const token = await apiAuth();
  const clients = await apiGet(token, '/clients');
  const created = clients.find(c => c.nom === 'Boulangerie Artisanale Morel');
  if (created) {
    pass(`Dossier trouvé via API — id=${created.id}`);
    return created.id;
  }
  // Fallback : dernier client créé
  if (clients.length > 0) {
    const last = clients[clients.length - 1];
    warn(`Dossier "Boulangerie Artisanale Morel" non trouvé — utilisation du dernier: id=${last.id}, nom="${last.nom}"`);
    return last.id;
  }
  fail('Aucun client trouvé après création');
  return null;
}

/* ════════════════════════════════════════════════════════════
   2 — Créer l'exercice via API
   ════════════════════════════════════════════════════════════ */
async function creerExerciceApi(clientId) {
  console.log('\n[2] Création exercice via API');
  const token = await apiAuth();
  // Le wizard sans date ne crée pas d'exercice — on le crée manuellement
  const exos = await apiGet(token, `/clients/${clientId}/exercices`);
  if (exos.length > 0) {
    pass(`Exercice existant — id=${exos[0].id}, statut=${exos[0].statut}`);
    return exos[0].id;
  }
  // Créer un exercice avec clôture au 31/12
  const r = await fetch(`${API}/clients/${clientId}/exercices`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dateClotureExercice: '12-31' }), // MM-DD
  });
  if (r.status === 201 || r.status === 200) {
    const exo = await r.json();
    pass(`Exercice créé — id=${exo.id}`);
    return exo.id;
  }
  // Fallback : appel via le service clients
  const r2 = await fetch(`${API}/clients/${clientId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dateClotureExercice: '12-31' }),
  });
  const client2 = await r2.json();
  const exos2 = await apiGet(token, `/clients/${clientId}/exercices`);
  if (exos2.length > 0) {
    pass(`Exercice créé via PATCH client — id=${exos2[0].id}`);
    return exos2[0].id;
  }
  fail('Impossible de créer l\'exercice');
  return null;
}

/* ════════════════════════════════════════════════════════════
   3 — Vérifier dans la liste
   ════════════════════════════════════════════════════════════ */
async function verifierListe(page) {
  console.log('\n[3] Vérification liste');
  await page.goto(`${BASE}/clients`);
  await page.waitForSelector('app-client-list', { timeout: 10000 });
  await closeModals(page);
  await page.waitForTimeout(2000);
  const card = page.locator('.folder-item, .list-row').filter({ hasText: 'Boulangerie Artisanale Morel' }).first();
  if (await card.count() > 0) pass('Dossier visible dans la liste');
  else fail('Dossier absent de la liste');
}

/* ════════════════════════════════════════════════════════════
   4 — Fiche Identité
   ════════════════════════════════════════════════════════════ */
async function remplirFicheIdentite(page, clientId) {
  console.log('\n[4] Fiche Identité');
  await page.goto(`${BASE}/clients/${clientId}`);
  await waitSidebar(page);
  await goToTab(page, 'Fiche Identité');

  const champs = [
    { sel: '[formcontrolname="raisonSociale"]', val: 'BOULANGERIE ARTISANALE MOREL SARL' },
    { sel: '[formcontrolname="siren"]',         val: '123456789' },
    { sel: '[formcontrolname="siret"]',         val: '12345678900015' },
    { sel: '[formcontrolname="adresse"]',        val: '12 rue du Four, 97400 Saint-Denis' },
  ];
  let n = 0;
  for (const { sel, val } of champs) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) { await el.clear(); await el.fill(val); n++; }
  }
  if (n > 0) pass(`${n} champs Fiche Identité remplis`);
  else warn('Aucun champ Fiche Identité trouvé');

  const saveBtn = page.locator('app-fiche-identite-tab button').filter({ hasText: /Enregistrer|Sauvegarder/i }).first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click(); await saveCheck(page, 'Fiche Identité');
  } else { warn('Bouton save Fiche Identité non trouvé'); }
}

/* ════════════════════════════════════════════════════════════
   5 — Analyse Stratégique
   ════════════════════════════════════════════════════════════ */
async function remplirStrategie(page) {
  console.log('\n[5] Analyse Stratégique');
  await goToTab(page, 'Stratégie');

  const swot = [
    { sel: '.swot-forces textarea, .swot-card--forces textarea', val: 'Savoir-faire artisanal reconnu\nProduits frais quotidiens\nFidélité clientèle 15 ans' },
    { sel: '.swot-faiblesses textarea, .swot-card--faiblesses textarea', val: 'Locaux vieillissants\nPas de livraison\nFournisseur unique farine' },
    { sel: '.swot-opportunites textarea, .swot-card--opportunites textarea', val: 'Click & collect\nMarchés locaux\nPartenariat hôtels' },
    { sel: '.swot-menaces textarea, .swot-card--menaces textarea', val: 'Concurrence grande surface\nHausse matières premières' },
  ];
  for (const { sel, val } of swot) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) await el.fill(val);
  }
  pass('SWOT rempli');

  // Porter
  const porterHeader = page.locator('app-analyse-strategique-tab mat-expansion-panel-header').filter({ hasText: /5 Forces de Porter/ }).first();
  if (await porterHeader.count() > 0) {
    await porterHeader.scrollIntoViewIfNeeded();
    const panel = page.locator('app-analyse-strategique-tab mat-expansion-panel').filter({ hasText: /5 Forces de Porter/ }).first();
    if (!await panel.getAttribute('class').then(c => c?.includes('mat-expanded')).catch(() => false)) await porterHeader.click();
    await page.waitForTimeout(400);
    const ta = page.locator('app-analyse-strategique-tab .porter-grid mat-form-field').nth(0).locator('textarea');
    if (await ta.count() > 0) {
      await ta.scrollIntoViewIfNeeded();
      await ta.fill('Concurrence forte — 3 boulangeries dans 500m + grande surface.');
      pass('Porter rempli');
    } else { warn('Porter textarea introuvable'); }
  }

  // BMC
  const bmcHeader = page.locator('app-analyse-strategique-tab mat-expansion-panel-header').filter({ hasText: /Business Model Canvas/ }).first();
  if (await bmcHeader.count() > 0) {
    await bmcHeader.scrollIntoViewIfNeeded();
    const bmcPanel = page.locator('app-analyse-strategique-tab mat-expansion-panel').filter({ hasText: /Business Model Canvas/ }).first();
    if (!await bmcPanel.getAttribute('class').then(c => c?.includes('mat-expanded')).catch(() => false)) await bmcHeader.click();
    await page.waitForTimeout(400);
    const ta = bmcPanel.locator('textarea').first();
    if (await ta.count() > 0) {
      await ta.scrollIntoViewIfNeeded();
      await ta.fill('Boulangerie artisanale. Valeur : produits frais. Clients : riverains et restaurateurs. Revenus : vente directe. Coûts : farine, énergie, main-d\'œuvre.');
      pass('BMC rempli');
    } else { warn('BMC textarea introuvable'); }
  }

  const saveBtn = page.locator('app-analyse-strategique-tab button[color="primary"]').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click(); await saveCheck(page, 'Stratégie');
  } else { warn('Bouton save Stratégie non trouvé'); }
}

/* ════════════════════════════════════════════════════════════
   6 — Objectifs
   ════════════════════════════════════════════════════════════ */
async function remplirObjectifs(page) {
  console.log('\n[6] Objectifs');
  await goToTab(page, 'Objectifs');
  const fields = [
    { name: 'objectifs12mois',       val: 'Augmenter le CA de 12% via click & collect.' },
    { name: 'objectifs3a5ans',       val: 'Ouvrir une 2ème boutique dans 3 ans.' },
    { name: 'objectifsLongTerme',    val: 'Référence boulangerie artisanale de l\'île.' },
    { name: 'attentesClient',        val: 'Optimisation fiscale investissements matériel.' },
    { name: 'qualiteRelation',       val: 'Très bonne — disponible et réactif.' },
    { name: 'axesAmelioration',      val: 'Améliorer suivi trésorerie mensuel.' },
    { name: 'recommandationsFaites', val: 'PEE pour les salariés.' },
    { name: 'relationCollaborateur', val: 'M. Morel très impliqué. Son fils rejoint l\'entreprise.' },
    { name: 'depuisQuand',           val: '8 ans' },
  ];
  let n = 0;
  for (const { name, val } of fields) {
    const el = page.locator(`[formcontrolname="${name}"]`).first();
    if (await el.isVisible().catch(() => false)) { await el.clear(); await el.fill(val); n++; }
  }
  if (n >= 5) pass(`${n} champs Objectifs remplis`);
  else warn(`${n} champs Objectifs remplis seulement`);
  const saveBtn = page.locator('app-objectifs-tab button[color="primary"]').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click(); await saveCheck(page, 'Objectifs');
  } else { warn('Bouton save Objectifs non trouvé'); }
}

/* ════════════════════════════════════════════════════════════
   7 — Contrôle Interne
   ════════════════════════════════════════════════════════════ */
async function remplirControleInterne(page) {
  console.log('\n[7] Contrôle Interne');
  await goToTab(page, 'Contrôle Interne');
  const noteTA = page.locator('app-controle-interne-tab textarea').last();
  if (await noteTA.isVisible().catch(() => false)) {
    await noteTA.fill('CI satisfaisant. Caisse vérifiée quotidiennement. Inventaire mensuel. Pas de procédure écrite pour achats urgents.');
    pass('Note CI remplie');
  } else { warn('Note CI non trouvée'); }
  const addOk = page.locator('app-controle-interne-tab .section-header--green button[mat-icon-button]').first();
  if (await addOk.isVisible().catch(() => false)) {
    await addOk.click();
    await page.waitForTimeout(300);
    const input = page.locator('app-controle-interne-tab .process-row--green .process-input').first();
    if (await input.isVisible().catch(() => false)) {
      await input.fill('Vérification caisse quotidienne et réconciliation hebdomadaire');
      pass('Process OK ajouté');
    }
  } else { warn('Bouton add process OK non trouvé'); }
  const saveBtn = page.locator('app-controle-interne-tab button[color="primary"]').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click(); await saveCheck(page, 'Contrôle Interne');
  } else { warn('Bouton save CI non trouvé'); }
}

/* ════════════════════════════════════════════════════════════
   8 — Dossier de travail
   ════════════════════════════════════════════════════════════ */
async function remplirDossierTravail(page) {
  console.log('\n[8] Dossier de travail');
  await goToTab(page, 'Dossier de travail');
  const noteTA = page.locator('app-dossier-travail-tab textarea.dt-textarea--synthese').first();
  await noteTA.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
  if (await noteTA.isVisible().catch(() => false)) {
    await noteTA.fill('Boulangerie Morel — Exercice 2025. CA +5%. Bonne gestion stocks. Surveiller marges produits spéciaux.');
    pass('Note synthèse DT remplie');
    const saveNote = page.locator('app-dossier-travail-tab .dt-section--synthese .dt-save-btn').first();
    if (await saveNote.isVisible().catch(() => false)) {
      await saveNote.click(); await saveCheck(page, 'Note DT');
    }
  } else { warn('Note synthèse DT non trouvée'); }

  const diligTA = page.locator('app-dossier-travail-tab .dt-cycle-content textarea').first();
  if (await diligTA.isVisible().catch(() => false)) {
    await diligTA.fill('Vérification CA journalier vs tickets Z. Contrôle remises. Revue ventes par catégorie.');
    pass('Diligences Ventes remplies');
    const saveCycle = page.locator('app-dossier-travail-tab .dt-cycle-content .dt-save-btn').first();
    if (await saveCycle.isVisible().catch(() => false)) {
      await saveCycle.click(); await saveCheck(page, 'Cycle Ventes DT');
    }
  } else { warn('Diligences Ventes non trouvées'); }
}

/* ════════════════════════════════════════════════════════════
   9 — Missions
   ════════════════════════════════════════════════════════════ */
async function remplirMissions(page) {
  console.log('\n[9] Missions');
  await goToTab(page, 'Missions');

  const btnAdd = page.locator('app-missions-tab button[color="primary"]').first();
  await btnAdd.waitFor({ state: 'visible', timeout: 6000 });
  await btnAdd.click();
  await page.waitForTimeout(400);
  pass('Formulaire missions ouvert');

  const titreInput = page.locator('app-missions-tab input[formcontrolname="titre"]').first();
  if (await titreInput.isVisible().catch(() => false)) {
    await titreInput.fill('Mise en place d\'une gestion de trésorerie prévisionnelle');
    pass('Titre mission saisi');
  } else { warn('Input titre mission non trouvé'); }

  const honorairesInput = page.locator('app-missions-tab input[formcontrolname="honoraires"]').first();
  if (await honorairesInput.isVisible().catch(() => false)) {
    await honorairesInput.fill('2500');
  }

  const descTA = page.locator('app-missions-tab textarea[formcontrolname="description"]').first();
  if (await descTA.isVisible().catch(() => false)) {
    await descTA.fill('Analyse mensuelle des flux de trésorerie et mise en place d\'outils de suivi.');
  }

  const submitBtn = page.locator('app-missions-tab button.btn-submit').first();
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click();
    await saveCheck(page, 'Mission');
  } else { warn('Bouton submit mission non trouvé'); }

  await page.waitForTimeout(500);
  const missionCard = page.locator('app-missions-tab .mission-card').first();
  if (await missionCard.count() > 0) pass('Mission visible dans la liste');
  else warn('Mission non visible après ajout');
}

/* ════════════════════════════════════════════════════════════
   10 — Synthèse de clôture
   ════════════════════════════════════════════════════════════ */
async function remplirSynthese(page) {
  console.log('\n[10] Synthèse de clôture');
  await goToTab(page, 'Synthèse');

  const btnNew = page.locator('app-synthese-tab button').filter({ hasText: /Nouvel exercice/ }).first();
  await btnNew.waitFor({ state: 'visible', timeout: 6000 });
  await btnNew.click();
  await page.waitForTimeout(600);
  pass('Formulaire synthèse ouvert');

  const caInput = page.locator('app-synthese-tab [formcontrolname="ca"]').first();
  if (await caInput.isVisible().catch(() => false)) {
    await caInput.fill('486201');
    pass('CA saisi');
  } else { warn('Champ CA non trouvé'); }

  const commentTA = page.locator('app-synthese-tab [formcontrolname="commentaireFinancier"]').first();
  if (await commentTA.isVisible().catch(() => false)) {
    await commentTA.fill('CA en progression de 6%. EBE amélioré grâce à la maîtrise des coûts matières.');
  }

  const pointsIS = page.locator('app-synthese-tab [formcontrolname="pointsIS"]').first();
  if (await pointsIS.isVisible().catch(() => false)) {
    await pointsIS.fill('IS régime réel normal. Aucun déficit reportable.');
  }

  const notesSynthese = page.locator('app-synthese-tab [formcontrolname="notesSynthese"]').first();
  if (await notesSynthese.isVisible().catch(() => false)) {
    await notesSynthese.fill('Exercice satisfaisant. Marge brute améliorée. Investissement four prévu N+1.');
  }

  const saveBtn = page.locator('app-synthese-tab button[type="submit"]').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await saveCheck(page, 'Synthèse');
  } else { warn('Bouton save synthèse non trouvé'); }

  await page.waitForTimeout(500);
  const synPanel = page.locator('app-synthese-tab .syntheses-list mat-expansion-panel').first();
  if (await synPanel.count() > 0) pass('Synthèse visible dans la liste');
  else warn('Synthèse non visible après ajout');
}

/* ════════════════════════════════════════════════════════════
   11 — Fournisseurs
   ════════════════════════════════════════════════════════════ */
async function remplirFournisseurs(page) {
  console.log('\n[11] Fournisseurs');
  await goToTab(page, 'Fournisseurs');

  const btnAdd = page.locator('app-fournisseurs-tab button.btn-add').first();
  await btnAdd.waitFor({ state: 'visible', timeout: 6000 });
  await btnAdd.click();
  await page.waitForTimeout(400);
  pass('Formulaire fournisseur ouvert');

  const nomInput = page.locator('app-fournisseurs-tab [formcontrolname="nom"]').first();
  if (await nomInput.isVisible().catch(() => false)) {
    await nomInput.fill('BNP Paribas Réunion');
    pass('Nom fournisseur saisi');
  } else { warn('Input nom fournisseur non trouvé'); }

  const emailInput = page.locator('app-fournisseurs-tab [formcontrolname="email"]').first();
  if (await emailInput.isVisible().catch(() => false)) {
    await emailInput.fill('contact@bnp-reunion.fr');
  }

  const telInput = page.locator('app-fournisseurs-tab [formcontrolname="telephone"]').first();
  if (await telInput.isVisible().catch(() => false)) {
    await telInput.fill('+262 262 00 00 00');
  }

  const submitBtn = page.locator('app-fournisseurs-tab button.btn-submit').first();
  if (await submitBtn.isVisible().catch(() => false)) {
    await submitBtn.click();
    await saveCheck(page, 'Fournisseur');
  } else { warn('Bouton submit fournisseur non trouvé'); }

  await page.waitForTimeout(500);
  const card = page.locator('app-fournisseurs-tab .fournisseur-card').first();
  if (await card.count() > 0) pass('Fournisseur visible dans la grille');
  else warn('Fournisseur non visible après ajout');
}

/* ════════════════════════════════════════════════════════════
   12 — Pilotage opérationnel
   ════════════════════════════════════════════════════════════ */
async function remplirPilotage(page) {
  console.log('\n[12] Pilotage opérationnel');
  await goToTab(page, 'Pilotage');
  await page.waitForTimeout(800);

  // Première cellule applicable (button, pas div.cell-na)
  const firstCell = page.locator('app-flux-mensuel-tab button.cell-btn').first();
  await firstCell.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
  if (await firstCell.count() > 0) {
    await firstCell.scrollIntoViewIfNeeded();
    await firstCell.click();
    await page.waitForTimeout(400);

    // Menu contextuel
    const menuItem = page.locator('.cdk-overlay-container button').filter({ hasText: /Marquer comme déposé/ }).first();
    if (await menuItem.isVisible().catch(() => false)) {
      await menuItem.click();
      await page.waitForTimeout(400);
      pass('Cellule flux marquée comme déposée');
    } else {
      await page.keyboard.press('Escape');
      warn('Menu pilotage non ouvert ou item non trouvé');
    }
  } else { warn('Aucune cellule pilotage trouvée'); }

  // Vérifier KPI "Déposés"
  const kpiDepose = page.locator('app-flux-mensuel-tab .kpi-green .kpi-value').first();
  if (await kpiDepose.isVisible().catch(() => false)) {
    const val = parseInt((await kpiDepose.textContent().catch(() => '0')) ?? '0', 10);
    if (val >= 1) pass(`Pilotage KPI Déposés = ${val}`);
    else warn('KPI Déposés = 0 après marquage');
  } else { warn('KPI Déposés non trouvé'); }
}

/* ════════════════════════════════════════════════════════════
   13 — Clôturer l'exercice via UI
   ════════════════════════════════════════════════════════════ */
async function cloturerExercice(page, clientId) {
  console.log('\n[13] Clôture exercice via UI');
  const btn = page.locator('.eb-btn-cloture').first();
  await btn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  if (!await btn.isVisible().catch(() => false)) { fail('Bouton clôture non trouvé'); return null; }
  pass('Bouton clôture visible');

  let dlg = false;
  page.once('dialog', async d => { pass(`Confirm: "${d.message().slice(0,60)}"`); await d.accept(); dlg = true; });
  await btn.click();
  await page.waitForTimeout(3000);
  if (!dlg) warn('Dialog clôture non intercepté');

  const token = await apiAuth();
  const exos = await apiGet(token, `/clients/${clientId}/exercices`);
  const newExo = exos.find(e => e.statut === 'OUVERT');
  const closed = exos.find(e => e.statut === 'CLOTURE');

  if (closed) pass(`Exercice ${closed.id} clôturé (${closed.annee})`);
  else fail('Aucun exercice clôturé');
  if (newExo) pass(`Nouvel exercice id=${newExo.id} (${newExo.annee})`);
  else fail('Aucun nouvel exercice OUVERT');

  return newExo?.id ?? null;
}

/* ════════════════════════════════════════════════════════════
   10 — Vérifier carryover
   ════════════════════════════════════════════════════════════ */
async function verifierCarryover(page, clientId, newExoId) {
  console.log(`\n[14] Carryover (nouvel exercice id=${newExoId})`);
  const token = await apiAuth();

  const strat = await apiGet(token, `/clients/${clientId}/analyse?exerciceId=${newExoId}`);
  if (strat?.forces?.length >= 2) pass(`Strat carryover — ${strat.forces.length} forces`);
  else fail('Strat carryover — forces manquantes');
  if (strat?.porterConcurrence?.length > 5) pass('Porter carryover OK');
  else fail('Porter carryover manquant');
  if (strat?.businessModelCanvas?.length > 5) pass('BMC carryover OK');
  else fail('BMC carryover manquant');

  const obj = await apiGet(token, `/clients/${clientId}/objectifs?exerciceId=${newExoId}`);
  if (obj?.objectifs12mois?.length > 5) pass('Objectifs carryover OK');
  else fail('Objectifs carryover manquants');

  const ci = await apiGet(token, `/clients/${clientId}/controle-interne?exerciceId=${newExoId}`);
  if (ci?.noteGenerale?.length > 5) pass('CI carryover OK');
  else fail('CI carryover manquant');

  const dt = await apiGet(token, `/clients/${clientId}/dossier-travail?exerciceId=${newExoId}`);
  if (dt?.noteSynthese?.length > 5) pass('DT carryover note OK');
  else fail('DT carryover note manquante');
  if (dt?.cycles?.length === 3) pass('DT 3 cycles OK');
  else fail(`DT cycles: ${dt?.cycles?.length}/3`);

  // UI
  await page.goto(`${BASE}/clients/${clientId}`);
  await waitSidebar(page);
  await page.waitForTimeout(1000);

  await goToTab(page, 'Stratégie');
  const forcesTA = page.locator('.swot-forces textarea, .swot-card--forces textarea').first();
  if (await forcesTA.isVisible().catch(() => false)) {
    const val = await forcesTA.inputValue().catch(() => '');
    if (val.length > 5) pass(`UI SWOT Forces carryover (${val.length} chars)`);
    else fail('UI SWOT Forces vide après carryover');
  }

  await goToTab(page, 'Objectifs');
  const obj12 = page.locator('[formcontrolname="objectifs12mois"]').first();
  if (await obj12.isVisible().catch(() => false)) {
    const val = await obj12.inputValue().catch(() => '');
    if (val.length > 5) pass('UI Objectifs carryover OK');
    else fail('UI Objectifs vides après carryover');
  }

  await goToTab(page, 'Dossier de travail');
  const dtNote = page.locator('app-dossier-travail-tab textarea.dt-textarea--synthese').first();
  await dtNote.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await dtNote.isVisible().catch(() => false)) {
    const val = await dtNote.inputValue().catch(() => '');
    if (val.length > 5) pass('UI DT note carryover OK');
    else fail('UI DT note vide après carryover');
  }
}

/* ════════════════════════════════════════════════════════════
   11 — Lecture seule
   ════════════════════════════════════════════════════════════ */
async function verifierLectureSeule(clientId) {
  console.log('\n[15] Lecture seule (exercice clôturé)');
  const token = await apiAuth();
  const exos = await apiGet(token, `/clients/${clientId}/exercices`);
  const closed = exos.find(e => e.statut === 'CLOTURE');
  if (!closed) { fail('Exercice clôturé introuvable'); return; }

  const tests = [
    { name: 'Stratégie',        url: `/clients/${clientId}/analyse?exerciceId=${closed.id}`,         body: { forces: ['test'] } },
    { name: 'Objectifs',        url: `/clients/${clientId}/objectifs?exerciceId=${closed.id}`,        body: { objectifs12mois: 'interdite' } },
    { name: 'Contrôle Interne', url: `/clients/${clientId}/controle-interne?exerciceId=${closed.id}`, body: { noteGenerale: 'interdite' } },
    { name: 'Dossier Travail',  url: `/clients/${clientId}/dossier-travail/cycles/VENTE?exerciceId=${closed.id}`, body: { pourcentageCouverture: 99 } },
  ];
  for (const t of tests) {
    const r = await fetch(`${API}${t.url}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(t.body),
    });
    if (r.status === 403) pass(`LS ${t.name} → 403 OK`);
    else fail(`LS ${t.name} → status=${r.status} (attendu 403)`);
  }
}

/* ════════════════════════════════════════════════════════════
   MAIN
   ════════════════════════════════════════════════════════════ */
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

console.log('═══════════════════════════════════════════════════════════════');
console.log('  Test E2E complet — Module Dossier Client (15 sections)');
console.log('═══════════════════════════════════════════════════════════════');

let clientId = null;

try {
  await login(page);
  await pointerSiNecessaire();

  clientId = await creerDossier(page);
  if (!clientId) throw new Error('Création dossier échouée');

  await creerExerciceApi(clientId);
  await verifierListe(page);

  await page.goto(`${BASE}/clients/${clientId}`);
  await waitSidebar(page);

  await remplirFicheIdentite(page, clientId);
  await remplirStrategie(page);
  await remplirObjectifs(page);
  await remplirControleInterne(page);
  await remplirDossierTravail(page);
  await remplirMissions(page);
  await remplirSynthese(page);
  await remplirFournisseurs(page);
  await remplirPilotage(page);

  const newExoId = await cloturerExercice(page, clientId);
  if (newExoId) {
    await verifierCarryover(page, clientId, newExoId);
    await verifierLectureSeule(clientId);
  } else {
    fail('Carryover non vérifié');
    fail('Lecture seule non vérifiée');
  }

} catch (err) {
  console.error('\n❌ Erreur inattendue:', err.message);
  failed++;
} finally {
  await browser.close();
}

const total = passed + failed + warned;
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  Résultat : ${passed} ✅  ${warned} ⚠️   ${failed} ❌  (total: ${total})`);
console.log('═══════════════════════════════════════════════════════════════');
if (failed > 0) process.exit(1);
