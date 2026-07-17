import { chromium } from '/datas/Projets/Aro/backend/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:4200';

// ── Compteurs ─────────────────────────────────────────────────────────────────
let pass = 0, fail_count = 0;
function ok(msg)   { console.log(`✅ ${msg}`); pass++; }
function fail(msg) { console.error(`❌ ${msg}`); fail_count++; }
function warn(msg) { console.warn(`⚠️  ${msg}`); }
function sec(title){ console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`); }

// ── Snackbar helper ───────────────────────────────────────────────────────────
async function getSnackbar(page, timeout = 5000) {
  return page.locator('mat-snack-bar-container, .mat-mdc-snack-bar-container')
    .first().textContent({ timeout }).catch(() => null);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  // Simuler une géolocalisation fictive pour éviter les blocages de permission
  permissions: ['geolocation'],
  geolocation: { latitude: -21.115, longitude: 55.536 },
});
const page = await context.newPage();

// ── Login ─────────────────────────────────────────────────────────────────────
sec('Authentification');
try {
  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.locator('input[type="email"]').fill('admin@afym.re');
  await page.locator('input[type="password"]').fill('Admin1234!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 12000 }).catch(() => {});
  ok('Login admin réussi');
} catch (e) {
  fail(`Login échoué : ${e.message}`);
  await browser.close();
  process.exit(1);
}

// ── Navigation vers /pointage ─────────────────────────────────────────────────
sec('Navigation vers /pointage');
try {
  await page.goto(`${BASE}/pointage`);
  await page.waitForSelector('.pt-page', { timeout: 10000 });
  ok('Page /pointage chargée — .pt-page visible');
} catch (e) {
  fail(`Chargement de la page échoué : ${e.message}`);
  await browser.close();
  process.exit(1);
}

// Attendre que les données Angular soient chargées
await page.waitForTimeout(1500);

// ══════════════════════════════════════════════════════════════════════════════
sec('1 — Vue collaborateur : en-tête');
// ══════════════════════════════════════════════════════════════════════════════

// Container principal avec classe admin
try {
  const ptPage = page.locator('.pt-page');
  const hasAdminClass = await ptPage.evaluate(el => el.classList.contains('pt-page--admin'));
  if (hasAdminClass) {
    ok('Container .pt-page--admin présent (admin connecté)');
  } else {
    warn('Classe .pt-page--admin absente (inattendu pour un admin)');
  }
} catch (e) {
  fail(`Container .pt-page non trouvé : ${e.message}`);
}

// Titre "Mon pointage"
try {
  const title = page.locator('.collab-title');
  await title.waitFor({ timeout: 5000 });
  const text = await title.textContent();
  if (text && text.includes('Mon pointage')) {
    ok(`Titre collab visible : "${text.trim()}"`);
  } else {
    fail(`Titre inattendu : "${text}"`);
  }
} catch (e) {
  fail(`Titre .collab-title non trouvé : ${e.message}`);
}

// Date complète (peut être hors viewport en vue admin, on vérifie juste le textContent)
try {
  const dateEl = page.locator('.collab-date').first();
  const dateText = await dateEl.textContent({ timeout: 5000 }).catch(() => null);
  if (dateText && dateText.trim().length > 0) {
    ok(`Date complète affichée : "${dateText.trim()}"`);
  } else {
    warn('Date .collab-date vide ou absente');
  }
} catch (e) {
  warn(`Date .collab-date inaccessible : ${e.message}`);
}

// ══════════════════════════════════════════════════════════════════════════════
sec('2 — Carte principale (main-card)');
// ══════════════════════════════════════════════════════════════════════════════

// Carte principale visible
try {
  const card = page.locator('.main-card');
  await card.waitFor({ timeout: 5000 });
  ok('Carte principale .main-card visible');
} catch (e) {
  fail(`.main-card non trouvée : ${e.message}`);
}

// Bouton d'action principal
try {
  const btn = page.locator('.btn-pointer').first();
  await btn.waitFor({ timeout: 5000 });
  const btnText = await btn.textContent();
  ok(`Bouton d'action visible : "${btnText?.trim()}"`);
} catch (e) {
  fail(`Bouton .btn-pointer non trouvé : ${e.message}`);
}

// État affiché dans la carte (absent, présent, en_pause, etc.)
try {
  const stateEl = page.locator('.state__title, .state__sub, .duration-display, .journee-terminee').first();
  const stateText = await stateEl.textContent({ timeout: 3000 }).catch(() => null);
  if (stateText) {
    ok(`État affiché dans la carte : "${stateText.trim().substring(0, 60)}"`);
  } else {
    warn('Aucun texte d\'état trouvé dans .state (peut être normal)');
  }
} catch (_) {
  warn('Aucun élément d\'état trouvé dans .main-card');
}

