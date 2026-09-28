import { NextResponse, type NextRequest } from 'next/server'
import { getAccessForAuthId } from '@/lib/edge-access'
import { verifyAppToken, decodeSessionCookie } from '@/lib/app-jwt'

const decodeCookieToken = decodeSessionCookie

const EXPIRE_COOKIE = { path: '/', expires: new Date(0), sameSite: 'lax' as const, httpOnly: true };

/**
 * Cookie peninggalan jalur pintas `?bypass=ADMIN2026` yang sudah dihapus.
 * Perangkat yang sempat memakainya masih menyimpannya sampai 30 menit, jadi
 * dikedaluwarsakan di respons pertama yang lewat sini.
 */
function clearLegacyBypassCookie(request: NextRequest, res: NextResponse) {
    if (request.cookies.has('bypass_access')) {
        res.cookies.set('bypass_access', '', EXPIRE_COOKIE);
    }
}

/** Buang SEMUA cookie sesi supaya perangkat tidak tersangkut di sesi mati. */
function clearDeadSessionCookies(request: NextRequest, res: NextResponse) {
    const clearOpts = EXPIRE_COOKIE;
    res.cookies.set('acca_session', '', clearOpts);
    res.cookies.set('acca_refresh_token', '', clearOpts);
    clearLegacyBypassCookie(request, res);
    for (const c of request.cookies.getAll()) {
        if (c.name.startsWith('sb-') || c.name.includes('supabase')) {
            res.cookies.set(c.name, '', { path: '/', expires: new Date(0), sameSite: 'lax' })
        }
    }
}

// Next.js middleware — runs on Edge runtime by default (compatible with Cloudflare Workers)
// This file is the standard entry point for Next.js middleware.

/**
 * Halaman utilitas yang selalu boleh diakses user yang sudah login.
 * Semuanya tidak memuat data ber-role; aksesnya dijaga oleh halaman/API itu sendiri.
 * SELAIN daftar ini, akses ditentukan murni oleh role_pages (lihat lib/edge-access.ts).
 */
const ALWAYS_ALLOWED = new Set([
    'dashboard',
    'profil', 'profile', 'ProfileSaya',
    'link-auth',
    'update-password',
    'tampilan-agenda',
    // Dua route di bawah tidak muncul di tab "Akses per Role" (bukan bagian MENU_GROUPS),
    // sehingga tidak bisa diatur admin. Keduanya dibuka lewat kode/QR, bukan lewat menu.
    'lckh-verification',
    'lckh/verification',
    'redirect',
])

/** Halaman yang hanya relevan untuk role tertentu tetapi belum diseed di role_pages. */
const ROLE_SCOPED_EXTRAS: Record<string, string[]> = {
    ADMIN: ['audit-log'],
    ADMINISTRATOR: ['audit-log'],
    WKM_AKADEMIK: ['audit-log'],
    WKM_KESISWAAN: ['audit-log'],
    WKM_KEASRAMAAN: ['audit-log'],
    WKM_HUMAS: ['audit-log'],
    OP_PENGUMUMAN: ['audit-log'],
    ORANG_TUA: ['anak'],
    OP_AGENDA: ['agenda-madrasah'],
}

