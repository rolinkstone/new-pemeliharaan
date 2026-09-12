// pages/_app.js
import Head from 'next/head';
import '../styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import ThemeRegistry from '../components/ThemeRegistry';
// Pasang interceptor autentikasi global (401/403 -> redirect ke /login)
import '../utils/authInterceptor';

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
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