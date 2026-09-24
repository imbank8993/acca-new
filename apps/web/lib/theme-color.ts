'use client'

/**
 * Warna chrome browser (bilah status baterai/jaringan di HP) disamakan dengan
 * lapisan yang sedang menutupi halaman.
 *
 * Masalah yang diselesaikan: saat modal terbuka, halaman di belakangnya
 * tertutup lapisan gelap semi-transparan, tapi bilah status di atas layar tetap
 * putih — jadi ada pita putih menyala menempel di atas layar yang sudah redup.
 *
 * Pendekatannya SENGAJA tidak menghafal daftar warna per modal (daftar seperti
 * itu selalu ketinggalan begitu ada modal baru). Yang dilakukan: membaca warna
 * lapisan teratas yang benar-benar sedang tampil langsung dari DOM, lalu
 * mencampurnya di atas warna kanvas halaman — persis perhitungan yang dilakukan
 * browser saat menumpuk warna semi-transparan. Modal apa pun, warna apa pun,
 * mode terang atau gelap, hasilnya ikut sendiri.
 */

type Rgba = { r: number; g: number; b: number; a: number }

function parseColor(input: string): Rgba | null {
    const s = (input || '').trim()
    if (!s || s === 'transparent') return null
    const m = s.match(/^rgba?\(([^)]+)\)$/i)
    if (m) {
        const p = m[1].split(/[,/]+/).map(v => v.trim())
        if (p.length < 3) return null
        const r = parseFloat(p[0]), g = parseFloat(p[1]), b = parseFloat(p[2])
        const a = p.length > 3 ? parseFloat(p[3]) : 1
        if ([r, g, b, a].some(Number.isNaN)) return null
        return { r, g, b, a }
    }
    const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
    if (hex) {
        const h = hex[1]
        const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
        return {
            r: parseInt(full.slice(0, 2), 16),
            g: parseInt(full.slice(2, 4), 16),
            b: parseInt(full.slice(4, 6), 16),
            a: 1,
        }
    }
    return null
}

/** Tumpuk `top` (boleh semi-transparan) di atas `base` yang sudah opaque. */
function blend(top: Rgba, base: Rgba): Rgba {
    const a = Math.min(Math.max(top.a, 0), 1)
    return {
        r: top.r * a + base.r * (1 - a),
        g: top.g * a + base.g * (1 - a),
        b: top.b * a + base.b * (1 - a),
        a: 1,
    }
}

function toHex({ r, g, b }: Rgba): string {
    const c = (v: number) => Math.round(Math.min(Math.max(v, 0), 255)).toString(16).padStart(2, '0')
    return `#${c(r)}${c(g)}${c(b)}`
}

/** Warna dasar yang harus ditiru chrome browser saat tak ada lapisan apa pun. */
function baseColor(): Rgba {
    const dark = document.documentElement.classList.contains('dark')

    // Yang ditiru adalah BILAH NAV BAWAH, bukan kanvas halaman.
    //
    // Chrome browser berdempetan dengan bilah, bukan dengan kanvas: bilah
    // status menempel di atas header, dan bilah alamat (kalau penggunanya
    // memindahkannya ke bawah) menempel di bawah bilah nav. Kanvas halaman
    // tidak pernah menyentuh keduanya — ia selalu terhalang salah satu bilah.
    // Memakai warna kanvas membuat ada pita berbeda warna menempel persis di
    // ujung layar, padahal yang bersebelahan dengannya justru bilah.
    //
    // Header dan bilah nav sengaja sewarna (`--bnav-face` = `--header-bg`,
    // lihat catatan di components/bottom-nav.css), jadi satu nilai ini sudah
    // benar untuk kedua ujung layar sekaligus.
    //
    // `--bnav-face` hanya terdefinisi di dalam @media mobile, jadi di desktop
    // nilainya kosong dan urutan di bawah jatuh sendiri ke kanvas — di sana
    // memang tidak ada chrome browser yang perlu disamakan.
    // SIDEBAR MOBILE TERBUKA menang atas segalanya. Saat terbuka, panel itulah
    // yang memenuhi layar dari atas sampai bawah, sementara header dan bilah nav
    // justru disembunyikan (`.sidebar-mobile-open .header` / `.bnav` -> opacity
    // 0). Menyamakan chrome dengan bilah yang sedang tidak terlihat jelas salah.
    //
    // Dibaca dari kelas penanda di .dashboard-layout, bukan dari tirainya.
    // Tirai `.sidebar-overlay` TIDAK bisa dijadikan patokan: ia selalu ada di
    // DOM dan saat tertutup hanya `opacity: 0` — sedangkan modul ini sengaja
    // mengabaikan opacity (lihat catatan di topOverlayColor), jadi tirai itu
    // akan terbaca "selalu menutupi layar".
    const sidebarTerbuka = document.querySelector('.dashboard-layout.sidebar-mobile-open')
    const sidebar = sidebarTerbuka ? document.querySelector('.sidebar') : null
    const sidebarBg = sidebar ? getComputedStyle(sidebar).backgroundColor : ''

    const nav = document.querySelector('.bnav')
    const navFace = nav ? getComputedStyle(nav).getPropertyValue('--bnav-face') : ''

    // .acca-ambient-bg adalah bidang kanvas mobile yang sesungguhnya; di dark
    // mode ia bergradien, jadi background-color-nya (warna dasar gradien) yang
    // dipakai. Dipakai sebagai cadangan untuk halaman TANPA bilah nav — mis.
    // login, form publik, halaman info-link.
    const ambient = document.querySelector('.acca-ambient-bg')
    const candidates = [
        sidebarBg,
        navFace,
        ambient ? getComputedStyle(ambient).backgroundColor : '',
        getComputedStyle(document.body).backgroundColor,
    ]
    for (const c of candidates) {
        const parsed = parseColor(c)
        if (parsed && parsed.a > 0.95) return parsed
    }
    // Cadangan terakhir disamakan dengan `--bnav-face`, bukan warna kanvas.
    return dark ? { r: 0, g: 0, b: 0, a: 1 } : { r: 255, g: 255, b: 255, a: 1 }
}

