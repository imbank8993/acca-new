// Browser checks real glyph fonts, including page-specific and mobile !important rules.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const arabic = 'إِنَّ اللُّغَةَ الْعَرَبِيَّةَ جَمِيلَةٌ';
(async () => {
    const latinPath = path.join(root, 'scratch/poppins-latin-400.woff2');
    fs.mkdirSync(path.dirname(latinPath), { recursive: true });
    if (!fs.existsSync(latinPath)) {
        const response = await fetch('https://fonts.googleapis.com/css2?family=Poppins:wght@400&display=swap', { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' } });
        const css = await response.text();
        const block = [...css.matchAll(/@font-face\s*\{[^}]+\}/g)].find(match => match[0].includes('U+0000-00FF'))?.[0];
        const url = block?.match(/url\(([^)]+)\)/)?.[1]; assert(url, 'Poppins fixture font missing');
        const font = await fetch(url); assert(font.ok); fs.writeFileSync(latinPath, Buffer.from(await font.arrayBuffer()));
    }
    const browser = await require('puppeteer').launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setRequestInterception(true);
        page.on('request', request => {
            const url = new URL(request.url());
            if (url.pathname.startsWith('/fonts/amiri/')) {
                const filename = path.basename(url.pathname);
                return request.respond({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.join(root, 'apps/web/public/fonts/amiri', filename)) });
            }
            if (url.pathname === '/poppins-latin.woff2') return request.respond({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(latinPath) });
            if (request.isNavigationRequest()) return request.respond({ status: 200, contentType: 'text/html', body: '<html lang="id"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="preview"></main></body></html>' });
            request.abort();
        });
        await page.goto('http://arabic-font.test');
        await page.addStyleTag({ content: read('apps/web/app/globals.css').replace(/^@import[^;]+;/gm, '') });
        for (const file of ['apps/web/app/jurnal/jurnal.css', 'apps/web/app/absensi/absensi.css', 'apps/web/app/nilai/nilai.css', 'apps/web/components/ui/modal.css']) await page.addStyleTag({ content: read(file) });
        await page.addStyleTag({ content: `${[300,400,500,600,700,800,900].map(weight=>`@font-face{font-family:Poppins;src:url('/poppins-latin.woff2') format('woff2');font-weight:${weight};unicode-range:U+0000-00FF}`).join('')}body{margin:0;padding:20px;background:#ebecf1}main{display:grid;gap:16px;max-width:100%;min-width:0}section{padding:20px;background:var(--n-card,white);border-radius:14px;min-width:0}h2{font-size:16px;margin:0 0 12px}p,td{line-height:2.4;overflow-wrap:anywhere}table{width:100%;table-layout:fixed}input,textarea{width:100%;min-width:0;box-sizing:border-box;font-size:16px;line-height:1.8;padding:8px;border:1px solid #cbd5e1;border-radius:8px}label{display:block;font-size:12px;margin:8px 0}.samples{display:flex;gap:20px;flex-wrap:wrap}` });
        await page.$eval('#preview', (element, arabic) => {
            element.innerHTML = `<section class="jurnal-container"><h2>Jurnal Mengajar</h2><p id="latin">Materi pembelajaran kelas XI — pertemuan 1</p><table><tr><td id="jurnal-ar">${arabic}</td></tr><tr><td id="mixed">Materi: ${arabic} · Bab 2</td></tr></table><label>Materi jurnal</label><input id="jurnal-input" value="${arabic}"></section><section class="absensi-page"><h2>Absensi</h2><p id="absensi-ar">${arabic}</p><label>Catatan kehadiran</label><textarea id="absensi-input">${arabic}</textarea></section><section class="nl-wrapper"><h2>Nilai</h2><p id="nilai-ar">${arabic}</p><label>Topik penilaian</label><input id="nilai-input" value="Materi: ${arabic}"><div class="samples"><strong id="bold">${arabic}</strong><em id="italic">${arabic}</em><strong><em id="bold-italic">${arabic}</em></strong></div></section><section class="nl__modalContent"><h2>Modal penilaian</h2><p id="modal-ar">${arabic}</p></section>`;
        }, arabic);
        const client = await page.createCDPSession(); await client.send('DOM.enable'); await client.send('CSS.enable');
        const fontsFor = async selector => { const { root: document } = await client.send('DOM.getDocument'); const { nodeId } = await client.send('DOM.querySelector', { nodeId: document.nodeId, selector }); return (await client.send('CSS.getPlatformFontsForNode', { nodeId })).fonts; };
        await page.evaluate(() => document.fonts.ready);
        const latinBefore = await fontsFor('#latin'); assert(latinBefore.some(font => font.familyName === 'Poppins'));
        await page.addStyleTag({ content: read('apps/web/app/arabic-font.css') });
        const widths = {};
        for (const width of [320, 390, 768, 1280]) {
            await page.setViewport({ width, height: 1100 });
            await page.evaluate(async arabic => { await Promise.all([document.fonts.load('400 16px Poppins', arabic), document.fonts.load('700 16px Poppins', arabic), document.fonts.load('italic 400 16px Poppins', arabic), document.fonts.load('italic 700 16px Poppins', arabic)]); await document.fonts.ready; }, arabic);
            const fonts = {};
            for (const selector of ['#jurnal-ar', '#absensi-ar', '#nilai-ar', '#modal-ar', '#bold', '#italic', '#bold-italic', '#mixed']) {
                fonts[selector] = await fontsFor(selector); assert(fonts[selector].some(font => font.familyName === 'Amiri' && font.isCustomFont), `Amiri missing: ${selector} at ${width}: ${JSON.stringify(fonts[selector])}`);
            }
            assert(fonts['#bold'].some(font=>font.familyName==='Amiri'&&/Bold/.test(font.postScriptName)), 'Bold Arabic font missing');
            const latinAfter = await fontsFor('#latin'); const identity=fonts=>fonts.map(({familyName,postScriptName,isCustomFont})=>({familyName,postScriptName,isCustomFont}));assert.deepEqual(identity(latinAfter), identity(latinBefore), 'Latin glyph font changed');
            const inputFonts = await page.$$eval('input,textarea', elements => elements.map(element => ({ font: getComputedStyle(element).fontFamily, value: element.value })));
            assert(inputFonts.every(item => item.font.includes('Poppins') && item.value.includes(arabic)));
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth); assert(!overflow, `Overflow at ${width}`);
            widths[width] = { arabicFonts: [...new Set(Object.values(fonts).flat().map(font => font.familyName))], latinUnchanged: true, overflow: false };
            if ([390, 1280].includes(width)) await page.screenshot({ path: path.join(root, `artifacts/arabic-font-${width}.png`), fullPage: true });
        }
        // Google Latin faces may arrive after the application stylesheet.
        await page.addStyleTag({content:[300,400,500,600,700,800,900].map(weight=>`@font-face{font-family:Poppins;src:url('/poppins-latin.woff2') format('woff2');font-weight:${weight};unicode-range:U+0000-00FF}`).join('')});
        await page.evaluate(()=>document.fonts.ready);assert((await fontsFor('#jurnal-ar')).some(font=>font.familyName==='Amiri'));
        await page.focus('#absensi-input'); await page.keyboard.press('End'); await page.keyboard.type(' · مَرْحَبًا');
        assert((await page.$eval('#absensi-input', element => element.value)).endsWith(' · مَرْحَبًا'));
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(root, 'artifacts/arabic-font-verification.json'), JSON.stringify({ widths, inputPreserved: true, dynamicArabicInput: true, lateLatinFontStylesheet: true, styles: ['regular', 'bold', 'italic', 'bold-italic'], network: 'Amiri served locally; external requests blocked', latinFont: 'Poppins', arabicFont: 'Amiri' }, null, 2));
        console.log('Passed: Amiri glyphs, Poppins Latin, mixed text, dynamic inputs, forced mobile fonts, and 320–1280 layouts.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
