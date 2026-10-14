const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { JwtService } = require('@nestjs/jwt');
const { Reflector } = require('@nestjs/core');

const moduleInstance = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(
    'apps/api/src/common/guards/user-throttler.guard.ts', 'utf8',
), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021,
    experimentalDecorators: true, emitDecoratorMetadata: true,
} }).outputText, { module: moduleInstance, exports: moduleInstance.exports, require, Reflect });
const { UserThrottlerGuard } = moduleInstance.exports;
const jwt = new JwtService({ secret: 'local-regression-test-secret' });
const token = sub => jwt.sign({ sub }, { expiresIn: '1h' });
const request = accessToken => ({ ip: '172.18.0.3', headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {} });

function createGuard() {
    const hits = new Map();
    const storage = { increment: async (key, ttl, limit) => {
        const totalHits = (hits.get(key) || 0) + 1;
        hits.set(key, totalHits);
        return { totalHits, timeToExpire: 60, isBlocked: totalHits > limit, timeToBlockExpire: 60 };
    } };
    return new UserThrottlerGuard([{ name: 'default', ttl: 60000, limit: 120 }], storage, new Reflector(), jwt);
}

test('users behind one Next.js proxy have separate limits, while one user remains limited', async () => {
    const guard = createGuard();
    await guard.onModuleInit();
    const handler = function me() {};
    const controller = class AccessController {};
    const context = req => ({
        getHandler: () => handler, getClass: () => controller,
        switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ header() {} }) }),
    });
    const first = request(token('547'));
    for (let i = 0; i < 120; i++) assert.equal(await guard.canActivate(context(first)), true);
    await assert.rejects(guard.canActivate(context(first)), error => error.getStatus() === 429);
    assert.equal(await guard.canActivate(context(request(token('548')))), true);
    await assert.rejects(guard.canActivate(context(request(token('547')))), error => error.getStatus() === 429);
});

test('forged, expired, missing and wrong-algorithm tokens keep the IP quota', async () => {
    const guard = createGuard();
    const forged = new JwtService({ secret: 'different-secret' }).sign({ sub: 'invented' });
    const expired = jwt.sign({ sub: '547' }, { expiresIn: -1 });
    const wrongAlgorithm = jwt.sign({ sub: '547' }, { algorithm: 'HS384' });
    for (const accessToken of [undefined, 'invalid-token', forged, expired, wrongAlgorithm]) {
        const req = request(accessToken);
        req.headers['x-forwarded-for'] = 'spoofed-address';
        assert.equal(await guard.getTracker(req), req.ip);
    }
    assert.equal(await guard.getTracker(request(jwt.sign({}))), '172.18.0.3');
});

test('valid token tracker uses verified user identity rather than token contents', async () => {
    const guard = createGuard();
    assert.equal(await guard.getTracker(request(token('547'))), 'user:547');
    assert.equal(await guard.getTracker(request(jwt.sign({ sub: '547', extra: 'renewed' }))), 'user:547');
});