export async function middleware(request: NextRequest) {
    const url = request.nextUrl.clone()
    const path = url.pathname

    // IMPORTANT: Skip middleware for multipart/form-data uploads to avoid body stream consumption
    // The Edge runtime consumes the body stream, preventing route handlers from parsing FormData
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data') && path.startsWith('/api/')) {
        return NextResponse.next()
    }

    // ── CATATAN: JALUR PINTAS `?bypass=ADMIN2026` SUDAH DIHAPUS ──
    // Kode itu berjalan sebelum daftar publicPaths dan sebelum cek sesi, lalu
    // memasang cookie 30 menit yang membuat middleware ini langsung `next()` untuk
    // SEMUA permintaan berikutnya. Artinya satu URL yang kodenya tertulis di source
    // mematikan seluruh penegakan role_pages — termasuk gerbang halaman yang justru
    // baru dipasang. Cookie lama `bypass_access` ikut dibersihkan di bawah supaya
    // perangkat yang terlanjur memilikinya tidak tetap terbuka sampai kedaluwarsa.

    // ── KOMPATIBILITAS URL LAMA ──
    // Era SPA: /dashboard?page=x&tab=y (dan /?page=x) → route asli /x?tab=y
    const legacyPage = url.searchParams.get('page')
    if (legacyPage && (path === '/dashboard' || path === '/')) {
        url.pathname = '/' + legacyPage.split('/').map(encodeURIComponent).join('/')
        url.searchParams.delete('page')
        return NextResponse.redirect(url)
    }

    // Path bersarang lama & alias nama halaman SPA → id halaman baru (kebab-case)
    const LEGACY_PATHS: Record<string, string> = {
        '/surat/daftar': '/surat?tab=daftar',
        '/surat-daftar': '/surat?tab=daftar',
        '/jurnal/input': '/jurnal?tab=input',
        '/jurnal-input': '/jurnal?tab=input',
        '/jurnal/banding': '/jurnal-banding',
        '/IzinGuru': '/izin-guru',
        '/Izin Guru': '/izin-guru',
        '/Dashboard': '/dashboard',
        '/Absensi': '/absensi',
        '/Ketidakhadiran': '/ketidakhadiran',
        '/RekamMedis': '/rekam-medis',
        '/Rekam Medis Siswa': '/rekam-medis',
        '/Piket': '/piket',
        '/JurnalGuru': '/jurnal',
        '/TugasTambahan': '/tugas-tambahan',
        '/Master Data': '/master',
        '/Pengaturan Data': '/pengaturan-data',
        '/Pengaturan Tugas': '/pengaturan-tugas',
        '/LCKH': '/lckh',
        '/LCKHApproval': '/lckh-approval',
        '/Nilai': '/nilai',
        '/GuruAsuh': '/guru-asuh',
        '/WaliKelas': '/wali-kelas',
        '/Formulir Dinamis': '/form',
        '/ProfileSaya': '/profile',
        '/personal-documents': '/dokumen?tab=pribadi',
        '/unggah-dokumen': '/dokumen?tab=sekolah',
        '/upload-dokumen': '/dokumen?tab=sekolah',
        '/Klinik': '/klinik',
        '/Keuangan': '/keuangan',
    }
    const decodedPath = decodeURIComponent(path)
    if (LEGACY_PATHS[path] || LEGACY_PATHS[decodedPath]) {
        url.pathname = LEGACY_PATHS[path] || LEGACY_PATHS[decodedPath]
        return NextResponse.redirect(url)
    }


    // ── PUBLIC PATHS ──
    // Added '/api/auth' and '/api/whatsapp/send' (for public forms) to avoid redirection loops
    // Also added surat-daftar and api/qrcode for public verification without login
    const publicPaths = [
        '/login',
        '/register',
        '/update-password', // Halaman lama era Supabase (menangkap access_token dari fragment URL)
        // Halaman tukar token dari email jadi password baru. Pemakainya justru
        // sedang TIDAK bisa masuk, jadi harus lolos gerbang sesi; tokennya sendiri
        // yang menjadi bukti wewenang, diverifikasi backend (sekali pakai, 60 menit).
        // Form "lupa password" sendiri ada di halaman /login yang sudah publik.
        '/reset-password',
        '/_next',
        '/favicon.ico',
        '/icon.svg',
        '/icon',
        '/logo',
        '/templates',
        '/logo-login.png',
        '/logo-sidebar.png',
        '/logo-icon.png',
        '/api/auth', // CRITICAL: Allow login/me/logout API calls to pass through
        '/api/public',
        '/api/monitoring',
        // Lolos gerbang sesi di middleware, TAPI backend-nya menuntut ADMIN
        // (`assertAdmin` di site-settings.controller): endpoint ini memindai
        // direktori aplikasi, jadi ia membocorkan seluruh struktur rute.
        '/api/pages',
        '/api/version', // Build id polled by AppUpdateChecker; no sensitive data, must work pre-login too
        '/surat/scan', // Public verification for QR code scanning
        '/lckh/verification', // Public verification for LCKH QR code scanning
        '/lckh-verification', // Legacy verification URL rewrite compatibility
        // Verifikasi surat ACCA hasil scan barcode/QR — sama seperti /surat/scan,
        // dibuka lewat kode di lembar surat, bukan lewat menu. Halaman + dua API
        // pendukungnya harus anonim, kalau tidak pemindai QR selalu mendarat di /login.
        '/ketidakhadiran/verify',
        '/api/ketidakhadiran/acca-letter/verify', // Lookup surat by barcode (read-only)
        '/api/ketidakhadiran/pdf-preview', // Proxy berkas surat untuk pratinjau
        '/guru-asuh/verify', // Verifikasi QR laporan guru asuh — dibuka lewat scan, bukan menu
        '/api/guru-asuh/laporan-submission/verify', // Lookup ajuan by id utk verifikasi (read-only)
        // Galeri foto dokumentasi piket — dibuka lewat link di pesan grup WA, bukan menu.
        // Browser in-app WhatsApp punya cookie jar sendiri, jadi sesi dari Chrome tidak
        // terbawa dan penerima selalu mendarat di /login. Halamannya read-only dan
        // mengambil datanya server-side (supabaseAdmin), tanpa API tambahan.
        // Konsekuensi yang disadari: siapa pun yang punya UUID laporan bisa melihat
        // fotonya, jadi halaman ini di-noindex agar tidak terjaring mesin pencari.
        '/piket/dokumentasi',
        // Link berbagi Informasi & Layanan yang dibuat sadar oleh ADMIN/WKM.
        // Sengaja BUKAN '/i' atau '/info': prefiks itu ikut mencocokkan
        // '/izin-guru' dan '/informasi' dan akan membuka keduanya tanpa login.
        // Sama seperti /piket/dokumentasi, aksesnya bersandar pada token acak
        // dan halamannya di-noindex.
        '/info-link',
        // Berkas untuk halaman di atas. Bukan proxy terbuka: URL sumbernya
        // diambil dari dokumen yang tercakup token, bukan dari pemanggil.
        '/api/informasi-akademik/share/file',
        '/api/qrcode', // QR code generation for public access
        '/verify', // Public verification standalone page
        '/verifikasi', // Public verification standalone page
        '/api/master/students/verify', // Verify siswa API endpoint (public)
        '/api/surat/verify', // Verify API endpoint
        '/api/surat/by-nomor', // Search surat by nomor (public read)
        '/api/surat/test-qr', // Test QR endpoint
        '/api/site-settings', // Public read access for maintenance configuration
        '/images', // Template images
        '/f' // Public form viewer
    ]

    // ── API PENDUKUNG VIEWER FORM PUBLIK ──
    // '/f' di atas hanya membuka halaman viewer-nya; halaman itu memanggil API di
    // bawah dari sisi klien. Tanpa pengecualian ini pengunjung anonim selalu kena
    // 401 dan viewer menampilkan "Formulir Tidak Ditemukan" untuk form publik.
    // Sengaja dicocokkan per-endpoint (bukan prefiks '/api/forms') supaya route
    // daftar/kelola form tetap tertutup. Keamanannya bersandar pada RLS: policy
    // SELECT anon di custom_forms hanya mengizinkan is_public = true, dan INSERT
    // respons anon hanya untuk form publik.
    const isPublicFormRead =
        request.method === 'GET' &&
        /^\/api\/forms\/[^/]+$/.test(path)
    const isPublicFormSubmit =
        request.method === 'POST' && path === '/api/forms/submit'

    // ── RESOLUSI TOKEN LINK INFORMASI ──
    // Hanya GET dengan ?token= yang anonim; POST/DELETE (buat/cabut link) di
    // path yang sama tetap lewat pengecekan sesi + verifikasi role di route-nya.
    const isPublicInformasiShare =
        request.method === 'GET' &&
        path === '/api/informasi-akademik/share' &&
        !!url.searchParams.get('token')

    const isPublic =
        publicPaths.some(p => path.startsWith(p)) ||
        path === '/' ||
        isPublicFormRead ||
        isPublicFormSubmit ||
        isPublicInformasiShare
    if (isPublic) {
        return NextResponse.next()
    }

    // ── AUTHENTICATION CHECK ──
    const hasSession = request.cookies.has('acca_session')

    const authHeader = request.headers.get('authorization')
    const hasAuthHeader = authHeader && authHeader.startsWith('Bearer ')

    if (!hasSession && !hasAuthHeader) {
        // If it's an API request, return 401 instead of redirecting to /login HTML
        if (path.startsWith('/api/')) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    const rawToken = request.cookies.get('acca_session')?.value

    // Decode from custom base64url encoding if present
    let accessToken = rawToken || ''
    
    // Fallback to Authorization header if cookie is missing
    if (!accessToken) {
        const authHeader = request.headers.get('authorization')
        if (authHeader && authHeader.startsWith('Bearer ')) {
            accessToken = authHeader.substring(7)
        }
    }

    if (!accessToken) {
        if (path.startsWith('/api/')) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        url.pathname = '/login'
        return NextResponse.redirect(url)
    }

    if (accessToken.startsWith('base64-')) {
        accessToken = decodeCookieToken(accessToken)
        if (!accessToken) {
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }
    }

    // ── VERIFIKASI SESI ──
    // Token sekarang diterbitkan NestJS (bukan Supabase), jadi tanda tangan +
    // masa berlaku bisa diverifikasi 100% lokal (JWT_SECRET bersama) tanpa
    // memanggil layanan eksternal apa pun.
    const res = NextResponse.next({ request })
    clearLegacyBypassCookie(request, res)

    /**
     * Verifikasi dijalankan tanpa syarat. Sebelumnya blok ini dibungkus
     * `if (!hasAuthHeader)`, jadi permintaan yang membawa header
     * `Authorization: Bearer <apa saja>` melewatinya sepenuhnya — dan blok RBAC
     * di bawah punya jalur cadangan yang men-decode payload JWT tanpa memeriksa
     * tanda tangannya, sehingga `authId` bisa ditentukan sendiri oleh pemanggil.
     * Token tanpa tanda tangan sah tidak boleh membuka halaman mana pun.
     */
    const claims = await verifyAppToken(accessToken)
    if (!claims) {
        if (path.startsWith('/api/')) {
            const out = NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
            clearDeadSessionCookies(request, out)
            return out
        }
        url.pathname = '/login'
        url.search = 'error=session-expired'
        const out = NextResponse.redirect(url)
        clearDeadSessionCookies(request, out)
        return out
    }

    // ── ROLE-BASED ACCESS CONTROL ──
    // Sumber kebenaran adalah tabel role_pages di database, BUKAN daftar hardcoded.
    // Konsekuensinya role ganda otomatis berlaku sebagai union: pegawai TU yang juga
    // ORANG_TUA mendapat gabungan halaman keduanya, bukan irisan atau salah satunya.
    //
    // Route /api/* dilewati di sini — tiap route API memverifikasi sendiri lewat
    // lib/api-auth.ts getApiUser(), dan pageId 'api' tidak punya padanan di role_pages.
    if (!path.startsWith('/api/')) {
        const pageId = path.split('/').filter(Boolean)[0] || 'dashboard'

        // Halaman CBT dirender oleh aplikasi terpisah lewat SSO.
        const isCbt = pageId.startsWith('cbt-')

        if (!isCbt && !ALWAYS_ALLOWED.has(pageId)) {
            const enableJwtPagePermissions = process.env.ENABLE_JWT_PAGE_PERMISSIONS !== 'false'

            // `claims` sudah terverifikasi di atas. Jalur cadangan lama yang
            // men-decode payload dengan `atob` tanpa memeriksa tanda tangan
            // dihapus: itulah yang membuat authId bisa dikarang pemanggil.
            const authId = claims.authId || ''

            if (!authId) {
                url.pathname = '/login'
                return NextResponse.redirect(url)
            }

            let allowed = false

            // PENEGAKAN EDGE: Jika ENABLE_JWT_PAGE_PERMISSIONS aktif & token membawa pageIds
            // Evaluasi dilakukan 100% lokal di Edge tanpa panggil VPS (0ms network overhead)
            if (enableJwtPagePermissions && Array.isArray(claims?.pageIds)) {
                const userRoles = (claims?.role || '').split(/[,|]/).map((r: string) => r.trim().toUpperCase())
                const extras = userRoles.flatMap((r: string) => ROLE_SCOPED_EXTRAS[r] || [])
                const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('ADMINISTRATOR')
                allowed = claims.pageIds.includes(pageId) || extras.includes(pageId) || (isAdmin && pageId === 'audit-log')
            } else {
                // FALLBACK: panggil getAccessForAuthId jika token lama / feature flag disabled
                const access = await getAccessForAuthId(authId)
                const isAdmin = access ? access.roles.some(r => ['ADMIN', 'ADMINISTRATOR'].includes(r.toUpperCase())) : false
                const extras = access
                    ? access.roles.flatMap(r => ROLE_SCOPED_EXTRAS[r.toUpperCase()] || [])
                    : []
                allowed = !!access && (access.pages.has(pageId) || extras.includes(pageId) || (isAdmin && pageId === 'audit-log'))
            }

            if (!allowed) {
                url.pathname = '/dashboard'
                url.search = ''
                return NextResponse.redirect(url)
            }
        }
    }

    return res
}

// Config to match paths
export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * - api (API route handlers handle their own auth via proxy/extractRequestToken)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public assets
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
}
