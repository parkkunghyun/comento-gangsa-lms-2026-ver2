import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Potens. 강사 ADMIN',
  description: '강사 섭외 및 교육 운영을 위한 LMS',
  icons: {
    icon: [{ url: '/logo.svg', type: 'image/svg+xml' }],
    apple: '/logo.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
