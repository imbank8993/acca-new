import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Dibekukan sekali per build (bukan per request), lalu dipakai
  // components/AppUpdateChecker.tsx untuk mendeteksi PWA iOS yang macet di
  // build lama — WKWebView standalone tidak refetch sendiri seperti tab
  // Safari biasa. VERCEL_GIT_COMMIT_SHA otomatis tersedia saat build di
  // Vercel; Date.now() jadi fallback untuk build lokal/non-Vercel.
  transpilePackages: ["@acca/shared", "react-icons"],
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now()),
  },
  turbopack: {
    root: path.resolve(__dirname, "../.."),
    // Turbopack MENGABAIKAN blok `webpack` di bawah, jadi workaround react-pdf
    // harus ditulis ulang di sini. Padanan `config.resolve.alias.canvas = false`
    // adalah alias ke modul kosong: Turbopack tidak menerima nilai `false`.
    resolveAlias: {
      canvas: './empty-module.ts',
    },
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  async redirects() {
    return [
      // Legacy CBT pages now enter the external application through authenticated SSO.
      ...['cbt-dashboard', 'cbt-bank-soal', 'cbt-ujian', 'cbt-nilai', 'cbt-pantau'].map((page) => ({
        source: `/${page}`,
        destination: '/api/sso/cbt',
        permanent: false,
      })),
      {
        source: '/personal-documents',
        destination: '/dokumen?tab=pribadi',
        permanent: true,
      },
      {
        source: '/unggah-dokumen',
        destination: '/dokumen?tab=sekolah',
        permanent: true,
      },
      {
        source: '/upload-dokumen',
        destination: '/dokumen?tab=sekolah',
        permanent: true,
      },
    ];
  },

  // Rewrites to NestJS REST API (Port 3007)
  async rewrites() {
    const nestUrl = process.env.NEXT_PUBLIC_NEST_API_URL || 'http://localhost:3007/api';
    return [
      {
        source: '/api/nest/:path*',
        destination: `${nestUrl}/:path*`,
      },
      {
        source: '/lckh-verification/:code',
        destination: '/lckh/verification/:code',
      },
    ];
  },

  // Optimization settings
  experimental: {
    optimizePackageImports: ['lucide-react', 'react-icons', '@supabase/supabase-js'],
  },
  serverExternalPackages: ['pdfjs-dist', '@whiskeysockets/baileys', 'sharp'],

  // Fix: react-pdf / pdfjs-dist uses `this` at module-scope which breaks in webpack-bundled ESM with eval source maps.
  // Hanya dipakai oleh `next build --webpack` dan `next dev --webpack`; dev
  // biasa sekarang lewat Turbopack (lihat blok `turbopack` di atas).
  webpack: (config, { dev, isServer }) => {
    // Next.js uses eval-source-map by default in dev mode. pdfjs-dist 4+ crashes when evaluated in an eval wrapper.
    // `source-map` penuh membuat rebuild dev sangat lambat dan menggelembungkan
    // .next/cache sampai ukuran GB. `cheap-module-source-map` sama-sama bukan
    // `eval` (jadi pdfjs tetap aman) tapi jauh lebih murah.
    if (dev && !isServer) {
      config.devtool = 'cheap-module-source-map';
    }
    // react-pdf requires this to prevent canvas missing errors in browser
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
      canvas: false,
    };
    
    // Stop Webpack from enforcing strict ESM on pdf.mjs so that `this` is not undefined
    config.module.rules.push({
      test: /pdf\.mjs$/,
      type: 'javascript/auto',
    });

    return config;
  },

  // Headers for iframe and CORS
  async headers() {
    return [
      {
        // Auth endpoints: never cache, always vary by cookie
        source: '/api/auth/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          { key: 'Vary', value: 'Cookie, Authorization' },
        ]
      },
      {
        // All other API routes: no-store + vary by cookie to prevent cross-user caching
        source: '/api/:path*',
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          // IMPORTANT: Do NOT use wildcard (*) with credentials — specify exact origin in nginx/env if needed
          { key: "Access-Control-Allow-Origin", value: process.env.NEXT_PUBLIC_APP_URL || "https://icgowa.sch.id" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Vary', value: 'Cookie, Authorization' },
        ]
      },
      {
        // HTML pages: prevent intermediate proxies from caching dynamic HTML and stale chunk references
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://icgowa.sch.id/acca-v2/ http://localhost:3000 http://localhost:3001 http://localhost:3006 http://localhost:3007 http://localhost:3008 https://*.icgowa.sch.id" },
          { key: 'Vary', value: 'Cookie' },
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ]
      },
      {
        // Next.js hashed static assets: immutable cache (overrides /:path* for _next/static)
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ]
      }
    ]
  },
};

export default nextConfig;
