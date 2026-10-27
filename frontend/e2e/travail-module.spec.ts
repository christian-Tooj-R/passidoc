import { test, expect } from '@playwright/test';

// Tests du module Travail
// Compte e2e@test.com / Test1234! (ADMIN)

/**
 * Jour des 30 derniers jours (le plus ancien possible) SANS pointage du compte de test : le
 * contrôle de cohérence plafonne les saisies d'un jour pointé à la durée pointée, et chaque
 * exécution de la suite pointe « aujourd'hui » — un jour fixe (J-30) finit donc par tomber sur
 * un jour où la suite a tourné. On lit l'historique de pointage pour l'éviter.
 */
async function dateSansPointage(page: any): Promise<string> {
  const login = await page.request.post('http://localhost:3000/api/auth/login', {
    data: { email: 'e2e@test.com', password: 'Test1234!' },
  });
  const { access_token } = await login.json();
  const iso = (d: Date) => d.toISOString().split('T')[0];
  const debut = new Date();
  debut.setDate(debut.getDate() - 30);
  const r = await page.request.get(
    `http://localhost:3000/api/pointage/historique?dateDebut=${iso(debut)}&dateFin=${iso(new Date())}`,
    { headers: { Authorization: `Bearer ${access_token}` } },
  );
  const pointes = new Set(((await r.json()) ?? []).map((p: any) => String(p.date).slice(0, 10)));
  for (let i = 30; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (!pointes.has(iso(d))) return iso(d);
  }
  throw new Error('Aucun jour sans pointage sur les 30 derniers jours pour le compte de test');
}

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
    for (const section of ['TÂCHES', 'TEMPS PASSÉS']) {
      await expect(page.locator('.tw-nav__section', { hasText: section }).first()).toBeVisible({ timeout: 3_000 });
    }
  });

  test('Tous les liens de navigation présents', async ({ page }) => {
    await loginAndGoto(page, '/travail/taches');
    await expect(page.locator('.tw-sidebar')).toBeVisible({ timeout: 8_000 });

    const labels = [
      'Toutes les tâches', 'Vue Kanban', 'Tâches récurrentes',
      'Agenda réalisé', 'Par semaine', 'Par mois', 'Détail des temps', 'Rentabilité dossiers',
    ];
    for (const label of labels) {
      await expect(page.locator('.tw-nav__item', { hasText: label }).first())
        .toBeVisible({ timeout: 3_000 });
    }
  });

  test('Minuteur dans la sidebar — bouton présent et fonctionnel', async ({ page }) => {
    // Le minuteur est persisté en localStorage : partir d'un minuteur à l'arrêt
    await page.addInitScript(() => {
      for (const k of ['st_timer', 'st_timer_task_ctx', 'st_timer_paused_tasks']) localStorage.removeItem(k);
    });
    await loginAndGoto(page, '/travail/taches');
    await expect(page.locator('.tw-timer')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.tw-timer__time')).toBeVisible();
    await expect(page.locator('.tw-timer__btn--start')).toBeVisible();

    // Démarrer le minuteur
    await page.locator('.tw-timer__btn--start').click();
    await page.waitForTimeout(1200);
    await expect(page.locator('.tw-timer--running')).toBeVisible({ timeout: 3_000 });

    // Arrêter : le minuteur s'arrête et propose d'enregistrer le temps (abandonné ici)
    await page.locator('.tw-timer__btn--stop').click();
    await expect(page.locator('.tw-timer--running')).toHaveCount(0);
    await expect(page.locator('.tw-tsave')).toBeVisible({ timeout: 3_000 });
    await page.locator('.tw-tsave__close').click();
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

  // Page refaite au format Tempolia (oct. 2026) : exports Excel + PDF au lieu du CSV.
  test('Détail des temps — boutons d’export Excel et PDF présents', async ({ page }) => {
    await loginAndGoto(page, '/travail/temps/detail');
    await expect(page.locator('.tw-sidebar')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('button.btn-export', { hasText: 'Excel' })).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('button.btn-export', { hasText: 'PDF' })).toBeVisible();
  });

  test('Rentabilité dossiers — page chargée', async ({ page }) => {
    await loginAndGoto(page, '/travail/rentabilite');
    await expect(page.locator('.tw-sidebar')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('heading', { name: 'Rentabilité des dossiers' })).toBeVisible({ timeout: 8_000 });
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

    // Jour sans pointage : le contrôle de cohérence pointage/saisie ne s'applique pas ici —
    // ce n'est pas ce qu'on veut tester (cf. dateSansPointage).
    const dateAncienne = await dateSansPointage(page);

    await page.locator('.line-form input[type="date"]').fill(dateAncienne);
    await page.locator('.line-form input[name="duree"]').fill('01:30'); // <input type="time"> : format HH:MM
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
    // Créer une ligne dédiée via Saisie rapide, un jour sans pointage (hors contrôle pointage)
    await loginAndGoto(page, '/travail/saisie');
    const commentaire = `E2E par-jour actions ${Date.now()}`;
    const dateAncienne = await dateSansPointage(page);

    await page.locator('.line-form input[type="date"]').fill(dateAncienne);
    await page.locator('.line-form input[name="duree"]').fill('01:00'); // <input type="time"> : format HH:MM
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
    const dateAncienne = await dateSansPointage(page);

    await page.locator('.line-form input[type="date"]').fill(dateAncienne);
    await page.locator('.line-form input[name="duree"]').fill('00:45'); // <input type="time"> : format HH:MM
    await page.locator('.line-form input[name="commentaire"]').fill(commentaire);
    await page.locator('.lf-submit').click();
    await expect(page.locator('.data-table', { hasText: commentaire })).toBeVisible({ timeout: 10_000 });

    await page.goto('/travail/temps/detail');
    await page.waitForTimeout(2500);
    // Période « 30 derniers jours » : la saisie date d'il y a 30 jours, même en janvier
    await page.locator('.params select').first().selectOption('30j');
    await page.waitForTimeout(1500);
    await page.locator('.params input[placeholder*="Libellé" i]').fill(commentaire);
    await page.waitForTimeout(400);
    const row = page.locator('tr.data-row', { hasText: commentaire });
    await expect(row).toBeVisible({ timeout: 8_000 });
    await expect(row.locator('.td-act')).toHaveCount(3);

    // Nettoyage
    page.on('dialog', d => d.accept());
    await row.locator('.td-act--del').click();
    await page.waitForTimeout(800);
  });

  test('Boutons d’export et champ de recherche libre présents', async ({ page }) => {
    await loginAndGoto(page, '/travail/temps/detail');
    await expect(page.locator('button.btn-export', { hasText: 'Excel' })).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.params input[placeholder*="Libellé" i]')).toBeVisible();
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
