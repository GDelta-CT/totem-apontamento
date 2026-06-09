'use server';

/**
 * Server Actions do ADMIN — ESCRITA no SERVIDOR (server-move, Passo 3).
 *
 * Move a ESCRITA de /admin/os e /admin/funcionarios do browser para o servidor.
 * Antes, a View chamava getSupabase().from(...).insert/update direto no cliente
 * (anon key no browser). Agora chama estas Server Actions, e a gravação roda no
 * servidor com a sessão do COOKIE httpOnly.
 *
 * CADA action é um endpoint PÚBLICO (alcançável por POST direto, não só pela UI —
 * ver o aviso do guia "Mutating Data" do Next). Por isso TODA action:
 *   1) chama requireGestor() PRIMEIRO — revalida no servidor que quem chama é
 *      dono/gerente (não confiar na UI). requireGestor() LANÇA para quem não é
 *      gestor (GDELTA_FORBIDDEN) ou redireciona se não há sessão; capturamos o
 *      forbidden e devolvemos erro amigável (a action NUNCA estoura pro cliente);
 *   2) usa o cliente do DAL (getServerClient) — JÁ autenticado pelo cookie, então
 *      o RLS isola por oficina_id e o trigger BEFORE INSERT carimba o oficina_id.
 *      NUNCA mandamos oficina_id do cliente (REGRA DE OURO do DAL);
 *   3) retorna FetchState<T> (sucesso/erro), preservando as MESMAS mensagens
 *      amigáveis (traduzirErro) e o MESMO timeout de 8s da versão client;
 *   4) no sucesso de uma MUTAÇÃO, revalida a rota afetada (revalidatePath) para o
 *      Server Component re-ler a lista fresh. A View também dá router.refresh()
 *      (mantido) — os dois somam: a tela atualiza após a ação como antes.
 *
 * As validações G4 (nome duplicado) / G5 (apontamento ativo) e a busca
 * "antes-de-criar" da OS rodam AQUI, no servidor (mais seguras que no browser),
 * preservando o comportamento EXATO: continuam sendo CHECAGENS que a UI usa para
 * pedir confirmação (não viram trava cega). A regra de negócio pura (normalização,
 * tradução de erro, colunas) segue em admin-shared.ts — sem cópia.
 *
 * SOBRE GRAVAR DE VERDADE: a escrita só persiste quando houver (1) usuário gestor
 * logado com conta real (oficina_id no JWT) e (2) a Migration de grants aplicada
 * no teste. Até lá, o RLS recusa e a action devolve a mensagem de permissão — é o
 * esperado, igual à versão client.
 */

import { revalidatePath } from 'next/cache';

import { getServerClient, requireGestor } from './dal';
import type { FetchState } from './queries';
import type { EtapaId } from './client';
import {
  COLS_OS,
  escaparLike,
  normalizarPlaca,
  traduzirErro,
  type FuncionarioAdmin,
  type MotivoBloqueio,
  type OrdemServicoAdmin,
  type TipoCliente,
} from './admin-shared';
import { STATUS_ATIVOS } from './anomalias-shared';
import { extrairCamposOrcamento, type CamposOrcamento } from '../orcamento/extrair';

const TIMEOUT_MS = 8000;

/** Mesmo guarda-chuva de timeout da versão client: nenhuma escrita é eterna. */
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

/**
 * Mensagem amigável para a falha de AUTORIZAÇÃO (papel insuficiente). Espelha o
 * texto de "sem permissão" do traduzirErro, mas para o caso em que a barreira é o
 * requireGestor (não o RLS). Mantém a UX: o admin entende que precisa entrar como
 * gerente/dono.
 */
const MSG_FORBIDDEN =
  'Sem permissão para esta ação. Entre como gerente ou dono desta oficina.';

