'use client';

/**
 * /admin/os — Gestão de Ordens de Serviço (Passo 1 da ordem A.1).
 *
 * Demoável e essencial: listar OS, criar (com buscar-antes-de-criar + status
 * controlado) e editar. Padrão visual do app: tokens --gd-* + styled-jsx
 * (mesmo estilo do totem), sem Tailwind utilitário no JSX.
 *
 * Regras de negócio (CLAUDE.md):
 *  - Placa normalizada em MAIÚSCULAS; uma OS ATIVA por placa (aviso aqui + trava
 *    no banco via índice parcial da Migration 005).
 *  - Tipo de cliente sugere a data prometida (+30 seguradora/cooperativa, +15
 *    particular) — editável.
 *  - status_geral é lista fixa (4 valores).
 */

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AdminAuthGate } from '../AdminAuthGate';
import { ETAPAS } from '@/lib/supabase/client';
import type { EtapaId } from '@/lib/supabase/client';
import { normalizarPlaca, type FetchState } from '@/lib/supabase/queries';
import {
  atualizarOS,
  buscarOSAtivaPorPlaca,
  criarOS,
  listarOS,
  somarDias,
  STATUS_OS,
  TIPOS_CLIENTE,
  type OrdemServicoAdmin,
  type StatusOS,
  type TipoCliente,
} from '@/lib/supabase/admin-queries';

export default function AdminOSPage() {
  return (
    <AdminAuthGate>
      <OSManager />
    </AdminAuthGate>
  );
}

const hojeISO = () => new Date().toISOString().slice(0, 10);

type FormState = {
  id: string | null; // null = criando; preenchido = editando
  placa: string;
  modelo_veiculo: string;
  tipo_cliente: TipoCliente | '';
  data_entrada: string;
  data_prometida: string;
  valor_orcamento: string; // string no input; converte no submit
  etapa_atual: EtapaId | '';
  status_geral: StatusOS;
};

const formVazio = (): FormState => ({
  id: null,
  placa: '',
  modelo_veiculo: '',
  tipo_cliente: '',
  data_entrada: hojeISO(),
  data_prometida: '',
  valor_orcamento: '',
  etapa_atual: '',
  status_geral: 'Aguardando Produção',
});