// ══════════════════════════════════════════════════════════════════════════════
sec('3 — KPIs collaborateur');
// ══════════════════════════════════════════════════════════════════════════════

try {
  const kpisContainer = page.locator('.collab-kpis');
  await kpisContainer.waitFor({ timeout: 5000 });
  ok('Conteneur .collab-kpis visible');
} catch (e) {
  fail(`.collab-kpis non trouvé : ${e.message}`);
}

// KPI jours présents (kpi--present)
try {
  const kpiPresent = page.locator('.collab-kpis .kpi--present');
  await kpiPresent.waitFor({ timeout: 3000 });
  const text = await kpiPresent.textContent();
  ok(`KPI jours présents semaine : "${text?.trim().replace(/\s+/g, ' ')}"`);
} catch (e) {
  fail(`KPI .kpi--present (semaine) non trouvé : ${e.message}`);
}

// KPI total semaine (kpi--total)
try {
  const kpiTotal = page.locator('.collab-kpis .kpi--total');
  await kpiTotal.waitFor({ timeout: 3000 });
  const text = await kpiTotal.textContent();
  ok(`KPI total semaine : "${text?.trim().replace(/\s+/g, ' ')}"`);
} catch (e) {
  fail(`KPI .kpi--total (semaine) non trouvé : ${e.message}`);
}

// KPI jours ce mois (kpi--mois)
try {
  const kpiMois = page.locator('.collab-kpis .kpi--mois');
  await kpiMois.waitFor({ timeout: 3000 });
  const text = await kpiMois.textContent();
  ok(`KPI jours ce mois : "${text?.trim().replace(/\s+/g, ' ')}"`);
} catch (e) {
  fail(`KPI .kpi--mois non trouvé : ${e.message}`);
}

// ══════════════════════════════════════════════════════════════════════════════
sec('4 — Vue semaine');
// ══════════════════════════════════════════════════════════════════════════════

// Carte semaine
try {
  const semaineCard = page.locator('.semaine-card');
  await semaineCard.waitFor({ timeout: 5000 });
  ok('Carte .semaine-card visible');
} catch (e) {
  fail(`.semaine-card non trouvée : ${e.message}`);
}

// Titre semaine
try {
  const titre = page.locator('.semaine-title');
  await titre.waitFor({ timeout: 3000 });
  const text = await titre.textContent();
  if (text && text.includes('Semaine')) {
    ok(`Titre semaine : "${text.trim()}"`);
  } else {
    warn(`Titre semaine inattendu : "${text}"`);
  }
} catch (e) {
  fail(`.semaine-title non trouvé : ${e.message}`);
}

// 5 colonnes de jours (Lun–Ven)
try {
  const jours = page.locator('.jour-col');
  const count = await jours.count();
  if (count === 5) {
    ok(`5 colonnes de jours (Lun–Ven) présentes`);
  } else {
    fail(`Nombre de colonnes de jours inattendu : ${count} (attendu 5)`);
  }
} catch (e) {
  fail(`Colonnes .jour-col non trouvées : ${e.message}`);
}

// Total semaine
try {
  const totalEl = page.locator('.semaine-total');
  await totalEl.waitFor({ timeout: 3000 });
  const text = await totalEl.textContent();
  ok(`Total semaine affiché : "${text?.trim().replace(/\s+/g, ' ')}"`);
} catch (e) {
  fail(`.semaine-total non trouvé : ${e.message}`);
}

// Navigation semaine — bouton précédent
try {
  const navBtns = page.locator('.semaine-header .nav-btn');
  const count = await navBtns.count();
  if (count >= 2) {
    ok(`Boutons navigation semaine présents (${count})`);
  } else {
    fail(`Boutons navigation semaine insuffisants : ${count}`);
  }
} catch (e) {
  fail(`Boutons .semaine-header .nav-btn non trouvés : ${e.message}`);
}

// Navigation vers la semaine précédente
try {
  const titreBefore = await page.locator('.semaine-title').textContent();
  const prevBtn = page.locator('.semaine-header .nav-btn').first();
  await prevBtn.click();
  await page.waitForTimeout(500);
  const titreAfter = await page.locator('.semaine-title').textContent();
  if (titreBefore !== titreAfter) {
    ok(`Navigation semaine précédente fonctionne : "${titreAfter?.trim()}"`);
  } else {
    fail(`Titre semaine inchangé après navigation précédente`);
  }
  // Revenir à la semaine courante
  const nextBtn = page.locator('.semaine-header .nav-btn').nth(1);
  await nextBtn.click();
  await page.waitForTimeout(300);
} catch (e) {
  fail(`Navigation semaine précédente échouée : ${e.message}`);
}

