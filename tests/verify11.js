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
      await page.screenshot({ path: 'shots7/FAIL-v11-' + name.replace(/[^a-z0-9]/gi,'_') + '.png' }).catch(()=>{});
      await page.evaluate(() => {
        document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden'));
        document.querySelectorAll('.role-switcher-menu.open, .user-menu-dd.open').forEach(d => d.classList.remove('open'));
      }).catch(()=>{});
    }
  }

  await step('login as paloma (editor) and create a Pizarra note', async () => {
    await page.goto('file://' + path.resolve(__dirname, 'index.html'));
    await page.waitForTimeout(1100);
    await page.fill('#login-user', 'paloma');
    await page.fill('#login-pass', 'paloma123');
    await page.click('#login-submit-btn');
    await page.waitForTimeout(700);
    await page.click('[data-view="pizarra"]');
    await page.waitForTimeout(200);
    await page.click('button[onclick="openNoteModal()"]');
    await page.waitForTimeout(150);
    await page.fill('#note-text', 'Nota de prueba para verificar el aviso en la campana.');
    await page.click('#note-save-btn');
    await page.waitForTimeout(700);
    // No wa-toast / floating bubble should ever appear now.
    const anyWaToast = await page.$('.wa-toast');
    if (anyWaToast) throw new Error('a wa-toast element should not exist anymore');
  });

  await step('avisos array recorded the note, author excluded from its own aviso', async () => {
    const info = await page.evaluate(() => {
      const a = avisos[0];
      return { type: a.type, createdBy: a.createdBy, self: currentUser().id, seenByLen: a.seenBy.length };
    });
    if (info.type !== 'nota') throw new Error('expected avisos[0].type=nota, got ' + info.type);
    if (info.createdBy !== info.self) throw new Error('createdBy should be paloma (the author)');
    if (info.seenByLen !== 0) throw new Error('a freshly created aviso should have an empty seenBy list');
  });

  await step('switch to another user (admin): bell-dot visible, no toast popped up', async () => {
    await page.evaluate(() => { handleLogout(); });
    await page.waitForTimeout(300);
    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', 'admin123');
    await page.click('#login-submit-btn');
    await page.waitForTimeout(700);
    const bellDotVisible = await page.isVisible('#bell-dot');
    if (!bellDotVisible) throw new Error('bell-dot should be visible: admin has an unseen aviso from paloma');
    await page.screenshot({ path: 'shots7/50-bell-dot-aviso.png' });
  });

  await step('opening the bell shows the aviso under "Avisos" section', async () => {
    await page.click('#bell-btn');
    await page.waitForTimeout(250);
    const text = (await page.evaluate(() => document.getElementById('notif-panel-body').innerText)).toLowerCase();
    if (!text.includes('avisos')) throw new Error('notif panel missing "Avisos" section, got: ' + text.slice(0,300));
    if (!text.includes('nota de prueba')) throw new Error('notif panel missing the note preview text');
    await page.screenshot({ path: 'shots7/51-notif-panel-avisos.png' });
  });

  await step('after opening the bell once, the aviso is marked seen and the dot clears', async () => {
    await page.click('#bell-btn'); // close
    await page.waitForTimeout(200);
    // admin also has 2 seeded pending-registration requests, which independently keep the
    // bell-dot lit — so assert on unseenAvisos() directly rather than the dot itself.
    const remainingUnseen = await page.evaluate(() => unseenAvisos().length);
    if (remainingUnseen !== 0) throw new Error('the aviso should no longer count as unseen, got ' + remainingUnseen);
    const seenByAdmin = await page.evaluate(() => avisos[0].seenBy.includes(currentUser().id));
    if (!seenByAdmin) throw new Error('avisos[0].seenBy should include admin id after opening the bell');
  });

  await step('creating a Calendario event also produces a bell-only aviso', async () => {
    await page.click('[data-view="calendario"]');
    await page.waitForTimeout(200);
    await page.click('#btn-add-event');
    await page.waitForTimeout(200);
    await page.fill('#event-name', 'Evento de prueba avisos');
    await page.fill('#event-date', '2026-12-05');
    await page.click('#event-save-btn');
    await page.waitForTimeout(800);
    const anyWaToast = await page.$('.wa-toast');
    if (anyWaToast) throw new Error('a wa-toast element should not exist anymore (event path)');
    const info = await page.evaluate(() => ({ type: avisos[0].type, text: avisos[0].text }));
    if (info.type !== 'evento') throw new Error('expected avisos[0].type=evento, got ' + info.type);
    if (!info.text.includes('Evento de prueba avisos')) throw new Error('aviso text missing event name');
  });

  await step('editing an existing event does NOT create a new aviso', async () => {
    const before = await page.evaluate(() => avisos.length);
    await page.click('[data-view="calendario"]');
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const ev = events.find(e => e.name === 'Evento de prueba avisos');
      openEventModal(ev.id);
    });
    await page.waitForTimeout(200);
    await page.click('#event-save-btn');
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => avisos.length);
    if (after !== before) throw new Error(`editing should not add an aviso: before=${before} after=${after}`);
  });

  await step('perfil no longer shows any WhatsApp UI', async () => {
    await page.evaluate(() => switchModule('perfil'));
    await page.waitForTimeout(200);
    const hasWaToggle = await page.$('#profile-wa-toggle');
    if (hasWaToggle) throw new Error('profile-wa-toggle should no longer exist');
    const text = await page.evaluate(() => document.getElementById('module-perfil').innerText.toLowerCase());
    if (!text.includes('notificaciones')) throw new Error('perfil should still show a Notificaciones card (informational)');
    if (!text.includes('campana') && !text.includes('🔔')) throw new Error('perfil should point users to the bell for notifications');
    await page.screenshot({ path: 'shots7/52-perfil-no-whatsapp.png', fullPage: true });
  });

  console.log('\n=== ERRORS FOUND:', errors.length, '===');
  errors.forEach(e => console.log(e));
  await browser.close();
})();
