/**
 * Hooks e funções de busca/escrita com timeout obrigatório.
 *
 * REGRA DE OURO: nenhum loading dura mais que TIMEOUT_MS. Sempre.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getSupabase,
  type Apontamento,
  type ApontamentoComOS,
  type ComplexidadeId,
  type EtapaId,
  type Funcionario,
  type MotivoPausaId,
  type OrdemServico,
} from './client';

const TIMEOUT_MS = 8000;

export type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'empty' }
  | { status: 'error'; message: string };

function withTimeout<T>(promise: PromiseLike<T>, ms = TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Conexão demorou demais. Verifique a internet e toque em Tentar de novo.'));
    }, ms);
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/* ────────────────────── FUNCIONÁRIOS ────────────────────── */

export function useFuncionariosAtivos() {
  const [state, setState] = useState<FetchState<Funcionario[]>>({
    status: 'loading',
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    const run = async () => {
      try {
        const sb = getSupabase();
        // Em paralelo: a equipe (fonte da verdade da lista) + os apontamentos ABERTOS
        // da oficina (best-effort, só pra pintar o chip de pendência no card do nome).
        // A 2ª consulta NUNCA pode derrubar a lista — por isso vai numa Promise que
        // resolve com {} em qualquer erro (allSettled-like manual), sem rejeitar.
        const funcsPromise = withTimeout(
          sb
            .from('funcionarios')
            .select('id, nome, ativo, cargo')
            .eq('ativo', true)
            .order('nome', { ascending: true })
        );
        const statusPromise = withTimeout(
          sb
            .from('apontamentos')
            .select('nome_funcionario, status_tarefa')
            .in('status_tarefa', ['Em andamento', 'Pausado'])
        ).then(
          (r) => r as { data: { nome_funcionario: string; status_tarefa: string }[] | null },
          // Falha (rede/permissão/timeout) NÃO quebra a lista: sem mapa, sem chips.
          () => ({ data: null as { nome_funcionario: string; status_tarefa: string }[] | null })
        );

        const [result, statusResult] = await Promise.all([funcsPromise, statusPromise]);
        const { data, error } = result as {
          data: Funcionario[] | null;
          error: { message: string } | null;
        };

        if (cancelled) return;

        if (error) {
          setState({ status: 'error', message: traduzirErro(error.message) });
          return;
        }

        if (!data || data.length === 0) {
          setState({ status: 'empty' });
          return;
        }

        // Mapa nome -> status (Pausado tem prioridade se houver linhas conflitantes,
        // raro). Sem dados (consulta falhou) -> mapa vazio -> nenhum card ganha chip.
        const statusPorNome = new Map<string, 'Em andamento' | 'Pausado'>();
        for (const ap of statusResult.data ?? []) {
          if (!ap?.nome_funcionario) continue;
          const st = ap.status_tarefa === 'Pausado' ? 'Pausado' : 'Em andamento';
          if (st === 'Pausado' || !statusPorNome.has(ap.nome_funcionario)) {
            statusPorNome.set(ap.nome_funcionario, st);
          }
        }
        const dataComStatus: Funcionario[] = data.map((f) => ({
          ...f,
          statusTarefa: statusPorNome.get(f.nome) ?? null,
        }));

        setState({ status: 'success', data: dataComStatus });
      } catch (e) {
        if (cancelled) return;
        setState({
          status: 'error',
          message: e instanceof Error ? e.message : 'Erro desconhecido.',
        });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const recarregar = useCallback(() => setReloadKey((k) => k + 1), []);

  return { state, recarregar };
}

/* ────────────────────── ORDENS DE SERVIÇO ────────────────────── */

export async function buscarOSPorPlaca(placaInput: string): Promise<FetchState<OrdemServico>> {
  const placa = normalizarPlaca(placaInput);
  if (!placa) {
    return {
      status: 'error',
      message: 'Digite uma placa antes de buscar.',
    };
  }

  try {
    const result = await withTimeout(
      getSupabase()
        .from('ordens_servico')
        .select('id, placa, modelo_veiculo, status_geral, data_entrada')
        // A placa SEMPRE chega normalizada em MAIÚSCULAS/[A-Z0-9] (normalizarPlaca na
        // entrada e na própria função; toda escrita de placa também normaliza), sem
        // wildcards — então .eq é equivalente funcional a .ilike AQUI e, ao contrário do
        // ILIKE, USA o índice (oficina_id, placa) WHERE status_geral <> 'Entregue'
        // (migration 005). Mesmo padrão já usado no admin (buscar-antes-de-criar).
        .eq('placa', placa)
        // G7: não deixar apontar numa OS já entregue (placa única-PARCIAL: histórico
        // preservado, mas só a OS ATIVA é apontável) e, havendo mais de uma, a
        // mais recente vence.
        .neq('status_geral', 'Entregue')
        .order('data_entrada', { ascending: false })
        .limit(1)
        .maybeSingle()
    );
    const { data, error } = result as {
      data: OrdemServico | null;
      error: { message: string } | null;
    };

    if (error) {
      return { status: 'error', message: traduzirErro(error.message) };
    }
    if (!data) {
      return { status: 'empty' };
    }
    return { status: 'success', data };
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'Erro desconhecido.',
    };
  }
}

/**
 * Lista os carros ATIVOS (OS não entregue) da oficina, mais recentes primeiro,
 * para o operário ESCOLHER TOCANDO em vez de digitar a placa com a mão suja
 * (escopo: "lista buscável de carros ativos por placa, mais recentes primeiro").
 * Lê via cliente sob a sessão do device → o RLS isola por oficina_id. Mesmo
 * contrato/padrão do useFuncionariosAtivos.
 */
export function useOSAtivas() {
  const [state, setState] = useState<FetchState<OrdemServico[]>>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    const run = async () => {
      try {
        const sb = getSupabase();
        const result = await withTimeout(
          sb
            .from('ordens_servico')
            .select('id, placa, modelo_veiculo, status_geral, data_entrada')
            .neq('status_geral', 'Entregue')
            .order('data_entrada', { ascending: false })
        );
        const { data, error } = result as {
          data: OrdemServico[] | null;
          error: { message: string } | null;
        };

        if (cancelled) return;
        if (error) {
          setState({ status: 'error', message: traduzirErro(error.message) });
          return;
        }
        if (!data || data.length === 0) {
          setState({ status: 'empty' });
          return;
        }
        setState({ status: 'success', data });
      } catch (e) {
        if (cancelled) return;
        setState({
          status: 'error',
          message: e instanceof Error ? e.message : 'Erro desconhecido.',
        });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const recarregar = useCallback(() => setReloadKey((k) => k + 1), []);
  return { state, recarregar };
}

/* ────────────────────── APONTAMENTOS ────────────────────── */

export async function iniciarApontamento(params: {
  ordemServicoId: string;
  nomeFuncionario: string;
  cargoFuncionario: string;
  etapa: EtapaId;
  retrabalho: boolean;
  complexidade: ComplexidadeId;
}): Promise<FetchState<Apontamento>> {
  try {
    // Relógio do SERVIDOR + atômico (migration 014, "OS como Container"): a RPC,
    // numa transação só, PAUSA o 'Em andamento' DO MESMO operário (motivo
    // 'troca_tarefa') — garantindo a regra "um apontamento ativo por operário" —,
    // INSERE o novo (hora_inicio = now() do banco) e alinha ordens_servico.etapa_atual
    // ("último que iniciou vence"). NÃO toca em apontamentos de OUTROS operários do
    // mesmo carro. Retorna a própria linha de apontamentos (objeto único) ou NULL se
    // nada bateu (sem oficina no JWT), tratado como erro abaixo.
    const result = await withTimeout(
      getSupabase().rpc('fn_iniciar_apontamento', {
        p_os_id: params.ordemServicoId,
        p_nome: params.nomeFuncionario,
        p_cargo: params.cargoFuncionario,
        p_etapa: params.etapa,
        p_retrabalho: params.retrabalho,
        p_complexidade: params.complexidade,
      })
    );
    const { data, error } = result as {
      data: Apontamento | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data) return { status: 'error', message: 'Falha ao iniciar a tarefa.' };
    return { status: 'success', data };
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'Erro desconhecido.',
    };
  }
}

export async function pausarApontamento(params: {
  apontamentoId: string;
  motivo: MotivoPausaId;
}): Promise<FetchState<Apontamento>> {
  try {
    // Relógio do SERVIDOR: a RPC carimba pausado_em com now() do banco (migration
    // 011), nunca com a hora do tablet. Retorna a própria linha de apontamentos
    // (objeto único, não array) — ou NULL se nada bateu (oficina errada / não
    // estava 'Em andamento'), tratado como erro abaixo.
    const result = await withTimeout(
      getSupabase().rpc('fn_pausar_apontamento', {
        p_id: params.apontamentoId,
        p_motivo: params.motivo,
      })
    );
    const { data, error } = result as {
      data: Apontamento | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data) return { status: 'error', message: 'Falha ao pausar.' };
    return { status: 'success', data };
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'Erro desconhecido.',
    };
  }
}

export async function retomarApontamento(
  apontamento: Apontamento
): Promise<FetchState<Apontamento>> {
  if (!apontamento.pausado_em) {
    return {
      status: 'error',
      message: 'Apontamento não está pausado.',
    };
  }

  try {
    // Relógio do SERVIDOR: a RPC deriva tempo_pausado_seg no banco
    // (now() - pausado_em, em epoch) e volta a 'Em andamento' (migration 011) —
    // o browser não soma mais a janela de pausa. Retorna a linha de apontamentos
    // (objeto único) ou NULL se nada bateu (não estava 'Pausado'), tratado abaixo.
    const result = await withTimeout(
      getSupabase().rpc('fn_retomar_apontamento', {
        p_id: apontamento.id,
      })
    );
    const { data, error } = result as {
      data: Apontamento | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data) return { status: 'error', message: 'Falha ao retomar.' };
    return { status: 'success', data };
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'Erro desconhecido.',
    };
  }
}

export async function finalizarApontamento(
  apontamento: Apontamento,
  etapaConcluida: boolean
): Promise<FetchState<Apontamento>> {
  try {
    // Relógio do SERVIDOR: a RPC carimba hora_fim com now() do banco e, se estava
    // 'Pausado', fecha a última janela de pausa antes (tempo_pausado_seg derivado
    // no servidor) — migration 011. Retorna a linha de apontamentos (objeto único)
    // ou NULL se nada bateu (não estava em andamento/pausado), tratado abaixo.
    const result = await withTimeout(
      getSupabase().rpc('fn_finalizar_apontamento', {
        p_id: apontamento.id,
      })
    );
    const { data, error } = result as {
      data: Apontamento | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data) return { status: 'error', message: 'Falha ao finalizar.' };

    // "etapa concluída?" (commit f7f44d8): a RPC NÃO grava etapa_concluida — então,
    // best-effort, gravamos só esse campo aqui (mesmo padrão do etapa_atual em
    // iniciarApontamento). A verdade (hora_fim/status) já foi carimbada pelo
    // servidor; uma falha neste extra NÃO desfaz a finalização. Refletimos o valor
    // no objeto retornado para a UI ficar coerente sem um re-fetch.
    try {
      const upd = await withTimeout(
        getSupabase()
          .from('apontamentos')
          .update({ etapa_concluida: etapaConcluida })
          .eq('id', apontamento.id)
      );
      const { error: erroEtapa } = upd as { error: { message: string } | null };
      // Só reflete na UI se o banco ACEITOU. Update sem .select() NÃO lança em erro
      // de RLS/grant — vem em {error}; sem checar, diríamos "concluída" com o banco
      // em false (divergência UI×banco no sinal do painel). Em falha, fica o valor
      // do servidor (false) — o fim já está carimbado, só o sinal extra não pegou.
      if (!erroEtapa) data.etapa_concluida = etapaConcluida;
    } catch {
      // ignora: só falha de rede/timeout chega aqui; a finalização já vale.
    }

    return { status: 'success', data };
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'Erro desconhecido.',
    };
  }
}

export async function buscarApontamentoAtivo(
  nomeFuncionario: string
): Promise<FetchState<ApontamentoComOS>> {
  try {
    const result = await withTimeout(
      getSupabase()
        .from('apontamentos')
        .select(
          'id, ordem_servico_id, nome_funcionario, cargo_funcionario, hora_inicio, hora_fim, status_tarefa, etapa, motivo_pausa, pausado_em, tempo_pausado_seg, ordem_servico:ordens_servico(id, placa, modelo_veiculo, status_geral, data_entrada)'
        )
        .eq('nome_funcionario', nomeFuncionario)
        .in('status_tarefa', ['Em andamento', 'Pausado'])
        .order('hora_inicio', { ascending: false })
        .limit(1)
        .maybeSingle()
    );
    const { data, error } = result as {
      data: ApontamentoComOS | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data) return { status: 'empty' };

    // §4 (correção append-only): o bruto continua 'Em andamento'/'Pausado' de
    // propósito (imutável), então é o LEITOR que exclui os corrigidos. Se houver
    // QUALQUER correção encerrante (ajustar_fim/descartar) na trilha deste
    // apontamento, ele já não conta como ativo -> totem trata como SEM tarefa.
    const corr = await withTimeout(
      getSupabase()
        .from('apontamento_correcoes')
        .select('apontamento_id')
        .eq('apontamento_id', data.id)
        .in('acao', ['ajustar_fim', 'descartar'])
        .limit(1)
    );
    const { data: corrRows, error: corrErr } = corr as {
      data: { apontamento_id: string }[] | null;
      error: { message: string } | null;
    };
    // ROBUSTEZ (linha vermelha do totem): uma FALHA ao checar a trilha de correção
    // (permissão/tabela ausente/rede) NUNCA pode bloquear o operário de iniciar uma
    // tarefa. Degradar gracioso -> trata como "sem correção encerrante" e devolve o
    // apontamento ativo. Só EXCLUI (empty) se a consulta SUCEDER e achar correção.
    if (corrErr) {
      console.warn('[buscarApontamentoAtivo] falha ao checar correções (ignorada):', corrErr.message);
      return { status: 'success', data };
    }
    if (corrRows && corrRows.length > 0) return { status: 'empty' };

    return { status: 'success', data };
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : 'Erro desconhecido.',
    };
  }
}

