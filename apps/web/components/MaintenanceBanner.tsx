'use client';
import useSWR from 'swr';
import { getCurrentUser } from '@/lib/auth-client';
import { parseRoles } from '@/lib/auth';

interface MaintenanceSetting {
    key: string;
    label: string;
    value: string;
    message: string;
}

interface MaintenanceBannerProps {
    pageKey: string;
    isAdmin?: boolean;
    children?: React.ReactNode;
}

interface User {
    role?: string;
    roles?: string[];
}

interface CombinedData {
    settings: MaintenanceSetting[];
    user: User | null;
}

const fetcher = async (): Promise<CombinedData> => {
    // Run both requests in parallel — SWR will cache this whole response
    const [settingsRes, userRes] = await Promise.all([
        fetch(`/api/site-settings?t=${Date.now()}`, { cache: 'no-store' }),
        getCurrentUser()
    ]);

    let settings: MaintenanceSetting[] = [];
    if (settingsRes.ok) {
        try {
            const json = await settingsRes.json();
            if (json?.data) settings = json.data;
        } catch { /* ignore */ }
    }

    return { settings, user: userRes };
};

export default function MaintenanceBanner({ pageKey, isAdmin = false, children }: MaintenanceBannerProps) {
    // SWR: automatically caches, revalidates in background, dedupes concurrent requests
    const { data, isLoading } = useSWR<CombinedData>(
        'maintenance-banner-data',
        fetcher,
        {
            revalidateOnFocus: false,   // skip background revalidation (reduces API calls)
            revalidateIfStale: false,   // don't refetch stale data on mount (we already have fresh from SSR/edge)
            shouldRetryOnError: false,
            dedupingInterval: 60_000,    // dedupe requests within 60s window
        }
    );

    const settings = data?.settings ?? [];
    const user = data?.user ?? null;

    /**
     * Admin dikecualikan dari mode pemeliharaan — kalau tidak, menyalakan mode itu
     * untuk sebuah halaman akan mengunci orang yang seharusnya memperbaikinya.
     *
     * Dua koreksi. `user?.role?.toUpperCase() === 'ADMIN'` adalah perbandingan
     * string UTUH, sedangkan ketiga akun admin di basis data ini berrole gabungan
     * (`ADMIN,GURU`, dst) — hanya cabang `user.roles` yang menyelamatkannya. Dan
     * keduanya tidak mengenali `ADMINISTRATOR`, padahal backend menyetarakannya
     * dengan ADMIN di seluruh pemeriksaan wewenang (`ROLE_ADMIN`), sehingga akun
     * seperti itu akan terkunci dari halaman yang sedang dipelihara.
     */
    const daftarRole = Array.isArray(user?.roles) && user.roles.length
        ? user.roles.map(r => String(r).trim().toUpperCase())
        : parseRoles(String(user?.role || ''));
    const hasAdminRole = daftarRole.some(r => r === 'ADMIN' || r === 'ADMINISTRATOR');

    const globalSetting = settings.find(s => s.key === 'maintenance_global');
    const normalizedKey = pageKey.replace(/^maintenance_/, '');
    const pageSetting = settings.find(s =>
        s.key === pageKey ||
        s.key === `maintenance_${normalizedKey}` ||
        s.key.replace(/^maintenance_/, '') === normalizedKey
    );

    if (isLoading) return <>{children}</>;

    const globalLocked = globalSetting?.value === 'true';
    const pageLocked = pageSetting?.value === 'true';

    if (!globalLocked && !pageLocked) return <>{children}</>;

    const title = globalLocked ? 'Situs Dalam Perbaikan.' : 'Halaman Dalam Perbaikan.';

    // ── Admin: tetap bisa mengakses halaman, cukup diberi bilah pemberitahuan ──
    if (isAdmin || hasAdminRole) {
        return (
            <>
                <div className="maint-admin-bar" role="status">
                    <span className="maint-admin-dot" />
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    </svg>
                    <span className="maint-admin-text">
                        <b>Mode pemeliharaan aktif</b> untuk halaman ini — hanya admin yang dapat melihatnya.
                    </span>
                </div>
                {children}
                <style jsx global>{`
                    .maint-admin-bar {
                        display: flex;
                        align-items: center;
                        gap: 9px;
                        margin: 0 0 14px;
                        padding: 10px 16px;
                        border-radius: 12px;
                        background: rgba(245, 158, 11, 0.10);
                        border: 1px solid rgba(245, 158, 11, 0.30);
                        color: #b45309;
                        font-size: 0.82rem;
                        font-weight: 500;
                        font-family: 'Poppins', system-ui, sans-serif;
                    }
                    .maint-admin-bar b { font-weight: 800; }
                    .maint-admin-bar svg { flex-shrink: 0; }
                    .maint-admin-dot {
                        width: 8px; height: 8px; border-radius: 50%;
                        background: #f59e0b; flex-shrink: 0;
                        box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5);
                        animation: maintDot 2s infinite;
                    }
                    .dark .maint-admin-bar {
                        background: rgba(245, 158, 11, 0.12);
                        border-color: rgba(245, 158, 11, 0.25);
                        color: #fbbf24;
                    }
                    @keyframes maintDot {
                        0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
                        70% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
                        100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
                    }
                `}</style>
            </>
        );
    }

    // ── Non-admin: tampilkan halaman pemeliharaan profesional sebagai PENGGANTI
    // konten (bukan menutupi halaman yang tetap berjalan di belakang). ──
    // Pola "wrapper" (ada children) → tampil inline di area konten, shell tetap
    // bisa dipakai. Pola "sibling" (tanpa children) → layar penuh.
    const inline = children != null;

    return (
        <div className={`maint-screen ${inline ? 'maint-screen--inline' : 'maint-screen--fixed'}`} role="alert">
            <div className="maint-card">
                <div className="maint-iconWrap">
                    <svg className="maint-gear" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V15z" />
                    </svg>
                </div>
                <span className="maint-chip">Pemeliharaan</span>
                <h2 className="maint-title">{title}</h2>
                <p className="maint-sub">Silakan coba lagi beberapa saat.</p>
                <button className="maint-btn" onClick={() => (window.location.href = '/')}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Kembali ke Beranda
                </button>
                <div className="maint-brand">MAN Insan Cendekia Gowa · ACCA</div>
            </div>

            <style jsx global>{`
                .maint-screen {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-sizing: border-box;
                    font-family: 'Poppins', system-ui, sans-serif;
                    animation: maintFade 0.35s ease-out;
                }
                .maint-screen--fixed {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    padding: 24px;
                    background:
                        radial-gradient(1100px 520px at 50% -10%, rgba(0, 56, 168, 0.07), transparent 60%),
                        var(--n-bg, #f1f5f9);
                }
                .maint-screen--inline {
                    position: absolute;
                    inset: 0;
                    z-index: 99;
                    background: var(--n-bg, #f1f5f9);
                    padding: 32px 16px;
                }
                .dark .maint-screen--inline {
                    background: var(--n-bg, #0f172a);
                }
                .dark .maint-screen--fixed {
                    background:
                        radial-gradient(1100px 520px at 50% -10%, rgba(59, 130, 246, 0.10), transparent 60%),
                        var(--n-bg, #0f172a);
                }

                /* Layout Adaptation when inside .main-content */
                .main-content .maint-screen--fixed,
                .main-content .maint-screen--inline {
                    position: fixed;
                    top: calc(var(--app-header-h) + env(safe-area-inset-top));
                    left: calc(var(--app-sidebar-w) + env(safe-area-inset-left));
                    right: env(safe-area-inset-right);
                    bottom: env(safe-area-inset-bottom);
                    z-index: 99;
                    border-radius: 0;
                    transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .main-content.collapsed .maint-screen--fixed,
                .main-content.collapsed .maint-screen--inline {
                    left: calc(var(--app-sidebar-w-collapsed) + env(safe-area-inset-left));
                }

                @media (max-width: 767.98px) {
                    .main-content .maint-screen--fixed,
                    .main-content .maint-screen--inline,
                    .main-content.collapsed .maint-screen--fixed,
                    .main-content.collapsed .maint-screen--inline {
                        left: calc(4px + env(safe-area-inset-left));
                        right: calc(4px + env(safe-area-inset-right));
                        top: calc(var(--app-header-h) + var(--app-margin) + env(safe-area-inset-top));
                        bottom: calc(4px + env(safe-area-inset-bottom));
                        border-radius: 14px;
                    }
                }

                .maint-card {
                    width: 100%;
                    max-width: 460px;
                    padding: 40px 32px 28px;
                    background: var(--n-card, #ffffff);
                    border: 1px solid var(--n-border, #e8edf3);
                    border-radius: 24px;
                    box-shadow: 0 20px 45px -18px rgba(0, 56, 168, 0.18);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    animation: maintScaleIn 0.45s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .dark .maint-card {
                    background: var(--n-card, #1e293b);
                    border-color: rgba(255, 255, 255, 0.07);
                    box-shadow: 0 20px 45px -18px rgba(0, 0, 0, 0.5);
                }

                .maint-iconWrap {
                    width: 84px;
                    height: 84px;
                    border-radius: 24px;
                    background: linear-gradient(135deg, #3083ff 0%, #c2185b 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 14px 30px -8px rgba(194, 24, 91, 0.45);
                    margin-bottom: 18px;
                }
                .maint-gear { animation: maintSpin 7s linear infinite; transform-origin: center; }

                .maint-chip {
                    font-size: 0.66rem;
                    font-weight: 800;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                    color: #c2185b;
                    background: rgba(194, 24, 91, 0.08);
                    padding: 4px 12px;
                    border-radius: 999px;
                    margin-bottom: 12px;
                }
                .dark .maint-chip { color: #f472b6; background: rgba(244, 114, 182, 0.12); }

                .maint-title {
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: var(--n-ink, #0f172a);
                    margin: 0 0 10px;
                    letter-spacing: -0.02em;
                    line-height: 1.2;
                }
                .dark .maint-title { color: #f1f5f9; }

                .maint-message {
                    font-size: 0.98rem;
                    color: var(--n-ink, #334155);
                    margin: 0 0 6px;
                    line-height: 1.55;
                    font-weight: 500;
                    max-width: 360px;
                }
                .dark .maint-message { color: #e2e8f0; }

                .maint-sub {
                    font-size: 0.83rem;
                    color: var(--n-muted, #94a3b8);
                    margin: 0 0 26px;
                    line-height: 1.5;
                    max-width: 340px;
                }

                .maint-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 9px;
                    padding: 13px 26px;
                    background: linear-gradient(135deg, #3083ff 0%, #c2185b 100%);
                    color: #fff;
                    border: none;
                    border-radius: 14px;
                    font-weight: 700;
                    font-size: 0.92rem;
                    font-family: inherit;
                    cursor: pointer;
                    box-shadow: 0 10px 22px -8px rgba(0, 56, 168, 0.5);
                    transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
                }
                .maint-btn:hover { transform: translateY(-2px); filter: brightness(1.05); box-shadow: 0 14px 26px -8px rgba(0, 56, 168, 0.55); }
                .maint-btn:active { transform: translateY(0); }

                .maint-brand {
                    margin-top: 22px;
                    padding-top: 16px;
                    border-top: 1px solid var(--n-border, #eef2f7);
                    width: 100%;
                    font-size: 0.7rem;
                    font-weight: 600;
                    letter-spacing: 0.03em;
                    color: var(--n-muted, #94a3b8);
                }
                .dark .maint-brand { border-top-color: rgba(255, 255, 255, 0.07); }

                @keyframes maintFade { from { opacity: 0; } to { opacity: 1; } }
                @keyframes maintScaleIn {
                    from { opacity: 0; transform: translateY(14px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes maintSpin { to { transform: rotate(360deg); } }
                @media (prefers-reduced-motion: reduce) {
                    .maint-gear { animation: none; }
                }
            `}</style>
        </div>
    );
}
