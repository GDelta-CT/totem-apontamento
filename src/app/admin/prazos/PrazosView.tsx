'use client';

/**
 * /admin/prazos — VIEW (client) do Painel do Dono: saúde de prazos.
 *
 * O "holofote" (CLAUDE.md): KPIs grandes (ciclo médio, ticket, valor em
 * produção) + lista de carros ordenada por urgência de prazo (estourado →
 * perto → no prazo). É o quadro do Daily Huddle que faz o dono abrir ≥1x/dia.
 * Só leitura. Auto-refresh 30s.
 *
 * SERVER-MOVE (passo 1): a LEITURA agora vem do SERVIDOR. A página (Server
 * Component) busca via carregarPainelDonoServer() e injeta o resultado aqui como
 * `estadoInicial`. Este componente NÃO consulta o Supabase no browser: o
 * auto-refresh (30s) e o botão "Atualizar" chamam router.refresh(), que re-roda
 * o Server Component e RE-BUSCA NO SERVIDOR — zero query Supabase no Network do
 * browser, RLS isolando pela sessão do cookie.
 *
 * UX PRESERVADA 100%: AdminAuthGate (login/papel), AdminShell escuro/industrial,
 * estados loading/empty/error, copy, acessibilidade, holofote, réguas de
 * benchmark, banda de KPIs e extrato de risco — pixel e fluxo iguais ao original.
 * A cadência de 30s e o "gira a seta no clique" do botão foram mantidos.
 */

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AdminAuthGate } from '../AdminAuthGate';
import { AdminShell } from '../_shell/AdminShell';
import type { FetchState } from '@/lib/supabase/queries';
import {
  brl,
  DIAS_ALERTA_PRAZO,
  type CarroPrazo,
  type PainelDono,
  type SaudePrazo,
} from '@/lib/supabase/dono-shared';

const REFRESH_MS = 30000;

export function PrazosView({ estadoInicial }: { estadoInicial: FetchState<PainelDono> }) {
  return (
    <AdminAuthGate>
      <Prazos estadoInicial={estadoInicial} />
    </AdminAuthGate>
  );
}

/**
 * Mapa de situação → família de cor do shock dark. `cls` vira o modificador
 * (bad/warn/ok/neutral) da pílula, do dot e da mini-barra de prazo. Sem hex
 * hardcoded — a cor sai dos tokens --red/amber/green-primary (com glow).
 */
const SAUDE_META: Record<SaudePrazo, { txt: string; cls: string }> = {
  estourado: { txt: 'Estourado', cls: 'bad' },
  perto: { txt: 'Perto', cls: 'warn' },
  no_prazo: { txt: 'No prazo', cls: 'ok' },
  sem_prazo: { txt: 'Sem prazo', cls: 'neutral' },
};

/**
 * Progresso do prazo (0..1) apenas para apresentação — não altera nenhum
 * cálculo da query. Usa as datas já disponíveis (entrada → prometida). Retorna
 * null se faltar qualquer data (aí a célula mantém só o texto). Pode passar de 1
 * quando estourado (capamos a barra em 100%, mas sinalizamos pela cor de estado).
 */
function progressoPrazo(c: CarroPrazo): number | null {
  if (!c.data_entrada || !c.data_prometida) return null;
  const ini = Date.parse(c.data_entrada);
  const fim = Date.parse(c.data_prometida);
  if (!Number.isFinite(ini) || !Number.isFinite(fim) || fim <= ini) return null;
  const total = fim - ini;
  const decorrido = Date.now() - ini;
  return Math.min(1, Math.max(0, decorrido / total));
}

/** Ícone de relógio (holofote do prazo). 1.5px stroke, currentColor. */
function IconRelogio() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Ícone de alerta (estourados). */
function IconAlerta() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4 3 19h18L12 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="0.9" fill="currentColor" />
    </svg>
  );
}

