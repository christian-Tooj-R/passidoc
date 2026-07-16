/**
 * Test E2E complet — Reprise de données inter-exercices
 *
 * Scénario :
 *   1. Saisir des données via l'interface sur le client 2 (exercice 3 OUVERT)
 *      → Stratégie (SWOT + Porter + BMC), Objectifs, Contrôle Interne, Dossier de travail
 *   2. Clôturer l'exercice via le bouton UI
 *   3. Vérifier (API + UI) que le nouvel exercice contient les données reprises
 */
import { chromium } from '/datas/Projets/Aro/backend/node_modules/playwright/index.mjs';

const BASE  = 'http://localhost:4200';
const API   = 'http://localhost:3000/api';
const EMAIL = 'admin@afym.re';
const PWD   = 'Admin1234!';
const CLIENT_ID  = 2;   // Client 2
const EXO_SOURCE = 6;   // exercice OUVERT à remplir puis clôturer

let passed = 0; let failed = 0; let warned = 0;
const pass = m => { console.log(`  ✅ ${m}`); passed++; };
const fail = m => { console.log(`  ❌ ${m}`); failed++; };
const warn = m => { console.log(`  ⚠️  ${m}`); warned++; };

/* ── helpers ─────────────────────────────────────────────────────── */
async function apiAuth() {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PWD }),
  });
  return (await r.json()).access_token;
}
async function apiGet(token, path) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return r.json();
}

async function login(page) {
  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PWD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  pass('Connexion réussie');
}

