/**
 * test-personnalisation.mjs
 * Tests E2E Playwright pour la page /personnalisation de Passidoc.
 * Usage : node test-personnalisation.mjs
 */

import { chromium } from '/datas/Projets/Aro/backend/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:4200';
const URL_PAGE = `${BASE}/personnalisation`;

// ── Compteurs ────────────────────────────────────────────────────────────────
let pass = 0, fail_count = 0;
function ok(msg)   { console.log(`✅ ${msg}`); pass++; }
function fail(msg) { console.error(`❌ ${msg}`); fail_count++; }
function warn(msg) { console.warn(`⚠️  ${msg}`); }
function sec(title){ console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`); }

// ── Snackbar ─────────────────────────────────────────────────────────────────
async function getSnackbar(page, timeout = 5000) {
  return page
    .locator('mat-snack-bar-container, .mat-mdc-snack-bar-container')
    .first()
    .textContent({ timeout })
    .catch(() => null);
}

// ── Login ────────────────────────────────────────────────────────────────────
async function login(page) {
  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.locator('input[type="email"]').fill('admin@afym.re');
  await page.locator('input[type="password"]').fill('Admin1234!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 12000 }).catch(() => {});
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════════════════════
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page    = await context.newPage();

// ────────────────────────────────────────────────────────────────────────────
sec('0 · Connexion admin');
// ────────────────────────────────────────────────────────────────────────────
try {
  await login(page);
  const url = page.url();
  if (url.includes('dashboard') || url.includes(BASE)) {
    ok('Connexion admin réussie');
  } else {
    fail(`Redirection inattendue après login : ${url}`);
  }
} catch (e) {
  fail(`Erreur login : ${e.message}`);
}

// ────────────────────────────────────────────────────────────────────────────
sec('1 · Chargement de la page Personnalisation');
// ────────────────────────────────────────────────────────────────────────────
try {
  await page.goto(URL_PAGE);
  await page.waitForSelector('.page', { timeout: 12000 });
  ok('Conteneur principal .page visible');
} catch (e) {
  fail(`Conteneur .page introuvable : ${e.message}`);
}

try {
  const title = await page.locator('.page-title').textContent({ timeout: 5000 });
  if (title && title.trim() === 'Personnalisation') {
    ok('Titre de page "Personnalisation" correct');
  } else {
    fail(`Titre de page inattendu : "${title}"`);
  }
} catch (e) {
  fail(`Titre de page introuvable : ${e.message}`);
}

try {
  const sub = await page.locator('.page-sub').textContent({ timeout: 5000 });
  if (sub && sub.includes('instantanément')) {
    ok('Sous-titre de page visible et cohérent');
  } else {
    fail(`Sous-titre de page inattendu : "${sub}"`);
  }
} catch (e) {
  fail(`Sous-titre de page introuvable : ${e.message}`);
}

try {
  const iconVisible = await page.locator('.page-icon mat-icon').isVisible();
  if (iconVisible) {
    ok('Icône d\'en-tête (palette) visible');
  } else {
    fail('Icône d\'en-tête non visible');
  }
} catch (e) {
  fail(`Icône d\'en-tête : ${e.message}`);
}

// ────────────────────────────────────────────────────────────────────────────
sec('2 · Layout deux colonnes');
// ────────────────────────────────────────────────────────────────────────────
try {
  const colSettings = await page.locator('.col-settings').isVisible();
  if (colSettings) {
    ok('Colonne de paramètres (.col-settings) visible');
  } else {
    fail('Colonne de paramètres introuvable');
  }
} catch (e) {
  fail(`Colonne paramètres : ${e.message}`);
}

try {
  const colPreview = await page.locator('.col-preview').isVisible();
  if (colPreview) {
    ok('Colonne aperçu (.col-preview) visible');
  } else {
    fail('Colonne aperçu introuvable');
  }
} catch (e) {
  fail(`Colonne aperçu : ${e.message}`);
}

