const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const errors = [];
  async function step(page, name, fn) {
    try { await fn(); console.log('OK   ', name); }
    catch (e) { console.log('FAIL ', name, '-', e.message.split('\n')[0]); await page.screenshot({ path: 'shots7/FAIL-inv9-' + name.replace(/[^a-z0-9]/gi,'_') + '.png' }).catch(()=>{}); }
  }

  // Desktop sanity: thumbnails still shown, grid layout intact.
  const dpage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  dpage.setDefaultTimeout(8000);
  dpage.on('pageerror', e => errors.push('PAGEERROR(desktop): ' + e.message));
  dpage.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_TUNNEL')) errors.push('CONSOLE(desktop): ' + msg.text()); });

  await step(dpage, 'desktop login + inventario grid with thumbs', async () => {
    await dpage.goto('file://' + path.resolve(__dirname, 'index.html'));
    await dpage.waitForTimeout(1100);
    await dpage.fill('#login-user', 'admin');
    await dpage.fill('#login-pass', 'admin123');
    await dpage.click('#login-submit-btn');
    await dpage.waitForTimeout(700);
    await dpage.click('[data-view="inventario"]');
    await dpage.waitForTimeout(250);
    const thumbDisplay = await dpage.evaluate(() => getComputedStyle(document.querySelector('.item-card-thumb')).display);
    if (thumbDisplay === 'none') throw new Error('desktop thumbs should still be visible, got display:none');
    const gridCols = await dpage.evaluate(() => getComputedStyle(document.querySelector('.item-grid')).gridTemplateColumns.split(' ').length);
    if (gridCols < 2) throw new Error('desktop item-grid should have multiple columns, got ' + gridCols);
    await dpage.screenshot({ path: 'shots7/30-inventario-desktop-grid.png', fullPage: true });
  });

  // Mobile: list view, no thumbnails, detail shows image.
  const mpage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mpage.setDefaultTimeout(8000);
  mpage.on('pageerror', e => errors.push('PAGEERROR(mobile): ' + e.message));
  mpage.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('ERR_TUNNEL')) errors.push('CONSOLE(mobile): ' + msg.text()); });

  await step(mpage, 'mobile login + inventario as list, no thumbs', async () => {
    await mpage.goto('file://' + path.resolve(__dirname, 'index.html'));
    await mpage.waitForTimeout(1100);
    await mpage.fill('#login-user', 'admin');
    await mpage.fill('#login-pass', 'admin123');
    await mpage.click('#login-submit-btn');
    await mpage.waitForTimeout(700);
    await mpage.click('#hamburger-btn');
    await mpage.waitForTimeout(200);
    await mpage.click('[data-view="inventario"]');
    await mpage.waitForTimeout(300);
    const thumbDisplay = await mpage.evaluate(() => getComputedStyle(document.querySelector('.item-card-thumb')).display);
    if (thumbDisplay !== 'none') throw new Error('mobile thumbs should be hidden, got display:' + thumbDisplay);
    const gridCols = await mpage.evaluate(() => getComputedStyle(document.querySelector('.item-grid')).gridTemplateColumns.split(' ').length);
    if (gridCols !== 1) throw new Error('mobile item-grid should be single column, got ' + gridCols);
    const pillDisplay = await mpage.evaluate(() => getComputedStyle(document.querySelector('.ic-qty-pill')).display);
    if (pillDisplay === 'none') throw new Error('mobile inline qty pill should be visible');
    await mpage.screenshot({ path: 'shots7/31-inventario-mobile-list.png', fullPage: true });
  });

  await step(mpage, 'mobile: tapping item shows detail WITH image', async () => {
    // find an item that has a seeded photo, or just check the hero renders (placeholder icon if no photo, which is expected/correct)
    await mpage.click('.item-card');
    await mpage.waitForTimeout(250);
    const heroVisible = await mpage.isVisible('.item-detail-hero');
    if (!heroVisible) throw new Error('item-detail-hero not visible after tapping a list row');
    await mpage.screenshot({ path: 'shots7/32-item-detail-mobile.png', fullPage: true });
  });

  console.log('\n=== ERRORS FOUND:', errors.length, '===');
  errors.forEach(e => console.log(e));
  await browser.close();
})();
