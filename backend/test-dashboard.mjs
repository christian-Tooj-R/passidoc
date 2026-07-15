/**
 * Playwright E2E — Dashboard
 * App: http://localhost:4200  |  API: http://localhost:3000/api
 * Run: node test-dashboard.mjs
 */

import { chromium } from '/datas/Projets/Aro/backend/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:4200';

/* ── Counters ──────────────────────────────────────────────────────────── */
let pass = 0, fail_count = 0;
function ok(msg)    { console.log(`✅ ${msg}`); pass++; }
function fail(msg)  { console.error(`❌ ${msg}`); fail_count++; }
function warn(msg)  { console.warn(`⚠️  ${msg}`); }
function sec(title) { console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`); }

/* ── Login helper ──────────────────────────────────────────────────────── */
async function login(page) {
  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.locator('input[type="email"]').fill('admin@afym.re');
  await page.locator('input[type="password"]').fill('Admin1234!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 12000 }).catch(() => {});
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════════════════ */
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page    = await context.newPage();

/* Collect uncaught JS errors */
const jsErrors = [];
page.on('pageerror', err => jsErrors.push(err.message));

/* ── 1. Login & land on dashboard ─────────────────────────────────────── */
sec('1. Login & navigation vers /dashboard');
try {
  await login(page);
  const url = page.url();
  if (url.includes('/dashboard')) {
    ok('Redirection vers /dashboard après login');
  } else {
    fail(`URL inattendue après login : ${url}`);
  }
} catch (e) {
  fail(`Login ou redirection échoués : ${e.message}`);
}

/* ── 2. Conteneur principal ───────────────────────────────────────────── */
sec('2. Conteneur principal .dash');
try {
  await page.waitForSelector('.dash', { timeout: 10000 });
  ok('Conteneur .dash présent');
} catch {
  fail('Conteneur .dash introuvable');
}

/* ── 3. Erreurs JS ─────────────────────────────────────────────────────── */
sec('3. Aucune erreur JavaScript');
// Attendre un court instant pour laisser les requêtes initiales se terminer
await page.waitForTimeout(2000);
if (jsErrors.length === 0) {
  ok('Aucune erreur JS non catchée');
} else {
  fail(`${jsErrors.length} erreur(s) JS : ${jsErrors.slice(0, 3).join(' | ')}`);
}

/* ── 4. Section Hero ──────────────────────────────────────────────────── */
sec('4. Section Hero');
try {
  const eyebrow = await page.locator('.hero__eyebrow').textContent();
  if (eyebrow?.trim() === 'Tableau de bord') {
    ok('hero__eyebrow = "Tableau de bord"');
  } else {
    fail(`hero__eyebrow inattendu : "${eyebrow}"`);
  }
} catch {
  fail('hero__eyebrow introuvable');
}

try {
  const title = await page.locator('.hero__title').textContent();
  if (title?.includes('Bonjour')) {
    ok(`hero__title contient "Bonjour" → "${title?.trim()}"`);
  } else {
    fail(`hero__title ne contient pas "Bonjour" : "${title}"`);
  }
} catch {
  fail('hero__title introuvable');
}

try {
  const date = await page.locator('.hero__date').textContent();
  if (date && date.trim().length > 0) {
    ok(`hero__date renseigné : "${date.trim()}"`);
  } else {
    fail('hero__date vide ou absent');
  }
} catch {
  fail('hero__date introuvable');
}

/* ── 5. Statistiques hero (4 blocs h-stat) ───────────────────────────── */
sec('5. Statistiques Hero (h-stat)');
try {
  const hStats = page.locator('.h-stat');
  const count  = await hStats.count();
  if (count === 4) {
    ok(`4 blocs .h-stat présents (Dossiers / Transmissibles / En cours / En alerte)`);
  } else {
    fail(`Nombre de .h-stat inattendu : ${count} (attendu 4)`);
  }

  // Labels attendus
  const labels = ['Dossiers', 'Transmissibles', 'En cours', 'En alerte'];
  for (const lbl of labels) {
    const found = await page.locator(`.h-stat__lbl:has-text("${lbl}")`).count();
    if (found > 0) {
      ok(`Stat hero "${lbl}" présente`);
    } else {
      fail(`Stat hero "${lbl}" introuvable`);
    }
  }
} catch (e) {
  fail(`Erreur lecture h-stat : ${e.message}`);
}

/* ── 6. Metric cards (5 cartes) ──────────────────────────────────────── */
sec('6. Metric cards (metrics-row)');
try {
  await page.waitForSelector('.metrics-row', { timeout: 8000 });
  const metrics = page.locator('.metric');
  const count   = await metrics.count();
  if (count === 5) {
    ok('5 cartes .metric présentes');
  } else {
    fail(`Nombre de .metric inattendu : ${count} (attendu 5)`);
  }

  // Labels des métriques
  const metricLabels = [
    'Dossiers actifs',
    'Transmissibles',
    'En cours',
    'En alerte',
    'Docs manquants',
  ];
  for (const lbl of metricLabels) {
    const found = await page.locator(`.metric__label:has-text("${lbl}")`).count();
    if (found > 0) {
      ok(`Metric card "${lbl}" présente`);
    } else {
      fail(`Metric card "${lbl}" introuvable`);
    }
  }

  // Chaque carte a une valeur numérique
  for (let i = 0; i < count; i++) {
    const val = await metrics.nth(i).locator('.metric__value').textContent();
    if (val !== null && /^\d+$/.test(val.trim())) {
      ok(`Metric[${i}] .metric__value = ${val.trim()} (numérique)`);
    } else {
      fail(`Metric[${i}] .metric__value non numérique : "${val}"`);
    }
  }
} catch (e) {
  fail(`Erreur metric cards : ${e.message}`);
}

/* ── 7. Section "Dossiers clients" ────────────────────────────────────── */
sec('7. Section "Dossiers clients"');
try {
  const sectionTitle = await page.locator('.section-bar__title').textContent();
  if (sectionTitle?.trim() === 'Dossiers clients') {
    ok('Titre section "Dossiers clients" présent');
  } else {
    fail(`Titre section inattendu : "${sectionTitle}"`);
  }
} catch {
  fail('.section-bar__title introuvable');
}

/* ── 8. Filtres site (chips) ─────────────────────────────────────────── */
sec('8. Filtres site (chip-group)');
try {
  const chips = page.locator('.md-chip');
  const count = await chips.count();
  if (count === 3) {
    ok('3 chips de filtre présentes');
  } else {
    fail(`Nombre de .md-chip inattendu : ${count} (attendu 3)`);
  }

  // Chip "Tous" active par défaut
  const allChip = page.locator('.md-chip--active');
  const activeText = await allChip.first().textContent();
  if (activeText?.includes('Tous')) {
    ok('Chip "Tous" active par défaut');
  } else {
    warn(`Chip active par défaut : "${activeText?.trim()}" (attendu "Tous")`);
  }

  // Vérifier les textes des chips
  for (const txt of ['Tous', 'La Réunion', 'Madagascar']) {
    const found = await page.locator(`.md-chip:has-text("${txt}")`).count();
    if (found > 0) {
      ok(`Chip filtre "${txt}" présente`);
    } else {
      fail(`Chip filtre "${txt}" introuvable`);
    }
  }
} catch (e) {
  fail(`Erreur chips filtre : ${e.message}`);
}

/* ── 9. Grille clients ────────────────────────────────────────────────── */
sec('9. Grille clients (.client-grid)');
try {
  await page.waitForSelector('.client-grid', { timeout: 10000 });
  ok('.client-grid présente');

  const cards = page.locator('.c-card');
  const count = await cards.count();
  if (count > 0) {
    ok(`${count} carte(s) client présente(s)`);
  } else {
    warn('Aucune carte client — base de données peut-être vide');
  }

  if (count > 0) {
    // Première carte : vérifier les éléments internes
    const firstCard = cards.first();
    const name = await firstCard.locator('.c-card__name').textContent();
    if (name && name.trim().length > 0) {
      ok(`Première carte : nom client "${name.trim()}"`);
    } else {
      fail('Première carte : .c-card__name absent ou vide');
    }

    const badge = await firstCard.locator('.c-card__score-badge').textContent();
    if (badge && badge.trim().endsWith('%')) {
      ok(`Première carte : score badge "${badge.trim()}"`);
    } else {
      fail(`Première carte : .c-card__score-badge absent ou mal formaté : "${badge}"`);
    }

    const progBar = await firstCard.locator('.c-prog-bar').count();
    if (progBar > 0) {
      ok('Première carte : barre de progression présente');
    } else {
      fail('Première carte : .c-prog-bar absent');
    }

    const progLabel = await firstCard.locator('.c-prog-label').textContent();
    if (progLabel && progLabel.trim().length > 0) {
      ok(`Première carte : label score "${progLabel.trim()}"`);
    } else {
      fail('Première carte : .c-prog-label absent ou vide');
    }

    const avatar = await firstCard.locator('.c-card__avatar').count();
    if (avatar > 0) {
      ok('Première carte : avatar initiales présent');
    } else {
      fail('Première carte : .c-card__avatar absent');
    }
  }
} catch (e) {
  fail(`Erreur grille clients : ${e.message}`);
}

/* ── 10. Filtre La Réunion ──────────────────────────────────────────── */
sec('10. Filtre par site');
try {
  const cards = page.locator('.c-card');
  const totalCount = await cards.count();

  if (totalCount > 0) {
    // Cliquer "La Réunion"
    await page.locator('.md-chip:has-text("La Réunion")').click();
    await page.waitForTimeout(500);

    const reChip = page.locator('.md-chip--active');
    const activeLabel = await reChip.first().textContent();
    if (activeLabel?.includes('La Réunion')) {
      ok('Chip "La Réunion" devient active après clic');
    } else {
      fail(`Chip active après clic "La Réunion" : "${activeLabel?.trim()}"`);
    }

    // Cliquer "Madagascar"
    await page.locator('.md-chip:has-text("Madagascar")').click();
    await page.waitForTimeout(500);
    const mgChip = page.locator('.md-chip--active');
    const mgLabel = await mgChip.first().textContent();
    if (mgLabel?.includes('Madagascar')) {
      ok('Chip "Madagascar" devient active après clic');
    } else {
      fail(`Chip active après clic "Madagascar" : "${mgLabel?.trim()}"`);
    }

    // Remettre "Tous"
    await page.locator('.md-chip:has-text("Tous")').click();
    await page.waitForTimeout(300);
    const backCount = await page.locator('.c-card').count();
    if (backCount === totalCount) {
      ok(`Retour à "Tous" : ${backCount} carte(s) — identique au total`);
    } else {
      warn(`Retour à "Tous" : ${backCount} carte(s) vs ${totalCount} au départ`);
    }
  } else {
    warn('Filtre site non testé — aucune carte client disponible');
  }
} catch (e) {
  fail(`Erreur filtre site : ${e.message}`);
}

/* ── 11. Performance équipe (conditionnel) ──────────────────────────── */
sec('11. Performance équipe (conditionnel)');
try {
  const perfSection = page.locator('.perf-section');
  const hasPerfSection = await perfSection.count();

  if (hasPerfSection > 0) {
    ok('.perf-section présente (tâches assignées trouvées)');

    // Header
    const title = await page.locator('.perf-header__title').textContent();
    if (title?.trim() === 'Performance équipe') {
      ok('Titre "Performance équipe" présent');
    } else {
      fail(`Titre perf section inattendu : "${title}"`);
    }

    // Bar chart équipe
    const barChart = await page.locator('.chart-card--full canvas').count();
    if (barChart > 0) {
      ok('Bar chart "Vue d\'ensemble équipe" présent');
    } else {
      fail('Bar chart vue d\'ensemble absent');
    }

    // Onglets collaborateurs
    const collabTabs = page.locator('.ctab');
    const tabCount   = await collabTabs.count();
    if (tabCount > 0) {
      ok(`${tabCount} onglet(s) collaborateur présent(s)`);
    } else {
      fail('Aucun onglet collaborateur trouvé dans .collab-tabs');
    }

    // Un onglet actif
    const activeTab = await page.locator('.ctab--active').count();
    if (activeTab === 1) {
      ok('Un onglet collaborateur actif par défaut');
    } else {
      fail(`Nombre d'onglets actifs : ${activeTab} (attendu 1)`);
    }

    // Graphiques détail
    const detailCharts = await page.locator('.detail-charts-grid canvas').count();
    if (detailCharts >= 2) {
      ok(`${detailCharts} canvas de détail collaborateur (doughnut + bar dossiers)`);
    } else {
      warn(`Seulement ${detailCharts} canvas de détail trouvé(s)`);
    }

    // Clic sur le deuxième onglet si dispo
    if (tabCount >= 2) {
      await collabTabs.nth(1).click();
      await page.waitForTimeout(300);
      const newActive = await page.locator('.ctab--active').textContent();
      ok(`Clic onglet 2 → actif : "${newActive?.trim()}"`);
      // Remettre le premier
      await collabTabs.nth(0).click();
    }
  } else {
    warn('Section .perf-section absente — pas de tâches assignées dans la base');
  }
} catch (e) {
  fail(`Erreur section performance : ${e.message}`);
}