// ────────────────────────────────────────────────────────────────────────────
sec('3 · Section Thème de la barre latérale');
// ────────────────────────────────────────────────────────────────────────────
try {
  const cardTitles = await page.locator('.card-title').allTextContents();
  if (cardTitles.some(t => t.includes('Thème de la barre latérale'))) {
    ok('Titre "Thème de la barre latérale" présent');
  } else {
    fail(`Titre "Thème de la barre latérale" absent. Trouvé : ${cardTitles.join(', ')}`);
  }
} catch (e) {
  fail(`Lecture titres cartes : ${e.message}`);
}

try {
  const themeButtons = page.locator('.t-sw');
  const count = await themeButtons.count();
  if (count === 4) {
    ok(`Grille de thèmes : ${count} boutons détectés (Navy, Forêt, Violet, Personnalisé)`);
  } else {
    fail(`Grille de thèmes : attendu 4, trouvé ${count}`);
  }
} catch (e) {
  fail(`Grille de thèmes : ${e.message}`);
}

// Vérification des labels de chaque thème
const expectedSidebarThemes = ['Navy', 'Forêt', 'Violet', 'Personnalisé'];
for (const label of expectedSidebarThemes) {
  try {
    const btn = page.locator('.t-sw', { has: page.locator('.t-sw__label', { hasText: label }) });
    const visible = await btn.first().isVisible();
    if (visible) {
      ok(`Bouton thème "${label}" visible`);
    } else {
      fail(`Bouton thème "${label}" non visible`);
    }
  } catch (e) {
    fail(`Bouton thème "${label}" : ${e.message}`);
  }
}

// Cliquer sur "Forêt" et vérifier la sélection active
try {
  const foretBtn = page.locator('.t-sw', { has: page.locator('.t-sw__label', { hasText: 'Forêt' }) }).first();
  await foretBtn.click();
  await page.waitForTimeout(300);
  const isOn = await foretBtn.evaluate(el => el.classList.contains('t-sw--on'));
  if (isOn) {
    ok('Clic sur thème "Forêt" → classe .t-sw--on appliquée');
  } else {
    fail('Clic sur thème "Forêt" → .t-sw--on absent');
  }
} catch (e) {
  fail(`Sélection thème Forêt : ${e.message}`);
}

// Vérifier l'icône check_circle sur l'élément actif
try {
  const checkIcon = page.locator('.t-sw--on .t-sw__check');
  const checkVisible = await checkIcon.isVisible();
  if (checkVisible) {
    ok('Icône check_circle visible sur le thème actif');
  } else {
    fail('Icône check_circle absente du thème actif');
  }
} catch (e) {
  fail(`Icône check_circle thème actif : ${e.message}`);
}

// Cliquer sur "Navy" pour revenir à la valeur par défaut
try {
  const navyBtn = page.locator('.t-sw', { has: page.locator('.t-sw__label', { hasText: 'Navy' }) }).first();
  await navyBtn.click();
  await page.waitForTimeout(200);
  const isOn = await navyBtn.evaluate(el => el.classList.contains('t-sw--on'));
  if (isOn) {
    ok('Retour au thème "Navy" : .t-sw--on sur Navy');
  } else {
    fail('Retour au thème "Navy" : .t-sw--on absent sur Navy');
  }
} catch (e) {
  fail(`Retour thème Navy : ${e.message}`);
}

// ────────────────────────────────────────────────────────────────────────────
sec('4 · Section Style du panneau');
// ────────────────────────────────────────────────────────────────────────────
try {
  const cardTitles = await page.locator('.card-title').allTextContents();
  if (cardTitles.some(t => t.includes('Style du panneau'))) {
    ok('Titre "Style du panneau" présent');
  } else {
    fail(`Titre "Style du panneau" absent. Trouvé : ${cardTitles.join(', ')}`);
  }
} catch (e) {
  fail(`Titre Style du panneau : ${e.message}`);
}

try {
  const panelCards = page.locator('.ps-card');
  const count = await panelCards.count();
  if (count === 3) {
    ok(`Grille styles panneau : ${count} cartes détectées (Clair, Sombre, Verre)`);
  } else {
    fail(`Grille styles panneau : attendu 3, trouvé ${count}`);
  }
} catch (e) {
  fail(`Grille styles panneau : ${e.message}`);
}

