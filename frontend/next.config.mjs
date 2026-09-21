/** @type {import('next').NextConfig} */
import path from 'path';
import { fileURLToPath } from 'url';

// Root Turbopack dikunci ke folder frontend. Tanpa ini Next.js mendeteksi
// lockfile liar di folder induk (g:\reactjs) dan menganggap folder itu sebagai
// workspace root, sehingga proses dev kehabisan memori (heap out of memory).
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

// Alias URL umum -> route kanonik yang sebenarnya ada.
// Mencegah pengguna terjebak di halaman 404 karena penamaan
// yang "terlihat logis" tapi tidak terdaftar (mis. /laporan-rusak).
const routeAliases = [
  // Laporan Rusak
  { source: '/laporan-rusak', destination: '/laporanrusak' },
  { source: '/laporan_rusak', destination: '/laporanrusak' },
  { source: '/laporan', destination: '/laporanrusak' },
  { source: '/laporan/rusak', destination: '/laporanrusak' },
  { source: '/laporan/kerusakan', destination: '/laporanrusak' },

  // Aset Ruangan
  { source: '/aset/ruangan', destination: '/asetruangan' },
  { source: '/aset-ruangan', destination: '/asetruangan' },
  { source: '/aset_ruangan', destination: '/asetruangan' },

  // PIC Ruangan
  { source: '/pic-ruangan', destination: '/picruangan' },
  { source: '/pic_ruangan', destination: '/picruangan' },
  { source: '/pic/ruangan', destination: '/picruangan' },

  // Pencatatan (induk -> halaman pertama yang tersedia)
  { source: '/pencatatan', destination: '/pencatatan/diterima' },
];

// ========== SECURITY HEADERS (CSP + hardening) ==========
// Tujuan utama: kalaupun suatu saat ada celah XSS, token TIDAK BISA dikirim keluar.
//  - connect-src & img-src hanya host di daftar putih -> permintaan balik ke host
//    penyerang (cara paling umum mencuri token) diblokir browser.
//  - script-src hanya 'self' + cdnjs (dipakai QR di jendela cetak).
//  - object-src 'none', base-uri 'self', frame-ancestors 'none' (anti clickjacking),
//    form-action dibatasi -> data tidak bisa "dioper" lewat form/embed.
//
// Catatan: script-src MASIH memuat 'unsafe-inline' karena template cetak
// (jendela print mewarisi CSP halaman induk) memakai atribut inline seperti
// `onerror`. Bila cetak nanti direfaktor tanpa handler inline, buang
// 'unsafe-inline' supaya skrip hasil injeksi tidak bisa dieksekusi sama sekali.
const isDevServer = process.env.NODE_ENV !== 'production';

const originOf = (url, fallback = '') => {
  try {
    return new URL(url).origin;
  } catch {
    return fallback;
  }
};

const API_ORIGIN = originOf(process.env.NEXT_PUBLIC_API_URL, 'https://data-tabela.bbpompky.id');
const KEYCLOAK_ORIGIN = originOf(process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER, 'https://auth.bbpompky.id');

// Host yang boleh diakses untuk API/gambar (foto kerusakan, QR, file TTD).
const DATA_ORIGINS = [
  ...new Set([
    API_ORIGIN,
    'https://data-tabela.bbpompky.id',
    'https://api-talawang.bbpompky.id',
    ...(isDevServer ? ['http://localhost:5002', 'http://localhost:5000'] : []),
  ]),
];

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com${isDevServer ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${DATA_ORIGINS.join(' ')}`,
  `connect-src 'self' ${KEYCLOAK_ORIGIN} ${DATA_ORIGINS.join(' ')}${isDevServer ? ' ws: wss:' : ''}`,
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  `form-action 'self' ${KEYCLOAK_ORIGIN}`,
  "manifest-src 'self'",
  ...(isDevServer ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  // HSTS sengaja TANPA `includeSubDomains`: header ini berlaku untuk domain
  // bbpompky.id yang dipakai bersama aplikasi lain, jadi jangan sampai memaksa
  // HTTPS untuk subdomain milik aplikasi lain yang mungkin belum https.
  ...(isDevServer ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]),
];

const nextConfig = {
  turbopack: {
    root: projectRoot,
  },
  async redirects() {
    return routeAliases.map((r) => ({ ...r, permanent: true }));
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
