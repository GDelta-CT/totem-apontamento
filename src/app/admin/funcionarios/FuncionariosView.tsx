'use client';

/**
 * /admin/funcionarios — VIEW (client) da Gestão da equipe (Passo 1 da ordem A.1).
 *
 * Essencial demoável: listar, criar e ativar/desativar (soft delete, preserva
 * histórico de apontamentos). MVP sem PIN: o operário se identifica só por nome
 * no totem. Por isso o formulário pede só o Nome; o cargo vai como 'Operário'
 * por padrão (a coluna cargo é NOT NULL no banco).
 *
 * SERVER-MOVE (passo 1 — tela HÍBRIDA): a LEITURA (lista da equipe) agora vem do
 * SERVIDOR. A página (Server Component) busca via listarFuncionariosServer() e
 * injeta o resultado aqui como `estadoInicial`. Este componente NÃO consulta o
 * Supabase para LER a lista. A ESCRITA (criar/editar/ativar) e as checagens G4
 * (nome duplicado) / G5 (apontamento ativo) — parte do fluxo de gravação —
 * CONTINUAM NO CLIENTE neste passo; após uma escrita bem-sucedida, em vez de
 * re-buscar no browser chamamos router.refresh() para o servidor re-ler a lista
 * (mesma sensação de antes: a tela atualiza após a ação).
 *
 * Integridade por UX (não por trava de banco):
 *  - G4: ao CRIAR, busca-antes-de-criar por nome igual (case-insensitive). Como o
 *    totem acha o operário só pelo nome, dois nomes iguais confundem — então
 *    pedimos confirmação amigável (inline) em vez de duplicar direto.
 *  - G5: ao DESATIVAR, checa se há apontamento ativo (timer rodando) — desativar
 *    nesse momento deixaria um apontamento órfão; pedimos confirmação (modal).
 *
 * Visual (PIVÔ): consome o AdminShell ESCURO/INDUSTRIAL (mesmo idioma do totem),
 * exatamente como antes. Usa as classes do shell + um bloco curto `adm-eq-*`.
 */

import { useRef, useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AdminAuthGate } from '../AdminAuthGate';
import { AdminShell } from '../_shell/AdminShell';
import type { FetchState } from '@/lib/supabase/queries';
import {
  atualizarFuncionario,
  buscarFuncionarioPorNome,
  criarFuncionario,
  funcionarioTemApontamentoAtivo,
  setFuncionarioAtivo,
  type FuncionarioAdmin,
} from '@/lib/supabase/admin-queries';

const CARGO_PADRAO = 'Operário';

export function FuncionariosView({
  estadoInicial,
}: {
  estadoInicial: FetchState<FuncionarioAdmin[]>;
}) {
  return (
    <AdminAuthGate>
      <FuncionariosManager estadoInicial={estadoInicial} />
    </AdminAuthGate>
  );
}

/** Confirmação pendente de desativação (G5): qual funcionário e por quê. */
type ConfirmacaoDesativar = { funcionario: FuncionarioAdmin; motivo: string };

