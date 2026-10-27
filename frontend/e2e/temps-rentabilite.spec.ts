import { test, expect, request, APIRequestContext } from '@playwright/test';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { loginViaApi, API_URL, CLIENT_ID, TEST_TENANT } from './helpers/auth';
import { getToken, authHeaders } from './helpers/api';

/**
 * Parcours navigateur des évolutions « temps passés / honoraires » (cahier v2 #4 et #6) :
 * rapport Tempolia, affaire modifiable, rentabilité du dossier, tableau de bord, prix de
 * vente horaire, tri / tranches d'honoraires. Utilise le dossier de test CLIENT_ID et remet
 * en état tout ce qu'il modifie (saisies, budget, honoraires, tarif) — sauf le taux figé
 * des anciennes saisies du compte de test lors de la pose du tarif (comportement voulu).
 */
const MARQUE = `ZZUI-${Date.now()}`;
const AFFAIRE = 'C2026-12'; // dossier de test sans date de clôture → 31/12
// Une révision (REV) faite dans les 6 mois qui suivent une clôture reste sur l'exercice clos
// (règle d'attribution validée) : la saisie REV du 11/03/2026 va donc sur l'exercice 2025.
const AFFAIRE_REVISION = 'C2025-12';
const ADMIN_ID = 4;         // e2e@test.com

let api: APIRequestContext;
let token: string;
let saisies: number[] = [];
let honorairesInitiaux: any;

const H = () => authHeaders(token);

async function rapport() {
  const r = await api.get(`${API_URL}/saisies-temps/rapport/detail?dateDebut=2026-01-01&dateFin=2026-12-31&clientIds=${CLIENT_ID}`, { headers: H() });
  return (await r.json()).lignes as any[];
}

