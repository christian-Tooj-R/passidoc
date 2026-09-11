import { test } from '@playwright/test';
import { request as pwRequest } from '@playwright/test';

const API_URL = 'http://localhost:3000/api';
const APP_URL = 'http://localhost:4202';
const TENANT  = 'afym';

test('diag network - catch all 401', async ({ page }) => {
  const api = await pwRequest.newContext();
  const res  = await api.post(`${API_URL}/auth/login`, {
    headers: { 'x-tenant-slug': TENANT },
    data: { email: 'admin@admin.com', password: 'Admin2024!' },
  });
  const body  = await res.json();
  const token = body.access_token;

  // Écouter toutes les réponses réseau
  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log(`[${resp.status()}] ${resp.request().method()} ${resp.url()}`);
    }
  });
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('JS ERROR:', msg.text());
  });

  await page.goto(`${APP_URL}/login?tenant=${TENANT}`);
  await page.waitForLoadState('domcontentloaded');
  
  await page.evaluate(({ token, user, tenant }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('tenant_slug', tenant);
  }, { token, user: body.user, tenant: TENANT });

  console.log('--- Navigating to dashboard ---');
  await page.goto(`${APP_URL}/dashboard?tenant=${TENANT}`);
  await page.waitForLoadState('networkidle');
  console.log('Final URL:', page.url());
  
  await api.dispose();
});
