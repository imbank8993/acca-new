export interface AuditContext {
    user_id?: string | null; user_nip?: string | null; user_name?: string | null; user_role?: string | null;
    ip_address?: string | null; user_agent?: string | null; page?: string | null; source?: string;
}

const protectedKey = /password|passwd|secret|token|credential|private.?key|access.?key|api.?key|authorization|cookie|connection.?string|database.?url/i;
export function redactAuditValue(value: unknown, depth = 0): unknown {
    if (depth > 10) return '[Data terlalu dalam]';
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
        // Settings often store JSON as text; inspect it before limiting its length.
        if (/^\s*[\[{]/.test(value)) {
            if (value.length > 1_000_000) return '[JSON terlalu besar]';
            try { return JSON.stringify(redactAuditValue(JSON.parse(value), depth + 1)); } catch { /* Plain text. */ }
        }
        return value.length > 4000 ? value.slice(0, 4000) + '…' : value;
    }
    if (Array.isArray(value)) return value.slice(0, 50).map(item => redactAuditValue(item, depth + 1));
    if (!value || typeof value !== 'object') return value;
    const record = value as Record<string, unknown>;
    const protectedSetting = [record.key, record.name, record.setting_key].some(key => typeof key === 'string' && protectedKey.test(key));
    return Object.fromEntries(Object.entries(record).map(([key, item]) => [key,
        protectedKey.test(key) || (protectedSetting && ['value', 'data', 'setting_value'].includes(key))
            ? '[Disamarkan]' : redactAuditValue(item, depth + 1)]));
}

/** Preserve lazy Prisma promises and batch/interactive transaction semantics. */
export function withAuditContext<T extends object>(client: T, resolveContext: () => AuditContext | undefined | Promise<AuditContext | undefined>): T {
    const marker = Symbol.for('acca.audited-prisma');
    if ((client as any)[marker]) return client;
    const base = client as any;
    const originals = new WeakMap<object, any>();
    const delegates = new Map<PropertyKey, any>();
    const context = () => Promise.resolve(resolveContext());
    const setContext = (db: any, value: AuditContext) => db.$queryRawUnsafe("SELECT set_config('acca.audit_context', $1, true)", JSON.stringify(value));
    const wrap = (promise: any) => {
        const captured = context();
        let execution: Promise<any> | undefined;
        const run = () => execution ??= captured.then(value => value
            ? base.$transaction([setContext(base, value), promise]).then((values: any[]) => values[1])
            : promise);
        const lazy = {
            [Symbol.toStringTag]: 'PrismaPromise',
            then: (yes: any, no: any) => run().then(yes, no),
            catch: (no: any) => run().catch(no),
            finally: (done: any) => run().finally(done),
        };
        originals.set(lazy, promise);
        return lazy;
    };
    const mutations = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert', 'delete', 'deleteMany']);
    return new Proxy(client, {
        get(target, property) {
            if (property === marker) return true;
            if (property === '$transaction') return async (input: any, options: any) => {
                const value = await context();
                if (typeof input === 'function') return base.$transaction(async (tx: any) => {
                    if (value) await setContext(tx, value);
                    return input(tx);
                }, options);
                const operations = input.map((item: any) => originals.get(item) || item);
                return value ? base.$transaction([setContext(base, value), ...operations], options).then((rows: any[]) => rows.slice(1)) : base.$transaction(operations, options);
            };
            const value: any = Reflect.get(target, property, target);
            if (['$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe'].includes(String(property))) {
                return (...args: any[]) => wrap(value.apply(base, args));
            }
            if (value && typeof value === 'object' && typeof value.findMany === 'function') {
                if (!delegates.has(property)) delegates.set(property, new Proxy(value, {
                    get(delegate: any, operation) {
                        const method = delegate[operation];
                        if (typeof method !== 'function') return method;
                        return (...args: any[]) => mutations.has(String(operation)) ? wrap(method.apply(delegate, args)) : method.apply(delegate, args);
                    },
                }));
                return delegates.get(property);
            }
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
}
