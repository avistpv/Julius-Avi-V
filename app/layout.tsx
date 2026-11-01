import type { Metadata, Viewport } from 'next';
import { TikTok_Sans, Geist_Mono, Cinzel } from 'next/font/google';
import './globals.css';

const sans = TikTok_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-sans' });
// Roman inscription capitals (Trajan-like) — used only for small accents.
const roman = Cinzel({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-roman' });
const mono = Geist_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-mono' });

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
