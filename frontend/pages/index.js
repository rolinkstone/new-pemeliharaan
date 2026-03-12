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

  useEffect(() => {
    if (!loading && !session) {
      router.push('/login');
    }
  }, [session, loading, router]);

  useEffect(() => {
    if (session) {
      console.log('📦 Session Data:', session);
      setSessionData(session);
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
        
        {/* Session Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center mb-4">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            <h2 className="text-xl font-semibold text-gray-800">Session Status: Active</h2>
          </div>
          <p className="text-sm text-gray-500">Session expires: {session.expires ? new Date(session.expires).toLocaleString() : 'N/A'}</p>
        </div>

        {/* Raw Session Data */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Raw Session Object</h2>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 text-sm">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>

        {/* Parsed Session Components */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">👤</span> User Object
            </h2>
            {session.user ? (
              <div className="space-y-3">
                {Object.entries(session.user).map(([key, value]) => (
                  <div key={key} className="border-b border-gray-100 pb-2">
                    <div className="text-sm text-gray-500">{key}</div>
                    <div className="text-gray-800 font-medium break-all">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No user data</p>
            )}
          </div>

          {/* Token Info */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">🔑</span> Token Information
            </h2>
            <div className="space-y-4">
              {session.accessToken && (
                <div>
                  <div className="text-sm text-gray-500">Access Token (first 50 chars)</div>
                  <div className="text-gray-800 font-mono text-sm break-all bg-gray-50 p-2 rounded">
                    {session.accessToken.substring(0, 50)}...
                  </div>
                </div>
              )}
              
              {session.refreshToken && (
                <div>
                  <div className="text-sm text-gray-500">Refresh Token (first 50 chars)</div>
                  <div className="text-gray-800 font-mono text-sm break-all bg-gray-50 p-2 rounded">
                    {session.refreshToken.substring(0, 50)}...
                  </div>
                </div>
              )}

              {session.accessToken && (
                <div>
                  <div className="text-sm text-gray-500">Decoded Token Payload</div>
                  <button
                    onClick={() => {
                      try {
                        const base64Payload = session.accessToken.split('.')[1];
                        const decoded = JSON.parse(atob(base64Payload));
                        alert(JSON.stringify(decoded, null, 2));
                      } catch (e) {
                        alert('Failed to decode token');
                      }
                    }}
                    className="mt-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Decode Token
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Provider Info */}
          <div className="bg-white rounded-lg shadow-md p-6 md:col-span-2">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
              <span className="mr-2">🔌</span> Provider Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-500">Provider</div>
                <div className="font-medium">{session.provider || 'N/A'}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-500">Provider Account ID</div>
                <div className="font-medium break-all">{session.providerAccountId || 'N/A'}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-500">Token Type</div>
                <div className="font-medium">{session.tokenType || 'Bearer'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Session Properties List */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">All Session Properties</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.keys(session).map(key => (
              <div key={key} className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-500">{key}</div>
                <div className="font-medium truncate">
                  {session[key] === null ? 'null' : 
                   typeof session[key] === 'object' ? 'Object' : 
                   typeof session[key] === 'string' ? session[key].substring(0, 30) + (session[key].length > 30 ? '...' : '') : 
                   String(session[key])}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Debug Info */}
        <div className="mt-6 text-right">
          <button
            onClick={() => {
              console.log('Current Session:', session);
              alert('Session logged to console. Press F12 to view.');
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Log Session to Console
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Home;