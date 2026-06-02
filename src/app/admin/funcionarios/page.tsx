'use client';

/**
 * /admin/funcionarios — Gestão da equipe (Passo 1 da ordem A.1).
 *
 * Essencial demoável: listar, criar e ativar/desativar (soft delete, preserva
 * histórico de apontamentos). MVP sem PIN: o operário se identifica só por nome
 * no totem. Por isso o formulário pede só o Nome; o cargo vai como 'Operário'
 * por padrão (a coluna cargo é NOT NULL no banco).
 *
 * Integridade por UX (não por trava de banco):
 *  - G4: ao CRIAR, busca-antes-de-criar por nome igual (case-insensitive). Como o
 *    totem acha o operário só pelo nome, dois nomes iguais confundem — então
 *    pedimos confirmação amigável em vez de duplicar direto.
 *  - G5: ao DESATIVAR, checa se há apontamento ativo (timer rodando) — desativar
 *    nesse momento deixaria um apontamento órfão; pedimos confirmação.
 *
 * Padrão visual: tokens premium --gd-* + styled-jsx (mesmo do totem). Sem Tailwind
 * no JSX. Inativo = opacidade + pílula neutra (sem line-through hostil).
 */

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AdminAuthGate } from '../AdminAuthGate';
import type { FetchState } from '@/lib/supabase/queries';
import {
  atualizarFuncionario,
  buscarFuncionarioPorNome,
  criarFuncionario,
  funcionarioTemApontamentoAtivo,
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

/** Confirmação pendente de desativação (G5): qual funcionário e por quê. */
type ConfirmacaoDesativar = { funcionario: FuncionarioAdmin; motivo: string };

function FuncionariosManager() {
  const [lista, setLista] = useState<FetchState<FuncionarioAdmin[]>>({ status: 'loading' });
  const [novoNome, setNovoNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');

  // G4: nome igual encontrado ao tentar criar -> confirmação inline.
  const [confirmarNome, setConfirmarNome] = useState<string | null>(null);
  // G5: desativação com apontamento ativo -> confirmação inline.
  const [confirmarDesativar, setConfirmarDesativar] = useState<ConfirmacaoDesativar | null>(null);
  // Trava de duplo-clique enquanto verificamos antes de criar/desativar.
  const [verificando, setVerificando] = useState(false);

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

  /** Cria de fato (chamado direto ou após o admin confirmar o nome duplicado). */
  const criarDeVez = async (nome: string) => {
    setSalvando(true);
    const r = await criarFuncionario({ nome, cargo: CARGO_PADRAO });
    setSalvando(false);
    if (r.status === 'error') {
      setErro(r.message);
      return;
    }
    setNovoNome('');
    setConfirmarNome(null);
    recarregar();
  };

  // G4: antes de criar, busca nome igual; se houver, abre a confirmação.
  const criar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setConfirmarNome(null);
    const nome = novoNome.trim();
    if (!nome) {
      setErro('Informe o nome do operário.');
      return;
    }
    setVerificando(true);
    const dup = await buscarFuncionarioPorNome(nome);
    setVerificando(false);
    if (dup.status === 'error') {
      setErro(dup.message);
      return;
    }
    if (dup.status === 'success' && dup.data) {
      // Já existe um operário com esse nome — pede confirmação em vez de duplicar.
      setConfirmarNome(dup.data.nome);
      return;
    }
    await criarDeVez(nome);
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

  /** Aplica a mudança de status (chamado direto ou após confirmar a desativação). */
  const aplicarStatus = async (f: FuncionarioAdmin, ativo: boolean) => {
    const r = await setFuncionarioAtivo(f.id, ativo);
    if (r.status === 'error') {
      setErro(r.message);
      return;
    }
    setConfirmarDesativar(null);
    recarregar();
  };

  // G5: reativar é sempre seguro; desativar checa apontamento ativo antes.
  const alternar = async (f: FuncionarioAdmin) => {
    setErro(null);
    setConfirmarDesativar(null);
    const vaiDesativar = f.ativo; // está ativo -> a ação é desativar
    if (!vaiDesativar) {
      await aplicarStatus(f, true);
      return;
    }
    setVerificando(true);
    const ativo = await funcionarioTemApontamentoAtivo(f.nome);
    setVerificando(false);
    if (ativo.status === 'error') {
      setErro(ativo.message);
      return;
    }
    if (ativo.status === 'success' && ativo.data) {
      setConfirmarDesativar({
        funcionario: f,
        motivo: `${f.nome} tem uma tarefa em andamento. Desativar agora pode deixar um apontamento órfão (timer rodando sem operário ativo).`,
      });
      return;
    }
    await aplicarStatus(f, false);
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
            onChange={(e) => {
              setNovoNome(e.target.value);
              if (confirmarNome) setConfirmarNome(null);
            }}
            placeholder="Nome do operário"
            aria-label="Nome do operário"
          />
          <button
            className="btn btn-primary"
            type="submit"
            disabled={salvando || verificando}
          >
            {salvando ? 'Salvando…' : verificando ? 'Verificando…' : '+ Adicionar'}
          </button>
        </form>

        {/* G4 — confirmação amigável de nome duplicado */}
        {confirmarNome && (
          <div className="confirma" role="alertdialog" aria-live="polite">
            <p className="confirma-txt">
              Já existe <strong>{confirmarNome}</strong> na equipe. O totem acha o operário
              só pelo nome, então dois nomes iguais podem se confundir. Cadastrar mesmo
              assim?
            </p>
            <div className="confirma-acoes">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => criarDeVez(novoNome.trim())}
                disabled={salvando}
              >
                {salvando ? 'Salvando…' : 'Cadastrar mesmo assim'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmarNome(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

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
          <>
            <p className="contagem">
              <span className="gd-tabular">{lista.data.length}</span>{' '}
              {lista.data.length === 1 ? 'pessoa' : 'pessoas'} na equipe
              {(() => {
                const inativos = lista.data.filter((f) => !f.ativo).length;
                return inativos > 0 ? (
                  <>
                    {' · '}
                    <span className="gd-tabular">{inativos}</span> inativo
                    {inativos === 1 ? '' : 's'}
                  </>
                ) : null;
              })()}
            </p>

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
                      <span className="nome-txt">{f.nome}</span>
                      <span className={'pill pill-cargo' + (f.ativo ? '' : ' pill-quiet')}>
                        {f.cargo}
                      </span>
                      {!f.ativo && <span className="pill pill-inativo">inativo</span>}
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
                            disabled={verificando}
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
          </>
        )}
      </section>

      {/* G5 — confirmação de desativação com apontamento ativo */}
      {confirmarDesativar && (
        <div
          className="modal-fundo"
          role="presentation"
          onClick={() => setConfirmarDesativar(null)}
        >
          <div
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="modal-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-titulo" id="modal-titulo">
              Desativar com tarefa em andamento?
            </h2>
            <p className="modal-txt">{confirmarDesativar.motivo}</p>
            <div className="modal-acoes">
              <button
                className="btn btn-ghost"
                onClick={() => setConfirmarDesativar(null)}
                autoFocus
              >
                Manter ativo
              </button>
              <button
                className="btn btn-perigo"
                onClick={() => aplicarStatus(confirmarDesativar.funcionario, false)}
              >
                Desativar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      <Estilos />
    </main>
  );
}

function Estilos() {
  return (
    <style jsx global>{`
      .wrap {
        min-height: 100vh;
        background: var(--gd-app-bg, var(--gd-paper, #f5f4f2));
        color: var(--gd-ink, #0b2233);
        font-family: 'Inter', system-ui, sans-serif;
      }
      .topbar {
        display: flex;
        align-items: center;
        gap: var(--gd-sp-4, 16px);
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
        color: var(--gd-muted, #46606f);
      }
      .contagem {
        font-size: var(--gd-fs-cap, 12.5px);
        color: var(--gd-muted, #46606f);
        margin-bottom: 10px;
        letter-spacing: 0.01em;
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
        border-radius: var(--gd-r-control, 10px);
        font-size: 15px;
        background: #fff;
        color: var(--gd-ink, #0b2233);
      }
      .novo input:focus {
        outline: none;
        border-color: var(--gd-teal-bright, #1c84ad);
        box-shadow: 0 0 0 3px rgba(28, 132, 173, 0.16);
      }
      .tabela {
        background: #fff;
        border: 1px solid var(--gd-border, rgba(11, 56, 87, 0.1));
        border-radius: var(--gd-r-card, 14px);
        overflow: hidden;
        box-shadow: var(--gd-elev-1, 0 1px 2px rgba(11, 56, 87, 0.05));
      }
      .linha {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--gd-border, rgba(11, 56, 87, 0.1));
        transition: opacity var(--gd-dur, 180ms) var(--gd-ease, ease);
      }
      .linha:last-child {
        border-bottom: none;
      }
      /* Inativo: opacidade reduzida (não line-through hostil). A pílula "inativo"
         carrega o significado; o nome continua legível. */
      .linha.inativo {
        opacity: 0.62;
      }
      .nome {
        font-weight: 600;
        font-size: 15px;
        display: flex;
        align-items: center;
        gap: var(--gd-sp-2, 8px);
        flex-wrap: wrap;
      }
      .nome-txt {
        line-height: 1.2;
      }
      /* Pílulas semânticas (uma cor = um significado), tokens --gd-*. */
      .pill {
        font-size: var(--gd-fs-micro, 11px);
        font-weight: 700;
        line-height: 1;
        padding: 4px 9px;
        border-radius: var(--gd-r-pill, 999px);
        letter-spacing: 0.02em;
        text-decoration: none;
        white-space: nowrap;
      }
      /* Cargo = info (papel na oficina). */
      .pill-cargo {
        background: var(--gd-info-fill, #e6f1fb);
        color: var(--gd-info-ink, #0c447c);
        text-transform: uppercase;
      }
      /* Cargo de quem está inativo: neutraliza para não competir com a pílula "inativo". */
      .pill-quiet {
        background: var(--gd-neutral-fill, #f0f1f0);
        color: var(--gd-neutral-ink, #5f5e5a);
      }
      /* Estado inativo = neutro. */
      .pill-inativo {
        background: var(--gd-neutral-fill, #f0f1f0);
        color: var(--gd-neutral-ink, #5f5e5a);
        text-transform: lowercase;
      }
      .edit-input {
        flex: 1;
        padding: 8px 10px;
        border: 1.5px solid var(--gd-teal-bright, #1c84ad);
        border-radius: var(--gd-r-control, 10px);
        font-size: 15px;
      }
      .edit-input:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(28, 132, 173, 0.16);
      }
      .acoes-linha {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-shrink: 0;
      }
      .btn {
        border: none;
        border-radius: var(--gd-r-control, 10px);
        padding: 11px 16px;
        font-weight: 700;
        cursor: pointer;
        font-size: 14px;
        transition:
          background var(--gd-dur-fast, 120ms) var(--gd-ease, ease),
          transform 80ms var(--gd-ease, ease);
      }
      .btn:active:not(:disabled) {
        transform: translateY(1px);
      }
      .btn-sm {
        padding: 9px 14px;
        font-size: 13.5px;
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
        color: var(--gd-muted, #46606f);
        border: 1.5px solid var(--gd-line, #d7dde2);
      }
      .btn-ghost:hover:not(:disabled) {
        background: var(--gd-paper-2, #eceae6);
        color: var(--gd-ink, #0b2233);
      }
      .btn-perigo {
        background: var(--gd-bad-ink, #a32d2d);
        color: #fff;
      }
      .btn-perigo:hover:not(:disabled) {
        filter: brightness(1.08);
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
        color: var(--gd-muted, #46606f);
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--gd-muted, #46606f);
        cursor: pointer;
        min-height: 44px;
        padding: 0 2px;
      }
      .toggle input {
        width: 18px;
        height: 18px;
        accent-color: var(--gd-teal-bright, #1c84ad);
        cursor: pointer;
      }
      .toggle input:disabled {
        cursor: default;
      }
      .flash {
        padding: 10px 14px;
        border-radius: var(--gd-r-control, 10px);
        margin-bottom: 14px;
        font-size: 14px;
      }
      .flash.erro {
        background: var(--gd-bad-fill, #fcebeb);
        color: var(--gd-bad-ink, #a32d2d);
      }
      /* G4 — bloco de confirmação inline (atenção, não erro). */
      .confirma {
        background: var(--gd-warn-fill, #faeeda);
        color: var(--gd-warn-ink, #8a5a12);
        border: 1px solid rgba(138, 90, 18, 0.22);
        border-radius: var(--gd-r-card, 14px);
        padding: 14px 16px;
        margin-bottom: 14px;
      }
      .confirma-txt {
        font-size: 14px;
        line-height: 1.5;
        margin-bottom: 12px;
      }
      .confirma-acoes {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      /* G5 — modal de confirmação de desativação. */
      .modal-fundo {
        position: fixed;
        inset: 0;
        background: rgba(8, 30, 48, 0.42);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        z-index: 50;
        animation: fade-in-up 0.18s var(--gd-ease, ease) forwards;
      }
      .modal {
        background: #fff;
        border-radius: var(--gd-r-panel, 18px);
        box-shadow: var(--gd-elev-pop, 0 24px 60px -12px rgba(8, 30, 48, 0.28));
        padding: 24px;
        width: min(440px, 100%);
      }
      .modal-titulo {
        font-size: var(--gd-fs-h3, 16px);
        font-weight: 800;
        color: var(--gd-ink, #0b2233);
        margin-bottom: 10px;
      }
      .modal-txt {
        font-size: 14px;
        line-height: 1.55;
        color: var(--gd-muted, #46606f);
        margin-bottom: 20px;
      }
      .modal-acoes {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
    `}</style>
  );
}
