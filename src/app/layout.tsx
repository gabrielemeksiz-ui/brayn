import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Brayn — Mon second cerveau',
  description: 'Capture, organise et exploite tes idées.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="bg-[#191919] text-[#D4D4D4] antialiased font-sans">{children}</body>
    </html>
  );
}
