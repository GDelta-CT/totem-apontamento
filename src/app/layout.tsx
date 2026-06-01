import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'G Delta — Totem de Apontamento',
  description:
    'Sistema de apontamento industrial para oficina automotiva. Interface mobile-first otimizada para tablets e totens.',
  keywords: ['apontamento', 'oficina', 'automotivo', 'totem', 'produção', 'G Delta'],
  robots: 'noindex, nofollow',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0f1c',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
