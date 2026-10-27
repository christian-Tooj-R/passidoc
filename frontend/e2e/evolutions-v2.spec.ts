import { test, expect, request, APIRequestContext, Page } from '@playwright/test';
import * as fs from 'fs';
import { loginViaApi, API_URL, CLIENT_ID, TEST_TENANT } from './helpers/auth';
import { getToken, authHeaders } from './helpers/api';

/**
 * Parcours navigateur des évolutions v2 (cahier AFYM) :
 *  #2 double contact · #3 approche client · #7 intitulés des intervenants · #8 note de passation
 *  #5 pôle de travail dans l'agenda · #1 pièces manquantes et relance client.
 * Dossier de test CLIENT_ID, remis en état à la fin. L'envoi réel de la relance est intercepté :
 * aucun e-mail ne part.
 */
const MARQUE = `ZZV2-${Date.now()}`;
const EMAIL_OPER = 'compta.zzv2@example.com';
let api: APIRequestContext;
let token: string;
let ficheInitiale: any;
let typesInitiaux: any;
const H = () => authHeaders(token);

/** Samedi de la semaine affichée par l'agenda (dimanche si l'on est samedi) : jour sans pointage,
 *  la règle de cohérence plafonnant les saisies d'un jour pointé à la durée pointée. */
function jourDeLaSemaine(): string {
  const d = new Date();
  const cible = new Date(d);
  cible.setDate(d.getDate() + (d.getDay() === 6 ? 1 : 6 - ((d.getDay() + 6) % 7) - 1));
  return `${cible.getFullYear()}-${String(cible.getMonth() + 1).padStart(2, '0')}-${String(cible.getDate()).padStart(2, '0')}`;
}

async function ouvrirOnglet(page: Page, libelle: RegExp) {
  await page.goto(`/clients/${CLIENT_ID}?tenant=${TEST_TENANT}`);
  await page.waitForLoadState('networkidle');
  await page.locator('.sidenav__item', { hasText: libelle }).first().click();
}

