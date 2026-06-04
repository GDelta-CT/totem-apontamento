'use client';

/**
 * Totem GDelta — Apontamento (produtividade).
 *
 * Fluxo: toca no nome → busca a OS pela placa → escolhe a etapa → roda o
 * cronômetro (trabalhar / pausar / finalizar). Sem ponto/jornada: a GDelta é
 * produto de produtividade, não de presença (camada de ponto removida).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  buscarApontamentoAtivo,
  buscarOSPorPlaca,
  finalizarApontamento,
  formatarHora,
  iniciarApontamento,
  normalizarPlaca,
  pausarApontamento,
  retomarApontamento,
  useCronometro,
  useFocoAutomatico,
  useFuncionariosAtivos,
  useTempoPausado,
  type FetchState,
} from '@/lib/supabase/queries';
import {
  COMPLEXIDADES,
  COMPLEXIDADE_PADRAO,
  ETAPAS,
  MOTIVOS_PAUSA,
  buscarEtapa,
  buscarMotivoPausa,
  type Apontamento,
  type ComplexidadeId,
  type EtapaInfo,
  type Funcionario,
  type MotivoPausaId,
  type OrdemServico,
} from '@/lib/supabase/client';
import { DeviceAuthGate } from './DeviceAuthGate';

// Wrapper: exige sessão do device (oficina) antes de abrir o totem.
// Assim os hooks de dados só rodam quando há JWT com oficina_id.
export default function TotemPage() {
  return (
    <DeviceAuthGate>
      <TotemApp />
    </DeviceAuthGate>
  );
}

type Tela =
  | 'selecionar-funcionario'
  | 'verificar-recovery'
  | 'recovery-erro'
  | 'consultar-os'
  | 'resultado-os'
  | 'selecionar-etapa'
  | 'trabalhando'
  | 'selecionar-motivo-pausa'
  | 'tarefa-pausada'
  | 'finalizar-confirmar'
  | 'tarefa-finalizada';

function TotemApp() {
  const [tela, setTela] = useState<Tela>('selecionar-funcionario');
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [resultadoOS, setResultadoOS] = useState<FetchState<OrdemServico>>({
    status: 'idle',
  });
  const [etapaSelecionada, setEtapaSelecionada] = useState<EtapaInfo | null>(null);
  const [apontamentoAtivo, setApontamentoAtivo] = useState<Apontamento | null>(null);
  const [osDoApontamento, setOsDoApontamento] = useState<OrdemServico | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [carregandoAcao, setCarregandoAcao] = useState(false);
  // Extras do apontamento (escopo travado): começam no padrão = zero toque extra.
  const [retrabalho, setRetrabalho] = useState(false);
  const [complexidade, setComplexidade] = useState<ComplexidadeId>(COMPLEXIDADE_PADRAO);

  const voltarInicio = () => {
    setFuncionario(null);
    setResultadoOS({ status: 'idle' });
    setEtapaSelecionada(null);
    setApontamentoAtivo(null);
    setOsDoApontamento(null);
    setErroAcao(null);
    setRetrabalho(false);
    setComplexidade(COMPLEXIDADE_PADRAO);
    setTela('selecionar-funcionario');
  };

  const selecionarFuncionario = async (f: Funcionario) => {
    setFuncionario(f);
    setErroAcao(null);
    setTela('verificar-recovery');

    // Recovery: confere se já existe tarefa ativa antes de deixar começar do zero.
    const r = await buscarApontamentoAtivo(f.nome);
    if (r.status === 'success') {
      setApontamentoAtivo(r.data);
      setOsDoApontamento(r.data.ordem_servico);
      if (r.data.status_tarefa === 'Pausado') {
        setTela('tarefa-pausada');
      } else {
        setTela('trabalhando');
      }
    } else if (r.status === 'empty') {
      // Confirmado SEM tarefa ativa: segue para a busca de OS (sem ponto, sem menu).
      setTela('consultar-os');
    } else {
      // ERRO (ex.: queda de conexão): NÃO seguimos pro fluxo de começar do zero —
      // começar agora poderia DUPLICAR um apontamento que talvez esteja ativo.
      // Mostra erro amigável e deixa tentar de novo (ou SAIR pelo header).
      setErroAcao(
        'Não consegui conferir se você tem uma tarefa em andamento. Verifique a conexão e toque para tentar de novo.'
      );
      setTela('recovery-erro');
    }
  };

  // Adoção: a escolha da etapa É a confirmação — iniciar já leva pra "trabalhando".
  // A etapa chega SEMPRE POR PARÂMETRO (não pelo estado etapaSelecionada, que o
  // setState ainda não aplicou no mesmo tick): todos os chamadores já passam a
  // etapa, então não há fallback dependente de timing.
  const iniciarTarefa = async (etapa: EtapaInfo) => {
    if (!funcionario || resultadoOS.status !== 'success') return;
    setEtapaSelecionada(etapa);
    setCarregandoAcao(true);
    setErroAcao(null);
    const r = await iniciarApontamento({
      ordemServicoId: resultadoOS.data.id,
      nomeFuncionario: funcionario.nome,
      cargoFuncionario: funcionario.cargo || '—',
      etapa: etapa.id,
      retrabalho,
      complexidade,
    });
    setCarregandoAcao(false);
    if (r.status === 'success') {
      setApontamentoAtivo(r.data);
      setOsDoApontamento(resultadoOS.data);
      setTela('trabalhando');
    } else if (r.status === 'error') {
      // Erro fica INLINE na própria tela de etapa (com retry), nunca some calado.
      setErroAcao(r.message);
    }
  };

  const pausarTarefa = async (motivo: MotivoPausaId) => {
    if (!apontamentoAtivo) return;
    setCarregandoAcao(true);
    setErroAcao(null);
    const r = await pausarApontamento({
      apontamentoId: apontamentoAtivo.id,
      motivo,
    });
    setCarregandoAcao(false);
    if (r.status === 'success') {
      setApontamentoAtivo(r.data);
      setTela('tarefa-pausada');
    } else if (r.status === 'error') {
      setErroAcao(r.message);
    }
  };

  const retomarTarefa = async () => {
    if (!apontamentoAtivo) return;
    setCarregandoAcao(true);
    setErroAcao(null);
    const r = await retomarApontamento(apontamentoAtivo);
    setCarregandoAcao(false);
    if (r.status === 'success') {
      setApontamentoAtivo(r.data);
      setTela('trabalhando');
    } else if (r.status === 'error') {
      setErroAcao(r.message);
    }
  };

  const finalizarTarefa = async () => {
    if (!apontamentoAtivo) return;
    setCarregandoAcao(true);
    setErroAcao(null);
    const r = await finalizarApontamento(apontamentoAtivo);
    setCarregandoAcao(false);
    if (r.status === 'success') {
      setApontamentoAtivo(null);
      setEtapaSelecionada(null);
      setTela('tarefa-finalizada');
      setTimeout(() => {
        setOsDoApontamento(null);
        voltarInicio();
      }, 3000);
    } else if (r.status === 'error') {
      setErroAcao(r.message);
    }
  };


  return (
    <main className="totem-root">
      <Header
        funcionario={funcionario}
        emTarefa={
          tela === 'trabalhando' ||
          tela === 'selecionar-motivo-pausa' ||
          tela === 'finalizar-confirmar'
        }
        pausada={tela === 'tarefa-pausada'}
        onSair={voltarInicio}
      />

      <section className="totem-area">
        {tela === 'selecionar-funcionario' && (
          <TelaSelecionarFuncionario onSelecionar={selecionarFuncionario} />
        )}

        {tela === 'verificar-recovery' && (
          <Carregando texto="Conferindo se você tinha tarefa em andamento..." />
        )}

        {tela === 'recovery-erro' && (
          <Erro
            mensagem={erroAcao ?? 'Não consegui conferir agora. Toque para tentar de novo.'}
            onTentar={() => funcionario && selecionarFuncionario(funcionario)}
          />
        )}

        {tela === 'consultar-os' && (
          <TelaConsultarOS
            onResultado={(r) => {
              setResultadoOS(r);
              // Caminho feliz: achou o carro (1 OS ativa) -> direto pra escolher a
              // etapa, pulando a tela de confirmação do carro. Vazio/erro caem na
              // tela de resultado (fallback) com a mensagem e o "tentar de novo".
              if (r.status === 'success') {
                setErroAcao(null);
                setEtapaSelecionada(null);
                setRetrabalho(false);
                setComplexidade(COMPLEXIDADE_PADRAO);
                setTela('selecionar-etapa');
              } else {
                setTela('resultado-os');
              }
            }}
            onVoltar={voltarInicio}
          />
        )}

        {tela === 'resultado-os' && (
          <TelaResultadoOS
            resultado={resultadoOS}
            onIniciarTarefa={() => {
              setErroAcao(null);
              setEtapaSelecionada(null);
              setRetrabalho(false);
              setComplexidade(COMPLEXIDADE_PADRAO);
              setTela('selecionar-etapa');
            }}
            onNovaConsulta={() => {
              setResultadoOS({ status: 'idle' });
              setTela('consultar-os');
            }}
            onVoltar={voltarInicio}
          />
        )}

        {tela === 'selecionar-etapa' && resultadoOS.status === 'success' && (
          <TelaSelecionarEtapa
            os={resultadoOS.data}
            etapaIniciando={carregandoAcao ? etapaSelecionada : null}
            carregando={carregandoAcao}
            erro={erroAcao}
            retrabalho={retrabalho}
            onToggleRetrabalho={setRetrabalho}
            complexidade={complexidade}
            onComplexidade={setComplexidade}
            onEscolher={(etapa) => iniciarTarefa(etapa)}
            onVoltar={() => {
              setResultadoOS({ status: 'idle' });
              setErroAcao(null);
              setTela('consultar-os');
            }}
          />
        )}

        {tela === 'trabalhando' && apontamentoAtivo && osDoApontamento && (
          <TelaTrabalhando
            apontamento={apontamentoAtivo}
            os={osDoApontamento}
            onPedirPausar={() => {
              setErroAcao(null);
              setTela('selecionar-motivo-pausa');
            }}
            onPedirFinalizar={() => {
              setErroAcao(null);
              setTela('finalizar-confirmar');
            }}
          />
        )}

        {tela === 'selecionar-motivo-pausa' && apontamentoAtivo && osDoApontamento && (
          <TelaSelecionarMotivoPausa
            os={osDoApontamento}
            carregando={carregandoAcao}
            erro={erroAcao}
            onEscolher={pausarTarefa}
            onCancelar={() => setTela('trabalhando')}
          />
        )}

        {tela === 'tarefa-pausada' && apontamentoAtivo && osDoApontamento && (
          <TelaTarefaPausada
            apontamento={apontamentoAtivo}
            os={osDoApontamento}
            carregando={carregandoAcao}
            erro={erroAcao}
            onRetomar={retomarTarefa}
            onFinalizar={() => {
              setErroAcao(null);
              setTela('finalizar-confirmar');
            }}
          />
        )}

        {tela === 'finalizar-confirmar' && apontamentoAtivo && osDoApontamento && (
          <TelaFinalizarConfirmar
            apontamento={apontamentoAtivo}
            os={osDoApontamento}
            carregando={carregandoAcao}
            erro={erroAcao}
            onConfirmar={finalizarTarefa}
            onCancelar={() =>
              setTela(
                apontamentoAtivo.status_tarefa === 'Pausado' ? 'tarefa-pausada' : 'trabalhando'
              )
            }
          />
        )}

        {tela === 'tarefa-finalizada' && (
          <TelaTarefaFinalizada onConcluir={voltarInicio} />
        )}
      </section>

      <Estilos />
    </main>
  );
}

/* ─────────────────── Header ─────────────────── */

