'use client';

/**
 * /admin — Painel do Gestor (hub de navegação).
 * Porta de entrada do gestor/dono: cabeçalho de marca + selo do usuário +
 * cartões para as áreas (OS · Equipe · Produção ao vivo). Segue o
 * docs/GUIA-DESIGN.md (tokens --gd-*, Inter, superfícies claras).
 *
 * A "prova do isolamento" (e-mail + oficina_id carimbado no JWT + papel) fica
 * numa linha de sessão discreta no rodapé — útil pra conferência, sem cara de
 * tela de diagnóstico.
 */

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { AdminAuthGate } from './AdminAuthGate';
import { cracheDaSessao, papelDoUsuarioAtual } from '@/lib/supabase/admin-queries';

export default function AdminPage() {
  return (
    <AdminAuthGate>
      <AdminHome />
    </AdminAuthGate>
  );
}

/**
 * Ícones de linha (stroke currentColor 1.5px) — sem emoji, sem dependência.
 * `icone` é uma chave; o SVG é resolvido em <CardIcon/>.
 */
type IconeId = 'prazos' | 'producao' | 'os' | 'equipe' | 'anomalias';

type CardDef = {
  href: string;
  icone: IconeId;
  titulo: string;
  sub: string;
  /** Cards-HERÓI ocupam a coluna larga (2fr) à esquerda. */
  hero?: boolean;
  /** Rótulo estático da prévia (sem query — a antessala não busca dado ao vivo). */
  preview?: string;
};

const CARDS: CardDef[] = [
  {
    href: '/admin/prazos',
    icone: 'prazos',
    titulo: 'Saúde de prazos',
    sub: 'Holofote do dono · dias × R$',
    hero: true,
    preview: 'Prazos e ticket médio',
  },
  {
    href: '/admin/producao',
    icone: 'producao',
    titulo: 'Produção ao vivo',
    sub: 'Kanban + estados da equipe',
    hero: true,
    preview: 'Quem está produzindo agora',
  },
  { href: '/admin/os', icone: 'os', titulo: 'Ordens de Serviço', sub: 'Criar, listar e editar OS' },
  { href: '/admin/funcionarios', icone: 'equipe', titulo: 'Equipe', sub: 'Funcionários · ativar/desativar' },
  { href: '/admin/anomalias', icone: 'anomalias', titulo: 'Anomalias', sub: 'Corrigir apontamentos esquecidos' },
];

/** SVG de linha monocromático por card (stroke herda currentColor). */
function CardIcon({ id }: { id: IconeId }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (id) {
    case 'prazos': // alvo / holofote do prazo
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.4" />
        </svg>
      );
    case 'producao': // pulso / atividade ao vivo
      return (
        <svg {...common}>
          <path d="M3 12h4l2.5 6 5-12 2.5 6H21" />
        </svg>
      );
    case 'os': // documento / ordem de serviço
      return (
        <svg {...common}>
          <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
          <path d="M13.5 3.5V8H18" />
          <path d="M9 12.5h6M9 16h4" />
        </svg>
      );
    case 'equipe': // duas pessoas / time
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M16 6.2a3 3 0 0 1 0 5.6" />
          <path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
        </svg>
      );
    case 'anomalias': // alerta / atenção
      return (
        <svg {...common}>
          <path d="M12 4.5 21 19.5H3L12 4.5Z" />
          <path d="M12 10v4" />
          <path d="M12 17.2h.01" />
        </svg>
      );
  }
}

