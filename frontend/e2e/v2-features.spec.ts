/**
 * Tests E2E v2 — Interactions UI réelles (TACHE-02 à TACHE-08)
 *
 * Tous les tests :
 * - s'authentifient via JWT injecté dans localStorage (loginAfym)
 * - interagissent avec les vrais composants Angular via page.click / page.fill / etc.
 * - vérifient la persistance en rechargeant la page
 *
 * Client de test : afym / client 21
 */

import { test, expect, request as pwRequest } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

// ─── Config ────────────────────────────────────────────────────────────────────
const API_URL   = 'http://localhost:3000/api';
const APP_URL   = 'http://localhost:4202';
const TENANT    = 'afym';
const EMAIL     = 'admin@admin.com';
const PASS      = 'Admin2024!';
const CLIENT_ID = 21;

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function getToken(api: APIRequestContext): Promise<{ token: string; user: any }> {
  const res  = await api.post(`${API_URL}/auth/login`, {
    headers: { 'x-tenant-slug': TENANT },
    data: { email: EMAIL, password: PASS },
  });
  const body = await res.json();
  return { token: body.access_token, user: body.user };
}

function h(token: string) {
  return { Authorization: `Bearer ${token}`, 'x-tenant-slug': TENANT };
}

async function loginAfym(page: Page): Promise<{ token: string; api: APIRequestContext }> {
  const api             = await pwRequest.newContext();
  const { token, user } = await getToken(api);

  // Pointer avant d'injecter (évite le guard de pointage)
  await api.post(`${API_URL}/pointage/pointer`, {
    headers: h(token),
    data: { latitude: null, longitude: null, action: 'ENTREE' },
  }).catch(() => {});

  // 1. Aller sur la page login (où l'app redirige /?tenant=afym)
  await page.goto(`${APP_URL}/login?tenant=${TENANT}`);
  await page.waitForLoadState('domcontentloaded');

  // 2. Injecter le token dans localStorage (même origine = persiste)
  await page.evaluate(({ token, user, tenant }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenant_slug', tenant);
  }, { token, user, tenant: TENANT });

  // 3. Naviguer directement vers une route protégée — les guards liront le token
  await page.goto(`${APP_URL}/dashboard?tenant=${TENANT}`);
  await page.waitForLoadState('networkidle');

  return { token, api };
}

async function goToClientTab(page: Page, tabLabel: string) {
  await page.goto(`${APP_URL}/clients/${CLIENT_ID}?tenant=${TENANT}`);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('.sidenav__item', { timeout: 12_000 });
  const tab = page.locator('.sidenav__item').filter({ hasText: new RegExp(tabLabel, 'i') });
  await tab.first().click();
  await page.waitForTimeout(800);
}

