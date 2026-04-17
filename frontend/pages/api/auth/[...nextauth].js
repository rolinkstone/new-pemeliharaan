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
          scope: "openid profile email"
        }
      },
      
      profile(profile) {
        console.log("🔐 Profile for:", profile.preferred_username);
        
        // Determine role
        let role = 'user';
        if (profile.realm_access?.roles) {
          if (profile.realm_access.roles.includes('admin')) {
            role = 'admin';
          } else if (profile.realm_access.roles.includes('kabalai')) {
            role = 'kabalai';
          } else if (profile.realm_access.roles.includes('ppk')) {
            role = 'ppk';
          } else if (profile.realm_access.roles.includes('bendahara')) {
            role = 'bendahara';
          }
        }
        
        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username,
          email: profile.email,
          role: role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        console.log("🔄 JWT - Storing user in token");
        
        // Store user data directly on token (not in nested object)
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.accessToken = account.access_token;
        token.expiresAt = account.expires_at;
      }
      
      return token;
    },

    async session({ session, token }) {
      console.log("💼 SESSION - Building from token");
      
      // Pass token data to session
      if (token) {
        session.user = {
          id: token.id,
          name: token.name,
          email: token.email,
          role: token.role,
        };
        
        session.accessToken = token.accessToken;
        session.expires = token.expiresAt ? 
          new Date(token.expiresAt * 1000).toISOString() : null;
      }
      
      console.log("💼 SESSION - User:", session.user?.name, "Role:", session.user?.role);
      console.log("💼 SESSION - Size:", JSON.stringify(session).length);
      
      return session;
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

  cookies: {
    sessionToken: {
      name: 'next-auth.session-token', // Use default name for compatibility
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 4 * 60 * 60,
      }
    }
  },

  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
};

export default NextAuth(authOptions);