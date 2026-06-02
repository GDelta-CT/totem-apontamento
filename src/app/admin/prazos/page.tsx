'use client';

/**
 * /admin/prazos — Painel do Dono: saúde de prazos (Passo 3.5 da ordem A.1).
 *
 * O "holofote" (CLAUDE.md): KPIs grandes (ciclo médio, ticket, valor em
 * produção) + lista de carros ordenada por urgência de prazo (estourado →
 * perto → no prazo). É o quadro do Daily Huddle que faz o dono abrir ≥1x/dia.
 * Só leitura. Auto-refresh 30s.
 *
 * Padrão visual: tokens --gd-* + styled-jsx. Sem Tailwind no JSX.
 */

import { useCallback, useEffect, useState } from 'react';
import { AdminAuthGate } from '../AdminAuthGate';
import type { FetchState } from '@/lib/supabase/queries';
import {
  brl,
  carregarPainelDono,
  DIAS_ALERTA_PRAZO,
  type CarroPrazo,
  type PainelDono,
  type SaudePrazo,
} from '@/lib/supabase/dono-queries';

const REFRESH_MS = 30000;

export default function AdminPrazosPage() {
  return (
    <AdminAuthGate>
      <Prazos />
    </AdminAuthGate>
  );
}

/**
 * Mapa de situação → tokens de estado. `fill`/`ink` apontam para as variáveis
 * CSS de estado (uma cor = um significado). `cls` vira o modificador da pílula
 * e do dot na lista. Sem hex hardcoded.
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

function Prazos() {
  const [estado, setEstado] = useState<FetchState<PainelDono>>({ status: 'loading' });

  const carregar = useCallback(async () => {
    setEstado(await carregarPainelDono());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const buscar = async () => {
      const r = await carregarPainelDono();
      if (!cancelled) setEstado(r);
    };
    buscar();
    const id = setInterval(buscar, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="wrap">
      <header className="topbar">
        <a className="voltar" href="/admin">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Painel
        </a>
        <div className="tit">
          <strong>Saúde de prazos</strong>
          <span className="sub">
            <span className="gd-live-dot dot" aria-hidden="true" />O holofote do Daily Huddle · ao vivo
          </span>
        </div>
        <button className="btn-refresh" onClick={carregar} title="Atualizar" aria-label="Atualizar">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20 11a8 8 0 1 0-.6 3M20 5v6h-6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>

      {estado.status === 'loading' && <p className="info">Carregando prazos…</p>}
      {estado.status === 'error' && (
        <div className="info erro">
          {estado.message}{' '}
          <button className="link" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      )}
      {(estado.status === 'empty' || (estado.status === 'success' && estado.data.carros.length === 0)) && (
        <p className="info">Nenhum carro ativo no pátio.</p>
      )}

      {estado.status === 'success' && estado.data.carros.length > 0 && (
        <div className="board">
          <KPIs dados={estado.data} />
          <Lista carros={estado.data.carros} />
        </div>
      )}

      <Estilos />
    </main>
  );
}

function KPIs({ dados }: { dados: PainelDono }) {
  const k = dados.kpis;
  const calmo = k.estourado === 0;
  return (
    <>
      {/* HOLOFOTE — bloco-herói: risco de prazo domina a tela */}
      <section className="hero" aria-label="Risco de prazo">
        <article className={`herocard ${calmo ? 'calmo' : 'critico'}`}>
          <div className="herohead">
            <span className="heroico" aria-hidden="true">
              {calmo ? <IconCheck /> : <IconAlerta />}
            </span>
            <span className="herolbl">{calmo ? 'Prazos' : 'Estourados'}</span>
          </div>
          {calmo ? (
            <strong className="heromsg">Tudo no prazo.</strong>
          ) : (
            <span className="heronum gd-tabular">{k.estourado}</span>
          )}
          <span className="herofoot">
            {calmo
              ? `${k.totalAtivos} ${k.totalAtivos === 1 ? 'carro ativo' : 'carros ativos'}, nenhum estourou`
              : `${k.estourado === 1 ? 'carro passou' : 'carros passaram'} do prazo prometido`}
          </span>
        </article>

        <article className={`herocard ${k.perto > 0 ? 'atencao' : 'sereno'} sec`}>
          <div className="herohead">
            <span className="heroico" aria-hidden="true">
              <IconRelogio />
            </span>
            <span className="herolbl">Perto de estourar</span>
          </div>
          <span className="heronum gd-tabular">{k.perto}</span>
          <span className="herofoot">faltam ≤ {DIAS_ALERTA_PRAZO} dias para o prazo</span>
        </article>
      </section>

      {/* BANDA SECUNDÁRIA — mostradores com régua de benchmark (PPG/AkzoNobel) */}
      <section className="kpis" aria-label="Indicadores do pátio">
        <div className="kpi">
          <span className="kpi-lbl">Tempo de ciclo</span>
          <span className="kpi-num gd-tabular">
            {k.cicloMedioDias}
            <em className="un">dias</em>
          </span>
          <span className="kpi-bench">
            <span className="bench-bar" data-state={k.cicloMedioDias <= 7 ? 'ok' : 'warn'} aria-hidden="true">
              <i style={{ width: `${Math.min(100, (k.cicloMedioDias / 14) * 100)}%` }} />
            </span>
            meta · até 7 dias
          </span>
        </div>
        <div className="kpi">
          <span className="kpi-lbl">Ticket médio</span>
          <span className="kpi-num gd-tabular">{k.ticketMedio != null ? brl(k.ticketMedio) : '—'}</span>
          <span className="kpi-bench">média por carro com orçamento</span>
        </div>
        <div className="kpi">
          <span className="kpi-lbl">Valor em produção</span>
          <span className="kpi-num gd-tabular">{brl(k.valorEmProducao)}</span>
          <span className="kpi-bench">soma dos orçamentos no pátio</span>
        </div>
        <div className="kpi">
          <span className="kpi-lbl">Ocupação do pátio</span>
          <span className="kpi-num gd-tabular">
            {k.totalAtivos}
            <em className="un">{k.totalAtivos === 1 ? 'carro' : 'carros'}</em>
          </span>
          <span className="kpi-bench">ativos agora · meta 70–85%</span>
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
    <section className="lista" aria-label="Extrato de risco — carros por urgência">
      <div className="lista-cab">
        <span className="lh-tit">Extrato de risco</span>
        <span className="lh-sub">ordenado por urgência de prazo</span>
      </div>
      <div className="linha cabec" role="row">
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
          <div className="linha" key={c.id} role="row">
            <span className="placa gd-tabular">{c.placa}</span>
            <span className="modelo">{c.modelo}</span>
            <span className="dias gd-tabular">
              {c.diasNaOficina}
              <em className="un">d</em>
            </span>
            <span className={`prazo s-${meta.cls}`}>
              {prog != null ? (
                <>
                  <span className="barra" aria-hidden="true">
                    <i style={{ width: `${Math.round(prog * 100)}%` }} />
                  </span>
                  <span className="prazo-txt gd-tabular">
                    {c.data_prometida ? diaMes(c.data_prometida) : '—'}
                    {c.diasAtePrazo != null && (
                      <em className="ate">
                        {c.diasAtePrazo < 0 ? `${Math.abs(c.diasAtePrazo)}d atrás` : `em ${c.diasAtePrazo}d`}
                      </em>
                    )}
                  </span>
                </>
              ) : (
                <span className="prazo-txt gd-tabular">
                  {c.data_prometida ? c.data_prometida.slice(0, 10) : '—'}
                  {c.diasAtePrazo != null && (
                    <em className="ate">
                      {c.diasAtePrazo < 0 ? `${Math.abs(c.diasAtePrazo)}d atrás` : `em ${c.diasAtePrazo}d`}
                    </em>
                  )}
                </span>
              )}
            </span>
            <span className="valor gd-tabular">{c.valor_orcamento != null ? brl(c.valor_orcamento) : '—'}</span>
            <span>
              <em className={`pill s-${meta.cls}`}>
                <span className="pdot" aria-hidden="true" />
                {meta.txt}
              </em>
            </span>
          </div>
        );
      })}
    </section>
  );
}

