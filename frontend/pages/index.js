// pages/index.js — Dashboard Utama
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../components/DashboardLayout';
import {
  FaClipboardList, FaBoxes, FaDoorOpen, FaUserTie,
  FaExclamationTriangle, FaCheckCircle, FaClock, FaCogs,
  FaArrowRight, FaPlusCircle, FaSearch, FaChartBar
} from 'react-icons/fa';

const roleMenus = {
  admin: [
    { href: '/laporanrusak', label: 'Laporan Rusak', icon: FaClipboardList, desc: 'Kelola laporan kerusakan aset', color: 'from-blue-500 to-blue-600' },
    { href: '/aset', label: 'Master Aset', icon: FaBoxes, desc: 'Data seluruh aset', color: 'from-emerald-500 to-emerald-600' },
    { href: '/asetruangan', label: 'Aset per Ruangan', icon: FaDoorOpen, desc: 'Lokasi aset di setiap ruangan', color: 'from-violet-500 to-violet-600' },
    { href: '/picruangan', label: 'PIC Ruangan', icon: FaUserTie, desc: 'Penanggung jawab ruangan', color: 'from-amber-500 to-amber-600' },
  ],
  pic_ruangan: [
    { href: '/laporanrusak', label: 'Laporan Rusak', icon: FaClipboardList, desc: 'Verifikasi laporan kerusakan', color: 'from-blue-500 to-blue-600' },
    { href: '/asetruangan', label: 'Aset Ruangan Saya', icon: FaDoorOpen, desc: 'Aset di ruangan tanggung jawab', color: 'from-violet-500 to-violet-600' },
  ],
  kabag_tu: [
    { href: '/laporanrusak', label: 'Laporan Masuk', icon: FaClipboardList, desc: 'Disposisi laporan ke PPK', color: 'from-blue-500 to-blue-600' },
  ],
  ppk: [
    { href: '/laporanrusak', label: 'Laporan Diteruskan', icon: FaClipboardList, desc: 'Verifikasi anggaran perbaikan', color: 'from-blue-500 to-blue-600' },
  ],
};

const quickStats = [
  { label: 'Laporan Aktif', value: '—', icon: FaExclamationTriangle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  { label: 'Menunggu Verifikasi', value: '—', icon: FaClock, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { label: 'Dalam Perbaikan', value: '—', icon: FaCogs, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  { label: 'Selesai', value: '—', icon: FaCheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
];

const Home = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const loading = status === 'loading';
  const [greeting, setGreeting] = useState('');
  const [stats, setStats] = useState(quickStats);

  useEffect(() => {
    if (!loading && !session) router.push('/login');
  }, [session, loading, router]);

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 10) setGreeting('Selamat Pagi');
    else if (h < 15) setGreeting('Selamat Siang');
    else if (h < 18) setGreeting('Selamat Sore');
    else setGreeting('Selamat Malam');
  }, []);

  useEffect(() => {
    if (!session?.accessToken) return;
    const fetchStats = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const res = await fetch(`${baseUrl}/laporanrusak/statistics`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        });
        const json = await res.json();
        if (json.success) {
          const d = json.data;
          setStats([
            { ...quickStats[0], value: d.total || '0' },
            { ...quickStats[1], value: (d.menunggu_verifikasi_pic + d.menunggu_disposisi + d.menunggu_verifikasi_ppk) || '0' },
            { ...quickStats[2], value: d.dalam_perbaikan || '0' },
            { ...quickStats[3], value: d.selesai || '0' },
          ]);
        }
      } catch (e) {
        console.error('Gagal ambil statistik:', e);
      }
    };
    fetchStats();
  }, [session]);

  const roles = session?.user?.realm_access?.roles || session?.user?.roles || [];
  const userName = session?.user?.name || session?.user?.username || 'User';

  let menus = roleMenus.user || [];
  if (roles.includes('admin') || roles.includes('superadmin')) menus = roleMenus.admin;
  else if (roles.includes('pic_ruangan') || roles.includes('pic')) menus = roleMenus.pic_ruangan;
  else if (roles.includes('kabag_tu')) menus = roleMenus.kabag_tu;
  else if (roles.includes('ppk')) menus = roleMenus.ppk;
  else menus = roleMenus.admin; // fallback

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">Memuat dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!session) return null;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white p-6 md:p-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-white/5 rounded-full -mb-16" />
          <div className="relative">
            <h1 className="text-2xl md:text-4xl font-bold mb-2">{greeting}, {userName}!</h1>
            <p className="text-blue-100 text-sm md:text-base max-w-xl">
              Selamat datang di Sistem Informasi Pemeliharaan Aset — BPOM.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {roles.map((r) => (
                <span key={r} className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium backdrop-blur-sm">
                  {r}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div key={i} className={`${s.bg} rounded-xl p-5 border border-gray-200 dark:border-gray-700 transition-all hover:shadow-lg hover:-translate-y-0.5`}>
              <div className="flex items-center justify-between mb-3">
                <s.icon className={`w-6 h-6 ${s.color}`} />
                <span className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">{s.value}</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions + Recent */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <FaChartBar className="text-blue-500" /> Menu Cepat
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {menus.map((m, i) => (
                <Link key={i} href={m.href}>
                  <div className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer">
                    <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full bg-gradient-to-br ${m.color} opacity-10 transition-all group-hover:opacity-20`} />
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg bg-gradient-to-br ${m.color} text-white`}>
                        <m.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 dark:text-white">{m.label}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{m.desc}</p>
                      </div>
                      <FaArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 mt-2 transition-all group-hover:translate-x-1 group-hover:text-blue-500" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <FaClipboardList className="text-blue-500" /> Informasi
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Akun</p>
                <p className="font-medium text-gray-800 dark:text-white truncate">{userName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{session?.user?.email || '-'}</p>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Role</p>
                <div className="flex flex-wrap gap-1.5">
                  {roles.length > 0 ? roles.map((r) => (
                    <span key={r} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium">
                      {r}
                    </span>
                  )) : <span className="text-sm text-gray-400">Tidak ada role</span>}
                </div>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Akses Cepat</p>
                <div className="space-y-2">
                  <Link href="/laporanrusak" className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <FaSearch className="w-3 h-3" /> Lihat Laporan Rusak
                  </Link>
                  <Link href="/aset" className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                    <FaBoxes className="w-3 h-3" /> Data Aset
                  </Link>
                </div>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <p className="text-xs text-gray-400">
                  Session: {session.expires ? new Date(session.expires).toLocaleDateString() : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Home;