function Header({
  funcionario,
  emTarefa,
  pausada,
  onSair,
}: {
  funcionario: Funcionario | null;
  emTarefa: boolean;
  pausada: boolean;
  onSair: () => void;
}) {
  const [hora, setHora] = useState<Date | null>(null);
  useEffect(() => {
    setHora(new Date());
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="totem-header">
      <div className="brand">
        <span className="brand-seal">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-mark" src="/gdelta-totem-symbol.png" alt="GDelta" />
        </span>
        <span className="brand-name">GDelta · Apontamento</span>
        {emTarefa && <span className="status-pill">EM TAREFA</span>}
        {pausada && <span className="status-pill pausado">PAUSADO</span>}
      </div>
      <div className="header-right">
        <time className="hora" suppressHydrationWarning>
          {hora ? hora.toLocaleTimeString('pt-BR', { hour12: false }) : '--:--:--'}
        </time>
        {funcionario && !emTarefa && !pausada && (
          <button className="btn-ghost" onClick={onSair} aria-label="Sair">
            <span className="op-name">{funcionario.nome.split(' ')[0]}</span>
            <span className="op-sair">SAIR</span>
          </button>
        )}
        {funcionario && (emTarefa || pausada) && (
          <span className="op-trabalhando">
            <span className="op-name">{funcionario.nome.split(' ')[0]}</span>
            <span className="op-sair">{pausada ? 'pausado' : 'trabalhando'}</span>
          </span>
        )}
      </div>
    </header>
  );
}

/* ─────────────── Tela: Selecionar Funcionário ─────────────── */

function TelaSelecionarFuncionario({ onSelecionar }: { onSelecionar: (f: Funcionario) => void }) {
  const { state, recarregar } = useFuncionariosAtivos();

  return (
    <div className="tela">
      <h1 className="tela-titulo">QUEM VAI TRABALHAR?</h1>
      <p className="tela-sub">Toque no seu nome para começar.</p>

      {state.status === 'loading' && <Carregando texto="Buscando a equipe..." />}
      {state.status === 'error' && <Erro mensagem={state.message} onTentar={recarregar} />}
      {state.status === 'empty' && (
        <Vazio
          titulo="Ninguém cadastrado ainda"
          dica="Peça ao administrador para cadastrar a equipe no painel."
          onTentar={recarregar}
        />
      )}
      {state.status === 'success' && (
        <ul className="grid-funcs">
          {state.data.map((f) => (
            <li key={f.id}>
              <button className="card-func" onClick={() => onSelecionar(f)} type="button">
                <span className="avatar">{iniciais(f.nome)}</span>
                <span className="card-func-nome">{f.nome}</span>
                {f.cargo && <span className="card-func-cargo">{f.cargo}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─────────────── Tela: Consultar OS ─────────────── */

function TelaConsultarOS({
  onResultado,
  onVoltar,
}: {
  onResultado: (r: FetchState<OrdemServico>) => void;
  onVoltar: () => void;
}) {
  const inputRef = useFocoAutomatico<HTMLInputElement>();
  const [placa, setPlaca] = useState('');
  const [buscando, setBuscando] = useState(false);
  const placaNormalizada = useMemo(() => normalizarPlaca(placa), [placa]);
  const podeBuscar = placaNormalizada.length >= 6 && !buscando;

  const buscar = async () => {
    if (!podeBuscar) return;
    setBuscando(true);
    const r = await buscarOSPorPlaca(placaNormalizada);
    setBuscando(false);
    onResultado(r);
  };

  return (
    <div className="tela">
      <h1 className="tela-titulo">QUAL É O CARRO?</h1>
      <p className="tela-sub">Digite a placa e toque em buscar.</p>

      <div className="placa-wrap">
        <input
          ref={inputRef}
          className="placa-input"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={8}
          placeholder="ABC1D23"
          value={placa}
          onChange={(e) => setPlaca(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
        />
        <div className="placa-counter">{placaNormalizada.length}/7</div>
      </div>

      <div className="acoes-linha">
        <button className="btn-secundario" onClick={onVoltar} disabled={buscando}>
          VOLTAR
        </button>
        <button className="btn-primario" onClick={buscar} disabled={!podeBuscar}>
          {buscando ? 'PROCURANDO...' : 'BUSCAR CARRO'}
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Tela: Resultado OS ─────────────── */

function TelaResultadoOS({
  resultado,
  onIniciarTarefa,
  onNovaConsulta,
  onVoltar,
}: {
  resultado: FetchState<OrdemServico>;
  onIniciarTarefa: () => void;
  onNovaConsulta: () => void;
  onVoltar: () => void;
}) {
  return (
    <div className="tela">
      {resultado.status === 'loading' && <Carregando texto="Procurando o carro..." />}
      {resultado.status === 'error' && (
        <Erro mensagem={resultado.message} onTentar={onNovaConsulta} />
      )}
      {resultado.status === 'empty' && (
        <Vazio
          titulo="Carro não encontrado"
          dica="Confira a placa que você digitou. Se não aparecer, fale com o administrador."
          onTentar={onNovaConsulta}
        />
      )}
      {resultado.status === 'success' && (
        <article className="os-card">
          <div className="os-header">
            <span className="os-tag">CARRO</span>
            <span
              className={`os-status status-${(resultado.data.status_geral || 'aberta').toLowerCase().replace(/\s+/g, '-')}`}
            >
              {resultado.data.status_geral || 'ABERTA'}
            </span>
          </div>
          <h2 className="os-veiculo">{resultado.data.modelo_veiculo}</h2>
          <div className="os-placa-display">{formatarPlaca(resultado.data.placa)}</div>

          <dl className="os-grid">
            {resultado.data.data_entrada && (
              <>
                <dt>ABERTA EM</dt>
                <dd>{new Date(resultado.data.data_entrada).toLocaleString('pt-BR')}</dd>
              </>
            )}
          </dl>

          <button className="btn-iniciar" onClick={onIniciarTarefa}>
            <span className="btn-iniciar-icone" aria-hidden>
              ▶
            </span>
            É ESTE CARRO
          </button>

          <div className="acoes-linha">
            <button className="btn-secundario" onClick={onVoltar}>
              VOLTAR
            </button>
            <button className="btn-secundario" onClick={onNovaConsulta}>
              OUTRO CARRO
            </button>
          </div>
        </article>
      )}
    </div>
  );
}

/* ─────────────── Tela: Selecionar Etapa ─────────────── */

function TelaSelecionarEtapa({
  os,
  etapaIniciando,
  carregando,
  erro,
  retrabalho,
  onToggleRetrabalho,
  complexidade,
  onComplexidade,
  onEscolher,
  onVoltar,
}: {
  os: OrdemServico;
  etapaIniciando: EtapaInfo | null;
  carregando: boolean;
  erro: string | null;
  retrabalho: boolean;
  onToggleRetrabalho: (v: boolean) => void;
  complexidade: ComplexidadeId;
  onComplexidade: (c: ComplexidadeId) => void;
  onEscolher: (etapa: EtapaInfo) => void;
  onVoltar: () => void;
}) {
  return (
    <div className="tela">
      <h1 className="tela-titulo">O QUE VOCÊ VAI FAZER?</h1>
      <p className="tela-sub">Toque na etapa e o cronômetro já começa.</p>

      {/* Confirma o carro no topo: o operário tem certeza de em qual carro vai
          bater o tempo. É CLICÁVEL — se a placa trouxe o carro errado, um toque
          aqui volta pra busca (mesma ação do botão "OUTRO CARRO"), antes de
          iniciar o cronômetro no carro errado. */}
      <button
        type="button"
        className="etapa-carro"
        onClick={onVoltar}
        disabled={carregando}
        aria-label={`Carro ${os.modelo_veiculo}, placa ${formatarPlaca(os.placa)}. Toque para trocar de carro.`}
      >
        <span className="etapa-carro-tag">CARRO</span>
        <span className="etapa-carro-modelo">{os.modelo_veiculo}</span>
        <span className="etapa-carro-placa">{formatarPlaca(os.placa)}</span>
        <span className="etapa-carro-trocar" aria-hidden>
          ↺ trocar carro
        </span>
      </button>

      {erro && (
        <div className="erro-inline" role="alert" style={{ marginBottom: 16 }}>
          <span aria-hidden>⚠</span> {erro} Toque na etapa de novo para tentar.
        </div>
      )}

      {/* Extras do apontamento (escopo travado): retrabalho + complexidade.
          Já vêm no padrão (off / Simples) — tocar a etapa inicia sem toque extra. */}
      <div className="etapa-extras">
        <button
          type="button"
          className={`retrab-toggle ${retrabalho ? 'retrab-toggle-on' : ''}`}
          onClick={() => onToggleRetrabalho(!retrabalho)}
          disabled={carregando}
          aria-pressed={retrabalho}
        >
          <span className="retrab-check" aria-hidden>
            {retrabalho ? '✓' : ''}
          </span>
          Retrabalho
        </button>

        <div className="complex-group" role="group" aria-label="Complexidade da tarefa">
          <span className="complex-label">Complexidade</span>
          <div className="complex-seg">
            {COMPLEXIDADES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`complex-btn ${complexidade === c.id ? 'complex-btn-on' : ''}`}
                onClick={() => onComplexidade(c.id)}
                disabled={carregando}
                aria-pressed={complexidade === c.id}
              >
                {c.nome}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ul className="grid-etapas" aria-busy={carregando}>
        {ETAPAS.map((e) => {
          const iniciandoEsta = !!etapaIniciando && etapaIniciando.id === e.id;
          return (
            <li key={e.id}>
              <button
                className={`card-etapa ${iniciandoEsta ? 'card-etapa-iniciando' : ''}`}
                onClick={() => onEscolher(e)}
                disabled={carregando}
                type="button"
              >
                <span className="card-etapa-num">{e.ordem.toString().padStart(2, '0')}</span>
                <span className="card-etapa-icone" aria-hidden>
                  {e.icone}
                </span>
                <span className="card-etapa-nome">{e.nome}</span>
                <span className="card-etapa-desc">
                  {iniciandoEsta ? 'Começando...' : e.descricao}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="acoes-linha" style={{ marginTop: 24 }}>
        <button className="btn-secundario" onClick={onVoltar} disabled={carregando}>
          OUTRO CARRO
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Tela: Trabalhando ─────────────── */

function TelaTrabalhando({
  apontamento,
  os,
  onPedirPausar,
  onPedirFinalizar,
}: {
  apontamento: Apontamento;
  os: OrdemServico;
  onPedirPausar: () => void;
  onPedirFinalizar: () => void;
}) {
  const { formatado } = useCronometro(apontamento.hora_inicio, null, apontamento.tempo_pausado_seg);
  const etapa = buscarEtapa(apontamento.etapa);

  return (
    <div className="tela tela-trabalhando">
      <div className="trabalhando-info">
        <span className="trabalhando-tag">EM TAREFA</span>
        {etapa && (
          <div className="trabalhando-etapa">
            <span className="trabalhando-etapa-icone" aria-hidden>
              {etapa.icone}
            </span>
            <span className="trabalhando-etapa-nome">{etapa.nome}</span>
          </div>
        )}
        <h2 className="trabalhando-veiculo">{os.modelo_veiculo}</h2>
        <div className="trabalhando-placa">{formatarPlaca(os.placa)}</div>
      </div>

      <div className="cronometro-wrap" aria-live="polite">
        <div className="cronometro-label">TEMPO TRABALHADO</div>
        <div className="cronometro-display" suppressHydrationWarning>
          {formatado}
        </div>
      </div>

      <div className="botoes-tarefa">
        <button className="btn-pausar" onClick={onPedirPausar}>
          <span aria-hidden>⏸</span> PAUSAR
        </button>
        <button className="btn-finalizar" onClick={onPedirFinalizar}>
          <span aria-hidden>⏹</span> FINALIZAR
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Tela: Selecionar Motivo de Pausa ─────────────── */

function TelaSelecionarMotivoPausa({
  os,
  carregando,
  erro,
  onEscolher,
  onCancelar,
}: {
  os: OrdemServico;
  carregando: boolean;
  erro: string | null;
  onEscolher: (motivo: MotivoPausaId) => void;
  onCancelar: () => void;
}) {
  const tecnicas = MOTIVOS_PAUSA.filter((m) => m.categoria === 'tecnica');
  const pessoais = MOTIVOS_PAUSA.filter((m) => m.categoria === 'pessoal');

  return (
    <div className="tela">
      <h1 className="tela-titulo">POR QUE VAI PAUSAR?</h1>
      <p className="tela-sub">
        Carro: <span className="destaque">{os.modelo_veiculo}</span> · {formatarPlaca(os.placa)}
      </p>

      <div className="aviso-15min">
        <span aria-hidden>⚠</span>{' '}
        <strong>Pausa só se for ficar parado por mais de 15 minutos.</strong> Pra água, banheiro ou
        pegar ferramenta rápida — NÃO pause.
      </div>

      <h3 className="motivo-categoria">⚙ A tarefa não pode continuar</h3>
      <ul className="grid-motivos">
        {tecnicas.map((m) => (
          <li key={m.id}>
            <button
              className={`card-motivo ${m.alerta ? 'card-motivo-alerta' : ''}`}
              onClick={() => onEscolher(m.id)}
              disabled={carregando}
              type="button"
            >
              <span className="card-motivo-icone" aria-hidden>
                {m.icone}
              </span>
              <div className="card-motivo-texto">
                <div className="card-motivo-nome">{m.nome}</div>
                <div className="card-motivo-desc">{m.descricao}</div>
                {m.alerta && <div className="card-motivo-alerta-tag">AVISA O ADMIN</div>}
              </div>
            </button>
          </li>
        ))}
      </ul>

      <h3 className="motivo-categoria" style={{ marginTop: 24 }}>
        👤 Eu preciso parar
      </h3>
      <ul className="grid-motivos">
        {pessoais.map((m) => (
          <li key={m.id}>
            <button
              className="card-motivo"
              onClick={() => onEscolher(m.id)}
              disabled={carregando}
              type="button"
            >
              <span className="card-motivo-icone" aria-hidden>
                {m.icone}
              </span>
              <div className="card-motivo-texto">
                <div className="card-motivo-nome">{m.nome}</div>
                <div className="card-motivo-desc">{m.descricao}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {erro && (
        <div className="erro-inline" style={{ marginTop: 20 }}>
          <span aria-hidden>⚠</span> {erro}
        </div>
      )}

      <div className="acoes-linha" style={{ marginTop: 28 }}>
        <button className="btn-secundario" onClick={onCancelar} disabled={carregando}>
          CANCELAR — VOLTAR PRA TAREFA
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Tela: Tarefa Pausada ─────────────── */

function TelaTarefaPausada({
  apontamento,
  os,
  carregando,
  erro,
  onRetomar,
  onFinalizar,
}: {
  apontamento: Apontamento;
  os: OrdemServico;
  carregando: boolean;
  erro: string | null;
  onRetomar: () => void;
  onFinalizar: () => void;
}) {
  const { formatado } = useCronometro(
    apontamento.hora_inicio,
    apontamento.pausado_em,
    apontamento.tempo_pausado_seg
  );
  const etapa = buscarEtapa(apontamento.etapa);
  const motivo = buscarMotivoPausa(apontamento.motivo_pausa);
  const tempoPausado = useTempoPausado(apontamento.pausado_em);

  return (
    <div className="tela tela-pausada">
      <div className="pausada-banner">
        <span className="pausada-banner-icone" aria-hidden>
          ⏸
        </span>
        <div>
          <div className="pausada-banner-tag">TAREFA PAUSADA</div>
          {motivo && (
            <div className="pausada-banner-motivo">
              {motivo.icone} {motivo.nome}
            </div>
          )}
          {tempoPausado && <div className="pausada-banner-tempo">Pausado {tempoPausado}</div>}
        </div>
      </div>

      <div className="trabalhando-info">
        {etapa && (
          <div className="trabalhando-etapa">
            <span className="trabalhando-etapa-icone" aria-hidden>
              {etapa.icone}
            </span>
            <span className="trabalhando-etapa-nome">{etapa.nome}</span>
          </div>
        )}
        <h2 className="trabalhando-veiculo">{os.modelo_veiculo}</h2>
        <div className="trabalhando-placa">{formatarPlaca(os.placa)}</div>
      </div>

      <div className="cronometro-wrap cronometro-pausado">
        <div className="cronometro-label">TEMPO TRABALHADO (CONGELADO)</div>
        <div className="cronometro-display" suppressHydrationWarning>
          {formatado}
        </div>
      </div>

      {erro && (
        <div className="erro-inline">
          <span aria-hidden>⚠</span> {erro}
        </div>
      )}

      <div className="botoes-tarefa">
        <button
          className="btn-finalizar btn-finalizar-secundario"
          onClick={onFinalizar}
          disabled={carregando}
        >
          <span aria-hidden>⏹</span> FINALIZAR
        </button>
        <button className="btn-retomar" onClick={onRetomar} disabled={carregando}>
          {carregando ? 'RETOMANDO...' : '▶ RETOMAR TAREFA'}
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Tela: Confirmar Finalizar ─────────────── */

function TelaFinalizarConfirmar({
  apontamento,
  os,
  carregando,
  erro,
  onConfirmar,
  onCancelar,
}: {
  apontamento: Apontamento;
  os: OrdemServico;
  carregando: boolean;
  erro: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const { formatado } = useCronometro(
    apontamento.hora_inicio,
    apontamento.pausado_em,
    apontamento.tempo_pausado_seg
  );
  const etapa = buscarEtapa(apontamento.etapa);

  return (
    <div className="tela">
      <h1 className="tela-titulo">FINALIZAR TAREFA?</h1>
      <p className="tela-sub">Confira os dados antes de salvar.</p>

      <article className="confirmacao-card">
        {etapa && (
          <div className="confirmacao-etapa">
            <span className="confirmacao-etapa-icone" aria-hidden>
              {etapa.icone}
            </span>
            <div>
              <div className="confirmacao-etapa-tag">ETAPA</div>
              <div className="confirmacao-etapa-nome">{etapa.nome}</div>
            </div>
          </div>
        )}
        <div
          style={{
            paddingTop: etapa ? 20 : 0,
            marginTop: etapa ? 20 : 0,
            borderTop: etapa ? '1px solid var(--line)' : 'none',
          }}
        >
          <h2 className="os-veiculo">{os.modelo_veiculo}</h2>
          <div className="os-placa-display">{formatarPlaca(os.placa)}</div>
          <div className="cronometro-resumo">
            <span className="cronometro-resumo-label">TEMPO TRABALHADO</span>
            <span className="cronometro-resumo-valor" suppressHydrationWarning>
              {formatado}
            </span>
          </div>
        </div>
      </article>

      {erro && (
        <div className="erro-inline">
          <span aria-hidden>⚠</span> {erro}
        </div>
      )}

      <div className="acoes-linha">
        <button className="btn-secundario" onClick={onCancelar} disabled={carregando}>
          {apontamento.status_tarefa === 'Pausado' ? 'VOLTAR' : 'CONTINUAR TRABALHANDO'}
        </button>
        <button className="btn-perigo" onClick={onConfirmar} disabled={carregando}>
          {carregando ? 'SALVANDO...' : '✓ FINALIZAR'}
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Tela: Tarefa Finalizada ─────────────── */

function TelaTarefaFinalizada({ onConcluir }: { onConcluir: () => void }) {
  return (
    <div className="tela tela-sucesso">
      <div className="sucesso-icone">✓</div>
      <h1 className="tela-titulo">TAREFA FINALIZADA!</h1>
      <p className="tela-sub">Apontamento salvo. Bom trabalho!</p>
      <button className="btn-primario" onClick={onConcluir}>
        CONCLUIR
      </button>
    </div>
  );
}

/* ─────────────── Componentes de Estado ─────────────── */

function Carregando({ texto }: { texto: string }) {
  return (
    <div className="estado estado-loading" role="status" aria-live="polite">
      <div className="loader" aria-hidden />
      <p>{texto}</p>
    </div>
  );
}

function Erro({ mensagem, onTentar }: { mensagem: string; onTentar: () => void }) {
  return (
    <div className="estado estado-erro" role="alert">
      <div className="estado-icone">⚠</div>
      <h2>Ops, deu ruim.</h2>
      <p>{mensagem}</p>
      <button className="btn-primario" onClick={onTentar}>
        TENTAR DE NOVO
      </button>
    </div>
  );
}

function Vazio({ titulo, dica, onTentar }: { titulo: string; dica: string; onTentar: () => void }) {
  return (
    <div className="estado estado-vazio">
      <div className="estado-icone">∅</div>
      <h2>{titulo}</h2>
      <p>{dica}</p>
      <button className="btn-primario" onClick={onTentar}>
        TENTAR DE NOVO
      </button>
    </div>
  );
}

/* ─────────────── Utils ─────────────── */

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function formatarPlaca(placa: string): string {
  const p = placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (p.length === 7) return `${p.slice(0, 3)}-${p.slice(3)}`;
  return p;
}

/* ─────────────── Estilos ─────────────── */

function Estilos() {
  return (
    <style jsx global>{`
      :root {
        /* ════ MESMO dark do /admin em TODAS as telas (decisão do fundador) ════
           O totem usa exatamente a paleta do painel: navy quase-preto + teal +
           off-white. Mais escuro/contrastado = "mais compreensível" no escuro.
           (Os valores espelham os tokens do .adm-shell para as telas casarem.) */
        --bg: var(--bg-primary); /* #0a0f1c — mesmo fundo do /admin */
        --bg-2: #1c2540; /* card — igual ao /admin (--bg-card) */
        --bg-3: #222d4d; /* hover — igual ao /admin (--bg-card-hover) */
        --line: #2d3a52; /* hairline — igual ao /admin (--border-default) */
        --ink: var(--text-primary); /* #f1f5f9 — off-white */
        --ink-soft: #b8c4d4; /* texto secundário (= /admin) */

        /* ACENTO único = teal do painel (≈ --adm-accent). Tudo que "acende" —
           avatar, botão, placa, foco, bordas — usa --warn, alias do teal
           (mantém as ~30 regras sem reescrever cada uma). */
        --accent: #1089a8; /* teal — idêntico ao --adm-accent do /admin */
        --accent-strong: var(--gd-teal-hover); /* hover do acento */
        --warn: var(--accent); /* alias legado → teal */

        /* SEMÂNTICOS — cada cor = um significado (não competem com o acento) */
        --caution: #fbbf24; /* AVISO real (regra dos 15 min) — âmbar */
        --danger: #ff4d2e; /* risco / finalizar — vermelho */
        --ok: #4ade80; /* sucesso — verde */
        --info: #8fcce8; /* informativo — ciano calmo (= /admin) */
        --running: #4ade80; /* trabalhando / cronômetro — verde */
        --paused: #fbbf24; /* pausado — âmbar */

        /* POLIMENTO (= /admin): anel de foco, glow do acento e sombra de card */
        --accent-ring: rgba(16, 137, 168, 0.22);
        --accent-glow: rgba(16, 137, 168, 0.45);
        --shadow-card: 0 1px 0 rgba(255, 255, 255, 0.06) inset,
          0 14px 34px -12px rgba(0, 0, 0, 0.7);
        --shadow-card-hover: 0 1px 0 rgba(255, 255, 255, 0.06) inset,
          0 18px 40px -14px rgba(0, 0, 0, 0.7);
      }

      @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;900&family=JetBrains+Mono:wght@500;700&display=swap');

      html,
      body {
        height: 100%;
        overflow-x: hidden;
        overflow-y: auto;
        scroll-behavior: smooth;
      }

      /* Acessibilidade: anel de foco visível e claro em tudo que recebe foco
         (uso de parede/oficina + teclado/leitor). Cobre os casos com outline:none. */
      :where(button, a, input, [tabindex]):focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
        box-shadow: 0 0 0 4px var(--accent-ring);
        border-radius: 8px;
      }

      .totem-root {
        min-height: 100%;
        background: var(--bg);
        background-image:
          radial-gradient(120% 70% at 50% -10%, rgba(28, 132, 173, 0.1) 0%, transparent 55%),
          repeating-linear-gradient(
            45deg,
            transparent 0,
            transparent 14px,
            rgba(255, 255, 255, 0.02) 14px,
            rgba(255, 255, 255, 0.02) 15px
          );
        color: var(--ink);
        font-family: 'Archivo', system-ui, sans-serif;
        display: flex;
        flex-direction: column;
      }

      .totem-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 32px;
        border-bottom: 1px solid var(--accent);
        background: linear-gradient(180deg, var(--gd-navy-soft) 0%, var(--gd-navy-deep) 100%);
        box-shadow:
          0 1px 0 rgba(16, 137, 168, 0.3),
          0 8px 24px rgba(0, 0, 0, 0.4);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }
      .brand-seal {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: #ffffff;
        border: 1px solid rgba(16, 137, 168, 0.35);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.8),
          0 4px 12px -4px rgba(0, 0, 0, 0.6);
        flex-shrink: 0;
      }
      .brand-mark {
        height: 30px;
        width: auto;
        object-fit: contain;
        display: block;
      }
      .brand-name {
        font-weight: 700;
        letter-spacing: 0.5px;
        font-size: 16px;
        color: var(--ink-soft);
        text-transform: uppercase;
      }
      .status-pill {
        background: var(--running);
        color: #000;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1.5px;
        padding: 5px 12px;
        border-radius: 999px;
        animation: pulseGreen 2s ease-in-out infinite;
      }
      .status-pill.pausado {
        background: var(--paused);
        animation: pulsePaused 2s ease-in-out infinite;
      }
      @keyframes pulseGreen {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.6;
        }
      }
      @keyframes pulsePaused {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }

      .header-right {
        display: flex;
        align-items: center;
        gap: 24px;
      }
      .hora {
        font-family: 'JetBrains Mono', monospace;
        font-size: 18px;
        color: var(--warn);
        font-weight: 700;
      }
      .btn-ghost {
        background: transparent;
        border: 1px solid var(--line);
        color: var(--ink);
        padding: 8px 16px;
        min-height: 44px;
        border-radius: 4px;
        font-family: inherit;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        line-height: 1.1;
        transition: all 120ms ease;
      }
      .btn-ghost:hover {
        border-color: var(--warn);
        color: var(--warn);
      }
      .op-name {
        font-size: 13px;
      }
      .op-sair {
        font-size: 11px;
        color: var(--ink-soft);
        letter-spacing: 1px;
      }
      .op-trabalhando {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        line-height: 1.1;
        padding: 8px 16px;
        min-height: 44px;
      }
      .op-trabalhando .op-sair {
        color: var(--running);
        text-transform: uppercase;
      }

      .totem-area {
        flex: 1;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 40px 32px;
        min-height: 0;
      }
      .tela {
        width: 100%;
        max-width: 920px;
        animation: fadeIn 200ms ease-out;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .tela-titulo {
        font-size: clamp(32px, 5vw, 56px);
        font-weight: 900;
        letter-spacing: -0.02em;
        margin: 0 0 8px;
        line-height: 1;
      }
      .tela-titulo .destaque {
        color: var(--warn);
      }
      .tela-sub {
        font-size: 18px;
        color: var(--ink-soft);
        margin: 0 0 36px;
      }
      .tela-sub .destaque {
        color: var(--ink);
        font-weight: 700;
      }

      .badge-entrada {
        display: inline-block;
        margin-left: 12px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1.5px;
        background: var(--ok);
        color: #000;
        padding: 3px 8px;
        border-radius: 3px;
        vertical-align: middle;
      }

      .grid-funcs {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 16px;
      }
      .card-func {
        width: 100%;
        background: var(--bg-2);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 24px 20px;
        color: var(--ink);
        font-family: inherit;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        box-shadow: var(--shadow-card);
        transition:
          transform 180ms cubic-bezier(0.4, 0, 0.2, 1),
          box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1),
          border-color 180ms cubic-bezier(0.4, 0, 0.2, 1),
          background 180ms ease;
        text-align: left;
      }
      .card-func:hover {
        border-color: rgba(16, 137, 168, 0.4);
        background: var(--bg-3);
        transform: translateY(-2px);
        box-shadow: var(--shadow-card-hover);
      }
      .card-func:focus-visible {
        border-color: var(--warn);
        background: var(--bg-3);
        transform: translateY(-2px);
        outline: 3px solid var(--warn);
        outline-offset: 2px;
      }
      .card-func:active {
        transform: translateY(0);
      }
      .avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(160deg, var(--accent), var(--gd-teal));
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 22px;
        font-family: 'JetBrains Mono', monospace;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.3),
          0 0 14px rgba(16, 137, 168, 0.4);
      }
      .card-func-nome {
        font-size: 18px;
        font-weight: 700;
        line-height: 1.2;
      }
      .card-func-cargo {
        font-size: 13px;
        color: var(--ink-soft);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .menu-acoes {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 20px;
      }
      .acao-grande {
        background: var(--bg-2);
        border: 2px solid var(--line);
        border-radius: 8px;
        padding: 36px 28px;
        color: var(--ink);
        font-family: inherit;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        text-align: left;
        transition: all 120ms ease;
      }
      .acao-grande:hover:not(:disabled) {
        border-color: var(--warn);
        transform: translateY(-3px);
      }
      .acao-grande:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .acao-primaria {
        border-color: var(--warn);
      }
      .acao-bloqueada {
        border-color: var(--line);
        background: rgba(255, 176, 0, 0.04);
        opacity: 0.85;
      }
      .acao-bloqueada:hover {
        border-color: var(--warn);
        opacity: 1;
      }
      .acao-icone {
        font-size: 40px;
      }
      .acao-titulo {
        font-size: 26px;
        font-weight: 900;
        letter-spacing: -0.01em;
      }
      .acao-sub {
        font-size: 14px;
        color: var(--ink-soft);
      }

      /* Bloqueio sem entrada */
      .bloqueio-card {
        background: var(--bg-2);
        border: 2px solid var(--warn);
        border-radius: 12px;
        padding: 40px 32px;
        text-align: center;
      }
      .bloqueio-icone {
        font-size: 80px;
        line-height: 1;
        margin-bottom: 16px;
        color: var(--warn);
      }
      .bloqueio-titulo {
        font-size: clamp(28px, 4vw, 40px);
        font-weight: 900;
        letter-spacing: -0.02em;
        line-height: 1.1;
        margin-bottom: 16px;
        color: var(--warn);
      }
      .bloqueio-texto {
        font-size: 16px;
        color: var(--ink);
        line-height: 1.6;
        margin: 0 0 12px;
        max-width: 540px;
        margin-left: auto;
        margin-right: auto;
      }
      .bloqueio-texto strong {
        color: var(--warn);
      }

      /* Auto-pausa card */
      .auto-pausa-card {
        background: rgba(251, 191, 36, 0.08);
        border: 2px solid var(--paused);
        border-radius: 12px;
        padding: 24px;
        margin: 8px 0;
        max-width: 540px;
        text-align: center;
      }
      .auto-pausa-tag {
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        letter-spacing: 2px;
        color: var(--paused);
        font-weight: 900;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .auto-pausa-veiculo {
        font-size: 22px;
        font-weight: 900;
        line-height: 1.2;
        margin-bottom: 4px;
      }
      .auto-pausa-placa {
        font-family: 'JetBrains Mono', monospace;
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.1em;
        color: var(--warn);
        padding: 4px 10px;
        background: #000;
        display: inline-block;
        border-radius: 3px;
        border: 1.5px solid var(--warn);
        margin-bottom: 14px;
      }
      .auto-pausa-motivo {
        font-size: 14px;
        color: var(--ink);
        margin-bottom: 12px;
      }
      .auto-pausa-motivo strong {
        color: var(--paused);
      }
      .auto-pausa-aviso {
        font-size: 13px;
        color: var(--ink-soft);
        line-height: 1.5;
        padding-top: 12px;
        border-top: 1px solid var(--line);
      }

      /* Timeline */
      .timeline-vazia {
        background: rgba(255, 176, 0, 0.08);
        border: 1px solid var(--warn);
        border-radius: 8px;
        padding: 16px 20px;
        font-size: 14px;
        color: var(--ink);
        line-height: 1.5;
      }
      .timeline-vazia strong {
        color: var(--warn);
      }
      .timeline-ponto {
        background: var(--bg-2);
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 20px;
      }
      .timeline-titulo {
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        letter-spacing: 2px;
        color: var(--ink-soft);
        font-weight: 700;
        text-transform: uppercase;
        margin-bottom: 14px;
      }
      .timeline-lista {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .timeline-item {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 10px 14px;
        background: var(--bg);
        border-radius: 6px;
        border-left: 3px solid var(--line);
      }
      .timeline-item-ok {
        border-left-color: var(--ok);
      }
      .timeline-item-warn {
        border-left-color: var(--warn);
      }
      .timeline-item-info {
        border-left-color: var(--info);
      }
      .timeline-item-danger {
        border-left-color: var(--danger);
      }
      .timeline-icone {
        font-size: 22px;
        line-height: 1;
      }
      .timeline-nome {
        flex: 1;
        font-weight: 700;
        font-size: 14px;
      }
      .timeline-hora {
        font-family: 'JetBrains Mono', monospace;
        font-size: 16px;
        font-weight: 900;
        color: var(--warn);
      }

      /* Grid de botões de ponto */
      .grid-ponto {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
      }
      .card-ponto {
        width: 100%;
        background: var(--bg-2);
        border: 2px solid var(--line);
        border-radius: 10px;
        padding: 22px 20px;
        color: var(--ink);
        font-family: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 14px;
        text-align: left;
        transition: all 130ms ease;
      }
      .card-ponto-icone {
        font-size: 36px;
        line-height: 1;
        flex-shrink: 0;
      }
      .card-ponto-texto {
        flex: 1;
      }
      .card-ponto-nome {
        font-size: 16px;
        font-weight: 900;
        line-height: 1.1;
        letter-spacing: -0.01em;
        margin-bottom: 4px;
      }
      .card-ponto-disponivel-tag {
        font-size: 12px;
        color: var(--ink-soft);
        line-height: 1.4;
      }
      .card-ponto-feito-tag {
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        font-weight: 700;
        color: var(--ok);
        letter-spacing: 1px;
      }
      .card-ponto-bloqueado-tag {
        font-size: 11px;
        color: var(--ink-soft);
        font-style: italic;
      }
      .card-ponto-ok:not(:disabled):hover {
        border-color: var(--ok);
        background: rgba(108, 225, 108, 0.08);
        transform: translateY(-3px);
      }
      .card-ponto-warn:not(:disabled):hover {
        border-color: var(--warn);
        background: rgba(255, 176, 0, 0.08);
        transform: translateY(-3px);
      }
      .card-ponto-info:not(:disabled):hover {
        border-color: var(--info);
        background: rgba(125, 211, 252, 0.08);
        transform: translateY(-3px);
      }
      .card-ponto-danger:not(:disabled):hover {
        border-color: var(--danger);
        background: rgba(255, 77, 46, 0.08);
        transform: translateY(-3px);
      }
      .card-ponto:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .card-ponto-feito {
        opacity: 0.65;
        border-color: var(--ok);
        background: rgba(108, 225, 108, 0.04);
      }
      .card-ponto-feito .card-ponto-nome {
        color: var(--ink-soft);
      }
      .info-encerrado {
        background: rgba(108, 225, 108, 0.08);
        border: 1px solid var(--ok);
        color: var(--ink);
        padding: 14px 18px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 14px;
      }

      /* Placa input */
      .placa-wrap {
        position: relative;
        margin-bottom: 28px;
      }
      .placa-input {
        width: 100%;
        background: var(--bg-2);
        border: 3px solid var(--line);
        border-radius: 8px;
        padding: 24px 28px;
        font-size: clamp(36px, 6vw, 64px);
        font-family: 'JetBrains Mono', monospace;
        font-weight: 700;
        letter-spacing: 0.15em;
        color: var(--ink);
        text-transform: uppercase;
        text-align: center;
      }
      .placa-input:focus {
        outline: none;
        border-color: var(--warn);
        background: var(--bg-3);
      }
      .placa-input::placeholder {
        color: #444;
        letter-spacing: 0.15em;
      }
      .placa-counter {
        position: absolute;
        right: 20px;
        bottom: 12px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        color: var(--ink-soft);
      }

      /* Botões */
      .acoes-linha {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
      }
      .btn-primario,
      .btn-secundario,
      .btn-perigo {
        flex: 1;
        min-width: 160px;
        padding: 22px 28px;
        font-family: inherit;
        font-weight: 900;
        font-size: 18px;
        letter-spacing: 0.05em;
        border-radius: 6px;
        cursor: pointer;
        transition: all 120ms ease;
        border: 2px solid transparent;
      }
      .btn-primario {
        background: var(--warn);
        color: #fff;
      }
      .btn-primario:hover:not(:disabled) {
        background: var(--accent-strong);
        transform: translateY(-2px);
        box-shadow: 0 6px 20px -6px var(--accent-glow);
      }
      .btn-primario:active {
        transform: translateY(0);
      }
      .btn-primario:disabled {
        background: var(--bg-2);
        color: var(--ink-soft);
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btn-secundario {
        background: transparent;
        color: var(--ink);
        border-color: var(--line);
      }
      .btn-secundario:hover:not(:disabled) {
        border-color: var(--ink);
      }
      .btn-secundario:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .btn-perigo {
        background: var(--danger);
        color: #fff;
      }
      .btn-perigo:hover:not(:disabled) {
        background: #ff6347;
        transform: translateY(-2px);
      }
      .btn-perigo:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Estados */
      .estado {
        text-align: center;
        padding: 40px 20px;
        max-width: 600px;
        margin: 0 auto;
      }
      .estado h2 {
        font-size: 28px;
        font-weight: 900;
        margin: 16px 0 8px;
      }
      .estado p {
        color: var(--ink-soft);
        font-size: 16px;
        margin: 0 0 24px;
        line-height: 1.5;
      }
      .estado-icone {
        font-size: 60px;
        line-height: 1;
        margin-bottom: 8px;
      }
      .estado-erro .estado-icone {
        color: var(--danger);
      }
      .estado-vazio .estado-icone {
        color: var(--info);
      }
      .loader {
        width: 56px;
        height: 56px;
        border: 4px solid var(--line);
        border-top-color: var(--warn);
        border-radius: 50%;
        margin: 0 auto 16px;
        animation: spin 700ms linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .estado-loading p {
        color: var(--ink);
        font-weight: 700;
        font-size: 18px;
      }

      /* OS Card */
      .os-card {
        background: linear-gradient(180deg, rgba(16, 137, 168, 0.06) 0%, transparent 40%), var(--bg-2);
        border: 1px solid rgba(16, 137, 168, 0.4);
        border-radius: 16px;
        padding: 32px;
        box-shadow: var(--shadow-card);
      }
      .os-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .os-tag {
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        letter-spacing: 2px;
        color: var(--warn);
        font-weight: 700;
      }
      .os-status {
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        font-weight: 700;
        padding: 5px 12px;
        border-radius: 999px;
        background: var(--warn);
        color: #fff;
        letter-spacing: 1px;
      }
      .os-veiculo {
        font-size: clamp(28px, 4vw, 40px);
        font-weight: 900;
        margin: 0 0 4px;
        letter-spacing: -0.02em;
      }
      .os-placa-display {
        font-family: 'JetBrains Mono', monospace;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: 0.1em;
        color: var(--accent);
        margin-bottom: 28px;
        padding: 8px 14px;
        background: #060d18;
        display: inline-block;
        border-radius: 8px;
        border: 1px solid rgba(16, 137, 168, 0.5);
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.5);
      }
      .os-grid {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 12px 20px;
        margin: 0 0 28px;
      }
      .os-grid dt {
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        letter-spacing: 1.5px;
        color: var(--ink-soft);
        font-weight: 700;
        align-self: start;
        padding-top: 2px;
      }
      .os-grid dd {
        margin: 0;
        font-size: 16px;
        line-height: 1.4;
      }
      .btn-iniciar {
        width: 100%;
        background: var(--running);
        color: #000;
        border: none;
        border-radius: 8px;
        padding: 28px;
        font-family: inherit;
        font-weight: 900;
        font-size: 24px;
        letter-spacing: 0.05em;
        cursor: pointer;
        margin-bottom: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        transition: all 120ms ease;
      }
      .btn-iniciar:hover {
        background: #6ee585;
        transform: translateY(-2px);
        box-shadow: 0 8px 24px -8px rgba(74, 222, 128, 0.5);
      }
      .btn-iniciar:active {
        transform: translateY(0);
      }
      .btn-iniciar-icone {
        font-size: 20px;
        background: #000;
        color: var(--running);
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      /* Etapas */
      .grid-etapas {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 14px;
      }
      .card-etapa {
        width: 100%;
        background: var(--bg-2);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 22px 18px;
        color: var(--ink);
        font-family: inherit;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        text-align: left;
        position: relative;
        box-shadow: var(--shadow-card);
        transition:
          transform 180ms cubic-bezier(0.4, 0, 0.2, 1),
          box-shadow 180ms cubic-bezier(0.4, 0, 0.2, 1),
          border-color 180ms cubic-bezier(0.4, 0, 0.2, 1),
          background 180ms ease;
      }
      .card-etapa:hover:not(:disabled) {
        border-color: rgba(16, 137, 168, 0.4);
        background: var(--bg-3);
        transform: translateY(-3px);
        box-shadow: var(--shadow-card-hover);
      }
      .card-etapa:focus-visible {
        border-color: var(--warn);
        background: var(--bg-3);
        transform: translateY(-3px);
        outline: 3px solid var(--warn);
        outline-offset: 2px;
      }
      .card-etapa:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }
      .card-etapa-iniciando {
        opacity: 1;
        border-color: var(--running);
        background: rgba(74, 222, 128, 0.1);
      }
      .card-etapa-iniciando .card-etapa-desc {
        color: var(--running);
        font-weight: 700;
      }
      .card-etapa:active {
        transform: translateY(-1px);
      }
      .card-etapa-num {
        position: absolute;
        top: 12px;
        right: 12px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 700;
        color: var(--ink-soft);
        background: #000;
        padding: 2px 6px;
        border-radius: 3px;
      }
      .card-etapa-icone {
        font-size: 36px;
        line-height: 1;
        margin-bottom: 4px;
      }
      .card-etapa-nome {
        font-size: 18px;
        font-weight: 900;
        line-height: 1.1;
        letter-spacing: -0.01em;
      }
      .card-etapa-desc {
        font-size: 13px;
        color: var(--ink-soft);
        line-height: 1.4;
      }

      /* Extras do apontamento: retrabalho (flag âmbar) + complexidade (acento teal).
         Ficam ACIMA das etapas; padrões pré-setados pra não custar toque extra. */
      .etapa-extras {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 14px 24px;
        background: var(--bg-2);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 16px 20px;
        margin-bottom: 20px;
        box-shadow: var(--shadow-card);
      }
      .retrab-toggle {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        min-height: 48px;
        padding: 10px 18px;
        border-radius: 999px;
        border: 1.5px solid var(--line);
        background: var(--bg);
        color: var(--ink-soft);
        font-family: inherit;
        font-weight: 700;
        font-size: 15px;
        cursor: pointer;
        transition: all 140ms ease;
      }
      .retrab-toggle:hover:not(:disabled) {
        border-color: var(--accent);
        color: var(--ink);
      }
      .retrab-check {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 6px;
        border: 1.5px solid var(--ink-soft);
        font-size: 14px;
        font-weight: 900;
      }
      .retrab-toggle-on {
        border-color: var(--caution);
        background: rgba(251, 191, 36, 0.12);
        color: #fbe6a6;
      }
      .retrab-toggle-on .retrab-check {
        background: var(--caution);
        border-color: var(--caution);
        color: #1a1206;
      }
      .complex-group {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-left: auto;
      }
      .complex-label {
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: var(--ink-soft);
        font-weight: 700;
      }
      .complex-seg {
        display: inline-flex;
        background: var(--bg);
        border: 1.5px solid var(--line);
        border-radius: 999px;
        padding: 4px;
        gap: 4px;
      }
      .complex-btn {
        min-height: 40px;
        padding: 8px 16px;
        border: none;
        border-radius: 999px;
        background: transparent;
        color: var(--ink-soft);
        font-family: inherit;
        font-weight: 800;
        font-size: 14px;
        cursor: pointer;
        transition: all 140ms ease;
      }
      .complex-btn:hover:not(:disabled) {
        color: var(--ink);
      }
      .complex-btn-on {
        background: var(--accent);
        color: #fff;
        box-shadow: 0 2px 10px -3px var(--accent-glow);
      }
      .retrab-toggle:disabled,
      .complex-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Carro confirmado no topo da escolha de etapa — É um BOTÃO: tocar troca
         o carro (volta pra busca), pra não bater tempo no carro errado. */
      .etapa-carro {
        width: 100%;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        background: var(--bg-2);
        border: 2px solid var(--warn);
        border-radius: 10px;
        padding: 16px 20px;
        margin-bottom: 20px;
        color: var(--ink);
        font-family: inherit;
        text-align: left;
        cursor: pointer;
        transition: all 120ms ease;
      }
      .etapa-carro:hover:not(:disabled) {
        background: var(--bg-3);
        border-color: var(--accent-strong);
      }
      .etapa-carro:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .etapa-carro-tag {
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        letter-spacing: 2px;
        color: var(--warn);
        font-weight: 700;
      }
      .etapa-carro-modelo {
        font-size: 22px;
        font-weight: 900;
        letter-spacing: -0.01em;
        line-height: 1.1;
      }
      .etapa-carro-placa {
        font-family: 'JetBrains Mono', monospace;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0.1em;
        color: var(--warn);
        padding: 4px 10px;
        background: #000;
        border-radius: 4px;
        border: 1.5px solid var(--warn);
        margin-left: auto;
      }
      .etapa-carro-trocar {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: var(--ink-soft);
        border: 1px solid var(--line);
        border-radius: 4px;
        padding: 6px 12px;
      }
      .etapa-carro:hover:not(:disabled) .etapa-carro-trocar {
        color: var(--warn);
        border-color: var(--warn);
      }

      /* Confirmação */
      .confirmacao-card {
        background: linear-gradient(180deg, rgba(16, 137, 168, 0.06) 0%, transparent 40%), var(--bg-2);
        border: 1px solid rgba(16, 137, 168, 0.4);
        border-radius: 16px;
        padding: 32px;
        margin-bottom: 24px;
        box-shadow: var(--shadow-card);
      }
      .confirmacao-etapa {
        display: flex;
        align-items: center;
        gap: 18px;
      }
      .confirmacao-etapa-icone {
        font-size: 48px;
        line-height: 1;
        flex-shrink: 0;
      }
      .confirmacao-etapa-tag {
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        letter-spacing: 2px;
        color: var(--warn);
        font-weight: 700;
        margin-bottom: 4px;
      }
      .confirmacao-etapa-nome {
        font-size: 26px;
        font-weight: 900;
        letter-spacing: -0.01em;
        line-height: 1.1;
      }
      .btn-trocar {
        margin-left: auto;
        background: transparent;
        border: 1px solid var(--line);
        color: var(--ink-soft);
        padding: 10px 16px;
        min-height: 44px;
        border-radius: 4px;
        font-family: inherit;
        font-weight: 700;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 1px;
        cursor: pointer;
        transition: all 120ms ease;
      }
      .btn-trocar:hover:not(:disabled) {
        border-color: var(--warn);
        color: var(--warn);
      }
      .btn-trocar:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .erro-inline {
        background: rgba(255, 77, 46, 0.1);
        border: 1px solid var(--danger);
        color: var(--danger);
        padding: 14px 18px;
        border-radius: 6px;
        margin-bottom: 16px;
        font-weight: 700;
        font-size: 14px;
      }

      /* Trabalhando/Pausada */
      .tela-trabalhando,
      .tela-pausada {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 28px;
      }
      .trabalhando-info {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .trabalhando-tag {
        display: inline-block;
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        letter-spacing: 2px;
        color: var(--running);
        font-weight: 700;
        animation: pulseGreen 2s ease-in-out infinite;
      }
      .trabalhando-etapa {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: var(--bg-2);
        border: 1px solid var(--warn);
        padding: 10px 18px;
        border-radius: 6px;
        margin: 4px 0;
      }
      .trabalhando-etapa-icone {
        font-size: 22px;
        line-height: 1;
      }
      .trabalhando-etapa-nome {
        font-size: 16px;
        font-weight: 900;
        color: var(--warn);
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }
      .trabalhando-veiculo {
        font-size: clamp(28px, 4vw, 40px);
        font-weight: 900;
        margin: 8px 0 0;
        letter-spacing: -0.02em;
      }
      .trabalhando-placa {
        font-family: 'JetBrains Mono', monospace;
        font-size: 22px;
        font-weight: 700;
        letter-spacing: 0.1em;
        color: var(--accent);
        padding: 6px 14px;
        background: #060d18;
        display: inline-block;
        border-radius: 8px;
        border: 1px solid rgba(16, 137, 168, 0.5);
        box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.5);
      }
      .cronometro-wrap {
        text-align: center;
        background: var(--bg-2);
        border: 2px solid var(--running);
        border-radius: 12px;
        padding: 28px 40px;
        box-shadow: 0 0 60px rgba(74, 222, 128, 0.15);
        width: 100%;
        max-width: 600px;
      }
      .cronometro-wrap.cronometro-pausado {
        border-color: var(--paused);
        box-shadow: 0 0 60px rgba(251, 191, 36, 0.15);
      }
      .cronometro-label {
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        letter-spacing: 3px;
        color: var(--ink-soft);
        font-weight: 700;
        margin-bottom: 12px;
      }
      .cronometro-display {
        font-family: 'JetBrains Mono', monospace;
        font-size: clamp(60px, 12vw, 120px);
        font-weight: 700;
        color: var(--running);
        line-height: 1;
        letter-spacing: 0.02em;
      }
      .cronometro-pausado .cronometro-display {
        color: var(--paused);
      }
      .botoes-tarefa {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        width: 100%;
        max-width: 600px;
      }
      .btn-pausar,
      .btn-retomar,
      .btn-finalizar,
      .btn-finalizar-secundario {
        border: none;
        border-radius: 10px;
        padding: 24px 24px;
        font-family: inherit;
        font-weight: 900;
        font-size: clamp(16px, 2.4vw, 22px);
        letter-spacing: 0.05em;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        transition: all 120ms ease;
      }
      .btn-pausar {
        background: var(--paused);
        color: #000;
      }
      .btn-pausar:hover:not(:disabled) {
        background: #fcd34d;
        transform: translateY(-2px);
      }
      .btn-pausar:active {
        transform: translateY(0);
      }
      .btn-retomar {
        background: var(--running);
        color: #000;
      }
      .btn-retomar:hover:not(:disabled) {
        background: #6ee585;
        transform: translateY(-2px);
      }
      .btn-retomar:disabled {
        background: #2a2a2a;
        color: #666;
        cursor: not-allowed;
      }
      .btn-finalizar {
        background: var(--danger);
        color: #fff;
      }
      .btn-finalizar:hover:not(:disabled) {
        background: #ff6347;
        transform: translateY(-2px);
      }
      .btn-finalizar-secundario {
        background: transparent;
        color: var(--danger);
        border: 2px solid var(--danger);
      }
      .btn-finalizar-secundario:hover:not(:disabled) {
        background: rgba(255, 77, 46, 0.1);
      }
      .btn-finalizar-secundario:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .pausada-banner {
        display: flex;
        align-items: center;
        gap: 18px;
        background: rgba(251, 191, 36, 0.08);
        border: 2px solid var(--paused);
        border-radius: 12px;
        padding: 18px 24px;
        max-width: 600px;
        width: 100%;
      }
      .pausada-banner-icone {
        font-size: 36px;
        color: var(--paused);
        line-height: 1;
      }
      .pausada-banner-tag {
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        letter-spacing: 2px;
        color: var(--paused);
        font-weight: 700;
        margin-bottom: 4px;
      }
      .pausada-banner-motivo {
        font-size: 18px;
        font-weight: 900;
        line-height: 1.2;
      }
      .pausada-banner-tempo {
        font-size: 13px;
        color: var(--ink-soft);
        margin-top: 4px;
      }
      .aviso-15min {
        background: rgba(251, 191, 36, 0.08);
        border: 1px solid var(--caution);
        border-radius: 8px;
        padding: 16px 20px;
        margin-bottom: 24px;
        font-size: 14px;
        line-height: 1.5;
        color: var(--ink);
      }
      .aviso-15min strong {
        color: var(--caution);
      }
      .motivo-categoria {
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        letter-spacing: 2px;
        color: var(--ink-soft);
        font-weight: 700;
        text-transform: uppercase;
        margin: 0 0 12px;
      }
      .grid-motivos {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 12px;
      }
      .card-motivo {
        width: 100%;
        background: var(--bg-2);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 18px;
        color: var(--ink);
        font-family: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 14px;
        text-align: left;
        box-shadow: var(--shadow-card);
        transition:
          transform 160ms cubic-bezier(0.4, 0, 0.2, 1),
          box-shadow 160ms cubic-bezier(0.4, 0, 0.2, 1),
          border-color 160ms cubic-bezier(0.4, 0, 0.2, 1),
          background 160ms ease;
      }
      .card-motivo:hover:not(:disabled) {
        border-color: rgba(16, 137, 168, 0.4);
        background: var(--bg-3);
        transform: translateX(4px);
        box-shadow: var(--shadow-card-hover);
      }
      .card-motivo:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .card-motivo-alerta:hover:not(:disabled) {
        border-color: var(--danger);
      }
      .card-motivo-icone {
        font-size: 32px;
        line-height: 1;
        flex-shrink: 0;
      }
      .card-motivo-texto {
        flex: 1;
      }
      .card-motivo-nome {
        font-size: 16px;
        font-weight: 900;
        line-height: 1.2;
      }
      .card-motivo-desc {
        font-size: 13px;
        color: var(--ink-soft);
        margin-top: 4px;
        line-height: 1.4;
      }
      .card-motivo-alerta-tag {
        display: inline-block;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 1px;
        background: var(--danger);
        color: #fff;
        padding: 3px 7px;
        border-radius: 3px;
        margin-top: 6px;
      }
      .cronometro-resumo {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding-top: 20px;
        margin-top: 20px;
        border-top: 1px solid var(--line);
      }
      .cronometro-resumo-label {
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        letter-spacing: 2px;
        color: var(--ink-soft);
        font-weight: 700;
      }
      .cronometro-resumo-valor {
        font-family: 'JetBrains Mono', monospace;
        font-size: 48px;
        font-weight: 700;
        color: var(--running);
        line-height: 1;
      }

      /* Sucesso */
      .tela-sucesso {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }
      .sucesso-icone {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background: var(--running);
        color: #000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 60px;
        font-weight: 900;
        margin-bottom: 8px;
        animation: pulseGreen 1.5s ease-in-out infinite;
      }
      .sucesso-icone-ok {
        background: var(--ok);
      }
      .sucesso-icone-warn {
        background: var(--warn);
      }
      .sucesso-icone-info {
        background: var(--info);
      }
      .sucesso-icone-danger {
        background: var(--danger);
        color: #fff;
      }
      .tela-sucesso .btn-primario {
        max-width: 320px;
      }

      @media (max-width: 640px) {
        .totem-header {
          padding: 14px 16px;
        }
        .totem-area {
          padding: 24px 16px;
        }
        .menu-acoes,
        .grid-funcs,
        .grid-etapas,
        .grid-motivos,
        .grid-ponto {
          grid-template-columns: 1fr;
        }
        .acoes-linha {
          flex-direction: column;
        }
        .etapa-extras {
          flex-direction: column;
          align-items: stretch;
        }
        .complex-group {
          margin-left: 0;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
        }
        .complex-seg {
          width: 100%;
        }
        .complex-btn {
          flex: 1;
        }
        .botoes-tarefa {
          grid-template-columns: 1fr;
        }
        .btn-primario,
        .btn-secundario,
        .btn-perigo {
          width: 100%;
        }
        .cronometro-wrap {
          padding: 24px 20px;
        }
        .confirmacao-etapa {
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
        }
        .btn-trocar {
          margin-left: 0;
        }
        .bloqueio-card {
          padding: 28px 20px;
        }
      }
    `}</style>
  );
}