/* ────────────────────── UTILS ────────────────────── */

export function normalizarPlaca(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim();
}

function traduzirErro(msg: string): string {
  // Tela do OPERARIO: nunca expor detalhe tecnico (RLS/SQL/estrutura) — so amigavel.
  const m = msg.toLowerCase();
  if (
    m.includes('network') ||
    m.includes('fetch') ||
    m.includes('timeout') ||
    m.includes('demorou')
  ) {
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  }
  if (m.includes('jwt') || m.includes('invalid api key')) {
    return 'A sessão do aparelho expirou. Avise o administrador.';
  }
  // Permissao / estrutura / qualquer outro erro tecnico -> generico e amigavel.
  return 'Não foi possível concluir agora. Tente de novo ou avise o administrador.';
}

export function useFocoAutomatico<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);
  return ref;
}

/**
 * Converte um timestamp do banco em epoch ms tratando-o como UTC.
 * O Postgres grava `timestamp` SEM 'Z'; sem isso o JS interpretaria como hora
 * local e erraria o cálculo pelo offset do fuso. Exportada para reuso (ex.:
 * detecção de anomalias). Ver anomalias-queries.ts.
 */
export function parseISOComUTC(iso: string): number {
  const isoComUTC =
    iso.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso.replace(' ', 'T') + 'Z';
  return new Date(isoComUTC).getTime();
}

