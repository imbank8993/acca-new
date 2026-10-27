import { Injectable } from '@nestjs/common';

export const PRESENCE_TTL_MS = 45_000;
type Entry = { userId: string; session: string; sequence: number; online: boolean; expires: number };

/** Live connections for the single API process in docker-compose. Restarts start offline. */
@Injectable()
export class PresenceService {
  private readonly tabs = new Map<string, Entry>();
  private readonly loggedOut = new Map<string, number>();

  private prune(now: number) {
    for (const [key, value] of this.tabs) if (value.expires <= now) this.tabs.delete(key);
    for (const [key, expires] of this.loggedOut) if (expires <= now) this.loggedOut.delete(key);
  }

  update(userId: string, session: string, tab: string, sequence: number, online: boolean, now = Date.now()) {
    this.prune(now);
    const sessionKey = `${userId}|${session}`;
    if (this.loggedOut.has(sessionKey)) return;
    const key = `${sessionKey}|${tab}`;
    const old = this.tabs.get(key);
    // Ignore heartbeats that arrive after a newer close signal.
    if (old && sequence <= old.sequence) return;
    this.tabs.set(key, { userId, session, sequence, online, expires: now + PRESENCE_TTL_MS });
  }

  logout(userId: string, session: string, now = Date.now()) {
    this.prune(now);
    this.loggedOut.set(`${userId}|${session}`, now + PRESENCE_TTL_MS);
    for (const [key, entry] of this.tabs) if (entry.userId === userId && entry.session === session) this.tabs.delete(key);
  }

  onlineUsers(now = Date.now()): Set<string> {
    this.prune(now);
    return new Set([...this.tabs.values()].filter(e => e.online).map(e => e.userId));
  }
}
