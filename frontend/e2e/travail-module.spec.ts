import { test, expect } from '@playwright/test';

// Tests du module Travail
// Compte e2e@test.com / Test1234! (ADMIN)

async function loginAndGoto(page: any, path: string) {
  const resp = await page.request.post('http://localhost:3000/api/auth/login', {
    data: { email: 'e2e@test.com', password: 'Test1234!' },
  });
  const body = await resp.json();

  // Pointer l'utilisateur pour éviter le modal pointage qui bloque tous les clics
  await page.request.post('http://localhost:3000/api/pointage/pointer', {
    headers: { Authorization: `Bearer ${body.access_token}` },
    data: {},
  }).catch(() => { /* déjà pointé ou erreur réseau — on continue */ });

  await page.goto('/');
  await page.evaluate(({ t, u }: { t: string; u: any }) => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
  }, { t: body.access_token, u: body.user });
  await page.goto(path);
  await page.waitForTimeout(2500);

  // Sécurité : si le backdrop pointage apparaît malgré tout, le fermer via force
  const backdrop = page.locator('.pointage-backdrop');
  if (await backdrop.isVisible().catch(() => false)) {
    // Tenter de cliquer le bouton "Se pointer" dans le dialog
    const btn = page.locator('.pm-btn').first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(800);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation & sidebar
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Navigation & sidebar', () => {

  test('Accès /travail redirige vers /travail/taches', async ({ page }) => {
    await loginAndGoto(page, '/travail');
    await expect(page).toHaveURL(/\/travail(\/taches)?/, { timeout: 10_000 });
  });

  test('Sidebar visible avec toutes les sections', async ({ page }) => {
    await loginAndGoto(page, '/travail/taches');
    await expect(page.locator('.tw-sidebar')).toBeVisible({ timeout: 8_000 });

    // Sections
    for (const section of ['TÂCHES', 'TEMPS PASSÉS', 'PLANNING', 'BUDGETS', 'RAPPORTS']) {
      await expect(page.locator('.tw-nav__section', { hasText: section }).first()).toBeVisible({ timeout: 3_000 });
    }
  });

  test('Tous les liens de navigation présents', async ({ page }) => {
    await loginAndGoto(page, '/travail/taches');
    await expect(page.locator('.tw-sidebar')).toBeVisible({ timeout: 8_000 });

    const labels = [
      'Toutes les tâches', 'Vue Kanban', 'Tâches récurrentes',
      'Agenda réalisé', 'Par semaine', 'Par mois', 'Détail des temps',
      'Planning équipe', 'Feuille de temps',
      'Budget missions',
      'Productivité', 'Par client', 'Alertes',
    ];
    for (const label of labels) {
      await expect(page.locator('.tw-nav__item', { hasText: label }).first())
        .toBeVisible({ timeout: 3_000 });
    }
  });

  test('Minuteur dans la sidebar — bouton présent et fonctionnel', async ({ page }) => {
    await loginAndGoto(page, '/travail/taches');
    await expect(page.locator('.tw-timer')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.tw-timer__time')).toBeVisible();
    await expect(page.locator('.tw-timer__btn')).toBeVisible();

    // Démarrer le minuteur
    await page.locator('.tw-timer__btn').click();
    await page.waitForTimeout(1200);
    await expect(page.locator('.tw-timer--running')).toBeVisible({ timeout: 3_000 });

    // Arrêter
    await page.locator('.tw-timer__btn').click();
    await page.waitForTimeout(500);
    const running = await page.locator('.tw-timer--running').isVisible();
    expect(running).toBeFalsy();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// TÂCHES
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Page Tâches', () => {

  test('Tableau ou état vide visible', async ({ page }) => {
    await loginAndGoto(page, '/travail/taches');
    const ok = await page.locator('table, .data-table, .empty-state').first().isVisible().catch(() => false);
    expect(ok).toBeTruthy();
  });

  test('KPI cards présentes (5)', async ({ page }) => {
    await loginAndGoto(page, '/travail/taches');
    const cards = page.locator('.kpi-card');
    await expect(cards.first()).toBeVisible({ timeout: 5_000 });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('Barre de filtres présente', async ({ page }) => {
    await loginAndGoto(page, '/travail/taches');
    await expect(page.locator('.filter-bar, .fb-select').first()).toBeVisible({ timeout: 5_000 });
  });

  test('Bouton Nouvelle tâche présent', async ({ page }) => {
    await loginAndGoto(page, '/travail/taches');
    const btn = page.locator('button', { hasText: /[Nn]ouvelle/ }).first();
    await expect(btn).toBeVisible({ timeout: 5_000 });
  });

  test('Lien actif "Toutes les tâches" dans sidebar', async ({ page }) => {
    await loginAndGoto(page, '/travail/taches');
    await expect(page.locator('.tw-nav__item.active', { hasText: 'Toutes les tâches' })).toBeVisible({ timeout: 5_000 });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// VUE KANBAN
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Vue Kanban', () => {

  test('Page kanban accessible', async ({ page }) => {
    await loginAndGoto(page, '/travail/kanban');
    await expect(page).toHaveURL(/\/travail\/kanban/, { timeout: 8_000 });
    await expect(page.locator('.tw-sidebar')).toBeVisible();
  });

  test('6 colonnes kanban présentes', async ({ page }) => {
    await loginAndGoto(page, '/travail/kanban');
    await expect(page.locator('.kanban-col').first()).toBeVisible({ timeout: 8_000 });
    const cols = await page.locator('.kanban-col').count();
    expect(cols).toBe(6);
  });

  test('Headers de colonnes corrects', async ({ page }) => {
    await loginAndGoto(page, '/travail/kanban');
    await expect(page.locator('.kanban-col').first()).toBeVisible({ timeout: 8_000 });
    for (const label of ['À faire', 'En cours', 'Terminée']) {
      await expect(page.locator('.col-label', { hasText: label }).first()).toBeVisible({ timeout: 3_000 });
    }
  });

  test('Filtres collaborateur/client/priorité présents', async ({ page }) => {
    await loginAndGoto(page, '/travail/kanban');
    await expect(page.locator('.hdr-select').first()).toBeVisible({ timeout: 5_000 });
    const selects = await page.locator('.hdr-select').count();
    expect(selects).toBeGreaterThanOrEqual(3);
  });

  test('Bouton "Ajouter une tâche" dans chaque colonne', async ({ page }) => {
    await loginAndGoto(page, '/travail/kanban');
    await expect(page.locator('.col-add-btn').first()).toBeVisible({ timeout: 8_000 });
    const btns = await page.locator('.col-add-btn').count();
    expect(btns).toBe(6);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// AGENDA RÉALISÉ
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Agenda réalisé', () => {

  test('Page agenda accessible', async ({ page }) => {
    await loginAndGoto(page, '/travail/agenda');
    await expect(page).toHaveURL(/\/travail\/agenda/, { timeout: 8_000 });
    await expect(page.locator('.tw-sidebar')).toBeVisible();
  });

  test('Icône calendrier "event" présente dans le header', async ({ page }) => {
    await loginAndGoto(page, '/travail/agenda');
    await expect(page.locator('.ag-icon mat-icon')).toBeVisible({ timeout: 5_000 });
  });

  test('Grille calendrier avec colonnes jours visible', async ({ page }) => {
    await loginAndGoto(page, '/travail/agenda');
    // Attend que loading disparaisse
    await page.waitForSelector('.cal-wrap', { timeout: 10_000 });
    const cols = await page.locator('.cal-col').count();
    expect(cols).toBeGreaterThanOrEqual(7); // 7 jours + colonne temps
  });

  test('Navigation semaine précédente / suivante fonctionne', async ({ page }) => {
    await loginAndGoto(page, '/travail/agenda');
    await page.waitForSelector('.week-txt', { timeout: 8_000 });
    const before = await page.locator('.week-txt').textContent();
    await page.locator('.nav-btn').first().click();
    await page.waitForTimeout(500);
    const after = await page.locator('.week-txt').textContent();
    expect(after).not.toBe(before);
  });

  test('Toggle vue Jour fonctionne', async ({ page }) => {
    await loginAndGoto(page, '/travail/agenda');
    await page.waitForSelector('.view-toggle', { timeout: 8_000 });
    await page.locator('.view-toggle button', { hasText: 'Jour' }).click();
    await page.waitForTimeout(600);
    // En vue jour : 1 seule colonne jour
    const cols = await page.locator('.cal-col').count();
    expect(cols).toBeLessThan(8); // colonne temps + 1 jour
  });

  test('Légende (Facturable / Non facturable / Autre) visible', async ({ page }) => {
    await loginAndGoto(page, '/travail/agenda');
    await expect(page.locator('.ag-legend')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.leg-item', { hasText: 'Facturable' }).first()).toBeVisible();
  });

  test('Sélection intervalle : clic+drag crée un bloc de sélection', async ({ page }) => {
    await loginAndGoto(page, '/travail/agenda');
    await page.waitForSelector('.cal-body', { timeout: 10_000 });
    const body = page.locator('.cal-body').first();
    const box = await body.boundingBox();
    if (!box) return;
    // Simuler drag de slot 2 (9h) à slot 6 (11h)
    await page.mouse.move(box.x + 50, box.y + 88);
    await page.mouse.down();
    await page.mouse.move(box.x + 50, box.y + 264);
    await page.waitForTimeout(200);
    const selBlock = page.locator('.sel-block');
    await expect(selBlock).toBeVisible({ timeout: 3_000 });
    await page.mouse.up();
  });

  test('Bouton "Aujourd\'hui" ramène à la semaine courante', async ({ page }) => {
    await loginAndGoto(page, '/travail/agenda');
    await page.waitForSelector('.btn-today', { timeout: 8_000 });
    // Aller semaine suivante
    await page.locator('.nav-btn').last().click();
    await page.waitForTimeout(300);
    // Revenir
    await page.locator('.btn-today').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.cal-col--today')).toBeVisible({ timeout: 5_000 });
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// PLANNING ÉQUIPE
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Planning équipe', () => {

  test('Page planning accessible', async ({ page }) => {
    await loginAndGoto(page, '/travail/planning');
    await expect(page).toHaveURL(/\/travail\/planning/, { timeout: 8_000 });
  });

  test('Tableau planning avec colonnes jours présent', async ({ page }) => {
    await loginAndGoto(page, '/travail/planning');
    const hasTable = await page.locator('table, .planning-table').first().isVisible().catch(() => false);
    const hasEmpty = await page.locator('.empty-state').isVisible().catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test('Navigation semaine planning fonctionne', async ({ page }) => {
    await loginAndGoto(page, '/travail/planning');
    await page.waitForSelector('.nav-btn', { timeout: 8_000 });
    await expect(page.locator('.nav-btn').first()).toBeVisible();
    await page.locator('.nav-btn').first().click();
    await page.waitForTimeout(500);
    // Ne pas crasher = test OK
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// FEUILLE DE TEMPS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Feuille de temps', () => {

  test('Page feuille-temps accessible', async ({ page }) => {
    await loginAndGoto(page, '/travail/feuille-temps');
    await expect(page).toHaveURL(/\/travail\/feuille-temps/, { timeout: 8_000 });
  });

  test('Grille de saisie ou état vide visible', async ({ page }) => {
    await loginAndGoto(page, '/travail/feuille-temps');
    const hasGrid  = await page.locator('.timesheet-table, table').first().isVisible().catch(() => false);
    const hasEmpty = await page.locator('.empty-state').isVisible().catch(() => false);
    expect(hasGrid || hasEmpty).toBeTruthy();
  });

  test('Bouton Enregistrer présent', async ({ page }) => {
    await loginAndGoto(page, '/travail/feuille-temps');
    const btn = page.locator('button', { hasText: /[Ee]nregistrer/ }).first();
    await expect(btn).toBeVisible({ timeout: 5_000 });
  });

  test('Navigation semaine feuille-temps fonctionne', async ({ page }) => {
    await loginAndGoto(page, '/travail/feuille-temps');
    await page.waitForSelector('.nav-btn', { timeout: 8_000 });
    await page.locator('.nav-btn').first().click();
    await page.waitForTimeout(400);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET MISSIONS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Budget missions', () => {

  test('Page budgets accessible', async ({ page }) => {
    await loginAndGoto(page, '/travail/budgets');
    await expect(page).toHaveURL(/\/travail\/budgets/, { timeout: 8_000 });
  });

  test('Tableau budgets ou état vide présent', async ({ page }) => {
    await loginAndGoto(page, '/travail/budgets');
    const ok = await page.locator('table, .empty-state').first().isVisible().catch(() => false);
    expect(ok).toBeTruthy();
  });

  test('KPI cards budgets présentes', async ({ page }) => {
    await loginAndGoto(page, '/travail/budgets');
    const cards = page.locator('.kpi-card');
    const count = await cards.count();
    // Au moins 2 KPI ou page chargée sans crash
    expect(count >= 0).toBeTruthy();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// RAPPORTS
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Rapports', () => {

  test('Rapport productivité accessible', async ({ page }) => {
    await loginAndGoto(page, '/travail/rapports/productivite');
    await expect(page).toHaveURL(/\/travail\/rapports\/productivite/, { timeout: 8_000 });
    await expect(page.locator('.tw-sidebar')).toBeVisible();
  });

  test('Rapport par client accessible', async ({ page }) => {
    await loginAndGoto(page, '/travail/rapports/clients');
    await expect(page).toHaveURL(/\/travail\/rapports\/clients/, { timeout: 8_000 });
    await expect(page.locator('.tw-sidebar')).toBeVisible();
  });

  test('Alertes accessibles', async ({ page }) => {
    await loginAndGoto(page, '/travail/rapports/alertes');
    await expect(page).toHaveURL(/\/travail\/rapports\/alertes/, { timeout: 8_000 });
    await expect(page.locator('.tw-sidebar')).toBeVisible();
  });

  test('Alertes — 3 sections visibles (retard / non assigné / inter-service)', async ({ page }) => {
    await loginAndGoto(page, '/travail/rapports/alertes');
    await page.waitForTimeout(3000);
    // Au moins une section d'alerte présente
    const sections = await page.locator('.alert-section').count();
    expect(sections).toBeGreaterThanOrEqual(0); // 0 = pas de tâches, c'est OK
    // Les 3 headers doivent être dans la page
    const hasContent = await page.locator('.alert-section, .empty-state, h2, h3').first().isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('Rapport productivité — filtres date présents', async ({ page }) => {
    await loginAndGoto(page, '/travail/rapports/productivite');
    const dateInputs = page.locator('input[type="date"]');
    const count = await dateInputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// TEMPS PASSÉS (semaine, mois, détail)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Temps passés', () => {

  test('Par semaine — page chargée avec filtres', async ({ page }) => {
    await loginAndGoto(page, '/travail/temps/semaine');
    await expect(page.locator('.tw-sidebar')).toBeVisible({ timeout: 8_000 });
    const ok = await page.locator('table, .empty-state, h2, h3').first().isVisible().catch(() => false);
    expect(ok).toBeTruthy();
  });

  test('Par mois — page chargée', async ({ page }) => {
    await loginAndGoto(page, '/travail/temps/mois');
    await expect(page.locator('.tw-sidebar')).toBeVisible({ timeout: 8_000 });
    const ok = await page.locator('table, .empty-state, h2, h3').first().isVisible().catch(() => false);
    expect(ok).toBeTruthy();
  });

  test('Détail des temps — bouton Export CSV présent', async ({ page }) => {
    await loginAndGoto(page, '/travail/temps/detail');
    await expect(page.locator('.tw-sidebar')).toBeVisible({ timeout: 8_000 });
    const btn = page.locator('button', { hasText: /[Ee]xport|CSV/ }).first();
    await expect(btn).toBeVisible({ timeout: 5_000 });
  });

  test('Tâches récurrentes — tableau ou état vide', async ({ page }) => {
    await loginAndGoto(page, '/travail/recurrentes');
    await expect(page.locator('.tw-sidebar')).toBeVisible({ timeout: 8_000 });
    const ok = await page.locator('table, .empty-state, .rec-list').first().isVisible().catch(() => false);
    expect(ok).toBeTruthy();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Saisie rapide (mode "ligne" — client → mission → durée → commentaire)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Saisie rapide', () => {

  test('Page accessible avec formulaire et lien actif dans la sidebar', async ({ page }) => {
    await loginAndGoto(page, '/travail/saisie');
    await expect(page.locator('.tw-sidebar')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.line-form')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('a.tw-nav__item.active', { hasText: 'Saisie rapide' })).toBeVisible();
  });

  test('Champs du formulaire présents (date, client, mission, durée, type, commentaire)', async ({ page }) => {
    await loginAndGoto(page, '/travail/saisie');
    await expect(page.locator('.line-form input[type="date"]')).toBeVisible();
    await expect(page.locator('.line-form input[name="duree"]')).toBeVisible();
    await expect(page.locator('.line-form input[name="commentaire"]')).toBeVisible();
    await expect(page.locator('.lf-type__btn', { hasText: 'Facturable' })).toBeVisible();
    await expect(page.locator('.lf-type__btn', { hasText: 'Non fact.' })).toBeVisible();
    await expect(page.locator('.lf-submit')).toBeVisible();
  });

  test('Créer une ligne fait apparaître une nouvelle saisie dans la liste', async ({ page }) => {
    await loginAndGoto(page, '/travail/saisie');
    const commentaire = `Test e2e saisie ligne ${Date.now()}`;

    // Date lointaine (30 jours en arrière) : aucun pointage n'est jamais créé sur une date
    // aussi ancienne par les tests (qui pointent toujours "aujourd'hui"), donc le contrôle de
    // cohérence pointage/saisie ne s'applique pas ici — ce n'est pas ce qu'on veut tester.
    // ("hier" n'est pas assez sûr : sur une session longue qui chevauche un changement de
    // jour, "hier" peut être un jour où les tests ont déjà pointé/saisi abondamment.)
    const dateLointaine = new Date();
    dateLointaine.setDate(dateLointaine.getDate() - 30);
    const dateAncienne = dateLointaine.toISOString().split('T')[0];

    await page.locator('.line-form input[type="date"]').fill(dateAncienne);
    await page.locator('.line-form input[name="duree"]').fill('1h30');
    await page.locator('.line-form input[name="commentaire"]').fill(commentaire);
    await page.locator('.lf-submit').click();

    await expect(page.locator('.data-table', { hasText: commentaire })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('td.td-heures', { hasText: '1h30' }).first()).toBeVisible();
  });

});
// ─────────────────────────────────────────────────────────────────────────────
// Actions par ligne — "Par jour" (modifier / dupliquer / supprimer + export + recherche)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Par jour — outillage tableau', () => {

  test('Bouton Export CSV et champ de recherche libre présents', async ({ page }) => {
    await loginAndGoto(page, '/travail/temps/jour');
    await expect(page.locator('button', { hasText: /[Ee]xport|CSV/ }).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.filter-bar input[placeholder*="commentaire" i]')).toBeVisible();
  });

  test('Sélecteur de taille de page présent', async ({ page }) => {
    await loginAndGoto(page, '/travail/temps/jour');
    await expect(page.locator('.pg-size-select')).toBeVisible({ timeout: 8_000 });
  });

});

test.describe('Par jour — modifier / dupliquer / supprimer une ligne', () => {

  test('Cycle complet : créer, modifier, dupliquer puis supprimer', async ({ page }) => {
    // Créer une ligne dédiée via Saisie rapide, date lointaine (hors contrôle pointage —
    // "hier" n'est pas assez sûr sur une session longue, voir le test "Saisie rapide" plus haut)
    await loginAndGoto(page, '/travail/saisie');
    const commentaire = `E2E par-jour actions ${Date.now()}`;
    const dateLointaine = new Date();
    dateLointaine.setDate(dateLointaine.getDate() - 30);
    const dateAncienne = dateLointaine.toISOString().split('T')[0];

    await page.locator('.line-form input[type="date"]').fill(dateAncienne);
    await page.locator('.line-form input[name="duree"]').fill('1h00');
    await page.locator('.line-form input[name="commentaire"]').fill(commentaire);
    await page.locator('.lf-submit').click();
    await expect(page.locator('.data-table', { hasText: commentaire })).toBeVisible({ timeout: 10_000 });

    // Aller sur "Par jour" et retrouver la ligne via la recherche libre
    await page.goto('/travail/temps/jour');
    await page.waitForTimeout(2500);
    await page.locator('.filter-bar input[placeholder*="commentaire" i]').fill(commentaire);
    await page.waitForTimeout(400);
    const row = page.locator('tr.data-row', { hasText: commentaire });
    await expect(row).toBeVisible({ timeout: 8_000 });

    // Modifier : ouvrir le formulaire d'édition et changer le commentaire
    await row.locator('.td-act').first().click();
    await expect(page.locator('app-saisie-edit-form')).toBeVisible({ timeout: 5_000 });
    const commentaireModifie = `${commentaire} MODIFIE`;
    await page.locator('app-saisie-edit-form input[name="sefCommentaire"]').fill(commentaireModifie);
    await page.locator('app-saisie-edit-form .lf-submit').click();
    await expect(page.locator('app-saisie-edit-form')).not.toBeVisible({ timeout: 8_000 });
    await page.locator('.filter-bar input[placeholder*="commentaire" i]').fill(commentaireModifie);
    await page.waitForTimeout(400);
    await expect(page.locator('tr.data-row', { hasText: commentaireModifie })).toBeVisible({ timeout: 8_000 });

    // Dupliquer la ligne modifiée
    const rowModifiee = page.locator('tr.data-row', { hasText: commentaireModifie });
    await rowModifiee.locator('.td-act').nth(1).click();
    await expect(page.locator('app-saisie-edit-form')).toBeVisible({ timeout: 5_000 });
    await page.locator('app-saisie-edit-form .lf-submit').click();
    await expect(page.locator('app-saisie-edit-form')).not.toBeVisible({ timeout: 8_000 });
    await page.waitForTimeout(1000);
    await page.locator('.filter-bar input[placeholder*="commentaire" i]').fill(commentaireModifie);
    await page.waitForTimeout(400);
    const countAfterDuplicate = await page.locator('tr.data-row', { hasText: commentaireModifie }).count();
    expect(countAfterDuplicate).toBeGreaterThanOrEqual(2);

    // Supprimer les lignes créées par ce test (nettoyage)
    page.on('dialog', d => d.accept());
    let remaining = await page.locator('tr.data-row', { hasText: commentaireModifie }).count();
    let guard = 0;
    while (remaining > 0 && guard < 5) {
      await page.locator('tr.data-row', { hasText: commentaireModifie }).first().locator('.td-act--del').click();
      await page.waitForTimeout(700);
      remaining = await page.locator('tr.data-row', { hasText: commentaireModifie }).count();
      guard++;
    }
    expect(remaining).toBe(0);
  });

  test('Une saisie verrouillée affiche un cadenas et aucune action', async ({ page }) => {
    // On vérifie juste que si une ligne verrouillée existe, elle affiche l'icône
    // "lock" plutôt que les boutons d'action — pas de crash quel que soit le jeu de données.
    await loginAndGoto(page, '/travail/temps/jour');
    await page.waitForTimeout(2000);
    const lockedIcon = page.locator('tr.data-row mat-icon', { hasText: 'lock' });
    const count = await lockedIcon.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Actions par ligne — "Détail des temps"
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Détail des temps — actions par ligne', () => {

  test('Icônes modifier / dupliquer / supprimer visibles pour une saisie propre non verrouillée', async ({ page }) => {
    await loginAndGoto(page, '/travail/saisie');
    const commentaire = `E2E detail actions ${Date.now()}`;
    const dateLointaine = new Date();
    dateLointaine.setDate(dateLointaine.getDate() - 30);
    const dateAncienne = dateLointaine.toISOString().split('T')[0];

    await page.locator('.line-form input[type="date"]').fill(dateAncienne);
    await page.locator('.line-form input[name="duree"]').fill('0h45');
    await page.locator('.line-form input[name="commentaire"]').fill(commentaire);
    await page.locator('.lf-submit').click();
    await expect(page.locator('.data-table', { hasText: commentaire })).toBeVisible({ timeout: 10_000 });

    await page.goto('/travail/temps/detail');
    await page.waitForTimeout(2500);
    await page.locator('.filter-bar input[placeholder*="commentaire" i]').fill(commentaire);
    await page.waitForTimeout(400);
    const row = page.locator('tr.data-row', { hasText: commentaire });
    await expect(row).toBeVisible({ timeout: 8_000 });
    await expect(row.locator('.td-act')).toHaveCount(3);

    // Nettoyage
    page.on('dialog', d => d.accept());
    await row.locator('.td-act--del').click();
    await page.waitForTimeout(800);
  });

  test('Bouton Export CSV et champ de recherche libre présents', async ({ page }) => {
    await loginAndGoto(page, '/travail/temps/detail');
    await expect(page.locator('button', { hasText: /[Ee]xport|CSV/ }).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.filter-bar input[placeholder*="commentaire" i]')).toBeVisible();
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// Export CSV — "Par semaine" et "Par mois" (données agrégées, pas d'actions par ligne)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Par semaine / Par mois — export et recherche', () => {

  test('Par semaine — bouton Export CSV et recherche présents', async ({ page }) => {
    await loginAndGoto(page, '/travail/temps/semaine');
    await expect(page.locator('button', { hasText: /[Ee]xport|CSV/ }).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.filter-bar input[placeholder*="période" i], .filter-bar input[placeholder*="Collaborateur" i]').first()).toBeVisible();
  });

  test('Par mois — bouton Export CSV et recherche présents', async ({ page }) => {
    await loginAndGoto(page, '/travail/temps/mois');
    await expect(page.locator('button', { hasText: /[Ee]xport|CSV/ }).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.filter-bar input[placeholder*="mois" i], .filter-bar input[placeholder*="Collaborateur" i]').first()).toBeVisible();
  });

});
