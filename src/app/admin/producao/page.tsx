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

  // Recarrega sob demanda (botão ↻). Não dispara setState no corpo do effect.
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
          ← Painel
        </a>
        <strong>Produção ao vivo</strong>
        <span className="atualizado">
          {ultimaAtualizacao
            ? `atualizado ${ultimaAtualizacao.toLocaleTimeString('pt-BR')}`
            : '…'}
        </span>
        <button className="btn-refresh" onClick={carregar} title="Atualizar agora">
          ↻
        </button>
      </header>

      {estado.status === 'loading' && <p className="info">Carregando o pátio…</p>}
      {estado.status === 'error' && (
        <div className="info erro">
          {estado.message} <button className="link" onClick={carregar}>Tentar de novo</button>
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

function ResumoEstados({ visao }: { visao: VisaoLive }) {
  const r = visao.resumo;
  const cards: { label: string; valor: number; cor: string }[] = [
    { label: 'Produzindo', valor: r.produzindo, cor: '#1b7a3d' },
    { label: 'Em pausa', valor: r.em_pausa, cor: '#b8860b' },
    { label: 'Sem tarefa ativa', valor: r.sem_tarefa, cor: '#13678d' },
    { label: 'Carros ativos', valor: r.carrosAtivos, cor: '#0b3857' },
    { label: 'Bloqueados', valor: r.carrosBloqueados, cor: '#b42323' },
  ];
  return (
    <section className="resumo">
      {cards.map((c) => (
        <div className="kpi" key={c.label} style={{ borderTopColor: c.cor }}>
          <span className="kpi-num" style={{ color: c.cor }}>
            {c.valor}
          </span>
          <span className="kpi-lbl">{c.label}</span>
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
  if (ops.length === 0) return null;
  return (
    <section className="faixa">
      <h2 className="sec-titulo">Equipe agora</h2>
      <div className="op-grid">
        {ops.map((o) => {
          const meta = ESTADO_LABEL[o.estado];
          return (
            <div className="op-card" key={o.nome}>
              <span className="op-dot" style={{ background: meta.cor }} />
              <div className="op-info">
                <strong>{o.nome}</strong>
                <span className="op-estado" style={{ color: meta.cor }}>
                  {meta.texto}
                  {o.estado === 'em_pausa' && o.motivoPausa ? ` · ${o.motivoPausa}` : ''}
                </span>
                {o.placaAtual && (
                  <span className="op-carro">
                    {o.placaAtual}
                    {o.etapaAtual ? ` · ${o.etapaAtual}` : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
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
              {col.nome} <span className="col-count">{col.carros.length}</span>
            </header>
            {col.carros.map((carro) => (
              <CardCarro key={carro.id} carro={carro} />
            ))}
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
      <h3>Sem etapa iniciada ({carros.length})</h3>
      <div className="sem-etapa-grid">
        {carros.map((c) => (
          <CardCarro key={c.id} carro={c} />
        ))}
      </div>
    </div>
  );
}

function CardCarro({ carro }: { carro: CarroLive }) {
  const cor =
    carro.situacao === 'bloqueado'
      ? '#b42323'
      : carro.situacao === 'trabalhando'
        ? '#1b7a3d'
        : '#b8860b';
  const atrasada =
    carro.data_prometida && new Date(carro.data_prometida) < new Date() ? true : false;
  return (
    <div className="card" style={{ borderLeftColor: cor }}>
      <div className="card-top">
        <strong className="card-placa">{carro.placa}</strong>
        {carro.bloqueado && <span className="tag bloq">bloqueado</span>}
        {atrasada && <span className="tag atraso">atrasado</span>}
      </div>
      <span className="card-modelo">{carro.modelo_veiculo}</span>
      {carro.bloqueado && carro.motivo_bloqueio && (
        <span className="card-motivo">⛔ {carro.motivo_bloqueio}</span>
      )}
      {carro.ativos.length > 0 ? (
        <div className="card-ativos">
          {carro.ativos.map((a) => (
            <span
              key={a.id}
              className={'mini ' + (a.status_tarefa === 'Pausado' ? 'mini-pausa' : 'mini-trab')}
            >
              {a.nome_funcionario}
              {a.status_tarefa === 'Pausado' ? ' (pausa)' : ''}
            </span>
          ))}
        </div>
      ) : (
        <span className="card-vazio">aguardando próxima etapa</span>
      )}
      {carro.data_prometida && (
        <span className={'card-prazo' + (atrasada ? ' atraso' : '')}>
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
        background: var(--gd-paper, #f5f4f2);
        color: var(--gd-ink, #0b2233);
        font-family: 'Inter', system-ui, sans-serif;
      }
      .topbar {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 24px;
        background: var(--gd-navy, #0b3857);
        color: #fff;
        position: sticky;
        top: 0;
        z-index: 10;
      }
      .topbar strong {
        flex: 1;
        font-size: 18px;
      }
      .voltar {
        color: #cfe2ee;
        text-decoration: none;
        font-size: 14px;
      }
      .atualizado {
        font-size: 12px;
        color: #9fc1d6;
      }
      .btn-refresh {
        background: rgba(255, 255, 255, 0.15);
        border: none;
        color: #fff;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
      }
      .info {
        padding: 24px;
        color: var(--gd-muted, #5d7689);
      }
      .info.erro {
        color: #b42323;
      }
      .link {
        background: none;
        border: none;
        color: var(--gd-teal-bright, #1c84ad);
        cursor: pointer;
        font-weight: 600;
      }
      .resumo {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
        padding: 20px 24px 4px;
      }
      .kpi {
        background: #fff;
        border: 1px solid var(--gd-line, #d7dde2);
        border-top: 3px solid #0b3857;
        border-radius: 12px;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .kpi-num {
        font-size: 28px;
        font-weight: 800;
        line-height: 1;
      }
      .kpi-lbl {
        font-size: 12px;
        color: var(--gd-muted, #5d7689);
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }
      .sec-titulo {
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--gd-muted, #5d7689);
        margin: 22px 24px 10px;
      }
      .op-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 10px;
        padding: 0 24px;
      }
      .op-card {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        background: #fff;
        border: 1px solid var(--gd-line, #d7dde2);
        border-radius: 10px;
        padding: 12px 14px;
      }
      .op-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-top: 5px;
        flex-shrink: 0;
      }
      .op-info {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }
      .op-info strong {
        font-size: 14px;
      }
      .op-estado {
        font-size: 12px;
        font-weight: 600;
      }
      .op-carro {
        font-size: 12px;
        color: var(--gd-muted, #5d7689);
      }
      .kanban-sec {
        padding-bottom: 40px;
      }
      .kanban {
        display: flex;
        gap: 14px;
        overflow-x: auto;
        padding: 0 24px 8px;
      }
      .coluna {
        flex: 0 0 240px;
        background: var(--gd-paper-2, #eceae6);
        border-radius: 12px;
        padding: 10px;
      }
      .col-head {
        font-weight: 700;
        font-size: 13px;
        padding: 4px 6px 10px;
        display: flex;
        justify-content: space-between;
        color: var(--gd-navy, #0b3857);
      }
      .col-count {
        background: var(--gd-navy, #0b3857);
        color: #fff;
        border-radius: 999px;
        padding: 0 8px;
        font-size: 12px;
      }
      .card {
        background: #fff;
        border: 1px solid var(--gd-line, #d7dde2);
        border-left: 4px solid #1b7a3d;
        border-radius: 10px;
        padding: 10px 12px;
        margin-bottom: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .card-top {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .card-placa {
        font-weight: 800;
        letter-spacing: 1px;
        flex: 1;
      }
      .tag {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 999px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .tag.bloq {
        background: #fdeaea;
        color: #b42323;
      }
      .tag.atraso {
        background: #fff0e0;
        color: #92600c;
      }
      .card-modelo {
        font-size: 13px;
        color: var(--gd-ink, #0b2233);
      }
      .card-motivo {
        font-size: 12px;
        color: #b42323;
      }
      .card-ativos {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 2px;
      }
      .mini {
        font-size: 11px;
        padding: 2px 7px;
        border-radius: 999px;
        font-weight: 600;
      }
      .mini-trab {
        background: #e6f6ec;
        color: #1b7a3d;
      }
      .mini-pausa {
        background: #fbf2da;
        color: #92600c;
      }
      .card-vazio {
        font-size: 12px;
        color: var(--gd-muted, #5d7689);
        font-style: italic;
      }
      .card-prazo {
        font-size: 11px;
        color: var(--gd-muted, #5d7689);
      }
      .card-prazo.atraso {
        color: #b42323;
        font-weight: 700;
      }
      .sem-etapa {
        padding: 8px 24px 0;
      }
      .sem-etapa h3 {
        font-size: 13px;
        color: var(--gd-muted, #5d7689);
        margin: 12px 0 8px;
      }
      .sem-etapa-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 8px;
      }
    `}</style>
  );
}