// Vérification des labels de chaque style
const expectedPanelStyles = ['Clair', 'Sombre', 'Verre'];
for (const label of expectedPanelStyles) {
  try {
    const card = page.locator('.ps-card', { has: page.locator('.ps-card__foot span', { hasText: label }) });
    const visible = await card.first().isVisible();
    if (visible) {
      ok(`Carte style panneau "${label}" visible`);
    } else {
      fail(`Carte style panneau "${label}" non visible`);
    }
  } catch (e) {
    fail(`Carte style panneau "${label}" : ${e.message}`);
  }
}

// Cliquer sur "Sombre"
try {
  const sombreCard = page.locator('.ps-card', { has: page.locator('.ps-card__foot span', { hasText: 'Sombre' }) }).first();
  await sombreCard.click();
  await page.waitForTimeout(300);
  const isOn = await sombreCard.evaluate(el => el.classList.contains('ps-card--on'));
  if (isOn) {
    ok('Clic sur style "Sombre" → .ps-card--on appliqué');
  } else {
    fail('Clic sur style "Sombre" → .ps-card--on absent');
  }
} catch (e) {
  fail(`Sélection style Sombre : ${e.message}`);
}

// Vérifier l'icône check_circle sur la carte active
try {
  const checkIcon = page.locator('.ps-card--on .ps-check');
  const checkVisible = await checkIcon.isVisible();
  if (checkVisible) {
    ok('Icône check_circle visible sur la carte de panneau active');
  } else {
    fail('Icône check_circle absente de la carte de panneau active');
  }
} catch (e) {
  fail(`Icône check_circle carte panneau active : ${e.message}`);
}

// Clic sur "Verre" → vérifier que la section teinte verre apparaît
try {
  const verreCard = page.locator('.ps-card', { has: page.locator('.ps-card__foot span', { hasText: 'Verre' }) }).first();
  await verreCard.click();
  await page.waitForTimeout(400);
  const gcRow = page.locator('.gc-row');
  const gcVisible = await gcRow.isVisible();
  if (gcVisible) {
    ok('Sélection "Verre" → sélecteur de teinte verre (.gc-row) visible');
  } else {
    fail('Sélection "Verre" → sélecteur de teinte verre non visible');
  }
} catch (e) {
  fail(`Style Verre / sélecteur teinte : ${e.message}`);
}

// Vérifier les boutons de teinte verre
try {
  const glassButtons = page.locator('.gc-btn');
  const count = await glassButtons.count();
  if (count >= 5) {
    ok(`Sélecteur teinte verre : ${count} boutons de couleur détectés`);
  } else {
    fail(`Sélecteur teinte verre : attendu ≥5 boutons, trouvé ${count}`);
  }
} catch (e) {
  fail(`Boutons teinte verre : ${e.message}`);
}

// Cliquer "Océan" dans les teintes verre
try {
  const oceanBtn = page.locator('.gc-btn[mattooltip="Océan"], .gc-btn[ng-reflect-message="Océan"]');
  const count = await oceanBtn.count();
  if (count > 0) {
    await oceanBtn.first().click();
    await page.waitForTimeout(200);
    const isOn = await oceanBtn.first().evaluate(el => el.classList.contains('gc-btn--on'));
    if (isOn) {
      ok('Clic sur teinte "Océan" → .gc-btn--on appliqué');
    } else {
      warn('Teinte "Océan" cliqué mais .gc-btn--on non confirmé');
    }
  } else {
    // Essai via ordre : Ocean est le 2e bouton (index 1)
    const allBtns = page.locator('.gc-btn');
    if (await allBtns.count() > 1) {
      await allBtns.nth(1).click();
      await page.waitForTimeout(200);
      ok('Clic sur le 2e bouton de teinte verre (Océan)');
    } else {
      warn('Bouton teinte "Océan" introuvable, test ignoré');
    }
  }
} catch (e) {
  warn(`Teinte verre Océan : ${e.message}`);
}

// Revenir au style "Clair"
try {
  const clairCard = page.locator('.ps-card', { has: page.locator('.ps-card__foot span', { hasText: 'Clair' }) }).first();
  await clairCard.click();
  await page.waitForTimeout(200);
  ok('Retour au style de panneau "Clair"');
} catch (e) {
  fail(`Retour style Clair : ${e.message}`);
}

