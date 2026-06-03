/**
 * Camada de dados do ADMIN — passo 2 da ordem de construção (A.1).
 *
 * Espelha os padrões do totem (queries.ts): FetchState + timeout obrigatório +
 * mensagens de erro traduzidas. É um arquivo isolado: não toca no totem, no RLS
 * nem na produção.
 *
 * SERVER-MOVE (passo 1): os tipos, constantes de domínio e helpers puros
 * (somarDias, osEstaAtiva, escaparLike, traduzirErro, TIPOS_CLIENTE,
 * MOTIVOS_BLOQUEIO, STATUS_OS, COLS_OS, PapelOficina, …) saíram daqui para
 * admin-shared.ts (módulo PURO, sem Supabase), e a versão server-side da LEITURA
 * das listas vive em admin-queries.server.ts (RSC + DAL). Este arquivo continua
 * existindo para a ESCRITA (criar/editar/ativar — segue no cliente neste passo),
 * para as buscas "antes-de-criar" (parte do fluxo de gravação) e para o crachá da
 * sessão / papel (consumidos pelo AdminShell e pelo AdminAuthGate). Ele
 * RE-EXPORTA tudo que movemos para admin-shared, para NÃO quebrar nenhum import já
 * existente (AdminShell, AdminAuthGate, dal.ts, os testes e as duas telas seguem
 * importando daqui sem mudança). As telas /admin/os e /admin/funcionarios passaram
 * a LER do servidor; a escrita segue chamando estas funções igual a antes.
 *
 * SOBRE ESCRITA (criar/editar/desativar): só grava de verdade quando houver
 *   (1) usuário ADMIN logado com conta real (oficina_id no JWT) e
 *   (2) a Migration 004 (grants) aplicada no teste.
 * Até lá, as funções de escrita retornam erro de permissão — é esperado.
 *
 * O oficina_id NÃO é setado aqui nos inserts: o trigger BEFORE INSERT da Fase 1
 * preenche sozinho a partir do JWT, mantendo o isolamento multi-tenant.
 */

import { getSupabase, type EtapaId } from './client';
import { normalizarPlaca, type FetchState } from './queries';
import {
  COLS_OS,
  escaparLike,
  traduzirErro,
  type FuncionarioAdmin,
  type MotivoBloqueio,
  type OrdemServicoAdmin,
  type PapelOficina,
  type TipoCliente,
} from './admin-shared';

// Re-export do núcleo compartilhado: preserva o contrato de quem importava estes
// nomes de './admin-queries' (tipos, constantes de domínio e helpers puros). Os
// testes (somarDias/osEstaAtiva), o dal.ts (type PapelOficina) e as telas seguem
// importando daqui sem mudança.
export {
  STATUS_OS,
  TIPOS_CLIENTE,
  MOTIVOS_BLOQUEIO,
  somarDias,
  osEstaAtiva,
  type TipoCliente,
  type StatusOS,
  type MotivoBloqueio,
  type OrdemServicoAdmin,
  type FuncionarioAdmin,
  type PapelOficina,
} from './admin-shared';

const TIMEOUT_MS = 8000;

/** Mesmo guarda-chuva de timeout do totem: nenhum loading dura para sempre. */
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

/* ─────────────────── Ordens de Serviço — leitura ─────────────────── */

/**
 * Lista as OS da oficina, mais recentes primeiro. VERSÃO CLIENT (lê do browser).
 * A tela /admin/os agora LÊ DO SERVIDOR (listarOSServer); esta versão segue para
 * quem ainda lê do browser e para preservar o contrato.
 */
