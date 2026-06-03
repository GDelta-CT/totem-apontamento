'use client';

/**
 * /admin/os — VIEW (client) da Gestão de Ordens de Serviço (Passo 1 da ordem A.1).
 *
 * Demoável e essencial: listar OS, criar (com buscar-antes-de-criar + status
 * controlado) e editar.
 *
 * SERVER-MOVE (passo 1 — tela HÍBRIDA): a LEITURA (lista de OS) agora vem do
 * SERVIDOR. A página (Server Component) busca via listarOSServer() e injeta o
 * resultado aqui como `estadoInicial`. Este componente NÃO consulta o Supabase
 * para LER a lista. A ESCRITA (criarOS/atualizarOS) e a busca "antes-de-criar"
 * (parte do fluxo de gravação) CONTINUAM NO CLIENTE neste passo; após uma escrita
 * bem-sucedida, em vez de re-buscar no browser chamamos router.refresh() para o
 * servidor re-ler a lista (mesma sensação de antes: a tela atualiza após a ação).
 *
 * Visual (PIVÔ): usa o AdminShell ESCURO/INDUSTRIAL (mesmo idioma do totem),
 * exatamente como antes. Consome as classes do shell + um bloco curto `adm-os-*`.
 *
 * Regras de negócio PRESERVADAS (CLAUDE.md), idênticas à versão anterior:
 *  - Placa normalizada em MAIÚSCULAS; uma OS ATIVA por placa (aviso aqui +
 *    trava no banco via índice parcial da Migration 005).
 *  - Buscar-antes-de-criar: ao sair do campo placa (só ao CRIAR).
 *  - Tipo de cliente sugere a data prometida (+30 seguradora/cooperativa, +15
 *    particular) — editável.
 *  - G3: valor do orçamento >= 0; data prometida não pode ser antes da entrada.
 *  - G6: o flash de sucesso some sozinho em ~3s (erros não auto-limpam).
 *  - status_geral é lista fixa (4 valores).
 */

import { useEffect, useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AdminAuthGate } from '../AdminAuthGate';
import { AdminShell } from '../_shell/AdminShell';
import { ETAPAS } from '@/lib/supabase/client';
import type { EtapaId } from '@/lib/supabase/client';
import { normalizarPlaca, type FetchState } from '@/lib/supabase/queries';
// ESCRITA + busca-antes-de-criar agora no SERVIDOR (Server Actions, server-move
// Passo 3). Tipos/constantes/helpers PUROS seguem vindo de admin-queries (que
// re-exporta de admin-shared).
import {
  atualizarOS,
  buscarOSAtivaPorPlacaAction,
  criarOS,
} from '@/lib/supabase/admin-actions';
import {
  somarDias,
  STATUS_OS,
  TIPOS_CLIENTE,
  type OrdemServicoAdmin,
  type StatusOS,
  type TipoCliente,
} from '@/lib/supabase/admin-queries';

