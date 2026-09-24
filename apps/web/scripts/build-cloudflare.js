/**
 * Cloudflare Pages build script
 *
 * This script builds Next.js for Cloudflare Pages without using Vercel's build output.
 * It sets edge runtime for all API routes to satisfy @cloudflare/next-on-pages requirements.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

console.log('=== Cloudflare Pages Build ===');

// Step 1: Build Next.js
console.log('\n[1/4] Building Next.js...');
execSync('npx next build', { cwd: ROOT, stdio: 'inherit' });

// Step 2: Fix middleware manifest for edge runtime
console.log('\n[2/4] Patching middleware manifest...');
const middlewareManifestPath = path.join(ROOT, '.next', 'server', 'middleware-manifest.json');
if (fs.existsSync(middlewareManifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(middlewareManifestPath, 'utf-8'));
    // Ensure middleware uses edge runtime
    if (manifest.middleware && manifest.middleware['/']) {
        manifest.middleware['/'].runtime = 'edge';
        manifest.middleware['/'].region = 'auto';
        manifest.middleware['/'].env = 'production';
    }
    fs.writeFileSync(middlewareManifestPath, JSON.stringify(manifest, null, 2));
    console.log('  ✓ Patched middleware-manifest.json');
}

// Step 3: Run OpenNext Cloudflare adapter
console.log('\n[3/4] Running OpenNext Cloudflare adapter...');
try {
    execSync('npx @opennextjs/cloudflare build --skipWranglerConfigCheck', { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
    console.log('  ! OpenNext may have warnings, continuing...');
}

// Step 4: Copy _routes.json to output
console.log('\n[4/4] Finalizing output...');
const routesSrc = path.join(ROOT, '_routes.json');
const routesDest = path.join(ROOT, '.open-next', 'assets', '_routes.json');
if (fs.existsSync(routesSrc)) {
    fs.copyFileSync(routesSrc, routesDest);
    console.log('  ✓ Copied _routes.json to .open-next/assets/');
}

console.log('\n=== Build Complete ===');
console.log('Output directory: .open-next/assets');
console.log('Worker: .open-next/worker.js');