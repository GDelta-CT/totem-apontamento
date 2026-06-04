import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Archivo } from 'next/font/google';
import './globals.css';

// Fontes auto-hospedadas via next/font (preload, zero chamada ao Google no browser).
// MESMAS fontes/pesos que os @import antigos — só muda o mecanismo de carregamento.
// As 3 viram CSS variables (aplicadas no <html>): o totem e o /admin referenciam
// var(--font-*) nos seus <style jsx global>, então a fonte fica idêntica.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  // JetBrains Mono no Google Fonts vai até o peso 800 (não tem 900). O @import
  // antigo pedia 900, mas o Google ignorava e servia 800 — então os poucos
  // elementos com font-weight:900 já renderizavam em 800. Pesos abaixo = mesmo
  // visual de antes, agora aceitos pelo type checker do next/font.
  weight: ['500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500', '700', '900'],
  display: 'swap',
  variable: '--font-archivo',
});

export const metadata: Metadata = {
  title: 'GDelta — Totem de Apontamento',
  description:
    'Sistema de apontamento industrial para oficina automotiva. Interface mobile-first otimizada para tablets e totens.',
  keywords: ['apontamento', 'oficina', 'automotivo', 'totem', 'produção', 'GDelta'],
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
    <html
      lang="pt-BR"
      className={`${inter.variable} ${jetbrainsMono.variable} ${archivo.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
