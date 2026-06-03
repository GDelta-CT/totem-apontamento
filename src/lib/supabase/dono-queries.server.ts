/**
 * Painel do DONO — leitura no SERVIDOR (versão server-side). Server-move passo 1.
 *
 * É a PROVA DE PADRÃO da migração: a leitura da tela /admin/prazos sai do browser
 * e roda aqui, no servidor, dentro de um Server Component. Diferenças vs a versão
 * client (dono-queries.ts):
 *   - o cliente Supabase vem do DAL (getServerClient), JÁ AUTENTICADO pela sessão
 *     do COOKIE httpOnly → o RLS isola por oficina_id SEM nenhum filtro manual;
 *   - o oficina_id NUNCA vem do cliente: quem isola é o RLS + a sessão verificada
 *     (REGRA DE OURO do DAL). Aqui nem precisamos do oficina_id explicitamente —
 *     o RLS já recorta as linhas da própria oficina.
 *
 * O que é PRESERVADO, idêntico à versão client:
 *   - o contrato FetchState<T> (loading/success/empty/error);
 *   - o timeout de 8s (withTimeout) — nenhuma leitura trava o render para sempre;
 *   - a MESMA seleção de colunas (COLS_PAINEL_DONO) e o MESMO filtro/ordem;
 *   - a MESMA regra de negócio (montarPainelDono, de dono-shared.ts) — zero cópia.
 *
 * Sem sessão (cookie ausente/expirado — ex.: 1º render antes do login) NÃO é erro
 * nem redirect: devolvemos `empty` como semente e o AdminAuthGate (client) mostra
 * a tela de login. A query nunca roda sem sessão, então o anon não lê nada aqui.
 */

import 'server-only';

import { getSessao, getServerClient } from './dal';
import type { FetchState } from './queries';
import {
  COLS_PAINEL_DONO,
  montarPainelDono,
  traduzirErroDono,
  type OSRow,
  type PainelDono,
} from './dono-shared';

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
 * Monta o painel do dono a partir das OS ativas (não entregues), LENDO NO
 * SERVIDOR com a sessão do cookie. RLS isola por oficina_id automaticamente.
 */
export async function carregarPainelDonoServer(): Promise<FetchState<PainelDono>> {
  // Sem sessão verificada → não consulta (evita ler como anon) e deixa o gate
  // client cuidar do login. Não é erro: é o estado "ainda não logado".
  const sessao = await getSessao();
  if (!sessao) return { status: 'empty' };

  try {
    const supabase = await getServerClient();
    const result = await withTimeout(
      supabase
        .from('ordens_servico')
        .select(COLS_PAINEL_DONO)
        .neq('status_geral', 'Entregue')
        .order('data_prometida', { ascending: true, nullsFirst: false })
    );
    const { data, error } = result as { data: OSRow[] | null; error: { message: string } | null };
    if (error) return { status: 'error', message: traduzirErroDono(error.message) };

    return { status: 'success', data: montarPainelDono(data) };
  } catch (e) {
    return { status: 'error', message: traduzirErroDono(e instanceof Error ? e.message : null) };
  }
}
