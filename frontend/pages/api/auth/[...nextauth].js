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
        console.log("📋 Profile realm_access:", JSON.stringify(profile.realm_access, null, 2));
        
        // Get all roles from realm_access
        const realmRoles = profile.realm_access?.roles || [];
        console.log("📋 Realm roles:", realmRoles);
        
        // Determine primary role for backward compatibility
        let role = 'user';
        if (realmRoles.includes('admin')) {
          role = 'admin';
        } else if (realmRoles.includes('pic_ruangan')) {
          role = 'pic_ruangan';
        } else if (realmRoles.includes('kabalai')) {
          role = 'kabalai';
        } else if (realmRoles.includes('ppk')) {
          role = 'ppk';
        } else if (realmRoles.includes('bendahara')) {
          role = 'bendahara';
        }
        
        console.log("✅ Primary role assigned:", role);
        
        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username,
          email: profile.email,
          role: role,
          roles: realmRoles,              // SIMPAN ARRAY ROLES
          realm_access: profile.realm_access, // SIMPAN FULL REALM_ACCESS
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      console.log("🔄 JWT Callback - Start");
      
      if (account && user) {
        console.log("🔄 JWT - Storing user and account data");
        
        // Store user data on token
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.roles = user.roles;                    // ARRAY OF ROLES
        token.realm_access = user.realm_access;      // FULL REALM_ACCESS OBJECT
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        
        console.log("📋 Token roles:", token.roles);
        console.log("📋 Token primary role:", token.role);
      }
      
      return token;
    },

    async session({ session, token }) {
      console.log("💼 SESSION Callback - Building from token");
      console.log("💼 Token data:", { 
        id: token.id, 
        name: token.name, 
        role: token.role, 
        roles: token.roles,
        hasRealmAccess: !!token.realm_access 
      });
      
      // Pass all token data to session
      session.user = {
        id: token.id,
        name: token.name,
        email: token.email,
        role: token.role,                        // Primary role (backward compatibility)
      };
      
      // IMPORTANT: Add roles and realm_access to session.user
      if (token.roles) {
        session.user.roles = token.roles;
      }
      
      if (token.realm_access) {
        session.user.realm_access = token.realm_access;
      }
      
      // Add helper booleans for easier role checking
      const userRoles = token.roles || [];
      session.user.isAdmin = userRoles.includes('admin') || userRoles.includes('superadmin');
      session.user.isPICRuangan = userRoles.includes('pic_ruangan') || userRoles.includes('pic');
      session.user.isPPK = userRoles.includes('ppk');
      session.user.isKabagTU = userRoles.includes('kabag_tu');
      session.user.isKabalai = userRoles.includes('kabalai');
      session.user.isBendahara = userRoles.includes('bendahara');
      
      session.accessToken = token.accessToken;
      session.refreshToken = token.refreshToken;
      session.expires = token.expiresAt ? 
        new Date(token.expiresAt * 1000).toISOString() : null;
      
      console.log("💼 SESSION - User:", session.user?.name);
      console.log("💼 SESSION - Roles:", session.user?.roles);
      console.log("💼 SESSION - isAdmin:", session.user?.isAdmin);
      console.log("💼 SESSION - isPICRuangan:", session.user?.isPICRuangan);
      
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 4 * 60 * 60, // 4 hours
  },

  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
};

export default NextAuth(authOptions);