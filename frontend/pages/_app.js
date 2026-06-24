// pages/_app.js
import '../styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import ThemeRegistry from '../components/ThemeRegistry';

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <ThemeRegistry>
        <Component {...pageProps} />
      </ThemeRegistry>
    </SessionProvider>
  );
}

export default MyApp;