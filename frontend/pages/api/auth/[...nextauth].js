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
          scope: "openid profile email roles"
        }
      },
      
      // Tambahkan ini untuk debugging
      async profile(profile, tokens) {
        console.log("=".repeat(50));
        console.log("🔐 PROFILE CALLBACK - Raw profile from Keycloak:");
        console.log(JSON.stringify(profile, null, 2));
        console.log("-".repeat(50));
        console.log("🎫 Tokens received:");
        console.log("Access Token:", tokens.access_token?.substring(0, 50) + "...");
        console.log("ID Token:", tokens.id_token?.substring(0, 50) + "...");
        console.log("-".repeat(50));
        
        // Decode ID Token untuk melihat isinya
        if (tokens.id_token) {
          try {
            const decodedIdToken = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64').toString());
            console.log("📋 Decoded ID Token:", JSON.stringify(decodedIdToken, null, 2));
            console.log("📋 ID Token realm_access:", decodedIdToken.realm_access);
          } catch (e) {
            console.error("Error decoding ID token:", e);
          }
        }
        
        // Decode Access Token untuk melihat isinya
        if (tokens.access_token) {
          try {
            const decodedAccessToken = JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64').toString());
            console.log("📋 Decoded Access Token:", JSON.stringify(decodedAccessToken, null, 2));
            console.log("📋 Access Token realm_access:", decodedAccessToken.realm_access);
          } catch (e) {
            console.error("Error decoding Access token:", e);
          }
        }
        
        // Get all roles from realm_access
        const realmRoles = profile.realm_access?.roles || [];
        console.log("📋 Extracted realmRoles:", realmRoles);
        console.log("=".repeat(50));
        
        // Determine primary role for backward compatibility
        let role = 'user';
        if (realmRoles.includes('admin')) {
          role = 'admin';
        } else if (realmRoles.includes('kabag_tu')) {
          role = 'kabag_tu';
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
          roles: realmRoles,
          realm_access: profile.realm_access,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account, profile }) {
      console.log("=".repeat(50));
      console.log("🔄 JWT CALLBACK");
      console.log("Token before:", JSON.stringify(token, null, 2));
      console.log("User:", user);
      console.log("Account keys:", account ? Object.keys(account) : "no account");
      console.log("-".repeat(50));
      
      if (account && user) {
        console.log("✅ Setting user data to token");
        
        // Store user data on token
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
        token.roles = user.roles;
        token.realm_access = user.realm_access;
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        
        console.log("📋 Token roles after setting:", token.roles);
        console.log("📋 Token realm_access after setting:", token.realm_access);
      }
      
      console.log("Token after:", JSON.stringify(token, (key, value) => {
        if (key === 'accessToken' || key === 'refreshToken') return value?.substring(0, 20) + '...';
        return value;
      }, 2));
      console.log("=".repeat(50));
      
      return token;
    },

    async session({ session, token }) {
      console.log("=".repeat(50));
      console.log("💼 SESSION CALLBACK");
      console.log("Session before:", JSON.stringify(session, null, 2));
      console.log("Token:", JSON.stringify(token, (key, value) => {
        if (key === 'accessToken' || key === 'refreshToken') return value?.substring(0, 20) + '...';
        return value;
      }, 2));
      console.log("-".repeat(50));
      
      // Pass all token data to session
      session.user = {
        id: token.id,
        name: token.name,
        email: token.email,
        role: token.role,
        roles: token.roles || [],
      };
      
      if (token.realm_access) {
        session.user.realm_access = token.realm_access;
      }
      
      // Add helper booleans
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
      
      console.log("💼 Session after:");
      console.log("User roles array:", session.user.roles);
      console.log("User realm_access:", session.user.realm_access);
      console.log("isKabagTU:", session.user.isKabagTU);
      console.log("=".repeat(50));
      
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

  debug: true, // Set ke true untuk debug lebih detail
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
};

export default NextAuth(authOptions);