export function useCronometro(
  horaInicioISO: string | null,
  pausadoEmISO?: string | null,
  tempoPausadoSeg?: number | null
) {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Pausado ou sem início: relógio parado, valor estático (não liga o rAF).
    if (!horaInicioISO || pausadoEmISO) return;

    // Em vez de setInterval(1000) — que DERIVA (dispara a 1001ms+, e em aba de
    // fundo o navegador segura e solta vários ticks juntos → segundos pulando) —
    // usamos requestAnimationFrame ancorado em Date.now(): re-renderiza SÓ quando
    // o segundo de relógio realmente vira. Sem drift, sem salto ao voltar de fundo.
    let raf = 0;
    let ultimoSegundo = -1;
    const loop = () => {
      const segAtual = Math.floor(Date.now() / 1000);
      if (segAtual !== ultimoSegundo) {
        ultimoSegundo = segAtual;
        setTick((n) => n + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [horaInicioISO, pausadoEmISO]);

  if (!horaInicioISO) {
    return { formatado: '00:00:00', segundos: 0, pausado: false };
  }

  const inicioMs = parseISOComUTC(horaInicioISO);
  const tempoPausadoAcumulado = tempoPausadoSeg ?? 0;

  let segundosTrabalhados: number;

  if (pausadoEmISO) {
    const pausaMs = parseISOComUTC(pausadoEmISO);
    segundosTrabalhados = Math.max(
      0,
      Math.floor((pausaMs - inicioMs) / 1000) - tempoPausadoAcumulado
    );
  } else {
    const agoraMs = Date.now();
    segundosTrabalhados = Math.max(
      0,
      Math.floor((agoraMs - inicioMs) / 1000) - tempoPausadoAcumulado
    );
  }

  const h = Math.floor(segundosTrabalhados / 3600)
    .toString()
    .padStart(2, '0');
  const m = Math.floor((segundosTrabalhados % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const s = (segundosTrabalhados % 60).toString().padStart(2, '0');
  return {
    formatado: `${h}:${m}:${s}`,
    segundos: segundosTrabalhados,
    pausado: !!pausadoEmISO,
  };
}

export function useTempoPausado(pausadoEmISO: string | null | undefined) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!pausadoEmISO) return;
    setTick((n) => n + 1);
    const id = setInterval(() => {
      setTick((n) => n + 1);
    }, 60000);
    return () => clearInterval(id);
  }, [pausadoEmISO]);

  if (!pausadoEmISO) return '';

  const pausaMs = parseISOComUTC(pausadoEmISO);
  const minutos = Math.max(0, Math.floor((Date.now() - pausaMs) / 60000));

  if (minutos < 1) return 'agora mesmo';
  if (minutos === 1) return 'há 1 minuto';
  if (minutos < 60) return `há ${minutos} minutos`;
  const horas = Math.floor(minutos / 60);
  const restante = minutos % 60;
  if (horas === 1 && restante === 0) return 'há 1 hora';
  if (restante === 0) return `há ${horas} horas`;
  if (horas === 1) return `há 1h ${restante}min`;
  return `há ${horas}h ${restante}min`;
}

export function formatarHora(iso: string | null | undefined): string {
  if (!iso) return '--:--';
  const ms = parseISOComUTC(iso);
  const d = new Date(ms);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