/** Clic souris réel au centre de l'élément (le défilement automatique de Playwright se trompe sur cette page). */
async function cliquer(page: Page, sel: ReturnType<Page['locator']>) {
  await sel.scrollIntoViewIfNeeded();
  const b = (await sel.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

test.describe.serial('Évolutions v2 — parcours navigateur', () => {
  test.beforeAll(async () => {
    api = await request.newContext();
    token = await getToken(api);
    ficheInitiale = await (await api.get(`${API_URL}/clients/${CLIENT_ID}/fiche-identite`, { headers: H() })).json();
    typesInitiaux = (await (await api.get(`${API_URL}/clients/${CLIENT_ID}`, { headers: H() })).json()).typesFluxActifs ?? null;
    // Le dossier de test suit ses relevés bancaires : tous ceux de l'année échus manquent.
    expect((await api.patch(`${API_URL}/clients/${CLIENT_ID}`, { headers: H(), data: { typesFluxActifs: ['RELEVE_BANCAIRE'] } })).ok()).toBe(true);
  });

  test.afterAll(async () => {
    const r = await api.get(`${API_URL}/saisies-temps/rapport/detail?dateDebut=2020-01-01&dateFin=2030-12-31`, { headers: H() });
    for (const l of ((await r.json()).lignes ?? []).filter((x: any) => x.libelle?.includes(MARQUE))) {
      await api.delete(`${API_URL}/saisies-temps/${l.id}`, { headers: H() });
    }
    await api.patch(`${API_URL}/clients/${CLIENT_ID}/fiche-identite`, {
      headers: H(), data: {
        contactLegalNom: ficheInitiale?.contactLegalNom ?? '', contactLegalFonction: ficheInitiale?.contactLegalFonction ?? '',
        contactOperationnel: ficheInitiale?.contactOperationnel ?? {}, approcheClient: ficheInitiale?.approcheClient ?? 'PROFESSIONNEL',
      },
    });
    await api.patch(`${API_URL}/clients/${CLIENT_ID}`, { headers: H(), data: { typesFluxActifs: typesInitiaux } });
    await api.dispose();
  });

  test('#2 #3 — fiche identité : contact légal, contact opérationnel et approche client', async ({ page }) => {
    await loginViaApi(page);
    await ouvrirOnglet(page, /identit/i);
    const panneau = page.locator('mat-expansion-panel', { hasText: 'Contacts & relation client' });
    await expect(panneau.locator('.contact-card--legal')).toContainText('Contact légal');
    await expect(panneau.locator('.contact-card--oper')).toContainText('Contact opérationnel');
    // Hors mode édition, l'approche n'est pas modifiable
    await expect(panneau.locator('button.approche__opt--FORMEL')).toBeDisabled();

    await page.locator('.ch-edit-btn').click();
    await panneau.locator('input[formcontrolname="contactLegalNom"]').fill('RIVIERE Jean');
    await panneau.locator('input[formcontrolname="contactLegalFonction"]').fill('Président');
    const oper = panneau.locator('.contact-card--oper');
    await oper.locator('input[formcontrolname="nom"]').fill('Sophie Hoarau');
    await oper.locator('input[formcontrolname="poste"]').fill('Assistante administrative');
    await oper.locator('input[formcontrolname="telephone"]').fill('0262 11 22 33');
    await oper.locator('input[formcontrolname="email"]').fill('pas-un-mail');
    await panneau.locator('button.approche__opt--FORMEL').click();
    await page.locator('.ch-save-btn').click();
    await expect(page.locator('.toast-msg', { hasText: 'E-mail du contact opérationnel invalide' })).toBeVisible();

    await oper.locator('input[formcontrolname="email"]').fill(EMAIL_OPER);
    await page.locator('.ch-save-btn').click();
    await expect(page.locator('.toast-msg', { hasText: 'Fiche enregistrée' })).toBeVisible();

    // En-tête du dossier : approche et contact opérationnel visibles sans ouvrir la fiche
    await expect(page.locator('.hc-info__approche')).toContainText('Formel');
    await expect(page.locator('.hc-info__row', { hasText: 'Contact opérationnel' })).toContainText('Sophie Hoarau');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.hc-info__approche')).toContainText('Formel');
    const f = await (await api.get(`${API_URL}/clients/${CLIENT_ID}/fiche-identite`, { headers: H() })).json();
    expect(f).toMatchObject({ approcheClient: 'FORMEL', contactLegalNom: 'RIVIERE Jean', contactOperationnel: { email: EMAIL_OPER, nom: 'Sophie Hoarau' } });
  });

  test('#7 — intervenants : Directeur, Collaborateur Réunion, Collaborateur Madagascar', async ({ page }) => {
    await loginViaApi(page);
    await page.goto(`/clients/${CLIENT_ID}?tenant=${TEST_TENANT}`);
    const fonctions = page.locator('.hc-interv__fonc');
    await expect(fonctions.first()).toBeVisible();
    const textes = (await fonctions.allTextContents()).map(t => t.trim());
    expect(textes).toEqual(expect.arrayContaining(['Directeur', 'Collaborateur Réunion', 'Collaborateur Madagascar']));
    expect(textes.join(' ')).not.toMatch(/Pôle (EST|OUEST)/i);
    // Le site du dossier, lui, reste géographique
    await expect(page.locator('.hc-info__site')).toContainText(/Pôle (EST|OUEST)/);
  });

  test('#8 — note de passation : fiche d’identité + contacts + ADN, PDF A4', async ({ page }) => {
    await loginViaApi(page);
    await page.goto(`/clients/${CLIENT_ID}?tenant=${TEST_TENANT}`);
    await page.waitForLoadState('networkidle');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('.btn-pdf').click()]);
    expect(dl.suggestedFilename()).toBe('note-passation-Client-Test-Balance.pdf');
    const pdf = fs.readFileSync((await dl.path())!).toString('latin1');
    expect(pdf.startsWith('%PDF')).toBe(true);
    for (const t of ['NOTE DE PASSATION', "1. Fiche d'identit", '2. Contacts', 'Contact op', 'Sophie Hoarau', EMAIL_OPER, 'Approche client : Formel', '3. ADN entreprise']) {
      expect(pdf, t).toContain(t);
    }
    for (const t of ['ALERTES FLUX', 'FOURNISSEURS', 'ANALYSE FINANCI', 'Score de passation']) expect(pdf).not.toContain(t);
  });

  test('#5 — agenda : pôle choisi à la saisie, bandeau coloré, filtre et répartition par pôle', async ({ page }) => {
    await loginViaApi(page);
    await page.goto(`/travail/agenda?tenant=${TEST_TENANT}`);
    await expect(page.locator('.lieu-chip')).toHaveCount(4);

    await page.locator('.btn-new').click();
    const form = page.locator('app-saisie-edit-form');
    // Pôle par défaut : le site du collaborateur connecté (e2e@test.com → Est)
    await expect(form.locator('.lf-lieu__btn--EST')).toHaveAttribute('aria-checked', 'true');
    await form.locator('input[name="sefDate"]').fill(jourDeLaSemaine());
    await form.locator('input[name="sefDuree"]').fill('02:00');
    await form.locator('input[name="sefDebut"]').fill('09:00');
    await form.locator('input[name="sefFin"]').fill('11:00');
    await form.locator('input[name="sefCommentaire"]').fill(`${MARQUE} déplacement client`);
    await form.locator('.lf-lieu__btn--HORS_BUREAU').click();
    await form.locator('.lf-submit').click();
    await expect(form).toHaveCount(0);

    const ev = page.locator('.ev-block', { hasText: MARQUE });
    await expect(ev).toBeVisible();
    await expect(ev.locator('.ev-lieu')).toHaveCSS('background-color', 'rgb(147, 51, 234)');
    await expect(page.locator('.hd-lieu', { hasText: 'Hors' }).first()).toBeVisible();
    await expect(page.locator('.lieu-split')).toContainText('Hors bureau');

    await page.locator('.lieu-chip--EST').click();
    await expect(ev).toHaveCount(0);
    await page.locator('.lieu-chip--HORS_BUREAU').click();
    await expect(ev).toBeVisible();
    await page.locator('.lieu-chip--HORS_BUREAU').click(); // second clic : retour à « Tous les pôles »
    await page.locator('.ag-search input').fill('aucune-saisie-ne-correspond');
    await expect(ev).toHaveCount(0);
    await page.locator('.ag-search input').fill(MARQUE);
    await expect(ev).toBeVisible();
  });

  test('#5 — détail des temps : regroupement par pôle de travail', async ({ page }) => {
    await loginViaApi(page);
    await page.goto(`/travail/temps/detail?tenant=${TEST_TENANT}`);
    await page.waitForLoadState('networkidle');
    // La saisie « hors bureau » est datée du samedi : période jusqu'à la fin de l'année.
    await page.locator('.params input[type="date"]').nth(1).fill(`${new Date().getFullYear()}-12-31`);
    await page.locator('.params button', { hasText: 'Appliquer' }).click();
    const niveau1 = page.locator('.params__row--grp select').first();
    await niveau1.selectOption({ label: 'Pôle de travail' });
    await expect(page.locator('.grp__hd', { hasText: /Pôle EST|Pôle OUEST|Hors bureau/ }).first()).toBeVisible();
    await expect(page.locator('.grp__hd', { hasText: 'Hors bureau' }).first()).toBeVisible();
  });

  test('#1 — pièces manquantes : tableau de bord, relance rédigée selon l’approche, envoi', async ({ page }) => {
    let envoi: any = null;
    await page.route('**/api/clients/*/suivi-pieces/relance**', route => {
      if (route.request().method() !== 'POST') return route.continue();
      envoi = route.request().postDataJSON();
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
        envoyeA: EMAIL_OPER, destinataire: { nom: 'Sophie Hoarau', email: EMAIL_OPER, role: 'OPERATIONNEL' }, nbPieces: 3, dateRelance: new Date().toISOString(),
      }) });
    });
    await loginViaApi(page);
    await page.goto(`/pieces-manquantes?tenant=${TEST_TENANT}`);
    const ligne = page.locator('tbody tr', { hasText: 'Client Test Balance' });
    await expect(ligne).toBeVisible();
    if (new Date().getMonth() > 0) {
      await expect(ligne.locator('.ind')).toContainText(/À relancer|En attente/);
      await expect(ligne.locator('.piece').first()).toContainText('Relevés bancaires');
    }
    await expect(ligne.locator('.td-contact')).toContainText('Sophie Hoarau');
    await expect(ligne.locator('.td-contact .badge-approche')).toContainText('Formel');

    await cliquer(page, ligne.locator('.btn-relance'));
    const fenetre = page.locator('.rc');
    await expect(fenetre.locator('.rc-dest')).toContainText(EMAIL_OPER);
    await expect(fenetre.locator('.rc-dest')).toContainText('contact opérationnel');
    await expect(fenetre.locator('.rc-appr')).toContainText('Approche formel');
    await expect(fenetre.locator('textarea')).toHaveValue(/^Madame, Monsieur,/);
    await fenetre.locator('textarea').fill('Madame, Monsieur,\n\nTexte relu par le collaborateur.');
    await fenetre.locator('.rc-btn--ok').click();
    await expect(fenetre.locator('.rc-ok')).toContainText('Relance envoyée à Sophie Hoarau');
    expect(envoi).toMatchObject({ texte: 'Madame, Monsieur,\n\nTexte relu par le collaborateur.' });
  });

  test('#1 #3 — onglet Pilotage : relance et rappel de l’approche dans le menu de relance', async ({ page }) => {
    await loginViaApi(page);
    await ouvrirOnglet(page, /pilotage/i);
    await page.locator('.btn-relancer').click();
    await expect(page.locator('.rc .rc-appr')).toContainText('Approche formel');
    await page.locator('.rc-x').click();
    await expect(page.locator('.rc')).toHaveCount(0);
  });
});