/** Ícone "+" (linha) para a ação primária. */
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Ícone de equipe (estado "nenhum funcionário"). */
function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M16 6.2a3 3 0 0 1 0 5.6M17.5 14.8c2.2.5 3.8 2.3 3.8 4.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FuncionariosManager({
  estadoInicial,
}: {
  estadoInicial: FetchState<FuncionarioAdmin[]>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [novoNome, setNovoNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');

  // G4: nome igual encontrado ao tentar criar -> confirmação inline.
  const [confirmarNome, setConfirmarNome] = useState<string | null>(null);
  // G5: desativação com apontamento ativo -> confirmação em modal.
  const [confirmarDesativar, setConfirmarDesativar] = useState<ConfirmacaoDesativar | null>(null);
  // Trava de duplo-clique enquanto verificamos antes de criar/desativar.
  const [verificando, setVerificando] = useState(false);

  // A ação primária do shell (+ Novo funcionário) foca o campo do cadastro inline.
  const novoInputRef = useRef<HTMLInputElement>(null);

  // O dado vem do SERVIDOR (estadoInicial). Re-buscar = re-rodar o Server
  // Component via router.refresh() (sem query Supabase no browser para LER).
  const recarregar = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const focarCadastro = () => {
    setErro(null);
    novoInputRef.current?.focus();
    novoInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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
    // ESCRITA no cliente OK → re-lê NO SERVIDOR (router.refresh), sem getSupabase.
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
    // Trava de reentrância: um duplo-clique não pode disparar dois fluxos em
    // paralelo e "pular" a confirmação G5 (a 2ª chamada limparia o modal da 1ª).
    if (verificando) return;
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

  const lista = estadoInicial;

  // Subtítulo do shell = contagem viva (pessoas + inativos), só quando há dados.
  const subtitulo =
    lista.status === 'success' ? (
      <span>
        <span className="gd-tabular">{lista.data.length}</span>{' '}
        {lista.data.length === 1 ? 'pessoa' : 'pessoas'}
        {(() => {
          const inativos = lista.data.filter((f) => !f.ativo).length;
          return inativos > 0 ? (
            <>
              {' · '}
              <span className="gd-tabular">{inativos}</span> inativo{inativos === 1 ? '' : 's'}
            </>
          ) : null;
        })()}
      </span>
    ) : undefined;

  return (
    <AdminShell
      abaAtiva="equipe"
      titulo="Equipe"
      subtitulo={subtitulo}
      acao={
        <button className="adm-btn adm-btn--primary" onClick={focarCadastro}>
          <PlusIcon />
          Novo funcionário
        </button>
      }
    >
      {/* ── Cadastro inline (idioma escuro): nome + botão adicionar ── */}
      <div className="adm-card adm-eq-novo-card">
        <form className="adm-eq-novo" onSubmit={criar}>
          <label className="adm-eq-novo-field">
            <span className="adm-field__label">Nome do operário</span>
            <input
              ref={novoInputRef}
              className="adm-input"
              value={novoNome}
              onChange={(e) => {
                setNovoNome(e.target.value);
                if (confirmarNome) setConfirmarNome(null);
              }}
              placeholder="Ex.: João da Silva"
              aria-label="Nome do operário"
            />
          </label>
          <button className="adm-btn adm-btn--primary" type="submit" disabled={salvando || verificando}>
            <PlusIcon />
            {salvando ? 'Salvando…' : verificando ? 'Verificando…' : 'Adicionar'}
          </button>
        </form>

        {/* G4 — confirmação amigável de nome duplicado (aviso inline, não erro) */}
        {confirmarNome && (
          <div className="adm-flash fam-warn adm-eq-confirma" role="alertdialog" aria-live="polite">
            <p className="adm-eq-confirma-txt">
              Já existe <strong>{confirmarNome}</strong> na equipe. O totem acha o operário só pelo
              nome, então dois nomes iguais podem se confundir. Cadastrar mesmo assim?
            </p>
            <div className="adm-eq-confirma-acoes">
              <button
                className="adm-btn adm-btn--primary adm-eq-btn-sm"
                onClick={() => criarDeVez(novoNome.trim())}
                disabled={salvando}
              >
                {salvando ? 'Salvando…' : 'Cadastrar mesmo assim'}
              </button>
              <button
                className="adm-btn adm-btn--ghost adm-eq-btn-sm"
                onClick={() => setConfirmarNome(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {erro && <div className="adm-flash fam-bad adm-eq-flash-erro">{erro}</div>}
      </div>

      {lista.status === 'loading' && <p className="adm-eq-info">Carregando equipe…</p>}

      {lista.status === 'error' && (
        <div className="adm-flash fam-bad adm-eq-flash">
          {lista.message}{' '}
          <button className="adm-link" onClick={recarregar}>
            Tentar de novo
          </button>
        </div>
      )}

      {lista.status === 'empty' && (
        <div className="adm-card">
          <div className="adm-empty">
            <span className="adm-empty__ico" aria-hidden="true">
              <TeamIcon />
            </span>
            <span className="adm-empty__tit">Nenhum funcionário ainda</span>
            <span className="adm-empty__sub">
              Cadastre o primeiro operário no campo acima para começar a acompanhar a equipe no
              totem.
            </span>
            <button className="adm-btn adm-btn--primary" onClick={focarCadastro}>
              <PlusIcon />
              Novo funcionário
            </button>
          </div>
        </div>
      )}

      {lista.status === 'success' && (
        <div className="adm-card">
          <div className="adm-table adm-eq-table">
            <div className="adm-table__head adm-eq-row" role="row">
              <span>Operário</span>
              <span>Situação</span>
              <span aria-hidden="true" />
            </div>
            {lista.data.map((f) => (
              <div
                className={'adm-table__row adm-eq-row' + (f.ativo ? '' : ' adm-eq-inativo')}
                key={f.id}
                role="row"
              >
                {editId === f.id ? (
                  <input
                    className="adm-input adm-eq-edit-input"
                    value={editNome}
                    autoFocus
                    aria-label="Editar nome"
                    onChange={(e) => setEditNome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') salvarEdicao(f.id);
                      if (e.key === 'Escape') setEditId(null);
                    }}
                  />
                ) : (
                  <span className="adm-eq-nome">
                    <span className="adm-eq-nome-txt">{f.nome}</span>
                    <em className={'adm-pill adm-eq-cargo ' + (f.ativo ? 'fam-info' : 'fam-neutral')}>
                      {f.cargo}
                    </em>
                  </span>
                )}

                <span className="adm-eq-situacao">
                  {f.ativo ? (
                    <em className="adm-pill fam-ok">ativo</em>
                  ) : (
                    <em className="adm-pill fam-neutral">inativo</em>
                  )}
                </span>

                <span className="adm-eq-acoes">
                  {editId === f.id ? (
                    <>
                      <button className="adm-link" onClick={() => salvarEdicao(f.id)}>
                        Salvar
                      </button>
                      <button className="adm-link adm-eq-link-quiet" onClick={() => setEditId(null)}>
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="adm-link"
                        onClick={() => {
                          setEditId(f.id);
                          setEditNome(f.nome);
                        }}
                      >
                        Editar
                      </button>
                      <label className="adm-eq-toggle">
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
        </div>
      )}

      {/* G5 — confirmação de desativação com apontamento ativo (modal escuro) */}
      {confirmarDesativar && (
        <div
          className="adm-modal-overlay"
          role="presentation"
          onClick={() => setConfirmarDesativar(null)}
        >
          <div
            className="adm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="adm-eq-modal-titulo"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="adm-modal__title" id="adm-eq-modal-titulo">
              Desativar com tarefa em andamento?
            </h2>
            <p className="adm-eq-modal-txt">{confirmarDesativar.motivo}</p>
            <div className="adm-modal__actions">
              <button
                className="adm-btn adm-btn--ghost"
                onClick={() => setConfirmarDesativar(null)}
                autoFocus
              >
                Manter ativo
              </button>
              <button
                className="adm-btn adm-btn--danger"
                onClick={() => aplicarStatus(confirmarDesativar.funcionario, false)}
              >
                Desativar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}

      <EstilosEquipe />
    </AdminShell>
  );
}

/**
 * Estilos ESPECÍFICOS da tela de Equipe (namespaced `adm-eq-*`) no idioma ESCURO
 * do totem: o cartão de cadastro inline, a grade da tabela (Operário / Situação /
 * ações), o toggle Ativo/Inativo e os ajustes responsivos. O chrome e a linguagem
 * de cartão/pílula/botão/modal/campo/flash vêm do AdminShell. Tokens da camada do
 * totem (--bg-*, --text-*, --*-primary, --gd-teal-*); números com `gd-tabular`.
 */
function EstilosEquipe() {
  return (
    <style jsx global>{`
      .adm-eq-info {
        padding: 24px;
        color: var(--text-secondary);
        font-size: 14px;
      }
      .adm-eq-flash {
        margin-bottom: 16px;
      }

      /* ── Cadastro inline: campo de nome + botão adicionar ── */
      .adm-eq-novo-card {
        padding: 20px 24px;
        margin-bottom: 20px;
      }
      .adm-eq-novo {
        display: flex;
        align-items: flex-end;
        gap: 12px;
      }
      .adm-eq-novo-field {
        flex: 1;
        min-width: 0;
        margin: 0;
      }
      .adm-eq-confirma {
        margin-top: 16px;
      }
      .adm-eq-confirma-txt {
        font-size: 14px;
        line-height: 1.5;
        margin-bottom: 12px;
      }
      .adm-eq-confirma-acoes {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .adm-eq-btn-sm {
        min-height: 0;
        padding: 9px 14px;
        font-size: 13.5px;
      }
      .adm-eq-flash-erro {
        margin-top: 16px;
      }

      /* ── Tabela da equipe: Operário (nome+cargo) · Situação · ações ── */
      .adm-eq-row {
        grid-template-columns: 1fr 132px 220px;
      }
      /* Linha inativa: opacidade reduzida (não line-through hostil). As pílulas
         "inativo" / cargo neutro carregam o significado; o nome continua legível. */
      .adm-eq-inativo {
        opacity: 0.6;
      }
      .adm-eq-nome {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        min-width: 0;
      }
      .adm-eq-nome-txt {
        font-weight: 600;
        font-size: 14px;
        color: var(--text-primary);
        line-height: 1.2;
      }
      .adm-eq-cargo {
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.04em;
      }
      .adm-eq-situacao {
        justify-self: start;
      }
      .adm-eq-edit-input {
        max-width: 320px;
        min-height: 40px;
      }
      .adm-eq-acoes {
        justify-self: end;
        display: flex;
        align-items: center;
        gap: 16px;
        flex-shrink: 0;
      }
      .adm-eq-link-quiet {
        color: var(--text-muted);
      }
      .adm-eq-link-quiet:hover {
        color: var(--text-secondary);
      }
      /* Toggle Ativo/Inativo — accent teal que brilha, alvo de toque >=44px */
      .adm-eq-toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        cursor: pointer;
        min-height: 44px;
        padding: 0 2px;
        white-space: nowrap;
      }
      .adm-eq-toggle input {
        width: 18px;
        height: 18px;
        accent-color: var(--gd-teal-bright);
        cursor: pointer;
      }
      .adm-eq-toggle input:disabled {
        cursor: default;
      }

      /* ── Texto de apoio do modal G5 ── */
      .adm-eq-modal-txt {
        font-size: 14px;
        line-height: 1.55;
        color: var(--text-secondary);
        margin: 0;
      }

      @media (max-width: 680px) {
        .adm-eq-novo {
          flex-direction: column;
          align-items: stretch;
        }
        .adm-eq-novo .adm-btn {
          width: 100%;
        }
        /* Empilha: Operário (com situação) em cima, ações embaixo. A pílula de
           situação continua visível (sinal de "inativo" não pode sumir). */
        .adm-eq-row {
          grid-template-columns: 1fr auto;
          grid-template-areas:
            'nome situacao'
            'acoes acoes';
          row-gap: 12px;
        }
        .adm-eq-row > span:nth-child(1) {
          grid-area: nome;
        }
        .adm-eq-row > span:nth-child(2) {
          grid-area: situacao;
          justify-self: end;
        }
        .adm-eq-row > span:nth-child(3) {
          grid-area: acoes;
        }
        .adm-eq-acoes {
          justify-self: start;
          gap: 16px;
        }
      }
    `}</style>
  );
}