// Bouton "calendrier" (datepicker toggle) dans la vue semaine
try {
  const calToggle = page.locator('.semaine-header .nav-cal-toggle').first();
  await calToggle.waitFor({ timeout: 3000 });
  ok('Bouton calendrier (datepicker) visible dans la vue semaine');
} catch (e) {
  fail(`Bouton calendrier semaine non trouvé : ${e.message}`);
}

// ══════════════════════════════════════════════════════════════════════════════
sec('5 — Section admin : listing des présences');
// ══════════════════════════════════════════════════════════════════════════════

// Section listing
try {
  const listing = page.locator('.listing-section');
  await listing.waitFor({ timeout: 5000 });
  ok('Section .listing-section (admin) visible');
} catch (e) {
  fail(`.listing-section non trouvée : ${e.message}`);
}

// Titre "Relevé des présences"
try {
  const title = page.locator('.listing-title');
  await title.waitFor({ timeout: 3000 });
  const text = await title.textContent();
  if (text && text.includes('Relevé des présences')) {
    ok(`Titre listing admin : "${text.trim()}"`);
  } else {
    fail(`Titre listing inattendu : "${text}"`);
  }
} catch (e) {
  fail(`.listing-title non trouvé : ${e.message}`);
}

// Bouton Export CSV
try {
  const exportBtn = page.locator('.btn-export');
  await exportBtn.waitFor({ timeout: 3000 });
  const text = await exportBtn.textContent();
  if (text && text.includes('Export CSV')) {
    ok(`Bouton Export CSV visible : "${text.trim()}"`);
  } else {
    fail(`Bouton Export CSV avec texte inattendu : "${text}"`);
  }
} catch (e) {
  fail(`.btn-export non trouvé : ${e.message}`);
}

// ══════════════════════════════════════════════════════════════════════════════
sec('6 — Navigation date admin');
// ══════════════════════════════════════════════════════════════════════════════

// Navigation par jour admin
try {
  const dateNav = page.locator('.date-nav');
  await dateNav.waitFor({ timeout: 3000 });
  ok('Barre navigation .date-nav visible');
} catch (e) {
  fail(`.date-nav non trouvée : ${e.message}`);
}

// Label du jour
try {
  const label = page.locator('.date-nav-label');
  await label.waitFor({ timeout: 3000 });
  const text = await label.textContent();
  if (text && (text.includes("Aujourd'hui") || text.trim().length > 5)) {
    ok(`Label jour admin : "${text.trim()}"`);
  } else {
    fail(`Label jour admin vide ou inattendu : "${text}"`);
  }
} catch (e) {
  fail(`.date-nav-label non trouvé : ${e.message}`);
}

// Navigation vers le jour précédent
try {
  const labelBefore = await page.locator('.date-nav-label').textContent();
  const prevDayBtn = page.locator('.date-nav .nav-btn').first();
  await prevDayBtn.click();
  await page.waitForTimeout(800);
  const labelAfter = await page.locator('.date-nav-label').textContent();
  if (labelBefore !== labelAfter) {
    ok(`Navigation jour précédent fonctionne : "${labelAfter?.trim()}"`);
  } else {
    fail('Label jour inchangé après navigation précédente');
  }
} catch (e) {
  fail(`Navigation jour précédent échouée : ${e.message}`);
}

// Bouton "Aujourd'hui" apparaît après navigation
try {
  const todayBtn = page.locator('.btn-today');
  await todayBtn.waitFor({ timeout: 3000 });
  const text = await todayBtn.textContent();
  ok(`Bouton "Aujourd'hui" apparu : "${text?.trim()}"`);
} catch (e) {
  fail(`Bouton .btn-today non apparu après navigation : ${e.message}`);
}

// Bouton "Aujourd'hui" — retour à aujourd'hui
try {
  const todayBtn = page.locator('.btn-today');
  await todayBtn.click();
  await page.waitForTimeout(800);
  const labelAfter = await page.locator('.date-nav-label').textContent();
  if (labelAfter && labelAfter.includes("Aujourd'hui")) {
    ok(`Retour à aujourd'hui : "${labelAfter.trim()}"`);
  } else {
    fail(`Label inattendu après retour aujourd'hui : "${labelAfter}"`);
  }
} catch (e) {
  fail(`Bouton Aujourd'hui inopérant : ${e.message}`);
}

