import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef } from 'react';
import { 
  FaBoxes, FaSignOutAlt, FaUserCircle,
  FaChevronLeft, FaChevronRight, FaBars, FaTimes,
  FaMoon, FaSun, FaCog, FaHome,
  FaMapMarkerAlt, FaDatabase, FaChartLine, FaDoorOpen,   
  FaUserTie, FaChevronDown, FaChevronUp, FaBox, FaBuilding, FaLocationArrow
} from 'react-icons/fa';
import { useSession, signOut } from 'next-auth/react';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  
  // State management
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isAsetDropdownOpen, setIsAsetDropdownOpen] = useState(true); // Default terbuka

  const userMenuRef = useRef(null);
  const loading = status === 'loading';

  // Check system theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
    }
  }, []);

  // Apply theme class to document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Authentication check
  useEffect(() => {
    if (!loading && !session) {
      router.push('/login');
    }
  }, [session, loading, router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut({ callbackUrl: '/login' });
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

  // Cek apakah salah satu submenu aset sedang aktif
  const isAsetActive = () => {
    const asetPaths = ['/aset', '/ruangan', '/asetruangan', '/picruangan'];
    return asetPaths.some(path => router.pathname === path || router.pathname.startsWith(path + '/'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-white/20 border-t-white mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-12 w-12 bg-white rounded-full animate-pulse opacity-80"></div>
            </div>
          </div>
          <p className="mt-6 text-white font-medium">Memuat Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className={`flex h-screen bg-gray-100 dark:bg-gray-900 ${isDarkMode ? 'dark' : ''}`}>
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Premium Dark */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40
        flex flex-col h-full
        transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'w-64' : 'w-20'}
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        bg-gradient-to-b from-slate-800 to-slate-900
        dark:from-gray-900 dark:to-black
        text-white
        shadow-xl
      `}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-700 dark:border-gray-800">
          {isSidebarOpen ? (
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl shadow-lg flex items-center justify-center transform group-hover:scale-110 transition-transform">
                  <span className="text-white font-bold text-xl">B</span>
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-800"></div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  BMN System
                </h1>
                <p className="text-xs text-slate-400">v1.0 · Enterprise</p>
              </div>
            </Link>
          ) : (
            <div className="w-full flex justify-center">
              <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl shadow-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">B</span>
              </div>
            </div>
          )}

          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden lg:flex p-2 rounded-lg hover:bg-slate-700 dark:hover:bg-gray-800 transition-colors text-slate-300"
            aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isSidebarOpen ? 
              <FaChevronLeft className="w-4 h-4" /> : 
              <FaChevronRight className="w-4 h-4" />
            }
          </button>

          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-700 transition-colors text-slate-300"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile Summary - Collapsed */}
        {!isSidebarOpen && (
          <div className="py-4 flex justify-center">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {initials}
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-800"></span>
            </div>
          </div>
        )}

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-6 overflow-y-auto">
          <div className="space-y-1">
            {/* Section Label */}
            {isSidebarOpen && (
              <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Menu Utama
              </p>
            )}

            {/* Home Link */}
            <Link
              href="/"
              className={`
                flex items-center px-3 py-3 rounded-xl
                transition-all duration-200 group
                ${isSidebarOpen ? 'justify-start' : 'justify-center'}
                ${router.pathname === '/' 
                  ? 'bg-amber-500/20 text-amber-300 border-l-4 border-amber-500' 
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }
              `}
              title={!isSidebarOpen ? 'Beranda' : undefined}
            >
              <FaHome className={`w-5 h-5 ${router.pathname === '/' ? 'text-amber-400' : 'text-slate-400'}`} />
              {isSidebarOpen && (
                <span className="ml-3 font-medium">Beranda</span>
              )}
            </Link>

            {/* ASET MAIN MENU WITH DROPDOWN */}
            <div className="space-y-1">
              {/* Aset Menu Header (with dropdown toggle) */}
              <button
                onClick={() => setIsAsetDropdownOpen(!isAsetDropdownOpen)}
                className={`
                  flex items-center w-full px-3 py-3 rounded-xl
                  transition-all duration-200 group
                  ${isSidebarOpen ? 'justify-between' : 'justify-center'}
                  ${isAsetActive() 
                    ? 'bg-indigo-500/20 text-indigo-300 border-l-4 border-indigo-500' 
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  }
                `}
                title={!isSidebarOpen ? 'Manajemen Aset' : undefined}
              >
                <div className="flex items-center">
                  <FaBoxes className={`w-5 h-5 ${isAsetActive() ? 'text-indigo-400' : 'text-slate-400'}`} />
                  {isSidebarOpen && (
                    <span className="ml-3 font-medium">Aset</span>
                  )}
                </div>
                
                {isSidebarOpen && (
                  <div className="text-slate-400">
                    {isAsetDropdownOpen ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />}
                  </div>
                )}
              </button>

              {/* Submenu Items (only visible when dropdown is open and sidebar is open) */}
              {isSidebarOpen && isAsetDropdownOpen && (
                <div className="ml-4 space-y-1 mt-1 pl-3 border-l border-slate-700">
                  {/* Barang BMN Submenu */}
                  <Link
                    href="/aset"
                    className={`
                      flex items-center px-3 py-2.5 rounded-lg
                      transition-all duration-200 group relative
                      ${router.pathname === '/aset' || router.pathname.startsWith('/aset/')
                        ? 'bg-amber-500/20 text-amber-300' 
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                      }
                    `}
                  >
                    <FaBox className={`w-4 h-4 mr-3 ${router.pathname === '/aset' || router.pathname.startsWith('/aset/') ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span className="text-sm font-medium">Barang BMN</span>
                    {(router.pathname === '/aset' || router.pathname.startsWith('/aset/')) && (
                      <span className="ml-auto px-2 py-0.5 bg-amber-500/30 text-amber-300 text-xs font-medium rounded-full">
                        Active
                      </span>
                    )}
                  </Link>

                  {/* Ruangan Submenu */}
                  <Link
                    href="/ruangan"
                    className={`
                      flex items-center px-3 py-2.5 rounded-lg
                      transition-all duration-200 group relative
                      ${router.pathname === '/ruangan' || router.pathname.startsWith('/ruangan/')
                        ? 'bg-emerald-500/20 text-emerald-300' 
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                      }
                    `}
                  >
                    <FaDoorOpen className={`w-4 h-4 mr-3 ${router.pathname === '/ruangan' || router.pathname.startsWith('/ruangan/') ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <span className="text-sm font-medium">Ruangan</span>
                    {(router.pathname === '/ruangan' || router.pathname.startsWith('/ruangan/')) && (
                      <span className="ml-auto px-2 py-0.5 bg-emerald-500/30 text-emerald-300 text-xs font-medium rounded-full">
                        Active
                      </span>
                    )}
                  </Link>

                  {/* Aset Ruangan Submenu */}
                  <Link
                    href="/asetruangan"
                    className={`
                      flex items-center px-3 py-2.5 rounded-lg
                      transition-all duration-200 group relative
                      ${router.pathname === '/asetruangan' || router.pathname.startsWith('/asetruangan/')
                        ? 'bg-blue-500/20 text-blue-300' 
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                      }
                    `}
                  >
                    <FaMapMarkerAlt className={`w-4 h-4 mr-3 ${router.pathname === '/asetruangan' || router.pathname.startsWith('/asetruangan/') ? 'text-blue-400' : 'text-slate-500'}`} />
                    <span className="text-sm font-medium">Aset Ruangan</span>
                    {(router.pathname === '/asetruangan' || router.pathname.startsWith('/asetruangan/')) && (
                      <span className="ml-auto px-2 py-0.5 bg-blue-500/30 text-blue-300 text-xs font-medium rounded-full">
                        Active
                      </span>
                    )}
                  </Link>

                  {/* PIC Ruangan Submenu */}
                  <Link
                    href="/picruangan"
                    className={`
                      flex items-center px-3 py-2.5 rounded-lg
                      transition-all duration-200 group relative
                      ${router.pathname === '/picruangan' || router.pathname.startsWith('/picruangan/')
                        ? 'bg-purple-500/20 text-purple-300' 
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                      }
                    `}
                  >
                    <FaUserTie className={`w-4 h-4 mr-3 ${router.pathname === '/picruangan' || router.pathname.startsWith('/picruangan/') ? 'text-purple-400' : 'text-slate-500'}`} />
                    <span className="text-sm font-medium">PIC Ruangan</span>
                    {(router.pathname === '/picruangan' || router.pathname.startsWith('/picruangan/')) && (
                      <span className="ml-auto px-2 py-0.5 bg-purple-500/30 text-purple-300 text-xs font-medium rounded-full">
                        Active
                      </span>
                    )}
                  </Link>
                </div>
              )}

              {/* For collapsed sidebar - show only icons with tooltips */}
              {!isSidebarOpen && (
                <div className="space-y-1">
                  {/* Barang BMN Icon */}
                  <Link
                    href="/aset"
                    className={`
                      flex items-center justify-center px-3 py-3 rounded-xl
                      transition-all duration-200 group relative
                      ${router.pathname === '/aset' || router.pathname.startsWith('/aset/')
                        ? 'bg-amber-500/20 text-amber-300' 
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                      }
                    `}
                    title="Barang BMN"
                  >
                    <FaBox className="w-5 h-5" />
                    {(router.pathname === '/aset' || router.pathname.startsWith('/aset/')) && (
                      <div className="absolute left-0 w-1 h-5 bg-amber-500 rounded-r-full" />
                    )}
                  </Link>

                  {/* Ruangan Icon */}
                  <Link
                    href="/ruangan"
                    className={`
                      flex items-center justify-center px-3 py-3 rounded-xl
                      transition-all duration-200 group relative
                      ${router.pathname === '/ruangan' || router.pathname.startsWith('/ruangan/')
                        ? 'bg-emerald-500/20 text-emerald-300' 
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                      }
                    `}
                    title="Ruangan"
                  >
                    <FaDoorOpen className="w-5 h-5" />
                    {(router.pathname === '/ruangan' || router.pathname.startsWith('/ruangan/')) && (
                      <div className="absolute left-0 w-1 h-5 bg-emerald-500 rounded-r-full" />
                    )}
                  </Link>

                  {/* Aset Ruangan Icon */}
                  <Link
                    href="/asetruangan"
                    className={`
                      flex items-center justify-center px-3 py-3 rounded-xl
                      transition-all duration-200 group relative
                      ${router.pathname === '/asetruangan' || router.pathname.startsWith('/asetruangan/')
                        ? 'bg-blue-500/20 text-blue-300' 
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                      }
                    `}
                    title="Aset Ruangan"
                  >
                    <FaMapMarkerAlt className="w-5 h-5" />
                    {(router.pathname === '/asetruangan' || router.pathname.startsWith('/asetruangan/')) && (
                      <div className="absolute left-0 w-1 h-5 bg-blue-500 rounded-r-full" />
                    )}
                  </Link>

                  {/* PIC Ruangan Icon */}
                  <Link
                    href="/picruangan"
                    className={`
                      flex items-center justify-center px-3 py-3 rounded-xl
                      transition-all duration-200 group relative
                      ${router.pathname === '/picruangan' || router.pathname.startsWith('/picruangan/')
                        ? 'bg-purple-500/20 text-purple-300' 
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                      }
                    `}
                    title="PIC Ruangan"
                  >
                    <FaUserTie className="w-5 h-5" />
                    {(router.pathname === '/picruangan' || router.pathname.startsWith('/picruangan/')) && (
                      <div className="absolute left-0 w-1 h-5 bg-purple-500 rounded-r-full" />
                    )}
                  </Link>
                </div>
              )}
            </div>

            {/* Laporan Rusak Menu - tetap terpisah */}
            <Link
              href="/laporanrusak"
              className={`
                flex items-center px-3 py-3 rounded-xl
                transition-all duration-200 group relative
                ${isSidebarOpen ? 'justify-start' : 'justify-center'}
                ${router.pathname === '/laporanrusak' || router.pathname.startsWith('/laporanrusak/')
                  ? 'bg-rose-500/20 text-rose-300 border-l-4 border-rose-500' 
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }
              `}
              title={!isSidebarOpen ? 'Laporan Barang Rusak' : undefined}
            >
              <FaChartLine className={`w-5 h-5 ${router.pathname === '/laporanrusak' || router.pathname.startsWith('/laporanrusak/') ? 'text-rose-400' : 'text-slate-400'}`} />
              
              {isSidebarOpen && (
                <>
                  <div className="ml-3 flex-1">
                    <span className="font-medium block">Laporan Rusak</span>
                    <span className="text-xs text-slate-400 group-hover:text-slate-300 block mt-0.5">
                      Kelola Laporan Kerusakan
                    </span>
                  </div>
                  {/* Active indicator */}
                  {(router.pathname === '/laporanrusak' || router.pathname.startsWith('/laporanrusak/')) && (
                    <span className="ml-2 px-2 py-0.5 bg-rose-500/30 text-rose-300 text-xs font-medium rounded-full">
                      Active
                    </span>
                  )}
                </>
              )}

              {/* Active indicator for collapsed sidebar */}
              {(router.pathname === '/laporanrusak' || router.pathname.startsWith('/laporanrusak/')) && !isSidebarOpen && (
                <div className="absolute left-0 w-1 h-8 bg-rose-500 rounded-r-full" />
              )}
            </Link>
          </div>
        </nav>

        {/* Bottom Section - User & Settings */}
        <div className="border-t border-slate-700 dark:border-gray-800 p-3">
          {isSidebarOpen ? (
            <div className="space-y-3">
              {/* User Info */}
              <div className="flex items-center space-x-3 p-2 bg-slate-700/50 rounded-xl">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {initials}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-800"></span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-white">{name}</p>
                  <p className="text-xs text-slate-400 truncate">{role}</p>
                </div>
              </div>

              {/* Theme Toggle */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="flex items-center justify-center space-x-2 w-full p-2 bg-slate-700/50 rounded-lg hover:bg-slate-600 transition-colors text-sm text-slate-200"
              >
                {isDarkMode ? <FaSun className="w-4 h-4" /> : <FaMoon className="w-4 h-4" />}
                <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="
                  flex items-center justify-center w-full space-x-2 py-2 px-3 rounded-xl
                  bg-red-500/20 text-red-300
                  hover:bg-red-500/30 hover:text-red-200
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                  text-sm font-medium
                "
              >
                {isLoggingOut ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-300 border-t-transparent" />
                    <span>Logging out...</span>
                  </>
                ) : (
                  <>
                    <FaSignOutAlt className="w-4 h-4" />
                    <span>Logout</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Collapsed version */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    {initials}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-800"></span>
                </div>
              </div>
              
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="w-full p-2 rounded-lg hover:bg-slate-700 transition-colors flex justify-center text-slate-300"
                title={isDarkMode ? 'Light mode' : 'Dark mode'}
              >
                {isDarkMode ? <FaSun className="w-4 h-4" /> : <FaMoon className="w-4 h-4" />}
              </button>

              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full p-2 rounded-lg hover:bg-red-500/20 transition-colors flex justify-center text-red-300 disabled:opacity-50"
                title="Logout"
              >
                {isLoggingOut ? (
                  <div className="animate-spin rounded-full h-4 h-4 border-2 border-red-300 border-t-transparent" />
                ) : (
                  <FaSignOutAlt className="w-4 h-4" />
                )}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Navigation */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="px-4 h-16 flex items-center justify-between">
            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
            >
              <FaBars className="w-5 h-5" />
            </button>
            
            {/* Page title */}
            <div className="flex-1 ml-4 lg:ml-0">
              <h1 className="text-lg font-semibold text-gray-800 dark:text-white">
                {router.pathname === '/' && 'Dashboard'}
                {router.pathname === '/aset' && 'Manajemen Barang Milik Negara'}
                {router.pathname === '/ruangan' && 'Manajemen Ruangan'}
                {router.pathname === '/asetruangan' && 'Manajemen Aset Ruangan'}
                {router.pathname === '/picruangan' && 'Manajemen PIC Ruangan'}
                {router.pathname === '/laporanrusak' && 'Laporan Barang Rusak'}
              </h1>
              {router.pathname === '/aset' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Total Aset: 2,345 · Terakhir update: 2 menit lalu
                </p>
              )}
              {router.pathname === '/ruangan' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Kelola data ruangan dan fasilitas
                </p>
              )}
              {router.pathname === '/asetruangan' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Atur lokasi dan penempatan aset
                </p>
              )}
              {router.pathname === '/picruangan' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Kelola data Penanggung Jawab Ruangan
                </p>
              )}
            </div>

            {/* Right section */}
            <div className="flex items-center space-x-2">
              {/* User menu dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="relative">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      {initials}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-800"></span>
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {name.split(' ')[0]}
                  </span>
                </button>

                {/* User dropdown menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                    <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">{name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{email}</p>
                    </div>
                    <div className="p-1">
                      <Link
                        href="/profile"
                        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
                      >
                        <FaUserCircle className="w-4 h-4" />
                        <span>Profil</span>
                      </Link>
                      <Link
                        href="/settings"
                        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
                      >
                        <FaCog className="w-4 h-4" />
                        <span>Pengaturan</span>
                      </Link>
                      <hr className="my-1 border-gray-200 dark:border-gray-700" />
                      <button
                        onClick={handleLogout}
                        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600 dark:text-red-400 w-full"
                      >
                        <FaSignOutAlt className="w-4 h-4" />
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
        <main className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-900">
          <div className="p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}