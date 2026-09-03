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

  await step('service-notice modal has no explanatory paragraph left', async () => {
    await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await page.waitForTimeout(1000);
    await loginAs('admin', 'admin123');
    if (!(await page.isVisible('#app-shell'))) throw new Error('admin login failed');
    await page.click('button[title="Reportar un problema o dejar un aviso"]');
    await page.waitForTimeout(200);
    const bodyText = await page.evaluate(() => document.querySelector('#modal-service-notice .modal-body').innerText);
    if (bodyText.includes('Cuéntale al Administrador')) throw new Error('explanatory paragraph should be gone: ' + bodyText);
    await page.click('#modal-service-notice .btn-icon');
    await page.waitForTimeout(150);
    await page.evaluate(() => handleLogout());
    await page.waitForTimeout(300);
  });

  await step('login quote renders default text with word-before-punctuation emphasis', async () => {
    const html = await page.evaluate(() => document.getElementById('auth-quote-login-title').innerHTML);
    if (html !== 'El arte necesita <em>lugar</em>,<br>nosotros ponemos el <em>espacio</em>.') {
      throw new Error('unexpected default login title html: ' + html);
    }
  });

  await step('admin panel edits the welcome texts and they apply live to login/register', async () => {
    await loginAs('admin', 'admin123');
    await page.click('[data-view="panel-admin"]');
    await page.waitForTimeout(300);
    await page.fill('#auth-quote-login-title-input', 'Gracias por volver, equipo.');
    await page.fill('#auth-quote-register-title-input', 'Súmate al proyecto, aporta ideas.');
    await page.waitForTimeout(150);
    await page.evaluate(() => handleLogout());
    await page.waitForTimeout(300);
    const loginHTML = await page.evaluate(() => document.getElementById('auth-quote-login-title').innerHTML);
    if (loginHTML !== 'Gracias por <em>volver</em>, <em>equipo</em>.') throw new Error('login title emphasis wrong: ' + loginHTML);
    await page.click('a[onclick*="view-register"]');
    await page.waitForTimeout(300);
    const regHTML = await page.evaluate(() => document.getElementById('auth-quote-register-title').innerHTML);
    if (regHTML !== 'Súmate al <em>proyecto</em>, aporta <em>ideas</em>.') throw new Error('register title emphasis wrong: ' + regHTML);
  });

  console.log('\n=== ERRORS FOUND:', errors.length, '===');
  errors.forEach(e => console.log(e));
  await browser.close();
})();