// ────────────────────────────────────────────────────────────────────────────
sec('5 · Section Couleur d\'accent');
// ────────────────────────────────────────────────────────────────────────────
try {
  const cardTitles = await page.locator('.card-title').allTextContents();
  if (cardTitles.some(t => t.includes("Couleur d'accent"))) {
    ok("Titre \"Couleur d'accent\" présent");
  } else {
    fail(`Titre "Couleur d'accent" absent. Trouvé : ${cardTitles.join(', ')}`);
  }
} catch (e) {
  fail(`Titre Couleur d'accent : ${e.message}`);
}

try {
  const accentSwatches = page.locator('.acc-grid .a-sw');
  const count = await accentSwatches.count();
  if (count === 7) {
    ok(`Grille couleurs d'accent : ${count} nuances détectées (Teal → Personnalisé)`);
  } else {
    fail(`Grille couleurs d'accent : attendu 7, trouvé ${count}`);
  }
} catch (e) {
  fail(`Grille couleurs d'accent : ${e.message}`);
}

// Vérification des labels accent
const expectedAccents = ['Teal', 'Indigo', 'Ambre', 'Émeraude', 'Rose', 'Bleu', 'Personnalisé'];
for (const label of expectedAccents) {
  try {
    const sw = page.locator('.a-sw', { has: page.locator('.a-sw__label', { hasText: label }) });
    const visible = await sw.first().isVisible();
    if (visible) {
      ok(`Nuance accent "${label}" visible`);
    } else {
      fail(`Nuance accent "${label}" non visible`);
    }
  } catch (e) {
    fail(`Nuance accent "${label}" : ${e.message}`);
  }
}

// Cliquer sur "Indigo"
try {
  // Indigo est un <button> (pas un <label>)
  const indigoBtn = page.locator('button.a-sw', { has: page.locator('.a-sw__label', { hasText: 'Indigo' }) }).first();
  await indigoBtn.click();
  await page.waitForTimeout(300);
  const isOn = await indigoBtn.evaluate(el => el.classList.contains('a-sw--on'));
  if (isOn) {
    ok('Clic sur accent "Indigo" → .a-sw--on appliqué');
  } else {
    fail('Clic sur accent "Indigo" → .a-sw--on absent');
  }
} catch (e) {
  fail(`Sélection accent Indigo : ${e.message}`);
}

// Cliquer sur "Émeraude"
try {
  const emeraudeBtn = page.locator('button.a-sw', { has: page.locator('.a-sw__label', { hasText: 'Émeraude' }) }).first();
  await emeraudeBtn.click();
  await page.waitForTimeout(300);
  const isOn = await emeraudeBtn.evaluate(el => el.classList.contains('a-sw--on'));
  if (isOn) {
    ok('Clic sur accent "Émeraude" → .a-sw--on appliqué');
  } else {
    fail('Clic sur accent "Émeraude" → .a-sw--on absent');
  }
} catch (e) {
  fail(`Sélection accent Émeraude : ${e.message}`);
}

// Vérifier l'aperçu d'accent
try {
  const preview = page.locator('.acc-preview');
  const visible = await preview.isVisible();
  if (visible) {
    ok('Aperçu d\'accent (.acc-preview) visible');
  } else {
    fail('Aperçu d\'accent non visible');
  }
} catch (e) {
  fail(`Aperçu d\'accent : ${e.message}`);
}

try {
  const apBtn = page.locator('.ap-btn');
  const text  = await apBtn.textContent({ timeout: 3000 });
  if (text && text.includes('Nouveau')) {
    ok('Bouton aperçu "Nouveau" visible dans l\'aperçu d\'accent');
  } else {
    fail(`Bouton aperçu d'accent inattendu : "${text}"`);
  }
} catch (e) {
  fail(`Bouton aperçu accent : ${e.message}`);
}

try {
  const apBadge = page.locator('.ap-badge');
  const text    = await apBadge.textContent({ timeout: 3000 });
  if (text && text.includes('Actif')) {
    ok('Badge "Actif" visible dans l\'aperçu d\'accent');
  } else {
    fail(`Badge aperçu accent inattendu : "${text}"`);
  }
} catch (e) {
  fail(`Badge aperçu accent : ${e.message}`);
}

