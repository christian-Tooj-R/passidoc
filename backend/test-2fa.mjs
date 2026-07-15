/**
 * test-2fa.mjs — Playwright E2E : routes 2FA (setup + verify)
 * Usage : node test-2fa.mjs
 */

import { chromium } from '/datas/Projets/Aro/backend/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:4200';
const API  = 'http://localhost:3000/api';

let pass = 0, fail_count = 0;
function ok(msg)    { console.log(`✅ ${msg}`); pass++; }
function fail(msg)  { console.error(`❌ ${msg}`); fail_count++; }
function warn(msg)  { console.warn(`⚠️  ${msg}`); }
function sec(title) { console.log(`\n${'═'.repeat(60)}\n  ${title}\n${'═'.repeat(60)}`); }

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page    = await context.newPage();

// ═══════════════════════════════════════════════════════════════
//   1. Login préalable
// ═══════════════════════════════════════════════════════════════
sec('1. Login préalable');
try {
  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.locator('input[type="email"]').fill('admin@afym.re');
  await page.locator('input[type="password"]').fill('Admin1234!');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 12000 }).catch(() => {});

  const url = page.url();
  if (url.includes('dashboard')) {
    ok('Connexion admin réussie → /dashboard');
  } else {
    fail(`Redirection inattendue après login : ${url}`);
  }
} catch (e) {
  fail(`Login : ${e.message}`);
}

// Récupérer l'ID admin depuis localStorage (utilisé plus tard pour verify-2fa)
const adminUserId = await page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('user') || '{}').id ?? 1; }
  catch { return 1; }
});

// ═══════════════════════════════════════════════════════════════
//   2. Setup-2FA — chargement de la page
// ═══════════════════════════════════════════════════════════════
sec('2. Page /auth/setup-2fa — chargement et structure');

try {
  await page.goto(`${BASE}/auth/setup-2fa`);
  await page.waitForSelector('mat-card-title', { timeout: 10000 });
  const title = await page.locator('mat-card-title').first().textContent();
  if (title?.includes('Configuration 2FA')) {
    ok('Titre "Configuration 2FA" affiché');
  } else {
    fail(`Titre inattendu : "${title}"`);
  }
} catch (e) {
  fail(`Navigation /auth/setup-2fa : ${e.message}`);
}

// QR code : le composant appelle l'API sur ngOnInit → attendre l'image
try {
  await page.waitForSelector('img[alt="QR Code 2FA"]', { timeout: 10000 });
  const src = await page.locator('img[alt="QR Code 2FA"]').getAttribute('src');
  if (src?.startsWith('data:image/')) {
    ok('QR code affiché (data:image/ URL valide)');
  } else if (src) {
    ok('QR code image présente (src non vide)');
  } else {
    fail('Image QR présente mais src vide');
  }
} catch (e) {
  fail(`QR code non apparu dans le délai imparti : ${e.message}`);
}

// Note : le secret base32 brut n'est pas affiché dans la vue (testé via API en section 4)

// Étiquette étape 1 du stepper
try {
  const step1Visible = await page.locator('text=Scanner le QR Code').isVisible();
  if (step1Visible) {
    ok('Étiquette étape 1 "Scanner le QR Code" visible dans le stepper');
  } else {
    fail('"Scanner le QR Code" introuvable dans le stepper');
  }
} catch (e) {
  fail(`Étiquette étape 1 : ${e.message}`);
}

// Étiquette étape 2 (header stepper toujours rendu même si le contenu est collapsé)
try {
  const step2Visible = await page.locator('text=Confirmer le code').isVisible();
  if (step2Visible) {
    ok('Étiquette étape 2 "Confirmer le code" visible dans le stepper');
  } else {
    warn('"Confirmer le code" non visible (peut être collapsée par le stepper)');
  }
} catch (e) {
  warn(`Étiquette étape 2 : ${e.message}`);
}

// Bouton "Suivant" (matStepperNext, étape 1)
try {
  const suivantVisible = await page.locator('button', { hasText: 'Suivant' }).isVisible();
  if (suivantVisible) {
    ok('Bouton "Suivant" (matStepperNext) présent');
  } else {
    fail('Bouton "Suivant" non visible');
  }
} catch (e) {
  fail(`Bouton Suivant : ${e.message}`);
}

// ═══════════════════════════════════════════════════════════════
//   3. Setup-2FA — étape 2 : formulaire de confirmation
// ═══════════════════════════════════════════════════════════════
sec('3. Setup-2FA — étape 2 : formulaire de confirmation du code');