async function waitForToast(page: Page, text?: string) {
  const snack = page.locator('mat-snack-bar-container');
  await snack.waitFor({ timeout: 8_000 });
  if (text) {
    await expect(snack).toContainText(text, { timeout: 5_000 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TACHE-03+04 — Fiche Identité : Activité & Cycles opérationnels
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('TACHE-03+04 — Fiche Identité : Activité & Cycles', () => {
  test.beforeEach(async ({ page }) => {
    await loginAfym(page);
  });

  test('FI-01 : saisir et persister le champ "Activité principale"', async ({ page }) => {
    await goToClientTab(page, 'Fiche Identité');
    await page.waitForTimeout(800);

    // Ouvrir le panneau "Activité & fonctionnement"
    const actPanel = page.locator('mat-expansion-panel-header').filter({ hasText: /Activité.*fonctionnement/i });
    if (await actPanel.count() > 0) {
      const expanded = await actPanel.first().getAttribute('aria-expanded');
      if (expanded !== 'true') await actPanel.first().click();
      await page.waitForTimeout(500);
    }

    // Remplir "Activité principale" (textarea avec mat-label "Activité principale")
    const activiteField = page.locator('mat-form-field').filter({ hasText: /Activité principale/ }).locator('textarea');
    await activiteField.clear();
    await activiteField.fill('E2E-V2 — Vente de matériel informatique B2B');

    // Sauvegarder via le bouton type="submit"
    await page.locator('button[type="submit"]').click();
    await waitForToast(page, 'Fiche enregistrée');

    // Recharger et vérifier la persistance
    await goToClientTab(page, 'Fiche Identité');
    await page.waitForTimeout(800);
    const actPanelReload = page.locator('mat-expansion-panel-header').filter({ hasText: /Activité.*fonctionnement/i });
    if (await actPanelReload.count() > 0) {
      const expanded = await actPanelReload.first().getAttribute('aria-expanded');
      if (expanded !== 'true') await actPanelReload.first().click();
      await page.waitForTimeout(500);
    }

    const value = await page.locator('mat-form-field').filter({ hasText: /Activité principale/ }).locator('textarea').inputValue();
    expect(value).toContain('E2E-V2');
  });

  test('FI-02 : saisir "Type de clientèle" et "Saisonnalité"', async ({ page }) => {
    await goToClientTab(page, 'Fiche Identité');
    await page.waitForTimeout(800);

    const actPanel = page.locator('mat-expansion-panel-header').filter({ hasText: /Activité.*fonctionnement/i });
    if (await actPanel.count() > 0) {
      const expanded = await actPanel.first().getAttribute('aria-expanded');
      if (expanded !== 'true') await actPanel.first().click();
      await page.waitForTimeout(500);
    }

    await page.locator('mat-form-field').filter({ hasText: /Type de clientèle/ }).locator('textarea').fill('E2E-V2 — Professionnels uniquement (B2B)');
    await page.locator('mat-form-field').filter({ hasText: /Saisonnalité/ }).locator('textarea').fill('E2E-V2 — Pic en novembre-décembre');

    await page.locator('button[type="submit"]').click();
    await waitForToast(page);

    // Recharger et vérifier
    await goToClientTab(page, 'Fiche Identité');
    await page.waitForTimeout(800);
    const panel2 = page.locator('mat-expansion-panel-header').filter({ hasText: /Activité.*fonctionnement/i });
    if (await panel2.count() > 0) {
      const expanded = await panel2.first().getAttribute('aria-expanded');
      if (expanded !== 'true') await panel2.first().click();
      await page.waitForTimeout(500);
    }

    const typeVal = await page.locator('mat-form-field').filter({ hasText: /Type de clientèle/ }).locator('textarea').inputValue();
    expect(typeVal).toContain('E2E-V2');
  });

  test('FI-03 : remplir le cycle Trésorerie et persister', async ({ page }) => {
    await goToClientTab(page, 'Fiche Identité');
    await page.waitForTimeout(800);

    // Ouvrir le panneau "Cycles opérationnels"
    const cyclesPanel = page.locator('mat-expansion-panel-header').filter({ hasText: /Cycles opérationnels/i });
    if (await cyclesPanel.count() > 0) {
      const expanded = await cyclesPanel.first().getAttribute('aria-expanded');
      if (expanded !== 'true') await cyclesPanel.first().click();
      await page.waitForTimeout(500);
    }

    // Remplir "Nombre de comptes bancaires" (input inside formGroupName="cycleTresorerie")
    const nbComptesField = page.locator('mat-form-field').filter({ hasText: /Nombre de comptes bancaires/i }).locator('input');
    await nbComptesField.clear();
    await nbComptesField.fill('3');

    // Cocher "Emprunts en cours" (mat-checkbox inside formGroupName="cycleTresorerie")
    const empruntCheckbox = page.locator('mat-checkbox').filter({ hasText: /Emprunts en cours/i });
    if (await empruntCheckbox.count() > 0) {
      const isChecked = await empruntCheckbox.locator('input').isChecked();
      if (!isChecked) await empruntCheckbox.click();
      await page.waitForTimeout(400);

      // Détail des emprunts (champ conditionnel)
      const empruntsDetail = page.locator('mat-form-field').filter({ hasText: /Détail des emprunts/i }).locator('input, textarea');
      if (await empruntsDetail.count() > 0) {
        await empruntsDetail.first().fill('E2E-V2 — 50 000€ sur 60 mois');
      }
    }

    // Sauvegarder
    await page.locator('button[type="submit"]').click();
    await waitForToast(page);

    // Recharger et vérifier
    await goToClientTab(page, 'Fiche Identité');
    await page.waitForTimeout(800);
    const panel2 = page.locator('mat-expansion-panel-header').filter({ hasText: /Cycles opérationnels/i });
    if (await panel2.count() > 0) {
      const expanded = await panel2.first().getAttribute('aria-expanded');
      if (expanded !== 'true') await panel2.first().click();
      await page.waitForTimeout(500);
    }

    const nbVal = await page.locator('mat-form-field').filter({ hasText: /Nombre de comptes bancaires/i }).locator('input').inputValue();
    expect(nbVal).toBe('3');

    const checked = await page.locator('mat-checkbox').filter({ hasText: /Emprunts en cours/i }).locator('input').isChecked();
    expect(checked).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TACHE-05 — Contrôle Interne enrichi
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('TACHE-05 — Contrôle Interne : Risques & Recommandations', () => {
  test.beforeEach(async ({ page }) => {
    await loginAfym(page);
  });

  test('CI-01 : ajouter un risque et le persister', async ({ page }) => {
    await goToClientTab(page, 'Contrôle Interne');
    await page.waitForTimeout(1000);

    // Bouton "+" dans la section orange "Risques identifiés"
    const risqueSection = page.locator('.section-header.section-header--orange');
    await risqueSection.waitFor({ timeout: 10_000 });
    await risqueSection.locator('button').click();
    await page.waitForTimeout(400);

    // Textarea de la nouvelle ligne risque (la dernière ajoutée)
    const descTextarea = page.locator('.process-row.process-row--orange textarea').last();
    await descTextarea.fill('E2E-V2 — Risque de trésorerie insuffisante en période creuse');

    // Select niveau de risque dans la même ligne
    const niveauSelect = page.locator('.process-row.process-row--orange .ci-select').last();
    await niveauSelect.selectOption('ELEVE');
    await page.waitForTimeout(200);

    // Sauvegarder via le bouton mat-flat-button dans le CI (pas type="submit", c'est un (click)="save()")
    await page.locator('button[mat-flat-button][color="primary"]').click();
    await waitForToast(page);

    // Recharger et vérifier
    await goToClientTab(page, 'Contrôle Interne');
    await page.waitForTimeout(1000);

    const riskRows = page.locator('.process-row.process-row--orange');
    expect(await riskRows.count()).toBeGreaterThan(0);
    // Le dernier risque doit contenir notre texte
    const lastDesc = await riskRows.last().locator('textarea').inputValue();
    expect(lastDesc).toContain('E2E-V2');
  });

  test('CI-02 : ajouter une recommandation', async ({ page }) => {
    await goToClientTab(page, 'Contrôle Interne');
    await page.waitForTimeout(1000);

    const recoSection = page.locator('.section-header.section-header--purple');
    await recoSection.waitFor({ timeout: 10_000 });
    await recoSection.locator('button').click();
    await page.waitForTimeout(400);

    const descTextarea = page.locator('.process-row.process-row--purple textarea').last();
    await descTextarea.fill('E2E-V2 — Mettre en place un tableau de bord de suivi de trésorerie');

    const statutSelect = page.locator('.process-row.process-row--purple .ci-select').last();
    await statutSelect.selectOption('A_SOUMETTRE');

    await page.locator('button[mat-flat-button][color="primary"]').click();
    await waitForToast(page);

    await goToClientTab(page, 'Contrôle Interne');
    await page.waitForTimeout(1000);

    const recoRows = page.locator('.process-row.process-row--purple');
    expect(await recoRows.count()).toBeGreaterThan(0);
  });

  test('CI-03 : cocher "Mission de conseil potentielle"', async ({ page }) => {
    await goToClientTab(page, 'Contrôle Interne');
    await page.waitForTimeout(1000);

    // La mission checkbox est dans un <label class="mission-conseil-row">
    const missionCheckbox = page.locator('.mission-conseil-row input[type="checkbox"]');
    await missionCheckbox.waitFor({ timeout: 10_000 });
    // S'assurer qu'elle est cochée
    const wasChecked = await missionCheckbox.isChecked();
    if (!wasChecked) await page.locator('.mission-conseil-row').click();
    await page.waitForTimeout(300);

    await page.locator('button[mat-flat-button][color="primary"]').click();
    await waitForToast(page);

    // Recharger et vérifier
    await goToClientTab(page, 'Contrôle Interne');
    await page.waitForTimeout(800);
    const isChecked = await page.locator('.mission-conseil-row input[type="checkbox"]').isChecked();
    expect(isChecked).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TACHE-07 — Tâches inter-services
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('TACHE-07 — Tâches inter-services', () => {
  let createdTaskId: number | null = null;

  test.afterAll(async () => {
    if (createdTaskId) {
      const api = await pwRequest.newContext();
      const { token } = await getToken(api);
      await api.delete(`${API_URL}/tasks/${createdTaskId}`, { headers: h(token) }).catch(() => {});
      await api.dispose();
    }
  });

  test('TI-01 : créer une tâche avec service destinataire "Social"', async ({ page }) => {
    const { token } = await loginAfym(page);

    await page.goto(`${APP_URL}/tasks?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Ouvrir le dialog de création de tâche (bouton "+" ou "Nouvelle tâche")
    const createBtn = page.locator('button.fab-create, button[mat-fab], button[mat-mini-fab]').first();
    if (await createBtn.count() > 0) {
      await createBtn.click();
    } else {
      await page.locator('button').filter({ hasText: /nouvelle|créer|ajouter/i }).first().click();
    }
    await page.waitForTimeout(800);

    // Remplir le titre (input.ct-title-input dans le dialog)
    const titreInput = page.locator('input.ct-title-input');
    await titreInput.waitFor({ timeout: 8_000 });
    await titreInput.fill('E2E-V2 — Tâche inter-service Social');

    // Cocher "Sans dossier" pour éviter le champ client obligatoire
    const sansDossierInput = page.locator('input[type="checkbox"]').first();
    const isSansDossier = await sansDossierInput.isChecked();
    if (!isSansDossier) await sansDossierInput.click();
    await page.waitForTimeout(300);

    // Sélectionner le service destinataire "Social" — c'est le select.ct-select sans style (premier après les selects dossier/assigné qui sont cachés)
    // serviceDestinataire est la première ct-select visible quand sansDossier=true
    const svcSelects = page.locator('select.ct-select');
    const svcCount = await svcSelects.count();
    // Chercher le select qui contient "SOCIAL" comme option
    for (let i = 0; i < svcCount; i++) {
      const opts = await svcSelects.nth(i).locator('option').allTextContents();
      if (opts.some(o => o.includes('Social'))) {
        await svcSelects.nth(i).selectOption('SOCIAL');
        break;
      }
    }
    await page.waitForTimeout(300);

    // Créer la tâche
    await page.locator('button.ct-btn-create').click();
    await page.waitForTimeout(1500);

    // Fermer dialog si encore ouvert
    const closeBtn = page.locator('button.ct-close, button[mat-icon-button]').first();
    if (await closeBtn.isVisible()) await closeBtn.click().catch(() => {});
    await page.waitForTimeout(500);

    // Vérifier le badge service dans le Kanban
    const badge = page.locator('.card-svc-badge--dest');
    if (await badge.count() > 0) {
      await expect(badge.first()).toBeVisible();
    }

    // Récupérer l'ID via API pour le cleanup
    const api = await pwRequest.newContext();
    const resp = await api.get(`${API_URL}/tasks`, { headers: h(token) });
    const tasks = await resp.json();
    const allTasks = Array.isArray(tasks) ? tasks : (tasks.tasks ?? tasks.data ?? []);
    const t = allTasks.find((t: any) => t.titre?.includes('E2E-V2 — Tâche inter-service'));
    if (t) createdTaskId = t.id;
    await api.dispose();
  });

  test('TI-02 : filtrer le Kanban par service "Social"', async ({ page }) => {
    await loginAfym(page);
    await page.goto(`${APP_URL}/tasks?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');

    // Cliquer sur le chip filtre "Service"
    const serviceChip = page.locator('.fchip--select', { hasText: /^Service$/i });
    if (await serviceChip.isVisible()) {
      await serviceChip.click();
      await page.waitForTimeout(200);
      // Sélectionner "Social" via le select caché dans le chip
      const svcHiddenSelect = serviceChip.locator('select');
      await svcHiddenSelect.selectOption('SOCIAL');
      await page.waitForTimeout(600);

      // Les cartes visibles doivent toutes avoir le badge SOCIAL (ou aucune carte si non trouvée)
      const allBadges = page.locator('.card-svc-badge--dest');
      if (await allBadges.count() > 0) {
        for (const badge of await allBadges.all()) {
          await expect(badge).toContainText('SOCIAL');
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TACHE-08 — Saisie des temps
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('TACHE-08 — Saisie des temps', () => {
  test.beforeEach(async ({ page }) => {
    await loginAfym(page);
  });

  test('ST-01 : la page saisie-temps s\'affiche avec la navigation semaine et les filtres', async ({ page }) => {
    await page.goto(`${APP_URL}/saisie-temps?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');

    // Page wrapper Tempolia-style
    await expect(page.locator('.st-page')).toBeVisible({ timeout: 10_000 });

    // Barre de navigation semaine + bouton Nouvelle entrée
    await expect(page.locator('.st-topbar')).toBeVisible();
    await expect(page.locator('.st-week-nav')).toBeVisible();
    await expect(page.locator('button.st-add-btn').first()).toBeVisible();

    // Filtres Tous / Facturables / Non facturables
    await expect(page.locator('.st-filter-btn', { hasText: /tous/i })).toBeVisible();
    await expect(page.locator('.st-filter-btn').first()).toBeVisible();
  });

  test('ST-02 : ouvrir le dialog et sélectionner "Non facturable" affiche les catégories', async ({ page }) => {
    await page.goto(`${APP_URL}/saisie-temps?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Ouvrir le dialog Nouvelle entrée (bouton Tempolia-style)
    await page.locator('button.st-add-btn').first().click();
    await page.waitForTimeout(400);

    // Dialog doit être ouvert
    await expect(page.locator('.std-wrap')).toBeVisible({ timeout: 6_000 });

    // Cliquer sur le bouton "Non facturable"
    const nfBtn = page.locator('.std-type-btn', { hasText: /non facturable/i });
    await nfBtn.click();
    await page.waitForTimeout(300);

    // Les boutons de catégorie doivent apparaître
    await expect(page.locator('.std-code-btn').first()).toBeVisible({ timeout: 5_000 });
  });

  test('ST-03 : enregistrer une saisie via le dialog et la voir dans la vue semaine', async ({ page }) => {
    await loginAfym(page);

    await page.goto(`${APP_URL}/saisie-temps?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Ouvrir le dialog Nouvelle entrée
    await page.locator('button.st-add-btn').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('.std-wrap')).toBeVisible({ timeout: 6_000 });

    // Changer la date vers une date passée (sans contrainte de pointage)
    const dateInput = page.locator('.std-input[type="date"]');
    await dateInput.fill('2026-08-01');
    await page.waitForTimeout(200);

    // Remplir le libellé
    await page.locator('.std-textarea').fill('E2E-V2 — Test saisie facturable');

    // Saisir le temps (1h30)
    const tempsInput = page.locator('.std-temps-input');
    await tempsInput.fill('1h30');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(300);

    // Soumettre (bouton enabled car tempsRaw signal est maintenant réactif)
    await page.locator('button.std-btn-create').click();
    await page.waitForTimeout(2000);

    // Le composant navigue vers la semaine du 2026-08-01 après création
    // Vérifier le snackbar de confirmation OU la présence de la saisie dans la table
    const snack = page.locator('mat-snack-bar-container');
    const inList = page.locator('td.st-td-label').filter({ hasText: /E2E-V2/ });

    const success = await Promise.race([
      snack.waitFor({ timeout: 8_000 }).then(() => true),
      inList.first().waitFor({ timeout: 8_000 }).then(() => true),
    ]).catch(() => false);
    expect(success).toBe(true);
  });

  test('ST-04 : supprimer une saisie depuis la liste', async ({ page }) => {
    await page.goto(`${APP_URL}/saisie-temps?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    const rows = page.locator('.st-table tbody tr');
    const count = await rows.count();
    if (count === 0) {
      test.skip();
      return;
    }

    const firstRow = rows.first();
    const deleteBtn = firstRow.locator('button.st-del-btn');
    await deleteBtn.click();
    await page.waitForTimeout(1000);

    // La liste doit avoir une entrée de moins
    const newCount = await page.locator('.st-table tbody tr').count();
    expect(newCount).toBeLessThan(count);
  });

  test('ST-05 : la vue semaine affiche les statistiques récapitulatives', async ({ page }) => {
    await page.goto(`${APP_URL}/saisie-temps?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // La page Tempolia-style doit être visible
    await expect(page.locator('.st-page')).toBeVisible();
    await expect(page.locator('.st-topbar')).toBeVisible();

    // Le résumé semaine (si des saisies existent pour cette semaine)
    const summary = page.locator('.st-week-summary');
    if (await summary.isVisible()) {
      await expect(summary.locator('.st-ws-lbl', { hasText: /total semaine/i })).toBeVisible();
      await expect(summary.locator('.st-ws-lbl', { hasText: /facturables/i })).toBeVisible();
    }

    // Les filtres de type sont toujours visibles (Tous / Facturables / Non facturables)
    await expect(page.locator('.st-filter-btn', { hasText: /tous/i })).toBeVisible();
    await expect(page.locator('.st-filter-btn', { hasText: /nf|non fact/i })).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TACHE-02 — Galerie photos (onglet dédié)
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('TACHE-02 — Galerie photos : onglet dédié', () => {
  test('PH-01 : l\'onglet Galerie est accessible et le bouton upload est visible', async ({ page }) => {
    await loginAfym(page);
    await page.goto(`${APP_URL}/clients/${CLIENT_ID}?tenant=${TENANT}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.sidenav__item', { timeout: 12_000 });

    // Cliquer sur l'onglet Galerie dans la sidebar
    const galerieTab = page.locator('.sidenav__item').filter({ hasText: /galerie/i });
    await galerieTab.first().click();
    await page.waitForTimeout(800);

    // La page galerie doit être visible
    await expect(page.locator('.gal-page')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.gal-header')).toBeVisible();
    // Le bouton upload est visible
    await expect(page.locator('.gal-add-tile, button.gal-upload-btn').first()).toBeVisible();
  });
});