export async function listarOS(): Promise<FetchState<OrdemServicoAdmin[]>> {
  try {
    const result = await withTimeout(
      getSupabase()
        .from('ordens_servico')
        .select(COLS_OS)
        .order('data_entrada', { ascending: false })
    );
    const { data, error } = result as {
      data: OrdemServicoAdmin[] | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data || data.length === 0) return { status: 'empty' };
    return { status: 'success', data };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}

/** Carrega uma OS pelo id (para a tela de edição). */
export async function buscarOSPorId(id: string): Promise<FetchState<OrdemServicoAdmin>> {
  try {
    const result = await withTimeout(
      getSupabase().from('ordens_servico').select(COLS_OS).eq('id', id).maybeSingle()
    );
    const { data, error } = result as {
      data: OrdemServicoAdmin | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data) return { status: 'empty' };
    return { status: 'success', data };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}

/**
 * Buscar-antes-de-criar: procura uma OS ATIVA (não entregue) com a placa.
 * Usado para avisar o admin antes de criar uma duplicada. Faz parte do fluxo de
 * GRAVAÇÃO (segue no cliente neste passo). A trava real é o índice único parcial
 * do banco (Migration 005); aqui é a camada de UX.
 * Retorna a OS ativa encontrada, ou null se a placa está livre.
 */
export async function buscarOSAtivaPorPlaca(
  placaCrua: string
): Promise<FetchState<OrdemServicoAdmin | null>> {
  const placa = normalizarPlaca(placaCrua);
  if (placa.length < 7) {
    return { status: 'error', message: 'Placa inválida. Confira os 7 caracteres.' };
  }
  try {
    const result = await withTimeout(
      getSupabase()
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
 * Cria uma OS. Normaliza a placa em maiúsculas. NÃO seta oficina_id
 * (o trigger da Fase 1 preenche a partir do JWT).
 */
export async function criarOS(input: CriarOSInput): Promise<FetchState<OrdemServicoAdmin>> {
  const placa = normalizarPlaca(input.placa);
  if (placa.length < 7) {
    return { status: 'error', message: 'Placa inválida. Confira os 7 caracteres.' };
  }
  const modelo = input.modelo_veiculo.trim();
  if (!modelo) {
    return { status: 'error', message: 'Informe o modelo do veículo.' };
  }
  try {
    const result = await withTimeout(
      getSupabase()
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

/** Edita campos de uma OS. Só envia o que vier definido em `input`. */
export async function atualizarOS(
  id: string,
  input: AtualizarOSInput
): Promise<FetchState<OrdemServicoAdmin>> {
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
    const result = await withTimeout(
      getSupabase().from('ordens_servico').update(patch).eq('id', id).select(COLS_OS).single()
    );
    const { data, error } = result as {
      data: OrdemServicoAdmin | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data) return { status: 'error', message: 'Falha ao atualizar a OS.' };
    return { status: 'success', data };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}

/* ─────────────────────── Funcionários ─────────────────────── */

/**
 * Lista todos os funcionários (ativos e inativos), em ordem alfabética. VERSÃO
 * CLIENT. A tela /admin/funcionarios agora LÊ DO SERVIDOR
 * (listarFuncionariosServer); esta versão segue para o contrato/usos client.
 */
export async function listarFuncionarios(): Promise<FetchState<FuncionarioAdmin[]>> {
  try {
    const result = await withTimeout(
      getSupabase()
        .from('funcionarios')
        .select('id, nome, cargo, ativo')
        .order('nome', { ascending: true })
    );
    const { data, error } = result as {
      data: FuncionarioAdmin[] | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data || data.length === 0) return { status: 'empty' };
    return { status: 'success', data };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}

export type FuncionarioInput = { nome: string; cargo: string };

/**
 * Buscar-antes-de-criar (G4 — integridade por UX): procura um funcionário com o
 * MESMO nome (case-insensitive, ignorando espaços nas pontas). Faz parte do fluxo
 * de GRAVAÇÃO (segue no cliente neste passo). O totem identifica o operário SÓ
 * pelo nome — dois "Fulano" confundem na hora de achar a tarefa. Não é trava de
 * banco; é o aviso que deixa o admin confirmar antes de duplicar.
 * Retorna o nome já cadastrado (como está no banco), ou null se está livre.
 */
export async function buscarFuncionarioPorNome(
  nomeCru: string
): Promise<FetchState<{ id: string; nome: string; ativo: boolean } | null>> {
  const nome = nomeCru.trim();
  if (!nome) return { status: 'error', message: 'Informe o nome do funcionário.' };
  try {
    const result = await withTimeout(
      getSupabase()
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
 * Checa se um funcionário tem apontamento ATIVO (G5 — integridade por UX).
 * "Ativo" = status_tarefa in ('Em andamento','Pausado'), o mesmo critério do
 * totem (ver buscarApontamentoAtivo em queries.ts). Faz parte do fluxo de
 * GRAVAÇÃO (desativar — segue no cliente neste passo). O totem casa apontamento ⇄
 * operário pelo NOME, então a checagem é por nome. Usado para avisar antes de
 * desativar — desativar com timer rodando deixaria um apontamento órfão.
 * Retorna true se há pelo menos um apontamento ativo com esse nome.
 *
 * O CRITÉRIO DE NOME é o MESMO do G4 (buscarFuncionarioPorNome): igualdade
 * case-insensitive ignorando espaços nas pontas (trim + ilike escapado). Se
 * usássemos .eq exato, um funcionário cadastrado com caixa/espaço diferente do
 * apontamento escaparia da checagem e o G5 falharia em silêncio.
 */
export async function funcionarioTemApontamentoAtivo(
  nomeCru: string
): Promise<FetchState<boolean>> {
  const nome = nomeCru.trim();
  if (!nome) return { status: 'success', data: false };
  try {
    const result = await withTimeout(
      getSupabase()
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

/** Cria um funcionário (nome + cargo são obrigatórios na tabela). */
export async function criarFuncionario(
  input: FuncionarioInput
): Promise<FetchState<FuncionarioAdmin>> {
  const nome = input.nome.trim();
  const cargo = input.cargo.trim();
  if (!nome) return { status: 'error', message: 'Informe o nome do funcionário.' };
  if (!cargo) return { status: 'error', message: 'Informe o cargo do funcionário.' };
  try {
    const result = await withTimeout(
      getSupabase()
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
    return { status: 'success', data };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}

/** Edita nome e/ou cargo de um funcionário. */
export async function atualizarFuncionario(
  id: string,
  input: Partial<FuncionarioInput>
): Promise<FetchState<FuncionarioAdmin>> {
  const patch: Record<string, unknown> = {};
  if (input.nome !== undefined) patch.nome = input.nome.trim();
  if (input.cargo !== undefined) patch.cargo = input.cargo.trim();
  if (Object.keys(patch).length === 0) {
    return { status: 'error', message: 'Nada para atualizar.' };
  }
  try {
    const result = await withTimeout(
      getSupabase()
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
    return { status: 'success', data };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}

/**
 * Ativa/desativa um funcionário (soft delete). Nunca apagamos de verdade,
 * para preservar o histórico de apontamentos ligado ao nome.
 */
export async function setFuncionarioAtivo(
  id: string,
  ativo: boolean
): Promise<FetchState<FuncionarioAdmin>> {
  try {
    const result = await withTimeout(
      getSupabase()
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
    return { status: 'success', data };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}

/* ─────────────────── Sessão / papel do admin (passo 3) ─────────────────── */

/**
 * Lê o papel do usuário logado na PRÓPRIA oficina (tabela user_oficinas).
 * A política "user_ve_proprios_vinculos" garante que só vem a própria linha.
 * Consumida pelo AdminAuthGate e pelo AdminShell (não tocados neste passo).
 */
export async function papelDoUsuarioAtual(): Promise<
  FetchState<{ papel: PapelOficina; oficina_id: string }>
> {
  try {
    const result = await withTimeout(
      getSupabase().from('user_oficinas').select('role, oficina_id').limit(1).maybeSingle()
    );
    const { data, error } = result as {
      data: { role: PapelOficina; oficina_id: string } | null;
      error: { message: string } | null;
    };
    if (error) return { status: 'error', message: traduzirErro(error.message) };
    if (!data) return { status: 'empty' };
    return { status: 'success', data: { papel: data.role, oficina_id: data.oficina_id } };
  } catch (e) {
    return { status: 'error', message: traduzirErro(e instanceof Error ? e.message : null) };
  }
}

/** Lê as claims do JWT (crachá) sem validar assinatura — só para exibir. */
function lerClaimsJWT(token: string): Record<string, unknown> | null {
  try {
    const base = token.split('.')[1];
    const json = atob(base.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Crachá da sessão atual: e-mail + o oficina_id QUE O SERVIDOR CARIMBOU no JWT.
 * É a prova visível do isolamento (o cliente não escolheu esse valor).
 * Consumida pelo AdminShell (não tocado neste passo).
 */
export async function cracheDaSessao(): Promise<{
  email: string | null;
  oficinaIdNoJWT: string | null;
} | null> {
  const { data } = await getSupabase().auth.getSession();
  const s = data.session;
  if (!s) return null;
  const claims = lerClaimsJWT(s.access_token);
  const oid = claims && typeof claims.oficina_id === 'string' ? claims.oficina_id : null;
  return { email: s.user.email ?? null, oficinaIdNoJWT: oid };
}
