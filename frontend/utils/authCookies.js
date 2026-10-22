// utils/authCookies.js
// ============================================
// Nama cookie NextAuth khusus aplikasi Tabela.
//
// Talawang juga memakai NextAuth dengan nama cookie default
// (`next-auth.session-token`). Cookie tidak dibedakan per port, jadi bila
// Tabela dan Talawang berjalan pada host yang sama (mis. localhost:3003 dan
// localhost:3001), cookie mereka saling menimpa: membuka Talawang membuat
// Tabela menganggap sesinya tidak valid -> redirect ke /login.
//
// Dengan nama cookie sendiri, sesi kedua aplikasi tidak lagi bertabrakan.
// Dipakai oleh pages/api/auth/[...nextauth].js dan middleware.js.
// ============================================

const secure = process.env.NODE_ENV === 'production';

export const SESSION_COOKIE_NAME = secure
  ? '__Secure-tabela.session-token'
  : 'tabela.session-token';

export const CSRF_COOKIE_NAME = secure
  ? '__Host-tabela.csrf-token'
  : 'tabela.csrf-token';

export const authCookies = {
  sessionToken: {
    name: SESSION_COOKIE_NAME,
    options: { httpOnly: true, sameSite: 'lax', path: '/', secure },
  },
  callbackUrl: {
    name: 'tabela.callback-url',
    options: { sameSite: 'lax', path: '/', secure },
  },
  csrfToken: {
    name: CSRF_COOKIE_NAME,
    options: { httpOnly: true, sameSite: 'lax', path: '/', secure },
  },
  pkceCodeVerifier: {
    name: 'tabela.pkce.code_verifier',
    options: { httpOnly: true, sameSite: 'lax', path: '/', secure, maxAge: 900 },
  },
  state: {
    name: 'tabela.state',
    options: { httpOnly: true, sameSite: 'lax', path: '/', secure, maxAge: 900 },
  },
  nonce: {
    name: 'tabela.nonce',
    options: { httpOnly: true, sameSite: 'lax', path: '/', secure },
  },
};
