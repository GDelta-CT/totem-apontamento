import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Gera um build auto-contido (.next/standalone/server.js) para imagem Docker
  // enxuta no deploy em VPS. Não afeta `npm run dev`.
  output: 'standalone',
  experimental: {
    // PDFs de orçamento (WM/Cília) chegam por Server Action; o padrão é 1MB e o
    // PDF encosta nisso. A action já valida 8MB — alinhamos o limite do framework.
    serverActions: { bodySizeLimit: '10mb' },
  },
};

export default nextConfig;