/* ── 12. Section Alertes (conditionnel) ─────────────────────────────── */
sec('12. Alertes documents manquants (conditionnel)');
try {
  const alertes = page.locator('.alertes');
  const hasAlertes = await alertes.count();

  if (hasAlertes > 0) {
    ok('Section .alertes présente (documents manquants/retard)');

    const alertTitle = await page.locator('.alertes__title').textContent();
    if (alertTitle?.includes('Documents manquants')) {
      ok('Titre alertes "Documents manquants ou en retard" présent');
    } else {
      fail(`Titre alertes inattendu : "${alertTitle}"`);
    }

    const alertRows = page.locator('.alerte-row');
    const rowCount  = await alertRows.count();
    if (rowCount > 0) {
      ok(`${rowCount} ligne(s) d'alerte affichée(s)`);
    } else {
      fail('Section alertes présente mais aucune alerte-row');
    }

    // Bouton "Tout voir" / "Réduire"
    const textBtn = page.locator('.text-btn');
    const btnCount = await textBtn.count();
    if (btnCount > 0) {
      ok('Bouton expand/collapse alertes présent');
      // Test expand/collapse
      const btnText = await textBtn.first().textContent();
      await textBtn.first().click();
      await page.waitForTimeout(300);
      const newBtnText = await page.locator('.text-btn').first().textContent();
      if (newBtnText !== btnText) {
        ok(`Bouton alerte change de libellé : "${btnText?.trim()}" → "${newBtnText?.trim()}"`);
      } else {
        warn('Libellé bouton alerte inchangé après clic (< 5 alertes ?)');
      }
      // Refermer
      await page.locator('.text-btn').first().click();
    } else {
      warn('Bouton expand alertes absent');
    }
  } else {
    warn('Section .alertes absente — aucune alerte en base (normal si tout est à jour)');
  }
} catch (e) {
  fail(`Erreur section alertes : ${e.message}`);
}

