const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'assets');
const outPath = path.join(outDir, 'dashboard.png');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  await context.addInitScript(() => {
    const key = 'aqa_auth';
    const payload = {
      token: 'demo-token',
      user: { name: 'Admin User', role: 'admin', email: 'admin@school.edu' },
    };
    localStorage.setItem(key, JSON.stringify(payload));
  });

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/dashboard', { waitUntil: 'networkidle' });
  await page.waitForSelector('.dashboard-shell', { timeout: 15000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: outPath, fullPage: true });

  await browser.close();
  console.log(`Saved ${outPath}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
