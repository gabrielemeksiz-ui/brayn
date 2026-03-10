import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Brayn — Mon second cerveau',
  description: 'Capture, organise et exploite tes idées.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="bg-[#0e0e0e] text-white antialiased">{children}</body>
    </html>
  );
}