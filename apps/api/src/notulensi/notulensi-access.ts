export interface NotulensiIdentity {
  id: string | bigint;
  auth_id?: string | null;
  nip?: string | null;
  username?: string | null;
  nama?: string | null;
  nama_lengkap?: string | null;
}

const normalized = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Old records contain names; only a unique, exact directory match may grant access. */
export function notulensiDirectory(users: NotulensiIdentity[], staff: Array<{ nip: string | null; nama_lengkap: string | null }> = [], legacyBindings?: Record<string, string | null>) {
  const byId = new Map(users.map(user => [String(user.id), user]));
  const aliases = new Map<string, Set<string>>();
  const add = (value: unknown, id: string) => {
    const key = normalized(value);
    if (!key) return;
    if (!aliases.has(key)) aliases.set(key, new Set());
    aliases.get(key)!.add(id);
  };
  for (const user of users) {
    for (const value of [user.nama, user.nama_lengkap, user.username, user.nip]) add(value, String(user.id));
  }
  for (const person of staff) {
    const matches = users.filter(user => person.nip && user.nip === person.nip);
    for (const user of matches) add(person.nama_lengkap, String(user.id));
    if (!matches.length) add(person.nama_lengkap, `unlinked-staff:${person.nip}`);
  }
  const bindings: Record<string, string | null> = legacyBindings ?? Object.fromEntries(
    [...aliases].map(([key, ids]) => [key, ids.size === 1 && byId.has([...ids][0]) ? [...ids][0] : null]),
  );
  const resolveLegacy = (value: unknown): string | null => {
    const key = normalized(value);
    if (!Object.prototype.hasOwnProperty.call(bindings, key)) return null;
    const id = bindings[key];
    return typeof id === 'string' && byId.has(id) ? id : null;
  };
  const ownerId = (createdBy: unknown): string | null => {
    const value = String(createdBy ?? '').trim();
    if (value.startsWith('user:')) return byId.has(value.slice(5)) ? value.slice(5) : null;
    return resolveLegacy(value);
  };
  const picId = (point: { pic_user_id?: string; pic?: string }): string | null => {
    // An explicit ID is authoritative. Never fall back to a mutable name.
    if (point.pic_user_id) return byId.has(String(point.pic_user_id)) ? String(point.pic_user_id) : null;
    return resolveLegacy(point.pic);
  };
  return { byId, resolveLegacy, ownerId, picId, legacyBindings: bindings };
}

export type NotulensiDirectory = ReturnType<typeof notulensiDirectory>;