/* ── 13. Sidebar navigation ─────────────────────────────────────────── */
sec('13. Sidebar navigation');
try {
  // Rail présent
  const rail = await page.locator('.rail').count();
  if (rail > 0) {
    ok('Sidebar .rail présente');
  } else {
    fail('Sidebar .rail absente');
  }

  // Logo lien vers /dashboard
  const logo = page.locator('a.rail-logo');
  const logoHref = await logo.getAttribute('href');
  if (logoHref?.includes('dashboard') || logoHref === '/dashboard') {
    ok('Logo sidebar pointe vers /dashboard');
  } else {
    fail(`Logo href inattendu : "${logoHref}"`);
  }

  // Boutons de modules dans le rail
  const railItems = page.locator('.rail-item');
  const railCount = await railItems.count();
  if (railCount > 0) {
    ok(`${railCount} module(s) dans la sidebar rail`);
  } else {
    fail('Aucun .rail-item dans la sidebar');
  }

  // Lien personnalisation
  const persoLink = await page.locator('a[href*="personnalisation"]').count();
  if (persoLink > 0) {
    ok('Lien Personnalisation présent dans la sidebar');
  } else {
    warn('Lien Personnalisation absent de la sidebar');
  }
} catch (e) {
  fail(`Erreur sidebar : ${e.message}`);
}