/** Ícone de check (estado calmo: tudo no prazo). */
function IconCheck() {
  return (
    <svg className="ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="m8.5 12 2.4 2.4 4.6-4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Ícone de refresh (ação primária na barra de comando). */
function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 11a8 8 0 1 0-.6 3M20 5v6h-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Prazos({ estadoInicial }: { estadoInicial: FetchState<PainelDono> }) {
  const router = useRouter();
  const [atualizando, startTransition] = useTransition();

  // O dado vem do SERVIDOR (estadoInicial). Re-buscar = re-rodar o Server
  // Component via router.refresh() (sem query Supabase no browser).
  const atualizar = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  // Auto-refresh: mesma cadência (30s) do original, mas re-buscando NO SERVIDOR.
  // ECONOMIA (Daily Huddle, painel aberto o dia todo): com a aba em segundo plano
  // o ciclo NÃO dispara (evita re-rodar o Server Component + Auth à toa, poupando
  // bateria/conexão do tablet); ao voltar a ficar visível, faz UM refresh imediato
  // para "ressincronizar". Mesma cadência quando visível; um só timer; listener limpo.
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) router.refresh();
    };
    const id = setInterval(tick, REFRESH_MS);
    const onVisibility = () => {
      if (!document.hidden) router.refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [router]);

  const estado = estadoInicial;

  return (
    <AdminShell
      abaAtiva="prazos"
      titulo="Saúde de prazos"
      subtitulo={
        <span className="adm-prazos-sub">
          <span className="gd-live-dot adm-prazos-livedot" aria-hidden="true" />
          ao vivo · Daily Huddle
        </span>
      }
      acao={
        <button
          className="adm-btn adm-btn--ghost adm-prazos-refresh"
          onClick={atualizar}
          disabled={atualizando}
          aria-label="Atualizar"
        >
          <IconRefresh />
          {atualizando ? 'Atualizando…' : 'Atualizar'}
        </button>
      }
    >
      {estado.status === 'loading' && <p className="adm-prazos-info">Carregando prazos…</p>}

      {estado.status === 'error' && (
        <div className="adm-flash fam-bad adm-prazos-flash">
          {estado.message}{' '}
          <button className="adm-link" onClick={atualizar}>
            Tentar de novo
          </button>
        </div>
      )}

      {(estado.status === 'empty' || (estado.status === 'success' && estado.data.carros.length === 0)) && (
        <p className="adm-prazos-info">Nenhum carro ativo no pátio.</p>
      )}

      {estado.status === 'success' && estado.data.carros.length > 0 && (
        <div className="adm-prazos-board">
          <KPIs dados={estado.data} />
          <Lista carros={estado.data.carros} />
        </div>
      )}

      <Estilos />
    </AdminShell>
  );
}

function KPIs({ dados }: { dados: PainelDono }) {
  const k = dados.kpis;
  const calmo = k.estourado === 0;
  return (
    <>
      {/* HOLOFOTE — bloco-herói: risco de prazo domina a tela */}
      <section className="adm-prazos-hero" aria-label="Risco de prazo">
        <article className={`adm-prazos-herocard ${calmo ? 'calmo' : 'critico'}`}>
          <div className="adm-prazos-herohead">
            <span className="adm-prazos-heroico" aria-hidden="true">
              {calmo ? <IconCheck /> : <IconAlerta />}
            </span>
            <span className="adm-prazos-herolbl">{calmo ? 'Prazos' : 'Estourados'}</span>
          </div>
          {calmo ? (
            <strong className="adm-prazos-heromsg">Tudo no prazo.</strong>
          ) : (
            <span className="adm-prazos-heronum gd-tabular">{k.estourado}</span>
          )}
          <span className="adm-prazos-herofoot">
            {calmo
              ? `${k.totalAtivos} ${k.totalAtivos === 1 ? 'carro ativo' : 'carros ativos'}, nenhum estourou`
              : `${k.estourado === 1 ? 'carro passou' : 'carros passaram'} do prazo prometido`}
          </span>
        </article>

        <article className={`adm-prazos-herocard ${k.perto > 0 ? 'atencao' : 'sereno'} sec`}>
          <div className="adm-prazos-herohead">
            <span className="adm-prazos-heroico" aria-hidden="true">
              <IconRelogio />
            </span>
            <span className="adm-prazos-herolbl">Perto de estourar</span>
          </div>
          <span className="adm-prazos-heronum gd-tabular">{k.perto}</span>
          <span className="adm-prazos-herofoot">faltam ≤ {DIAS_ALERTA_PRAZO} dias para o prazo</span>
        </article>
      </section>

      {/* BANDA SECUNDÁRIA — mostradores com régua de benchmark (PPG/AkzoNobel) */}
      <section className="adm-prazos-kpis" aria-label="Indicadores do pátio">
        <div className="adm-prazos-kpi">
          <span className="adm-prazos-kpi-lbl">Tempo de ciclo</span>
          <span className="adm-prazos-kpi-num gd-tabular">
            {k.cicloMedioDias}
            <em className="un">dias</em>
          </span>
          <span className="adm-prazos-kpi-bench">
            <span className="adm-prazos-bench-bar" data-state={k.cicloMedioDias <= 7 ? 'ok' : 'warn'} aria-hidden="true">
              <i style={{ width: `${Math.min(100, (k.cicloMedioDias / 14) * 100)}%` }} />
            </span>
            meta · até 7 dias
          </span>
        </div>
        <div className="adm-prazos-kpi">
          <span className="adm-prazos-kpi-lbl">Ticket médio</span>
          <span className="adm-prazos-kpi-num gd-tabular">{k.ticketMedio != null ? brl(k.ticketMedio) : '—'}</span>
          <span className="adm-prazos-kpi-bench">média por carro com orçamento</span>
        </div>
        <div className="adm-prazos-kpi">
          <span className="adm-prazos-kpi-lbl">Valor em produção</span>
          <span className="adm-prazos-kpi-num gd-tabular">{brl(k.valorEmProducao)}</span>
          <span className="adm-prazos-kpi-bench">soma dos orçamentos no pátio</span>
        </div>
        <div className="adm-prazos-kpi">
          <span className="adm-prazos-kpi-lbl">Ocupação do pátio</span>
          <span className="adm-prazos-kpi-num gd-tabular">
            {k.totalAtivos}
            <em className="un">{k.totalAtivos === 1 ? 'carro' : 'carros'}</em>
          </span>
          <span className="adm-prazos-kpi-bench">ativos agora · meta 70–85%</span>
        </div>
      </section>
    </>
  );
}