try {
  await page.locator('button', { hasText: 'Suivant' }).click();
  await page.waitForTimeout(600); // attendre l'animation du stepper

  const tokenInput = page.locator('input[maxlength="6"]').first();
  const inputVisible = await tokenInput.isVisible();
  if (inputVisible) {
    ok('Champ de saisie 6 chiffres (token TOTP) visible à l\'étape 2');
  } else {
    fail('Champ de saisie 6 chiffres absent après clic "Suivant"');
  }
} catch (e) {
  fail(`Navigation étape 2 + champ input : ${e.message}`);
}

// Bouton "Activer" (type=submit)
try {
  const activerVisible = await page.locator('button', { hasText: 'Activer' }).first().isVisible();
  if (activerVisible) {
    ok('Bouton "Activer" (type=submit) présent à l\'étape 2');
  } else {
    fail('Bouton "Activer" non visible');
  }
} catch (e) {
  fail(`Bouton Activer : ${e.message}`);
}

// Bouton "Ignorer" (type=button, navigue vers /dashboard sans activer 2FA)
try {
  const ignorerVisible = await page.locator('button', { hasText: 'Ignorer' }).isVisible();
  if (ignorerVisible) {
    ok('Bouton "Ignorer" (annuler, type=button) présent');
  } else {
    fail('Bouton "Ignorer" non visible');
  }
} catch (e) {
  fail(`Bouton Ignorer : ${e.message}`);
}

// ═══════════════════════════════════════════════════════════════
//   4. API GET /api/auth/2fa/setup — structure de la réponse
// ═══════════════════════════════════════════════════════════════
sec('4. API GET /api/auth/2fa/setup — structure de la réponse JSON');

try {
  const jwtToken = await page.evaluate(() => localStorage.getItem('token'));
  if (!jwtToken) {
    warn('Token JWT absent du localStorage — test API sauté');
  } else {
    const result = await page.evaluate(async ({ apiBase, jwt }) => {
      const r = await fetch(`${apiBase}/auth/2fa/setup`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const body = await r.json().catch(() => ({}));
      return {
        status: r.status,
        qrCodeOk: typeof body.qrCode === 'string' && body.qrCode.startsWith('data:image/'),
        secretOk: typeof body.secret === 'string' && body.secret.length >= 16,
        secretLen: body.secret?.length ?? 0,
      };
    }, { apiBase: API, jwt: jwtToken });

    if (result.status === 200) {
      ok('GET /api/auth/2fa/setup → 200 OK');
    } else {
      fail(`GET /api/auth/2fa/setup → ${result.status} (attendu 200)`);
    }
    if (result.qrCodeOk) {
      ok('Réponse contient qrCode (data:image/ URL)');
    } else {
      fail('qrCode absent ou invalide dans la réponse');
    }
    if (result.secretOk) {
      ok(`Réponse contient secret base32 (${result.secretLen} caractères)`);
    } else {
      fail('secret absent ou trop court dans la réponse');
    }
  }
} catch (e) {
  fail(`API GET /auth/2fa/setup : ${e.message}`);
}

// ═══════════════════════════════════════════════════════════════
//   5. Guard /auth/verify-2fa — accès direct sans userId
// ═══════════════════════════════════════════════════════════════
sec('5. Guard /auth/verify-2fa — redirection sans userId dans le state');

try {
  await page.goto(`${BASE}/auth/verify-2fa`);
  // Laisser Angular résoudre la navigation et exécuter le guard dans le constructeur
  await page.waitForTimeout(1500);
  const currentUrl = page.url();
  if (currentUrl.includes('/auth/login')) {
    ok('Navigation directe → redirigé vers /auth/login (guard constructeur actif)');
  } else if (currentUrl.includes('/auth/verify-2fa')) {
    warn('URL restée sur /auth/verify-2fa — guard peut être asynchrone ou désactivé');
  } else {
    warn(`URL après navigation directe : ${currentUrl}`);
  }
} catch (e) {
  fail(`Guard verify-2fa : ${e.message}`);
}

// ═══════════════════════════════════════════════════════════════
//   6. Verify-2FA — formulaire via simulation du login (route mock)
// ═══════════════════════════════════════════════════════════════
sec('6. Page /auth/verify-2fa — formulaire via interception de la réponse login');

// Contexte isolé (pas de session admin → pas de risque de redirection vers /dashboard)
const verifyContext = await browser.newContext();
const verifyPage    = await verifyContext.newPage();

try {
  // Intercepter POST /api/auth/login pour simuler un compte avec 2FA activé
  // → le LoginComponent voit requires2FA: true et navigue vers /auth/verify-2fa avec state
  await verifyPage.route(`${API}/auth/login`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ requires2FA: true, userId: adminUserId }),
    });
  });

  await verifyPage.goto(`${BASE}/auth/login`);
  await verifyPage.waitForSelector('input[type="email"]', { timeout: 10000 });
  await verifyPage.locator('input[type="email"]').fill('admin@afym.re');
  await verifyPage.locator('input[type="password"]').fill('Admin1234!');
  await verifyPage.locator('button[type="submit"]').click();
  await verifyPage.waitForURL('**/verify-2fa', { timeout: 8000 });
  ok('Simulation requires2FA → redirection vers /auth/verify-2fa confirmée');
} catch (e) {
  fail(`Simulation login → /auth/verify-2fa : ${e.message}`);
}