/* ── 14. Widget IA (FAB) — absent sur le dashboard ──────────────────── */
sec('14. Widget IA flottant (FAB) — comportement sur le dashboard');
try {
  // Le FAB ne s'affiche que lorsqu'un client est sélectionné (clientId() truthy).
  // Sur /dashboard il ne doit PAS être présent dans le DOM.
  const fabCount = await page.locator('button.fab').count();
  if (fabCount === 0) {
    ok('FAB .fab absent sur /dashboard (attendu : clientId() est null)');
  } else {
    warn(`FAB présent sur /dashboard (${fabCount}) — vérifier la logique clientId()`);
  }
} catch (e) {
  fail(`Erreur check FAB : ${e.message}`);
}

/* ── 15. Navigation vers un dossier client ───────────────────────────── */
sec('15. Navigation vers un dossier client depuis le dashboard');
try {
  const cards = page.locator('.c-card');
  const count = await cards.count();
  if (count > 0) {
    await cards.first().click();
    await page.waitForURL('**/clients/**', { timeout: 8000 });
    const clientUrl = page.url();
    if (clientUrl.includes('/clients/')) {
      ok(`Navigation vers un dossier client réussie : ${clientUrl}`);
    } else {
      fail(`URL après clic carte client inattendue : ${clientUrl}`);
    }
    // Revenir au dashboard
    await page.goBack();
    await page.waitForURL('**/dashboard', { timeout: 8000 }).catch(() => {});
    ok('Retour au dashboard via browser back');
  } else {
    warn('Navigation vers client non testée — aucune carte client');
  }
} catch (e) {
  fail(`Erreur navigation client : ${e.message}`);
}

