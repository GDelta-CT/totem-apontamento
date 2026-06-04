'use client';

/**
 * /admin/anomalias — VIEW (client) da correção de anomalias do admin (Passo 4).
 *
 * Lista apontamentos-fantasma (ativos além do teto de ~10,5h) e deixa o admin
 * fechá-los via uma CORREÇÃO APPEND-ONLY: o tempo original é preservado e fica
 * registrado quem corrigiu, quando e por quê.
 *
 * SERVER-MOVE (passo 1 — tela HÍBRIDA): a LEITURA (detecção) agora vem do
 * SERVIDOR. A página (Server Component) busca via listarAnomaliasServer() e injeta
 * o resultado aqui como `estadoInicial`. Este componente NÃO consulta o Supabase
 * para LER: o botão "Atualizar" chama router.refresh(), que re-roda o Server
 * Component e RE-BUSCA NO SERVIDOR. A ESCRITA (registrarCorrecao) CONTINUA NO
 * CLIENTE neste passo; após uma correção bem-sucedida, em vez de re-buscar no
 * browser, chamamos router.refresh() para o servidor re-ler a lista (mesma
 * sensação de antes: a tela atualiza após a ação).
 *
 * Visual (PIVÔ): usa o AdminShell ESCURO/INDUSTRIAL (mesmo idioma do totem),
 * exatamente como antes. Consome as classes do shell + um bloco curto `adm-anom-*`.
 *
 * Regras de negócio PRESERVADAS (CLAUDE.md), idênticas à versão anterior:
 *  - Correção é APPEND-ONLY: registrarCorrecao não apaga; preserva o original.
 *  - Motivo é OBRIGATÓRIO: "Registrar correção" fica desabilitado sem texto.
 *  - motivo_codigo é lista fixa, default "esqueceu_parar".
 *  - O count de anomalias alimenta o badge da aba (anomaliasCount no shell).
 *  - G6: o flash de sucesso some sozinho em ~3s (erros NÃO auto-limpam).
 */

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AdminAuthGate } from '../AdminAuthGate';
import { AdminShell } from '../_shell/AdminShell';
import type { FetchState } from '@/lib/supabase/queries';
// CORREÇÃO (escrita append-only) agora no SERVIDOR (Server Action, server-move
// Passo 3). Constante/tipos PUROS seguem vindo de anomalias-queries (que
// re-exporta de anomalias-shared).
import { registrarCorrecao } from '@/lib/supabase/anomalias-actions';
import {
  TETO_FANTASMA_MS,
  type Anomalia,
  type MotivoCodigo,
} from '@/lib/supabase/anomalias-queries';

export function AnomaliasView({ estadoInicial }: { estadoInicial: FetchState<Anomalia[]> }) {
  return (
    <AdminAuthGate>
      <Anomalias estadoInicial={estadoInicial} />
    </AdminAuthGate>
  );
}

const tetoHoras = (TETO_FANTASMA_MS / (60 * 60 * 1000)).toFixed(1).replace('.', ',');