function Estilos() {
  return (
    <style jsx global>{`
      .wrap {
        min-height: 100vh;
        background: var(--gd-app-bg, var(--gd-paper));
        color: var(--gd-ink);
        font-family: 'Inter', system-ui, sans-serif;
      }

      /* ===== Header: barra navy + filete teal (padrão das 3 telas) ===== */
      .topbar {
        display: flex;
        align-items: center;
        gap: var(--gd-sp-4);
        padding: var(--gd-sp-4) var(--gd-sp-6);
        background: var(--gd-navy);
        color: var(--gd-white);
        position: sticky;
        top: 0;
        z-index: 10;
        border-bottom: 2px solid var(--gd-teal);
      }
      .tit {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .tit strong {
        font-size: var(--gd-fs-h3);
        font-weight: 800;
        letter-spacing: -0.01em;
      }
      .tit .sub {
        display: flex;
        align-items: center;
        gap: var(--gd-sp-2);
        font-size: var(--gd-fs-micro);
        color: #bcd3e2;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .tit .dot {
        width: 7px;
        height: 7px;
        border-radius: var(--gd-r-pill);
        background: var(--gd-teal-bright);
        box-shadow: 0 0 0 3px rgba(28, 132, 173, 0.25);
      }
      .voltar {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: #cfe2ee;
        text-decoration: none;
        font-size: var(--gd-fs-cap);
        font-weight: 600;
        padding: 6px 4px;
        border-radius: var(--gd-r-control);
        transition: color var(--gd-dur-fast) var(--gd-ease);
      }
      .voltar svg {
        width: 16px;
        height: 16px;
      }
      .voltar:hover {
        color: var(--gd-white);
      }
      .btn-refresh {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.16);
        color: var(--gd-white);
        width: 38px;
        height: 38px;
        border-radius: var(--gd-r-control);
        cursor: pointer;
        transition:
          background var(--gd-dur-fast) var(--gd-ease),
          transform var(--gd-dur-fast) var(--gd-ease);
      }
      .btn-refresh svg {
        width: 18px;
        height: 18px;
      }
      .btn-refresh:hover {
        background: rgba(255, 255, 255, 0.22);
      }
      .btn-refresh:active {
        transform: rotate(-30deg);
      }

      .info {
        padding: var(--gd-sp-6);
        color: var(--gd-muted);
        font-size: var(--gd-fs-body);
      }
      .info.erro {
        color: var(--gd-bad-ink);
      }
      .link {
        background: none;
        border: none;
        color: var(--gd-teal-bright);
        cursor: pointer;
        font-weight: 700;
        font-size: inherit;
      }

      .board {
        max-width: 1180px;
        margin: 0 auto;
        padding: var(--gd-sp-6);
        display: flex;
        flex-direction: column;
        gap: var(--gd-sp-5);
      }

      /* ===== HOLOFOTE — bloco-herói ===== */
      .hero {
        display: grid;
        grid-template-columns: 1.6fr 1fr;
        gap: var(--gd-sp-4);
      }
      .herocard {
        background: var(--gd-white);
        border: 1px solid var(--gd-border);
        border-radius: var(--gd-r-panel);
        box-shadow:
          var(--gd-elev-1),
          var(--gd-hairline-top);
        padding: var(--gd-sp-6);
        display: flex;
        flex-direction: column;
        gap: var(--gd-sp-2);
        position: relative;
        overflow: hidden;
        transition:
          transform var(--gd-dur) var(--gd-ease),
          box-shadow var(--gd-dur) var(--gd-ease);
      }
      .herocard:hover {
        transform: translateY(-2px);
        box-shadow:
          var(--gd-elev-2),
          var(--gd-hairline-top);
      }
      /* Faixa de cor de estado fina à esquerda — foco vem do tamanho/posição, não de borda berrante */
      .herocard::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        background: var(--accent, transparent);
        opacity: 0.85;
      }
      .herocard.critico {
        --accent: var(--gd-bad-ink);
      }
      .herocard.calmo {
        --accent: var(--gd-ok-ink);
        background: linear-gradient(180deg, var(--gd-ok-fill) 0%, var(--gd-white) 46%);
      }
      .herocard.atencao {
        --accent: var(--gd-warn-ink);
      }
      .herocard.sereno {
        --accent: var(--gd-neutral-ink);
      }
      .herohead {
        display: flex;
        align-items: center;
        gap: var(--gd-sp-2);
        color: var(--accent, var(--gd-muted));
      }
      .heroico {
        display: inline-flex;
      }
      .heroico .ico {
        width: 22px;
        height: 22px;
      }
      .herolbl {
        font-size: var(--gd-fs-cap);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .heronum {
        font-size: var(--gd-fs-hero);
        font-weight: 900;
        line-height: 0.95;
        letter-spacing: -0.03em;
        color: var(--accent, var(--gd-navy));
      }
      .herocard.sereno .heronum {
        color: var(--gd-navy);
      }
      .heromsg {
        font-size: var(--gd-fs-kpi);
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.02em;
        color: var(--gd-ok-ink);
      }
      .herofoot {
        font-size: var(--gd-fs-cap);
        color: var(--gd-muted);
        line-height: 1.4;
      }
      .herocard.sec {
        justify-content: space-between;
      }

      /* ===== BANDA SECUNDÁRIA — mostradores + régua de benchmark ===== */
      .kpis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: var(--gd-sp-4);
      }
      .kpi {
        background: var(--gd-white);
        border: 1px solid var(--gd-border);
        border-radius: var(--gd-r-card);
        box-shadow:
          var(--gd-elev-1),
          var(--gd-hairline-top);
        padding: var(--gd-sp-5);
        display: flex;
        flex-direction: column;
        gap: var(--gd-sp-2);
        transition:
          transform var(--gd-dur) var(--gd-ease),
          box-shadow var(--gd-dur) var(--gd-ease);
      }
      .kpi:hover {
        transform: translateY(-2px);
        box-shadow:
          var(--gd-elev-2),
          var(--gd-hairline-top);
      }
      .kpi-lbl {
        font-size: var(--gd-fs-micro);
        color: var(--gd-muted);
        text-transform: uppercase;
        letter-spacing: 0.07em;
        font-weight: 600;
      }
      .kpi-num {
        font-size: var(--gd-fs-kpi);
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.02em;
        color: var(--gd-navy);
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .kpi-num .un {
        font-size: var(--gd-fs-cap);
        font-weight: 600;
        font-style: normal;
        color: var(--gd-muted);
        letter-spacing: 0;
      }
      .kpi-bench {
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-size: var(--gd-fs-micro);
        color: var(--gd-muted);
      }
      .bench-bar {
        position: relative;
        height: 4px;
        border-radius: var(--gd-r-pill);
        background: var(--gd-neutral-fill);
        overflow: hidden;
      }
      .bench-bar i {
        position: absolute;
        inset: 0 auto 0 0;
        border-radius: var(--gd-r-pill);
        background: var(--gd-ok-ink);
        transition: width var(--gd-dur-slow) var(--gd-ease);
      }
      .bench-bar[data-state='warn'] i {
        background: var(--gd-warn-ink);
      }

      /* ===== EXTRATO DE RISCO ===== */
      .lista {
        background: var(--gd-white);
        border: 1px solid var(--gd-border);
        border-radius: var(--gd-r-panel);
        box-shadow:
          var(--gd-elev-1),
          var(--gd-hairline-top);
        overflow: hidden;
      }
      .lista-cab {
        display: flex;
        align-items: baseline;
        gap: var(--gd-sp-3);
        padding: var(--gd-sp-5) var(--gd-sp-5) var(--gd-sp-3);
      }
      .lh-tit {
        font-size: var(--gd-fs-h3);
        font-weight: 800;
        color: var(--gd-ink);
        letter-spacing: -0.01em;
      }
      .lh-sub {
        font-size: var(--gd-fs-cap);
        color: var(--gd-muted);
      }
      .linha {
        display: grid;
        grid-template-columns: 96px 1.2fr 78px 1.5fr 118px 116px;
        gap: var(--gd-sp-3);
        align-items: center;
        padding: var(--gd-sp-3) var(--gd-sp-5);
        border-top: 1px solid var(--gd-border);
        font-size: var(--gd-fs-body);
      }
      .linha.cabec {
        border-top: none;
        background: transparent;
        font-weight: 700;
        font-size: var(--gd-fs-micro);
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: var(--gd-muted);
        padding-top: 0;
        padding-bottom: var(--gd-sp-2);
      }
      .linha:not(.cabec):hover {
        background: rgba(11, 56, 87, 0.025);
      }
      .placa {
        font-weight: 700;
        letter-spacing: 0.06em;
        color: var(--gd-ink);
      }
      .modelo {
        color: var(--gd-ink);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dias .un,
      .kpi-num .un {
        margin-left: 1px;
      }
      .dias {
        color: var(--gd-ink);
      }
      .dias .un {
        font-size: var(--gd-fs-micro);
        font-style: normal;
        color: var(--gd-muted);
      }
      .valor {
        color: var(--gd-ink);
        font-weight: 600;
      }

      /* mini-barra de prazo */
      .prazo {
        display: flex;
        flex-direction: column;
        gap: 5px;
        --accent: var(--gd-neutral-ink);
        --accent-fill: var(--gd-neutral-fill);
      }
      .prazo.s-bad {
        --accent: var(--gd-bad-ink);
        --accent-fill: var(--gd-bad-fill);
      }
      .prazo.s-warn {
        --accent: var(--gd-warn-ink);
        --accent-fill: var(--gd-warn-fill);
      }
      .prazo.s-ok {
        --accent: var(--gd-ok-ink);
        --accent-fill: var(--gd-ok-fill);
      }
      .prazo .barra {
        position: relative;
        height: 6px;
        border-radius: var(--gd-r-pill);
        background: var(--accent-fill);
        overflow: hidden;
      }
      .prazo .barra i {
        position: absolute;
        inset: 0 auto 0 0;
        border-radius: var(--gd-r-pill);
        background: var(--accent);
        transition: width var(--gd-dur-slow) var(--gd-ease);
      }
      .prazo-txt {
        font-size: var(--gd-fs-cap);
        color: var(--gd-muted);
      }
      .ate {
        font-style: normal;
        font-weight: 700;
        color: var(--accent);
        margin-left: 6px;
      }

      /* pílula-cápsula com dot */
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-style: normal;
        font-size: var(--gd-fs-cap);
        padding: 4px 11px 4px 9px;
        border-radius: var(--gd-r-pill);
        font-weight: 700;
        background: var(--p-fill, var(--gd-neutral-fill));
        color: var(--p-ink, var(--gd-neutral-ink));
      }
      .pill .pdot {
        width: 7px;
        height: 7px;
        border-radius: var(--gd-r-pill);
        background: currentColor;
      }
      .pill.s-bad {
        --p-fill: var(--gd-bad-fill);
        --p-ink: var(--gd-bad-ink);
      }
      .pill.s-warn {
        --p-fill: var(--gd-warn-fill);
        --p-ink: var(--gd-warn-ink);
      }
      .pill.s-ok {
        --p-fill: var(--gd-ok-fill);
        --p-ink: var(--gd-ok-ink);
      }
      .pill.s-neutral {
        --p-fill: var(--gd-neutral-fill);
        --p-ink: var(--gd-neutral-ink);
      }

      @media (max-width: 760px) {
        .hero {
          grid-template-columns: 1fr;
        }
        .linha {
          grid-template-columns: 84px 1fr auto;
          gap: var(--gd-sp-2);
        }
        /* mantém Placa, Modelo e Situação; oculta Dias/Prazo/Valor */
        .linha span:nth-child(3),
        .linha span:nth-child(4),
        .linha span:nth-child(5) {
          display: none;
        }
      }
    `}</style>
  );
}
