'use client';

/**
 * /admin/anomalias — Correção de anomalias do admin (Passo 4 da ordem A.1).
 *
 * Lista apontamentos-fantasma (ativos além do teto de ~10,5h) e deixa o admin
 * fechá-los. A DETECÇÃO já funciona (leitura). A CORREÇÃO só grava após a
 * Migration 006 (grants) ser aplicada no teste — até lá mostra erro amigável.
 *
 * Padrão visual: tokens --gd-* + styled-jsx. Sem Tailwind no JSX.
 */

import { useCallback, useEffect, useState } from 'react';
import { AdminAuthGate } from '../AdminAuthGate';
import type { FetchState } from '@/lib/supabase/queries';
import {
  fecharApontamento,
  listarAnomalias,
  TETO_FANTASMA_MS,
  type Anomalia,
} from '@/lib/supabase/anomalias-queries';

export default function AdminAnomaliasPage() {
  return (
    <AdminAuthGate>
      <Anomalias />
    </AdminAuthGate>
  );
}

const tetoHoras = (TETO_FANTASMA_MS / (60 * 60 * 1000)).toFixed(1).replace('.', ',');

function Anomalias() {
  const [lista, setLista] = useState<FetchState<Anomalia[]>>({ status: 'loading' });
  const [fechandoId, setFechandoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setLista({ status: 'loading' });
    setLista(await listarAnomalias());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const buscar = async () => {
      const r = await listarAnomalias();
      if (!cancelled) setLista(r);
    };
    buscar();
    return () => {
      cancelled = true;
    };
  }, []);

  const fechar = async (a: Anomalia) => {
    setErro(null);
    setOkMsg(null);
    setFechandoId(a.id);
    const r = await fecharApontamento(a.id);
    setFechandoId(null);
    if (r.status === 'error') {
      setErro(r.message);
      return;
    }
    setOkMsg(`Apontamento de ${a.nome_funcionario} fechado.`);
    recarregar();
  };

  return (
    <main className="wrap">
      <header className="topbar">
        <a className="voltar" href="/admin">
          ← Painel
        </a>
        <strong>Anomalias de apontamento</strong>
        <button className="btn-refresh" onClick={recarregar} title="Atualizar">
          ↻
        </button>
      </header>

      <section className="conteudo">
        <p className="explica">
          Apontamentos ativos abertos há mais de <b>{tetoHoras}h</b> — provável esquecimento de
          fechar (apontamento-fantasma). Feche para corrigir o tempo trabalhado.
        </p>

        {okMsg && <div className="flash ok">{okMsg}</div>}
        {erro && <div className="flash erro">{erro}</div>}

        {lista.status === 'loading' && <p className="muted">Procurando anomalias…</p>}
        {lista.status === 'error' && (
          <div className="flash erro">
            {lista.message}{' '}
            <button className="link" onClick={recarregar}>
              Tentar de novo
            </button>
          </div>
        )}
        {lista.status === 'empty' && (
          <div className="vazio">
            <span className="vazio-ic">✅</span>
            Nenhuma anomalia. Todos os apontamentos ativos estão dentro do teto.
          </div>
        )}

        {lista.status === 'success' && (
          <div className="tabela">
            {lista.data.map((a) => (
              <div className="linha" key={a.id}>
                <div className="info">
                  <strong>{a.nome_funcionario}</strong>
                  <span className="sub">
                    {a.placa ?? '—'} · {a.etapa ?? 'sem etapa'} · {a.status_tarefa}
                  </span>
                </div>
                <span className="horas" title="Horas em aberto">
                  {a.horasDecorridas.toFixed(1).replace('.', ',')}h
                </span>
                <button
                  className="btn btn-fechar"
                  onClick={() => fechar(a)}
                  disabled={fechandoId === a.id}
                >
                  {fechandoId === a.id ? 'Fechando…' : 'Fechar agora'}
                </button>
              </div>
            ))}
          </div>
        )}
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
      .conteudo {
        max-width: 760px;
        margin: 0 auto;
        padding: 24px;
      }
      .explica {
        color: var(--gd-muted, #5d7689);
        font-size: 14px;
        margin-bottom: 16px;
      }
      .muted {
        color: var(--gd-muted, #5d7689);
      }
      .vazio {
        background: #fff;
        border: 1px solid var(--gd-line, #d7dde2);
        border-radius: 12px;
        padding: 32px;
        text-align: center;
        color: var(--gd-muted, #5d7689);
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: center;
      }
      .vazio-ic {
        font-size: 28px;
      }
      .tabela {
        background: #fff;
        border: 1px solid var(--gd-line, #d7dde2);
        border-radius: 14px;
        overflow: hidden;
      }
      .linha {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--gd-line, #d7dde2);
      }
      .linha:last-child {
        border-bottom: none;
      }
      .info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .info strong {
        font-size: 15px;
      }
      .sub {
        font-size: 13px;
        color: var(--gd-muted, #5d7689);
      }
      .horas {
        font-weight: 800;
        font-size: 16px;
        color: #b42323;
      }
      .btn {
        border: none;
        border-radius: 10px;
        padding: 10px 16px;
        font-weight: 700;
        cursor: pointer;
        font-size: 14px;
      }
      .btn-fechar {
        background: var(--gd-teal-bright, #1c84ad);
        color: #fff;
      }
      .btn-fechar:hover:not(:disabled) {
        background: var(--gd-teal-hover, #2596c4);
      }
      .btn:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .link {
        background: none;
        border: none;
        color: var(--gd-teal-bright, #1c84ad);
        cursor: pointer;
        font-weight: 600;
      }
      .flash {
        padding: 10px 14px;
        border-radius: 10px;
        margin-bottom: 14px;
        font-size: 14px;
      }
      .flash.ok {
        background: #e6f6ec;
        color: #1b7a3d;
      }
      .flash.erro {
        background: #fdeaea;
        color: #b42323;
      }
    `}</style>
  );
}
