const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('backend build has a stable entry point and uses compiled shared code', () => {
    const config = JSON.parse(read('apps/api/tsconfig.json'));
    assert.equal(config.compilerOptions.rootDir, '.');
    assert.equal(config.compilerOptions.paths?.['@acca/shared'], undefined);
    const shared = JSON.parse(read('packages/shared/package.json'));
    assert.equal(shared.main, './dist/index.js');
    assert.equal(shared.types, './dist/index.d.ts');
    const api = JSON.parse(read('apps/api/package.json'));
    assert.match(api.scripts.prebuild, /build --workspace=@acca\/shared/);
    assert.equal(api.scripts['start:prod'], 'node dist/src/main.js');
    assert.match(read('apps/api/Dockerfile'), /CMD \["node", "apps\/api\/dist\/src\/main.js"\]/);
    require('../scripts/verify-build.cjs');
});

test('deployment requires healthy containers before reporting success', () => {
    for (const file of ['.github/workflows/deploy.yml', 'scripts/deploy.sh']) {
        const script = read(file);
        assert.ok(script.indexOf('sh scripts/check-deployment-health.sh') > script.indexOf('docker compose up -d'));
    }
    const health = read('scripts/check-deployment-health.sh');
    assert.match(health, /for service in acca-api acca-web/);
    assert.match(health, /health.*unhealthy/);
    assert.match(health, /health.*healthy/);
    assert.match(health, /exit 1/);
});

test('compiled backend initializes all Nest modules without TypeScript loaders', async () => {
    const { Test } = require('@nestjs/testing');
    const { ConfigService } = require('@nestjs/config');
    const { AppModule } = require('../dist/src/app.module.js');
    const { PrismaService } = require('../dist/src/prisma/prisma.service.js');
    // Replace the database before instantiation: this smoke check must never
    // connect to or install audit triggers on a real database.
    const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PrismaService).useValue({ $queryRawUnsafe: async () => [] })
        .overrideProvider(ConfigService).useValue(new ConfigService({ JWT_SECRET: 'build-smoke-test-only' }))
        .compile();
    try { await module.init(); }
    finally { await module.close(); }
});