test.describe.serial('Temps passés & rentabilité — parcours navigateur', () => {
  test.beforeAll(async () => {
    api = await request.newContext();
    token = await getToken(api);
    const fiche = await (await api.get(`${API_URL}/clients/${CLIENT_ID}/fiche-identite`, { headers: H() })).json();
    honorairesInitiaux = fiche?.honoraires ?? {};
    await api.patch(`${API_URL}/clients/${CLIENT_ID}/fiche-identite`, { headers: H(), data: { honoraires: { ...honorairesInitiaux, comptables: 4200 } } });
    for (const [date, h, mission] of [['2026-03-10', 2, 'TCO'], ['2026-03-11', 1.5, 'REV']] as const) {
      const r = await api.post(`${API_URL}/saisies-temps`, {
        headers: H(), data: { date, dureeHeures: h, type: 'FACTURABLE', clientId: CLIENT_ID, missionCode: mission, commentaire: `${MARQUE} ${mission}` },
      });
      expect(r.status()).toBe(201);
      saisies.push((await r.json()).id);
    }
  });

  test.afterAll(async () => {
    for (const id of saisies) await api.delete(`${API_URL}/saisies-temps/${id}`, { headers: H() });
    await api.delete(`${API_URL}/saisies-temps/rentabilite/dossier/${CLIENT_ID}/budget/${AFFAIRE}`, { headers: H() });
    await api.patch(`${API_URL}/clients/${CLIENT_ID}/fiche-identite`, { headers: H(), data: { honoraires: honorairesInitiaux } });
    await api.patch(`${API_URL}/users/${ADMIN_ID}/prix-vente`, { headers: H(), data: { prixVenteHoraire: null } });
    await api.dispose();
  });

  test('fiche salarié : l’ADMIN pose le prix de vente horaire, figé sur les saisies', async ({ page }) => {
    await loginViaApi(page);
    await page.goto(`/rh/salaries/${ADMIN_ID}?tenant=${TEST_TENANT}`);
    // Fiche salarié › sous-onglet « Paie » (à ne pas confondre avec la section « Contrat & Paie »)
    await page.locator('button.ptab', { hasText: 'Paie' }).click();
    const champ = page.locator('input.pv-input');
    await champ.fill('75');
    await page.locator('button.pv-btn').click();
    await expect(page.getByText('Enregistré')).toBeVisible();
    const lignes = await rapport();
    const miennes = lignes.filter(l => l.libelle?.startsWith(MARQUE));
    expect(miennes.map(l => [l.tauxHoraire, l.tauxFige, l.pv])).toEqual(expect.arrayContaining([[75, true, 150], [75, true, 112.5]]));
  });

  test('détail des temps : regroupement Tempolia, PV Col, regroupements et exports', async ({ page }) => {
    await loginViaApi(page);
    await page.goto(`/travail/temps/detail?tenant=${TEST_TENANT}`);
    await page.locator('select').filter({ hasText: 'Année en cours' }).selectOption('');
    await page.locator('input[type="date"]').nth(0).fill('2026-01-01');
    await page.locator('input[type="date"]').nth(1).fill('2026-12-31');
    await page.getByRole('button', { name: /Appliquer/ }).click();
    await page.getByPlaceholder('Libellé, client, collaborateur, affaire…').fill(MARQUE);

    await expect(page.locator('.grp__hd').filter({ hasText: 'Présence : Présence facturable' })).toBeVisible();
    await expect(page.locator('.grp__hd').filter({ hasText: `Affaire : ${AFFAIRE}` })).toBeVisible();
    // TCO 2h → affaire en cours ; REV 1h30 → exercice précédent (révision post-clôture)
    await expect(page.locator('tr.sub-total').filter({ hasText: `Total ${AFFAIRE}` })).toContainText('2h00');
    await expect(page.locator('tr.sub-total').filter({ hasText: `Total ${AFFAIRE}` })).toContainText('150,00');
    await expect(page.locator('tr.sub-total').filter({ hasText: `Total ${AFFAIRE_REVISION}` })).toContainText('1h30');
    await expect(page.locator('tr.sub-total').filter({ hasText: `Total ${AFFAIRE_REVISION}` })).toContainText('112,50');
    await expect(page.locator('.grand-total')).toContainText('3h30');
    await expect(page.locator('.grand-total')).toContainText('262,50 €');

    // Regroupement par collaborateur puis tâche, sans lignes de détail
    await page.locator('select').filter({ hasText: 'Présence facturable / non facturable' }).first().selectOption('collaborateur');
    await page.locator('select').filter({ hasText: 'Client / TNF' }).nth(1).selectOption('mission');
    await page.getByRole('button', { name: 'Non', exact: true }).click();
    await expect(page.locator('tr.data-row')).toHaveCount(0);
    await expect(page.locator('.grp__hd').filter({ hasText: 'Tâche : Révision des comptes' })).toContainText('1h30');

    const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Excel/ }).click()]);
    const chemin = await xlsx.path();
    const wb = XLSX.read(fs.readFileSync(chemin!));
    const detail = XLSX.utils.sheet_to_json<any>(wb.Sheets['Détail']);
    expect(detail).toHaveLength(2);
    expect(detail.map(r => r['PV Col']).sort()).toEqual([112.5, 150]);
    expect(detail.map(r => r['Affaire']).sort()).toEqual([AFFAIRE_REVISION, AFFAIRE]);
    expect(wb.SheetNames).toContain('Sous-totaux');

    const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /PDF/ }).click()]);
    const contenu = fs.readFileSync((await pdf.path())!);
    expect(contenu.subarray(0, 5).toString()).toBe('%PDF-');
    expect(contenu.length).toBeGreaterThan(5000);
  });

  test("détail des temps : l'affaire d'une saisie se change dans le formulaire", async ({ page }) => {
    await loginViaApi(page);
    await page.goto(`/travail/temps/detail?tenant=${TEST_TENANT}`);
    await page.locator('select').filter({ hasText: 'Année en cours' }).selectOption('');
    await page.locator('input[type="date"]').nth(0).fill('2026-01-01');
    await page.locator('input[type="date"]').nth(1).fill('2026-12-31');
    await page.getByRole('button', { name: /Appliquer/ }).click();
    await page.getByPlaceholder('Libellé, client, collaborateur, affaire…').fill(`${MARQUE} TCO`);
    await page.locator('tr.data-row button[title="Modifier"]').first().click();
    const select = page.locator('app-saisie-edit-form select[name="sefAffaire"]');
    await expect(select).toHaveValue(/C2026-12/);
    await select.selectOption({ label: 'C2025-12 — clôturée' });
    await page.locator('app-saisie-edit-form').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('app-saisie-edit-form')).toHaveCount(0);
    expect((await rapport()).find(l => l.id === saisies[0])?.affaire).toBe('C2025-12');

    // Retour en automatique
    await page.locator('tr.data-row button[title="Modifier"]').first().click();
    await page.locator('app-saisie-edit-form select[name="sefAffaire"]').selectOption({ label: 'Automatique (selon la date)' });
    await page.locator('app-saisie-edit-form').getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('app-saisie-edit-form')).toHaveCount(0);
    expect((await rapport()).find(l => l.id === saisies[0])?.affaire).toBe(AFFAIRE);
  });

  test('onglet Rentabilité du dossier : budget, bandeau de dépassement, suppression', async ({ page }) => {
    await loginViaApi(page);
    await page.goto(`/clients/${CLIENT_ID}?tab=rentabilite&tenant=${TEST_TENANT}`);
    await expect(page.getByText(`Budget de l'affaire ${AFFAIRE}`)).toBeVisible();

    await page.getByPlaceholder('ex. 60 ou 60h30').fill('n’importe quoi');
    await page.getByRole('button', { name: 'Enregistrer' }).last().click();
    await expect(page.getByText('Budget temps invalide')).toBeVisible();

    // Budget inférieur au temps déjà passé sur l'affaire → dépassement
    await page.getByPlaceholder('ex. 60 ou 60h30').fill('1h30');
    await page.getByRole('button', { name: 'Enregistrer' }).last().click();
    await expect(page.locator('.alert--DEPASSE')).toBeVisible();
    await expect(page.locator('.statut--DEPASSE').first()).toBeVisible();
    await expect(page.getByText('Prix de vente / h (calculé)')).toBeVisible();
    // honoraires de la fiche (4 200 €) ÷ 1,5 h
    await expect(page.locator('.tile').filter({ hasText: 'Prix de vente / h' })).toContainText('2 800,00 €');

    const notifs = await (await api.get(`${API_URL}/notifications`, { headers: H() })).json().catch(() => []);
    if (Array.isArray(notifs)) expect(notifs.some((n: any) => n.type === 'BUDGET_DOSSIER_DEPASSE' && n.clientId === CLIENT_ID)).toBe(true);

    page.once('dialog', d => d.accept());
    await page.getByRole('button', { name: 'Supprimer le budget' }).click();
    await expect(page.locator('.alert--DEPASSE')).toHaveCount(0);
    await expect(page.locator('.statut--NON_BUDGETE').first()).toBeVisible();
  });

  test('tableau de bord Rentabilité : ligne du dossier et lien vers son onglet', async ({ page }) => {
    await api.post(`${API_URL}/saisies-temps/rentabilite/dossier/${CLIENT_ID}/budget`, { headers: H(), data: { affaire: AFFAIRE, heuresBudget: 100 } });
    await loginViaApi(page);
    await page.goto(`/travail/rentabilite?tenant=${TEST_TENANT}`);
    await page.locator('select').filter({ hasText: '2026' }).first().selectOption('2026');
    const ligne = page.locator('tr.data-row').filter({ hasText: 'Client Test Balance' });
    await expect(ligne).toBeVisible();
    await expect(ligne).toContainText(AFFAIRE);
    await expect(ligne).toContainText('Dans les clous');
    await expect(ligne).toContainText('4 200,00');
    await ligne.getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/clients/${CLIENT_ID}\\?tab=rentabilite`));
    await expect(page.getByText(`Budget de l'affaire ${AFFAIRE}`)).toBeVisible();
  });

  test('liste des dossiers : badge, tri et tranches d’honoraires', async ({ page }) => {
    await loginViaApi(page);
    await page.goto(`/clients?tenant=${TEST_TENANT}`);
    const carte = page.locator('.hon-badge').filter({ hasText: '4 200 €' });
    await expect(carte.first()).toBeVisible();
    await page.getByRole('button', { name: /Filtrer/ }).click();
    await page.getByRole('button', { name: /1 000 – 5 000 €/ }).click();
    await expect(page.getByText('Client Test Balance').first()).toBeVisible();
    await page.getByRole('button', { name: /> 5 000 €/ }).click();
    await expect(page.getByText('Client Test Balance')).toHaveCount(0);
    // bornes personnalisées : 4 200 € passe dans la tranche haute si la borne haute est à 4 000 €
    await page.locator('.fp-seuils input').nth(1).fill('4000');
    await expect(page.getByText('Client Test Balance').first()).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: /Filtrer/ }).click();
    await expect(page.locator('.fp-seuils input').nth(1)).toHaveValue('4000');
    await page.locator('.fp-seuils input').nth(1).fill('5000');
  });
});