function OSManager() {
  const [lista, setLista] = useState<FetchState<OrdemServicoAdmin[]>>({ status: 'loading' });
  const [form, setForm] = useState<FormState | null>(null); // null = form fechado
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [avisoPlaca, setAvisoPlaca] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    setLista({ status: 'loading' });
    setLista(await listarOS());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const buscar = async () => {
      const r = await listarOS();
      if (!cancelled) setLista(r);
    };
    buscar();
    return () => {
      cancelled = true;
    };
  }, []);

  const abrirNova = () => {
    setErroForm(null);
    setAvisoPlaca(null);
    setForm(formVazio());
  };

  const abrirEdicao = (os: OrdemServicoAdmin) => {
    setErroForm(null);
    setAvisoPlaca(null);
    setForm({
      id: os.id,
      placa: os.placa,
      modelo_veiculo: os.modelo_veiculo,
      tipo_cliente: os.tipo_cliente ?? '',
      data_entrada: (os.data_entrada ?? '').slice(0, 10) || hojeISO(),
      data_prometida: (os.data_prometida ?? '').slice(0, 10),
      valor_orcamento: os.valor_orcamento != null ? String(os.valor_orcamento) : '',
      etapa_atual: os.etapa_atual ?? '',
      status_geral: (os.status_geral as StatusOS) ?? 'Aguardando Produção',
    });
  };

  const fechar = () => {
    setForm(null);
    setErroForm(null);
    setAvisoPlaca(null);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  // Tipo de cliente sugere a data prometida (editável).
  const escolherTipo = (tipo: TipoCliente | '') => {
    setForm((f) => {
      if (!f) return f;
      const novo = { ...f, tipo_cliente: tipo };
      const t = TIPOS_CLIENTE.find((x) => x.id === tipo);
      if (t) novo.data_prometida = somarDias(f.data_entrada, t.prazoSugeridoDias);
      return novo;
    });
  };

  // Buscar-antes-de-criar: ao sair do campo placa (só ao CRIAR).
  const conferirPlaca = async () => {
    setAvisoPlaca(null);
    if (!form || form.id) return; // só no modo criação
    const placa = normalizarPlaca(form.placa);
    if (placa.length < 7) return;
    const r = await buscarOSAtivaPorPlaca(placa);
    if (r.status === 'success' && r.data) {
      setAvisoPlaca(
        `Já existe uma OS ATIVA para ${placa} (${r.data.modelo_veiculo} · ${r.data.status_geral}). ` +
          'Edite a existente em vez de criar outra.'
      );
    }
  };

  const submeter = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setErroForm(null);
    setOkMsg(null);
    setSalvando(true);

    const valor =
      form.valor_orcamento.trim() === ''
        ? null
        : Number(form.valor_orcamento.replace(',', '.'));
    if (valor != null && Number.isNaN(valor)) {
      setSalvando(false);
      setErroForm('Valor do orçamento inválido. Use só números (ex.: 4500.00).');
      return;
    }

    const r = form.id
      ? await atualizarOS(form.id, {
          modelo_veiculo: form.modelo_veiculo,
          tipo_cliente: form.tipo_cliente || null,
          data_entrada: form.data_entrada || null,
          data_prometida: form.data_prometida || null,
          valor_orcamento: valor,
          etapa_atual: form.etapa_atual || null,
          status_geral: form.status_geral,
        })
      : await criarOS({
          placa: form.placa,
          modelo_veiculo: form.modelo_veiculo,
          tipo_cliente: form.tipo_cliente || null,
          data_entrada: form.data_entrada || null,
          data_prometida: form.data_prometida || null,
          valor_orcamento: valor,
          etapa_atual: form.etapa_atual || null,
          status_geral: form.status_geral,
        });

    setSalvando(false);
    if (r.status === 'error') {
      setErroForm(r.message);
      return;
    }
    setOkMsg(form.id ? 'OS atualizada.' : 'OS criada.');
    fechar();
    recarregar();
  };

  return (
    <main className="wrap">
      <header className="topbar">
        <a className="voltar" href="/admin">
          ← Painel
        </a>
        <strong>Ordens de Serviço</strong>
        <button className="btn btn-primary" onClick={abrirNova}>
          + Nova OS
        </button>
      </header>

      <section className="conteudo">
        {okMsg && <div className="flash ok">{okMsg}</div>}

        {lista.status === 'loading' && <p className="muted">Carregando ordens…</p>}
        {lista.status === 'error' && (
          <div className="flash erro">
            {lista.message} <button className="link" onClick={recarregar}>Tentar de novo</button>
          </div>
        )}
        {lista.status === 'empty' && (
          <p className="muted">Nenhuma OS ainda. Clique em “+ Nova OS”.</p>
        )}

        {lista.status === 'success' && (
          <div className="tabela">
            <div className="linha cabec">
              <span>Placa</span>
              <span>Modelo</span>
              <span>Cliente</span>
              <span>Prometida</span>
              <span>Valor</span>
              <span>Status</span>
              <span></span>
            </div>
            {lista.data.map((os) => (
              <div className="linha" key={os.id}>
                <span className="placa">{os.placa}</span>
                <span>{os.modelo_veiculo}</span>
                <span className="cap">{os.tipo_cliente ?? '—'}</span>
                <span>{os.data_prometida?.slice(0, 10) ?? '—'}</span>
                <span>{os.valor_orcamento != null ? brl(os.valor_orcamento) : '—'}</span>
                <span>
                  <em className={'pill ' + (os.status_geral === 'Entregue' ? 'pill-done' : 'pill-active')}>
                    {os.status_geral ?? '—'}
                  </em>
                </span>
                <span>
                  <button className="link" onClick={() => abrirEdicao(os)}>
                    Editar
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {form && (
        <div className="overlay" onClick={fechar}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submeter}>
            <h2>{form.id ? 'Editar OS' : 'Nova OS'}</h2>

            <label>
              Placa
              <input
                value={form.placa}
                disabled={!!form.id}
                onChange={(e) => set('placa', normalizarPlaca(e.target.value))}
                onBlur={conferirPlaca}
                placeholder="ABC1D23"
                maxLength={7}
                required
              />
            </label>
            {avisoPlaca && <div className="flash aviso">{avisoPlaca}</div>}

            <label>
              Modelo
              <input
                value={form.modelo_veiculo}
                onChange={(e) => set('modelo_veiculo', e.target.value)}
                placeholder="Ex.: Gol 1.0"
                required
              />
            </label>

            <div className="dois">
              <label>
                Tipo de cliente
                <select
                  value={form.tipo_cliente}
                  onChange={(e) => escolherTipo(e.target.value as TipoCliente | '')}
                >
                  <option value="">—</option>
                  {TIPOS_CLIENTE.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Valor do orçamento (R$)
                <input
                  inputMode="decimal"
                  value={form.valor_orcamento}
                  onChange={(e) => set('valor_orcamento', e.target.value)}
                  placeholder="4500.00"
                />
              </label>
            </div>

            <div className="dois">
              <label>
                Data de entrada
                <input
                  type="date"
                  value={form.data_entrada}
                  onChange={(e) => set('data_entrada', e.target.value)}
                  required
                />
              </label>
              <label>
                Data prometida
                <input
                  type="date"
                  value={form.data_prometida}
                  onChange={(e) => set('data_prometida', e.target.value)}
                />
              </label>
            </div>

            <div className="dois">
              <label>
                Etapa atual
                <select
                  value={form.etapa_atual}
                  onChange={(e) => set('etapa_atual', e.target.value as EtapaId | '')}
                >
                  <option value="">—</option>
                  {ETAPAS.map((et) => (
                    <option key={et.id} value={et.id}>
                      {et.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={form.status_geral}
                  onChange={(e) => set('status_geral', e.target.value as StatusOS)}
                >
                  {STATUS_OS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {erroForm && <div className="flash erro">{erroForm}</div>}

            <div className="acoes">
              <button type="button" className="btn btn-ghost" onClick={fechar} disabled={salvando}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={salvando}>
                {salvando ? 'Salvando…' : form.id ? 'Salvar' : 'Criar OS'}
              </button>
            </div>
          </form>
        </div>
      )}

      <Estilos />
    </main>
  );
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
        gap: 16px;
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
      .conteudo {
        max-width: 1000px;
        margin: 0 auto;
        padding: 24px;
      }
      .muted {
        color: var(--gd-muted, #5d7689);
      }
      .tabela {
        background: #fff;
        border: 1px solid var(--gd-line, #d7dde2);
        border-radius: 14px;
        overflow: hidden;
      }
      .linha {
        display: grid;
        grid-template-columns: 90px 1.4fr 1fr 110px 110px 150px 70px;
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
      .cap {
        text-transform: capitalize;
      }
      .pill {
        font-style: normal;
        font-size: 12px;
        padding: 3px 9px;
        border-radius: 999px;
        font-weight: 600;
      }
      .pill-active {
        background: #e2f0f7;
        color: var(--gd-teal, #13678d);
      }
      .pill-done {
        background: #e6e9ec;
        color: var(--gd-muted, #5d7689);
      }
      .btn {
        border: none;
        border-radius: 10px;
        padding: 10px 16px;
        font-weight: 700;
        cursor: pointer;
        font-size: 14px;
      }
      .btn-primary {
        background: var(--gd-teal-bright, #1c84ad);
        color: #fff;
      }
      .btn-primary:hover:not(:disabled) {
        background: var(--gd-teal-hover, #2596c4);
      }
      .btn-ghost {
        background: transparent;
        border: 1.5px solid var(--gd-line, #d7dde2);
        color: var(--gd-muted, #5d7689);
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
        font-size: 14px;
        padding: 0;
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
      .flash.aviso {
        background: #fff5e0;
        color: #92600c;
      }
      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(8, 30, 48, 0.45);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 40px 16px;
        overflow-y: auto;
        z-index: 50;
      }
      .modal {
        background: #fff;
        border-radius: 18px;
        padding: 24px;
        width: 100%;
        max-width: 520px;
        box-shadow: 0 18px 50px rgba(8, 30, 48, 0.25);
      }
      .modal h2 {
        margin: 0 0 16px;
        font-size: 20px;
      }
      .modal label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--gd-muted, #5d7689);
        margin-bottom: 12px;
      }
      .modal input,
      .modal select {
        display: block;
        width: 100%;
        margin-top: 5px;
        padding: 11px 12px;
        border: 1.5px solid var(--gd-line, #d7dde2);
        border-radius: 10px;
        font-size: 15px;
        color: var(--gd-ink, #0b2233);
        background: #fff;
      }
      .modal input:focus,
      .modal select:focus {
        outline: none;
        border-color: var(--gd-teal-bright, #1c84ad);
      }
      .modal input:disabled {
        background: var(--gd-paper-2, #eceae6);
        color: var(--gd-muted, #5d7689);
      }
      .dois {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .acoes {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 8px;
      }
      @media (max-width: 680px) {
        .linha {
          grid-template-columns: 80px 1fr 90px 70px;
        }
        .linha span:nth-child(4),
        .linha span:nth-child(5) {
          display: none;
        }
        .dois {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  );
}
