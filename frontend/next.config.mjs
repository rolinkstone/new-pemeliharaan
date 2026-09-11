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

const nextConfig = {
  turbopack: {
    root: projectRoot,
  },
  async redirects() {
    return routeAliases.map((r) => ({ ...r, permanent: true }));
  },
};

export default nextConfig;
