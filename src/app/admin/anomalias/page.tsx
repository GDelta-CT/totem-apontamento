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
  listarAnomalias,
  registrarCorrecao,
  TETO_FANTASMA_MS,
  type Anomalia,
  type MotivoCodigo,
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
  const [corrigindoId, setCorrigindoId] = useState<string | null>(null);
  const [motivoTxt, setMotivoTxt] = useState('');
  const [motivoCod, setMotivoCod] = useState<MotivoCodigo>('esqueceu_parar');
  const [salvando, setSalvando] = useState(false);
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

  const abrirCorrecao = (a: Anomalia) => {
    setErro(null);
    setOkMsg(null);
    setMotivoTxt('');
    setMotivoCod('esqueceu_parar');
    setCorrigindoId(a.id);
  };

  const cancelarCorrecao = () => {
    setCorrigindoId(null);
    setMotivoTxt('');
  };

  const confirmarCorrecao = async (a: Anomalia) => {
    if (!motivoTxt.trim()) return;
    setErro(null);
    setOkMsg(null);
    setSalvando(true);
    const r = await registrarCorrecao({
      apontamentoId: a.id,
      acao: 'ajustar_fim',
      motivo: motivoTxt,
      motivoCodigo: motivoCod,
    });
    setSalvando(false);
    if (r.status === 'error') {
      setErro(r.message);
      return;
    }
    setCorrigindoId(null);
    setMotivoTxt('');
    setOkMsg(`Correção registrada para ${a.nome_funcionario}. O tempo original foi preservado.`);
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
              <div className="item" key={a.id}>
                <div className="linha">
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
                    onClick={() => abrirCorrecao(a)}
                    disabled={corrigindoId === a.id}
                  >
                    Corrigir
                  </button>
                </div>

                {corrigindoId === a.id && (
                  <div className="correcao">
                    <label className="campo">
                      <span>Motivo (obrigatório)</span>
                      <textarea
                        className="motivo-txt"
                        value={motivoTxt}
                        onChange={(e) => setMotivoTxt(e.target.value)}
                        placeholder="Ex.: operário esqueceu de finalizar ao sair."
                        rows={2}
                        autoFocus
                      />
                    </label>
                    <label className="campo">
                      <span>Tipo</span>
                      <select
                        className="motivo-cod"
                        value={motivoCod}
                        onChange={(e) => setMotivoCod(e.target.value as MotivoCodigo)}
                      >
                        <option value="esqueceu_parar">Esqueceu de parar</option>
                        <option value="saiu_sem_registrar">Saiu sem registrar</option>
                        <option value="erro_toque">Erro de toque</option>
                        <option value="outro">Outro</option>
                      </select>
                    </label>
                    <div className="correcao-acoes">
                      <button
                        className="btn btn-fechar"
                        onClick={() => confirmarCorrecao(a)}
                        disabled={salvando || !motivoTxt.trim()}
                      >
                        {salvando ? 'Registrando…' : 'Registrar correção'}
                      </button>
                      <button className="btn btn-ghost" onClick={cancelarCorrecao} disabled={salvando}>
                        Cancelar
                      </button>
                    </div>
                    <p className="correcao-nota">
                      O tempo original é preservado. Fica registrado quem corrigiu, quando e por quê.
                    </p>
                  </div>
                )}
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
      .item {
        border-bottom: 1px solid var(--gd-line, #d7dde2);
      }
      .item:last-child {
        border-bottom: none;
      }
      .item .linha {
        border-bottom: none;
      }
      .correcao {
        padding: 0 16px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        background: #fafbfc;
      }
      .campo {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 13px;
        color: var(--gd-muted, #5d7689);
      }
      .motivo-txt,
      .motivo-cod {
        font-family: inherit;
        font-size: 14px;
        color: var(--gd-ink, #0b2233);
        border: 1px solid var(--gd-line, #d7dde2);
        border-radius: 8px;
        padding: 8px 10px;
        background: #fff;
        resize: vertical;
      }
      .correcao-acoes {
        display: flex;
        gap: 8px;
        margin-top: 2px;
      }
      .btn-ghost {
        background: transparent;
        color: var(--gd-muted, #5d7689);
        border: 1px solid var(--gd-line, #d7dde2);
      }
      .correcao-nota {
        font-size: 12px;
        color: var(--gd-muted, #5d7689);
        margin: 0;
      }
    `}</style>
  );
}