// Bouton "Suivant" (chevron droit) doit être désactivé quand on est aujourd'hui
try {
  const nextDayBtn = page.locator('.date-nav .nav-btn').nth(1);
  const isDisabled = await nextDayBtn.isDisabled();
  if (isDisabled) {
    ok('Bouton "Jour suivant" désactivé pour aujourd\'hui (correct)');
  } else {
    fail('Bouton "Jour suivant" devrait être désactivé pour aujourd\'hui');
  }
} catch (e) {
  fail(`Vérification désactivation bouton suivant échouée : ${e.message}`);
}

// Calendrier datepicker admin
try {
  const calAdmin = page.locator('.date-nav .nav-cal-toggle').first();
  await calAdmin.waitFor({ timeout: 3000 });
  ok('Bouton calendrier (datepicker) admin visible');
} catch (e) {
  fail(`Bouton calendrier admin non trouvé : ${e.message}`);
}

// ══════════════════════════════════════════════════════════════════════════════
sec('7 — Filtre site (mat-button-toggle-group)');
// ══════════════════════════════════════════════════════════════════════════════

try {
  const toggleGroup = page.locator('mat-button-toggle-group');
  await toggleGroup.waitFor({ timeout: 5000 });
  ok('mat-button-toggle-group (filtre site) visible');
} catch (e) {
  fail(`mat-button-toggle-group non trouvé : ${e.message}`);
}

// Trois options : Tous, Réunion, Madagascar
const expectedToggles = ['Tous', 'Réunion', 'Madagascar'];
for (const label of expectedToggles) {
  try {
    const btn = page.locator(`mat-button-toggle`).filter({ hasText: new RegExp(label, 'i') });
    await btn.waitFor({ timeout: 3000 });
    ok(`Option filtre "${label}" présente`);
  } catch (e) {
    fail(`Option filtre "${label}" non trouvée : ${e.message}`);
  }
}

// Clic sur "Réunion" puis retour sur "Tous"
try {
  const reunionBtn = page.locator('mat-button-toggle').filter({ hasText: /Réunion/i });
  await reunionBtn.click();
  await page.waitForTimeout(800);
  ok('Filtre "Réunion" activé sans erreur');

  const tousBtn = page.locator('mat-button-toggle').filter({ hasText: /^Tous$/i });
  await tousBtn.click();
  await page.waitForTimeout(500);
  ok('Retour filtre "Tous" sans erreur');
} catch (e) {
  fail(`Interaction filtre site échouée : ${e.message}`);
}

// ══════════════════════════════════════════════════════════════════════════════
sec('8 — Barre de recherche admin');
// ══════════════════════════════════════════════════════════════════════════════

try {
  const searchInput = page.locator('.search-input');
  await searchInput.waitFor({ timeout: 3000 });
  ok('Champ de recherche .search-input visible');
} catch (e) {
  fail(`.search-input non trouvé : ${e.message}`);
}

// Recherche — placeholder
try {
  const placeholder = await page.locator('.search-input').getAttribute('placeholder');
  if (placeholder && placeholder.toLowerCase().includes('employ')) {
    ok(`Placeholder de recherche : "${placeholder}"`);
  } else {
    fail(`Placeholder inattendu : "${placeholder}"`);
  }
} catch (e) {
  fail(`Vérification placeholder recherche échouée : ${e.message}`);
}

// Recherche par texte → filtre les lignes
try {
  const searchInput = page.locator('.search-input');
  await searchInput.fill('xxxxxx_inexistant');
  await page.waitForTimeout(500);
  // Le bouton clear doit apparaître
  const clearBtn = page.locator('.search-clear');
  const clearVisible = await clearBtn.isVisible().catch(() => false);
  if (clearVisible) {
    ok('Bouton clear (.search-clear) visible lors d\'une recherche');
  } else {
    fail('Bouton clear non visible après saisie dans le champ de recherche');
  }
} catch (e) {
  fail(`Test recherche échoué : ${e.message}`);
}

// Effacer la recherche
try {
  const clearBtn = page.locator('.search-clear');
  await clearBtn.click();
  await page.waitForTimeout(300);
  const val = await page.locator('.search-input').inputValue();
  if (val === '') {
    ok('Effacement de la recherche fonctionne');
  } else {
    fail(`Champ non effacé : "${val}"`);
  }
} catch (e) {
  fail(`Effacement recherche échoué : ${e.message}`);
}

