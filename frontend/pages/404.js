// pages/404.js
import Head from 'next/head';
import Link from 'next/link';
import {
  FaShieldAlt, FaHome, FaClipboardList, FaBoxes,
  FaDoorOpen, FaUserTie, FaWarehouse, FaSignInAlt,
  FaArrowLeft, FaCompass
} from 'react-icons/fa';

const quickLinks = [
  { href: '/', label: 'Beranda', icon: FaHome },
  { href: '/laporanrusak', label: 'Laporan Rusak', icon: FaClipboardList },
  { href: '/aset', label: 'Master Aset', icon: FaBoxes },
  { href: '/ruangan', label: 'Ruangan', icon: FaDoorOpen },
  { href: '/asetruangan', label: 'Aset Ruangan', icon: FaDoorOpen },
  { href: '/picruangan', label: 'PIC Ruangan', icon: FaUserTie },
  { href: '/persediaan', label: 'Persediaan', icon: FaWarehouse },
  { href: '/pencatatan/diterima', label: 'Pencatatan', icon: FaSignInAlt },
];

export default function Custom404() {
  return (
    <>
      <Head>
        <title>Halaman Tidak Ditemukan | BMN System</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800">
        {/* Decorative glow */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="absolute -bottom-40 -left-32 w-[520px] h-[520px] rounded-full bg-indigo-600/15 blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-emerald-500/5 blur-[180px]" />

        <div className="relative w-full max-w-2xl">
          <div className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* Decorative top accent */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400/70 to-transparent" />

            <div className="p-8 md:p-12 text-center">
              {/* Brand */}
              <div className="flex items-center justify-center gap-3 mb-8">
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 flex items-center justify-center">
                    <FaShieldAlt className="text-white text-xl" />
                  </div>
                  <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900" />
                </div>
                <div className="text-left">
                  <h1 className="text-lg font-bold text-white tracking-tight leading-tight">BMN System</h1>
                  <p className="text-[10px] text-blue-300/70 font-medium tracking-wider uppercase">Sistem Pemeliharaan Aset</p>
                </div>
              </div>

              {/* 404 Graphic */}
              <div className="relative mb-6 select-none">
                <div className="text-[110px] md:text-[150px] font-extrabold leading-none tracking-tight bg-gradient-to-br from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(99,102,241,0.35)]">
                  404
                </div>
                <div className="absolute inset-0 flex items-end justify-center pb-2">
                  <FaCompass className="w-10 h-10 text-white/20 animate-spin" style={{ animationDuration: '8s' }} />
                </div>
              </div>

              <h2 className="text-xl md:text-2xl font-bold text-white mb-3">
                Halaman Tidak Ditemukan
              </h2>
              <p className="text-sm md:text-base text-slate-300/80 max-w-md mx-auto mb-8">
                Maaf, alamat halaman yang Anda tuju tidak tersedia atau telah dipindahkan.
                Silakan periksa kembali alamatnya, atau gunakan salah satu menu di bawah ini.
              </p>

              {/* Quick links */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                {quickLinks.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="group flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-slate-200 hover:bg-white/10 hover:border-blue-400/40 hover:text-white transition-all duration-200"
                  >
                    <Icon className="w-5 h-5 text-blue-300/80 group-hover:text-blue-300 transition-colors" />
                    <span className="text-xs font-medium text-center leading-tight">{label}</span>
                  </Link>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:brightness-110 transition-all"
                >
                  <FaHome className="w-4 h-4" />
                  Kembali ke Beranda
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all"
                >
                  <FaArrowLeft className="w-4 h-4" />
                  Halaman Login
                </Link>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-slate-400/60 mt-6">
            © 2026 Balai Besar POM Palangka Raya · BMN System
          </p>
        </div>
      </div>
    </>
  );
}
