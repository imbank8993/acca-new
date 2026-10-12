// Pengujian regresi kondisi setelah perbaikan, tanpa database produksi.
const {spawnSync}=require('node:child_process');
const result=spawnSync(process.execPath,['--test','apps/api/test/tugas-siswa-security.test.cjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status||0;