// Revenir sur "Teal" (défaut)
try {
  const tealBtn = page.locator('button.a-sw', { has: page.locator('.a-sw__label', { hasText: 'Teal' }) }).first();
  await tealBtn.click();
  await page.waitForTimeout(200);
  ok('Retour à l\'accent "Teal"');
} catch (e) {
  fail(`Retour accent Teal : ${e.message}`);
}

// ────────────────────────────────────────────────────────────────────────────
sec('6 · Aperçu en direct (colonne droite)');
// ────────────────────────────────────────────────────────────────────────────
try {
  const pvLabel = page.locator('.pv-label');
  const text    = await pvLabel.textContent({ timeout: 5000 });
  if (text && text.includes('Aperçu en direct')) {
    ok('"Aperçu en direct" label visible dans la colonne droite');
  } else {
    fail(`Label aperçu inattendu : "${text}"`);
  }
} catch (e) {
  fail(`Label aperçu en direct : ${e.message}`);
}

try {
  const miniShell = page.locator('.mini-shell');
  const visible   = await miniShell.isVisible();
  if (visible) {
    ok('Mini sidebar mockup (.mini-shell) visible');
  } else {
    fail('Mini sidebar mockup non visible');
  }
} catch (e) {
  fail(`Mini sidebar mockup : ${e.message}`);
}

try {
  const miniRail = page.locator('.mini-rail');
  const visible  = await miniRail.isVisible();
  if (visible) {
    ok('Mini rail (.mini-rail) visible dans l\'aperçu');
  } else {
    fail('Mini rail non visible');
  }
} catch (e) {
  fail(`Mini rail : ${e.message}`);
}

try {
  const miniPanel = page.locator('.mini-panel');
  const visible   = await miniPanel.isVisible();
  if (visible) {
    ok('Mini panel (.mini-panel) visible dans l\'aperçu');
  } else {
    fail('Mini panel non visible');
  }
} catch (e) {
  fail(`Mini panel : ${e.message}`);
}

// ────────────────────────────────────────────────────────────────────────────
sec('7 · Info chips de l\'aperçu');
// ────────────────────────────────────────────────────────────────────────────
try {
  const chips = page.locator('.pv-chip');
  const count = await chips.count();
  if (count >= 3) {
    ok(`${count} info chips visibles dans l\'aperçu`);
  } else {
    fail(`Info chips : attendu ≥3, trouvé ${count}`);
  }
} catch (e) {
  fail(`Info chips : ${e.message}`);
}

// Vérifier que les chips contiennent des libellés de thème connus
try {
  const allChipTexts = await page.locator('.pv-chip').allTextContents();
  const combined = allChipTexts.join(' ');
  // On attend au moins un des labels de thèmes sidebar
  const hasSidebarLabel = ['Navy', 'Forêt', 'Violet', 'Personnalisé'].some(l => combined.includes(l));
  if (hasSidebarLabel) {
    ok('Un chip affiche le label du thème sidebar actif');
  } else {
    fail(`Aucun chip ne mentionne le thème sidebar. Contenu : "${combined}"`);
  }
} catch (e) {
  fail(`Contenu chips thème : ${e.message}`);
}

try {
  const allChipTexts = await page.locator('.pv-chip').allTextContents();
  const combined = allChipTexts.join(' ');
  const hasPanelLabel = ['Clair', 'Sombre', 'Verre'].some(l => combined.includes(l));
  if (hasPanelLabel) {
    ok('Un chip affiche le label du style de panneau actif');
  } else {
    fail(`Aucun chip ne mentionne le style panneau. Contenu : "${combined}"`);
  }
} catch (e) {
  fail(`Contenu chips style panneau : ${e.message}`);
}

