// pages/_app.js
import Head from 'next/head';
import '../styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import ThemeRegistry from '../components/ThemeRegistry';
// Pasang interceptor autentikasi global (401/403 -> redirect ke /login)
import '../utils/authInterceptor';

// Tanpa prop `session`: SessionProvider mengambil sesi (termasuk accessToken) dari
// /api/auth/session di sisi klien, sehingga token tidak lagi tertanam di HTML
// halaman (sebelumnya ikut ter-serialize di __NEXT_DATA__).
function MyApp({ Component, pageProps }) {
  return (
    <SessionProvider>
      <Head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.ico" />
      </Head>
      <ThemeRegistry>
        <Component {...pageProps} />
      </ThemeRegistry>
    </SessionProvider>
  );
}

export default MyApp;