/** Seta de avanço do card (linha, herda currentColor). */
function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function AdminHome() {
  const [email, setEmail] = useState<string | null>(null);
  const [oficinaJWT, setOficinaJWT] = useState<string | null>(null);
  const [papel, setPapel] = useState<string | null>(null);

  useEffect(() => {
    cracheDaSessao().then((c) => {
      if (c) {
        setEmail(c.email);
        setOficinaJWT(c.oficinaIdNoJWT);
      }
    });
    papelDoUsuarioAtual().then((r) => {
      if (r.status === 'success') setPapel(r.data.papel);
    });
  }, []);

  const sair = async () => {
    await getSupabase().auth.signOut();
  };

  const iniciais = (email ?? '?').split('@')[0].slice(0, 2).toUpperCase();

  const heroes = CARDS.filter((c) => c.hero);
  const gestao = CARDS.filter((c) => !c.hero);

  return (
    <main className="wrap">
      <header className="topbar">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gdelta-symbol.png" alt="" className="brand-symbol" />
          <span className="brand-title">Painel do Gestor</span>
        </div>
        <div className="user">
          <span className="avatar" aria-hidden="true">
            {iniciais}
          </span>
          <div className="user-info">
            <strong>{email ?? '—'}</strong>
            {papel && <span className="user-papel">{papel}</span>}
          </div>
          <button className="btn-sair" onClick={sair}>
            Sair
          </button>
        </div>
      </header>

      <section className="conteudo">
        <header className="hello">
          <h1 className="hello-tit">Aqui está sua oficina agora.</h1>
          <p className="hello-sub">Escolha por onde começar.</p>
        </header>

        <div className="grid">
          <div className="col col-hero">
            {heroes.map((c) => (
              <a key={c.href} href={c.href} className="card card--hero">
                <span className="card-ic" aria-hidden="true">
                  <CardIcon id={c.icone} />
                </span>
                <span className="card-body">
                  <strong className="card-tit">{c.titulo}</strong>
                  <span className="card-sub">{c.sub}</span>
                  {c.preview && <span className="card-prev">{c.preview}</span>}
                </span>
                <span className="card-arrow" aria-hidden="true">
                  <ArrowIcon />
                </span>
              </a>
            ))}
          </div>

          <div className="col col-side">
            {gestao.map((c) => (
              <a key={c.href} href={c.href} className="card card--side">
                <span className="card-ic" aria-hidden="true">
                  <CardIcon id={c.icone} />
                </span>
                <span className="card-body">
                  <strong className="card-tit">{c.titulo}</strong>
                  <span className="card-sub">{c.sub}</span>
                </span>
                <span className="card-arrow" aria-hidden="true">
                  <ArrowIcon />
                </span>
              </a>
            ))}
          </div>
        </div>

        <div className="sessao" title="Prova do isolamento multi-tenant">
          <span className="sessao-lbl">Sessão</span>
          <span className="sessao-val">{email ?? '—'}</span>
          <span className="sessao-sep">·</span>
          <span className="sessao-papel">{papel ?? '—'}</span>
          <span className="sessao-sep">·</span>
          <span className="sessao-oid gd-tabular">
            oficina {oficinaJWT ? '…' + oficinaJWT.slice(-6) : '—'}
          </span>
        </div>
      </section>

      <Estilos />
    </main>
  );
}

