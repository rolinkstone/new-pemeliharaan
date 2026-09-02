import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '../components/DashboardLayout';
import {
  FaClipboardList, FaBoxes, FaDoorOpen, FaUserTie,
  FaExclamationTriangle, FaCheckCircle, FaClock, FaCogs,
  FaArrowRight, FaChartBar,
  FaShieldAlt, FaSun, FaMoon
} from 'react-icons/fa';

const roleMenus = {
  admin: [
    { href: '/laporanrusak', label: 'Laporan Rusak', icon: FaClipboardList, desc: 'Kelola laporan kerusakan', color: 'from-rose-500 to-pink-500' },
    { href: '/aset', label: 'Master Aset', icon: FaBoxes, desc: 'Data seluruh aset BMN', color: 'from-amber-500 to-orange-500' },
    { href: '/asetruangan', label: 'Aset per Ruangan', icon: FaDoorOpen, desc: 'Lokasi aset di setiap ruangan', color: 'from-violet-500 to-purple-500' },
    { href: '/picruangan', label: 'PIC Ruangan', icon: FaUserTie, desc: 'Penanggung jawab ruangan', color: 'from-emerald-500 to-teal-500' },
  ],
  pic_ruangan: [
    { href: '/laporanrusak', label: 'Laporan Rusak', icon: FaClipboardList, desc: 'Verifikasi laporan kerusakan', color: 'from-rose-500 to-pink-500' },
    { href: '/asetruangan', label: 'Aset Ruangan Saya', icon: FaDoorOpen, desc: 'Aset di ruangan tanggung jawab', color: 'from-violet-500 to-purple-500' },
  ],
  kabag_tu: [
    { href: '/laporanrusak', label: 'Laporan Masuk', icon: FaClipboardList, desc: 'Disposisi laporan ke PPK', color: 'from-rose-500 to-pink-500' },
  ],
  ppk: [
    { href: '/laporanrusak', label: 'Laporan Diteruskan', icon: FaClipboardList, desc: 'Verifikasi anggaran perbaikan', color: 'from-rose-500 to-pink-500' },
  ],
};

const statConfig = [
  { label: 'Laporan Aktif', icon: FaExclamationTriangle, gradient: 'from-amber-400 to-orange-500' },
  { label: 'Menunggu Verifikasi', icon: FaClock, gradient: 'from-blue-400 to-indigo-500' },
  { label: 'Dalam Perbaikan', icon: FaCogs, gradient: 'from-violet-400 to-purple-500' },
  { label: 'Selesai', icon: FaCheckCircle, gradient: 'from-emerald-400 to-teal-500' },
];

const greetings = [
  { text: 'Selamat Pagi', range: [0, 10] },
  { text: 'Selamat Siang', range: [10, 15] },
  { text: 'Selamat Sore', range: [15, 18] },
  { text: 'Selamat Malam', range: [18, 24] },
];

const getGreeting = () => {
  const h = new Date().getHours();
  return greetings.find(g => h >= g.range[0] && h < g.range[1]) || greetings[0];
};

const Home = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const loading = status === 'loading';
  const [stats, setStats] = useState(statConfig.map(s => ({ ...s, value: '—' })));
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    if (!loading && !session) router.push('/login');
  }, [session, loading, router]);

  useEffect(() => {
    setGreeting(getGreeting().text);
    const interval = setInterval(() => setGreeting(getGreeting().text), 60000);
    return () => clearInterval(interval);
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
            { ...statConfig[0], value: d.total || '0' },
            { ...statConfig[1], value: (d.diajukan + d.menunggu_katim + d.menunggu_ppk + d.menunggu_konfirmasi_kabag + d.menunggu_konfirmasi_user) || '0' },
            { ...statConfig[2], value: d.dalam_perbaikan || '0' },
            { ...statConfig[3], value: d.selesai || '0' },
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
  else menus = roleMenus.admin;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[80vh]">
          <div className="text-center animate-in">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-ping opacity-20"></div>
              <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                <FaShieldAlt className="w-7 h-7 text-white" />
              </div>
            </div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">Memuat dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!session) return null;

  return (
    <DashboardLayout>
      <div className="px-6 py-8 md:px-10 lg:px-14 max-w-7xl mx-auto space-y-8">
        {/* ===== GREETING ===== */}
        <div className="animate-in">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white">
                {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">{userName}</span>
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Selamat datang di Sistem Informasi Pemeliharaan Aset — BPOM.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {roles.slice(0, 3).map((r) => (
                  <span key={r} className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shadow-sm">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ===== STAT CARDS ===== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="animate-in" style={{ animationDelay: `${i * 0.08}s` }}>
                <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700/50 p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${s.gradient}`}></div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} shadow-md flex items-center justify-center`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-gray-800 dark:text-white">{s.value}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ===== QUICK MENU ===== */}
        <div className="animate-in-delay-1">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md flex items-center justify-center">
              <FaChartBar className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white">Menu Cepat</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500">Akses fitur utama</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {menus.map((m, i) => {
              const Icon = m.icon;
              return (
                <Link key={i} href={m.href}>
                  <div className="group relative rounded-2xl bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700/50 p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${m.color} shadow-md flex items-center justify-center transform group-hover:scale-110 transition-transform duration-200`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 dark:text-white text-sm">{m.label}</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{m.desc}</p>
                      </div>
                      <FaArrowRight className="shrink-0 w-4 h-4 text-gray-300 dark:text-gray-600 transition-all duration-200 group-hover:translate-x-1 group-hover:text-blue-500" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Home;