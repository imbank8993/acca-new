const fs = require('fs');
const path = require('path');

// 1. Patch OpenNext internals (Hanya jika diperlukan untuk Node middleware)
const middlewarePath = path.join(__dirname, '..', 'node_modules', '@opennextjs', 'cloudflare', 'dist', 'cli', 'build', 'utils', 'middleware.js');

if (fs.existsSync(middlewarePath)) {
    let content = fs.readFileSync(middlewarePath, 'utf-8');
    if (!content.includes('// Patched: Allow Node.js middleware')) {
        const patchedContent = content.replace(
            /return Boolean\(functionsConfigManifest\?\.functions\["\/(_middleware|_proxy)"\]\);/,
            '// Patched: Allow Node.js middleware/proxy for Cloudflare\n        return false;'
        );
        fs.writeFileSync(middlewarePath, patchedContent);
        console.log('Patched OpenNext middleware.js');
    }
}

// 2. Fix createRequire (Hanya perbaikan string sederhana, sangat aman)
const handlerPath = path.join(__dirname, '..', '.open-next', 'middleware', 'handler.mjs');
if (fs.existsSync(handlerPath)) {
    let content = fs.readFileSync(handlerPath, 'utf-8');
    
    // Gunakan penggantian string literal yang jauh lebih aman daripada regex kompleks
    let patched = content.split('topLevelCreateRequire(import.meta.url)').join('topLevelCreateRequire(import.meta.url || "file:///index.js")');
    patched = patched.split("new URL('.', import.meta.url)").join("new URL('.', import.meta.url || 'file:///index.js')");
    
    if (patched !== content) {
        fs.writeFileSync(handlerPath, patched);
        console.log('Fixed createRequire in handler.mjs');
    }
}

// 3. File Injection Strategy (Sangat aman, tidak menyentuh kode)
const openNextDir = path.join(__dirname, '..', '.open-next');
const middlewareNextDir = path.join(openNextDir, 'middleware', '.next');

if (!fs.existsSync(middlewareNextDir)) {
    fs.mkdirSync(middlewareNextDir, { recursive: true });
}

const sourceFiles = [
    { from: '.next/required-server-files.json', to: 'middleware/.next/required-server-files.json' },
    { from: '.next/routes-manifest.json', to: 'middleware/.next/routes-manifest.json' },
    { from: '.next/build-id', to: 'middleware/.next/build-id' }
];

sourceFiles.forEach(file => {
    const src = path.join(__dirname, '..', file.from);
    const dest = path.join(__dirname, '..', '.open-next', file.to);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`Injected ${file.from}`);
    } else {
        if (file.from.endsWith('.json')) {
            fs.writeFileSync(dest, JSON.stringify({ config: { env: {} }, headers: [], buildId: "production" }));
        } else {
            fs.writeFileSync(dest, "production");
        }
        console.log(`Created dummy ${file.from}`);
    }
});

// 4. Create a CLEAN output directory for Cloudflare Pages
const outDir = path.join(openNextDir, 'out');
if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

// Copy _worker.js to out/
const workerPath = path.join(openNextDir, 'worker.js');
const targetWorkerPath = path.join(openNextDir, '_worker.js');

if (fs.existsSync(workerPath)) {
    fs.copyFileSync(workerPath, path.join(outDir, '_worker.js'));
    console.log('✅ Copied worker.js to out/_worker.js');
} else if (fs.existsSync(targetWorkerPath)) {
    fs.copyFileSync(targetWorkerPath, path.join(outDir, '_worker.js'));
    console.log('✅ Copied existing _worker.js to out/_worker.js');
}

// Copy assets to out/ (but maintain structure)
const assetsSource = path.join(openNextDir, 'assets');
if (fs.existsSync(assetsSource)) {
    // We use a simple copy recursive function or just copy the main folders
    console.log('Copying assets to out directory...');
    // Simple way to copy assets contents to out root
    const copyRecursiveSync = (src, dest) => {
        if (!fs.existsSync(src)) return;
        const stats = fs.statSync(src);
        if (stats.isDirectory()) {
            if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
            fs.readdirSync(src).forEach(child => {
                copyRecursiveSync(path.join(src, child), path.join(dest, child));
            });
        } else {
            fs.copyFileSync(src, dest);
        }
    };
    
    // Copy contents of assets/ into out/
    fs.readdirSync(assetsSource).forEach(child => {
        copyRecursiveSync(path.join(assetsSource, child), path.join(outDir, child));
    });
    console.log('✅ Assets merged into out directory');
}

// Copy dependency folders to out/ (REQUIRED for relative imports in _worker.js)
['cloudflare', 'middleware', 'server-functions'].forEach(folder => {
    const src = path.join(openNextDir, folder);
    const dest = path.join(outDir, folder);
    if (fs.existsSync(src)) {
        console.log(`Copying ${folder} to out directory...`);
        const copyRecursiveSync = (src, dest) => {
            const stats = fs.statSync(src);
            if (stats.isDirectory()) {
                if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
                fs.readdirSync(src).forEach(child => {
                    copyRecursiveSync(path.join(src, child), path.join(dest, child));
                });
            } else {
                fs.copyFileSync(src, dest);
            }
        };
        copyRecursiveSync(src, dest);
    }
});

console.log('✨ OpenNext cleaning and assembly completed at .open-next/out');
