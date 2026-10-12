// Regresi kondisi setelah perbaikan, menggunakan data tiruan.
const {spawnSync}=require('node:child_process');
const result=spawnSync(process.execPath,['--test','apps/api/test/forms-security.test.cjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status||0;
