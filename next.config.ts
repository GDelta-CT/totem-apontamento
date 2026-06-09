import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Gera um build auto-contido (.next/standalone/server.js) para imagem Docker
  // enxuta no deploy em VPS. Não afeta `npm run dev`.
  output: 'standalone',
};

export default nextConfig;