function Estilos() {
  return (
    <style jsx global>{`
      .wrap {
        min-height: 100vh;
        background: var(--gd-app-bg);
        color: var(--gd-ink);
        font-family: 'Inter', system-ui, sans-serif;
      }

      /* ── Header navy de comando + filete teal (padroniza as 3 telas) ── */
      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--gd-sp-4);
        padding: var(--gd-sp-3) var(--gd-sp-6);
        background: var(--gd-navy);
        border-bottom: 2px solid var(--gd-teal-bright);
        box-shadow: 0 1px 0 rgba(11, 56, 87, 0.12);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: var(--gd-sp-3);
        min-width: 0;
      }
      .brand-symbol {
        width: 30px;
        height: 30px;
        object-fit: contain;
        user-select: none;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
      }
      .brand-title {
        font-size: var(--gd-fs-h3);
        font-weight: 700;
        color: var(--gd-white);
        letter-spacing: -0.01em;
        white-space: nowrap;
      }

      /* ── Chip do usuário sobre o navy ── */
      .user {
        display: flex;
        align-items: center;
        gap: var(--gd-sp-2);
        min-width: 0;
        padding: 5px 5px 5px 6px;
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: var(--gd-r-pill);
      }
      .avatar {
        flex-shrink: 0;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: linear-gradient(160deg, var(--gd-teal-bright), var(--gd-teal));
        color: var(--gd-white);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: var(--gd-fs-cap);
        font-weight: 700;
        letter-spacing: 0.5px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
      }
      .user-info {
        display: flex;
        flex-direction: column;
        line-height: 1.25;
        min-width: 0;
        padding: 0 var(--gd-sp-1);
      }
      .user-info strong {
        font-size: var(--gd-fs-cap);
        font-weight: 600;
        color: var(--gd-white);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
      }
      .user-papel {
        font-size: var(--gd-fs-micro);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: rgba(255, 255, 255, 0.62);
      }
      .btn-sair {
        margin-left: 2px;
        padding: 7px 14px;
        border-radius: var(--gd-r-pill);
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.04);
        color: rgba(255, 255, 255, 0.82);
        font-weight: 600;
        font-size: var(--gd-fs-cap);
        cursor: pointer;
        transition:
          background var(--gd-dur-fast) var(--gd-ease),
          color var(--gd-dur-fast) var(--gd-ease),
          border-color var(--gd-dur-fast) var(--gd-ease);
      }
      .btn-sair:hover {
        background: rgba(255, 255, 255, 0.14);
        border-color: rgba(255, 255, 255, 0.32);
        color: var(--gd-white);
      }

      /* ── Conteúdo ── */
      .conteudo {
        max-width: 1040px;
        margin: 0 auto;
        padding: var(--gd-sp-6);
      }
      .hello {
        margin: 0 0 var(--gd-sp-5);
      }
      .hello-tit {
        font-size: clamp(22px, 2.6vw, 30px);
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--gd-navy);
        margin: 0;
      }
      .hello-sub {
        margin: var(--gd-sp-2) 0 0;
        font-size: var(--gd-fs-body);
        color: var(--gd-muted);
      }

      /* ── Grid assimétrico: heróis (2fr) | gestão (1fr) ── */
      .grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: var(--gd-sp-5);
        align-items: start;
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--gd-sp-4);
        min-width: 0;
      }

      /* ── Assinatura do card premium ── */
      .card {
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: var(--gd-sp-4);
        padding: var(--gd-sp-5);
        background: var(--gd-white);
        border: 1px solid var(--gd-border);
        border-radius: var(--gd-r-card);
        text-decoration: none;
        color: var(--gd-ink);
        box-shadow:
          var(--gd-elev-1),
          var(--gd-hairline-top);
        transition:
          transform var(--gd-dur-fast) var(--gd-ease),
          box-shadow var(--gd-dur-fast) var(--gd-ease),
          border-color var(--gd-dur-fast) var(--gd-ease);
      }
      .card:hover {
        transform: translateY(-2px);
        border-color: var(--gd-border-strong);
        box-shadow:
          var(--gd-elev-2),
          var(--gd-hairline-top);
      }
      .card:active {
        transform: translateY(0);
      }

      .card-ic {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: var(--gd-r-control);
        background: rgba(28, 132, 173, 0.1);
        color: var(--gd-navy);
        transition:
          background var(--gd-dur-fast) var(--gd-ease),
          color var(--gd-dur-fast) var(--gd-ease);
      }
      .card:hover .card-ic {
        background: rgba(28, 132, 173, 0.16);
        color: var(--gd-teal);
      }
      .card-body {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
        padding-right: var(--gd-sp-5);
      }
      .card-tit {
        font-size: var(--gd-fs-h3);
        font-weight: 700;
        color: var(--gd-navy);
        letter-spacing: -0.01em;
      }
      .card-sub {
        font-size: var(--gd-fs-cap);
        color: var(--gd-muted);
        line-height: 1.4;
      }
      .card-prev {
        margin-top: var(--gd-sp-2);
        display: inline-flex;
        align-items: center;
        gap: 7px;
        align-self: flex-start;
        padding: 4px 10px 4px 9px;
        font-size: var(--gd-fs-micro);
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--gd-info-ink);
        background: var(--gd-info-fill);
        border-radius: var(--gd-r-pill);
      }
      .card-prev::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--gd-teal-bright);
      }
      .card-arrow {
        position: absolute;
        top: var(--gd-sp-5);
        right: var(--gd-sp-4);
        display: inline-flex;
        color: var(--gd-border-strong);
        transition:
          color var(--gd-dur-fast) var(--gd-ease),
          transform var(--gd-dur-fast) var(--gd-ease);
      }
      .card:hover .card-arrow {
        color: var(--gd-teal-bright);
        transform: translateX(3px);
      }

      /* Heróis: mais presença vertical; gestão: compactos e discretos */
      .card--hero {
        padding: var(--gd-sp-6) var(--gd-sp-5);
      }
      .card--hero .card-ic {
        width: 50px;
        height: 50px;
      }
      .card--hero .card-tit {
        font-size: clamp(17px, 1.4vw, 20px);
      }
      .card--side {
        padding: var(--gd-sp-4) var(--gd-sp-5);
        background: rgba(255, 255, 255, 0.86);
      }
      .card--side .card-ic {
        width: 38px;
        height: 38px;
      }
      .card--side .card-ic svg {
        width: 19px;
        height: 19px;
      }
      .card--side .card-arrow {
        top: var(--gd-sp-4);
      }

      /* ── Linha de sessão (rodapé discreto) ── */
      .sessao {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--gd-sp-2);
        margin-top: var(--gd-sp-6);
        padding-top: var(--gd-sp-4);
        border-top: 1px solid var(--gd-border);
        font-size: var(--gd-fs-cap);
        color: var(--gd-muted);
      }
      .sessao-lbl {
        font-size: var(--gd-fs-micro);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--gd-muted);
        opacity: 0.7;
      }
      .sessao-papel {
        font-weight: 700;
        color: var(--gd-teal);
        text-transform: capitalize;
      }
      .sessao-sep {
        color: var(--gd-border-strong);
      }

      /* ── Responsivo: empilha no tablet/mobile ── */
      @media (max-width: 860px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 560px) {
        .conteudo {
          padding: var(--gd-sp-5) var(--gd-sp-4);
        }
        .topbar {
          padding: var(--gd-sp-3) var(--gd-sp-4);
        }
        .user-info {
          display: none;
        }
      }
    `}</style>
  );
}
