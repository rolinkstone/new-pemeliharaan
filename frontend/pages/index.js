// pages/home-session.js
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';

const Home = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const loading = status === 'loading';
  
  const [sessionData, setSessionData] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [isPICRuangan, setIsPICRuangan] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isKabagTU, setIsKabagTU] = useState(false); // Tambahkan state untuk kabag_tu
  const [isKabalai, setIsKabalai] = useState(false); // Tambahkan juga yang lain
  const [isPPK, setIsPPK] = useState(false);
  const [isBendahara, setIsBendahara] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      router.push('/login');
    }
  }, [session, loading, router]);

  useEffect(() => {
    if (session) {
      console.log('📦 Session Data:', session);
      setSessionData(session);
      
      // ========== DETEKSI ROLE YANG BENAR DARI REALM_ACCESS ==========
      // Role dari Keycloak berada di session.user.realm_access.roles
      const realmRoles = session?.user?.realm_access?.roles || [];
      
      // JANGAN gunakan session.user.role karena tidak akurat
      // const directRole = session?.user?.role ? [session.user.role] : [];
      
      // Gunakan hanya realmRoles untuk deteksi role
      setUserRoles(realmRoles);
      
      // Cek apakah user memiliki berbagai role
      const hasPicRuangan = realmRoles.includes('pic_ruangan') || realmRoles.includes('pic');
      const hasAdmin = realmRoles.includes('admin') || realmRoles.includes('superadmin');
      const hasKabagTU = realmRoles.includes('kabag_tu');
      const hasKabalai = realmRoles.includes('kabalai');
      const hasPPK = realmRoles.includes('ppk');
      const hasBendahara = realmRoles.includes('bendahara');
      
      setIsPICRuangan(hasPicRuangan);
      setIsAdmin(hasAdmin);
      setIsKabagTU(hasKabagTU);
      setIsKabalai(hasKabalai);
      setIsPPK(hasPPK);
      setIsBendahara(hasBendahara);
      
      console.log('📋 Realm Roles (dari Keycloak):', realmRoles);
      console.log('🔍 isPICRuangan (berdasarkan realm_roles):', hasPicRuangan);
      console.log('🔍 isAdmin (berdasarkan realm_roles):', hasAdmin);
      console.log('🔍 isKabagTU (berdasarkan realm_roles):', hasKabagTU);
      console.log('⚠️ Catatan: session.user.role =', session.user.role, '(JANGAN digunakan untuk deteksi role!)');
    }
  }, [session]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading session...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">Session Information</h1>
        
        {/* Peringatan Penting */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center mb-2">
            <span className="text-yellow-600 text-xl mr-2">⚠️</span>
            <h2 className="text-lg font-semibold text-yellow-800">Penting: Cara Deteksi Role yang Benar</h2>
          </div>
          <p className="text-yellow-700 mb-2">
            <code className="bg-yellow-100 px-1 rounded">session.user.role</code> bernilai <strong className="text-red-600">"{session.user.role}"</strong> (TIDAK AKURAT!)
          </p>
          <p className="text-yellow-700">
            Gunakan <code className="bg-yellow-100 px-1 rounded">session.user.realm_access.roles</code> untuk mendapatkan role yang benar dari Keycloak.
          </p>
        </div>

        {/* Session Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center mb-4">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            <h2 className="text-xl font-semibold text-gray-800">Session Status: Active</h2>
          </div>
          <p className="text-sm text-gray-500">Session expires: {session.expires ? new Date(session.expires).toLocaleString() : 'N/A'}</p>
        </div>

        {/* User Role Information - YANG BENAR */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">✅</span> Role yang BENAR (dari realm_access.roles)
          </h2>
          
          <div className="bg-white rounded-lg p-4 mb-4">
            <div className="text-sm text-gray-500 mb-2">📍 Roles from Keycloak (realm_access.roles):</div>
            <div className="flex flex-wrap gap-2">
              {session.user?.realm_access?.roles?.length > 0 ? (
                session.user.realm_access.roles.map((role, index) => (
                  <span
                    key={index}
                    className={`px-4 py-2 rounded-full text-sm font-bold ${
                      role === 'pic_ruangan' 
                        ? 'bg-green-500 text-white shadow-lg' 
                        : role === 'admin' 
                        ? 'bg-red-500 text-white'
                        : role === 'kabag_tu'
                        ? 'bg-purple-500 text-white shadow-lg'
                        : role === 'kabalai'
                        ? 'bg-blue-500 text-white'
                        : role === 'ppk'
                        ? 'bg-orange-500 text-white'
                        : role === 'bendahara'
                        ? 'bg-teal-500 text-white'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {role}
                  </span>
                ))
              ) : (
                <span className="text-gray-500">No realm roles found</span>
              )}
            </div>
          </div>

          {/* Hasil Deteksi Role */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-2">Hasil Deteksi:</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 font-medium">isPICRuangan:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${isPICRuangan ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {isPICRuangan ? '✅ TRUE' : '❌ FALSE'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 font-medium">isAdmin:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${isAdmin ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {isAdmin ? '✅ TRUE' : '❌ FALSE'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 font-medium">isKabagTU:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${isKabagTU ? 'bg-purple-100 text-purple-800' : 'bg-red-100 text-red-800'}`}>
                    {isKabagTU ? '✅ TRUE' : '❌ FALSE'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-500 mb-2">Role Lainnya:</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 font-medium">isKabalai:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${isKabalai ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                    {isKabalai ? '✅ TRUE' : '❌ FALSE'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 font-medium">isPPK:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${isPPK ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-600'}`}>
                    {isPPK ? '✅ TRUE' : '❌ FALSE'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 font-medium">isBendahara:</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${isBendahara ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-600'}`}>
                    {isBendahara ? '✅ TRUE' : '❌ FALSE'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Yang TIDAK boleh digunakan */}
          <div className="mt-4 bg-white rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-2">Yang TIDAK boleh digunakan:</div>
            <div className="flex items-center justify-between p-2 bg-red-50 rounded">
              <span className="text-gray-700">session.user.role:</span>
              <span className="px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-800">
                {session.user?.role || 'undefined'}
              </span>
            </div>
            <p className="text-xs text-red-600 mt-2">
              ⚠️ JANGAN gunakan field ini untuk deteksi role! Gunakan realm_access.roles
            </p>
          </div>
        </div>

        {/* Code Example */}
        <div className="bg-gray-900 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">📝 Cara Deteksi Role yang Benar di Kode</h2>
          <pre className="bg-gray-800 p-4 rounded-lg text-sm text-green-400 overflow-auto">
{`// ✅ CARA YANG BENAR - Gunakan realm_access.roles
const userRoles = session?.user?.realm_access?.roles || [];
const isPICRuangan = userRoles.includes('pic_ruangan');
const isAdmin = userRoles.includes('admin');
const isKabagTU = userRoles.includes('kabag_tu');
const isKabalai = userRoles.includes('kabalai');
const isPPK = userRoles.includes('ppk');
const isBendahara = userRoles.includes('bendahara');

// ❌ CARA YANG SALAH - Jangan gunakan session.user.role
// const isKabagTU = session.user.role === 'kabag_tu'; // Ini akan selalu false!
`}
          </pre>
        </div>

        {/* Raw Session Data */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Raw Session Object</h2>
          <details>
            <summary className="cursor-pointer text-blue-600 hover:text-blue-800 mb-2">Klik untuk melihat detail session</summary>
            <pre className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 text-sm mt-2">
              {JSON.stringify(session, null, 2)}
            </pre>
          </details>
        </div>

        {/* Realm Access Detail */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Realm Access Detail (Sumber Role yang Benar)</h2>
          <div className="bg-green-50 p-4 rounded-lg">
            <pre className="text-sm overflow-auto">
              {JSON.stringify(session.user?.realm_access, null, 2)}
            </pre>
          </div>
        </div>

        {/* Debug Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => {
              const realmRoles = session?.user?.realm_access?.roles || [];
              console.log('=== ROLE DEBUG ===');
              console.log('realm_access.roles:', realmRoles);
              console.log('isPICRuangan:', realmRoles.includes('pic_ruangan'));
              console.log('isAdmin:', realmRoles.includes('admin'));
              console.log('isKabagTU:', realmRoles.includes('kabag_tu'));
              console.log('=================');
              alert(`Role Detection:\n\nrealm_access.roles: ${realmRoles.join(', ')}\n\nisPICRuangan: ${realmRoles.includes('pic_ruangan')}\nisAdmin: ${realmRoles.includes('admin')}\nisKabagTU: ${realmRoles.includes('kabag_tu')}\n\nGunakan method ini di komponen lain!`);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Debug Role Detection
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Home;