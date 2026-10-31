import type { AppProps } from 'next/app';

// NOTE:
// The main app is implemented with the App Router (`app/`).
// This minimal Pages Router `_app` exists only to satisfy build-time checks.
export default function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

