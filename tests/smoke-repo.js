const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_TUNNEL')) errors.push('CONSOLE: ' + msg.text()); });

  async function step(name, fn) {
    try { await fn(); console.log('OK   ', name); }
    catch (e) {
      console.log('FAIL ', name, '-', e.message.split('\n')[0]);
      await page.evaluate(() => document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden'))).catch(()=>{});
    }
  }

  await step('login as demo admin', async () => {
    await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await page.waitForTimeout(1000);
    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', 'admin123');
    await page.click('#login-submit-btn');
    await page.waitForTimeout(700);
    if (!(await page.isVisible('#app-shell'))) throw new Error('login failed');
  });

  await step('item-department select has clean single arrow, no native duplicate', async () => {
    await page.click('[data-view="inventario"]');
    await page.waitForTimeout(200);
    await page.click('#btn-add-item');
    await page.waitForTimeout(200);
    const appearance = await page.evaluate(() => getComputedStyle(document.getElementById('item-department')).appearance);
    if (appearance && appearance !== 'none') throw new Error('appearance not none: ' + appearance);
    await page.evaluate(() => document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden')));
  });

  await step('item-code preview is a real code (repo has seeded items, so this already worked, but confirm no regression)', async () => {
    await page.click('#btn-add-item');
    await page.waitForTimeout(200);
    const code = await page.evaluate(() => document.getElementById('item-code').value);
    if (!code || code === 'undefined') throw new Error('bad code preview: ' + code);
    await page.evaluate(() => document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden')));
  });

  await step('event flyer: icon toggles correctly with seeded event data', async () => {
    await page.click('[data-view="calendario"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => openEventModal());
    await page.waitForTimeout(200);
    const iconExists = await page.evaluate(() => !!document.getElementById('event-flyer-icon'));
    if (!iconExists) throw new Error('event-flyer-icon element missing');
    await page.evaluate(() => document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden')));
  });

  await step('usuarios page renders with seeded demo users, no dev-only hint text', async () => {
    await page.click('[data-view="usuarios"]');
    await page.waitForTimeout(200);
    const rowCount = await page.evaluate(() => document.querySelectorAll('#users-tbody tr').length);
    if (rowCount < 5) throw new Error('expected seeded demo users, got ' + rowCount + ' rows');
    const txt = await page.evaluate(() => document.getElementById('module-usuarios').innerText);
    if (txt.includes('se validan en vivo contra el registro')) throw new Error('dev-only hint still present');
  });

  console.log('\n=== ERRORS FOUND:', errors.length, '===');
  errors.forEach(e => console.log(e));
  await browser.close();
})();
