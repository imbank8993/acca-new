import type { ReactNode } from 'react';

/**
 * Mulai mengunduh artwork panel kiri SEDINI mungkin.
 *
 * Halaman login memakai useSearchParams di dalam Suspense, jadi HTML awalnya
 * hanya berisi fallback spinner; CSS panel (dan url artwork di dalamnya) baru
 * ada setelah bundel JavaScript selesai dimuat dan dijalankan. Tanpa preload,
 * unduhan artwork baru dimulai SETELAH itu, dan selama menunggu yang terlihat
 * adalah warna dasar panel.
 *
 * Skrip sebaris ini berjalan saat HTML diurai (sebelum bundel JS), memilih
 * berkas sesuai tema (localStorage 'darkMode', sama dengan skrip
 * dark-mode-init di app/layout.tsx) supaya hanya SATU gambar yang diunduh.
 *
 * URL wajib sama persis dengan yang ada di CSS app/login/page.tsx (termasuk
 * ?v=), kalau tidak browser mengunduhnya dua kali.
 */
const SKRIP_PRELOAD = `try{var d=document.documentElement.classList.contains('dark')||localStorage.getItem('darkMode')==='1';var l=document.createElement('link');l.rel='preload';l.as='image';l.href=d?'/login-kiri.webp?v=5':'/login-kiri-light.webp?v=2';l.setAttribute('fetchpriority','high');document.head.appendChild(l);}catch(e){}`;

export default function LoginLayout({ children }: { children: ReactNode }) {
    return (
        <>
            <script dangerouslySetInnerHTML={{ __html: SKRIP_PRELOAD }} />
            {children}
        </>
    );
}
