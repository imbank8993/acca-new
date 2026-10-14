const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function endpoint(user, { missingProfile = false } = {}) {
    const queries = [];
    const now = Date.now();
    const exams = ['active', 'upcoming', 'completed'].map((category, index) => ({
        id: `exam-${index}`, title: category, duration_minutes: 60,
        status: category === 'upcoming' ? 'scheduled' : category,
        is_published: true, created_by: 'profile',
        start_time: new Date(now + (category === 'upcoming' ? 86400000 : -86400000)),
        end_time: new Date(now + (category === 'completed' ? -3600000 : 172800000)),
        cbt_exam_attempts: missingProfile ? [] : [{
            id: 'attempt', status: category === 'completed' ? 'submitted' : 'in_progress',
            total_score: 87, started_at: null, finished_at: null,
        }],
        cbt_exam_targets: [], cbt_exam_participants: [],
    }));
    const prisma = new Proxy({}, { get(_target, model) {
        return {
            findFirst: async () => missingProfile ? null : { id: 'profile' },
            findMany: async query => {
                if (model === 'cbt_exams') { queries.push(query); return exams; }
                if (model === 'cbt_exam_participants') return exams.map(e => ({ exam_id: e.id }));
                if (model === 'siswa_kelas') return [{ kelas: 'X A' }];
                if (model === 'cbt_classes') return [{ id: 'class' }];
                if (model === 'cbt_exam_targets') return exams.map(e => ({ exam_id: e.id }));
                return [];
            },
        };
    } });
    const module = { exports: {} };
    const imports = {
        'next/server': { NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) } },
        '@/lib/prisma': { prisma },
        '@/lib/api-auth': { getApiUser: async () => user, unauthorizedResponse: () => ({ status: 401 }) },
    };
    const source = fs.readFileSync('apps/web/app/api/dashboard/cbt-exams/route.ts', 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText, { module, exports: module.exports, require: name => imports[name], Date, console });
    return { get: () => module.exports.GET({}), queries };
}

test('dashboard API never returns scores for student, teacher or administrator', async () => {
    for (const role of ['SISWA', 'GURU', 'ADMIN']) {
        const route = endpoint({ roles: [role], authId: 'profile', nip: '0099089564' });
        const response = await route.get();
        assert.equal(response.status, 200);
        assert.equal(response.body.counts.total, 3);
        assert.doesNotMatch(JSON.stringify(response.body), /score|nilai/i);
        assert.equal(route.queries[0].include.cbt_exam_attempts.select.total_score, undefined);
        if (role === 'SISWA') {
            assert.equal(response.body.exams.completed[0].isCompleted, true);
            assert.equal(response.body.exams.active[0].isInProgress, true);
            assert.equal(response.body.exams.upcoming.length, 1);
        }
    }
});

test('student without CBT identity cannot load other students attempts', async () => {
    const route = endpoint({ roles: ['SISWA'], nip: '0099089564' }, { missingProfile: true });
    const response = await route.get();
    assert.equal(response.body.counts.total, 3);
    assert.equal(route.queries[0].include.cbt_exam_attempts.where.user_id.in.length, 0);
    assert(response.body.exams.all.every(exam => exam.attempt === null));
});

test('dashboard exams remain unavailable without authentication', async () => {
    assert.equal((await endpoint(null).get()).status, 401);
});
