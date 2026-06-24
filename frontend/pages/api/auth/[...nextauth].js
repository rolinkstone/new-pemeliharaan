// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";

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
        const realmRoles = profile.realm_access?.roles || [];
        const recognizedRoles = ['admin', 'superadmin', 'ppk', 'pic_ruangan', 'pic', 'kabag_tu', 'kabalai', 'bendahara'];
        const roles = realmRoles.filter(r => recognizedRoles.includes(r));
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
      if (account && user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.roles = user.roles;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.idToken = account.id_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },

    async session({ session, token }) {
      session.user = {
        id: token.id,
        name: token.name,
        email: token.email,
        role: token.role,
        roles: token.roles || [],
      };

      const userRoles = token.roles || [];
      session.user.isAdmin = userRoles.includes('admin') || userRoles.includes('superadmin');
      session.user.isPICRuangan = userRoles.includes('pic_ruangan') || userRoles.includes('pic');
      session.user.isPPK = userRoles.includes('ppk');
      session.user.isKabagTU = userRoles.includes('kabag_tu');
      session.user.isKabalai = userRoles.includes('kabalai');
      session.user.isBendahara = userRoles.includes('bendahara');

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