/** Formata uma data ISO (YYYY-MM-DD…) como dd/mm sem libs. */
function diaMes(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}` : iso.slice(0, 10);
}

function Lista({ carros }: { carros: CarroPrazo[] }) {
  return (
    <section className="adm-prazos-lista adm-card" aria-label="Extrato de risco — carros por urgência">
      <div className="adm-prazos-lista-cab">
        <span className="adm-prazos-lh-tit">Extrato de risco</span>
        <span className="adm-prazos-lh-sub">ordenado por urgência de prazo</span>
      </div>
      <div className="adm-prazos-linha cabec" role="row">
        <span>Placa</span>
        <span>Modelo</span>
        <span>Dias aqui</span>
        <span>Prazo decorrido</span>
        <span>Valor</span>
        <span>Situação</span>
      </div>
      {carros.map((c) => {
        const meta = SAUDE_META[c.saude];
        const prog = progressoPrazo(c);
        return (
          <div className="adm-prazos-linha" key={c.id} role="row">
            <span className="adm-prazos-placa gd-tabular">{c.placa}</span>
            <span className="adm-prazos-modelo">{c.modelo}</span>
            <span className="adm-prazos-dias gd-tabular">
              {c.diasNaOficina}
              <em className="un">d</em>
            </span>
            <span className={`adm-prazos-prazo s-${meta.cls}`}>
              {prog != null ? (
                <>
                  <span className="adm-prazos-barra" aria-hidden="true">
                    <i style={{ width: `${Math.round(prog * 100)}%` }} />
                  </span>
                  <span className="adm-prazos-prazo-txt gd-tabular">
                    {c.data_prometida ? diaMes(c.data_prometida) : '—'}
                    {c.diasAtePrazo != null && (
                      <em className="ate">
                        {c.diasAtePrazo < 0 ? `${Math.abs(c.diasAtePrazo)}d atrás` : `em ${c.diasAtePrazo}d`}
                      </em>
                    )}
                  </span>
                </>
              ) : (
                <span className="adm-prazos-prazo-txt gd-tabular">
                  {c.data_prometida ? c.data_prometida.slice(0, 10) : '—'}
                  {c.diasAtePrazo != null && (
                    <em className="ate">
                      {c.diasAtePrazo < 0 ? `${Math.abs(c.diasAtePrazo)}d atrás` : `em ${c.diasAtePrazo}d`}
                    </em>
                  )}
                </span>
              )}
            </span>
            <span className="adm-prazos-valor gd-tabular">{c.valor_orcamento != null ? brl(c.valor_orcamento) : '—'}</span>
            <span>
              <em className={`adm-prazos-pill s-${meta.cls}`}>
                <span className="adm-prazos-pdot" aria-hidden="true" />
                {meta.txt}
              </em>
            </span>
          </div>
        );
      })}
    </section>
  );
}

/**
 * Estilos ESPECÍFICOS da tela de prazos (namespaced `adm-prazos-*`) no idioma
 * ESCURO do totem. O chrome (barra de comando, abas, foco teal, cartão/pílula/
 * botão/flash base) vem do AdminShell. Aqui ficam o HOLOFOTE (cartão-herói com
 * borda de estado que brilha; calmo = verde que brilha), as réguas de benchmark,
 * a banda de KPIs e o extrato de risco (mini-barra de prazo). Tokens da camada do
 * totem (--bg-*, --text-*, --*-primary/-glow, --border-*, --radius-*); números
 * com `gd-tabular` e alto contraste.
 */
function Estilos() {
  return (
    <style jsx global>{`
      /* Subtítulo "ao vivo" na barra de comando: dot teal que pulsa */
      .adm-prazos-sub {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .adm-prazos-livedot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: var(--adm-accent);
        box-shadow: 0 0 8px var(--adm-accent);
      }
      /* Ação primária = atualizar (gira a seta no clique, gesto do totem) */
      .adm-prazos-refresh:active:not(:disabled) svg {
        transform: rotate(-30deg);
      }
      .adm-prazos-refresh svg {
        transition: transform 120ms ease;
      }

      .adm-prazos-info {
        padding: 24px;
        color: var(--text-secondary);
        font-size: 14px;
      }
      .adm-prazos-flash {
        margin-bottom: 16px;
      }

      .adm-prazos-board {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      /* ════════ HOLOFOTE — bloco-herói (risco de prazo domina a tela) ════════
         Cartão "instrumento prensado" escuro (mesma profundidade do shell:
         borda fina + realce de topo 1px + sombra escura). A cor de estado é uma
         faixa vertical que BRILHA à esquerda + tinge número/ícone/rótulo. */
      .adm-prazos-hero {
        display: grid;
        grid-template-columns: 1.6fr 1fr;
        gap: 16px;
      }
      .adm-prazos-herocard {
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 26px;
        background: var(--bg-card);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow:
          0 1px 0 rgba(255, 255, 255, 0.04) inset,
          0 12px 30px -12px rgba(0, 0, 0, 0.6);
        transition:
          transform 180ms cubic-bezier(0.4, 0, 0.2, 1),
          box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1),
          border-color 180ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .adm-prazos-herocard:hover {
        transform: translateY(-2px);
        border-color: var(--accent-border, rgba(28, 132, 173, 0.4));
        box-shadow:
          0 1px 0 rgba(255, 255, 255, 0.06) inset,
          0 18px 40px -14px rgba(0, 0, 0, 0.7);
      }
      /* Faixa de cor de estado fina à esquerda — foco vem do tamanho/posição +
         GLOW (não de borda berrante). */
      .adm-prazos-herocard::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        background: var(--accent, transparent);
        box-shadow: 0 0 16px var(--accent-glow, transparent);
      }
      .adm-prazos-herocard.critico {
        --accent: var(--red-primary);
        --accent-glow: var(--red-glow);
        --accent-border: rgba(239, 68, 68, 0.45);
      }
      /* Holofote calmo = verde que brilha: leve wash verde + faixa/ícone glow */
      .adm-prazos-herocard.calmo {
        --accent: var(--green-primary);
        --accent-glow: var(--green-glow);
        --accent-border: rgba(34, 197, 94, 0.4);
        background:
          radial-gradient(120% 90% at 0% 0%, rgba(34, 197, 94, 0.12) 0%, transparent 55%),
          var(--bg-card);
      }
      .adm-prazos-herocard.atencao {
        --accent: var(--amber-primary);
        --accent-glow: var(--amber-glow);
        --accent-border: rgba(245, 158, 11, 0.45);
      }
      .adm-prazos-herocard.sereno {
        --accent: var(--text-muted);
        --accent-glow: transparent;
      }
      .adm-prazos-herohead {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--accent, var(--text-secondary));
      }
      .adm-prazos-heroico {
        display: inline-flex;
        filter: drop-shadow(0 0 8px var(--accent-glow, transparent));
      }
      .adm-prazos-heroico .ico {
        width: 22px;
        height: 22px;
      }
      .adm-prazos-herolbl {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      /* Número-herói = MOSTRADOR: JetBrains Mono 900, enorme, alto contraste,
         BRILHANDO na cor do estado (o número que "acende como um instrumento"). */
      .adm-prazos-heronum {
        font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace;
        font-size: clamp(56px, 8vw, 88px);
        font-weight: 900;
        line-height: 0.95;
        letter-spacing: -0.02em;
        color: var(--accent, var(--text-primary));
        text-shadow: 0 0 28px var(--accent-glow, transparent);
      }
      .adm-prazos-herocard.sereno .adm-prazos-heronum {
        color: var(--text-primary);
        text-shadow: none;
      }
      /* Mensagem do estado calmo = verde que brilha */
      .adm-prazos-heromsg {
        font-size: clamp(30px, 4vw, 40px);
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.02em;
        color: var(--green-primary);
        text-shadow: 0 0 24px var(--green-glow);
      }
      .adm-prazos-herofoot {
        font-size: 12.5px;
        color: var(--text-secondary);
        line-height: 1.4;
      }
      .adm-prazos-herocard.sec {
        justify-content: space-between;
      }

      /* ════════ BANDA SECUNDÁRIA — mostradores + régua de benchmark ════════ */
      .adm-prazos-kpis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
      }
      .adm-prazos-kpi {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 20px;
        background: var(--bg-card);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow:
          0 1px 0 rgba(255, 255, 255, 0.04) inset,
          0 12px 30px -12px rgba(0, 0, 0, 0.6);
        transition:
          transform 180ms cubic-bezier(0.4, 0, 0.2, 1),
          box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1),
          border-color 180ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .adm-prazos-kpi:hover {
        transform: translateY(-2px);
        border-color: rgba(28, 132, 173, 0.4);
        box-shadow:
          0 1px 0 rgba(255, 255, 255, 0.06) inset,
          0 18px 40px -14px rgba(0, 0, 0, 0.7);
      }
      .adm-prazos-kpi-lbl {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.07em;
        font-weight: 700;
      }
      /* Número de KPI = mostrador: mono-tabular, alto contraste, brilho discreto.
         Unidade ao lado: menor / 600 / muted (recua, não compete). */
      .adm-prazos-kpi-num {
        display: flex;
        align-items: baseline;
        gap: 6px;
        font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace;
        font-size: 30px;
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.01em;
        color: var(--text-primary);
        text-shadow: 0 0 18px rgba(28, 132, 173, 0.18);
      }
      .adm-prazos-kpi-num .un {
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 12.5px;
        font-weight: 600;
        font-style: normal;
        color: var(--text-muted);
        letter-spacing: 0;
        text-shadow: none;
      }
      .adm-prazos-kpi-bench {
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-size: 11px;
        color: var(--text-muted);
      }
      /* Régua de benchmark: trilho escuro + preenchimento que brilha (ok/warn) */
      .adm-prazos-bench-bar {
        position: relative;
        height: 4px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.16);
        overflow: hidden;
      }
      .adm-prazos-bench-bar i {
        position: absolute;
        inset: 0 auto 0 0;
        border-radius: 999px;
        background: var(--green-primary);
        box-shadow: 0 0 8px var(--green-glow);
        transition: width 480ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .adm-prazos-bench-bar[data-state='warn'] i {
        background: var(--amber-primary);
        box-shadow: 0 0 8px var(--amber-glow);
      }

      /* ════════ EXTRATO DE RISCO ════════ (cartão do shell .adm-card) */
      .adm-prazos-lista {
        overflow: hidden;
      }
      .adm-prazos-lista-cab {
        display: flex;
        align-items: baseline;
        gap: 12px;
        padding: 22px 24px 12px;
      }
      .adm-prazos-lh-tit {
        font-size: 16px;
        font-weight: 800;
        color: var(--text-primary);
        letter-spacing: -0.01em;
      }
      .adm-prazos-lh-sub {
        font-size: 12.5px;
        color: var(--text-secondary);
      }
      .adm-prazos-linha {
        display: grid;
        grid-template-columns: 96px 1.2fr 78px 1.5fr 118px 116px;
        gap: 12px;
        align-items: center;
        padding: 13px 24px;
        border-top: 1px solid var(--border-default);
        font-size: 14px;
        color: var(--text-primary);
      }
      .adm-prazos-linha.cabec {
        border-top: none;
        background: transparent;
        font-weight: 700;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--text-muted);
        padding-top: 0;
        padding-bottom: 10px;
      }
      .adm-prazos-linha:not(.cabec):hover {
        background: rgba(28, 132, 173, 0.06);
      }
      /* Placa = "instrumento" do totem: caixa escura + borda teal + mono brilho */
      .adm-prazos-placa {
        justify-self: start;
        font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace;
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 0.1em;
        color: var(--text-primary);
        background: rgba(3, 7, 15, 0.6);
        border: 1px solid rgba(28, 132, 173, 0.4);
        border-radius: 6px;
        padding: 4px 9px;
      }
      .adm-prazos-modelo {
        color: var(--text-primary);
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .adm-prazos-dias {
        font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace;
        color: var(--text-primary);
        font-weight: 700;
      }
      .adm-prazos-dias .un {
        margin-left: 1px;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 11px;
        font-style: normal;
        color: var(--text-muted);
      }
      .adm-prazos-valor {
        font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace;
        color: var(--text-primary);
        font-weight: 600;
      }

      /* mini-barra de prazo — cor de estado que brilha (acentos dark) */
      .adm-prazos-prazo {
        display: flex;
        flex-direction: column;
        gap: 5px;
        --accent: var(--text-muted);
        --accent-fill: rgba(148, 163, 184, 0.16);
        --accent-glow: transparent;
      }
      .adm-prazos-prazo.s-bad {
        --accent: var(--red-primary);
        --accent-fill: rgba(239, 68, 68, 0.16);
        --accent-glow: var(--red-glow);
      }
      .adm-prazos-prazo.s-warn {
        --accent: var(--amber-primary);
        --accent-fill: rgba(245, 158, 11, 0.16);
        --accent-glow: var(--amber-glow);
      }
      .adm-prazos-prazo.s-ok {
        --accent: var(--green-primary);
        --accent-fill: rgba(34, 197, 94, 0.16);
        --accent-glow: var(--green-glow);
      }
      .adm-prazos-barra {
        position: relative;
        height: 6px;
        border-radius: 999px;
        background: var(--accent-fill);
        overflow: hidden;
      }
      .adm-prazos-barra i {
        position: absolute;
        inset: 0 auto 0 0;
        border-radius: 999px;
        background: var(--accent);
        box-shadow: 0 0 8px var(--accent-glow);
        transition: width 480ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .adm-prazos-prazo-txt {
        font-size: 12.5px;
        color: var(--text-secondary);
      }
      .adm-prazos-prazo-txt .ate {
        font-style: normal;
        font-weight: 700;
        color: var(--accent);
        margin-left: 6px;
      }

      /* pílula-cápsula com dot que brilha (uma cor = um significado) */
      .adm-prazos-pill {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-style: normal;
        font-size: 12.5px;
        padding: 4px 12px 4px 10px;
        border-radius: 999px;
        font-weight: 700;
        border: 1px solid var(--p-border, rgba(148, 163, 184, 0.2));
        background: var(--p-fill, rgba(148, 163, 184, 0.12));
        color: var(--p-ink, var(--text-secondary));
        white-space: nowrap;
      }
      .adm-prazos-pdot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: currentColor;
        box-shadow: 0 0 8px currentColor;
        flex-shrink: 0;
      }
      .adm-prazos-pill.s-bad {
        --p-fill: rgba(239, 68, 68, 0.14);
        --p-ink: var(--red-primary);
        --p-border: rgba(239, 68, 68, 0.3);
      }
      .adm-prazos-pill.s-warn {
        --p-fill: rgba(245, 158, 11, 0.14);
        --p-ink: var(--amber-primary);
        --p-border: rgba(245, 158, 11, 0.3);
      }
      .adm-prazos-pill.s-ok {
        --p-fill: rgba(34, 197, 94, 0.14);
        --p-ink: var(--green-primary);
        --p-border: rgba(34, 197, 94, 0.3);
      }
      .adm-prazos-pill.s-neutral {
        --p-fill: rgba(148, 163, 184, 0.12);
        --p-ink: var(--text-secondary);
        --p-border: rgba(148, 163, 184, 0.2);
      }
      .adm-prazos-pill.s-neutral .adm-prazos-pdot {
        box-shadow: none;
      }

      @media (max-width: 760px) {
        .adm-prazos-hero {
          grid-template-columns: 1fr;
        }
        .adm-prazos-linha {
          grid-template-columns: 84px 1fr auto;
          gap: 8px;
        }
        /* mantém Placa, Modelo e Situação; oculta Dias/Prazo/Valor */
        .adm-prazos-linha span:nth-child(3),
        .adm-prazos-linha span:nth-child(4),
        .adm-prazos-linha span:nth-child(5) {
          display: none;
        }
      }
    `}</style>
  );
}