/**
 * Lapisan teratas yang sedang menutupi layar, atau null kalau tidak ada.
 *
 * Disapu secara generik (elemen fixed berukuran hampir selayar dengan latar
 * yang kelihatan), bukan dari daftar nama kelas — supaya modal/sheet baru ikut
 * terdeteksi tanpa menyentuh berkas ini lagi. Kandidat diambil dari anak
 * langsung <body> karena semua overlay di aplikasi ini di-portal ke sana.
 */
function topOverlayColor(): Rgba | null {
    const vw = window.innerWidth
    const vh = window.innerHeight
    let best: { z: number; color: Rgba } | null = null

    const consider = (el: Element) => {
        const cs = getComputedStyle(el)
        if (cs.position !== 'fixed') return
        if (cs.visibility === 'hidden' || cs.display === 'none') return

        // KANVAS, bukan overlay. `.acca-ambient-bg` juga `position: fixed`
        // selayar penuh dengan latar pekat, jadi sapuan generik di bawah ikut
        // menganggapnya lapisan penutup — dan karena ia SELALU ada, hasil
        // `baseColor()` selalu tertimpa warna kanvas. Itu membuat chrome
        // browser mustahil disamakan dengan bilah nav.
        //
        // Dibedakan lewat sifat, bukan nama kelas (lihat catatan di kepala
        // fungsi ini): lapisan hias duduk di belakang segalanya DAN tidak
        // menangkap sentuhan. Tirai sungguhan selalu melanggar keduanya —
        // ia bertumpuk di atas dan memang harus menangkap ketukan di luar
        // modal. Syaratnya sengaja DUA-DUANYA, supaya tirai yang kebetulan
        // lupa diberi z-index tidak ikut tersaring.
        const zRaw = parseInt(cs.zIndex, 10)
        if ((Number.isNaN(zRaw) || zRaw <= 0) && cs.pointerEvents === 'none') return

        const rect = el.getBoundingClientRect()
        // Harus benar-benar menyelimuti layar — bukan tombol melayang / toast.
        if (rect.width < vw * 0.9 || rect.height < vh * 0.9) return

        const color = parseColor(cs.backgroundColor)
        if (!color || color.a <= 0.01) return

        const z = parseInt(cs.zIndex, 10)
        const zi = Number.isNaN(z) ? 0 : z

        // `opacity` SENGAJA tidak ikut dihitung. Overlay di aplikasi ini masuk
        // dengan animasi fade (mdlFadeIn / bnavFadeIn) yang dimulai dari
        // opacity 0, sementara warna ini dibaca satu frame setelah modal
        // menempel — persis saat animasinya masih di dekat nol. Mengalikannya
        // membuat overlay terbaca "tidak ada" dan bilah status tetap putih
        // sepanjang modal terbuka. Yang dipakai warna TUJUAN-nya; overlay yang
        // benar-benar tersembunyi memakai display/visibility, bukan opacity,
        // dan itu sudah disaring di atas.
        if (!best || zi >= best.z) best = { z: zi, color }
    }

    for (const el of Array.from(document.body.children)) {
        consider(el)
        // SweetAlert2 membungkus latarnya satu tingkat di dalam kontainer.
        if (el.classList.contains('swal2-container')) {
            for (const child of Array.from(el.children)) consider(child)
        }
    }
    return best ? (best as { z: number; color: Rgba }).color : null
}

/**
 * Hitung ulang dan pasang <meta name="theme-color">.
 * Aman dipanggil berkali-kali; tidak melakukan apa-apa di server.
 */
export function applyThemeColor(): void {
    if (typeof document === 'undefined') return
    const meta = document.getElementById('theme-color-meta') as HTMLMetaElement | null
    if (!meta) return

    const base = baseColor()
    const overlay = topOverlayColor()
    const next = toHex(overlay ? blend(overlay, base) : base)
    if (meta.content === next) return

    meta.content = next

    // Node-nya DIPASANG ULANG, bukan cuma diubah `content`-nya.
    //
    // Sebagian browser — paling kentara Chrome di Android — mengevaluasi
    // `theme-color` sekali saat dokumen dimuat dan tidak memperhatikan
    // perubahan atribut pada node yang sudah terpasang. Gejalanya: menekan
    // tombol mode gelap mengubah seluruh halaman seketika, tapi bilah URL
    // tetap warna lama sampai halaman dimuat ulang.
    //
    // Melepas lalu memasang kembali node-nya membuat browser melihatnya
    // sebagai meta baru dan menghitung ulang warna chrome-nya. Urutannya harus
    // begitu — `content` disetel DULU sebelum dipasang ulang, supaya yang
    // terbaca saat pemasangan sudah nilai barunya.
    //
    // Aman diulang: `applyThemeColor` sudah keluar lebih awal kalau warnanya
    // tidak berubah, jadi node ini tidak dicabut-pasang tiap frame.
    const parent = meta.parentNode
    if (parent) {
        parent.removeChild(meta)
        parent.appendChild(meta)
    }
}
