import { clearUserCache } from './auth-client';
import type { LogoutTarget } from './single-logout';

let logoutInProgress = false;
export function setLogoutInProgress(value: boolean) { logoutInProgress = value; }
export function isLogoutInProgress() { return logoutInProgress; }

export async function logoutAcrossApplications(): Promise<string[]> {
    const response = await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(12000) });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error('Logout ACCA belum berhasil. Silakan coba lagi.');
    clearUserCache();
    try { localStorage.setItem('acca_logout_at', String(Date.now())); } catch { /* Storage may be disabled. */ }
    const targets: LogoutTarget[] = Array.isArray(body.targets) ? body.targets : [];
    const results = await Promise.allSettled(targets.map(async target => {
        // A simple credentialed POST sends each destination's cookies, without exposing any token.
        const result = await fetch(target.url, { method: 'POST', credentials: 'include', mode: 'cors', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
        const data = await result.json();
        if (!result.ok || !data.ok) throw new Error('Logout not acknowledged');
    }));
    const failed = results.flatMap((result, index) => result.status === 'rejected' ? [targets[index].name] : []);
    if (body.configurationError) failed.push('Pengaturan logout aplikasi');
    return failed;
}
