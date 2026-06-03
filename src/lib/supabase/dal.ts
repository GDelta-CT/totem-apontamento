/**
 * DAL — Data Access Layer (Passo 0 do server-move).
 *
 * É o ÚNICO ponto por onde o servidor lê "quem é o usuário" e cria o cliente
 * Supabase server-side. Centralizar aqui garante que TODA leitura/escrita
 * server-side passe pelo mesmo check de sessão (o guia de auth do Next manda
 * pôr o check perto do dado, no DAL, NÃO no layout — layout não revalida em
 * navegação).
 *
 * REGRA DE OURO (multi-tenant): NUNCA confiar em oficina_id vindo do cliente.
 * O oficina_id confiável sai do JWT (claim carimbada pelo servidor na Fase 1,
 * lida via getClaims(), que VERIFICA a assinatura do token). A identidade do
 * usuário vem de getUser() (contata o Auth server e valida o token) — não de
 * getSession() (que só lê o cookie, sem verificar).
 *
 * Memoização: getServerClient() e getSessao() usam React cache() para rodar uma
 * única vez por passagem de render/request, evitando recriar cliente e refazer
 * a ida ao Auth server a cada componente.
 *
 * Neste Passo 0 nada do app de produção CHAMA o DAL ainda (a migração das
 * queries é o Passo 1+). É a fundação: aditivo, reversível, não toca RLS.
 */

import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from './server';
import type { PapelOficina } from './admin-queries';

/** Sessão server-side mínima e SEGURA: tudo aqui veio verificado do servidor. */
export type SessaoServidor = {
  /** ID do usuário autenticado (sub do JWT, verificado por getUser). */
  userId: string;
  /** E-mail do usuário (pode faltar em contas de device sem e-mail). */
  email: string | null;
  /** oficina_id carimbado no JWT pelo servidor (claim verificada). Isolamento. */
  oficinaId: string | null;
  /** Papel do usuário NESTA oficina (user_oficinas via RLS). Null se sem vínculo. */
  papel: PapelOficina | null;
};

/**
 * Cliente Supabase server-side ligado aos cookies da requisição. Memoizado por
 * render: chamar várias vezes no mesmo request reaproveita o MESMO cliente.
 * Use este em vez de criar o cliente direto — é o ponto único do servidor.
 */
export const getServerClient = cache(async (): Promise<SupabaseClient> => {
  return createSupabaseServerClient();
});

/**
 * Sessão atual do usuário, derivada SOMENTE de fontes verificadas pelo servidor.
 * Retorna `null` se não houver usuário autenticado (cookie ausente/expirado).
 *
 * Passos:
 *  1. getUser() — identidade verificada contra o Auth server.
 *  2. getClaims() — lê oficina_id da claim do JWT (assinatura verificada).
 *  3. user_oficinas (RLS) — papel do usuário na PRÓPRIA oficina (só vem a
 *     própria linha, garantido pela policy "user_ve_proprios_vinculos").
 *
 * Memoizado por render para não repetir a ida ao Auth server em cada chamada.
 */
export const getSessao = cache(async (): Promise<SessaoServidor | null> => {
  const supabase = await getServerClient();

  // 1) Identidade verificada (NÃO usar getSession aqui: ela não verifica).
  const {
    data: { user },
    error: erroUser,
  } = await supabase.auth.getUser();
  if (erroUser || !user) return null;

  // 2) oficina_id confiável: claim do JWT verificada via getClaims().
  let oficinaId: string | null = null;
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (claims && typeof claims.oficina_id === 'string') {
    oficinaId = claims.oficina_id;
  }

  // 3) Papel na própria oficina (RLS limita à linha do usuário). Best-effort:
  //    a ausência de vínculo não derruba a sessão — só deixa papel = null.
  let papel: PapelOficina | null = null;
  const { data: vinculo } = await supabase
    .from('user_oficinas')
    .select('role, oficina_id')
    .limit(1)
    .maybeSingle();
  if (vinculo) {
    papel = (vinculo.role as PapelOficina) ?? null;
    // Fallback de oficina_id quando a claim não estiver presente (ex.: hook
    // ainda não propagado). Continua sendo um valor do SERVIDOR (via RLS),
    // nunca do cliente.
    if (!oficinaId && typeof vinculo.oficina_id === 'string') {
      oficinaId = vinculo.oficina_id;
    }
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    oficinaId,
    papel,
  };
});

/** Papéis com acesso ao painel /admin (gestão). */
const PAPEIS_GESTOR: readonly PapelOficina[] = ['dono', 'gerente'];

/**
 * Exige sessão de GESTOR (dono/gerente). Para uso em Server Actions e Route
 * Handlers do /admin — trate toda Server Action como endpoint público e cheque
 * o papel DENTRO dela (o guia de auth do Next é explícito: não confiar só no
 * proxy/UI). Sem sessão → redireciona para o /admin (tela de login do gate).
 * Com sessão mas sem papel de gestor → lança erro (o chamador trata/responde
 * 403). Retorna a sessão já validada para reuso.
 */
export async function requireGestor(): Promise<SessaoServidor> {
  const sessao = await getSessao();
  if (!sessao) {
    redirect('/admin');
  }
  if (!sessao.papel || !PAPEIS_GESTOR.includes(sessao.papel)) {
    throw new Error('GDELTA_FORBIDDEN: requer papel de dono ou gerente.');
  }
  return sessao;
}

/**
 * Exige sessão de DEVICE (totem): qualquer usuário autenticado COM oficina_id
 * no JWT serve — é a sessão da oficina que isola o tenant. Sem sessão → erro
 * (o chamador, tipicamente uma Server Action do totem, responde "não salvou").
 * Não redireciona: o totem trata a falta de sessão na sua própria UI/gate.
 */
export async function requireDevice(): Promise<SessaoServidor> {
  const sessao = await getSessao();
  if (!sessao) {
    throw new Error('GDELTA_UNAUTHENTICATED: sessão do totem ausente ou expirada.');
  }
  if (!sessao.oficinaId) {
    throw new Error('GDELTA_NO_TENANT: sessão sem oficina_id no JWT.');
  }
  return sessao;
}