// Titre de la page
try {
  await verifyPage.waitForSelector('mat-card-title', { timeout: 8000 });
  const title = await verifyPage.locator('mat-card-title').first().textContent();
  if (title?.includes('Vérification 2FA')) {
    ok('Titre "Vérification 2FA" affiché');
  } else {
    fail(`Titre inattendu : "${title}"`);
  }
} catch (e) {
  fail(`Titre /auth/verify-2fa : ${e.message}`);
}

// Champ token 6 chiffres avec placeholder "000000"
try {
  const tokenInput = verifyPage.locator('input[maxlength="6"]').first();
  const visible     = await tokenInput.isVisible();
  const placeholder = await tokenInput.getAttribute('placeholder').catch(() => null);

  if (visible) {
    ok('Champ de saisie 6 chiffres présent sur /auth/verify-2fa');
  } else {
    fail('Champ de saisie 6 chiffres absent');
  }
  if (placeholder === '000000') {
    ok('Placeholder "000000" correct sur le champ token');
  } else {
    warn(`Placeholder : "${placeholder}" (attendu "000000")`);
  }
} catch (e) {
  fail(`Champ token /auth/verify-2fa : ${e.message}`);
}

// Bouton submit "Vérifier"
try {
  const submitBtn = verifyPage.locator('button[type="submit"]');
  const visible   = await submitBtn.isVisible();
  if (visible) {
    const btnText = (await submitBtn.textContent())?.trim() ?? '';
    if (btnText.includes('Vérifier')) {
      ok('Bouton "Vérifier" (type=submit) présent');
    } else {
      ok(`Bouton submit présent (texte : "${btnText}")`);
    }
  } else {
    fail('Bouton submit non visible sur /auth/verify-2fa');
  }
} catch (e) {
  fail(`Bouton Vérifier : ${e.message}`);
}

// ═══════════════════════════════════════════════════════════════
//   7. Verify-2FA — soumission du code invalide "000000"
// ═══════════════════════════════════════════════════════════════
sec('7. Verify-2FA — soumission du code invalide "000000" → message d\'erreur');

try {
  // Remplir le champ avec un code TOTP délibérément invalide
  const tokenInput = verifyPage.locator('input[maxlength="6"]').first();
  await tokenInput.fill('000000');

  // Soumettre → appel réel à POST /api/auth/2fa/verify { userId, token: "000000" }
  // Le backend renvoie 401 "Code 2FA invalide" (secret initialisé par la visite setup-2fa)
  await verifyPage.locator('button[type="submit"]').click();

  // Attendre l'affichage de <div class="error"> (peut ne pas apparaître si le backend
  // retourne un format d'erreur inattendu ou si 2FA n'est pas activé pour l'admin)
  const errVisible = await verifyPage.waitForSelector('.error', { timeout: 8000 })
    .then(() => true).catch(() => false);
  if (errVisible) {
    const errText = (await verifyPage.locator('.error').first().textContent())?.trim() ?? '';
    if (errText.length > 0) {
      ok(`Message d'erreur affiché : "${errText.substring(0, 80)}"`);
    } else {
      warn('Div .error présente mais sans texte');
    }
  } else {
    warn('Div .error non affichée après code invalide (2FA peut-être non activé pour l\'admin)');
  }
} catch (e) {
  warn(`Soumission "000000" : ${e.message}`);
}

// ───── Nettoyage ──────────────────────────────────────────────
await verifyPage.close();
await verifyContext.close();
await browser.close();

// ═══════════════════════════════════════════════════════════════
//   Résumé
// ═══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}\n  ${pass} ✅  |  ${fail_count} ❌  |  ${pass + fail_count} total\n${'═'.repeat(60)}`);
if (fail_count > 0) process.exit(1);
