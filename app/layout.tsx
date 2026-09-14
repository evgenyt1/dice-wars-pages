import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dicefront',
  applicationName: 'Dicefront',
  description:
    'Roll the dice and conquer the map. Dicefront is a dice strategy game with a full-screen dark board, two visual themes and tactile sounds.',
  manifest: '/manifest.webmanifest?v=duel-1',
  appleWebApp: {
    capable: true,
    title: 'Dicefront',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      {
        url: '/favicon.svg?v=duel-transparent-2',
        type: 'image/svg+xml',
        sizes: 'any',
      },
      {
        url: '/favicon-32.png?v=duel-transparent-2',
        type: 'image/png',
        sizes: '32x32',
      },
    ],
    apple: { url: '/apple-touch-icon.png?v=duel-1', sizes: '180x180' },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#14121b',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
