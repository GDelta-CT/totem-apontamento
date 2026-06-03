/**
 * Camada de dados do ADMIN — LEITURA no SERVIDOR (versão server-side).
 * Server-move passo 1.
 *
 * A LEITURA das listas de /admin/os (listarOSServer) e /admin/funcionarios
 * (listarFuncionariosServer) sai do browser e roda aqui, em Server Components.
 * Diferenças vs a versão client (admin-queries.ts):
 *   - o cliente Supabase vem do DAL (getServerClient), JÁ AUTENTICADO pela sessão
 *     do COOKIE httpOnly → o RLS isola por oficina_id SEM nenhum filtro manual;
 *   - o oficina_id NUNCA vem do cliente: quem isola é o RLS + a sessão verificada
 *     (REGRA DE OURO do DAL).
 *
 * O que é PRESERVADO, idêntico à versão client:
 *   - o contrato FetchState<T> (loading/success/empty/error);
 *   - o timeout de 8s (withTimeout) — nenhuma leitura trava o render para sempre;
 *   - a MESMA seleção de colunas/ordem e o MESMO traduzirErro (admin-shared.ts).
 *
 * A ESCRITA (criar/editar OS, criar/editar/ativar funcionário, e as buscas
 * "antes-de-criar" que fazem parte do fluxo de gravação) CONTINUA NO CLIENTE neste
 * passo (Passo 3 do server-move move a escrita): a View chama essas funções de
 * admin-queries.ts e, no sucesso, dá router.refresh() para o servidor re-ler aqui.
 *
 * Sem sessão (cookie ausente/expirado — ex.: 1º render antes do login) NÃO é erro
 * nem redirect: devolvemos `empty` e o AdminAuthGate (client) mostra a tela de
 * login. A query nunca roda sem sessão, então o anon não lê nada aqui.
 */

import 'server-only';

import { getServerClient, sessaoGestorOuNull } from './dal';
import type { FetchState } from './queries';
import {
  COLS_OS,
  traduzirErro,
  type FuncionarioAdmin,
  type OrdemServicoAdmin,
} from './admin-shared';

const TIMEOUT_MS = 8000;

/** Mesmo guarda-chuva de timeout da versão client: nenhuma leitura é eterna. */
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
 * Lista as OS da oficina, mais recentes primeiro, LENDO NO SERVIDOR com a sessão
 * do cookie. RLS isola por oficina_id automaticamente. Mesma seleção/ordem da
 * versão client (listarOS).
 */
export async function listarOSServer(): Promise<FetchState<OrdemServicoAdmin[]>> {
  // Sem sessão verificada → não consulta (evita ler como anon) e deixa o gate
  // client cuidar do login. Não é erro: é o estado "ainda não logado".
  const sessao = await sessaoGestorOuNull();
  if (!sessao) return { status: 'empty' };

  try {
    const supabase = await getServerClient();
    const result = await withTimeout(
      supabase.from('ordens_servico').select(COLS_OS).order('data_entrada', { ascending: false })
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

/**
 * Lista todos os funcionários (ativos e inativos), em ordem alfabética, LENDO NO
 * SERVIDOR com a sessão do cookie. RLS isola por oficina_id automaticamente.
 * Mesma seleção/ordem da versão client (listarFuncionarios).
 */
export async function listarFuncionariosServer(): Promise<FetchState<FuncionarioAdmin[]>> {
  const sessao = await sessaoGestorOuNull();
  if (!sessao) return { status: 'empty' };

  try {
    const supabase = await getServerClient();
    const result = await withTimeout(
      supabase.from('funcionarios').select('id, nome, cargo, ativo').order('nome', { ascending: true })
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
