'use client';

/**
 * /admin/producao — Visão Operacional AO VIVO (Passo 3 da ordem A.1).
 *
 * O "quadro do Daily Huddle": responde "todo mundo produzindo agora?" (faixa dos
 * 3 estados do operário) e "que carro está travado/lento?" (kanban por etapa +
 * marca de bloqueio). Auto-atualiza a cada 20s. Só leitura.
 *
 * Padrão visual: tokens --gd-* + styled-jsx (mesmo do totem). Sem Tailwind no JSX.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminAuthGate } from '../AdminAuthGate';
import type { FetchState } from '@/lib/supabase/queries';
import {
  carregarVisaoLive,
  ESTADO_LABEL,
  type CarroLive,
  type EstadoOperario,
  type VisaoLive,
} from '@/lib/supabase/live-queries';

const REFRESH_MS = 20000;

export default function AdminProducaoPage() {
  return (
    <AdminAuthGate>
      <Producao />
    </AdminAuthGate>
  );
}

function Producao() {
  const [estado, setEstado] = useState<FetchState<VisaoLive>>({ status: 'loading' });
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recarrega sob demanda (botão atualizar). Não dispara setState no corpo do effect.
  const carregar = useCallback(async () => {
    const r = await carregarVisaoLive();
    setEstado(r);
    if (r.status === 'success') setUltimaAtualizacao(new Date());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const buscar = async () => {
      const r = await carregarVisaoLive();
      if (cancelled) return;
      setEstado(r);
      if (r.status === 'success') setUltimaAtualizacao(new Date());
    };
    buscar();
    timer.current = setInterval(buscar, REFRESH_MS);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  return (
    <main className="wrap">
      <header className="topbar">
        <a className="voltar" href="/admin">
          <IconArrow />
          Painel
        </a>
        <div className="topbar-title">
          <strong>Produção ao vivo</strong>
          <span className="selo-live" aria-label="Atualizando ao vivo">
            <span className="selo-dot gd-live-dot" />
            <span className="selo-lbl">AO VIVO</span>
            <span className="selo-sep" />
            <span className="selo-time gd-tabular">
              {ultimaAtualizacao
                ? ultimaAtualizacao.toLocaleTimeString('pt-BR')
                : '—'}
            </span>
          </span>
        </div>
        <button className="btn-refresh" onClick={carregar} title="Atualizar agora" aria-label="Atualizar agora">
          <IconRefresh />
        </button>
      </header>

      {estado.status === 'loading' && <p className="info">Carregando o pátio…</p>}
      {estado.status === 'error' && (
        <div className="info erro">
          {estado.message}{' '}
          <button className="link" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      )}

      {estado.status === 'success' && (
        <>
          <ResumoEstados visao={estado.data} />
          <FaixaOperarios visao={estado.data} />
          <Kanban visao={estado.data} />
        </>
      )}

      <Estilos />
    </main>
  );
}

/* ─── Ícones SVG inline (stroke currentColor 1.5px) ─── */
function IconArrow() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ResumoEstados({ visao }: { visao: VisaoLive }) {
  const r = visao.resumo;
  // "Produzindo" é o KPI-herói: vira fração produzindo/total-da-equipe-hoje,
  // com a régua de benchmark de Ocupação. Total = quem teve apontamento hoje.
  const totalEquipe = visao.operarios.length;
  const cards: {
    key: string;
    label: string;
    valor: number;
    de?: number;
    tone: 'ok' | 'warn' | 'info' | 'navy' | 'bad';
    nota?: string;
  }[] = [
    {
      key: 'produzindo',
      label: 'Produzindo',
      valor: r.produzindo,
      de: totalEquipe || undefined,
      tone: 'ok',
      nota: 'Ocupação 70–85% ideal',
    },
    { key: 'em_pausa', label: 'Em pausa', valor: r.em_pausa, tone: 'warn' },
    { key: 'sem_tarefa', label: 'Sem tarefa ativa', valor: r.sem_tarefa, tone: 'info' },
    { key: 'ativos', label: 'Carros ativos', valor: r.carrosAtivos, tone: 'navy', nota: 'Pátio em produção' },
    { key: 'bloqueados', label: 'Bloqueados', valor: r.carrosBloqueados, tone: 'bad' },
  ];
  return (
    <section className="resumo">
      {cards.map((c) => (
        <div className={'kpi tone-' + c.tone} key={c.key}>
          <span className="kpi-num gd-tabular">
            {c.valor}
            {c.de != null && <span className="kpi-de gd-tabular">/{c.de}</span>}
          </span>
          <span className="kpi-lbl">{c.label}</span>
          {c.nota && <span className="kpi-nota">{c.nota}</span>}
        </div>
      ))}
    </section>
  );
}

