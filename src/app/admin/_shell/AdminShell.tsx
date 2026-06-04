'use client';

/**
 * AdminShell — chrome COMPARTILHADO do /admin (barra de comando + abas + main).
 *
 * PIVÔ DE DESIGN (amostra p/ aprovação): o /admin agora fala o MESMO idioma
 * ESCURO/INDUSTRIAL do totem (src/app/totem). Usa a CAMADA DO TOTEM de tokens
 * (--bg-*, --text-*, --green/amber/red/blue-*, --border-*, --radius-*) já
 * definida em globals.css. Acabamento capturado do totem: fundo escuro com
 * leve textura/glow, superfícies "prensadas" (borda fina + realce de topo +
 * sombra escura), números mono-tabular que BRILHAM, pílulas de status que
 * pulsam (uma cor = um significado) e acentos com glow nos elementos vivos.
 *
 * Por que existe: centraliza o cabeçalho de marca, o chip de usuário, as abas
 * de navegação e a LINGUAGEM visual compartilhada (cartão/pílula/tabela/botão/
 * modal/input), tudo com prefixo `adm-` para NÃO colidir com as classes globais
 * das telas que ainda NÃO foram migradas (as 5 telas claras restantes). Só a
 * tela de OS consome este shell escuro nesta amostra.
 *
 * O <body> é kiosk (overflow:hidden, user-select:none — ver globals.css). O admin
 * NÃO é kiosk: o .adm-shell recria o scroll (min-height:100dvh; overflow-y:auto) e
 * a seleção de texto (user-select:text) sem tocar no globals nem no totem.
 *
 * Ícones = SVG inline (sem emoji, sem dependência nova).
 */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { cracheDaSessao, papelDoUsuarioAtual } from '@/lib/supabase/admin-queries';

export type AbaAdmin = 'prazos' | 'producao' | 'os' | 'equipe' | 'anomalias' | null;

type AbaDef = { id: Exclude<AbaAdmin, null>; href: string; rotulo: string };

/** Ordem das abas = ordem de leitura do gestor (prazo → produção → cadastro). */
const ABAS: AbaDef[] = [
  { id: 'prazos', href: '/admin/prazos', rotulo: 'Saúde de prazos' },
  { id: 'producao', href: '/admin/producao', rotulo: 'Produção' },
  { id: 'os', href: '/admin/os', rotulo: 'OS' },
  { id: 'equipe', href: '/admin/funcionarios', rotulo: 'Equipe' },
  { id: 'anomalias', href: '/admin/anomalias', rotulo: 'Anomalias' },
];

export type AdminShellProps = {
  /** Aba destacada na barra de navegação (ou null em telas sem aba, ex.: hub). */
  abaAtiva: AbaAdmin;
  /** Título da tela (centro da barra de comando). */
  titulo: string;
  /** Linha de apoio sob o título (ex.: "ao vivo", contagem). Opcional. */
  subtitulo?: ReactNode;
  /** Ação primária da tela, à direita do título (ex.: botão "+ Nova OS"). */
  acao?: ReactNode;
  /** Quando > 0, a aba Anomalias ganha um badge vermelho com a contagem. */
  anomaliasCount?: number;
  children: ReactNode;
};