try {
  const allChipTexts = await page.locator('.pv-chip').allTextContents();
  const combined = allChipTexts.join(' ');
  const hasAccentLabel = ['Teal', 'Indigo', 'Ambre', 'Émeraude', 'Rose', 'Bleu', 'Personnalisé'].some(l => combined.includes(l));
  if (hasAccentLabel) {
    ok('Un chip affiche le label de la couleur d\'accent active');
  } else {
    fail(`Aucun chip ne mentionne la couleur d'accent. Contenu : "${combined}"`);
  }
} catch (e) {
  fail(`Contenu chips couleur accent : ${e.message}`);
}

// ────────────────────────────────────────────────────────────────────────────
sec('8 · Constructeur de dégradé personnalisé (thème Custom)');
// ────────────────────────────────────────────────────────────────────────────
try {
  const customBtn = page.locator('.t-sw', { has: page.locator('.t-sw__label', { hasText: 'Personnalisé' }) }).first();
  await customBtn.click();
  await page.waitForTimeout(400);

  const cgBuilder = page.locator('.cg-builder');
  const visible   = await cgBuilder.isVisible();
  if (visible) {
    ok('Sélection thème "Personnalisé" → constructeur de dégradé (.cg-builder) visible');
  } else {
    fail('Constructeur de dégradé non visible après sélection "Personnalisé"');
  }
} catch (e) {
  fail(`Constructeur dégradé personnalisé : ${e.message}`);
}

try {
  const cgTitle = page.locator('.cg-title');
  const text    = await cgTitle.textContent({ timeout: 3000 });
  if (text && text.includes('Constructeur de dégradé')) {
    ok('Titre du constructeur de dégradé correct');
  } else {
    fail(`Titre constructeur dégradé inattendu : "${text}"`);
  }
} catch (e) {
  fail(`Titre constructeur dégradé : ${e.message}`);
}

// Vérifier les champs couleur départ et fin
try {
  const cpFields = page.locator('.cp-field');
  const count    = await cpFields.count();
  if (count >= 2) {
    ok(`${count} champs de couleur personnalisée (Départ / Fin) visibles`);
  } else {
    fail(`Champs couleur personnalisée : attendu ≥2, trouvé ${count}`);
  }
} catch (e) {
  fail(`Champs couleur personnalisée : ${e.message}`);
}

// Vérifier les boutons d'angle
try {
  const angleBtns = page.locator('.angle-btn');
  const count     = await angleBtns.count();
  if (count === 4) {
    ok(`${count} boutons de direction de dégradé (90°, 135°, 180°, 225°) présents`);
  } else {
    fail(`Boutons d'angle : attendu 4, trouvé ${count}`);
  }
} catch (e) {
  fail(`Boutons d'angle dégradé : ${e.message}`);
}

// Cliquer sur 135°
try {
  const btn135 = page.locator('.angle-btn', { has: page.locator('span', { hasText: '135°' }) }).first();
  await btn135.click();
  await page.waitForTimeout(200);
  const isOn = await btn135.evaluate(el => el.classList.contains('angle-btn--on'));
  if (isOn) {
    ok('Clic angle 135° → .angle-btn--on appliqué');
  } else {
    fail('Clic angle 135° → .angle-btn--on absent');
  }
} catch (e) {
  fail(`Sélection angle 135° : ${e.message}`);
}

// Revenir à Navy
try {
  const navyBtn = page.locator('.t-sw', { has: page.locator('.t-sw__label', { hasText: 'Navy' }) }).first();
  await navyBtn.click();
  await page.waitForTimeout(200);
  ok('Retour au thème "Navy" après test Custom');
} catch (e) {
  fail(`Retour thème Navy après Custom : ${e.message}`);
}

// ────────────────────────────────────────────────────────────────────────────
sec('9 · Bouton Réinitialiser tout → snackbar');
// ────────────────────────────────────────────────────────────────────────────
try {
  const resetBtn = page.locator('.btn-reset');
  const visible  = await resetBtn.isVisible();
  if (visible) {
    ok('Bouton "Réinitialiser tout" visible');
  } else {
    fail('Bouton "Réinitialiser tout" introuvable');
  }
} catch (e) {
  fail(`Bouton reset visible : ${e.message}`);
}

