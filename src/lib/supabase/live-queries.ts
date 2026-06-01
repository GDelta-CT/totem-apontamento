/**
 * Camada de dados da VISÃO OPERACIONAL AO VIVO (Passo 3 da ordem A.1).
 *
 * Responde às 2 perguntas do dono (CLAUDE.md):
 *   1. "Todo mundo está produzindo agora?"  -> os 3 estados do operário.
 *   2. "Que carro está travado/lento?"      -> kanban por etapa + bloqueios.
 *
 * Arquivo NOVO e isolado: lê dados que o totem já grava (apontamentos,
 * ordens_servico). Não escreve nada, não toca no totem
 * nem no RLS. Desfazer = apagar este arquivo. Tempos ancorados no servidor
 * (hora_inicio / registrado_em vêm do banco).
 */

import { getSupabase, type EtapaId } from './client';
import { ETAPAS } from './client';
import type { FetchState } from './queries';

const TIMEOUT_MS = 8000;

function withTimeout<T>(promise: PromiseLike<T>, ms = TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Conexão demorou demais. Verifique a internet e tente de novo.'));
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

/* ───────────────────────── Tipos ───────────────────────── */

/** Os 3 estados do operário no painel (produtividade-only, sem presença). */
export type EstadoOperario = 'produzindo' | 'em_pausa' | 'sem_tarefa';

export type OperarioLive = {
  nome: string;
  cargo: string | null;
  estado: EstadoOperario;
  /** Placa do carro em que está trabalhando agora (se produzindo/pausado). */
  placaAtual: string | null;
  etapaAtual: string | null;
  /** Motivo da pausa, quando em_pausa. */
  motivoPausa: string | null;
  /** Início do apontamento ativo (âncora do cronômetro), ISO do servidor. */
  desdeISO: string | null;
};

/** Um apontamento ativo num carro (para mostrar TODOS no card do kanban). */
export type ApontamentoAtivo = {
  id: string;
  nome_funcionario: string;
  cargo_funcionario: string | null;
  etapa: string | null;
  status_tarefa: string;
  hora_inicio: string;
  motivo_pausa: string | null;
};

/** Um carro no kanban: a OS + apontamentos ativos nela. */
export type CarroLive = {
  id: string;
  placa: string;
  modelo_veiculo: string;
  status_geral: string | null;
  data_entrada: string | null;
  data_prometida: string | null;
  etapa_atual: EtapaId | null;
  bloqueado: boolean;
  motivo_bloqueio: string | null;
  ativos: ApontamentoAtivo[];
  /** 'trabalhando' | 'aguardando' (etapa concluída) | 'bloqueado'. */
  situacao: 'trabalhando' | 'aguardando' | 'bloqueado';
};

export type VisaoLive = {
  carros: CarroLive[];
  operarios: OperarioLive[];
  /** Carros agrupados por etapa do kanban (8 colunas fixas). */
  colunas: { etapa: EtapaId; nome: string; carros: CarroLive[] }[];
  resumo: {
    produzindo: number;
    em_pausa: number;
    sem_tarefa: number;
    carrosAtivos: number;
    carrosBloqueados: number;
  };
};

/* ───────────────────── helpers de data ───────────────────── */

function inicioDeHojeISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/* ───────────────────── consulta principal ───────────────────── */

type ApontRow = {
  id: string;
  ordem_servico_id: string;
  nome_funcionario: string;
  cargo_funcionario: string | null;
  hora_inicio: string;
  status_tarefa: string;
  etapa: string | null;
  motivo_pausa: string | null;
};

type OSRow = {
  id: string;
  placa: string;
  modelo_veiculo: string;
  status_geral: string | null;
  data_entrada: string | null;
  data_prometida: string | null;
  etapa_atual: EtapaId | null;
  bloqueado: boolean;
  motivo_bloqueio: string | null;
};

type ApontHojeRow = {
  nome_funcionario: string;
  cargo_funcionario: string | null;
  status_tarefa: string;
  hora_inicio: string;
};

/**
 * Monta a visão ao vivo completa numa tirada só. Faz poucas queries amplas e
 * cruza no cliente — barato para a escala de uma oficina (dezenas de linhas).
 */
export async function carregarVisaoLive(): Promise<FetchState<VisaoLive>> {
  try {
    const sb = getSupabase();
    const hoje = inicioDeHojeISO();

    const [osRes, apRes, apHojeRes] = await Promise.all([
      withTimeout(
        sb
          .from('ordens_servico')
          .select(
            'id, placa, modelo_veiculo, status_geral, data_entrada, data_prometida, etapa_atual, bloqueado, motivo_bloqueio'
          )
          .neq('status_geral', 'Entregue')
          .order('data_entrada', { ascending: true })
      ),
      withTimeout(
        sb
          .from('apontamentos')
          .select(
            'id, ordem_servico_id, nome_funcionario, cargo_funcionario, hora_inicio, status_tarefa, etapa, motivo_pausa'
          )
          .in('status_tarefa', ['Em andamento', 'Pausado'])
          .order('hora_inicio', { ascending: false })
      ),
      // apontamentos de HOJE (qualquer status) -> quem trabalhou hoje (p/ "sem tarefa ativa")
      withTimeout(
        sb
          .from('apontamentos')
          .select('nome_funcionario, cargo_funcionario, status_tarefa, hora_inicio')
          .gte('hora_inicio', hoje)
          .order('hora_inicio', { ascending: false })
      ),
    ]);

    const erro =
      (osRes as { error: { message: string } | null }).error ||
      (apRes as { error: { message: string } | null }).error ||
      (apHojeRes as { error: { message: string } | null }).error;
    if (erro) return { status: 'error', message: erro.message };

    const oss = ((osRes as { data: OSRow[] | null }).data ?? []) as OSRow[];
    const apont = ((apRes as { data: ApontRow[] | null }).data ?? []) as ApontRow[];
    const apHoje = ((apHojeRes as { data: ApontHojeRow[] | null }).data ?? []) as ApontHojeRow[];

    // 1) apontamentos ativos por OS
    const ativosPorOS = new Map<string, ApontamentoAtivo[]>();
    for (const a of apont) {
      const lista = ativosPorOS.get(a.ordem_servico_id) ?? [];
      lista.push({
        id: a.id,
        nome_funcionario: a.nome_funcionario,
        cargo_funcionario: a.cargo_funcionario,
        etapa: a.etapa,
        status_tarefa: a.status_tarefa,
        hora_inicio: a.hora_inicio,
        motivo_pausa: a.motivo_pausa,
      });
      ativosPorOS.set(a.ordem_servico_id, lista);
    }

    // 2) carros (OS ativas) com situação
    const carros: CarroLive[] = oss.map((os) => {
      const ativos = ativosPorOS.get(os.id) ?? [];
      const algumTrabalhando = ativos.some((x) => x.status_tarefa === 'Em andamento');
      const situacao: CarroLive['situacao'] = os.bloqueado
        ? 'bloqueado'
        : algumTrabalhando
          ? 'trabalhando'
          : 'aguardando';
      return { ...os, ativos, situacao };
    });

    // 3) colunas do kanban = 8 etapas fixas
    const colunas = ETAPAS.map((et) => ({
      etapa: et.id,
      nome: et.nome,
      carros: carros.filter((c) => c.etapa_atual === et.id),
    }));

    // 4) os 3 estados do operário — SEM presença/ponto.
    //    A faixa mostra só quem TEVE apontamento hoje (ou tem um ativo agora),
    //    derivado de apontamentos — nunca a lista inteira de funcionários.
    const placaPorOSId = new Map(oss.map((o) => [o.id, o.placa]));

    // apontamento ATIVO por operário (o mais recente) -> produzindo / em_pausa
    const ativoPorOperario = new Map<string, ApontRow>();
    for (const a of apont)
      if (!ativoPorOperario.has(a.nome_funcionario)) ativoPorOperario.set(a.nome_funcionario, a);

    // operários da faixa = união de "ativo agora" + "teve apontamento hoje"
    const cargoPorOperario = new Map<string, string | null>();
    for (const a of apHoje)
      if (!cargoPorOperario.has(a.nome_funcionario))
        cargoPorOperario.set(a.nome_funcionario, a.cargo_funcionario);
    for (const a of apont)
      if (!cargoPorOperario.has(a.nome_funcionario))
        cargoPorOperario.set(a.nome_funcionario, a.cargo_funcionario);

    const operarios: OperarioLive[] = [...cargoPorOperario.keys()].map((nome) => {
      const ap = ativoPorOperario.get(nome);
      let estado: EstadoOperario;
      if (ap && ap.status_tarefa === 'Em andamento') estado = 'produzindo';
      else if (ap && ap.status_tarefa === 'Pausado') estado = 'em_pausa';
      else estado = 'sem_tarefa';

      return {
        nome,
        cargo: cargoPorOperario.get(nome) ?? null,
        estado,
        placaAtual: ap ? (placaPorOSId.get(ap.ordem_servico_id) ?? null) : null,
        etapaAtual: ap?.etapa ?? null,
        motivoPausa: estado === 'em_pausa' ? (ap?.motivo_pausa ?? null) : null,
        desdeISO: ap?.hora_inicio ?? null,
      };
    });

    const resumo = {
      produzindo: operarios.filter((o) => o.estado === 'produzindo').length,
      em_pausa: operarios.filter((o) => o.estado === 'em_pausa').length,
      sem_tarefa: operarios.filter((o) => o.estado === 'sem_tarefa').length,
      carrosAtivos: carros.length,
      carrosBloqueados: carros.filter((c) => c.bloqueado).length,
    };

    return { status: 'success', data: { carros, operarios, colunas, resumo } };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Erro desconhecido.' };
  }
}

/** Rótulos amigáveis dos 3 estados, para a UI. */
export const ESTADO_LABEL: Record<EstadoOperario, { texto: string; cor: string }> = {
  produzindo: { texto: 'Produzindo', cor: '#1b7a3d' },
  em_pausa: { texto: 'Em pausa', cor: '#b8860b' },
  sem_tarefa: { texto: 'Sem tarefa ativa', cor: '#13678d' },
};