/**
 * Roda a barreira de gestor e devolve a sessão; se o papel for insuficiente,
 * devolve um FetchState de erro (NUNCA deixa o GDELTA_FORBIDDEN estourar pro
 * cliente). A AUSÊNCIA de sessão não cai aqui: requireGestor() faz redirect('/admin')
 * — controle de fluxo do Next, tratado pelo framework, não é um erro a capturar.
 */
async function exigirGestorOuErro(): Promise<{ ok: true } | { ok: false; erro: FetchState<never> }> {
  try {
    await requireGestor();
    return { ok: true };
  } catch (e) {
    // requireGestor lança GDELTA_FORBIDDEN para papel insuficiente. Qualquer outra
    // exceção (ex.: falha ao ler a sessão) também vira erro amigável, sem vazar.
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('GDELTA_FORBIDDEN')) {
      return { ok: false, erro: { status: 'error', message: MSG_FORBIDDEN } };
    }
    // redirect() do Next lança um erro de controle de fluxo (NEXT_REDIRECT) que NÃO
    // pode ser engolido — re-lança para o framework concluir o redirect.
    throw e;
  }
}

/**
 * Converte um timestamp do banco em epoch ms tratando-o como UTC. Cópia MÍNIMA e
 * idêntica de queries.parseISOComUTC (coberta por testes lá), inlinada aqui pelo
 * MESMO motivo de admin-shared.normalizarPlaca: este módulo é 'use server' e
 * queries.ts importa hooks de React + o cliente do browser — o build do Next
 * proíbe arrastar isso para um Server Action. O Postgres grava `timestamp` SEM
 * 'Z'; sem isso o JS interpretaria como hora local e erraria pelo offset do fuso.
 */
function parseISOComUTC(iso: string): number {
  const isoComUTC =
    iso.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso.replace(' ', 'T') + 'Z';
  return new Date(isoComUTC).getTime();
}

/** Forma mínima de um apontamento aberto que precisamos para encerrá-lo. */
type ApontamentoAberto = {
  id: string;
  status_tarefa: string;
  pausado_em: string | null;
  tempo_pausado_seg: number | null;
};

/**
 * Encerra TODOS os apontamentos ainda abertos de uma OS (escopo travado:
 * "Entregue → OS sai do quadro ativo + FECHA APONTAMENTOS ABERTOS"). Sem isto,
 * um timer deixado rodando vira órfão (a OS some do quadro pela `.neq('Entregue')`
 * e o operário não acha mais o carro pra finalizar), inflando o tempo trabalhado
 * e a contagem "produzindo" até o teto de 10,5h jogá-lo nas anomalias.
 *
 * Reusa EXATAMENTE a matemática de queries.finalizarApontamento: hora_fim no
 * relógio do SERVIDOR (nunca do tablet) e, para os que estão 'Pausado',
 * acumula em tempo_pausado_seg o intervalo desde `pausado_em`. Roda server-side,
 * sob a sessão do cookie (o RLS isola por oficina_id) e depois da barreira de
 * gestor já feita pelo chamador.
 *
 * BEST-EFFORT por desenho: a entrega da OS (UPDATE de status) é a ação principal
 * e já sucedeu quando isto roda; uma falha aqui NÃO desfaz a entrega nem estoura
 * pro cliente — o pior caso degrada para o comportamento de hoje (o apontamento
 * vira fantasma e cai em /admin/anomalias para correção manual). Devolve o nº de
 * apontamentos que conseguiu encerrar (0 quando não havia nenhum aberto).
 *
 * Dependência (sinalizada, não resolvida aqui): o UPDATE em `apontamentos` pelo
 * gestor depende dos grants de escrita admin (Migration 004/006). Antes deles o
 * RLS recusa silenciosamente — o mesmo grant que registrarCorrecao já consome.
 */
