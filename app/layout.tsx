import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Self-hosted latin subsets (variable files from Google Fonts, see app/fonts): no network at build
// time, one request per family, preloaded. The matched TikTok Sans stand-in lives in globals.css.
const sans = localFont({
  src: './fonts/tiktok-sans.woff2',
  weight: '300 900',
  variable: '--font-sans',
  display: 'swap',
  adjustFontFallback: false,
  fallback: ['TikTok Sans Fallback'],
});
// Roman inscription capitals (Trajan-like) — used only for small accents.
const roman = localFont({ src: './fonts/cinzel.woff2', weight: '400 900', variable: '--font-roman', display: 'swap' });
const mono = localFont({ src: './fonts/geist-mono.woff2', weight: '400', variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'JULIUS © 2026 — Products that ship',
  description: 'Julius is a software studio from Petah Tikva. Strategy, design and engineering — from idea to launch.',
};

export const viewport: Viewport = { themeColor: '#f3f2ee' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${roman.variable}`}>
      <body>{children}</body>
    </html>
  );
}