export function OSView({ estadoInicial }: { estadoInicial: FetchState<OrdemServicoAdmin[]> }) {
  return (
    <AdminAuthGate>
      <OSManager estadoInicial={estadoInicial} />
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

/** Ícone "+" (linha) para a ação primária. */
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Ícone de documento vazio (estado "nenhuma OS"). */
function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M13.5 3.5V8H18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12.5h6M9 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function OSManager({ estadoInicial }: { estadoInicial: FetchState<OrdemServicoAdmin[]> }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [form, setForm] = useState<FormState | null>(null); // null = form fechado
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [avisoPlaca, setAvisoPlaca] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // O dado vem do SERVIDOR (estadoInicial). Re-buscar = re-rodar o Server
  // Component via router.refresh() (sem query Supabase no browser para LER).
  const recarregar = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  // G6: o flash de sucesso some sozinho em ~3s (erros NÃO auto-limpam — o admin
  // precisa lê-los). Cleanup cancela o timer se a mensagem mudar/desmontar.
  useEffect(() => {
    if (!okMsg) return;
    const t = setTimeout(() => setOkMsg(null), 3000);
    return () => clearTimeout(t);
  }, [okMsg]);

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
    const r = await buscarOSAtivaPorPlacaAction(placa);
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
    if (valor != null && valor < 0) {
      setSalvando(false);
      setErroForm('O valor do orçamento não pode ser negativo.');
      return;
    }

    // G3: o prazo não pode ser antes da entrada (datas ISO yyyy-mm-dd comparam direto).
    if (
      form.data_entrada &&
      form.data_prometida &&
      form.data_prometida < form.data_entrada
    ) {
      setSalvando(false);
      setErroForm('A data prometida não pode ser antes da data de entrada.');
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
    // ESCRITA no cliente OK → re-lê NO SERVIDOR (router.refresh), sem getSupabase.
    recarregar();
  };

  const lista = estadoInicial;

  return (
    <AdminShell
      abaAtiva="os"
      titulo="Ordens de Serviço"
      subtitulo="Criar, listar e editar"
      acao={
        <button className="adm-btn adm-btn--primary" onClick={abrirNova}>
          <PlusIcon />
          Nova OS
        </button>
      }
    >
      {okMsg && <div className="adm-flash fam-ok adm-os-flash">{okMsg}</div>}

      {lista.status === 'loading' && <p className="adm-os-info">Carregando ordens…</p>}

      {lista.status === 'error' && (
        <div className="adm-flash fam-bad adm-os-flash">
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
              <DocIcon />
            </span>
            <span className="adm-empty__tit">Nenhuma OS ainda</span>
            <span className="adm-empty__sub">
              Cadastre a primeira ordem de serviço para começar a acompanhar a produção.
            </span>
            <button className="adm-btn adm-btn--primary" onClick={abrirNova}>
              <PlusIcon />
              Nova OS
            </button>
          </div>
        </div>
      )}

      {lista.status === 'success' && (
        <div className="adm-card">
          <div className="adm-table adm-os-table">
            <div className="adm-table__head adm-os-row" role="row">
              <span>Placa</span>
              <span>Modelo</span>
              <span>Cliente</span>
              <span>Prometida</span>
              <span>Valor</span>
              <span>Status</span>
              <span aria-hidden="true" />
            </div>
            {lista.data.map((os) => (
              <div className="adm-table__row adm-os-row" key={os.id} role="row">
                <span className="adm-os-placa gd-tabular">{os.placa}</span>
                <span className="adm-os-modelo">{os.modelo_veiculo}</span>
                <span className="adm-os-cap">{os.tipo_cliente ?? '—'}</span>
                <span className={'adm-os-prazo gd-tabular fam-' + familiaPrazo(os.data_prometida)}>
                  {dataBR(os.data_prometida)}
                </span>
                <span className="gd-tabular">
                  {os.valor_orcamento != null ? brl(os.valor_orcamento) : '—'}
                </span>
                <span>
                  <em className={'adm-pill fam-' + familiaStatus(os.status_geral)}>
                    {os.status_geral ?? '—'}
                  </em>
                </span>
                <span className="adm-os-acao-col">
                  <button className="adm-link" onClick={() => abrirEdicao(os)}>
                    Editar
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {form && (
        <div className="adm-modal-overlay" onClick={fechar}>
          <form
            className="adm-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={submeter}
            role="dialog"
            aria-modal="true"
            aria-label={form.id ? 'Editar OS' : 'Nova OS'}
          >
            <h2 className="adm-modal__title">{form.id ? 'Editar OS' : 'Nova OS'}</h2>

            <label className="adm-field">
              <span className="adm-field__label">Placa</span>
              <input
                className="adm-input"
                value={form.placa}
                disabled={!!form.id}
                onChange={(e) => set('placa', normalizarPlaca(e.target.value))}
                onBlur={conferirPlaca}
                placeholder="ABC1D23"
                maxLength={7}
                required
              />
            </label>
            {avisoPlaca && <div className="adm-flash fam-warn adm-os-flash">{avisoPlaca}</div>}

            <label className="adm-field">
              <span className="adm-field__label">Modelo</span>
              <input
                className="adm-input"
                value={form.modelo_veiculo}
                onChange={(e) => set('modelo_veiculo', e.target.value)}
                placeholder="Ex.: Gol 1.0"
                required
              />
            </label>

            <div className="adm-grid-2">
              <label className="adm-field">
                <span className="adm-field__label">Tipo de cliente</span>
                <select
                  className="adm-select"
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
              <label className="adm-field">
                <span className="adm-field__label">Valor do orçamento (R$)</span>
                <input
                  className="adm-input"
                  inputMode="decimal"
                  value={form.valor_orcamento}
                  onChange={(e) => set('valor_orcamento', e.target.value)}
                  placeholder="4500.00"
                />
              </label>
            </div>

            <div className="adm-grid-2">
              <label className="adm-field">
                <span className="adm-field__label">Data de entrada</span>
                <input
                  className="adm-input"
                  type="date"
                  value={form.data_entrada}
                  onChange={(e) => set('data_entrada', e.target.value)}
                  required
                />
              </label>
              <label className="adm-field">
                <span className="adm-field__label">Data prometida</span>
                <input
                  className="adm-input"
                  type="date"
                  value={form.data_prometida}
                  onChange={(e) => set('data_prometida', e.target.value)}
                />
              </label>
            </div>

            <div className="adm-grid-2">
              <label className="adm-field">
                <span className="adm-field__label">Etapa atual</span>
                <select
                  className="adm-select"
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
              <label className="adm-field">
                <span className="adm-field__label">Status</span>
                <select
                  className="adm-select"
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

            {erroForm && <div className="adm-flash fam-bad adm-os-flash">{erroForm}</div>}

            <div className="adm-modal__actions">
              <button type="button" className="adm-btn adm-btn--ghost" onClick={fechar} disabled={salvando}>
                Cancelar
              </button>
              <button type="submit" className="adm-btn adm-btn--primary" disabled={salvando}>
                {salvando ? 'Salvando…' : form.id ? 'Salvar' : 'Criar OS'}
              </button>
            </div>
          </form>
        </div>
      )}

      <EstilosOS />
    </AdminShell>
  );
}

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Família de cor semântica (tokens --gd-*) para cada status_geral.
 * Só apresentação — não muda nenhuma regra de negócio.
 *  neutral = ainda não entrou em produção / já saiu do quadro
 *  info    = em andamento
 *  ok      = fase final positiva (pronto)
 */
type Familia = 'ok' | 'warn' | 'bad' | 'neutral' | 'info';

function familiaStatus(status: string | null | undefined): Familia {
  switch (status) {
    case 'Em Produção':
      return 'info';
    case 'Pronto para Entrega':
      return 'ok';
    case 'Aguardando Produção':
    case 'Entregue':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/**
 * Cor de PRAZO da data prometida, comparando com hoje (só apresentação):
 *  bad     = já passou (estourado)
 *  warn    = falta <=3 dias (perto)
 *  ok      = ainda há folga
 *  neutral = sem data
 * Recebe a data já fatiada em 'YYYY-MM-DD'.
 */
function familiaPrazo(dataISO: string | null | undefined): Familia {
  if (!dataISO) return 'neutral';
  const prazo = new Date(dataISO + 'T00:00:00');
  if (Number.isNaN(prazo.getTime())) return 'neutral';
  const hoje = new Date(hojeISO() + 'T00:00:00');
  const dias = Math.round((prazo.getTime() - hoje.getTime()) / 86400000);
  if (dias < 0) return 'bad';
  if (dias <= 3) return 'warn';
  return 'ok';
}

/** Data 'YYYY-MM-DD' -> 'DD/MM/AAAA' (pt-BR), sem fuso. Vazio -> traço. */
function dataBR(dataISO: string | null | undefined): string {
  if (!dataISO) return '—';
  const [a, m, d] = dataISO.slice(0, 10).split('-');
  if (!a || !m || !d) return '—';
  return `${d}/${m}/${a}`;
}

/**
 * Estilos ESPECÍFICOS da tela de OS (namespaced `adm-os-*`) no idioma ESCURO do
 * totem: a grade da tabela, a PLACA em estilo "instrumento" (caixa escura +
 * borda teal que brilha, mono), a cápsula de prazo nos acentos que brilham e os
 * ajustes responsivos. O chrome e a linguagem de cartão/pílula/botão/modal/
 * campo vêm do AdminShell. Tokens da camada do totem (--bg-*, --text-*,
 * --*-primary/-glow); números com `gd-tabular`.
 */
function EstilosOS() {
  return (
    <style jsx global>{`
      .adm-os-info {
        padding: 24px;
        color: var(--text-secondary);
        font-size: 14px;
      }
      .adm-os-flash {
        margin-bottom: 16px;
      }

      /* Grade da linha (cabeçalho e linhas usam a MESMA grid → colunas alinhadas) */
      .adm-os-row {
        grid-template-columns: 112px 1.4fr 1fr 128px 120px 168px 72px;
      }
      /* Placa = "instrumento" do totem: caixa escura + borda teal + mono que brilha */
      .adm-os-placa {
        justify-self: start;
        font-family: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', monospace;
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 0.1em;
        color: var(--text-primary);
        background: rgba(3, 7, 15, 0.6);
        border: 1px solid rgba(28, 132, 173, 0.4);
        border-radius: 6px;
        padding: 4px 9px;
      }
      .adm-os-modelo {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--text-primary);
        font-weight: 600;
      }
      .adm-os-cap {
        text-transform: capitalize;
        color: var(--text-secondary);
      }
      /* Prazo: data colorida pela proximidade do vencimento (cápsula na célula,
         acentos que brilham — mesma família do totem). */
      .adm-os-prazo {
        justify-self: start;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 11px;
        border-radius: 999px;
        font-weight: 700;
        font-size: 12.5px;
        border: 1px solid transparent;
      }
      .adm-os-prazo::before {
        content: '';
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: currentColor;
        box-shadow: 0 0 8px currentColor;
        flex-shrink: 0;
      }
      .adm-os-prazo.fam-ok {
        background: rgba(34, 197, 94, 0.14);
        color: var(--green-primary);
        border-color: rgba(34, 197, 94, 0.3);
      }
      .adm-os-prazo.fam-warn {
        background: rgba(245, 158, 11, 0.14);
        color: var(--amber-primary);
        border-color: rgba(245, 158, 11, 0.3);
      }
      .adm-os-prazo.fam-bad {
        background: rgba(239, 68, 68, 0.14);
        color: var(--red-primary);
        border-color: rgba(239, 68, 68, 0.3);
      }
      .adm-os-prazo.fam-neutral {
        background: rgba(148, 163, 184, 0.12);
        color: var(--text-secondary);
        border-color: rgba(148, 163, 184, 0.2);
      }
      .adm-os-prazo.fam-neutral::before {
        box-shadow: none;
      }
      .adm-os-acao-col {
        justify-self: end;
      }

      @media (max-width: 760px) {
        /* mantém Placa, Modelo, Status e a ação; oculta Cliente/Prometida/Valor */
        .adm-os-row {
          grid-template-columns: 100px 1fr 150px 64px;
        }
        .adm-os-row > span:nth-child(3),
        .adm-os-row > span:nth-child(4),
        .adm-os-row > span:nth-child(5) {
          display: none;
        }
      }
    `}</style>
  );
}