async function encerrarApontamentosDaOS(
  supabase: Awaited<ReturnType<typeof getServerClient>>,
  ordemServicoId: string
): Promise<number> {
  try {
    const result = await withTimeout(
      supabase
        .from('apontamentos')
        .select('id, status_tarefa, pausado_em, tempo_pausado_seg')
        .eq('ordem_servico_id', ordemServicoId)
        .in('status_tarefa', [...STATUS_ATIVOS])
    );
    const { data, error } = result as {
      data: ApontamentoAberto[] | null;
      error: { message: string } | null;
    };
    if (error || !data || data.length === 0) return 0;

    const agora = Date.now();
    let encerrados = 0;
    for (const ap of data) {
      // Mesma regra do totem (finalizarApontamento): se estava 'Pausado', soma o
      // intervalo desde pausado_em ao tempo_pausado_seg antes de fechar.
      let tempoPausadoTotal = ap.tempo_pausado_seg ?? 0;
      if (ap.status_tarefa === 'Pausado' && ap.pausado_em) {
        const segundosPausados = Math.max(0, Math.floor((agora - parseISOComUTC(ap.pausado_em)) / 1000));
        tempoPausadoTotal += segundosPausados;
      }
      const upd = await withTimeout(
        supabase
          .from('apontamentos')
          .update({
            hora_fim: new Date(agora).toISOString(),
            status_tarefa: 'Finalizado',
            pausado_em: null,
            tempo_pausado_seg: tempoPausadoTotal,
          })
          .eq('id', ap.id)
      );
      const { error: updErr } = upd as { error: { message: string } | null };
      if (!updErr) encerrados += 1;
    }
    return encerrados;
  } catch {
    // Best-effort: nunca derruba a entrega da OS por falha ao fechar timers.
    return 0;
  }
}

/* ─────────────────── Ordens de Serviço — busca-antes-de-criar ─────────────────── */

/**
 * Buscar-antes-de-criar (server): procura uma OS ATIVA (não entregue) com a placa.
 * É a camada de UX que avisa o admin antes de criar uma duplicada (a trava real é o
 * índice único parcial do banco). Roda no servidor (RLS isola), com a barreira de
 * gestor. Comportamento idêntico à versão client (buscarOSAtivaPorPlaca):
 * retorna a OS ativa encontrada, ou null se a placa está livre.
 */
