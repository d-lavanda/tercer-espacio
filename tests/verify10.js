const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + '\n' + e.stack));
  page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_TUNNEL')) errors.push('CONSOLE: ' + msg.text()); });

  async function step(name, fn) {
    try { await fn(); console.log('OK   ', name); }
    catch (e) {
      console.log('FAIL ', name, '-', e.message.split('\n')[0]);
      await page.screenshot({ path: 'shots7/FAIL-v10-' + name.replace(/[^a-z0-9]/gi,'_') + '.png' }).catch(()=>{});
      await page.evaluate(() => {
        document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden'));
        document.querySelectorAll('.role-switcher-menu.open, .user-menu-dd.open').forEach(d => d.classList.remove('open'));
      }).catch(()=>{});
    }
  }

  await step('forgot-password: submit from login screen creates a request', async () => {
    await page.goto('file://' + path.resolve(__dirname, 'index.html'));
    await page.waitForTimeout(1100);
    await page.fill('#login-user', 'iker'); // existing seed user
    await page.click('text=¿Olvidaste tu contraseña?');
    await page.waitForTimeout(200);
    const prefilled = await page.inputValue('#forgot-username');
    if (prefilled !== 'iker') throw new Error('username should be prefilled from login field, got ' + prefilled);
    await page.click('#forgot-pass-btn');
    await page.waitForTimeout(600);
    const toastVisible = await page.isVisible('.toast');
    if (!toastVisible) throw new Error('expected confirmation toast after submitting request');
    const count = await page.evaluate(() => passwordResetRequests.length);
    if (count !== 1) throw new Error('expected 1 passwordResetRequests entry, got ' + count);
  });

  await step('forgot-password: unknown username still shows neutral message, no request created', async () => {
    await page.click('text=¿Olvidaste tu contraseña?');
    await page.waitForTimeout(150);
    await page.fill('#forgot-username', 'usuario_que_no_existe');
    await page.click('#forgot-pass-btn');
    await page.waitForTimeout(600);
    const count = await page.evaluate(() => passwordResetRequests.length);
    if (count !== 1) throw new Error('unknown username should not create a request, count=' + count);
  });

  await step('forgot-password: empty username shows inline error, does not close modal', async () => {
    await page.click('text=¿Olvidaste tu contraseña?');
    await page.waitForTimeout(150);
    await page.fill('#forgot-username', '');
    await page.click('#forgot-pass-btn');
    await page.waitForTimeout(600);
    const errVisible = await page.isVisible('#forgot-pass-error');
    if (!errVisible) throw new Error('expected inline validation error for empty username');
    await page.click('#modal-forgot-password button:has-text("Cancelar")');
  });

  await step('login as admin: bell badge + notif panel show the reset request', async () => {
    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', 'admin123');
    await page.click('#login-submit-btn');
    await page.waitForTimeout(700);
    const bellDotVisible = await page.isVisible('#bell-dot');
    if (!bellDotVisible) throw new Error('bell-dot should be visible with a pending reset request');
    await page.click('#bell-btn');
    await page.waitForTimeout(200);
    const text = (await page.evaluate(() => document.getElementById('notif-panel-body').innerText)).toLowerCase();
    if (!text.includes('restablecer contraseña')) throw new Error('notif panel missing password-reset section, got: ' + text.slice(0,300));
    if (!text.includes('iker')) throw new Error('notif panel missing Iker Navarro row');
    await page.screenshot({ path: 'shots7/40-notif-panel-reset.png' });
  });

  await step('usuarios page: reset request card shows + generate temp password works', async () => {
    await page.click('[data-view="usuarios"]');
    await page.waitForTimeout(250);
    const badgeText = await page.evaluate(() => document.getElementById('reset-count-badge').textContent);
    if (badgeText !== '1') throw new Error('expected reset-count-badge=1, got ' + badgeText);
    await page.screenshot({ path: 'shots7/41-usuarios-reset-card.png', fullPage: true });
    await page.click('#reset-list button:has-text("Generar temporal")');
    await page.waitForTimeout(200);
    const modalVisible = await page.isVisible('#modal-temp-password');
    if (!modalVisible) throw new Error('temp password modal did not open');
    const tempVal = await page.evaluate(() => document.getElementById('temp-pass-value').textContent);
    if (!tempVal.startsWith('TE-')) throw new Error('unexpected temp password format: ' + tempVal);
    const ikerPassNow = await page.evaluate(() => users.find(u => u.username === 'iker').password);
    if (ikerPassNow !== tempVal) throw new Error('iker password was not updated to the generated temp password');
    await page.screenshot({ path: 'shots7/42-temp-password-modal.png' });
    await page.click('#modal-temp-password button:has-text("Listo")');
    await page.waitForTimeout(200);
    const remaining = await page.evaluate(() => passwordResetRequests.length);
    if (remaining !== 0) throw new Error('request should be resolved/removed after generating temp password, remaining=' + remaining);
    const badgeAfter = await page.evaluate(() => document.getElementById('reset-count-badge').textContent);
    if (badgeAfter !== '0') throw new Error('badge should be 0 after resolving, got ' + badgeAfter);
  });

  await step('historial logs the temp password generation', async () => {
    await page.click('[data-view="historial"]');
    await page.waitForTimeout(200);
    const text = await page.evaluate(() => document.getElementById('module-historial').innerText);
    if (!text.includes('contraseña temporal')) throw new Error('historial missing temp password log entry');
  });

  await step('discard flow: create + discard a reset request removes it without changing password', async () => {
    await page.evaluate(() => {
      handleLogout();
    });
    await page.waitForTimeout(300);
    await page.fill('#login-user', 'paloma');
    await page.click('text=¿Olvidaste tu contraseña?');
    await page.waitForTimeout(150);
    await page.click('#forgot-pass-btn');
    await page.waitForTimeout(600);
    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', 'admin123');
    await page.click('#login-submit-btn');
    await page.waitForTimeout(700);
    const beforePass = await page.evaluate(() => users.find(u => u.username === 'paloma').password);
    await page.click('[data-view="usuarios"]');
    await page.waitForTimeout(200);
    await page.click('#reset-list button:has-text("Descartar")');
    await page.waitForTimeout(200);
    const afterPass = await page.evaluate(() => users.find(u => u.username === 'paloma').password);
    if (beforePass !== afterPass) throw new Error('discard should not change password');
    const remaining = await page.evaluate(() => passwordResetRequests.length);
    if (remaining !== 0) throw new Error('discard should remove the request, remaining=' + remaining);
  });

  await step('protected profile: delete button replaced with disabled lock', async () => {
    await page.evaluate(() => {
      // simulate a protected profile for this check
      const u = users.find(u => u.username === 'diegocruz');
      u.protected = true;
      renderUsers();
    });
    await page.waitForTimeout(200);
    const lockVisible = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#users-tbody tr')];
      const row = rows.find(r => r.innerText.includes('Diego Cruz'));
      return row ? !!row.querySelector('button[disabled][title*="protegido"]') : false;
    });
    if (!lockVisible) throw new Error('expected a disabled lock button for the protected user row');
    await page.screenshot({ path: 'shots7/43-protected-user-row.png' });
  });

  await step('protected profile: confirmDeleteUser refuses even if called directly', async () => {
    const before = await page.evaluate(() => users.length);
    await page.evaluate(() => {
      const u = users.find(u => u.username === 'diegocruz');
      confirmDeleteUser(u.id);
    });
    await page.waitForTimeout(200);
    const modalVisible = await page.isVisible('#modal-confirm:not(.hidden)');
    if (modalVisible) throw new Error('confirm-delete modal should NOT open for a protected user');
    const after = await page.evaluate(() => users.length);
    if (before !== after) throw new Error('protected user should not have been removed');
  });

  console.log('\n=== ERRORS FOUND:', errors.length, '===');
  errors.forEach(e => console.log(e));
  await browser.close();
})();
