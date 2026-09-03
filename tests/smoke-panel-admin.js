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
  async function loginAs(u, p) {
    await page.fill('#login-user', u);
    await page.fill('#login-pass', p);
    await page.click('#login-submit-btn');
    await page.waitForTimeout(600);
  }

  await step('non-admin (paloma) submits a service notice', async () => {
    await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await page.waitForTimeout(1000);
    await loginAs('paloma', 'paloma123');
    if (!(await page.isVisible('#app-shell'))) throw new Error('paloma login failed');
    await page.click('button[title="Reportar un problema o dejar un aviso"]');
    await page.waitForTimeout(200);
    await page.fill('#service-notice-text', 'La foto del flyer no se ve bien en mi pantalla.');
    await page.click('#service-notice-btn');
    await page.waitForTimeout(700);
    const count = await page.evaluate(() => serviceNotices.length);
    if (count !== 1) throw new Error('expected 1 service notice, got ' + count);
    await page.evaluate(() => handleLogout());
    await page.waitForTimeout(300);
  });

  await step('admin (demo) sees and replies to the notice; paloma sees the reply', async () => {
    await loginAs('admin', 'admin123');
    await page.click('[data-view="panel-admin"]');
    await page.waitForTimeout(300);
    const badge = await page.evaluate(() => document.getElementById('service-notice-count-badge').textContent.trim());
    if (badge !== '1') throw new Error('expected badge 1, got ' + badge);
    const id = await page.evaluate(() => serviceNotices[0].id);
    await page.fill('#service-notice-reply-' + id, 'Gracias, ya lo corregimos.');
    await page.click(`button[onclick="replyServiceNotice(${id})"]`);
    await page.waitForTimeout(300);
    await page.evaluate(() => handleLogout());
    await page.waitForTimeout(300);

    await loginAs('paloma', 'paloma123');
    await page.click('#bell-btn');
    await page.waitForTimeout(250);
    const body = await page.evaluate(() => document.getElementById('notif-panel-body').innerText);
    if (!body.includes('ya lo corregimos')) throw new Error('paloma should see the reply: ' + body);
    await page.evaluate(() => handleLogout());
    await page.waitForTimeout(300);
  });

  await step('maintenance mode blocks a non-admin, admin bypasses, same session', async () => {
    await loginAs('admin', 'admin123');
    await page.click('[data-view="panel-admin"]');
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const cb = document.getElementById('maintenance-toggle');
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(150);
    await page.evaluate(() => handleLogout());
    await page.waitForTimeout(300);

    await loginAs('admin', 'admin123');
    if (!(await page.isVisible('#app-shell'))) throw new Error('admin should bypass maintenance mode');
    await page.evaluate(() => handleLogout());
    await page.waitForTimeout(300);

    await loginAs('caro', 'caro123');
    const screenVisible = await page.isVisible('#maintenance-screen:not(.hidden)');
    if (!screenVisible) throw new Error('caro should be blocked by maintenance mode');
  });

  console.log('\n=== ERRORS FOUND:', errors.length, '===');
  errors.forEach(e => console.log(e));
  await browser.close();
})();
