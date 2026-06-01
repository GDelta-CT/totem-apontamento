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

const SAUDE_META: Record<SaudePrazo, { txt: string; cor: string }> = {
  estourado: { txt: 'Estourado', cor: '#b42323' },
  perto: { txt: 'Perto', cor: '#b8860b' },
  no_prazo: { txt: 'No prazo', cor: '#1b7a3d' },
  sem_prazo: { txt: 'Sem prazo', cor: '#8a94a0' },
};

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
          ← Painel
        </a>
        <strong>Saúde de prazos</strong>
        <button className="btn-refresh" onClick={carregar} title="Atualizar">
          ↻
        </button>
      </header>

      {estado.status === 'loading' && <p className="info">Carregando prazos…</p>}
      {estado.status === 'error' && (
        <div className="info erro">
          {estado.message} <button className="link" onClick={carregar}>Tentar de novo</button>
        </div>
      )}
      {(estado.status === 'empty' || (estado.status === 'success' && estado.data.carros.length === 0)) && (
        <p className="info">Nenhum carro ativo no pátio.</p>
      )}

      {estado.status === 'success' && estado.data.carros.length > 0 && (
        <>
          <KPIs dados={estado.data} />
          <Lista carros={estado.data.carros} />
        </>
      )}

      <Estilos />
    </main>
  );
}

function KPIs({ dados }: { dados: PainelDono }) {
  const k = dados.kpis;
  return (
    <section className="kpis">
      <div className="kpi destaque">
        <span className="kpi-num">{k.estourado}</span>
        <span className="kpi-lbl">Estourados</span>
      </div>
      <div className="kpi destaque amarelo">
        <span className="kpi-num">{k.perto}</span>
        <span className="kpi-lbl">Perto de estourar (≤{DIAS_ALERTA_PRAZO}d)</span>
      </div>
      <div className="kpi">
        <span className="kpi-num">{k.cicloMedioDias}</span>
        <span className="kpi-lbl">Dias na oficina (média)</span>
      </div>
      <div className="kpi">
        <span className="kpi-num">{k.ticketMedio != null ? brl(k.ticketMedio) : '—'}</span>
        <span className="kpi-lbl">Ticket médio</span>
      </div>
      <div className="kpi">
        <span className="kpi-num">{brl(k.valorEmProducao)}</span>
        <span className="kpi-lbl">Valor em produção</span>
      </div>
      <div className="kpi">
        <span className="kpi-num">{k.totalAtivos}</span>
        <span className="kpi-lbl">Carros ativos</span>
      </div>
    </section>
  );
}

function Lista({ carros }: { carros: CarroPrazo[] }) {
  return (
    <section className="lista">
      <div className="linha cabec">
        <span>Placa</span>
        <span>Modelo</span>
        <span>Dias aqui</span>
        <span>Prazo</span>
        <span>Valor</span>
        <span>Situação</span>
      </div>
      {carros.map((c) => {
        const meta = SAUDE_META[c.saude];
        return (
          <div className="linha" key={c.id}>
            <span className="placa">{c.placa}</span>
            <span>{c.modelo}</span>
            <span>{c.diasNaOficina}d</span>
            <span>
              {c.data_prometida ? c.data_prometida.slice(0, 10) : '—'}
              {c.diasAtePrazo != null && (
                <em className="ate" style={{ color: meta.cor }}>
                  {c.diasAtePrazo < 0
                    ? ` ${Math.abs(c.diasAtePrazo)}d atrás`
                    : ` em ${c.diasAtePrazo}d`}
                </em>
              )}
            </span>
            <span>{c.valor_orcamento != null ? brl(c.valor_orcamento) : '—'}</span>
            <span>
              <em className="pill" style={{ background: meta.cor + '22', color: meta.cor }}>
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
      .kpis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        padding: 22px 24px 6px;
      }
      .kpi {
        background: #fff;
        border: 1px solid var(--gd-line, #d7dde2);
        border-radius: 14px;
        padding: 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .kpi.destaque {
        border-top: 4px solid #b42323;
      }
      .kpi.destaque .kpi-num {
        color: #b42323;
      }
      .kpi.destaque.amarelo {
        border-top-color: #b8860b;
      }
      .kpi.destaque.amarelo .kpi-num {
        color: #b8860b;
      }
      .kpi-num {
        font-size: 26px;
        font-weight: 800;
        line-height: 1.1;
        color: var(--gd-navy, #0b3857);
      }
      .kpi-lbl {
        font-size: 12px;
        color: var(--gd-muted, #5d7689);
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }
      .lista {
        margin: 18px 24px 40px;
        background: #fff;
        border: 1px solid var(--gd-line, #d7dde2);
        border-radius: 14px;
        overflow: hidden;
      }
      .linha {
        display: grid;
        grid-template-columns: 90px 1.3fr 80px 1.2fr 110px 100px;
        gap: 10px;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid var(--gd-line, #d7dde2);
        font-size: 14px;
      }
      .linha:last-child {
        border-bottom: none;
      }
      .linha.cabec {
        background: var(--gd-paper-2, #eceae6);
        font-weight: 700;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--gd-muted, #5d7689);
      }
      .placa {
        font-weight: 800;
        letter-spacing: 1px;
      }
      .ate {
        font-style: normal;
        font-size: 12px;
        font-weight: 600;
      }
      .pill {
        font-style: normal;
        font-size: 12px;
        padding: 3px 10px;
        border-radius: 999px;
        font-weight: 700;
      }
      @media (max-width: 680px) {
        .linha {
          grid-template-columns: 80px 1fr 90px;
        }
        .linha span:nth-child(4),
        .linha span:nth-child(5),
        .linha span:nth-child(6) {
          display: none;
        }
      }
    `}</style>
  );
}
