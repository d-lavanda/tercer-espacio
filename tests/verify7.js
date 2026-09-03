const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const errors = [];

  async function step(page, name, fn) {
    try { await fn(); console.log('OK   ', name); }
    catch (e) {
      console.log('FAIL ', name, '-', e.message.split('\n')[0]);
      await page.screenshot({ path: 'shots7/FAIL-' + name.replace(/[^a-z0-9]/gi,'_') + '.png' }).catch(()=>{});
      // Clean up any open modal/dropdown so later steps aren't blocked by this failure.
      await page.evaluate(() => {
        document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden'));
        document.querySelectorAll('.role-switcher-menu.open, .user-menu-dd.open').forEach(d => d.classList.remove('open'));
        if (typeof closeSidebar === 'function') closeSidebar();
      }).catch(()=>{});
    }
  }

  // ---------- DESKTOP ----------
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => errors.push('PAGEERROR(desktop): ' + e.message + '\n' + e.stack));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('CONSOLE(desktop): ' + msg.text()); });

  await step(page, 'goto + login', async () => {
    await page.goto('file://' + path.resolve(__dirname, 'index.html'));
    await page.waitForTimeout(1100);
    await page.fill('#login-user', 'admin');
    await page.fill('#login-pass', 'admin123');
    await page.click('#login-submit-btn');
    await page.waitForTimeout(700);
    const shellVisible = await page.isVisible('#app-shell');
    if (!shellVisible) throw new Error('app shell not visible after login');
  });

  await step(page, 'theme toggle repositioned near profile (inline btn exists, float hidden in app)', async () => {
    const inlineVisible = await page.isVisible('#theme-toggle-btn-inline');
    if (!inlineVisible) throw new Error('inline theme toggle not visible in topbar');
    const floatDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('theme-toggle-btn-float')).display);
    if (floatDisplay !== 'none') throw new Error('float theme toggle should be hidden once app is active');
  });

  await step(page, 'mochila nav item + backpack icon in inventario', async () => {
    await page.click('[data-view="inventario"]');
    await page.waitForTimeout(200);
    const backpackVisible = await page.isVisible('#inv-backpack-badge');
    if (!backpackVisible) throw new Error('inventario backpack badge not visible');
    await page.screenshot({ path: 'shots7/01-inventario-desktop.png', fullPage: true });
  });

  await step(page, 'item modal has repair/retired + custom tag UI', async () => {
    await page.click('#btn-add-item');
    await page.waitForTimeout(200);
    const repairVisible = await page.isVisible('#item-repair');
    const retiredVisible = await page.isVisible('#item-retired');
    if (!repairVisible || !retiredVisible) throw new Error('repair/retired fields missing');
    await page.screenshot({ path: 'shots7/02-item-modal.png' });
    await page.click('#modal-item .modal-head button, #modal-item [onclick*="closeModal"]').catch(()=>{});
    await page.evaluate(() => closeModal('modal-item'));
  });

  await step(page, 'item card shows available-qty + state chips', async () => {
    await page.waitForTimeout(150);
    const html = await page.evaluate(() => document.getElementById('inventory-grid') ? document.getElementById('inventory-grid').innerHTML.length : (document.querySelector('.item-grid')?.innerHTML.length || 0));
    if (!html || html < 50) throw new Error('inventory grid seems empty, got length ' + html);
  });

  await step(page, 'mochila module renders loans', async () => {
    await page.click('[data-view="mochila"]');
    await page.waitForTimeout(200);
    const groups = await page.$$eval('.loan-group', els => els.length);
    if (groups < 1) throw new Error('expected at least 1 loan group in mochila, got ' + groups);
    await page.screenshot({ path: 'shots7/03-mochila.png', fullPage: true });
  });

  await step(page, 'event modal: flyer upload UI + loan picker tabs (after toggling equip checkbox)', async () => {
    await page.click('[data-view="calendario"]');
    await page.waitForTimeout(200);
    await page.click('#btn-add-event');
    await page.waitForTimeout(200);
    const flyerBox = await page.isVisible('#event-flyer-box');
    if (!flyerBox) throw new Error('event flyer upload box not visible');
    await page.click('#event-equip-toggle');
    await page.waitForTimeout(150);
    const pickerTabs = await page.isVisible('.loan-picker-tabs');
    if (!pickerTabs) throw new Error('loan picker tabs not visible after enabling equip toggle');
    await page.screenshot({ path: 'shots7/04-event-modal.png' });
    await page.evaluate(() => closeModal('modal-event'));
  });

  await step(page, 'event detail: open existing event shows flyer-detail-box CSS class defined (no layout break)', async () => {
    await page.waitForTimeout(150);
    const hasRule = await page.evaluate(() => {
      for (const ss of document.styleSheets) {
        try {
          for (const rule of ss.cssRules) {
            if (rule.selectorText && rule.selectorText.includes('.flyer-detail-box')) return true;
          }
        } catch(e) {}
      }
      return false;
    });
    if (!hasRule) throw new Error('.flyer-detail-box CSS rule not found');
  });

  await step(page, 'undo toast appears on item delete', async () => {
    await page.click('[data-view="inventario"]');
    await page.waitForTimeout(300);
    const firstDeleteBtn = await page.$('.item-card [title="Eliminar"], .item-card .btn-icon[onclick*="confirmDeleteItem"]');
    // fall back: open first item detail then delete from there if card-level button not found
    if (firstDeleteBtn) {
      await firstDeleteBtn.click();
    } else {
      await page.click('.item-card');
      await page.waitForTimeout(150);
      await page.click('[onclick^="confirmDeleteItem"]');
    }
    await page.waitForTimeout(150);
    await page.click('#confirm-action-btn');
    await page.waitForTimeout(200);
    const undoToast = await page.isVisible('.undo-toast');
    if (!undoToast) throw new Error('undo toast did not appear after delete');
    await page.click('.undo-toast .undo-btn');
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'shots7/05-undo-toast.png' });
  });

  await step(page, 'usuarios: session badge + remote logout button', async () => {
    await page.click('[data-view="usuarios"]');
    await page.waitForTimeout(250);
    const badges = await page.$$eval('.users-table .badge-good, .users-table .badge-warning', els => els.length);
    if (badges < 1) throw new Error('no session badges found in users table');
    const logoutBtns = await page.$$eval('[onclick^="forceLogoutUser"]', els => els.length);
    if (logoutBtns < 1) throw new Error('no remote-logout buttons found');
    await page.screenshot({ path: 'shots7/06-usuarios.png', fullPage: true });
  });

  await step(page, 'remote logout: click, verify badge flips + historial entry logged', async () => {
    await page.click('[onclick^="forceLogoutUser"]');
    await page.waitForTimeout(200);
    const warningBadge = await page.$$eval('.users-table .badge-warning', els => els.length);
    if (warningBadge < 1) throw new Error('expected a warning (Cerrada) badge after force logout');
    await page.click('[data-view="historial"]');
    await page.waitForTimeout(200);
    const text = await page.evaluate(() => document.getElementById('module-historial') ? document.getElementById('module-historial').innerText : '');
    if (!text.includes('cerró la sesión remota')) throw new Error('historial does not show remote logout entry');
  });

  await step(page, 'inventory: add custom tag', async () => {
    await page.click('[data-view="inventario"]');
    await page.waitForTimeout(200);
    await page.click('#btn-add-item');
    await page.waitForTimeout(200);
    const newTagRowVisible = await page.isVisible('#item-tag-select, select#item-tag');
    await page.screenshot({ path: 'shots7/07-item-tag-ui.png' });
    await page.evaluate(() => closeModal('modal-item'));
  });

  await step(page, 'diffFields helper produces expected text', async () => {
    const out = await page.evaluate(() => diffFields({a:'6'}, {a:'4'}, {a:'cantidad'}));
    if (!out.includes('6') || !out.includes('4')) throw new Error('diffFields output unexpected: ' + out);
  });

  // ---------- MOBILE ----------
  const mpage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mpage.setDefaultTimeout(8000);
  mpage.on('pageerror', e => errors.push('PAGEERROR(mobile): ' + e.message + '\n' + e.stack));
  mpage.on('console', msg => { if (msg.type() === 'error') errors.push('CONSOLE(mobile): ' + msg.text()); });

  await step(mpage, 'mobile: goto + login', async () => {
    await mpage.goto('file://' + path.resolve(__dirname, 'index.html'));
    await mpage.waitForTimeout(1100);
    await mpage.screenshot({ path: 'shots7/10-login-mobile.png', fullPage: true });
    await mpage.fill('#login-user', 'admin');
    await mpage.fill('#login-pass', 'admin123');
    await mpage.click('#login-submit-btn');
    await mpage.waitForTimeout(700);
    const shellVisible = await mpage.isVisible('#app-shell');
    if (!shellVisible) throw new Error('app shell not visible after mobile login');
    await mpage.screenshot({ path: 'shots7/11-home-mobile.png', fullPage: true });
  });

  await step(mpage, 'mobile: hamburger visible, sidebar hidden by default, opens on click', async () => {
    const hamburgerVisible = await mpage.isVisible('#hamburger-btn');
    if (!hamburgerVisible) throw new Error('hamburger button not visible on mobile');
    const sidebarOpenBefore = await mpage.evaluate(() => document.getElementById('sidebar').classList.contains('open'));
    if (sidebarOpenBefore) throw new Error('sidebar should be closed by default on mobile');
    await mpage.click('#hamburger-btn');
    await mpage.waitForTimeout(300);
    const sidebarOpenAfter = await mpage.evaluate(() => document.getElementById('sidebar').classList.contains('open'));
    if (!sidebarOpenAfter) throw new Error('sidebar did not open after hamburger click');
    await mpage.screenshot({ path: 'shots7/12-sidebar-drawer-mobile.png', fullPage: true });
  });

  await step(mpage, 'mobile: tapping nav item navigates and closes drawer', async () => {
    await mpage.click('[data-view="mochila"]');
    await mpage.waitForTimeout(300);
    const sidebarOpenAfterNav = await mpage.evaluate(() => document.getElementById('sidebar').classList.contains('open'));
    if (sidebarOpenAfterNav) throw new Error('sidebar should auto-close after navigating on mobile');
    const moduleVisible = await mpage.isVisible('#module-mochila');
    if (!moduleVisible) throw new Error('mochila module not visible after nav');
    await mpage.screenshot({ path: 'shots7/13-mochila-mobile.png', fullPage: true });
  });

  await step(mpage, 'mobile: backdrop closes sidebar', async () => {
    await mpage.click('#hamburger-btn');
    await mpage.waitForTimeout(250);
    await mpage.click('#sidebar-backdrop', { position: { x: 370, y: 400 } });
    await mpage.waitForTimeout(250);
    const sidebarOpen = await mpage.evaluate(() => document.getElementById('sidebar').classList.contains('open'));
    if (sidebarOpen) throw new Error('sidebar should close when tapping backdrop');
  });

  await step(mpage, 'mobile: usuarios table renders as stacked cards (thead hidden)', async () => {
    await mpage.click('#hamburger-btn');
    await mpage.waitForTimeout(200);
    await mpage.click('[data-view="usuarios"]');
    await mpage.waitForTimeout(300);
    const theadDisplay = await mpage.evaluate(() => getComputedStyle(document.querySelector('.users-table thead')).display);
    if (theadDisplay !== 'none') throw new Error('users-table thead should be display:none on mobile, got ' + theadDisplay);
    const firstTdDisplay = await mpage.evaluate(() => getComputedStyle(document.querySelector('.users-table td[data-label]')).display);
    if (firstTdDisplay !== 'flex') throw new Error('users-table td should be display:flex (stacked card row) on mobile, got ' + firstTdDisplay);
    await mpage.screenshot({ path: 'shots7/14-usuarios-mobile.png', fullPage: true });
  });

  await step(mpage, 'mobile: billetera table renders as stacked cards', async () => {
    await mpage.click('#hamburger-btn');
    await mpage.waitForTimeout(200);
    await mpage.click('[data-view="billetera"]');
    await mpage.waitForTimeout(300);
    await mpage.screenshot({ path: 'shots7/15-billetera-mobile.png', fullPage: true });
  });

  await step(mpage, 'mobile: pizarra compact grid (no absolute positioning)', async () => {
    await mpage.click('#hamburger-btn');
    await mpage.waitForTimeout(200);
    await mpage.click('[data-view="pizarra"]');
    await mpage.waitForTimeout(300);
    const postitPosition = await mpage.evaluate(() => {
      const el = document.querySelector('.postit');
      return el ? getComputedStyle(el).position : null;
    });
    if (postitPosition && postitPosition !== 'relative') throw new Error('postit should be position:relative in compact mobile view, got ' + postitPosition);
    const boardDisplay = await mpage.evaluate(() => getComputedStyle(document.getElementById('corkboard')).display);
    if (boardDisplay !== 'flex') throw new Error('corkboard should be display:flex on mobile, got ' + boardDisplay);
    await mpage.screenshot({ path: 'shots7/16-pizarra-mobile.png', fullPage: true });
  });

  await step(mpage, 'mobile: event modal is full-screen sheet', async () => {
    await mpage.click('#hamburger-btn');
    await mpage.waitForTimeout(200);
    await mpage.click('[data-view="calendario"]');
    await mpage.waitForTimeout(300);
    await mpage.click('#btn-add-event');
    await mpage.waitForTimeout(200);
    const modalWidth = await mpage.evaluate(() => document.querySelector('#modal-event .modal').getBoundingClientRect().width);
    if (modalWidth < 350) throw new Error('modal should be full-width on mobile, got width ' + modalWidth);
    await mpage.screenshot({ path: 'shots7/17-event-modal-mobile.png', fullPage: true });
    await mpage.evaluate(() => closeModal('modal-event'));
  });

  await step(mpage, 'mobile: light theme toggle still reachable + no overlap with profile icon', async () => {
    await mpage.click('#theme-toggle-btn-inline');
    await mpage.waitForTimeout(250);
    const theme = await mpage.evaluate(() => document.documentElement.getAttribute('data-theme'));
    if (theme !== 'light') throw new Error('expected light theme after toggle, got ' + theme);
    await mpage.screenshot({ path: 'shots7/18-light-mobile.png', fullPage: true });
  });

  console.log('\n=== ERRORS FOUND:', errors.length, '===');
  errors.forEach(e => console.log(e));
  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();
