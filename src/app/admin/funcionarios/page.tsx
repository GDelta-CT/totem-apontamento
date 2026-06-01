'use client';

/**
 * /admin/funcionarios — Gestão da equipe (Passo 1 da ordem A.1).
 *
 * Essencial demoável: listar, criar e ativar/desativar (soft delete, preserva
 * histórico de apontamentos). MVP sem PIN: o operário se identifica só por nome
 * no totem. Por isso o formulário pede só o Nome; o cargo vai como 'Operário'
 * por padrão (a coluna cargo é NOT NULL no banco).
 *
 * Padrão visual: tokens --gd-* + styled-jsx (mesmo do totem). Sem Tailwind no JSX.
 */

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AdminAuthGate } from '../AdminAuthGate';
import type { FetchState } from '@/lib/supabase/queries';
import {
  atualizarFuncionario,
  criarFuncionario,
  listarFuncionarios,
  setFuncionarioAtivo,
  type FuncionarioAdmin,
} from '@/lib/supabase/admin-queries';

const CARGO_PADRAO = 'Operário';

export default function AdminFuncionariosPage() {
  return (
    <AdminAuthGate>
      <FuncionariosManager />
    </AdminAuthGate>
  );
}

function FuncionariosManager() {
  const [lista, setLista] = useState<FetchState<FuncionarioAdmin[]>>({ status: 'loading' });
  const [novoNome, setNovoNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');

  const recarregar = useCallback(async () => {
    setLista({ status: 'loading' });
    setLista(await listarFuncionarios());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const buscar = async () => {
      const r = await listarFuncionarios();
      if (!cancelled) setLista(r);
    };
    buscar();
    return () => {
      cancelled = true;
    };
  }, []);

  const criar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    const nome = novoNome.trim();
    if (!nome) {
      setErro('Informe o nome do operário.');
      return;
    }
    setSalvando(true);
    const r = await criarFuncionario({ nome, cargo: CARGO_PADRAO });
    setSalvando(false);
    if (r.status === 'error') {
      setErro(r.message);
      return;
    }
    setNovoNome('');
    recarregar();
  };

  const salvarEdicao = async (id: string) => {
    const nome = editNome.trim();
    if (!nome) return;
    const r = await atualizarFuncionario(id, { nome });
    if (r.status === 'error') {
      setErro(r.message);
      return;
    }
    setEditId(null);
    recarregar();
  };

  const alternar = async (f: FuncionarioAdmin) => {
    const r = await setFuncionarioAtivo(f.id, !f.ativo);
    if (r.status === 'error') {
      setErro(r.message);
      return;
    }
    recarregar();
  };

  return (
    <main className="wrap">
      <header className="topbar">
        <a className="voltar" href="/admin">
          ← Painel
        </a>
        <strong>Equipe / Funcionários</strong>
      </header>

      <section className="conteudo">
        <form className="novo" onSubmit={criar}>
          <input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nome do operário"
            aria-label="Nome do operário"
          />
          <button className="btn btn-primary" type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : '+ Adicionar'}
          </button>
        </form>

        {erro && <div className="flash erro">{erro}</div>}

        {lista.status === 'loading' && <p className="muted">Carregando equipe…</p>}
        {lista.status === 'error' && (
          <div className="flash erro">
            {lista.message}{' '}
            <button className="link" onClick={recarregar}>
              Tentar de novo
            </button>
          </div>
        )}
        {lista.status === 'empty' && (
          <p className="muted">Nenhum funcionário ainda. Adicione o primeiro acima.</p>
        )}

        {lista.status === 'success' && (
          <div className="tabela">
            {lista.data.map((f) => (
              <div className={'linha' + (f.ativo ? '' : ' inativo')} key={f.id}>
                {editId === f.id ? (
                  <input
                    className="edit-input"
                    value={editNome}
                    autoFocus
                    onChange={(e) => setEditNome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') salvarEdicao(f.id);
                      if (e.key === 'Escape') setEditId(null);
                    }}
                  />
                ) : (
                  <span className="nome">
                    {f.nome}
                    {!f.ativo && <em className="tag-inativo">inativo</em>}
                  </span>
                )}

                <span className="acoes-linha">
                  {editId === f.id ? (
                    <>
                      <button className="link" onClick={() => salvarEdicao(f.id)}>
                        Salvar
                      </button>
                      <button className="link muted-link" onClick={() => setEditId(null)}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="link"
                        onClick={() => {
                          setEditId(f.id);
                          setEditNome(f.nome);
                        }}
                      >
                        Editar
                      </button>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={f.ativo}
                          onChange={() => alternar(f)}
                        />
                        <span>{f.ativo ? 'Ativo' : 'Inativo'}</span>
                      </label>
                    </>
                  )}
                </span>
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
        max-width: 640px;
        margin: 0 auto;
        padding: 24px;
      }
      .muted {
        color: var(--gd-muted, #5d7689);
      }
      .novo {
        display: flex;
        gap: 10px;
        margin-bottom: 18px;
      }
      .novo input {
        flex: 1;
        padding: 11px 12px;
        border: 1.5px solid var(--gd-line, #d7dde2);
        border-radius: 10px;
        font-size: 15px;
        background: #fff;
        color: var(--gd-ink, #0b2233);
      }
      .novo input:focus {
        outline: none;
        border-color: var(--gd-teal-bright, #1c84ad);
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
        justify-content: space-between;
        gap: 10px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--gd-line, #d7dde2);
      }
      .linha:last-child {
        border-bottom: none;
      }
      .linha.inativo .nome {
        color: var(--gd-muted, #5d7689);
        text-decoration: line-through;
      }
      .nome {
        font-weight: 600;
        font-size: 15px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .tag-inativo {
        font-style: normal;
        font-size: 11px;
        background: #e6e9ec;
        color: var(--gd-muted, #5d7689);
        padding: 2px 8px;
        border-radius: 999px;
        text-decoration: none;
      }
      .edit-input {
        flex: 1;
        padding: 8px 10px;
        border: 1.5px solid var(--gd-teal-bright, #1c84ad);
        border-radius: 8px;
        font-size: 15px;
      }
      .acoes-linha {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .btn {
        border: none;
        border-radius: 10px;
        padding: 11px 16px;
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
      .muted-link {
        color: var(--gd-muted, #5d7689);
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--gd-muted, #5d7689);
        cursor: pointer;
      }
      .toggle input {
        width: 16px;
        height: 16px;
        accent-color: var(--gd-teal-bright, #1c84ad);
      }
      .flash {
        padding: 10px 14px;
        border-radius: 10px;
        margin-bottom: 14px;
        font-size: 14px;
      }
      .flash.erro {
        background: #fdeaea;
        color: #b42323;
      }
    `}</style>
  );
}