/* ── 16. Widget IA (FAB) — présent sur une page client ──────────────── */
sec('16. Widget IA flottant (FAB) — présent sur une page client');
try {
  const cards = page.locator('.c-card');
  const count = await cards.count();
  if (count > 0) {
    await cards.first().click();
    await page.waitForURL('**/clients/**', { timeout: 8000 });
    await page.waitForTimeout(1000);

    const fabCount = await page.locator('button.fab').count();
    if (fabCount > 0) {
      ok('FAB .fab présent sur page client (clientId() défini)');

      // Ouvrir le panel
      await page.locator('button.fab').click();
      await page.waitForTimeout(500);
      const panel = await page.locator('.chat-panel').count();
      if (panel > 0) {
        ok('.chat-panel ouvert après clic FAB');
      } else {
        fail('.chat-panel absent après clic FAB');
      }

      // Fermer le panel
      await page.locator('button.panel-close').click();
      await page.waitForTimeout(300);
      const panelAfter = await page.locator('.chat-panel').count();
      if (panelAfter === 0) {
        ok('.chat-panel fermé après clic bouton close');
      } else {
        fail('.chat-panel toujours visible après fermeture');
      }
    } else {
      warn('FAB absent sur page client — peut-être que le widget attend clientId() via le router');
    }

    // Revenir au dashboard
    await page.goBack();
    await page.waitForURL('**/dashboard', { timeout: 8000 }).catch(() => {});
  } else {
    warn('Test FAB sur client non effectué — aucune carte client disponible');
  }
} catch (e) {
  fail(`Erreur test FAB sur client : ${e.message}`);
}

/* ══════════════════════════════════════════════════════════════════════════
   RÉSULTAT FINAL
══════════════════════════════════════════════════════════════════════════ */
await browser.close();

console.log(`\n${'═'.repeat(60)}\n  ${pass} ✅  |  ${fail_count} ❌  |  ${pass + fail_count} total\n${'═'.repeat(60)}`);
if (fail_count > 0) process.exit(1);