export async function buscarOSAtivaPorPlacaAction(
  placaCrua: string
): Promise<FetchState<OrdemServicoAdmin | null>> {
  const guard = await exigirGestorOuErro();
  if (!guard.ok) return guard.erro;

  const placa = normalizarPlaca(placaCrua);
  if (placa.length < 7) {
    return { status: 'error', message: 'Placa inválida. Confira os 7 caracteres.' };
  }
  try {
    const supabase = await getServerClient();
    const result = await withTimeout(
      supabase
        .from('ordens_servico')
        .select(COLS_OS)
        .eq('placa', placa)
        .neq('status_geral', 'Entregue')
        .order('data_entrada', { ascending: false })
        .limit(1)
        .maybeSingle()
    );
    const { data, error } = result as {
      data: OrdemServicoAdmin | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    return { status: 'success', data: data ?? null };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}

/* ─────────────────── Orçamento (PDF) → campos da OS ─────────────────── */

const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Lê um PDF de orçamento (Cília/WM/etc.) por IA e devolve os campos para
 * PRÉ-PREENCHER o formulário de OS — o admin confere e salva (NUNCA grava sozinho).
 * Barreira de gestor PRIMEIRO: só dono/gerente dispara (é o que controla o gasto de
 * API). Não toca no banco; só chama a IA (ver src/lib/orcamento/extrair.ts).
 */
export async function extrairOrcamentoAction(
  formData: FormData
): Promise<FetchState<CamposOrcamento>> {
  const guard = await exigirGestorOuErro();
  if (!guard.ok) return guard.erro;

  const arquivo = formData.get('arquivo');
  if (!(arquivo instanceof File)) {
    return { status: 'error', message: 'Nenhum arquivo enviado.' };
  }
  if (arquivo.type && arquivo.type !== 'application/pdf') {
    return { status: 'error', message: 'Envie o orçamento em PDF.' };
  }
  if (arquivo.size > MAX_PDF_BYTES) {
    return { status: 'error', message: 'PDF muito grande (máx. 8 MB).' };
  }
  try {
    const base64 = Buffer.from(await arquivo.arrayBuffer()).toString('base64');
    // Leitura por IA pode levar alguns segundos — folga maior que o timeout padrão.
    const campos = await withTimeout(extrairCamposOrcamento(base64), 30000);
    return { status: 'success', data: campos };
  } catch (e) {
    console.error('[orcamento/extrair] falha:', e);
    return {
      status: 'error',
      message: 'Não consegui ler o orçamento. Confira o PDF e tente de novo.',
    };
  }
}

/* ─────────────────── Ordens de Serviço — escrita ─────────────────── */

export type CriarOSInput = {
  placa: string;
  modelo_veiculo: string;
  tipo_cliente?: TipoCliente | null;
  data_entrada?: string | null; // 'YYYY-MM-DD' (default do banco = hoje)
  data_prometida?: string | null; // 'YYYY-MM-DD'
  valor_orcamento?: number | null;
  ref_externa?: string | null;
  status_geral?: string | null;
  etapa_atual?: EtapaId | null;
};

/**
 * Cria uma OS (server). Normaliza a placa em maiúsculas. NÃO seta oficina_id
 * (o trigger da Fase 1 preenche a partir do JWT). No sucesso, revalida /admin/os.
 */
export async function criarOS(input: CriarOSInput): Promise<FetchState<OrdemServicoAdmin>> {
  const guard = await exigirGestorOuErro();
  if (!guard.ok) return guard.erro;

  const placa = normalizarPlaca(input.placa);
  if (placa.length < 7) {
    return { status: 'error', message: 'Placa inválida. Confira os 7 caracteres.' };
  }
  const modelo = input.modelo_veiculo.trim();
  if (!modelo) {
    return { status: 'error', message: 'Informe o modelo do veículo.' };
  }
  try {
    const supabase = await getServerClient();
    const result = await withTimeout(
      supabase
        .from('ordens_servico')
        .insert({
          placa,
          modelo_veiculo: modelo,
          tipo_cliente: input.tipo_cliente ?? null,
          data_entrada: input.data_entrada ?? undefined, // ausente -> default do banco (hoje)
          data_prometida: input.data_prometida ?? null,
          valor_orcamento: input.valor_orcamento ?? null,
          ref_externa: input.ref_externa?.trim() || null,
          status_geral: input.status_geral ?? undefined, // ausente -> default do banco
          etapa_atual: input.etapa_atual ?? null,
        })
        .select(COLS_OS)
        .single()
    );
    const { data, error } = result as {
      data: OrdemServicoAdmin | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data) return { status: 'error', message: 'Falha ao criar a OS.' };
    revalidatePath('/admin/os');
    return { status: 'success', data };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}

export type AtualizarOSInput = {
  modelo_veiculo?: string;
  tipo_cliente?: TipoCliente | null;
  data_entrada?: string | null;
  data_prometida?: string | null;
  valor_orcamento?: number | null;
  ref_externa?: string | null;
  status_geral?: string | null;
  etapa_atual?: EtapaId | null;
  bloqueado?: boolean;
  motivo_bloqueio?: MotivoBloqueio | null;
};

/**
 * Edita campos de uma OS (server). Só envia o que vier definido em `input`.
 * No sucesso, revalida /admin/os.
 */
export async function atualizarOS(
  id: string,
  input: AtualizarOSInput
): Promise<FetchState<OrdemServicoAdmin>> {
  const guard = await exigirGestorOuErro();
  if (!guard.ok) return guard.erro;

  const patch: Record<string, unknown> = {};
  if (input.modelo_veiculo !== undefined) patch.modelo_veiculo = input.modelo_veiculo.trim();
  if (input.tipo_cliente !== undefined) patch.tipo_cliente = input.tipo_cliente;
  if (input.data_entrada !== undefined) patch.data_entrada = input.data_entrada;
  if (input.data_prometida !== undefined) patch.data_prometida = input.data_prometida;
  if (input.valor_orcamento !== undefined) patch.valor_orcamento = input.valor_orcamento;
  if (input.ref_externa !== undefined) patch.ref_externa = input.ref_externa?.trim() || null;
  if (input.status_geral !== undefined) patch.status_geral = input.status_geral;
  if (input.etapa_atual !== undefined) patch.etapa_atual = input.etapa_atual;
  if (input.bloqueado !== undefined) patch.bloqueado = input.bloqueado;
  if (input.motivo_bloqueio !== undefined) patch.motivo_bloqueio = input.motivo_bloqueio;

  if (Object.keys(patch).length === 0) {
    return { status: 'error', message: 'Nada para atualizar.' };
  }

  try {
    const supabase = await getServerClient();
    const result = await withTimeout(
      supabase.from('ordens_servico').update(patch).eq('id', id).select(COLS_OS).single()
    );
    const { data, error } = result as {
      data: OrdemServicoAdmin | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data) return { status: 'error', message: 'Falha ao atualizar a OS.' };

    // Escopo travado: ao marcar "Entregue", a OS sai do quadro ativo E os
    // apontamentos abertos são FECHADOS (senão viram órfãos/fantasmas). É
    // best-effort: a entrega (acima) já valeu; fechar os timers não pode desfazê-la.
    if (patch.status_geral === 'Entregue') {
      await encerrarApontamentosDaOS(supabase, id);
    }

    revalidatePath('/admin/os');
    return { status: 'success', data };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}

/* ─────────────────────── Funcionários ─────────────────────── */

export type FuncionarioInput = { nome: string; cargo: string };

/**
 * Buscar-antes-de-criar (G4 — server): procura um funcionário com o MESMO nome
 * (case-insensitive, ignorando espaços nas pontas). O totem identifica o operário
 * SÓ pelo nome — dois "Fulano" confundem. Roda no servidor com barreira de gestor.
 * Comportamento idêntico à versão client (buscarFuncionarioPorNome):
 * retorna o nome já cadastrado (como está no banco), ou null se está livre.
 */
export async function buscarFuncionarioPorNomeAction(
  nomeCru: string
): Promise<FetchState<{ id: string; nome: string; ativo: boolean } | null>> {
  const guard = await exigirGestorOuErro();
  if (!guard.ok) return guard.erro;

  const nome = nomeCru.trim();
  if (!nome) return { status: 'error', message: 'Informe o nome do funcionário.' };
  try {
    const supabase = await getServerClient();
    const result = await withTimeout(
      supabase
        .from('funcionarios')
        .select('id, nome, ativo')
        // Igualdade case-insensitive: ilike SEM wildcards. Escapamos %/_/\ do
        // termo para que sejam comparados literalmente (senão "a%" casaria tudo).
        .ilike('nome', escaparLike(nome))
        .limit(1)
        .maybeSingle()
    );
    const { data, error } = result as {
      data: { id: string; nome: string; ativo: boolean } | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    return { status: 'success', data: data ?? null };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}

/**
 * Checa se um funcionário tem apontamento ATIVO (G5 — server). "Ativo" =
 * status_tarefa in ('Em andamento','Pausado'), o mesmo critério do totem. O totem
 * casa apontamento ⇄ operário pelo NOME, então a checagem é por nome (igualdade
 * case-insensitive ignorando espaços, igual ao G4). Usado para avisar antes de
 * desativar — desativar com timer rodando deixaria um apontamento órfão. Roda no
 * servidor com barreira de gestor. Comportamento idêntico à versão client.
 */
export async function funcionarioTemApontamentoAtivoAction(
  nomeCru: string
): Promise<FetchState<boolean>> {
  const guard = await exigirGestorOuErro();
  if (!guard.ok) return guard.erro;

  const nome = nomeCru.trim();
  if (!nome) return { status: 'success', data: false };
  try {
    const supabase = await getServerClient();
    const result = await withTimeout(
      supabase
        .from('apontamentos')
        .select('id')
        .ilike('nome_funcionario', escaparLike(nome))
        .in('status_tarefa', ['Em andamento', 'Pausado'])
        .limit(1)
    );
    const { data, error } = result as {
      data: { id: string }[] | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    return { status: 'success', data: !!data && data.length > 0 };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}

/**
 * Cria um funcionário (server; nome + cargo são obrigatórios na tabela).
 * No sucesso, revalida /admin/funcionarios.
 */
export async function criarFuncionario(
  input: FuncionarioInput
): Promise<FetchState<FuncionarioAdmin>> {
  const guard = await exigirGestorOuErro();
  if (!guard.ok) return guard.erro;

  const nome = input.nome.trim();
  const cargo = input.cargo.trim();
  if (!nome) return { status: 'error', message: 'Informe o nome do funcionário.' };
  if (!cargo) return { status: 'error', message: 'Informe o cargo do funcionário.' };
  try {
    const supabase = await getServerClient();
    const result = await withTimeout(
      supabase
        .from('funcionarios')
        .insert({ nome, cargo })
        .select('id, nome, cargo, ativo')
        .single()
    );
    const { data, error } = result as {
      data: FuncionarioAdmin | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data) return { status: 'error', message: 'Falha ao criar o funcionário.' };
    revalidatePath('/admin/funcionarios');
    return { status: 'success', data };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}

/**
 * Edita nome e/ou cargo de um funcionário (server). No sucesso, revalida
 * /admin/funcionarios.
 */
export async function atualizarFuncionario(
  id: string,
  input: Partial<FuncionarioInput>
): Promise<FetchState<FuncionarioAdmin>> {
  const guard = await exigirGestorOuErro();
  if (!guard.ok) return guard.erro;

  const patch: Record<string, unknown> = {};
  if (input.nome !== undefined) patch.nome = input.nome.trim();
  if (input.cargo !== undefined) patch.cargo = input.cargo.trim();
  if (Object.keys(patch).length === 0) {
    return { status: 'error', message: 'Nada para atualizar.' };
  }
  try {
    const supabase = await getServerClient();
    const result = await withTimeout(
      supabase
        .from('funcionarios')
        .update(patch)
        .eq('id', id)
        .select('id, nome, cargo, ativo')
        .single()
    );
    const { data, error } = result as {
      data: FuncionarioAdmin | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data) return { status: 'error', message: 'Falha ao atualizar o funcionário.' };
    revalidatePath('/admin/funcionarios');
    return { status: 'success', data };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}

/**
 * Ativa/desativa um funcionário (soft delete, server). Nunca apagamos de verdade,
 * para preservar o histórico de apontamentos ligado ao nome. No sucesso, revalida
 * /admin/funcionarios.
 */
export async function setFuncionarioAtivo(
  id: string,
  ativo: boolean
): Promise<FetchState<FuncionarioAdmin>> {
  const guard = await exigirGestorOuErro();
  if (!guard.ok) return guard.erro;

  try {
    const supabase = await getServerClient();
    const result = await withTimeout(
      supabase
        .from('funcionarios')
        .update({ ativo })
        .eq('id', id)
        .select('id, nome, cargo, ativo')
        .single()
    );
    const { data, error } = result as {
      data: FuncionarioAdmin | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data) return { status: 'error', message: 'Falha ao mudar o status do funcionário.' };
    revalidatePath('/admin/funcionarios');
    return { status: 'success', data };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}
