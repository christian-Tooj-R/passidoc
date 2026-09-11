import { test, expect } from '@playwright/test';

// Tests du module Paie (employés des CLIENTS d'AFYM — à ne pas confondre avec le module RH interne).
// Compte e2e@test.com / Test1234! (ADMIN)
// Parcours couvert : ouvrir l'onglet Paie d'un dossier client → ajouter un employé →
// saisir les variables du mois → calculer un aperçu → générer le bulletin → le retrouver
// dans l'historique.

async function login(page: any) {
  const resp = await page.request.post('http://localhost:3000/api/auth/login', {
    data: { email: 'e2e@test.com', password: 'Test1234!' },
  });
  const body = await resp.json();
  await page.goto('/');
  await page.evaluate(({ t, u }: { t: string; u: any }) => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', JSON.stringify(u));
  }, { t: body.access_token, u: body.user });
  return body;
}

async function getFirstClientId(page: any, token: string): Promise<number> {
  const resp = await page.request.get('http://localhost:3000/api/clients', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const clients = await resp.json();
  expect(Array.isArray(clients) && clients.length > 0).toBeTruthy();
  return clients[0].id;
}

test.describe('Module Paie — employés clients', () => {
  test('Parcours complet : créer un employé, saisir les variables, générer le bulletin', async ({ page }) => {
    const { access_token } = await login(page);
    const clientId = await getFirstClientId(page, access_token);

    await page.goto(`/clients/${clientId}`);
    await page.waitForTimeout(2000);

    // Fermer un éventuel backdrop de pointage qui bloquerait les clics
    const backdrop = page.locator('.pointage-backdrop');
    if (await backdrop.isVisible().catch(() => false)) {
      const btn = page.locator('.pm-btn').first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        await page.waitForTimeout(500);
      }
    }

    // Ouvrir l'onglet Paie (groupe "RH & Paie")
    await page.getByText('Paie', { exact: true }).first().click();
    await expect(page.locator('.paie-tab')).toBeVisible({ timeout: 8_000 });

    // Ajouter un employé
    const suffix = Date.now().toString().slice(-6);
    await page.locator('input[name="matricule"]').fill(`E2E-${suffix}`);
    await page.locator('input[name="nom"]').fill('TestNom');
    await page.locator('input[name="prenom"]').fill('TestPrenom');
    await page.locator('input[name="poste"]').fill('Testeur QA');
    await page.locator('input[name="salaireBase"]').fill('2000');
    await page.getByRole('button', { name: /Ajouter$/ }).click();
    await page.waitForTimeout(1500);

    // Sélectionner l'employé fraîchement créé — cible par le matricule unique (le nom
    // "TestPrenom TestNom" seul peut matcher plusieurs employés créés par des runs précédents)
    const matricule = `E2E-${suffix}`;
    await expect(page.locator('.employe-item', { hasText: matricule })).toBeVisible({ timeout: 5_000 });
    await page.locator('.employe-item', { hasText: matricule }).click();
    await expect(page.locator('.paie-detail')).toBeVisible({ timeout: 5_000 });

    // Saisir une prime pour le mois courant
    await page.getByRole('button', { name: 'Ajouter une ligne' }).first().click();
    await page.locator('.ligne-libre__libelle').first().fill('Prime E2E');
    await page.locator('.ligne-libre__montant').first().fill('50');

    // Calculer l'aperçu
    await page.getByRole('button', { name: /Calculer/ }).click();
    await expect(page.locator('.resultat')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.resultat-table__net')).toContainText('€');

    // Générer le bulletin définitif
    await page.getByRole('button', { name: /Générer le bulletin/ }).click();
    await page.waitForTimeout(1500);
    await expect(page.locator('.bulletin-item').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('.bulletin-item').first()).toContainText('Net à payer');
  });
});
