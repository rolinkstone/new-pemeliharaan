// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";

// ========== ROLE HELPERS ==========
// Role yang dikenali aplikasi. Tambahkan role baru di sini agar ikut masuk ke session.
const RECOGNIZED_ROLES = [
  'admin',
  'admin_pemeliharaan',
  'superadmin',
  'ppk',
  'pic_ruangan',
  'pic',
  'kabag_tu',
  'kabalai',
  'bendahara',
  'pic_persediaan',
  'pic_gudang',
  'pic_lab',
  'katim',
  'mt',
];

/**
 * Kumpulkan role dari realm_access DAN resource_access (client roles),
 * lalu normalisasi ke nama kanonik (lowercase) sesuai RECOGNIZED_ROLES.
 * Penting: admin_pemeliharaan bisa berupa realm role ATAU client role,
 * dan penulisannya di Keycloak bisa berbeda huruf besar/kecil.
 */
const collectRoles = (claims = {}) => {
  const realmRoles = claims?.realm_access?.roles || [];
  const clientRoles = Object.values(claims?.resource_access || {})
    .flatMap((resource) => resource?.roles || []);
  const merged = [...new Set([...realmRoles, ...clientRoles])];

  return merged
    .map((role) => RECOGNIZED_ROLES.find(
      (known) => known.toLowerCase() === String(role).trim().toLowerCase()
    ))
    .filter(Boolean);
};

/**
 * Decode access token Keycloak (tanpa verifikasi) untuk mengambil role terbaru.
 * Dipakai agar session.user.roles selalu sinkron dengan accessToken yang aktif.
 */
const rolesFromAccessToken = (accessToken) => {
  if (!accessToken) return [];
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64').toString('utf-8')
    );
    return collectRoles(payload);
  } catch (error) {
    console.error('Gagal decode access token untuk roles:', error.message);
    return [];
  }
};

/**
 * Tukar refresh token dengan access token baru (Keycloak token endpoint).
 * Jika gagal, token lama tetap dipakai agar user tidak langsung ter-logout.
 */
const refreshAccessToken = async (token) => {
  try {
    const issuer = process.env.KEYCLOAK_ISSUER;
    if (!issuer || !token.refreshToken) throw new Error('Refresh token tidak tersedia');

    const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.KEYCLOAK_CLIENT_ID,
        client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
        refresh_token: token.refreshToken,
      }),
    });

    const refreshed = await response.json();
    if (!response.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || token.refreshToken,
      idToken: refreshed.id_token || token.idToken,
      expiresAt: Math.floor(Date.now() / 1000) + (refreshed.expires_in || 0),
      error: undefined,
    };
  } catch (error) {
    console.error('Gagal refresh access token:', error?.error || error?.message || error);
    return { ...token, error: 'RefreshAccessTokenError' };
  }
};

export const authOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
      issuer: process.env.KEYCLOAK_ISSUER,

      authorization: {
        params: {
          scope: "openid profile email roles",
        },
      },

      profile(profile) {
        const roles = collectRoles(profile);
        const primaryRole = roles.length > 0 ? roles[0] : 'user';

        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username,
          email: profile.email,
          role: primaryRole,
          roles: roles,
          username: profile.preferred_username,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      // Login pertama kali: simpan token & role dari access token Keycloak
      if (account && user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.idToken = account.id_token;
        token.expiresAt = account.expires_at;

        // Ambil role dari access token agar realm role DAN client role ikut terbaca
        const tokenRoles = rolesFromAccessToken(account.access_token);
        token.roles = tokenRoles.length > 0 ? tokenRoles : (user.roles || []);
        token.role = token.roles.length > 0 ? token.roles[0] : 'user';

        return token;
      }

      // Access token masih berlaku -> pakai yang lama
      if (token.expiresAt && Date.now() < (token.expiresAt - 60) * 1000) {
        return token;
      }

      // Access token hampir/sudah kedaluwarsa -> refresh agar role terbaru ikut tersinkron
      return refreshAccessToken(token);
    },

    async session({ session, token }) {
      // Selalu turunkan role dari access token yang aktif agar perubahan role
      // di Keycloak langsung terpakai tanpa harus menunggu login ulang.
      const fromToken = rolesFromAccessToken(token.accessToken);
      const userRoles = fromToken.length > 0 ? fromToken : (token.roles || []);

      session.user = {
        id: token.id,
        name: token.name,
        email: token.email,
        role: userRoles.length > 0 ? userRoles[0] : (token.role || 'user'),
        roles: userRoles,
      };

      session.user.isAdmin = userRoles.includes('admin') || userRoles.includes('superadmin');
      session.user.isAdminPemeliharaan = userRoles.includes('admin_pemeliharaan');
      session.user.isPICRuangan = userRoles.includes('pic_ruangan') || userRoles.includes('pic');
      session.user.isPPK = userRoles.includes('ppk');
      session.user.isKabagTU = userRoles.includes('kabag_tu');
      session.user.isKabalai = userRoles.includes('kabalai');
      session.user.isBendahara = userRoles.includes('bendahara');
      session.user.isPicLab = userRoles.includes('pic_lab');
      session.user.isPicGudang = userRoles.includes('pic_gudang');
      session.user.isPicPersediaan = userRoles.includes('pic_persediaan');
      session.user.isKatim = userRoles.includes('katim');
      session.user.isMt = userRoles.includes('mt');

      session.accessToken = token.accessToken;
      session.idToken = token.idToken;
      session.refreshToken = token.refreshToken;
      session.clientId = process.env.KEYCLOAK_CLIENT_ID || 'nextjs-local';
      session.expires = token.expiresAt
        ? new Date(token.expiresAt * 1000).toISOString()
        : null;

      return session;
    },
  },

  events: {
    async signOut({ token }) {
      // Hancurkan Keycloak SSO session saat NextAuth logout
      if (token?.idToken) {
        const issuer = process.env.KEYCLOAK_ISSUER;
        const clientId = process.env.KEYCLOAK_CLIENT_ID || 'nextjs-local';
        const logoutUrl = `${issuer}/protocol/openid-connect/logout?id_token_hint=${token.idToken}&post_logout_redirect_uri=${process.env.NEXTAUTH_URL}/login&client_id=${clientId}`;
        try {
          await fetch(logoutUrl);
        } catch (error) {
          console.error('❌ Keycloak SSO logout error:', error);
        }
      }
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 4 * 60 * 60,
  },

  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
};

export default NextAuth(authOptions);