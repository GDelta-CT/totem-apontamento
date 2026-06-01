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
        const result = await withTimeout(
          sb
            .from('funcionarios')
            .select('id, nome, ativo, cargo')
            .eq('ativo', true)
            .order('nome', { ascending: true })
        );
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
        .ilike('placa', placa)
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

/* ────────────────────── APONTAMENTOS ────────────────────── */

export async function iniciarApontamento(params: {
  ordemServicoId: string;
  nomeFuncionario: string;
  cargoFuncionario: string;
  etapa: EtapaId;
}): Promise<FetchState<Apontamento>> {
  try {
    const result = await withTimeout(
      getSupabase()
        .from('apontamentos')
        .insert({
          ordem_servico_id: params.ordemServicoId,
          nome_funcionario: params.nomeFuncionario,
          cargo_funcionario: params.cargoFuncionario,
          status_tarefa: 'Em andamento',
          etapa: params.etapa,
          tempo_pausado_seg: 0,
        })
        .select()
        .single()
    );
    const { data, error } = result as {
      data: Apontamento | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data) return { status: 'error', message: 'Falha ao criar apontamento.' };
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
    const result = await withTimeout(
      getSupabase()
        .from('apontamentos')
        .update({
          status_tarefa: 'Pausado',
          motivo_pausa: params.motivo,
          pausado_em: new Date().toISOString(),
        })
        .eq('id', params.apontamentoId)
        .select()
        .single()
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
    const pausadoEmISO = parseISOComUTC(apontamento.pausado_em);
    const segundosPausados = Math.max(0, Math.floor((Date.now() - pausadoEmISO) / 1000));
    const tempoPausadoTotal = (apontamento.tempo_pausado_seg ?? 0) + segundosPausados;

    const result = await withTimeout(
      getSupabase()
        .from('apontamentos')
        .update({
          status_tarefa: 'Em andamento',
          motivo_pausa: null,
          pausado_em: null,
          tempo_pausado_seg: tempoPausadoTotal,
        })
        .eq('id', apontamento.id)
        .select()
        .single()
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
  apontamento: Apontamento
): Promise<FetchState<Apontamento>> {
  try {
    let tempoPausadoTotal = apontamento.tempo_pausado_seg ?? 0;
    if (apontamento.status_tarefa === 'Pausado' && apontamento.pausado_em) {
      const pausadoEmISO = parseISOComUTC(apontamento.pausado_em);
      const segundosPausados = Math.max(0, Math.floor((Date.now() - pausadoEmISO) / 1000));
      tempoPausadoTotal += segundosPausados;
    }

    const result = await withTimeout(
      getSupabase()
        .from('apontamentos')
        .update({
          hora_fim: new Date().toISOString(),
          status_tarefa: 'Finalizado',
          pausado_em: null,
          tempo_pausado_seg: tempoPausadoTotal,
        })
        .eq('id', apontamento.id)
        .select()
        .single()
    );
    const { data, error } = result as {
      data: Apontamento | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data) return { status: 'error', message: 'Falha ao finalizar.' };
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
  const m = msg.toLowerCase();
  if (m.includes('jwt') || m.includes('invalid api key')) {
    return 'Chave de acesso inválida. Avise o administrador.';
  }
  if (m.includes('relation') && m.includes('does not exist')) {
    return 'Tabela não encontrada no banco. Avise o administrador.';
  }
  if (m.includes('permission') || m.includes('rls') || m.includes('policy')) {
    return 'Sem permissão para gravar/ler. Aplique as políticas RLS no Supabase.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'Sem conexão com o servidor. Verifique a internet.';
  }
  if (m.includes('does not exist')) {
    return msg;
  }
  return msg;
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
    if (!horaInicioISO) return;
    if (pausadoEmISO) return;
    setTick((n) => n + 1);
    const id = setInterval(() => {
      setTick((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
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
