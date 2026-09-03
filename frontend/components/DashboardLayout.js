import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import { 
  FaBoxes, FaSignOutAlt, FaUserCircle,
  FaChevronLeft, FaChevronRight, FaBars, FaTimes,
  FaMoon, FaSun, FaCog, FaHome,
  FaMapMarkerAlt, FaDatabase, FaChartLine, FaDoorOpen,   
  FaUserTie, FaChevronDown, FaChevronUp, FaBox, FaBuilding, FaLocationArrow,
  FaShieldAlt, FaBell, FaSearch, FaWarehouse, FaCheckCircle, FaClock, FaInfoCircle,
  FaFlask, FaClipboardList, FaSignInAlt, FaShareSquare
} from 'react-icons/fa';
import { useSession, signOut } from 'next-auth/react';
import notificationsApi from '../utils/notificationsApi';
import pencatatanApi from './pencatatan/api/pencatatanApi';

const menuItems = [
  {
    label: 'Beranda',
    href: '/',
    icon: FaHome,
    color: 'from-blue-500 to-indigo-500',
    glowColor: 'rgba(59,130,246,0.3)',
  },
  {
    label: 'Aset',
    icon: FaBoxes,
    color: 'from-violet-500 to-purple-500',
    glowColor: 'rgba(139,92,246,0.3)',
    children: [
      { label: 'Barang BMN', href: '/aset', icon: FaBox, color: 'from-amber-500 to-orange-500' },
      { label: 'Ruangan', href: '/ruangan', icon: FaDoorOpen, color: 'from-emerald-500 to-teal-500' },
      { label: 'Aset Ruangan', href: '/asetruangan', icon: FaMapMarkerAlt, color: 'from-blue-500 to-cyan-500' },
      { label: 'PIC Ruangan', href: '/picruangan', icon: FaUserTie, color: 'from-purple-500 to-pink-500' },
    ],
  },
  {
    label: 'Laporan Rusak',
    href: '/laporanrusak',
    icon: FaChartLine,
    color: 'from-rose-500 to-pink-500',
    glowColor: 'rgba(244,63,94,0.3)',
  },
  {
    label: 'Persediaan',
    icon: FaWarehouse,
    color: 'from-teal-500 to-emerald-500',
    glowColor: 'rgba(20,184,166,0.3)',
    children: [
      { label: 'Persediaan ATK', href: '/persediaan', icon: FaBox, color: 'from-amber-500 to-orange-500' },
      { label: 'Persediaan Reagen', href: '/persediaan/reagen', icon: FaFlask, color: 'from-violet-500 to-purple-500' },
    ],
  },
  {
    label: 'Pencatatan',
    icon: FaClipboardList,
    color: 'from-sky-500 to-blue-600',
    glowColor: 'rgba(14,165,233,0.3)',
    roles: ['pic_gudang', 'admin', 'superadmin'],
    children: [
      { label: 'Diterima Belum Diinput', href: '/pencatatan/diterima', icon: FaSignInAlt, color: 'from-cyan-500 to-blue-500', counterKey: 'diterima' },
      { label: 'Diambil User Belum Diinput', href: '/pencatatan/diambil', icon: FaShareSquare, color: 'from-orange-500 to-amber-500', counterKey: 'diambil' },
    ],
  },
];

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({ Aset: true, Persediaan: true, Pencatatan: true });
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [pencatatanCounter, setPencatatanCounter] = useState({ diterima_belum: 0, diambil_belum: 0 });

  const userMenuRef = useRef(null);
  const notifRef = useRef(null);
  const loading = status === 'loading';

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications
  const fetchNotifs = async () => {
    try {
      const res = await notificationsApi.fetchNotifications(session);
      if (res.success) {
        setNotifications(res.data || []);
        setUnreadCount(res.unread || 0);
      }
    } catch (e) {
      // silent
    }
  };

  // Fetch counter pencatatan (badge sub-menu)
  const fetchPencatatanCounter = async () => {
    try {
      const res = await pencatatanApi.fetchCounter(session);
      if (res.success) setPencatatanCounter(res.data || {});
    } catch (e) {
      // silent
    }
  };

  const getPencatatanCount = (key) =>
    key === 'diterima' ? (pencatatanCounter.diterima_belum || 0) : (pencatatanCounter.diambil_belum || 0);

  useEffect(() => {
    if (session) {
      fetchNotifs();
      fetchPencatatanCounter();
      const interval = setInterval(() => { fetchNotifs(); fetchPencatatanCounter(); }, 30000); // refresh every 30s
      return () => clearInterval(interval);
    }
  }, [session]);

  useEffect(() => {
    if (!loading && !session) {
      router.push('/login');
    }
  }, [session, loading, router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut({ callbackUrl: '/login', redirect: false });
      const idToken = session?.idToken;
      const issuer = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER;
      const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'nextjs-local';
      const origin = window.location.origin;
      
      if (idToken && issuer) {
        const keycloakLogoutUrl = `${issuer}/protocol/openid-connect/logout?id_token_hint=${idToken}&post_logout_redirect_uri=${origin}/login&client_id=${clientId}`;
        window.location.href = keycloakLogoutUrl;
      } else {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/login';
    } finally {
      setIsLoggingOut(false);
    }
  };

  const getUserInfo = () => {
    const name = session?.user?.name || 
                 session?.user?.preferred_username || 
                 session?.user?.email?.split('@')[0] || 
                 'User';
    const email = session?.user?.email || 'user@example.com';
    const initials = name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    const role = session?.user?.role || 
                 (session?.user?.roles && 
                  (Array.isArray(session.user.roles) 
                    ? session.user.roles[0] 
                    : session.user.roles)) || 
                 'User';
    return { name, email, initials, role };
  };

  const { name, email, initials, role } = getUserInfo();

  const isActive = (href) => {
    return router.pathname === href;
  };

  const isChildActive = (children) => {
    if (!children) return false;
    return children.some(child => isActive(child.href));
  };

  const toggleMenu = (label) => {
    setExpandedMenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="text-center">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-ping opacity-20"></div>
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
              <FaShieldAlt className="w-8 h-8 text-white" />
            </div>
          </div>
          <p className="mt-6 text-white/80 font-medium tracking-wide">Memuat Dashboard...</p>
          <div className="mt-4 mx-auto w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  // Menu hanya tampil utk role tertentu: item tanpa field `roles` tampil utk semua user
  const userRoles = session?.user?.roles || (session?.user?.role ? [session.user.role] : []);
  const visibleMenuItems = menuItems.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.some((r) => userRoles.includes(r));
  });

  return (
    <div className={`flex h-screen ${isDarkMode ? 'dark' : ''}`}>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ===== SIDEBAR ===== */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 flex flex-col h-full
        transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'w-64' : 'w-[72px]'}
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800
        dark:from-gray-950 dark:via-gray-950 dark:to-gray-900
        text-white shadow-2xl shadow-black/20
      `}>
        {/* Sidebar - Decorative gradient line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>

        {/* Brand */}
        <div className="flex items-center h-16 px-4 border-b border-white/5">
          {isSidebarOpen ? (
            <Link href="/" className="flex items-center gap-3 group flex-1">
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20 flex items-center justify-center transform group-hover:scale-105 transition-transform">
                  <FaShieldAlt className="text-white text-lg" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900"></div>
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-white tracking-tight">BMN System</h1>
                <p className="text-[10px] text-blue-300/60 font-medium tracking-wider uppercase">Enterprise v2.0</p>
              </div>
            </Link>
          ) : (
            <div className="w-full flex justify-center">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20 flex items-center justify-center">
                <FaShieldAlt className="text-white text-lg" />
              </div>
            </div>
          )}

          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden lg:flex shrink-0 w-7 h-7 items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/80"
          >
            {isSidebarOpen ? <FaChevronLeft className="w-3 h-3" /> : <FaChevronRight className="w-3 h-3" />}
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60"
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        {/* User profile collapsed */}
        {!isSidebarOpen && (
          <div className="py-4 flex justify-center">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900"></span>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-5 overflow-y-auto sidebar-scroll">
          <div className="space-y-1">
            {isSidebarOpen && (
              <p className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
                Navigasi
              </p>
            )}

            {visibleMenuItems.map((item, idx) => {
              const Icon = item.icon;
              const hasChildren = item.children && item.children.length > 0;
              const active = hasChildren ? isChildActive(item.children) : isActive(item.href);
              // Auto-expand parent jika ada sub-menu yang aktif (agar menu tidak 'menghilang' saat navigasi)
              const expanded = expandedMenus[item.label] ?? (hasChildren && isChildActive(item.children));

              return (
                <div key={idx} className="mb-0.5">
                  {hasChildren ? (
                    /* Parent menu with children (collapsible) */
                    <button
                      onClick={() => isSidebarOpen && toggleMenu(item.label)}
                      className={`
                        group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                        text-sm font-medium transition-all duration-200
                        ${active 
                          ? 'text-white bg-gradient-to-r from-blue-600/20 to-indigo-600/20 shadow-sm shadow-blue-500/5' 
                          : 'text-white/50 hover:text-white hover:bg-white/5'
                        }
                        ${!isSidebarOpen && 'justify-center'}
                      `}
                      title={!isSidebarOpen ? item.label : undefined}
                    >
                      {active && isSidebarOpen && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-gradient-to-b from-blue-400 to-indigo-400 shadow-sm shadow-blue-500/30"></div>
                      )}
                      <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 ${
                        active 
                          ? 'bg-gradient-to-br ' + item.color + ' shadow-lg' 
                          : 'bg-white/5 group-hover:bg-white/10'
                      }`}>
                        <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-white/60 group-hover:text-white/90'}`} />
                      </div>
                      {isSidebarOpen && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          <div className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
                            <FaChevronDown className="w-2.5 h-2.5 text-white/30" />
                          </div>
                        </>
                      )}
                    </button>
                  ) : (
                    /* Single menu item */
                    <Link
                      href={item.href}
                      className={`
                        group relative flex items-center gap-3 px-3 py-2.5 rounded-xl
                        text-sm font-medium transition-all duration-200
                        ${active 
                          ? 'text-white bg-gradient-to-r from-blue-600/20 to-indigo-600/20 shadow-sm shadow-blue-500/5' 
                          : 'text-white/50 hover:text-white hover:bg-white/5'
                        }
                        ${!isSidebarOpen && 'justify-center'}
                      `}
                      title={!isSidebarOpen ? item.label : undefined}
                    >
                      {active && isSidebarOpen && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-gradient-to-b from-blue-400 to-indigo-400 shadow-sm shadow-blue-500/30"></div>
                      )}
                      <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 ${
                        active 
                          ? 'bg-gradient-to-br ' + item.color + ' shadow-lg' 
                          : 'bg-white/5 group-hover:bg-white/10'
                      }`}>
                        <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-white/60 group-hover:text-white/90'}`} />
                      </div>
                      {isSidebarOpen && (
                        <span className="flex-1">{item.label}</span>
                      )}
                    </Link>
                  )}

                  {/* Submenu items */}
                  {hasChildren && isSidebarOpen && expanded && (
                    <div className="ml-4 mt-0.5 pl-4 border-l border-white/10 space-y-0.5">
                      {item.children.map((child, cIdx) => {
                        const ChildIcon = child.icon;
                        const childActive = isActive(child.href);
                        const count = child.counterKey ? getPencatatanCount(child.counterKey) : 0;
                        return (
                          <Link
                            key={cIdx}
                            href={child.href}
                            className={`
                              group relative flex items-center gap-3 px-3 py-2 rounded-lg
                              text-sm transition-all duration-200
                              ${childActive
                                ? 'text-blue-300 bg-blue-500/10'
                                : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                              }
                            `}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                              childActive ? 'bg-blue-400 shadow-sm shadow-blue-400/50' : 'bg-white/20 group-hover:bg-white/40'
                            }`}></div>
                            <span className="flex-1">{child.label}</span>
                            {count > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white leading-none">
                                {count}
                              </span>
                            )}
                            {childActive && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-300">
                                Active
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* Submenu icons for collapsed sidebar */}
                  {hasChildren && !isSidebarOpen && expanded && (
                    <div className="space-y-0.5 mt-0.5">
                      {item.children.map((child, cIdx) => {
                        const ChildIcon = child.icon;
                        const childActive = isActive(child.href);
                        const count = child.counterKey ? getPencatatanCount(child.counterKey) : 0;
                        return (
                          <Link
                            key={cIdx}
                            href={child.href}
                            className={`
                              group relative flex items-center justify-center w-full px-3 py-2 rounded-lg
                              transition-all duration-200
                              ${childActive ? 'text-blue-300' : 'text-white/40 hover:text-white/80'}
                            `}
                            title={child.label}
                          >
                            <div className={`w-6 h-6 flex items-center justify-center rounded-md ${
                              childActive ? 'bg-blue-500/20' : ''
                            }`}>
                              <ChildIcon className="w-3.5 h-3.5" />
                            </div>
                            {count > 0 && (
                              <span className="absolute top-0 right-0 w-4 h-4 flex items-center justify-center rounded-full bg-orange-500 text-white text-[9px] font-bold leading-none">
                                {count}
                              </span>
                            )}
                            {childActive && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-400 rounded-r-full"></div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/5 p-3">
          {isSidebarOpen ? (
            <div className="space-y-2">
              {/* User card */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group" onClick={() => setShowUserMenu(!showUserMenu)}>
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    {initials}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900"></span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{name}</p>
                  <p className="text-[11px] text-white/40 truncate">{role}</p>
                </div>
              </div>

              <div className="flex gap-1">
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-xs text-white/60 hover:text-white/90"
                >
                  {isDarkMode ? <FaSun className="w-3.5 h-3.5" /> : <FaMoon className="w-3.5 h-3.5" />}
                  <span>{isDarkMode ? 'Terang' : 'Gelap'}</span>
                </button>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 transition-colors text-xs text-rose-300 hover:text-rose-200 disabled:opacity-50"
                >
                  {isLoggingOut ? (
                    <div className="animate-spin rounded-full w-3.5 h-3.5 border-2 border-rose-300 border-t-transparent" />
                  ) : (
                    <FaSignOutAlt className="w-3.5 h-3.5" />
                  )}
                  <span>Logout</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-center">
                <div className="relative cursor-pointer" onClick={() => setShowUserMenu(!showUserMenu)}>
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                    {initials}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900"></span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="flex justify-center py-2 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/80"
                  title={isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
                >
                  {isDarkMode ? <FaSun className="w-4 h-4" /> : <FaMoon className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex justify-center py-2 rounded-lg hover:bg-rose-500/10 transition-colors text-rose-400/60 hover:text-rose-300 disabled:opacity-50"
                  title="Logout"
                >
                  {isLoggingOut ? (
                    <div className="animate-spin rounded-full w-4 h-4 border-2 border-rose-300 border-t-transparent" />
                  ) : (
                    <FaSignOutAlt className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
        {/* Top Header */}
        <header className="relative z-20 bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50">
          <div className="px-4 lg:px-6 h-16 flex items-center justify-between">
            {/* Left */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
              >
                <FaBars className="w-4 h-4" />
              </button>
              
              <div>
                <h1 className="text-sm lg:text-base font-semibold text-gray-800 dark:text-white">
                  {router.pathname === '/' && 'Dashboard'}
                  {router.pathname === '/aset' && 'Barang Milik Negara'}
                  {router.pathname === '/ruangan' && 'Manajemen Ruangan'}
                  {router.pathname === '/asetruangan' && 'Aset per Ruangan'}
                  {router.pathname === '/picruangan' && 'PIC Ruangan'}
                  {router.pathname === '/laporanrusak' && 'Laporan Barang Rusak'}
                  {router.pathname === '/persediaan' && 'Persediaan ATK'}
                  {router.pathname === '/persediaan/reagen' && 'Persediaan Reagen'}
                </h1>
                <p className="text-[11px] text-gray-400 dark:text-white/30 mt-0.5">
                  {router.pathname === '/' && 'Overview & Statistik Sistem'}
                  {router.pathname === '/aset' && 'Management Barang Milik Negara'}
                  {router.pathname === '/ruangan' && 'Kelola data ruangan dan fasilitas'}
                  {router.pathname === '/asetruangan' && 'Atur lokasi dan penempatan aset'}
                  {router.pathname === '/picruangan' && 'Kelola data Penanggung Jawab Ruangan'}
                  {router.pathname === '/laporanrusak' && 'Kelola laporan kerusakan aset'}
                  {router.pathname === '/persediaan' && 'Kelola stok ATK, barang masuk, permintaan, dan opname'}
                  {router.pathname === '/persediaan/reagen' && 'Kelola reagen: stok gudang, kadaluarsa, pengeluaran ke LAB, dan pemakaian per gram'}
                </p>
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2">
              {/* Search (decorative) */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-white/30 text-xs">
                <FaSearch className="w-3 h-3" />
                <span>Cari sesuatu...</span>
                <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[10px] font-medium text-gray-400 dark:text-white/30">Ctrl+K</kbd>
              </div>

              {/* Notification bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
                >
                  <FaBell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full ring-2 ring-white dark:ring-gray-900">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifDropdown && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-gray-200/50 dark:border-gray-700/50 z-50 animate-in max-h-[480px] flex flex-col">
                    <div className="h-1 rounded-t-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500"></div>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700/50">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Notifikasi</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={async () => {
                            await notificationsApi.markAllRead(session);
                            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
                            setUnreadCount(0);
                          }}
                          className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                        >
                          Tandai semua dibaca
                        </button>
                      )}
                    </div>
                    <div className="overflow-y-auto flex-1 max-h-[380px]">
                      {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <FaBell className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                          <p className="text-sm text-gray-400 dark:text-gray-500">Tidak ada notifikasi</p>
                        </div>
                      ) : (
                        notifications.map((notif, i) => (
                          <Link
                            key={notif.id || i}
                            href={notif.link || '#'}
                            onClick={() => {
                              if (!notif.is_read) {
                                notificationsApi.markRead(session, notif.id);
                                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
                                setUnreadCount(prev => Math.max(0, prev - 1));
                              }
                              setShowNotifDropdown(false);
                            }}
                            className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-700/30 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${
                              !notif.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                            }`}
                          >
                            <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              notif.title?.toLowerCase().includes('diserahkan')
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                : notif.title?.toLowerCase().includes('disetujui')
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                            }`}>
                              {notif.title?.toLowerCase().includes('diserahkan')
                                ? <FaCheckCircle className="w-4 h-4" />
                                : notif.title?.toLowerCase().includes('disetujui')
                                ? <FaCheckCircle className="w-4 h-4" />
                                : <FaClock className="w-4 h-4" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{notif.title}</p>
                              <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5 line-clamp-2">{notif.message}</p>
                              <p className="text-[10px] text-gray-400 dark:text-white/30 mt-1">
                                {notif.created_at ? new Date(notif.created_at + 'Z').toLocaleDateString('id-ID', {
                                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                }) : ''}
                              </p>
                            </div>
                            {!notif.is_read && (
                              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2"></span>
                            )}
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                      {initials}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white dark:border-gray-900"></span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {name.split(' ')[0]}
                  </span>
                  <FaChevronDown className="hidden sm:block w-3 h-3 text-gray-400 group-hover:text-gray-600 dark:text-white/30 dark:group-hover:text-white/60 transition-colors" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-black/5 dark:shadow-black/20 border border-gray-200/50 dark:border-gray-700/50 z-50 animate-in">
                    {/* Decorative top gradient */}
                    <div className="h-1 rounded-t-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                    
                    <div className="p-3">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{name}</p>
                          <p className="text-xs text-gray-500 dark:text-white/40 truncate">{email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {session?.user?.realm_access?.roles?.slice(0, 3).map((r) => (
                          <span key={r} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-700/50 p-1">
                      <Link
                        href="#"
                        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 text-sm text-gray-700 dark:text-white/70 transition-colors"
                      >
                        <FaUserCircle className="w-4 h-4 text-gray-400" />
                        <span>Profil Saya</span>
                      </Link>
                      <Link
                        href="#"
                        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 text-sm text-gray-700 dark:text-white/70 transition-colors"
                      >
                        <FaCog className="w-4 h-4 text-gray-400" />
                        <span>Pengaturan</span>
                      </Link>
                    </div>

                    <div className="border-t border-gray-100 dark:border-gray-700/50 p-1">
                      <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 text-sm text-rose-600 dark:text-rose-400 w-full transition-colors disabled:opacity-50"
                      >
                        {isLoggingOut ? (
                          <div className="animate-spin rounded-full w-4 h-4 border-2 border-rose-400 border-t-transparent" />
                        ) : (
                          <FaSignOutAlt className="w-4 h-4" />
                        )}
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