/** Seta-voltar (linha, herda currentColor) — volta ao hub /admin. */
function VoltarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AdminShell({
  abaAtiva,
  titulo,
  subtitulo,
  acao,
  anomaliasCount = 0,
  children,
}: AdminShellProps) {
  const [email, setEmail] = useState<string | null>(null);
  const [papel, setPapel] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    cracheDaSessao().then((c) => {
      if (ativo && c) setEmail(c.email);
      if (ativo) setCarregando(false);
    });
    papelDoUsuarioAtual().then((r) => {
      if (ativo && r.status === 'success') setPapel(r.data.papel);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const sair = async () => {
    await getSupabase().auth.signOut();
  };

  const iniciais = email ? email.split('@')[0].slice(0, 2).toUpperCase() : null;

  return (
    <div className="adm-shell">
      {/* ── Barra de comando: navy profundo + filete teal que brilha + marca ── */}
      <header className="adm-topbar">
        <div className="adm-topbar__left">
          <a className="adm-back" href="/admin" aria-label="Voltar ao painel">
            <VoltarIcon />
          </a>
          <a className="adm-brand" href="/admin">
            {/* Selo CREME (hairline teal): o símbolo oficial navy+teal SALTA no
                navy escuro da barra (antes sumia, navy-sobre-navy). */}
            <span className="adm-brand__seal" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/gdelta-totem-symbol.png" alt="" className="adm-brand__symbol" />
            </span>
            <span className="adm-brand__word" aria-label="GDelta">
              G<span className="adm-brand__bar">|</span>DELTA
            </span>
          </a>
        </div>

        <div className="adm-topbar__center">
          <strong className="adm-topbar__title">{titulo}</strong>
          {subtitulo && <span className="adm-topbar__sub">{subtitulo}</span>}
        </div>

        <div className="adm-topbar__right">
          {acao && <div className="adm-topbar__acao">{acao}</div>}
          <div className="adm-user" aria-busy={carregando}>
            <span className="adm-user__avatar" aria-hidden="true">
              {iniciais ?? <span className="adm-user__avatar-skel" />}
            </span>
            <span className="adm-user__info">
              <strong className="adm-user__email">{email ?? (carregando ? 'carregando…' : '—')}</strong>
              {papel && (
                <span className={'adm-user__papel' + (papel === 'dono' ? ' is-dono' : '')}>{papel}</span>
              )}
            </span>
          </div>
          <button className="adm-btn adm-btn--phantom" onClick={sair}>
            Sair
          </button>
        </div>
      </header>

      {/* ── Barra de abas: vidro escuro translúcido, aba ativa underline teal ── */}
      <nav className="adm-tabs" aria-label="Navegação do painel">
        <div className="adm-tabs__inner">
          {ABAS.map((aba) => {
            const ativa = aba.id === abaAtiva;
            const mostraBadge = aba.id === 'anomalias' && anomaliasCount > 0;
            return (
              <a
                key={aba.id}
                href={aba.href}
                className={'adm-tab' + (ativa ? ' is-active' : '')}
                aria-current={ativa ? 'page' : undefined}
              >
                {aba.rotulo}
                {mostraBadge && (
                  <span className="adm-tab__badge gd-tabular" aria-label={`${anomaliasCount} anomalias`}>
                    {anomaliasCount}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </nav>

      <main className="adm-main">{children}</main>

      <EstilosShell />
    </div>
  );
}

/**
 * CSS da LINGUAGEM compartilhada do /admin no idioma ESCURO/INDUSTRIAL do totem.
 * Tudo namespaced em `adm-` para não colidir com as classes globais das telas
 * ainda não migradas (.topbar/.btn/.pill/.tabela/etc.). Usa a camada de tokens
 * do totem (--bg-*, --text-*, --*-primary/-glow, --border-*, --radius-*) + os
 * tokens de marca (--gd-navy*, --gd-teal*). O anel de foco é teal que brilha.
 */
function EstilosShell() {
  return (
    <style jsx global>{`
      /* ════════ Casca: fundo escuro + textura sutil; recria scroll/seleção ════════ */
      .adm-shell {
        --adm-gutter: 28px;

        /* ════════ ESCADA TEAL sobre cockpit navy (direção de design) ════════
           UMA cor = um significado. UM hue (~205–220°) em escada:
           - ESTRUTURA = navy profundo (--gd-navy-deep / --gd-navy-soft).
           - ACENTO único (ação/ativo/foco/placa/links/contadores) = --adm-accent.
           - INFORMATIVO (recua, NÃO compete) = --adm-info, chroma MENOR. */

        /* Acento da casa — teal disciplinado da marca, DENTRO do gamut sRGB.
           O alias antigo (--gd-teal-bright = oklch(0.62 0.115 220deg)) caía FORA
           do gamut: o browser cortava o chroma e renderizava ~#0095b6, abaixando
           o branco-sobre-botão. Aqui (escopo do /admin; o totem segue com
           --gd-teal-bright intacto no seu login) o acento desce L/chroma p/ caber
           no gamut — fica em #1089a8, e o branco-sobre-botão-teal sobe p/ APCA
           Lc≈73 (era ~67 no valor cortado). Tudo no /admin que "acende" (foco,
           primário, placa, link, contador) referencia --adm-accent = 1 verdade. */
        --adm-accent: oklch(0.585 0.105 222deg); /* ≈ #1089a8 — em gamut */
        --adm-accent-strong: var(--gd-teal-hover); /* hover do acento (mais claro) */
        --adm-accent-glow: rgba(16, 137, 168, 0.45);
        --adm-accent-ring: rgba(16, 137, 168, 0.22);

        /* (tokens de dourado removidos: marca = navy + teal + off-white) */

        /* ── Mais SEPARAÇÃO card↔fundo (queixa "chapado/samey") ──
           A borda padrão (--border-default = #1e293b) quase some sobre o card
           #1a2236 (Lc≈5). Escopado ao /admin, a borda dos cards sobe p/ um
           hairline mais presente (#2d3a52, Lc≈14 sobre o card) e a superfície do
           card ganha um teto levemente mais claro — eleva sem berrar. NÃO toca
           no totem (fora de .adm-shell). */
        --border-default: #2d3a52;
        --bg-card: #1c2540;
        --bg-card-hover: #222d4d;

        /* ── "Info" da CASA (escopado ao /admin) — UM valor = UM significado ──
           NÃO usa o azul genérico --blue-primary (#3b82f6). É um ciano calmo da
           família navy/teal (chroma menor que o acento de ação, p/ recuar e NÃO
           competir): lê como "secundário/informativo" (só "sem tarefa"/neutro).
           UNIFICADO em #8fcce8: o valor mais claro que JÁ era usado nos overrides
           locais (ProducaoView/FuncionariosView) — agora promovido ao token e os
           overrides removidos. APCA Lc≈68 sobre o card escuro (o antigo
           oklch(0.74 0.075 210) dava só Lc≈55 e o texto da pílula ficava fraco). */
        --adm-info: #8fcce8;
        --adm-info-glow: rgba(143, 204, 232, 0.26);
        --adm-info-fill: rgba(143, 204, 232, 0.13);
        --adm-info-line: rgba(143, 204, 232, 0.32);

        /* ── Anti-vazamento do AZUL genérico (queixa do fundador) ──
           O foco GLOBAL (globals.css ~300) usa --border-focus/--blue-* = #3b82f6
           e PODE vazar para o /admin. Aqui, no escopo da casca, neutralizamos
           essas variáveis para o TEAL do acento — qualquer estilo que herde
           --border-focus/--blue-primary dentro do /admin acende em teal, nunca
           no azul cru. (NÃO afeta o totem, que está fora de .adm-shell.) */
        --border-focus: var(--adm-accent);
        --blue-primary: var(--adm-accent);
        --blue-glow: var(--adm-accent-glow);

        /* ── Contraste APCA (o painel LÊ DE LONGE numa TV — é critério de existência) ──
           Escopado ao /admin: o totem segue com os tokens originais (#94a3b8/#64748b).
           - --text-secondary: #94a3b8 dava só Lc≈49 sobre o card #1a2236. Sobe p/
             #b8c4d4 → Lc≈68 (rótulos de KPI/card__sub/herofoot/sub legíveis de longe).
           - --text-muted: #64748b (global) dava Lc≈26; o antigo #7d8aa0 só Lc≈37 —
             ambos somem em rótulos 11px/unidades/notas. Sobe p/ #acb9cc → Lc≈61. */
        --text-secondary: #b8c4d4;
        --text-muted: #acb9cc;

        /* ── Vermelho de risco para TEXTO/ÍCONE PEQUENO sobre fill translúcido ──
           O --red-primary (#ef4444) dá só Lc≈33 como texto de pílula/tag/número
           pequeno de anomalia (some). Este vermelho mais claro (em gamut,
           oklch 0.72 0.16 28deg ≈ #f9786a) sobe p/ Lc≈47 sobre o fill .14. SÓ no
           texto/ícone das pílulas/tags pequenas: o fill translúcido e os
           números-herói grandes (massa + glow) seguem no --red-primary. */
        --adm-bad-bright: oklch(0.72 0.16 28deg); /* ≈ #f9786a */

        height: 100dvh;
        overflow-y: auto;
        background: var(--bg-primary);
        /* Acabamento do totem: glow frio no topo + grade diagonal discretíssima */
        background-image:
          radial-gradient(120% 70% at 50% -10%, rgba(28, 132, 173, 0.1) 0%, transparent 55%),
          repeating-linear-gradient(
            45deg,
            transparent 0,
            transparent 14px,
            rgba(255, 255, 255, 0.012) 14px,
            rgba(255, 255, 255, 0.012) 15px
          );
        background-attachment: fixed;
        color: var(--text-primary);
        font-family: var(--font-inter), system-ui, sans-serif;
        -webkit-user-select: text;
        user-select: text;
      }

      /* Foco visível TEAL (nunca o azul genérico) — acessibilidade, uso diário
         com teclado. Inclui textarea; o anel usa o acento da casa. */
      .adm-shell :where(button, a, input, select, textarea, [tabindex]):focus-visible {
        outline: 2px solid var(--adm-accent);
        outline-offset: 2px;
        box-shadow: 0 0 0 4px var(--adm-accent-ring);
        border-radius: 8px;
      }

      /* ════════ Barra de comando (sticky) ════════ */
      .adm-topbar {
        position: sticky;
        top: 0;
        z-index: 30;
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px var(--adm-gutter);
        /* Superfície escura mais alta: gradiente sobre navy profundo */
        background:
          linear-gradient(180deg, var(--gd-navy-soft) 0%, var(--gd-navy-deep) 100%);
        /* COMANDO CALMO: só o filete teal de 1px no fundo + sombra ESCURA sutil.
           (Removido o glow teal de 24px que "borrava" a barra inteira.) */
        border-bottom: 1px solid var(--adm-accent);
        box-shadow:
          0 1px 0 rgba(28, 132, 173, 0.3),
          0 8px 24px rgba(0, 0, 0, 0.4);
      }
      .adm-topbar__left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
      }
      .adm-back {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        color: var(--text-secondary);
        text-decoration: none;
        transition:
          background 120ms ease,
          color 120ms ease;
      }
      .adm-back:hover {
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-primary);
      }
      .adm-brand {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        text-decoration: none;
        min-width: 0;
      }
      /* Selo da marca: disco CREME + hairline teal fino. O símbolo navy+teal
         oficial fica nítido (navy sobre creme: APCA Lc≈91) e premium — não
         some mais no navy da barra. */
      .adm-brand__seal {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 12px;
        background: #ffffff;
        border: 1px solid rgba(28, 132, 173, 0.35);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.8),
          0 0 0 1px rgba(0, 0, 0, 0.3),
          0 4px 12px -4px rgba(0, 0, 0, 0.6);
        flex-shrink: 0;
      }
      .adm-brand__symbol {
        width: 26px;
        height: 26px;
        object-fit: contain;
        user-select: none;
        -webkit-user-drag: none;
      }
      .adm-brand__word {
        font-size: 17px;
        font-weight: 800;
        letter-spacing: 0.02em;
        color: var(--text-primary);
        white-space: nowrap;
      }
      /* Traço "|" do wordmark em TEAL. */
      .adm-brand__bar {
        color: var(--adm-accent);
        margin: 0 2px;
        font-weight: 800;
      }

      .adm-topbar__center {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        min-width: 0;
        text-align: center;
      }
      .adm-topbar__title {
        font-size: 16px;
        font-weight: 800;
        letter-spacing: -0.01em;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      .adm-topbar__sub {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.09em;
      }

      .adm-topbar__right {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
      }
      .adm-topbar__acao {
        display: inline-flex;
        align-items: center;
      }

      /* Chip de usuário sobre o navy escuro */
      .adm-user {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        padding: 5px 5px 5px 6px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 999px;
      }
      .adm-user__avatar {
        flex-shrink: 0;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: linear-gradient(160deg, var(--adm-accent), var(--gd-teal));
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12.5px;
        font-weight: 700;
        letter-spacing: 0.5px;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.3),
          0 0 12px rgba(28, 132, 173, 0.35);
      }
      .adm-user__avatar-skel {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
      }
      .adm-user__info {
        display: flex;
        flex-direction: column;
        line-height: 1.25;
        min-width: 0;
        padding: 0 4px;
      }
      .adm-user__email {
        font-size: 12.5px;
        font-weight: 600;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
      }
      .adm-user__papel {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--text-muted);
      }
      /* Papel "DONO" = chip neutro discreto (sem dourado). */
      .adm-user__papel.is-dono {
        align-self: flex-start;
        margin-top: 2px;
        padding: 1px 8px;
        border-radius: 999px;
        color: var(--text-secondary);
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.14);
        letter-spacing: 0.8px;
      }

      /* ════════ Barra de abas (sticky, vidro ESCURO translúcido) ════════ */
      .adm-tabs {
        position: sticky;
        top: 59px; /* logo abaixo da barra de comando */
        z-index: 20;
        background: rgba(10, 15, 28, 0.82);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border-bottom: 1px solid var(--border-default);
      }
      .adm-tabs__inner {
        max-width: 1180px;
        margin: 0 auto;
        padding: 0 var(--adm-gutter);
        display: flex;
        gap: 28px;
        overflow-x: auto;
        scrollbar-width: none;
      }
      .adm-tabs__inner::-webkit-scrollbar {
        display: none;
      }
      .adm-tab {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 14px 2px 12px;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-muted);
        text-decoration: none;
        white-space: nowrap;
        border-bottom: 2px solid transparent;
        transition:
          color 120ms ease,
          border-color 120ms ease;
      }
      .adm-tab:hover {
        color: var(--text-secondary);
      }
      .adm-tab.is-active {
        color: var(--text-primary);
        font-weight: 700;
        border-bottom-color: var(--adm-accent);
        box-shadow: 0 2px 10px -3px var(--adm-accent-glow);
      }
      /* Badge de anomalias: vermelho que brilha */
      .adm-tab__badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 999px;
        background: var(--red-primary);
        color: #fff;
        font-size: 11px;
        font-weight: 800;
        line-height: 1;
        box-shadow: 0 0 10px var(--red-glow);
        animation: adm-badge-pulse 2s ease-in-out infinite;
      }
      @keyframes adm-badge-pulse {
        0%,
        100% {
          box-shadow: 0 0 8px var(--red-glow);
        }
        50% {
          box-shadow: 0 0 16px rgba(239, 68, 68, 0.6);
        }
      }

      /* ════════ Área de conteúdo (scroll próprio) ════════ */
      .adm-main {
        max-width: 1180px;
        margin: 0 auto;
        padding: var(--adm-gutter);
      }

      /* ════════════════════ LINGUAGEM COMPARTILHADA ════════════════════ */

      /* ── Cartão "instrumento prensado" (versão escura) ──
         superfície --bg-card, borda sutil, sombra escura + realce de topo 1px
         (highlight branco BAIXO) = profundidade do totem. */
      .adm-card {
        /* Separação mais marcada do fundo (queixa "chapado"): superfície com
           teto sutil + borda hairline mais presente + sombra funda. */
        background: linear-gradient(180deg, #20294700 0%, transparent 40%), var(--bg-card);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow:
          0 1px 0 rgba(255, 255, 255, 0.06) inset,
          0 14px 34px -12px rgba(0, 0, 0, 0.7);
        transition:
          transform 180ms cubic-bezier(0.4, 0, 0.2, 1),
          box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1),
          border-color 180ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .adm-card--hover:hover {
        transform: translateY(-2px);
        background: var(--bg-card-hover);
        border-color: rgba(28, 132, 173, 0.4);
        box-shadow:
          0 1px 0 rgba(255, 255, 255, 0.06) inset,
          0 18px 40px -14px rgba(0, 0, 0, 0.7);
      }
      .adm-card__head {
        display: flex;
        align-items: baseline;
        gap: 12px;
        padding: 24px 24px 12px;
      }
      .adm-card__title {
        font-size: 16px;
        font-weight: 800;
        letter-spacing: -0.01em;
        color: var(--text-primary);
      }
      .adm-card__sub {
        font-size: 12.5px;
        color: var(--text-secondary);
      }

      /* ── Pílula semântica (uma cor = um significado; fundo escuro translúcido
            da família + texto/dot no acento que BRILHA) ── */
      .adm-pill {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-style: normal;
        font-size: 12.5px;
        padding: 4px 12px 4px 10px;
        border-radius: 999px;
        font-weight: 700;
        background: rgba(148, 163, 184, 0.12);
        color: var(--text-secondary);
        border: 1px solid rgba(148, 163, 184, 0.2);
        white-space: nowrap;
      }
      /* Dot da pílula = estático (NÃO brilha): glow fica reservado aos
         mostradores-herói e ao dot vivo "produzindo". (Conter o glow: quando
         tudo brilha, nada salta.) */
      .adm-pill::before {
        content: '';
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: currentColor;
        flex-shrink: 0;
      }
      .adm-pill.fam-ok {
        background: rgba(34, 197, 94, 0.14);
        color: var(--green-primary);
        border-color: rgba(34, 197, 94, 0.3);
      }
      .adm-pill.fam-warn {
        background: rgba(245, 158, 11, 0.14);
        color: var(--amber-primary);
        border-color: rgba(245, 158, 11, 0.3);
      }
      .adm-pill.fam-bad {
        background: rgba(239, 68, 68, 0.14);
        color: var(--adm-bad-bright);
        border-color: rgba(239, 68, 68, 0.3);
      }
      .adm-pill.fam-neutral {
        background: rgba(148, 163, 184, 0.12);
        color: var(--text-secondary);
        border-color: rgba(148, 163, 184, 0.2);
      }
      .adm-pill.fam-info {
        background: var(--adm-info-fill);
        color: var(--adm-info);
        border-color: var(--adm-info-line);
      }

      /* ── Tabela: cabeçalho label-style, linhas com hairline escuro ── */
      .adm-table {
        width: 100%;
      }
      .adm-table__head,
      .adm-table__row {
        display: grid;
        gap: 12px;
        align-items: center;
        padding: 13px 24px;
      }
      .adm-table__head {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        padding-bottom: 10px;
      }
      .adm-table__row {
        border-top: 1px solid var(--border-default);
        font-size: 14px;
        color: var(--text-primary);
        transition: background 120ms ease;
      }
      .adm-table__row:hover {
        background: rgba(28, 132, 173, 0.06);
      }

      /* ── Botões ── */
      .adm-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: 44px;
        border: 1px solid transparent;
        border-radius: 10px;
        padding: 11px 17px;
        font-family: inherit;
        font-size: 14px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        white-space: nowrap;
        transition:
          background 120ms ease,
          border-color 120ms ease,
          color 120ms ease,
          box-shadow 120ms ease,
          transform 80ms ease;
      }
      .adm-btn:active:not(:disabled) {
        transform: translateY(1px);
      }
      .adm-btn:disabled {
        opacity: 0.5;
        cursor: default;
      }
      .adm-btn svg {
        width: 16px;
        height: 16px;
      }
      .adm-btn--primary {
        background: var(--adm-accent);
        color: #fff;
        box-shadow: 0 0 0 0 rgba(28, 132, 173, 0);
      }
      .adm-btn--primary:hover:not(:disabled) {
        background: var(--adm-accent-strong);
        box-shadow: 0 6px 20px -6px var(--adm-accent-glow);
      }
      .adm-btn--ghost {
        background: rgba(255, 255, 255, 0.03);
        border-color: var(--border-default);
        color: var(--text-secondary);
      }
      .adm-btn--ghost:hover:not(:disabled) {
        background: var(--bg-card-hover);
        border-color: rgba(148, 163, 184, 0.4);
        color: var(--text-primary);
      }
      .adm-btn--danger {
        background: rgba(239, 68, 68, 0.14);
        color: var(--adm-bad-bright);
        border-color: rgba(239, 68, 68, 0.35);
      }
      .adm-btn--danger:hover:not(:disabled) {
        background: rgba(239, 68, 68, 0.22);
        box-shadow: 0 0 16px var(--red-glow);
      }
      /* Variante "fantasma" sobre o navy (botão Sair na barra de comando) */
      .adm-btn--phantom {
        min-height: 0;
        padding: 9px 14px;
        border-radius: 999px;
        border-color: rgba(255, 255, 255, 0.18);
        background: rgba(255, 255, 255, 0.04);
        color: rgba(255, 255, 255, 0.82);
        font-weight: 600;
        font-size: 12.5px;
      }
      .adm-btn--phantom:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.32);
        color: #fff;
      }

      /* Link-ação inline (ex.: "Editar", "Tentar de novo") — teal que brilha */
      .adm-link {
        background: none;
        border: none;
        color: var(--adm-accent);
        cursor: pointer;
        font-weight: 700;
        font-size: inherit;
        font-family: inherit;
        padding: 0;
      }
      .adm-link:hover {
        color: var(--adm-accent-strong);
        text-decoration: underline;
      }

      /* ── Flash de feedback (ok / erro / aviso) — fundo escuro translúcido ── */
      .adm-flash {
        padding: 13px 16px;
        border-radius: 10px;
        font-size: 14px;
        border: 1px solid transparent;
        font-weight: 600;
      }
      .adm-flash.fam-ok {
        background: rgba(34, 197, 94, 0.12);
        color: var(--green-primary);
        border-color: rgba(34, 197, 94, 0.3);
        transition: opacity 180ms ease;
      }
      .adm-flash.fam-bad {
        background: rgba(239, 68, 68, 0.12);
        color: var(--adm-bad-bright);
        border-color: rgba(239, 68, 68, 0.3);
      }
      .adm-flash.fam-warn {
        background: rgba(245, 158, 11, 0.12);
        color: var(--amber-primary);
        border-color: rgba(245, 158, 11, 0.3);
      }

      /* ── Estado vazio (ícone SVG, sem emoji) ── */
      .adm-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 12px;
        padding: 64px 24px;
        color: var(--text-secondary);
      }
      .adm-empty__ico {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        border-radius: 18px;
        background: rgba(148, 163, 184, 0.1);
        border: 1px solid var(--border-default);
        color: var(--text-muted);
      }
      .adm-empty__ico svg {
        width: 26px;
        height: 26px;
      }
      .adm-empty__tit {
        font-size: 16px;
        font-weight: 700;
        color: var(--text-primary);
      }
      .adm-empty__sub {
        font-size: 14px;
        color: var(--text-secondary);
        max-width: 42ch;
        line-height: 1.5;
      }

      /* ── Modal: overlay escuro mais fundo + cartão escuro elevado ── */
      .adm-modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 50;
        background: rgba(3, 7, 15, 0.7);
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 48px 16px;
        overflow-y: auto;
      }
      .adm-modal {
        width: 100%;
        max-width: 540px;
        background: var(--bg-card);
        border: 1px solid rgba(28, 132, 173, 0.25);
        border-radius: var(--radius-xl);
        box-shadow:
          0 1px 0 rgba(255, 255, 255, 0.05) inset,
          0 30px 80px -20px rgba(0, 0, 0, 0.8),
          0 0 60px rgba(28, 132, 173, 0.12);
        padding: 32px;
        animation: fade-in-up 240ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .adm-modal__title {
        margin: 0 0 24px;
        font-size: clamp(20px, 2vw, 24px);
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--text-primary);
      }
      .adm-modal__actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 24px;
      }

      /* ── Campos: label + input/select escuros, foco teal que brilha ── */
      .adm-field {
        display: block;
        margin-bottom: 16px;
      }
      .adm-field__label {
        display: block;
        font-size: 12.5px;
        font-weight: 700;
        color: var(--text-secondary);
        margin-bottom: 8px;
      }
      .adm-input,
      .adm-select {
        display: block;
        width: 100%;
        min-height: 44px;
        padding: 12px 13px;
        font-family: inherit;
        font-size: 14px;
        color: var(--text-primary);
        background: var(--bg-input);
        border: 1.5px solid var(--border-default);
        border-radius: 10px;
        transition:
          border-color 120ms ease,
          box-shadow 120ms ease;
      }
      .adm-input::placeholder {
        color: var(--text-muted);
      }
      .adm-input:focus,
      .adm-select:focus {
        outline: none;
        border-color: var(--adm-accent);
        box-shadow: 0 0 0 4px var(--adm-accent-ring);
      }
      .adm-input:disabled,
      .adm-select:disabled {
        background: rgba(15, 23, 42, 0.5);
        color: var(--text-muted);
        cursor: not-allowed;
      }
      /* Select escuro: setas/opções nativas legíveis no dark */
      .adm-select {
        appearance: none;
        -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
        padding-right: 34px;
      }
      .adm-select option {
        background: var(--bg-secondary);
        color: var(--text-primary);
      }
      .adm-grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      /* ════════ Responsivo ════════ */
      @media (max-width: 860px) {
        .adm-topbar__center {
          display: none; /* em telas estreitas, o título vira o foco da aba ativa */
        }
      }
      @media (max-width: 680px) {
        .adm-shell {
          --adm-gutter: 16px;
        }
        .adm-topbar {
          gap: 8px;
        }
        .adm-user__info {
          display: none;
        }
        .adm-brand__word {
          display: none; /* mantém só o símbolo no mobile estreito */
        }
        .adm-grid-2 {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}