async function pointerAdminViaApi() {
  // Pointer l'admin via API pour éviter le modal pointage (guard disableClose)
  // Vérifie d'abord le statut pour ne pas créer une pause involontaire
  try {
    const { access_token } = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, password: PWD }),
    }).then(r => r.json());

    const statut = await fetch(`${API}/pointage/mon-statut`, {
      headers: { Authorization: `Bearer ${access_token}` },
    }).then(r => r.json());

    if (statut.estPointe) {
      pass('Admin déjà pointé (estPointe=true, guard bypassed)');
      return;
    }

    const r = await fetch(`${API}/pointage/pointer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (r.status === 201 || r.status === 200) pass('Pointage admin effectué via API (guard bypassed)');
    else warn(`Pointage API status=${r.status}`);
  } catch (e) { warn('Erreur pointage API: '+e.message); }
}

async function closeAnyModal(page) {
  // Fermer tout modal CDK ouvert (ex: modal de pointage auto-ouvert)
  const backdrop = page.locator('.cdk-overlay-backdrop').first();
  if (await backdrop.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
}

async function goToTab(page, tabLabel, groupLabel = 'Analyse') {
  // Fermer un éventuel modal avant navigation
  await closeAnyModal(page);
  // Attendre que le sidebar soit chargé (données client présentes)
  await page.waitForSelector('button.sidenav__item', { timeout: 12000 }).catch(() => {});
  const tab = page.locator('button.sidenav__item').filter({ hasText: tabLabel }).first();
  await tab.waitFor({ state: 'visible', timeout: 8000 });
  await tab.click();
  await page.waitForTimeout(700);
}

async function getSnackbar(page, timeout = 5000) {
  try {
    const s = page.locator('mat-snack-bar-container, simple-snack-bar, .mat-mdc-snack-bar-container').first();
    await s.waitFor({ state: 'visible', timeout });
    return await s.textContent();
  } catch { return null; }
}

async function saveAndCheck(page, label) {
  const snack = await getSnackbar(page, 5000);
  if (snack && snack.length > 2) pass(`Sauvegarde "${label}" confirmée — snackbar: "${snack.trim().slice(0, 50)}"`);
  else                            warn(`Pas de snackbar après sauvegarde "${label}"`);
}

/* ════════════════════════════════════════════════════════════════════
   PHASE 1 — Saisie via UI
   ════════════════════════════════════════════════════════════════════ */

/* ── Section 1 : Stratégie (SWOT + Porter + BMC) ─────────────────── */
async function saisirStrategie(page) {
  console.log('\n[1] UI — Saisie Analyse Stratégique');
  await page.goto(`${BASE}/clients/${CLIENT_ID}`);
  await page.waitForSelector('app-client-detail', { timeout: 10000 });
  await page.waitForTimeout(1000); // laisser le temps aux modals éventuels de s'ouvrir
  await closeAnyModal(page);
  await goToTab(page, 'Stratégie');

  // ── SWOT ──
  // Forces
  const forcesTA = page.locator('.swot-forces textarea, .swot-card--forces textarea').first();
  if (await forcesTA.isVisible().catch(() => false)) {
    await forcesTA.fill('Expertise médicale reconnue\nPatientèle fidèle depuis 20 ans\nÉquipe pluridisciplinaire de 4 praticiens');
    pass('SWOT Forces rempli');
  } else { warn('SWOT Forces textarea non trouvé'); }

  // Faiblesses
  const faibTA = page.locator('.swot-faiblesses textarea, .swot-card--faiblesses textarea').first();
  if (await faibTA.isVisible().catch(() => false)) {
    await faibTA.fill('Locaux vieillissants à rénover\nAbsence de présence digitale\nPas de site web ni de prise de rdv en ligne');
    pass('SWOT Faiblesses rempli');
  } else { warn('SWOT Faiblesses textarea non trouvé'); }

  // Opportunités
  const oppTA = page.locator('.swot-opportunites textarea, .swot-card--opportunites textarea').first();
  if (await oppTA.isVisible().catch(() => false)) {
    await oppTA.fill('Croissance du marché de la santé\nOpportunités de téléconsultation\nDéveloppement partenariats inter-cabinets');
    pass('SWOT Opportunités rempli');
  } else { warn('SWOT Opportunités textarea non trouvé'); }

  // Menaces
  const menTA = page.locator('.swot-menaces textarea, .swot-card--menaces textarea').first();
  if (await menTA.isVisible().catch(() => false)) {
    await menTA.fill('Désertification médicale régionale\nConcurrence des grands groupes de santé');
    pass('SWOT Menaces rempli');
  } else { warn('SWOT Menaces textarea non trouvé'); }

  // ── Porter : expand le panel "5 Forces de Porter" puis remplir le 1er champ (Concurrence) ──
  const porterHeader = page.locator('app-analyse-strategique-tab mat-expansion-panel-header').filter({ hasText: /5 Forces de Porter/ }).first();
  if (await porterHeader.count() > 0) {
    await porterHeader.scrollIntoViewIfNeeded();
    const porterPanel = page.locator('app-analyse-strategique-tab mat-expansion-panel').filter({ hasText: /5 Forces de Porter/ }).first();
    const isExpanded = await porterPanel.getAttribute('class').then(c => c?.includes('mat-expanded')).catch(() => false);
    if (!isExpanded) await porterHeader.click();
    await page.waitForTimeout(400);
    const porterConc = page.locator('app-analyse-strategique-tab .porter-grid mat-form-field').nth(0).locator('textarea');
    if (await porterConc.count() > 0) {
      await porterConc.scrollIntoViewIfNeeded();
      await porterConc.fill('Concurrence modérée — 3 cabinets similaires dans un rayon de 10 km. Positionnement spécialisé protecteur.');
      pass('Porter Concurrence rempli');
    } else { warn('Porter Concurrence textarea introuvable après ouverture du panel'); }
  } else { warn('Panel "5 Forces de Porter" non trouvé'); }

  // ── BMC : expand le panel "Business Model Canvas" puis remplir le textarea ──
  const bmcHeader = page.locator('app-analyse-strategique-tab mat-expansion-panel-header').filter({ hasText: /Business Model Canvas/ }).first();
  if (await bmcHeader.count() > 0) {
    await bmcHeader.scrollIntoViewIfNeeded();
    const bmcPanel = page.locator('app-analyse-strategique-tab mat-expansion-panel').filter({ hasText: /Business Model Canvas/ }).first();
    const isBmcExpanded = await bmcPanel.getAttribute('class').then(c => c?.includes('mat-expanded')).catch(() => false);
    if (!isBmcExpanded) await bmcHeader.click();
    await page.waitForTimeout(400);
    const bmcTA = page.locator('app-analyse-strategique-tab mat-expansion-panel').filter({ hasText: /Business Model Canvas/ }).locator('textarea').first();
    if (await bmcTA.count() > 0) {
      await bmcTA.scrollIntoViewIfNeeded();
      await bmcTA.fill('Proposition de valeur : soins spécialisés de qualité et disponibilité. Segments clients : patients et mutuelles. Canaux : cabinet physique et réseau médecins traitants. Revenus : honoraires et dépassements.');
      pass('Business Model Canvas rempli');
    } else { warn('BMC textarea introuvable après ouverture du panel'); }
  } else { warn('Panel "Business Model Canvas" non trouvé'); }

  // ── Sauvegarder ──
  const saveBtn = page.locator('app-analyse-strategique-tab button[color="primary"]').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await saveAndCheck(page, 'Stratégie');
  } else { warn('Bouton Enregistrer Stratégie non trouvé'); }
}

/* ── Section 2 : Objectifs ───────────────────────────────────────── */
async function saisirObjectifs(page) {
  console.log('\n[2] UI — Saisie Objectifs');
  await goToTab(page, 'Objectifs');

  const fields = [
    { name: 'objectifs12mois',    val: 'Augmenter le chiffre affaires de 10% via consultations spécialisées. Recruter un assistant médical.' },
    { name: 'objectifs3a5ans',    val: 'Ouvrir une antenne secondaire dans la commune voisine dici 3 ans.' },
    { name: 'objectifsLongTerme', val: 'Devenir cabinet de référence départemental en médecine générale et spécialisée.' },
    { name: 'attentesClient',     val: 'Optimisation fiscale. Accompagnement dans la transmission du cabinet. Structuration patrimoniale.' },
    { name: 'qualiteRelation',    val: 'Excellente — réunion trimestrielle systématique depuis 12 ans.' },
    { name: 'axesAmelioration',   val: 'Améliorer la réactivité sur les dossiers urgents. Digitaliser les échanges de documents.' },
    { name: 'recommandationsFaites', val: 'Mise en place PEE pour salariés. Restructuration des charges de loyer.' },
    { name: 'relationCollaborateur', val: 'Dr Renard très disponible. Dr Moreau délègue à son assistante pour les questions courantes.' },
  ];

  let filledCount = 0;
  for (const { name, val } of fields) {
    const el = page.locator(`[formcontrolname="${name}"]`).first();
    if (await el.isVisible().catch(() => false)) {
      await el.clear();
      await el.fill(val);
      filledCount++;
    }
  }

  // depuisQuand (input)
  const depuisQuand = page.locator('[formcontrolname="depuisQuand"]').first();
  if (await depuisQuand.isVisible().catch(() => false)) {
    await depuisQuand.clear();
    await depuisQuand.fill('12 ans');
    filledCount++;
  }

  if (filledCount >= 5) pass(`${filledCount} champs Objectifs remplis`);
  else                   warn(`Seulement ${filledCount} champs Objectifs remplis`);

  const saveBtn = page.locator('app-objectifs-tab button[color="primary"]').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await saveAndCheck(page, 'Objectifs');
  } else { warn('Bouton Enregistrer Objectifs non trouvé'); }
}

/* ── Section 3 : Contrôle Interne ───────────────────────────────── */
async function saisirControleInterne(page) {
  console.log('\n[3] UI — Saisie Contrôle Interne');
  await goToTab(page, 'Contrôle Interne');

  // Note générale (ngModel direct)
  const noteTA = page.locator('app-controle-interne-tab textarea[matInput], app-controle-interne-tab textarea').last();
  if (await noteTA.isVisible().catch(() => false)) {
    await noteTA.fill('Contrôle interne globalement satisfaisant. Les procédures comptables sont formalisées et respectées. Quelques points à améliorer sur la validation des notes de frais.');
    pass('Note générale Contrôle Interne remplie');
  } else { warn('Note générale Contrôle Interne non trouvée'); }

  // Ajouter un process OK — bouton mat-icon-button avec icône "add" dans .section-header--green
  const addOkBtn = page.locator('app-controle-interne-tab .section-header--green button[mat-icon-button]').first();
  if (await addOkBtn.isVisible().catch(() => false)) {
    await addOkBtn.click();
    await page.waitForTimeout(300);
    const processInput = page.locator('app-controle-interne-tab .process-row--green .process-input').first();
    if (await processInput.isVisible().catch(() => false)) {
      await processInput.fill('Saisie comptable quotidienne et réconciliation bancaire mensuelle');
      pass('Process OK ajouté et rempli');
    } else { warn('Input process OK non trouvé après ajout'); }
  } else { warn('Bouton add process OK (.section-header--green button) non trouvé'); }

  const saveBtn = page.locator('app-controle-interne-tab button[color="primary"]').first();
  if (await saveBtn.isVisible().catch(() => false)) {
    await saveBtn.click();
    await saveAndCheck(page, 'Contrôle Interne');
  } else { warn('Bouton Enregistrer Contrôle Interne non trouvé'); }
}

/* ── Section 4 : Dossier de travail ─────────────────────────────── */
async function saisirDossierTravail(page) {
  console.log('\n[4] UI — Saisie Dossier de travail');
  await goToTab(page, 'Dossier de travail');

  // Note de synthèse
  const noteTA = page.locator('app-dossier-travail-tab textarea.dt-textarea--synthese').first();
  await noteTA.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
  if (await noteTA.isVisible().catch(() => false)) {
    await noteTA.fill('SA Le Lagon Bleu — exercice 2026. Situation financière saine, CA en progression de 8%. Attention charges personnel (+5%). Points vigilance : désertification et concurrence nouvelle clinique privée.');
    pass('Note de synthèse Dossier de travail remplie');
  } else { warn('Note de synthèse textarea non trouvée'); }

  // Sauvegarder la note
  const saveNoteBtn = page.locator('app-dossier-travail-tab .dt-section--synthese .dt-save-btn').first();
  if (await saveNoteBtn.isVisible().catch(() => false)) {
    await saveNoteBtn.click();
    await saveAndCheck(page, 'Note de synthèse');
  } else { warn('Bouton save note de synthèse non trouvé'); }

  // Cycle VENTE (actif par défaut)
  const diligTA = page.locator('app-dossier-travail-tab .dt-cycle-content textarea').first();
  if (await diligTA.isVisible().catch(() => false)) {
    await diligTA.fill('Vérification honoraires encaissés vs facturés. Contrôle des remboursements mutuelles. Revue des dépassements honoraires.');
    pass('Diligences cycle Ventes remplies');
  } else { warn('Textarea diligences Ventes non trouvée'); }

  const saveCycleBtn = page.locator('app-dossier-travail-tab .dt-cycle-content .dt-save-btn').first();
  if (await saveCycleBtn.isVisible().catch(() => false)) {
    await saveCycleBtn.click();
    await saveAndCheck(page, 'Cycle Ventes');
  } else { warn('Bouton save cycle Ventes non trouvé'); }
}

/* ════════════════════════════════════════════════════════════════════
   PHASE 2 — Clôture via UI
   ════════════════════════════════════════════════════════════════════ */
async function cloturerExercice(page) {
  console.log('\n[5] UI — Clôture de l\'exercice');

  // Le bouton de clôture est dans l'en-tête du client-detail
  const clotureBtn = page.locator('.eb-btn-cloture').first();
  await clotureBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

  if (!await clotureBtn.isVisible().catch(() => false)) {
    fail('Bouton "Clôturer l\'exercice" non trouvé');
    return null;
  }
  pass('Bouton "Clôturer l\'exercice" visible');

  // Intercepter le confirm() natif du navigateur et l'accepter
  let dialogHandled = false;
  page.once('dialog', async dialog => {
    const msg = dialog.message();
    if (msg.includes('Clôturer') || msg.includes('clotur') || msg.includes('nouvel exercice')) {
      pass(`Confirm dialog affiché: "${msg.slice(0, 80)}"`);
      await dialog.accept();
      dialogHandled = true;
    } else {
      await dialog.accept();
      warn(`Dialog inattendu: "${msg.slice(0, 60)}"`);
    }
  });

  await clotureBtn.click();
  await page.waitForTimeout(3000); // attendre la réponse API + rechargement

  if (!dialogHandled) warn('Dialog confirm non détecté (peut être auto-accepté)');

  // Vérifier que l'exercice courant est maintenant le NOUVEAU (OUVERT)
  const snack = await getSnackbar(page, 4000);
  if (snack) pass(`Snackbar clôture: "${snack.trim().slice(0, 60)}"`);
  else        warn('Pas de snackbar après clôture');

  // L'URL doit toujours pointer sur le client, exercice courant = nouveau
  const token = await apiAuth();
  const exos = await apiGet(token, `/clients/${CLIENT_ID}/exercices`);
  const closed = exos.find(e => e.id === EXO_SOURCE);
  const newExo  = exos.find(e => e.statut === 'OUVERT');

  if (closed?.statut === 'CLOTURE') pass(`Exercice ${EXO_SOURCE} bien clôturé`);
  else                               fail(`Exercice ${EXO_SOURCE} statut: ${closed?.statut}`);

  if (newExo) pass(`Nouvel exercice créé — id=${newExo.id}, annee=${newExo.annee}, statut=${newExo.statut}`);
  else        fail('Aucun nouvel exercice OUVERT trouvé après clôture');

  return newExo?.id ?? null;
}

/* ════════════════════════════════════════════════════════════════════
   PHASE 3 — Vérification carryover via API
   ════════════════════════════════════════════════════════════════════ */
async function verifierCarryoverAPI(newExoId) {
  console.log(`\n[6] API — Vérification carryover (nouvel exercice id=${newExoId})`);
  const token = await apiAuth();

  // ── Analyse Stratégique ──
  const strategie = await apiGet(token, `/clients/${CLIENT_ID}/analyse?exerciceId=${newExoId}`);
  if (strategie?.forces?.length >= 3)
    pass(`Analyse Strat. — SWOT Forces repris (${strategie.forces.length} éléments)`);
  else
    fail(`Analyse Strat. — Forces manquantes: ${JSON.stringify(strategie?.forces)}`);

  if (strategie?.faiblesses?.length >= 2)
    pass(`Analyse Strat. — Faiblesses reprises (${strategie.faiblesses.length})`);
  else
    fail('Analyse Strat. — Faiblesses manquantes');

  if (strategie?.opportunites?.length >= 2)
    pass(`Analyse Strat. — Opportunités reprises (${strategie.opportunites.length})`);
  else
    fail('Analyse Strat. — Opportunités manquantes');

  if (strategie?.porterConcurrence?.length > 10)
    pass(`Analyse Strat. — Porter Concurrence repris: "${strategie.porterConcurrence.slice(0,50)}"`);
  else
    fail('Analyse Strat. — Porter Concurrence manquant');

  if (strategie?.businessModelCanvas?.length > 10)
    pass('Analyse Strat. — BMC repris');
  else
    fail('Analyse Strat. — BMC manquant');

  // ── Objectifs ──
  const objectifs = await apiGet(token, `/clients/${CLIENT_ID}/objectifs?exerciceId=${newExoId}`);
  if (objectifs?.objectifs12mois?.length > 10)
    pass(`Objectifs — 12 mois repris: "${objectifs.objectifs12mois.slice(0,50)}"`);
  else
    fail('Objectifs — objectifs12mois manquants');

  if (objectifs?.objectifs3a5ans?.length > 5)
    pass('Objectifs — 3-5 ans repris');
  else
    fail('Objectifs — objectifs3a5ans manquants');

  if (objectifs?.attentesClient?.length > 5)
    pass('Objectifs — Attentes client reprises');
  else
    fail('Objectifs — attentesClient manquant');

  if (objectifs?.qualiteRelation?.length > 5)
    pass('Objectifs — Qualité relation reprise');
  else
    fail('Objectifs — qualiteRelation manquant');

  // ── Contrôle Interne ──
  const ci = await apiGet(token, `/clients/${CLIENT_ID}/controle-interne?exerciceId=${newExoId}`);
  if (ci?.noteGenerale?.includes('[Repris'))
    pass(`Contrôle Interne — note reprise avec marqueur "[Repris": "${ci.noteGenerale.slice(0,60)}"`);
  else if (ci?.noteGenerale?.length > 10)
    pass(`Contrôle Interne — note reprise (sans marqueur): "${ci.noteGenerale.slice(0,60)}"`);
  else
    fail('Contrôle Interne — noteGenerale manquante');

  if (ci?.processOk?.length >= 1)
    pass(`Contrôle Interne — ${ci.processOk.length} process OK repris`);
  else
    warn('Contrôle Interne — processOk vide (vérifier la saisie UI)');

  // ── Dossier de Travail ──
  const dossier = await apiGet(token, `/clients/${CLIENT_ID}/dossier-travail?exerciceId=${newExoId}`);
  if (dossier?.noteSynthese?.length > 10)
    pass(`Dossier Travail — note synthèse reprise: "${dossier.noteSynthese.slice(0,60)}"`);
  else
    fail('Dossier Travail — noteSynthese manquante');

  if (dossier?.cycles?.length === 3)
    pass('Dossier Travail — 3 cycles créés pour le nouvel exercice');
  else
    fail(`Dossier Travail — ${dossier?.cycles?.length} cycle(s) au lieu de 3`);

  // Les cycles doivent être VIERGES (pas de carryover des diligences)
  const vente = dossier?.cycles?.find(c => c.typeCycle === 'VENTE');
  if (!vente?.diligences || vente.diligences === '')
    pass('Dossier Travail — cycle VENTE vierge (diligences non reprises)');
  else
    warn(`Dossier Travail — diligences VENTE non vides: "${vente.diligences.slice(0,40)}"`);

  if (vente?.pourcentageCouverture === 0)
    pass('Dossier Travail — taux couverture VENTE remis à 0%');
  else
    warn(`Dossier Travail — taux VENTE = ${vente?.pourcentageCouverture}% (devrait être 0)`);

  return { strategie, objectifs, ci, dossier };
}

/* ════════════════════════════════════════════════════════════════════
   PHASE 4 — Vérification carryover via UI
   ════════════════════════════════════════════════════════════════════ */
async function verifierCarryoverUI(page, newExoId) {
  console.log(`\n[7] UI — Vérification affichage carryover (nouvel exercice id=${newExoId})`);

  // Naviguer explicitement vers le client (après clôture, la page peut être dans un état intermédiaire)
  await page.goto(`${BASE}/clients/${CLIENT_ID}`);
  await page.waitForSelector('app-client-detail', { timeout: 15000 });
  await page.waitForTimeout(2000); // laisser Angular charger le nouvel exercice

  // ── Stratégie ──
  await goToTab(page, 'Stratégie');
  const forcesTA = page.locator('.swot-forces textarea, .swot-card--forces textarea').first();
  if (await forcesTA.isVisible().catch(() => false)) {
    const val = await forcesTA.inputValue().catch(() => '');
    if (val.length > 5) pass(`Stratégie — SWOT Forces affiché dans nouvel exercice (${val.length} chars)`);
    else                 fail('Stratégie — SWOT Forces vide dans UI');
  } else {
    warn('Stratégie — textarea SWOT Forces non trouvé pour vérification');
  }

  const bmcTA = page.locator('[formcontrolname="businessModelCanvas"]').first();
  if (await bmcTA.isVisible().catch(() => false)) {
    const val = await bmcTA.inputValue().catch(() => '');
    if (val.length > 5) pass(`Stratégie — BMC affiché dans nouvel exercice`);
    else                 fail('Stratégie — BMC vide dans UI');
  }

  // ── Objectifs ──
  await goToTab(page, 'Objectifs');
  const obj12 = page.locator('[formcontrolname="objectifs12mois"]').first();
  if (await obj12.isVisible().catch(() => false)) {
    const val = await obj12.inputValue().catch(() => '');
    if (val.length > 5) pass(`Objectifs — 12 mois affiché dans UI: "${val.slice(0,50)}"`);
    else                 fail('Objectifs — objectifs12mois vide dans UI');
  } else {
    warn('Objectifs — champ objectifs12mois non trouvé');
  }

  // ── Contrôle Interne ──
  await goToTab(page, 'Contrôle Interne');
  const ciNote = page.locator('app-controle-interne-tab textarea').last();
  if (await ciNote.isVisible().catch(() => false)) {
    const val = await ciNote.inputValue().catch(() => '');
    if (val.length > 5) pass(`Contrôle Interne — note affichée dans UI: "${val.slice(0,50)}"`);
    else                 fail('Contrôle Interne — note vide dans UI');
  } else {
    warn('Contrôle Interne — textarea note non trouvé');
  }

  // ── Dossier de Travail ──
  await goToTab(page, 'Dossier de travail');
  const noteTA = page.locator('app-dossier-travail-tab textarea.dt-textarea--synthese').first();
  await noteTA.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
  if (await noteTA.isVisible().catch(() => false)) {
    const val = await noteTA.inputValue().catch(() => '');
    if (val.length > 5) pass(`Dossier Travail — note synthèse affichée (${val.length} chars)`);
    else                 fail('Dossier Travail — note synthèse vide dans UI');
  } else {
    warn('Dossier Travail — textarea note synthèse non trouvé');
  }

  // Vérifier que les cycles sont bien vierges (pas de carryover des diligences)
  const diligTA = page.locator('app-dossier-travail-tab .dt-cycle-content textarea').first();
  if (await diligTA.isVisible().catch(() => false)) {
    const val = await diligTA.inputValue().catch(() => '');
    if (!val || val.length === 0) pass('Dossier Travail — diligences vierges sur nouvel exercice');
    else                           warn(`Dossier Travail — diligences non vierges: "${val.slice(0,40)}"`);
  }
}

/* ════════════════════════════════════════════════════════════════════
   PHASE 5 — Vérification exercice clôturé = lecture seule
   ════════════════════════════════════════════════════════════════════ */
async function verifierLectureSeule(page) {
  console.log('\n[8] UI — Exercice source (clôturé) = lecture seule');

  // Via API: récupérer l'exercice source et forcer l'affichage
  // Le composant client-detail montre l'exercice COURANT (OUVERT)
  // Vérifier via API que le PATCH sur exercice clôturé est bloqué
  const token = await apiAuth();

  const patchStrat = await fetch(`${API}/clients/${CLIENT_ID}/analyse?exerciceId=${EXO_SOURCE}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ forces: ['tentative modification'] }),
  });
  if (patchStrat.status === 403)
    pass('API — PATCH Stratégie sur exercice clôturé refusé (403)');
  else
    fail(`API — PATCH Stratégie devrait être 403, reçu ${patchStrat.status}`);

  const patchObj = await fetch(`${API}/clients/${CLIENT_ID}/objectifs?exerciceId=${EXO_SOURCE}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectifs12mois: 'modification interdite' }),
  });
  if (patchObj.status === 403)
    pass('API — PATCH Objectifs sur exercice clôturé refusé (403)');
  else
    fail(`API — PATCH Objectifs devrait être 403, reçu ${patchObj.status}`);

  const patchCI = await fetch(`${API}/clients/${CLIENT_ID}/controle-interne?exerciceId=${EXO_SOURCE}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ noteGenerale: 'modification interdite' }),
  });
  if (patchCI.status === 403)
    pass('API — PATCH Contrôle Interne sur exercice clôturé refusé (403)');
  else
    fail(`API — PATCH Contrôle Interne devrait être 403, reçu ${patchCI.status}`);

  const patchDT = await fetch(`${API}/clients/${CLIENT_ID}/dossier-travail/cycles/VENTE?exerciceId=${EXO_SOURCE}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pourcentageCouverture: 99 }),
  });
  if (patchDT.status === 403)
    pass('API — PATCH Dossier Travail sur exercice clôturé refusé (403)');
  else
    fail(`API — PATCH Dossier Travail devrait être 403, reçu ${patchDT.status}`);
}

/* ════════════════════════════════════════════════════════════════════
   PHASE 6 — Cohérence : données source intactes après clôture
   ════════════════════════════════════════════════════════════════════ */
async function verifierSourceIntacte() {
  console.log('\n[9] API — Données source intactes après clôture');
  const token = await apiAuth();

  const strat = await apiGet(token, `/clients/${CLIENT_ID}/analyse?exerciceId=${EXO_SOURCE}`);
  if (strat?.forces?.length >= 2)
    pass(`Source Stratégie intacte — ${strat.forces.length} forces`);
  else
    fail('Source Stratégie altérée après clôture');

  const obj = await apiGet(token, `/clients/${CLIENT_ID}/objectifs?exerciceId=${EXO_SOURCE}`);
  if (obj?.objectifs12mois?.length > 5)
    pass('Source Objectifs intacts');
  else
    fail('Source Objectifs altérés après clôture');

  const dt = await apiGet(token, `/clients/${CLIENT_ID}/dossier-travail?exerciceId=${EXO_SOURCE}`);
  if (dt?.cycles?.find(c => c.typeCycle === 'VENTE')?.diligences?.length > 5)
    pass('Source Dossier Travail intact — diligences VENTE présentes');
  else
    warn('Source Dossier Travail — diligences VENTE absentes (vérifier la saisie UI)');
}

/* ════════════════════════════════════════════════════════════════════
   MAIN
   ════════════════════════════════════════════════════════════════════ */
const browser = await chromium.launch({ headless: true });
const ctx     = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page    = await ctx.newPage();

console.log('═══════════════════════════════════════════════════════════════');
console.log('  Test E2E — Reprise de données inter-exercices');
console.log('  Client : id=2');
console.log('  Exercice source : id=6 (OUVERT → sera clôturé)');
console.log('═══════════════════════════════════════════════════════════════');

try {
  // ── Phase 1 : Saisie via UI ──
  await login(page);
  await pointerAdminViaApi();  // évite le modal pointage (guard disableClose: true)
  await saisirStrategie(page);
  await saisirObjectifs(page);
  await saisirControleInterne(page);
  await saisirDossierTravail(page);

  // ── Phase 2 : Clôture ──
  const newExoId = await cloturerExercice(page);

  if (!newExoId) {
    fail('Impossible de continuer sans le nouvel exercice');
  } else {
    // ── Phase 3 : Vérification carryover API ──
    await verifierCarryoverAPI(newExoId);

    // ── Phase 4 : Vérification carryover UI ──
    await verifierCarryoverUI(page, newExoId);

    // ── Phase 5 : Lecture seule ──
    await verifierLectureSeule(page);

    // ── Phase 6 : Source intacte ──
    await verifierSourceIntacte();
  }

} catch (err) {
  console.error('\nErreur inattendue:', err.message);
  failed++;
} finally {
  await browser.close();
}

const total = passed + failed + warned;
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  Résultat : ${passed} ✅  ${warned} ⚠️   ${failed} ❌  (total: ${total})`);
console.log('═══════════════════════════════════════════════════════════════');
if (failed > 0) process.exit(1);
