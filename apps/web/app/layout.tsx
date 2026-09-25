import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "bootstrap-icons/font/bootstrap-icons.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "./globals.css";
import { ModalBlurProvider } from "@/components/ModalBlurProvider";
import { AppUpdateChecker } from "@/components/AppUpdateChecker";
import { AlertProvider } from "@/components/ui/AlertProvider";

export const metadata: Metadata = {
  title: "ACCA - Academic Center & Administration",
  description: "MAN Insan Cendekia Gowa - Academic Center & Administration Application",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/logo-icon.png", type: "image/png" }
    ],
    shortcut: "/icon.svg",
    apple: "/logo-icon.png",
  },
  manifest: "/manifest.json",
};

// Single source of truth for the viewport so Next.js doesn't also inject a
// conflicting default <meta name="viewport">. Note: iOS Safari ignores
// maximumScale/userScalable for focus-zoom — the actual fix for the "auto-zoom
// when tapping an input" is keeping form controls >= 16px, and that is applied
// ONLY on iOS/iPadOS WebKit via `@supports (-webkit-touch-callout: none)`
// (app/globals.css + token --mdl-fs-control di components/modal.css).
// Desktop dan Android sengaja tidak ikut: Android tidak pernah auto-zoom, dan
// penjagaan berbasis `pointer: coarse` dulu ikut mengenai laptop layar sentuh
// Windows serta iPad landscape yang memakai tata letak desktop.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Disamakan dengan bilah nav bawah & header mobile (keduanya sewarna:
            #ffffff / #000000) supaya chrome browser — bilah status di atas dan
            bilah alamat di bawah — menyatu dengan bilah yang bersebelahan
            dengannya, bukan dengan kanvas halaman. */}
        <meta name="color-scheme" content="light dark" id="color-scheme-meta" />
        <meta name="theme-color" content="#ffffff" id="theme-color-meta" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet" />
      </head>
      <body>
        {/* Terapkan preferensi dark mode & theme-color sebelum paint agar persist saat refresh tanpa flash */}
        <Script id="dark-mode-init" strategy="beforeInteractive">
          {`try{var d=localStorage.getItem('darkMode')==='1';if(d){document.documentElement.classList.add('dark');}var c=d?'#000000':'#ffffff';document.documentElement.style.backgroundColor=c;document.documentElement.style.colorScheme=d?'dark':'light';var tc=document.getElementById('theme-color-meta');if(tc){tc.content=c;tc.setAttribute('content',c);}var cs=document.getElementById('color-scheme-meta');if(cs){cs.content=d?'dark':'light';cs.setAttribute('content',d?'dark':'light');}}catch(e){}`}
        </Script>
        {/* Redirect recovery tokens to /update-password (hash fragments are invisible to server) */}
        <Script id="recovery-redirect" strategy="beforeInteractive">
          {`try{var h=window.location.hash;if(h&&h.indexOf('type=recovery')!==-1&&window.location.pathname!=='/update-password'){window.location.replace('/update-password'+h);}}catch(e){}`}
        </Script>
        <div className="acca-ambient-bg" aria-hidden="true" />
        <AppUpdateChecker />
        <ModalBlurProvider>
          <AlertProvider>
            {children}
          </AlertProvider>
        </ModalBlurProvider>
      </body>
    </html>
  );
}