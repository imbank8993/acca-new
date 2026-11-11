// Run against emitted JavaScript, without ts-node or application bootstrap.
// Compilation alone does not catch workspace entry points that still target TS.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

assert.ok(fs.existsSync(path.join(__dirname, '../dist/src/main.js')), 'Missing backend entry point: dist/src/main.js');
assert.ok(require.resolve('@acca/shared').endsWith('.js'), 'Shared package must resolve to compiled JavaScript');
const { formLabelKey } = require('@acca/shared');
assert.equal(typeof formLabelKey, 'function');
assert.equal(formLabelKey([{ id: 'name', label: 'Nama' }], { id: 'name', label: 'Nama' }), 'Nama');
const { PrismaService } = require('../dist/src/prisma/prisma.service.js');
assert.equal(typeof PrismaService, 'function');
const { AppModule } = require('../dist/src/app.module.js');
assert.equal(typeof AppModule, 'function');
console.log('Backend entry point and compiled dependency graph verified.');
