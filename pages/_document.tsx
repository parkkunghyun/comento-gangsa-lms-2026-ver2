import Document, { Head, Html, Main, NextScript } from 'next/document';

// NOTE:
// This project primarily uses the App Router (`app/`).
// Some Next.js build paths still attempt to resolve `/_document`.
// Providing a minimal Pages Router `_document` prevents build-time resolution errors
// without affecting App Router routing.
export default class MyDocument extends Document {
  render() {
    return (
      <Html lang="ko">
        <Head />
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

