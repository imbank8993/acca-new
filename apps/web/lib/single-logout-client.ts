import { clearUserCache } from './auth-client';
import type { LogoutTarget } from './single-logout';

let logoutInProgress = false;
export function setLogoutInProgress(value: boolean) { logoutInProgress = value; }
export function isLogoutInProgress() { return logoutInProgress; }

export async function logoutAcrossApplications(): Promise<string[]> {
    const response = await fetch('/api/auth/logout?phase=prepare', { method: 'POST', cache: 'no-store', keepalive: true, signal: AbortSignal.timeout(12000) });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error('Logout ACCA belum berhasil. Silakan coba lagi.');
    if (!Array.isArray(body.targets)) throw new Error('Daftar aplikasi logout tidak valid. Silakan coba lagi.');
    const targets: LogoutTarget[] = body.targets;
    const results = await Promise.allSettled(targets.map(async target => {
        // SameSite=Lax cookies are omitted on cross-site fetches. A 200/ok reply
        // in that situation only cleared an anonymous session, not the user's.
        if (typeof window !== 'undefined') {
            const source = new URL(window.location.href);
            const destination = new URL(target.url);
            const site = (url: URL) => `${url.protocol}//${url.hostname === 'icgowa.sch.id' || url.hostname.endsWith('.icgowa.sch.id') ? 'icgowa.sch.id' : url.hostname}`;
            if (site(source) !== site(destination)) throw new Error('Logout requires a same-site browser session');
        }
        // A simple credentialed POST sends each destination's cookies, without exposing any token.
        const result = await fetch(target.url, { method: 'POST', credentials: 'include', mode: 'cors', cache: 'no-store', redirect: 'error', keepalive: true, signal: AbortSignal.timeout(10000) });
        const data = await result.json();
        if (!result.ok || !data.ok) throw new Error('Logout not acknowledged');
    }));
    const failed = results.flatMap((result, index) => result.status === 'rejected' ? [targets[index].name] : []);
    if (body.configurationError) failed.push('Pengaturan logout aplikasi');
    if (body.integrationDisabled) failed.push('Logout bersama dinonaktifkan');
    if (!targets.length && !failed.length) failed.push('Daftar aplikasi logout kosong');
    // Clear ACCA and publish the shared marker only after remote requests have
    // settled, so auth redirects and sibling listeners cannot cut them short.
    const completed = await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store', keepalive: true, signal: AbortSignal.timeout(12000) });
    const completion = await completed.json();
    if (!completed.ok || !completion.ok) throw new Error('Logout ACCA belum berhasil. Silakan coba lagi.');
    clearUserCache();
    try { localStorage.setItem('acca_logout_at', String(Date.now())); } catch { /* Storage may be disabled. */ }
    return failed;
}
