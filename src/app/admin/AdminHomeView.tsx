'use client';

/**
 * /admin — VIEW (client) do Painel do Gestor (hub de navegação).
 *
 * Porta de entrada do gestor/dono. Fala o MESMO idioma ESCURO/INDUSTRIAL do
 * totem e da tela de OS: consome o AdminShell (marca + chip de usuário + Sair
 * + abas vivem no shell — NÃO redeclarados aqui) e usa a linguagem de cartão
 * `adm-*` do shell sobre os tokens da camada do totem.
 *
 * Como home, entra com `abaAtiva={null}` (fora das abas). As abas do shell são a
 * navegação persistente; os cartões abaixo são a ENTRADA destacada da home.
 *
 * A "prova do isolamento" (e-mail + oficina_id carimbado no JWT + papel) fica
 * numa linha de sessão discreta no rodapé — útil pra conferência, sem cara de
 * tela de diagnóstico.
 *
 * SERVER-MOVE (passo 1): a identidade da sessão dessa linha de rodapé SAIU do
 * BROWSER. Antes vinha de cracheDaSessao()/papelDoUsuarioAtual() lidos aqui via
 * getSession() (que NÃO verifica o token). Agora a página (Server Component) lê
 * no SERVIDOR via carregarSessaoAdminServer() (DAL getSessao → getUser/getClaims
 * verificados) e injeta o resultado como `estadoInicial`. Este componente NÃO
 * consulta o Supabase no browser para a linha de sessão. UX 100% idêntica: a
 * grade de cartões, a copy e a linha "Sessão" (e-mail · papel · oficina …6últimos,
 * ou '—' enquanto/sem sessão) são pixel e fluxo iguais ao original.
 */

import { AdminAuthGate } from './AdminAuthGate';
import { AdminShell } from './_shell/AdminShell';
import type { FetchState } from '@/lib/supabase/queries';
import { oficinaCurta, type SessaoAdminView } from '@/lib/supabase/dono-shared';