function FaixaOperarios({ visao }: { visao: VisaoLive }) {
  const ordem: EstadoOperario[] = ['produzindo', 'em_pausa', 'sem_tarefa'];
  const ops = [...visao.operarios].sort(
    (a, b) => ordem.indexOf(a.estado) - ordem.indexOf(b.estado)
  );
  return (
    <section className="faixa">
      <div className="faixa-head">
        <h2 className="sec-titulo">Equipe agora</h2>
        <span className="faixa-hint">todo mundo produzindo?</span>
      </div>
      {ops.length === 0 ? (
        <p className="faixa-vazia">Ninguém apontou ainda hoje.</p>
      ) : (
      <div className="op-grid">
        {ops.map((o, i) => {
          const meta = ESTADO_LABEL[o.estado];
          // divisor sutil quando o grupo de estado muda (produzindo → pausa → sem tarefa)
          const novoGrupo = i > 0 && ops[i - 1].estado !== o.estado;
          return (
            <div className="op-cell" key={o.nome}>
              {novoGrupo && <span className="op-divisor" aria-hidden="true" />}
              <div className={'op-card estado-' + o.estado}>
                <span
                  className={'op-dot' + (o.estado === 'produzindo' ? ' gd-live-dot' : '')}
                />
                <div className="op-info">
                  <strong>{o.nome}</strong>
                  <span className="op-estado">
                    {meta.texto}
                    {o.estado === 'em_pausa' && o.motivoPausa ? ` · ${o.motivoPausa}` : ''}
                  </span>
                  {o.placaAtual && (
                    <span className="op-carro gd-tabular">
                      {o.placaAtual}
                      {o.etapaAtual ? ` · ${o.etapaAtual}` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </section>
  );
}

function Kanban({ visao }: { visao: VisaoLive }) {
  const comCarros = visao.colunas.filter((c) => c.carros.length > 0);
  const semNenhum = visao.carros.length === 0;
  return (
    <section className="kanban-sec">
      <h2 className="sec-titulo">Pátio por etapa</h2>
      {semNenhum && <p className="info">Nenhum carro ativo no pátio.</p>}
      <div className="kanban">
        {comCarros.map((col) => (
          <div className="coluna" key={col.etapa}>
            <header className="col-head">
              <span className="col-nome">{col.nome}</span>
              <span className="col-count gd-tabular">{col.carros.length}</span>
            </header>
            <div className="col-trilha">
              {col.carros.length > 0 ? (
                col.carros.map((carro) => <CardCarro key={carro.id} carro={carro} />)
              ) : (
                <p className="col-vazia">— sem carros nesta etapa</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* carros ativos sem etapa definida ainda */}
      <SemEtapa carros={visao.carros.filter((c) => !c.etapa_atual)} />
    </section>
  );
}

function SemEtapa({ carros }: { carros: CarroLive[] }) {
  if (carros.length === 0) return null;
  return (
    <div className="sem-etapa">
      <h3 className="sec-titulo">
        Sem etapa iniciada <span className="col-count gd-tabular">{carros.length}</span>
      </h3>
      <div className="sem-etapa-grid">
        {carros.map((c) => (
          <CardCarro key={c.id} carro={c} />
        ))}
      </div>
    </div>
  );
}

function CardCarro({ carro }: { carro: CarroLive }) {
  // Assinatura: borda-esquerda 4px na cor de estado do carro (via token, sem hex cru).
  const atrasada =
    carro.data_prometida && new Date(carro.data_prometida) < new Date() ? true : false;
  return (
    <div className={'card sit-' + carro.situacao}>
      <div className="card-top">
        <strong className="card-placa gd-tabular">{carro.placa}</strong>
        {carro.bloqueado && (
          <span className="tag bloq">
            <IconLock />
            bloqueado
          </span>
        )}
        {atrasada && <span className="tag atraso">atrasado</span>}
      </div>
      <span className="card-modelo">{carro.modelo_veiculo}</span>
      {carro.bloqueado && carro.motivo_bloqueio && (
        <span className="card-motivo">
          <IconLock />
          {carro.motivo_bloqueio}
        </span>
      )}
      {carro.ativos.length > 0 ? (
        <div className="card-ativos">
          {carro.ativos.map((a) => (
            <span
              key={a.id}
              className={'mini ' + (a.status_tarefa === 'Pausado' ? 'mini-pausa' : 'mini-trab')}
            >
              <span
                className={
                  'mini-dot' + (a.status_tarefa === 'Pausado' ? '' : ' gd-live-dot')
                }
              />
              {a.nome_funcionario}
              {a.status_tarefa === 'Pausado' ? ' (pausa)' : ''}
            </span>
          ))}
        </div>
      ) : (
        <span className="card-vazio">aguardando próxima etapa</span>
      )}
      {carro.data_prometida && (
        <span className={'card-prazo gd-tabular' + (atrasada ? ' atraso' : '')}>
          prazo: {carro.data_prometida.slice(0, 10)}
        </span>
      )}
    </div>
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

      /* ─── Header navy + filete teal ─── */
      .topbar {
        display: flex;
        align-items: center;
        gap: var(--gd-sp-4);
        padding: var(--gd-sp-3) var(--gd-sp-5);
        background: var(--gd-navy);
        color: var(--gd-white);
        position: sticky;
        top: 0;
        z-index: 10;
        border-bottom: 2px solid var(--gd-teal);
        box-shadow: var(--gd-elev-2);
      }
      .topbar-title {
        flex: 1;
        display: flex;
        align-items: center;
        gap: var(--gd-sp-4);
        min-width: 0;
      }
      .topbar-title strong {
        font-size: var(--gd-fs-h3);
        font-weight: 800;
        letter-spacing: -0.01em;
      }
      .voltar {
        display: inline-flex;
        align-items: center;
        gap: var(--gd-sp-1);
        color: #cfe2ee;
        text-decoration: none;
        font-size: var(--gd-fs-cap);
        font-weight: 600;
        padding: var(--gd-sp-1) var(--gd-sp-2);
        border-radius: var(--gd-r-control);
        transition: background var(--gd-dur-fast) var(--gd-ease);
      }
      .voltar:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      /* Selo AO VIVO — "isto respira" */
      .selo-live {
        display: inline-flex;
        align-items: center;
        gap: var(--gd-sp-2);
        padding: 4px 10px 4px 8px;
        border-radius: var(--gd-r-pill);
        background: rgba(28, 132, 173, 0.18);
        border: 1px solid rgba(28, 132, 173, 0.4);
      }
      .selo-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--gd-teal-bright);
        box-shadow: 0 0 0 3px rgba(28, 132, 173, 0.25);
        flex-shrink: 0;
      }
      .selo-lbl {
        font-size: var(--gd-fs-micro);
        font-weight: 800;
        letter-spacing: 0.12em;
        color: #d6ecf6;
      }
      .selo-sep {
        width: 1px;
        height: 11px;
        background: rgba(255, 255, 255, 0.28);
      }
      .selo-time {
        font-size: var(--gd-fs-micro);
        font-weight: 600;
        color: #9fc1d6;
        letter-spacing: 0.02em;
      }

      .btn-refresh {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.18);
        color: var(--gd-white);
        width: 36px;
        height: 36px;
        border-radius: var(--gd-r-control);
        cursor: pointer;
        flex-shrink: 0;
        transition:
          background var(--gd-dur-fast) var(--gd-ease),
          transform var(--gd-dur-fast) var(--gd-ease);
      }
      .btn-refresh:hover {
        background: rgba(255, 255, 255, 0.22);
      }
      .btn-refresh:active {
        transform: scale(0.94);
      }

      .info {
        padding: var(--gd-sp-5);
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

      /* ─── KPIs de resumo (benchmark) ─── */
      .resumo {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--gd-sp-3);
        padding: var(--gd-sp-5) var(--gd-sp-5) 0;
      }
      .kpi {
        position: relative;
        background: var(--gd-white);
        border: 1px solid var(--gd-border);
        border-top: 3px solid var(--gd-border-strong);
        border-radius: var(--gd-r-card);
        padding: var(--gd-sp-4);
        display: flex;
        flex-direction: column;
        gap: 3px;
        box-shadow: var(--gd-elev-1), var(--gd-hairline-top);
      }
      .kpi-num {
        font-size: var(--gd-fs-kpi);
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.02em;
        display: inline-flex;
        align-items: baseline;
      }
      .kpi-de {
        font-size: 0.5em;
        font-weight: 700;
        color: var(--gd-muted);
        margin-left: 2px;
      }
      .kpi-lbl {
        font-size: var(--gd-fs-micro);
        color: var(--gd-muted);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 600;
      }
      .kpi-nota {
        font-size: var(--gd-fs-micro);
        color: var(--gd-muted);
        margin-top: 1px;
      }
      .kpi.tone-ok {
        border-top-color: var(--gd-ok-ink);
      }
      .kpi.tone-ok .kpi-num {
        color: var(--gd-ok-ink);
      }
      .kpi.tone-warn {
        border-top-color: var(--gd-warn-ink);
      }
      .kpi.tone-warn .kpi-num {
        color: var(--gd-warn-ink);
      }
      .kpi.tone-info {
        border-top-color: var(--gd-info-ink);
      }
      .kpi.tone-info .kpi-num {
        color: var(--gd-info-ink);
      }
      .kpi.tone-bad {
        border-top-color: var(--gd-bad-ink);
      }
      .kpi.tone-bad .kpi-num {
        color: var(--gd-bad-ink);
      }
      .kpi.tone-navy {
        border-top-color: var(--gd-navy);
      }
      .kpi.tone-navy .kpi-num {
        color: var(--gd-navy);
      }

      /* ─── Títulos de seção ─── */
      .sec-titulo {
        font-size: var(--gd-fs-cap);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--gd-muted);
        font-weight: 700;
        margin: var(--gd-sp-6) var(--gd-sp-5) var(--gd-sp-3);
      }

      /* ─── Faixa "Equipe agora" — instrumento primário ─── */
      .faixa-head {
        display: flex;
        align-items: baseline;
        gap: var(--gd-sp-3);
        margin: var(--gd-sp-6) var(--gd-sp-5) var(--gd-sp-3);
      }
      .faixa-head .sec-titulo {
        margin: 0;
      }
      .faixa-vazia {
        margin: 0 var(--gd-sp-5) var(--gd-sp-3);
        padding: var(--gd-sp-5);
        color: var(--gd-muted);
        font-size: var(--gd-fs-body);
        border: 1px dashed var(--gd-border);
        border-radius: var(--gd-r-card);
        background: var(--gd-white);
      }
      .faixa-hint {
        font-size: var(--gd-fs-micro);
        color: var(--gd-muted);
        font-style: italic;
      }
      .op-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: var(--gd-sp-2);
        padding: 0 var(--gd-sp-5);
      }
      .op-cell {
        position: relative;
      }
      .op-divisor {
        position: absolute;
        left: calc(var(--gd-sp-2) * -1 + 0.5px);
        top: 6px;
        bottom: 6px;
        width: 1px;
        background: var(--gd-border-strong);
      }
      .op-card {
        display: flex;
        gap: var(--gd-sp-2);
        align-items: flex-start;
        background: var(--gd-white);
        border: 1px solid var(--gd-border);
        border-radius: var(--gd-r-control);
        padding: var(--gd-sp-3) var(--gd-sp-3);
        box-shadow: var(--gd-elev-1), var(--gd-hairline-top);
      }
      .op-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-top: 4px;
        flex-shrink: 0;
        background: var(--gd-neutral-ink);
      }
      .op-card.estado-produzindo .op-dot {
        background: var(--gd-ok-ink);
        box-shadow: 0 0 0 3px var(--gd-ok-fill);
      }
      .op-card.estado-em_pausa .op-dot {
        background: var(--gd-warn-ink);
      }
      .op-card.estado-sem_tarefa .op-dot {
        background: var(--gd-info-ink);
        opacity: 0.7;
      }
      .op-info {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }
      .op-info strong {
        font-size: var(--gd-fs-body);
        font-weight: 700;
      }
      .op-estado {
        font-size: var(--gd-fs-micro);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .op-card.estado-produzindo .op-estado {
        color: var(--gd-ok-ink);
      }
      .op-card.estado-em_pausa .op-estado {
        color: var(--gd-warn-ink);
      }
      .op-card.estado-sem_tarefa .op-estado {
        color: var(--gd-info-ink);
      }
      .op-carro {
        font-size: var(--gd-fs-micro);
        color: var(--gd-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* ─── Kanban premium — cards flutuando sobre colunas-fantasma ─── */
      .kanban-sec {
        padding-bottom: var(--gd-sp-7);
      }
      .kanban {
        display: flex;
        gap: var(--gd-sp-3);
        overflow-x: auto;
        padding: 0 var(--gd-sp-5) var(--gd-sp-2);
      }
      .coluna {
        flex: 0 0 248px;
        display: flex;
        flex-direction: column;
        background: transparent;
      }
      .col-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--gd-sp-2);
        padding: var(--gd-sp-2) var(--gd-sp-2) var(--gd-sp-2) 2px;
      }
      .col-nome {
        font-weight: 700;
        font-size: var(--gd-fs-cap);
        color: var(--gd-navy);
        letter-spacing: 0.01em;
      }
      .col-count {
        background: var(--gd-navy);
        color: var(--gd-white);
        border-radius: var(--gd-r-pill);
        min-width: 22px;
        text-align: center;
        padding: 2px 8px;
        font-size: var(--gd-fs-micro);
        font-weight: 700;
      }
      .col-trilha {
        display: flex;
        flex-direction: column;
        gap: var(--gd-sp-2);
        padding: var(--gd-sp-2);
        border-radius: var(--gd-r-card);
        border: 1px dashed var(--gd-border-strong);
        background: rgba(11, 56, 87, 0.012);
        min-height: 72px;
        flex: 1;
      }
      .col-vazia {
        font-size: var(--gd-fs-micro);
        color: var(--gd-muted);
        font-style: italic;
        padding: var(--gd-sp-3) var(--gd-sp-2);
        text-align: center;
      }

      /* ─── Card de OS — branco flutuante, assinatura de borda-esquerda ─── */
      .card {
        background: var(--gd-white);
        border: 1px solid var(--gd-border);
        border-left: 4px solid var(--gd-neutral-ink);
        border-radius: var(--gd-r-control);
        padding: var(--gd-sp-3) var(--gd-sp-3);
        display: flex;
        flex-direction: column;
        gap: var(--gd-sp-1);
        box-shadow: var(--gd-elev-1), var(--gd-hairline-top);
        transition:
          transform var(--gd-dur) var(--gd-ease),
          box-shadow var(--gd-dur) var(--gd-ease);
      }
      .card:hover {
        transform: translateY(-2px);
        box-shadow: var(--gd-elev-2), var(--gd-hairline-top);
      }
      .card.sit-trabalhando {
        border-left-color: var(--gd-ok-ink);
      }
      .card.sit-aguardando {
        border-left-color: var(--gd-warn-ink);
      }
      .card.sit-bloqueado {
        border-left-color: var(--gd-bad-ink);
      }
      .card-top {
        display: flex;
        align-items: center;
        gap: var(--gd-sp-2);
      }
      .card-placa {
        font-weight: 800;
        letter-spacing: 0.06em;
        flex: 1;
        font-size: var(--gd-fs-body);
        color: var(--gd-ink);
      }
      .tag {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: var(--gd-fs-micro);
        padding: 2px 7px;
        border-radius: var(--gd-r-pill);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        white-space: nowrap;
      }
      .tag.bloq {
        background: var(--gd-bad-fill);
        color: var(--gd-bad-ink);
      }
      .tag.atraso {
        background: var(--gd-warn-fill);
        color: var(--gd-warn-ink);
      }
      .card-modelo {
        font-size: var(--gd-fs-cap);
        color: var(--gd-ink);
      }
      .card-motivo {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--gd-fs-micro);
        color: var(--gd-bad-ink);
        font-weight: 600;
      }
      .card-ativos {
        display: flex;
        flex-wrap: wrap;
        gap: var(--gd-sp-1);
        margin-top: 2px;
      }
      .mini {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: var(--gd-fs-micro);
        padding: 2px 8px 2px 6px;
        border-radius: var(--gd-r-pill);
        font-weight: 600;
      }
      .mini-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
        background: currentColor;
      }
      .mini-trab {
        background: var(--gd-ok-fill);
        color: var(--gd-ok-ink);
      }
      .mini-pausa {
        background: var(--gd-warn-fill);
        color: var(--gd-warn-ink);
      }
      .card-vazio {
        font-size: var(--gd-fs-micro);
        color: var(--gd-muted);
        font-style: italic;
      }
      .card-prazo {
        font-size: var(--gd-fs-micro);
        color: var(--gd-muted);
        margin-top: 1px;
      }
      .card-prazo.atraso {
        color: var(--gd-bad-ink);
        font-weight: 700;
      }

      /* ─── Sem etapa iniciada ─── */
      .sem-etapa {
        padding: var(--gd-sp-2) var(--gd-sp-5) 0;
      }
      .sem-etapa .sec-titulo {
        display: inline-flex;
        align-items: center;
        gap: var(--gd-sp-2);
        margin: var(--gd-sp-3) 0 var(--gd-sp-3);
      }
      .sem-etapa-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: var(--gd-sp-2);
      }
    `}</style>
  );
}
