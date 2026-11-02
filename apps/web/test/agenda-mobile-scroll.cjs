const assert = require('node:assert/strict');
const fs = require('node:fs');
const puppeteer = require('puppeteer');

(async () => {
    // A local, synthetic page using the actual dashboard and agenda styles.
    // No authentication, application data, or external website is accessed.
    const layout = fs.readFileSync('apps/web/app/(dashboard)/layout.tsx', 'utf8');
    const dashboardCss = layout.match(/<style jsx>\{`([\s\S]*?)`\}<\/style>/)[1]
        .replace(/:global\(([^)]+)\)/g, '$1');
    const css = [
        fs.readFileSync('apps/web/app/globals.css', 'utf8'),
        dashboardCss,
        fs.readFileSync('apps/web/app/agenda-madrasah/agenda.css', 'utf8'),
    ].join('\n');
    const events = Array.from({ length: 30 }, (_, i) => `<article class="ag-mini-card" style="padding:20px;min-height:100px"><strong>Agenda kegiatan ${i + 1}</strong><p>Detail kegiatan madrasah</p></article>`).join('');
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
      <div class="dashboard-layout"><div class="dashboard-content-wrapper"><main class="main-content"><div class="content-area"><div class="content-container">
        <div class="agw-root"><div class="agw-content"><div class="ag-root"><div class="ag-main-layout">
          <section class="ag-card ag-calendar-container"><div style="height:360px">Kalender</div><footer class="ag-calendar-footer"><div class="ag-legend">${['Hari Aktif', 'PBM tidak efektif', 'Hari Libur', 'Cuti Bersama'].map(label => `<span class="ag-legend-item"><span class="ag-legend-box"></span>${label}</span>`).join('')}</div></footer></section>
          <section class="ag-card ag-details-card"><nav class="ag-timeline-tabs">${['Terpilih', 'Berlangsung', 'Mendatang'].map(label => `<button class="ag-tab-btn">${label}</button>`).join('')}</nav><div class="ag-details-content"><div class="ag-timeline">${events}</div></div></section>
        </div></div></div></div>
      </div></div></main></div></div>
    </body></html>`;
    const installedChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
        || (process.platform === 'win32' && fs.existsSync(installedChrome) ? installedChrome : undefined);
    const browser = await puppeteer.launch({ headless: true, executablePath, args: ['--disable-gpu'] });
    try {
        const page = await browser.newPage();
        await page.setContent(html);
        await page.addStyleTag({ content: css });
        for (const width of [320, 390, 768, 1023]) {
            await page.setViewport({ width, height: 780 });
            for (const dark of [false, true]) {
                await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark);
                const metrics = await page.evaluate(() => {
                    const details = document.querySelector('.ag-details-content');
                    const root = document.querySelector('.ag-root');
                    const card = document.querySelector('.ag-details-card');
                    details.scrollTop = 100;
                    const styles = getComputedStyle(details);
                    const scrollbar = getComputedStyle(details, '::-webkit-scrollbar');
                    const nestedScrollers = [...document.querySelectorAll('.agw-root *')].filter(el =>
                        el.scrollHeight > el.clientHeight + 1 && /^(auto|scroll)$/.test(getComputedStyle(el).overflowY));
                    return {
                        overflowY: styles.overflowY, maxHeight: styles.maxHeight, panelScrollTop: details.scrollTop,
                        panelHeight: details.clientHeight, scrollHeight: details.scrollHeight,
                        cardHeight: getComputedStyle(card).height, rootOverflowY: getComputedStyle(root).overflowY,
                        scrollbarWidth: styles.scrollbarWidth, scrollbarDisplay: scrollbar.display,
                        documentWidth: document.documentElement.scrollWidth,
                        nestedScrollers: nestedScrollers.map(el => el.className),
                        lastBottom: details.lastElementChild.getBoundingClientRect().bottom,
                        panelBottom: details.getBoundingClientRect().bottom,
                    };
                });
                assert.equal(metrics.overflowY, 'visible', `${width}px panel must use page scroll`);
                assert.equal(metrics.maxHeight, 'none');
                assert.equal(metrics.rootOverflowY, 'visible');
                assert.equal(metrics.panelScrollTop, 0);
                assert.deepEqual(metrics.nestedScrollers, []);
                assert.equal(metrics.scrollbarWidth, 'none');
                assert.equal(metrics.scrollbarDisplay, 'none');
                assert(metrics.documentWidth <= width, `${width}px has horizontal overflow`);
                assert(metrics.panelHeight >= metrics.scrollHeight - 1, 'All agenda items must remain reachable');
                assert(metrics.lastBottom <= metrics.panelBottom + 1, 'Last activity must not be clipped');
                await page.evaluate(() => {
                    window.scrollTo(0, 0);
                    document.querySelector('.ag-details-content').scrollIntoView({ block: 'start' });
                });
                const before = await page.evaluate(() => window.scrollY);
                await page.mouse.move(width / 2, 200);
                await page.mouse.wheel({ deltaY: 350 });
                await page.waitForFunction(previous => window.scrollY > previous, {}, before);
                assert.equal(await page.$eval('.ag-details-content', el => el.scrollTop), 0);
            }
        }
        await page.setViewport({ width: 1280, height: 900 });
        const desktop = await page.$eval('.ag-details-content', el => ({ overflow: getComputedStyle(el).overflowY, max: getComputedStyle(el).maxHeight }));
        assert.equal(desktop.overflow, 'auto');
        assert.equal(desktop.max, '580px');
        console.log('PASS: single page scroll, no visible scrollbars, no clipped content at 320–1023px in light/dark mode; desktop panel scroll preserved.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