export function AdminHomeView({ estadoInicial }: { estadoInicial: FetchState<SessaoAdminView> }) {
  return (
    <AdminAuthGate>
      <AdminShell abaAtiva={null} titulo="Painel">
        <AdminHome estadoInicial={estadoInicial} />
      </AdminShell>
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

function AdminHome({ estadoInicial }: { estadoInicial: FetchState<SessaoAdminView> }) {
  // Identidade vinda do SERVIDOR (estadoInicial). Sem sessão (empty) ou em
  // erro/loading, a linha mostra '—' — exatamente como o hub fazia enquanto o
  // cracheDaSessao() do browser ainda não tinha resolvido.
  const sessao = estadoInicial.status === 'success' ? estadoInicial.data : null;
  const email = sessao?.email ?? null;
  const papel = sessao?.papel ?? null;
  const oficinaId = sessao?.oficinaId ?? null;

  const heroes = CARDS.filter((c) => c.hero);
  const gestao = CARDS.filter((c) => !c.hero);

  return (
    <div className="adm-hub">
      <header className="adm-hub-hello">
        <h1 className="adm-hub-hello__tit">Aqui está sua oficina agora.</h1>
        <p className="adm-hub-hello__sub">Escolha por onde começar.</p>
      </header>

      <div className="adm-hub-grid">
        <div className="adm-hub-col">
          {heroes.map((c) => (
            <a key={c.href} href={c.href} className="adm-card adm-card--hover adm-hub-card adm-hub-card--hero">
              <span className="adm-hub-card__ic" aria-hidden="true">
                <CardIcon id={c.icone} />
              </span>
              <span className="adm-hub-card__body">
                <strong className="adm-hub-card__tit">{c.titulo}</strong>
                <span className="adm-hub-card__sub">{c.sub}</span>
                {c.preview && <span className="adm-hub-card__prev">{c.preview}</span>}
              </span>
              <span className="adm-hub-card__arrow" aria-hidden="true">
                <ArrowIcon />
              </span>
            </a>
          ))}
        </div>

        <div className="adm-hub-col">
          {gestao.map((c) => (
            <a key={c.href} href={c.href} className="adm-card adm-card--hover adm-hub-card adm-hub-card--side">
              <span className="adm-hub-card__ic" aria-hidden="true">
                <CardIcon id={c.icone} />
              </span>
              <span className="adm-hub-card__body">
                <strong className="adm-hub-card__tit">{c.titulo}</strong>
                <span className="adm-hub-card__sub">{c.sub}</span>
              </span>
              <span className="adm-hub-card__arrow" aria-hidden="true">
                <ArrowIcon />
              </span>
            </a>
          ))}
        </div>
      </div>

      <div className="adm-hub-sessao" title="Prova do isolamento multi-tenant">
        <span className="adm-hub-sessao__lbl">Sessão</span>
        <span className="adm-hub-sessao__val">{email ?? '—'}</span>
        <span className="adm-hub-sessao__sep">·</span>
        <span className="adm-hub-sessao__papel">{papel ?? '—'}</span>
        <span className="adm-hub-sessao__sep">·</span>
        <span className="adm-hub-sessao__oid gd-tabular">
          oficina {oficinaCurta(oficinaId)}
        </span>
      </div>

      <EstilosHub />
    </div>
  );
}

/**
 * Estilos ESPECÍFICOS do hub (namespaced `adm-hub-*`), em <style jsx global>
 * (igual às demais telas — o styled-jsx scoped quebrava a Home no SSR). A
 * colisão é evitada pelo prefixo `adm-hub-`, não pelo scoping. A casca, o
 * cartão (`adm-card`/`adm-card--hover`), a marca, o
 * chip e as abas vêm do AdminShell. Aqui só a grade assimétrica da home, o miolo
 * do cartão (ícone/título/sub/prévia/seta) no idioma escuro e a linha de sessão
 * — tudo sobre os tokens da camada do totem (--bg-*, --text-*, --*-primary/-glow,
 * --border-*, --radius-*, --gd-navy/teal).
 */
function EstilosHub() {
  return (
    <style jsx global>{`
      .adm-hub-hello {
        margin: 0 0 24px;
      }
      .adm-hub-hello__tit {
        font-size: clamp(22px, 2.6vw, 30px);
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--text-primary);
        margin: 0;
      }
      .adm-hub-hello__sub {
        margin: 8px 0 0;
        font-size: 14px;
        color: var(--text-secondary);
      }

      /* Grid assimétrico: heróis (2fr) | gestão (1fr) */
      .adm-hub-grid {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 24px;
        align-items: start;
      }
      .adm-hub-col {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 0;
      }

      /* Miolo do cartão (a superfície/hover/sombra vêm de .adm-card / .adm-card--hover) */
      .adm-hub-card {
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 24px;
        text-decoration: none;
        color: var(--text-primary);
      }

      .adm-hub-card__ic {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: var(--radius-lg);
        background: rgba(28, 132, 173, 0.12);
        border: 1px solid rgba(28, 132, 173, 0.22);
        color: var(--adm-accent);
        transition:
          background 180ms cubic-bezier(0.4, 0, 0.2, 1),
          color 180ms cubic-bezier(0.4, 0, 0.2, 1),
          box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .adm-hub-card:hover .adm-hub-card__ic {
        background: rgba(28, 132, 173, 0.2);
        color: var(--adm-accent-strong);
        box-shadow: 0 0 16px rgba(28, 132, 173, 0.35);
      }
      .adm-hub-card__body {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
        padding-right: 24px;
      }
      .adm-hub-card__tit {
        font-size: 16px;
        font-weight: 800;
        letter-spacing: -0.01em;
        color: var(--text-primary);
      }
      .adm-hub-card__sub {
        font-size: 12.5px;
        color: var(--text-secondary);
        line-height: 1.4;
      }
      /* Prévia: pílula de info no idioma escuro (família "info" do shell) */
      .adm-hub-card__prev {
        margin-top: 8px;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        align-self: flex-start;
        padding: 4px 11px 4px 9px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.02em;
        color: var(--adm-info);
        background: var(--adm-info-fill);
        border: 1px solid var(--adm-info-line);
        border-radius: 999px;
      }
      /* Dot da pílula-prévia = estático, SEM glow (glow reservado a
         mostradores-herói + dot vivo "produzindo"). */
      .adm-hub-card__prev::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--adm-info);
      }
      .adm-hub-card__arrow {
        position: absolute;
        top: 24px;
        right: 18px;
        display: inline-flex;
        color: var(--text-muted);
        transition:
          color 180ms cubic-bezier(0.4, 0, 0.2, 1),
          transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .adm-hub-card:hover .adm-hub-card__arrow {
        color: var(--adm-accent);
        transform: translateX(3px);
      }

      /* Heróis: mais presença vertical; gestão: compactos e discretos */
      .adm-hub-card--hero {
        padding: 32px 24px;
      }
      .adm-hub-card--hero .adm-hub-card__ic {
        width: 50px;
        height: 50px;
      }
      .adm-hub-card--hero .adm-hub-card__tit {
        font-size: clamp(17px, 1.4vw, 20px);
      }
      .adm-hub-card--side {
        padding: 18px 24px;
      }
      .adm-hub-card--side .adm-hub-card__ic {
        width: 38px;
        height: 38px;
      }
      .adm-hub-card--side .adm-hub-card__ic :global(svg) {
        width: 19px;
        height: 19px;
      }
      .adm-hub-card--side .adm-hub-card__arrow {
        top: 18px;
      }

      /* Linha de sessão (rodapé discreto) */
      .adm-hub-sessao {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 32px;
        padding-top: 16px;
        border-top: 1px solid var(--border-default);
        font-size: 12.5px;
        color: var(--text-secondary);
      }
      .adm-hub-sessao__lbl {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--text-muted);
      }
      .adm-hub-sessao__papel {
        font-weight: 700;
        color: var(--adm-accent);
        text-transform: capitalize;
      }
      .adm-hub-sessao__sep {
        color: var(--text-muted);
      }
      .adm-hub-sessao__oid {
        font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace;
        color: var(--text-secondary);
      }

      /* Responsivo: empilha no tablet/mobile */
      @media (max-width: 860px) {
        .adm-hub-grid {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}
