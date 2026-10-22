const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const web = path.resolve('apps/web');

// TypeScript alone does not enforce Next's browser/server module boundary.
// Check local transitive imports and re-exports, even when their export is unused.
function forbiddenImports(entry) {
    const seen = new Set(), violations = [];
    function visit(file, chain) {
        if (seen.has(file)) return;
        seen.add(file);
        const tree = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        for (const node of tree.statements) {
            if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
            if (node.isTypeOnly || node.importClause?.isTypeOnly || !node.moduleSpecifier) continue;
            const bindings = node.importClause?.namedBindings || node.exportClause;
            if (bindings?.elements?.length && !node.importClause?.name && bindings.elements.every(item => item.isTypeOnly)) continue;
            const name = node.moduleSpecifier.text;
            if (['next/headers', 'server-only', '@prisma/client'].includes(name) || name.startsWith('node:')) {
                violations.push([...chain, path.relative(web, file), name].join(' -> '));
                continue;
            }
            const base = name.startsWith('@/') ? path.join(web, name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
            if (!base) continue;
            const dependency = [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')]
                .find(candidate => /\.[cm]?[jt]sx?$/.test(candidate) && fs.existsSync(candidate));
            if (dependency) visit(dependency, [...chain, path.relative(web, file)]);
        }
    }
    visit(path.join(web, entry), []);
    return violations;
}

for (const entry of ['app/ketidakhadiran/utils/PrintHelper.ts', 'app/ketidakhadiran/view.tsx']) {
    test(`${entry} has no server-only imports in its browser dependency graph`, () => {
        assert.deepEqual(forbiddenImports(entry), []);
    });
}