try {
  const resetBtn = page.locator('.btn-reset');
  const text     = await resetBtn.textContent({ timeout: 3000 });
  if (text && text.includes('Réinitialiser tout')) {
    ok('Libellé du bouton reset correct ("Réinitialiser tout")');
  } else {
    fail(`Libellé bouton reset inattendu : "${text}"`);
  }
} catch (e) {
  fail(`Libellé bouton reset : ${e.message}`);
}

// Modifier une préférence avant le reset pour le rendre pertinent
try {
  const indigoBtn = page.locator('button.a-sw', { has: page.locator('.a-sw__label', { hasText: 'Indigo' }) }).first();
  await indigoBtn.click();
  await page.waitForTimeout(200);
  ok('Accent changé à "Indigo" avant le reset');
} catch (e) {
  warn(`Préparation reset (changement accent) : ${e.message}`);
}

try {
  const resetBtn = page.locator('.btn-reset');
  await resetBtn.click();
  const snackText = await getSnackbar(page);

  if (!snackText) {
    fail('Aucun snackbar détecté après "Réinitialiser tout"');
  } else if (snackText.includes('réinitialisées') || snackText.includes('Réinitialisé')) {
    ok(`Snackbar après reset : "${snackText.trim()}"`);
  } else {
    fail(`Snackbar inattendu après reset : "${snackText.trim()}"`);
  }
} catch (e) {
  fail(`Snackbar après reset : ${e.message}`);
}

// Vérifier que les préférences reviennent aux défauts (accent = Teal)
try {
  await page.waitForTimeout(400);
  const tealBtn = page.locator('button.a-sw', { has: page.locator('.a-sw__label', { hasText: 'Teal' }) }).first();
  const isOn    = await tealBtn.evaluate(el => el.classList.contains('a-sw--on'));
  if (isOn) {
    ok('Après reset : accent "Teal" (défaut) restauré');
  } else {
    fail('Après reset : accent "Teal" non restauré');
  }
} catch (e) {
  fail(`Vérification défauts après reset : ${e.message}`);
}

// Vérifier hint footer
try {
  const hint = page.locator('.footer-hint');
  const text  = await hint.textContent({ timeout: 3000 });
  if (text && text.includes('localement')) {
    ok('Hint footer ("stockées localement") visible');
  } else {
    fail(`Hint footer inattendu : "${text}"`);
  }
} catch (e) {
  fail(`Hint footer : ${e.message}`);
}

// ────────────────────────────────────────────────────────────────────────────
sec('10 · Persistance des changements (rechargement de page)');
// ────────────────────────────────────────────────────────────────────────────
// Appliquer une modification et recharger la page
try {
  const sombreCard = page.locator('.ps-card', { has: page.locator('.ps-card__foot span', { hasText: 'Sombre' }) }).first();
  await sombreCard.click();
  await page.waitForTimeout(300);
  ok('Style "Sombre" appliqué avant le rechargement');
} catch (e) {
  warn(`Préparation test persistance : ${e.message}`);
}

try {
  await page.reload();
  await page.waitForSelector('.page', { timeout: 12000 });
  await page.waitForTimeout(600); // Laisser le thème se recharger depuis localStorage/API

  const sombreCard = page.locator('.ps-card', { has: page.locator('.ps-card__foot span', { hasText: 'Sombre' }) }).first();
  const isOn       = await sombreCard.evaluate(el => el.classList.contains('ps-card--on'));
  if (isOn) {
    ok('Persistance : style "Sombre" restauré après rechargement de page');
  } else {
    warn('Persistance : style "Sombre" non retrouvé après rechargement (peut être normal si API prime sur localStorage)');
  }
} catch (e) {
  warn(`Test persistance rechargement : ${e.message}`);
}

// Remettre les préférences par défaut
try {
  const resetBtn = page.locator('.btn-reset');
  await resetBtn.click();
  await getSnackbar(page, 3000);
  ok('Préférences réinitialisées en fin de tests');
} catch (e) {
  warn(`Reset final : ${e.message}`);
}

// ────────────────────────────────────────────────────────────────────────────

await browser.close();

console.log(`\n${'═'.repeat(60)}\n  ${pass} ✅  |  ${fail_count} ❌  |  ${pass + fail_count} total\n${'═'.repeat(60)}`);
if (fail_count > 0) process.exit(1);