/** Ícone de atualizar (linha, herda currentColor) — substitui o ↻ textual. */
function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 11a8 8 0 1 0-.5 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M20 5v6h-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Ícone "tudo certo" calmo (escudo com check) — substitui o emoji ✅. */
function CheckShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 19 6v5.5c0 4.3-2.9 7.4-7 8.9-4.1-1.5-7-4.6-7-8.9V6l7-2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="m9 12 2.2 2.2L15 10.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Anomalias({ estadoInicial }: { estadoInicial: FetchState<Anomalia[]> }) {
  const router = useRouter();
  const [atualizando, startTransition] = useTransition();
  const [corrigindoId, setCorrigindoId] = useState<string | null>(null);
  const [motivoTxt, setMotivoTxt] = useState('');
  const [motivoCod, setMotivoCod] = useState<MotivoCodigo>('esqueceu_parar');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
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
    // ESCRITA no cliente OK → re-lê NO SERVIDOR (router.refresh), sem getSupabase.
    recarregar();
  };

  const lista = estadoInicial;
  const totalAnomalias = lista.status === 'success' ? lista.data.length : 0;

  return (
    <AdminShell
      abaAtiva="anomalias"
      titulo="Anomalias"
      subtitulo="Apontamentos-fantasma"
      anomaliasCount={totalAnomalias}
      acao={
        <button
          className="adm-btn adm-btn--ghost adm-anom-refresh"
          onClick={recarregar}
          disabled={atualizando}
          title="Atualizar"
          aria-label="Atualizar lista de anomalias"
        >
          <RefreshIcon />
          {atualizando ? 'Atualizando…' : 'Atualizar'}
        </button>
      }
    >
      <p className="adm-anom-explica">
        Apontamentos ativos abertos há mais de{' '}
        <b className="gd-tabular">{tetoHoras}h</b> — provável esquecimento de fechar
        (apontamento-fantasma). Feche para corrigir o tempo trabalhado.
      </p>

      {okMsg && <div className="adm-flash fam-ok adm-anom-flash">{okMsg}</div>}
      {erro && <div className="adm-flash fam-bad adm-anom-flash">{erro}</div>}

      {lista.status === 'loading' && <p className="adm-anom-info">Procurando anomalias…</p>}

      {lista.status === 'error' && (
        <div className="adm-flash fam-bad adm-anom-flash">
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
              <CheckShieldIcon />
            </span>
            <span className="adm-empty__tit">Nenhuma anomalia</span>
            <span className="adm-empty__sub">
              Todos os apontamentos ativos estão dentro do teto de {tetoHoras}h.
            </span>
          </div>
        </div>
      )}

      {lista.status === 'success' && (
        <div className="adm-anom-lista">
          {lista.data.map((a) => {
            const aberto = corrigindoId === a.id;
            return (
              <div className={'adm-card adm-anom-item' + (aberto ? ' is-aberto' : '')} key={a.id}>
                <div className="adm-anom-linha">
                  <div className="adm-anom-info">
                    <strong className="adm-anom-nome">{a.nome_funcionario}</strong>
                    <span className="adm-anom-sub">
                      <span className="adm-anom-placa gd-tabular">{a.placa ?? '—'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{a.etapa ?? 'sem etapa'}</span>
                      <em className={'adm-pill adm-anom-statuspill fam-' + familiaStatusTarefa(a.status_tarefa)}>
                        {a.status_tarefa}
                      </em>
                    </span>
                  </div>
                  <span className="adm-anom-horas gd-tabular" title="Horas em aberto">
                    {a.horasDecorridas.toFixed(1).replace('.', ',')}h
                  </span>
                  <button
                    className="adm-btn adm-btn--primary adm-anom-btn"
                    onClick={() => abrirCorrecao(a)}
                    disabled={aberto}
                  >
                    Corrigir
                  </button>
                </div>

                {aberto && (
                  <div className="adm-anom-correcao">
                    <label className="adm-field adm-anom-campo">
                      <span className="adm-field__label">Motivo (obrigatório)</span>
                      <textarea
                        className="adm-input adm-anom-motivo"
                        value={motivoTxt}
                        onChange={(e) => setMotivoTxt(e.target.value)}
                        placeholder="Ex.: operário esqueceu de finalizar ao sair."
                        rows={2}
                        autoFocus
                      />
                    </label>
                    <label className="adm-field adm-anom-campo">
                      <span className="adm-field__label">Tipo</span>
                      <select
                        className="adm-select"
                        value={motivoCod}
                        onChange={(e) => setMotivoCod(e.target.value as MotivoCodigo)}
                      >
                        <option value="esqueceu_parar">Esqueceu de parar</option>
                        <option value="saiu_sem_registrar">Saiu sem registrar</option>
                        <option value="erro_toque">Erro de toque</option>
                        <option value="outro">Outro</option>
                      </select>
                    </label>
                    <div className="adm-anom-acoes">
                      <button
                        type="button"
                        className="adm-btn adm-btn--ghost"
                        onClick={cancelarCorrecao}
                        disabled={salvando}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="adm-btn adm-btn--primary"
                        onClick={() => confirmarCorrecao(a)}
                        disabled={salvando || !motivoTxt.trim()}
                      >
                        {salvando ? 'Registrando…' : 'Registrar correção'}
                      </button>
                    </div>
                    <p className="adm-anom-nota">
                      O tempo original é preservado. Fica registrado quem corrigiu, quando e por quê.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <EstilosAnomalias />
    </AdminShell>
  );
}

/**
 * Família semântica do status do apontamento (só apresentação): "Em andamento"
 * = ok (verde), "Pausado" = warn (âmbar). Vira a pílula-com-dot do shell. Não
 * muda nenhum dado — o status segue vindo do apontamento.
 */
function familiaStatusTarefa(status: string): 'ok' | 'warn' | 'neutral' {
  if (status === 'Em andamento') return 'ok';
  if (status === 'Pausado') return 'warn';
  return 'neutral';
}

/**
 * Estilos ESPECÍFICOS da tela de anomalias (namespaced `adm-anom-*`) no idioma
 * ESCURO do totem: a lista de cartões-fantasma, as HORAS em estilo "instrumento"
 * (--red que brilha, mono) e o formulário de correção append-only inline. O
 * chrome e a linguagem de cartão/flash/empty/botão/campo vêm do AdminShell.
 * Tokens da camada do totem (--bg-*, --text-*, --red-*); números com `gd-tabular`.
 */
function EstilosAnomalias() {
  return (
    <style jsx global>{`
      .adm-anom-explica {
        color: var(--text-secondary);
        font-size: 14px;
        line-height: 1.5;
        margin: 0 0 18px;
        max-width: 70ch;
      }
      .adm-anom-explica b {
        color: var(--text-primary);
        font-weight: 700;
      }
      .adm-anom-info {
        padding: 24px;
        color: var(--text-secondary);
        font-size: 14px;
      }
      .adm-anom-flash {
        margin-bottom: 16px;
      }

      /* Lista de fantasmas: cartões escuros empilhados */
      .adm-anom-lista {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .adm-anom-item.is-aberto {
        border-color: rgba(28, 132, 173, 0.4);
      }

      /* Linha-resumo do fantasma */
      .adm-anom-linha {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px 20px;
      }
      .adm-anom-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }
      .adm-anom-nome {
        font-size: 15px;
        font-weight: 700;
        color: var(--text-primary);
      }
      .adm-anom-sub {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 7px;
        font-size: 13px;
        color: var(--text-secondary);
      }
      /* Status do apontamento como pílula-com-dot (uma cor = um significado):
         compacta levemente para assentar na sub-linha do fantasma. */
      .adm-anom-statuspill {
        font-size: 11px;
        padding: 2px 9px 2px 8px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      /* Placa = "instrumento" do totem: caixa escura + borda teal + mono */
      .adm-anom-placa {
        font-family: var(--font-jetbrains-mono), ui-monospace, 'SFMono-Regular', monospace;
        font-weight: 700;
        font-size: 12px;
        letter-spacing: 0.1em;
        color: var(--text-primary);
        background: rgba(3, 7, 15, 0.6);
        border: 1px solid rgba(28, 132, 173, 0.4);
        border-radius: 6px;
        padding: 2px 8px;
      }

      /* Horas em aberto: número-instrumento vermelho (sinal de risco). Vermelho
         mais claro p/ ler de longe; SEM glow (glow reservado ao mostrador-herói
         do prazo + dot vivo "produzindo" — não a cada linha de anomalia). */
      .adm-anom-horas {
        flex-shrink: 0;
        font-family: var(--font-jetbrains-mono), ui-monospace, 'SFMono-Regular', monospace;
        font-weight: 800;
        font-size: 18px;
        letter-spacing: 0.02em;
        color: var(--adm-bad-bright);
      }
      .adm-anom-btn {
        flex-shrink: 0;
      }

      /* Formulário de correção inline (append-only) — superfície prensada mais
         baixa, separada por hairline do topo */
      .adm-anom-correcao {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 18px 20px 20px;
        border-top: 1px solid var(--border-default);
        background: rgba(3, 7, 15, 0.35);
        border-radius: 0 0 var(--radius-lg) var(--radius-lg);
      }
      /* Os campos do shell trazem margin-bottom; aqui o gap do flex já cuida. */
      .adm-anom-campo {
        margin-bottom: 0;
      }
      .adm-anom-motivo {
        resize: vertical;
        min-height: 60px;
        line-height: 1.45;
      }
      .adm-anom-acoes {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 2px;
      }
      .adm-anom-nota {
        font-size: 12px;
        color: var(--text-muted);
        margin: 0;
        line-height: 1.45;
      }

      @media (max-width: 560px) {
        .adm-anom-linha {
          flex-wrap: wrap;
          gap: 12px;
        }
        .adm-anom-info {
          flex-basis: 100%;
        }
        .adm-anom-acoes {
          flex-direction: column-reverse;
        }
        .adm-anom-acoes .adm-btn {
          width: 100%;
        }
      }
    `}</style>
  );
}
