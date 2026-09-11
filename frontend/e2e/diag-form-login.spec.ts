import { test, expect } from '@playwright/test';

test('form login test', async ({ page }) => {
  // Navigate to login page
  await page.goto('http://localhost:4200/login?tenant=afym');
  await page.waitForLoadState('networkidle');
  console.log('URL on login page:', page.url());
  
  // Fill login form
  await page.locator('input[type="email"], input[placeholder*="mail"], textbox').first().fill('admin@admin.com');
  await page.locator('input[type="password"], input[placeholder*="assword"]').first().fill('Admin2024!');
  await page.locator('button:has-text("Se connecter"), button[type="submit"]').first().click();
  
  await page.waitForLoadState('networkidle');
  console.log('URL after login:', page.url());
  
  // Now navigate to client
  await page.goto('http://localhost:4200/clients/21?tenant=afym');
  await page.waitForLoadState('networkidle');
  console.log('URL after client nav:', page.url());
  
  const sidenav = await page.locator('.sidenav__item').count();
  console.log('sidenav items:', sidenav);
});
