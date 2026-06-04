import Link from 'next/link';

/**
 * 404 NA MARCA (dark) — substitui a página branca padrão do Next. Qualquer
 * caminho inexistente cai aqui, no fundo navy, com link de volta pro totem.
 */
export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        background: '#0a0f1c',
        color: '#f1f5f9',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <p
        style={{
          fontFamily: 'monospace',
          fontSize: 13,
          letterSpacing: 2,
          color: '#1c84ad',
          fontWeight: 700,
          margin: 0,
        }}
      >
        GDELTA · 404
      </p>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Página não encontrada</h1>
      <p style={{ color: '#aebfd2', margin: 0, fontSize: 15 }}>Essa tela não existe.</p>
      <Link
        href="/totem"
        style={{
          marginTop: 8,
          background: '#1c84ad',
          color: '#fff',
          padding: '12px 22px',
          borderRadius: 8,
          textDecoration: 'none',
          fontWeight: 700,
        }}
      >
        Ir para o totem
      </Link>
    </main>
  );
}
