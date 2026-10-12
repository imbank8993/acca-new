// Jalankan verifikasi kondisi setelah perbaikan; tidak memakai database produksi.
const { spawnSync } = require('node:child_process');
for (const args of [['--test', 'apps/api/test/keuangan-security.test.cjs'], ['artifacts/verify-keuangan-ui.cjs']]) {
    const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
}