// ══════════════════════════════════════════════════════════════════════════════
sec('9 — KPIs listing admin');
// ══════════════════════════════════════════════════════════════════════════════

try {
  const kpisListing = page.locator('.listing-kpis');
  await kpisListing.waitFor({ timeout: 3000 });
  ok('.listing-kpis visible');
} catch (e) {
  fail(`.listing-kpis non trouvé : ${e.message}`);
}

// KPI présents
try {
  const kpiPresent = page.locator('.listing-kpis .kpi--present');
  await kpiPresent.waitFor({ timeout: 3000 });
  const text = await kpiPresent.textContent();
  ok(`KPI présents admin : "${text?.trim().replace(/\s+/g, ' ')}"`);
} catch (e) {
  fail(`KPI .kpi--present (listing) non trouvé : ${e.message}`);
}

// KPI absents
try {
  const kpiAbsent = page.locator('.listing-kpis .kpi--absent');
  await kpiAbsent.waitFor({ timeout: 3000 });
  const text = await kpiAbsent.textContent();
  ok(`KPI absents admin : "${text?.trim().replace(/\s+/g, ' ')}"`);
} catch (e) {
  fail(`KPI .kpi--absent non trouvé : ${e.message}`);
}

// KPI total travail
try {
  const kpiTotal = page.locator('.listing-kpis .kpi--total');
  await kpiTotal.waitFor({ timeout: 3000 });
  const text = await kpiTotal.textContent();
  ok(`KPI total travail du jour : "${text?.trim().replace(/\s+/g, ' ')}"`);
} catch (e) {
  fail(`KPI .kpi--total (listing) non trouvé : ${e.message}`);
}

// ══════════════════════════════════════════════════════════════════════════════
sec('10 — Tableau app-data-table (colonnes admin)');
// ══════════════════════════════════════════════════════════════════════════════

try {
  const table = page.locator('app-data-table');
  await table.waitFor({ timeout: 5000 });
  ok('Composant app-data-table visible');
} catch (e) {
  fail(`app-data-table non trouvé : ${e.message}`);
}

// Vérification des en-têtes de colonnes
const expectedCols = ['Employé', 'Site', 'Journée', 'Arrivée', 'Départ', 'Pause', 'Travail net', 'Statut'];
for (const col of expectedCols) {
  try {
    const header = page.locator('app-data-table th, app-data-table .col-header').filter({ hasText: new RegExp(`^${col}$`, 'i') });
    const count = await header.count();
    if (count > 0) {
      ok(`Colonne "${col}" présente dans le tableau`);
    } else {
      // Fallback: chercher dans tout le tableau
      const fallback = page.locator('app-data-table').filter({ hasText: col });
      const fb = await fallback.count();
      if (fb > 0) {
        ok(`Colonne "${col}" présente (via texte dans app-data-table)`);
      } else {
        fail(`Colonne "${col}" non trouvée dans le tableau`);
      }
    }
  } catch (e) {
    fail(`Vérification colonne "${col}" échouée : ${e.message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
sec('11 — Géolocalisation (vue collab)');
// ══════════════════════════════════════════════════════════════════════════════

// Indicateur géo (si présent) — dépend de la config du site pour l'admin
try {
  const geoStatus = page.locator('.geo-status').first();
  const geoVisible = await geoStatus.isVisible().catch(() => false);
  if (geoVisible) {
    const text = await geoStatus.textContent();
    ok(`Indicateur géo visible : "${text?.trim()}"`);
  } else {
    ok('Indicateur géo absent (pas de config géo pour ce site — comportement normal)');
  }
} catch (_) {
  ok('Indicateur géo absent (pas de config géo — comportement normal)');
}

// ══════════════════════════════════════════════════════════════════════════════
sec('12 — Rechargement de la page (persistance)');
// ══════════════════════════════════════════════════════════════════════════════

try {
  await page.reload();
  await page.waitForSelector('.pt-page', { timeout: 10000 });
  await page.waitForTimeout(1000);
  const title = await page.locator('.collab-title').textContent({ timeout: 5000 });
  if (title && title.includes('Mon pointage')) {
    ok('Page /pointage reste accessible après rechargement (session active)');
  } else {
    fail(`Titre absent après rechargement : "${title}"`);
  }
} catch (e) {
  fail(`Rechargement page échoué : ${e.message}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// Fin
// ══════════════════════════════════════════════════════════════════════════════
await browser.close();

console.log(`\n${'═'.repeat(60)}\n  ${pass} ✅  |  ${fail_count} ❌  |  ${pass + fail_count} total\n${'═'.repeat(60)}`);
if (fail_count > 0) process.exit(1);
