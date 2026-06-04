'use client';

/**
 * /admin/producao — VIEW (client) da Visão Operacional AO VIVO (Passo 3 da ordem A.1).
 *
 * O "quadro do Daily Huddle": responde "todo mundo produzindo agora?" (faixa dos
 * 3 estados do operário) e "que carro está travado/lento?" (kanban por etapa +
 * marca de bloqueio). Só leitura.
 *
 * SERVER-MOVE (passo 1 — a tela MAIS complexa): a LEITURA agora vem do SERVIDOR.
 * A página (Server Component) busca via carregarVisaoLiveServer() e injeta o
 * resultado aqui como `estadoInicial`. Este componente NÃO consulta o Supabase no
 * browser para LER: o auto-refresh (mesma cadência de 20s) e o botão "Atualizar"
 * chamam router.refresh(), que re-roda o Server Component e RE-BUSCA NO SERVIDOR —
 * zero query Supabase no Network do browser, RLS isolando pela sessão do cookie. A
 * sensação "ao vivo" é preservada: o selo AO VIVO marca a hora a cada refresh
 * bem-sucedido.
 *
 * ESCRITA: esta tela é SÓ LEITURA — não há arrastar/corrigir etapa aqui (a edição
 * de etapa_atual vive no formulário da OS, em /admin/os). Não há, portanto, nenhuma
 * função de escrita para mover; nada do totem/RLS/escrita foi tocado.
 *
 * Visual (PIVÔ): usa o AdminShell ESCURO/INDUSTRIAL (mesmo idioma do totem).
 * Esta tela NÃO redeclara chrome — o shell provê barra de comando, abas e a
 * linguagem de cartão/pílula/botão. O selo AO VIVO vai no `subtitulo` do shell.
 * Só um bloco curto `adm-prod-*` (namespaced) cobre o que é próprio desta tela:
 * os KPIs com benchmark, a faixa "Equipe agora" e o KANBAN premium (cards
 * FLUTUANDO sobre colunas-fantasma = trilhas escuras recuadas com borda
 * tracejada). Tokens da camada do totem (--bg-*, --text-*, --*-primary/-glow,
 * --gd-*). Números com `gd-tabular` que brilham; dot vivo com `gd-live-dot`.
 *
 * NENHUMA regra de negócio mudou — só a origem da leitura (servidor). UX, copy,
 * a11y e o agrupamento por etapa/3 estados PRESERVADOS 100%.
 */

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AdminAuthGate } from '../AdminAuthGate';
import { AdminShell } from '../_shell/AdminShell';
import type { FetchState } from '@/lib/supabase/queries';
import {
  ESTADO_LABEL,
  type CarroLive,
  type EstadoOperario,
  type VisaoLive,
} from '@/lib/supabase/live-queries';

// Mesma cadência do original (20s): o auto-refresh re-roda o Server Component.
const REFRESH_MS = 20000;

export function ProducaoView({ estadoInicial }: { estadoInicial: FetchState<VisaoLive> }) {
  return (
    <AdminAuthGate>
      <Producao estadoInicial={estadoInicial} />
    </AdminAuthGate>
  );
}

function Producao({ estadoInicial }: { estadoInicial: FetchState<VisaoLive> }) {
  const router = useRouter();
  const [atualizando, startTransition] = useTransition();
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  // Evita re-setar o timestamp à toa: só marca quando um NOVO estado de sucesso
  // chega do servidor (cada router.refresh bem-sucedido entrega um novo objeto).
  const ultimoEstadoRef = useRef<FetchState<VisaoLive> | null>(null);

  const estado = estadoInicial;

  // Marca a hora do servidor a cada carga bem-sucedida (mantém o selo AO VIVO
  // "vivo", como o original fazia após cada fetch de sucesso).
  useEffect(() => {
    if (estado.status === 'success' && estado !== ultimoEstadoRef.current) {
      setUltimaAtualizacao(new Date());
    }
    ultimoEstadoRef.current = estado;
  }, [estado]);

  // O dado vem do SERVIDOR (estadoInicial). Re-buscar = re-rodar o Server
  // Component via router.refresh() (sem query Supabase no browser para LER).
  const carregar = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  // Auto-refresh: MESMA cadência (20s) do original, mas re-buscando NO SERVIDOR.
  // router.refresh() re-executa o Server Component → re-busca no servidor e
  // mescla o novo payload RSC sem perder estado de cliente (sensação "ao vivo").
  // ECONOMIA (Daily Huddle, painel aberto o dia todo): com a aba em segundo plano
  // o ciclo NÃO dispara (evita re-rodar o Server Component + Auth à toa, poupando
  // bateria/conexão do tablet); ao voltar a ficar visível, faz UM refresh imediato
  // para "ressincronizar". Mesma cadência quando visível; um só timer; listener limpo.
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) router.refresh();
    };
    const id = setInterval(tick, REFRESH_MS);
    const onVisibility = () => {
      if (!document.hidden) router.refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [router]);

  // Selo AO VIVO + timestamp do servidor → vai no subtítulo do shell.
  const selo = (
    <>
      <span className="adm-prod-dot gd-live-dot" aria-hidden="true" />
      AO VIVO
      <span className="adm-prod-selo-sep" aria-hidden="true" />
      <span className="adm-prod-selo-time gd-tabular">
        {ultimaAtualizacao ? ultimaAtualizacao.toLocaleTimeString('pt-BR') : '—'}
      </span>
    </>
  );

  return (
    <AdminShell
      abaAtiva="producao"
      titulo="Produção ao vivo"
      subtitulo={selo}
      acao={
        <button
          className="adm-btn adm-btn--ghost"
          onClick={carregar}
          disabled={atualizando}
          title="Atualizar agora"
          aria-label="Atualizar agora"
        >
          <IconRefresh />
          {atualizando ? 'Atualizando…' : 'Atualizar'}
        </button>
      }
    >
      {estado.status === 'loading' && <SkeletonPatio />}

      {estado.status === 'error' && (
        <div className="adm-flash fam-bad adm-prod-flash">
          {estado.message}{' '}
          <button className="adm-link" onClick={carregar}>
            Tentar de novo
          </button>
        </div>
      )}

      {/* Sem sessão a query server devolve `empty` (o gate cobre o login). Já
          logado e sem carros, o Kanban mostra o vazio amigável. */}
      {estado.status === 'empty' && (
        <p className="adm-prod-info">Nenhum carro ativo no pátio.</p>
      )}

      {estado.status === 'success' && (
        <>
          <ResumoEstados visao={estado.data} />
          <FaixaOperarios visao={estado.data} />
          <Kanban visao={estado.data} />
        </>
      )}

      <Estilos />
    </AdminShell>
  );
}

/* ─── Ícones SVG inline (stroke currentColor 1.5px) ─── */
function IconRefresh() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
/** Cadeado (bloqueio-PROBLEMA: peça/aprovação — risco, vermelho). */
function IconLock() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
/** Relógio/seta (bloqueio-FLUXO: outro setor/cura — espera prevista, âmbar). */
function IconFlow() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

/**
 * Apresentação do MOTIVO de bloqueio (CLAUDE.md — "divisão visual, mesmo modelo
 * de dados, cor/ícone diferente"). Espelha os valores de MOTIVOS_BLOQUEIO
 * (admin-shared): PROBLEMA {peça, aprovação} = VERMELHO + cadeado; FLUXO {outro
 * setor, cura} = ÂMBAR + relógio. Só presentation — não muda nenhum dado/regra:
 * o `motivo_bloqueio` segue sendo o mesmo código vindo da OS. Códigos
 * desconhecidos (ou texto livre antigo) caem em PROBLEMA (vermelho), o mais
 * cauteloso. Devolve também o rótulo legível (o código cru não vai mais à tela).
 */
type CategoriaBloqueio = 'problema' | 'fluxo';
const BLOQUEIO_META: Record<string, { nome: string; categoria: CategoriaBloqueio }> = {
  aguardando_peca: { nome: 'Aguardando peça', categoria: 'problema' },
  aguardando_aprovacao: { nome: 'Aguardando aprovação', categoria: 'problema' },
  em_outro_setor: { nome: 'Em outro setor', categoria: 'fluxo' },
  aguardando_cura: { nome: 'Aguardando cura', categoria: 'fluxo' },
};
function lerBloqueio(motivo: string | null | undefined): {
  nome: string;
  categoria: CategoriaBloqueio;
} {
  if (motivo && BLOQUEIO_META[motivo]) return BLOQUEIO_META[motivo];
  // Sem motivo explícito ou código não mapeado → trata como PROBLEMA (cauteloso).
  return { nome: motivo ?? 'Bloqueado', categoria: 'problema' };
}

/**
 * Skeleton "prensado" do pátio (loading): caixas --bg-card com shimmer (keyframe
 * `shimmer` do globals). Mantém o ritmo da tela carregada — banda de KPIs + faixa
 * + trilhas do kanban — para a transição não "saltar". aria-hidden (decorativo);
 * o aria-busy do conteúdo cobre o leitor de tela. Sem mexer em dado.
 */
function SkeletonPatio() {
  return (
    <div className="adm-prod-skel" aria-hidden="true">
      <div className="adm-prod-skel-resumo">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="adm-prod-skel-kpi adm-prod-skel-box" key={i} />
        ))}
      </div>
      <div className="adm-prod-skel-faixa">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="adm-prod-skel-op adm-prod-skel-box" key={i} />
        ))}
      </div>
      <div className="adm-prod-skel-kanban">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="adm-prod-skel-col" key={i}>
            <div className="adm-prod-skel-colhead adm-prod-skel-box" />
            <div className="adm-prod-skel-trilha">
              <div className="adm-prod-skel-card adm-prod-skel-box" />
              <div className="adm-prod-skel-card adm-prod-skel-box" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResumoEstados({ visao }: { visao: VisaoLive }) {
  const r = visao.resumo;
  // "Produzindo" é o KPI-herói: vira fração produzindo/total-da-equipe-hoje,
  // com a régua de benchmark de Ocupação. Total = quem teve apontamento hoje.
  const totalEquipe = visao.operarios.length;
  const cards: {
    key: string;
    label: string;
    valor: number;
    de?: number;
    tone: 'ok' | 'warn' | 'info' | 'navy' | 'bad';
    nota?: string;
  }[] = [
    {
      key: 'produzindo',
      label: 'Produzindo',
      valor: r.produzindo,
      de: totalEquipe || undefined,
      tone: 'ok',
      nota: 'Ocupação 70–85% ideal',
    },
    { key: 'em_pausa', label: 'Em pausa', valor: r.em_pausa, tone: 'warn' },
    { key: 'sem_tarefa', label: 'Sem tarefa ativa', valor: r.sem_tarefa, tone: 'info' },
    { key: 'ativos', label: 'Carros ativos', valor: r.carrosAtivos, tone: 'navy', nota: 'Pátio em produção' },
    { key: 'bloqueados', label: 'Bloqueados', valor: r.carrosBloqueados, tone: 'bad' },
  ];
  return (
    <section className="adm-prod-resumo">
      {cards.map((c) => (
        <div className={'adm-prod-kpi tone-' + c.tone} key={c.key}>
          <span className="adm-prod-kpi-num gd-tabular">
            {c.valor}
            {c.de != null && <span className="adm-prod-kpi-de gd-tabular">/{c.de}</span>}
          </span>
          <span className="adm-prod-kpi-lbl">{c.label}</span>
          {c.nota && <span className="adm-prod-kpi-nota">{c.nota}</span>}
        </div>
      ))}
    </section>
  );
}

function FaixaOperarios({ visao }: { visao: VisaoLive }) {
  const ordem: EstadoOperario[] = ['produzindo', 'em_pausa', 'sem_tarefa'];
  const ops = [...visao.operarios].sort(
    (a, b) => ordem.indexOf(a.estado) - ordem.indexOf(b.estado)
  );
  return (
    <section className="adm-prod-faixa">
      <div className="adm-prod-faixa-head">
        <h2 className="adm-prod-sec-titulo">Equipe agora</h2>
        <span className="adm-prod-faixa-hint">todo mundo produzindo?</span>
      </div>
      {ops.length === 0 ? (
        <p className="adm-prod-faixa-vazia">Ninguém apontou ainda hoje.</p>
      ) : (
        <div className="adm-prod-op-grid">
          {ops.map((o, i) => {
            const meta = ESTADO_LABEL[o.estado];
            // divisor sutil quando o grupo de estado muda (produzindo → pausa → sem tarefa)
            const novoGrupo = i > 0 && ops[i - 1].estado !== o.estado;
            return (
              <div className="adm-prod-op-cell" key={o.nome}>
                {novoGrupo && <span className="adm-prod-op-divisor" aria-hidden="true" />}
                <div className={'adm-prod-op-card estado-' + o.estado}>
                  <span
                    className={'adm-prod-op-dot' + (o.estado === 'produzindo' ? ' gd-live-dot' : '')}
                  />
                  <div className="adm-prod-op-info">
                    <strong>{o.nome}</strong>
                    <span className="adm-prod-op-estado">
                      {meta.texto}
                      {o.estado === 'em_pausa' && o.motivoPausa ? ` · ${o.motivoPausa}` : ''}
                    </span>
                    {o.placaAtual && (
                      <span className="adm-prod-op-carro gd-tabular">
                        {o.placaAtual}
                        {o.etapaAtual ? ` · ${o.etapaAtual}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Kanban({ visao }: { visao: VisaoLive }) {
  const comCarros = visao.colunas.filter((c) => c.carros.length > 0);
  const semNenhum = visao.carros.length === 0;
  return (
    <section className="adm-prod-kanban-sec">
      <h2 className="adm-prod-sec-titulo">Pátio por etapa</h2>
      {semNenhum && <p className="adm-prod-info">Nenhum carro ativo no pátio.</p>}
      <div className="adm-prod-kanban">
        {comCarros.map((col) => (
          <div className="adm-prod-coluna" key={col.etapa}>
            <header className="adm-prod-col-head">
              <span className="adm-prod-col-nome">{col.nome}</span>
              <span className="adm-prod-col-count gd-tabular">{col.carros.length}</span>
            </header>
            <div className="adm-prod-col-trilha">
              {col.carros.length > 0 ? (
                col.carros.map((carro) => <CardCarro key={carro.id} carro={carro} />)
              ) : (
                <p className="adm-prod-col-vazia">— sem carros nesta etapa</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* carros ativos sem etapa definida ainda */}
      <SemEtapa carros={visao.carros.filter((c) => !c.etapa_atual)} />
    </section>
  );
}

function SemEtapa({ carros }: { carros: CarroLive[] }) {
  if (carros.length === 0) return null;
  return (
    <div className="adm-prod-sem-etapa">
      <h3 className="adm-prod-sec-titulo">
        Sem etapa iniciada <span className="adm-prod-col-count gd-tabular">{carros.length}</span>
      </h3>
      <div className="adm-prod-sem-etapa-grid">
        {carros.map((c) => (
          <CardCarro key={c.id} carro={c} />
        ))}
      </div>
    </div>
  );
}

function CardCarro({ carro }: { carro: CarroLive }) {
  // Assinatura: borda-esquerda 4px na cor de estado do carro (via token, sem hex cru).
  const atrasada =
    carro.data_prometida && new Date(carro.data_prometida) < new Date() ? true : false;
  // Bloqueio: PROBLEMA (vermelho/cadeado) × FLUXO (âmbar/relógio), derivado do
  // motivo. A classe do card vira sit-bloqueado + bloq-{categoria} (cor da
  // borda-esquerda que brilha + tag + motivo seguem a categoria).
  const bloq = carro.bloqueado ? lerBloqueio(carro.motivo_bloqueio) : null;
  const classeSit =
    carro.situacao === 'bloqueado' && bloq
      ? `sit-bloqueado bloq-${bloq.categoria}`
      : 'sit-' + carro.situacao;
  return (
    <div className={'adm-prod-card ' + classeSit}>
      <div className="adm-prod-card-top">
        <strong className="adm-prod-card-placa gd-tabular">{carro.placa}</strong>
        {bloq && (
          <span className={'adm-prod-tag bloq-' + bloq.categoria}>
            {bloq.categoria === 'problema' ? <IconLock /> : <IconFlow />}
            bloqueado
          </span>
        )}
        {atrasada && <span className="adm-prod-tag atraso">atrasado</span>}
      </div>
      <span className="adm-prod-card-modelo">{carro.modelo_veiculo}</span>
      {bloq && (
        <span className={'adm-prod-card-motivo bloq-' + bloq.categoria}>
          {bloq.categoria === 'problema' ? <IconLock /> : <IconFlow />}
          {bloq.nome}
        </span>
      )}
      {carro.ativos.length > 0 ? (
        <div className="adm-prod-card-ativos">
          {carro.ativos.map((a) => (
            <span
              key={a.id}
              className={'adm-prod-mini ' + (a.status_tarefa === 'Pausado' ? 'mini-pausa' : 'mini-trab')}
            >
              <span
                className={'adm-prod-mini-dot' + (a.status_tarefa === 'Pausado' ? '' : ' gd-live-dot')}
              />
              {a.nome_funcionario}
              {a.status_tarefa === 'Pausado' ? ' (pausa)' : ''}
            </span>
          ))}
        </div>
      ) : (
        <span className="adm-prod-card-vazio">aguardando próxima etapa</span>
      )}
      {carro.data_prometida && (
        <span className={'adm-prod-card-prazo gd-tabular' + (atrasada ? ' atraso' : '')}>
          prazo: {carro.data_prometida.slice(0, 10)}
        </span>
      )}
    </div>
  );
}

/**
 * Estilos ESPECÍFICOS da tela de produção ao vivo (namespaced `adm-prod-*`) no
 * idioma ESCURO do totem: selo AO VIVO (no subtítulo do shell), KPIs com
 * benchmark, faixa "Equipe agora" e o KANBAN premium — cards --bg-card
 * flutuando sobre colunas-fantasma (trilhas escuras recuadas + borda tracejada),
 * borda-esquerda 4px no acento de estado que BRILHA. O chrome e a linguagem de
 * cartão/pílula/botão vêm do AdminShell. Tokens da camada do totem
 * (--bg-*, --text-*, --*-primary/-glow, --gd-*); números com `gd-tabular`.
 */
function Estilos() {
  return (
    <style jsx global>{`
      /* ─── Selo AO VIVO no subtítulo do shell (.adm-topbar__sub é flex/uppercase) ─── */
      /* Dot do selo AO VIVO = dot VIVO (exceção que mantém glow). Acento em gamut. */
      .adm-prod-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--adm-accent);
        box-shadow: 0 0 0 3px rgba(16, 137, 168, 0.22), 0 0 10px rgba(16, 137, 168, 0.7);
        flex-shrink: 0;
      }
      .adm-prod-selo-sep {
        width: 1px;
        height: 11px;
        background: rgba(148, 163, 184, 0.4);
      }
      .adm-prod-selo-time {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-secondary);
        letter-spacing: 0.02em;
        text-transform: none;
      }

      /* ─── Mensagens utilitárias ─── */
      .adm-prod-info {
        padding: 24px;
        color: var(--text-secondary);
        font-size: 14px;
      }
      .adm-prod-flash {
        margin-bottom: 16px;
      }

      /* ─── Skeleton "prensado" do pátio (loading) — caixas --bg-card + shimmer ─── */
      .adm-prod-skel {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      /* Caixa-base: superfície prensada escura + faixa de luz que VARRE (keyframe
         shimmer do globals.css). O gradiente é o que se move (background-position). */
      .adm-prod-skel-box {
        background:
          linear-gradient(
            100deg,
            rgba(255, 255, 255, 0.02) 0%,
            rgba(255, 255, 255, 0.02) 36%,
            rgba(28, 132, 173, 0.1) 50%,
            rgba(255, 255, 255, 0.02) 64%,
            rgba(255, 255, 255, 0.02) 100%
          ),
          var(--bg-card);
        background-size:
          200% 100%,
          auto;
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset;
        animation: shimmer 1.4s linear infinite;
      }
      .adm-prod-skel-resumo {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 14px;
      }
      .adm-prod-skel-kpi {
        height: 92px;
      }
      .adm-prod-skel-faixa {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 8px;
        margin-top: 24px;
      }
      .adm-prod-skel-op {
        height: 64px;
        border-radius: 10px;
      }
      .adm-prod-skel-kanban {
        display: flex;
        gap: 12px;
        overflow: hidden;
        margin-top: 24px;
      }
      .adm-prod-skel-col {
        flex: 0 0 248px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .adm-prod-skel-colhead {
        height: 22px;
        width: 60%;
        border-radius: 999px;
      }
      .adm-prod-skel-trilha {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        border-radius: var(--radius-lg);
        border: 1px dashed var(--border-default);
        background: rgba(3, 7, 15, 0.4);
      }
      .adm-prod-skel-card {
        height: 78px;
        border-radius: 10px;
      }
      @media (prefers-reduced-motion: reduce) {
        .adm-prod-skel-box {
          animation: none;
        }
      }

      /* ─── KPIs de resumo (benchmark) — instrumento prensado escuro ─── */
      .adm-prod-resumo {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 14px;
        margin-bottom: 8px;
      }
      .adm-prod-kpi {
        position: relative;
        background: var(--bg-card);
        border: 1px solid var(--border-default);
        border-top: 3px solid var(--text-muted);
        border-radius: var(--radius-lg);
        padding: 18px 18px 16px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        box-shadow:
          0 1px 0 rgba(255, 255, 255, 0.04) inset,
          0 12px 30px -12px rgba(0, 0, 0, 0.6);
      }
      .adm-prod-kpi-num {
        font-size: clamp(28px, 3.2vw, 40px);
        font-weight: 800;
        line-height: 1;
        letter-spacing: -0.02em;
        display: inline-flex;
        align-items: baseline;
        color: var(--text-primary);
      }
      .adm-prod-kpi-de {
        font-size: 0.5em;
        font-weight: 700;
        color: var(--text-muted);
        margin-left: 2px;
      }
      .adm-prod-kpi-lbl {
        font-size: 11px;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-weight: 700;
      }
      .adm-prod-kpi-nota {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 1px;
      }
      /* Tom = um acento que brilha no topo + no número (uma cor = um significado) */
      .adm-prod-kpi.tone-ok {
        border-top-color: var(--green-primary);
        box-shadow:
          0 1px 0 rgba(255, 255, 255, 0.04) inset,
          0 -1px 0 var(--green-glow),
          0 12px 30px -12px rgba(0, 0, 0, 0.6);
      }
      .adm-prod-kpi.tone-ok .adm-prod-kpi-num {
        color: var(--green-primary);
        text-shadow: 0 0 16px var(--green-glow);
      }
      .adm-prod-kpi.tone-warn {
        border-top-color: var(--amber-primary);
      }
      .adm-prod-kpi.tone-warn .adm-prod-kpi-num {
        color: var(--amber-primary);
        text-shadow: 0 0 16px var(--amber-glow);
      }
      .adm-prod-kpi.tone-info {
        border-top-color: var(--adm-info);
      }
      .adm-prod-kpi.tone-info .adm-prod-kpi-num {
        color: var(--adm-info);
        text-shadow: 0 0 16px var(--adm-info-glow);
      }
      .adm-prod-kpi.tone-bad {
        border-top-color: var(--red-primary);
      }
      .adm-prod-kpi.tone-bad .adm-prod-kpi-num {
        color: var(--red-primary);
        text-shadow: 0 0 16px var(--red-glow);
      }
      .adm-prod-kpi.tone-navy {
        border-top-color: var(--adm-accent);
      }
      /* KPI-herói (mostrador): mantém o glow no número grande (glow reservado a
         heróis + dot "produzindo"). Cor no acento teal EM GAMUT da casa. */
      .adm-prod-kpi.tone-navy .adm-prod-kpi-num {
        color: var(--adm-accent);
        text-shadow: 0 0 16px rgba(16, 137, 168, 0.5);
      }

      /* ─── Títulos de seção ─── */
      .adm-prod-sec-titulo {
        font-size: 12.5px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        font-weight: 700;
        margin: 32px 0 12px;
      }

      /* ─── Faixa "Equipe agora" — instrumento primário ─── */
      .adm-prod-faixa-head {
        display: flex;
        align-items: baseline;
        gap: 12px;
        margin: 32px 0 12px;
      }
      .adm-prod-faixa-head .adm-prod-sec-titulo {
        margin: 0;
      }
      .adm-prod-faixa-vazia {
        margin: 0 0 4px;
        padding: 24px;
        color: var(--text-secondary);
        font-size: 14px;
        border: 1px dashed var(--border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-card);
      }
      .adm-prod-faixa-hint {
        font-size: 11px;
        color: var(--text-muted);
        font-style: italic;
      }
      .adm-prod-op-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 8px;
      }
      .adm-prod-op-cell {
        position: relative;
      }
      .adm-prod-op-divisor {
        position: absolute;
        left: -4.5px;
        top: 6px;
        bottom: 6px;
        width: 1px;
        background: var(--border-default);
      }
      .adm-prod-op-card {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        background: var(--bg-card);
        border: 1px solid var(--border-default);
        border-radius: 10px;
        padding: 12px;
        box-shadow:
          0 1px 0 rgba(255, 255, 255, 0.04) inset,
          0 10px 24px -14px rgba(0, 0, 0, 0.6);
      }
      .adm-prod-op-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-top: 4px;
        flex-shrink: 0;
        background: var(--text-muted);
      }
      .adm-prod-op-card.estado-produzindo .adm-prod-op-dot {
        background: var(--green-primary);
        box-shadow: 0 0 0 3px var(--green-glow), 0 0 10px var(--green-glow);
      }
      /* Em pausa = dot estático SEM glow (glow reservado ao "produzindo"/heróis). */
      .adm-prod-op-card.estado-em_pausa .adm-prod-op-dot {
        background: var(--amber-primary);
      }
      /* "Sem tarefa" = INFORMATIVO (não alarme): info-ciano cheio, NUNCA cinza
         nem âmbar. Dot estático SEM glow (só "produzindo" brilha). */
      .adm-prod-op-card.estado-sem_tarefa .adm-prod-op-dot {
        background: var(--adm-info);
      }
      .adm-prod-op-info {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-width: 0;
      }
      .adm-prod-op-info strong {
        font-size: 14px;
        font-weight: 700;
        color: var(--text-primary);
      }
      .adm-prod-op-estado {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .adm-prod-op-card.estado-produzindo .adm-prod-op-estado {
        color: var(--green-primary);
      }
      .adm-prod-op-card.estado-em_pausa .adm-prod-op-estado {
        color: var(--amber-primary);
      }
      /* "Sem tarefa ativa": rótulo de estado pequeno (11px/700) no info-ciano da
         casa. O override local (#8fcce8) virou o próprio token --adm-info
         (unificado, APCA Lc≈68 sobre o card) — aqui só referenciamos o token. */
      .adm-prod-op-card.estado-sem_tarefa .adm-prod-op-estado {
        color: var(--adm-info);
      }
      .adm-prod-op-carro {
        font-size: 11px;
        color: var(--text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* ─── Kanban premium — cards FLUTUANDO sobre colunas-fantasma ─── */
      .adm-prod-kanban-sec {
        padding-bottom: 16px;
      }
      .adm-prod-kanban {
        display: flex;
        gap: 12px;
        overflow-x: auto;
        padding-bottom: 8px;
      }
      .adm-prod-coluna {
        flex: 0 0 248px;
        display: flex;
        flex-direction: column;
        background: transparent;
      }
      .adm-prod-col-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 8px 8px 2px;
      }
      .adm-prod-col-nome {
        font-weight: 700;
        font-size: 12.5px;
        color: var(--text-primary);
        letter-spacing: 0.01em;
      }
      /* Contador em cápsula teal — estático, SEM glow (glow reservado aos
         mostradores-herói e ao dot vivo "produzindo"). */
      .adm-prod-col-count {
        background: rgba(16, 137, 168, 0.16);
        color: var(--adm-accent);
        border: 1px solid rgba(16, 137, 168, 0.4);
        border-radius: 999px;
        min-width: 22px;
        text-align: center;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 800;
      }
      /* Coluna-fantasma = trilha escura RECUADA com borda tracejada */
      .adm-prod-col-trilha {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        border-radius: var(--radius-lg);
        border: 1px dashed var(--border-default);
        background: rgba(3, 7, 15, 0.4);
        box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.35);
        min-height: 72px;
        flex: 1;
      }
      .adm-prod-col-vazia {
        font-size: 11px;
        color: var(--text-muted);
        font-style: italic;
        padding: 12px 8px;
        text-align: center;
      }

      /* ─── Card de OS — --bg-card FLUTUANTE com realce + borda-esquerda que brilha ─── */
      .adm-prod-card {
        background: var(--bg-card);
        border: 1px solid var(--border-default);
        border-left: 4px solid var(--text-muted);
        border-radius: 10px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        box-shadow:
          0 1px 0 rgba(255, 255, 255, 0.05) inset,
          0 14px 30px -14px rgba(0, 0, 0, 0.7);
        transition:
          transform 180ms var(--gd-ease),
          box-shadow 180ms var(--gd-ease),
          border-color 180ms var(--gd-ease);
      }
      .adm-prod-card:hover {
        transform: translateY(-2px);
        background: var(--bg-card-hover);
        box-shadow:
          0 1px 0 rgba(255, 255, 255, 0.07) inset,
          0 20px 44px -16px rgba(0, 0, 0, 0.8);
      }
      /* Borda-esquerda 4px na cor de estado (a COR encoda o estado). O glow de
         filete foi removido — quando todo card brilha, nada salta; o glow fica
         reservado aos mostradores-herói e ao dot vivo "produzindo". */
      .adm-prod-card.sit-trabalhando {
        border-left-color: var(--green-primary);
      }
      .adm-prod-card.sit-aguardando {
        border-left-color: var(--amber-primary);
      }
      /* Bloqueio-PROBLEMA (peça/aprovação) = VERMELHO (risco). É o default de
         qualquer carro bloqueado sem variante de fluxo. */
      .adm-prod-card.sit-bloqueado {
        border-left-color: var(--red-primary);
      }
      /* Bloqueio-FLUXO (outro setor/cura) = ÂMBAR (espera prevista, não alarme).
         Mesmo dado, só a cor/ícone muda. */
      .adm-prod-card.sit-bloqueado.bloq-fluxo {
        border-left-color: var(--amber-primary);
      }
      .adm-prod-card-top {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      /* Placa = "instrumento": mono que brilha sobre caixa escura */
      .adm-prod-card-placa {
        font-family: var(--font-jetbrains-mono), ui-monospace, 'SFMono-Regular', monospace;
        font-weight: 700;
        letter-spacing: 0.08em;
        flex: 1;
        font-size: 13.5px;
        color: var(--text-primary);
      }
      .adm-prod-tag {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 999px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.02em;
        white-space: nowrap;
        border: 1px solid transparent;
      }
      /* Tag de bloqueio — PROBLEMA (vermelho claro p/ ler de longe, SEM glow:
         tag estática) × FLUXO (âmbar calmo). Texto/ícone no vermelho mais claro;
         o fill translúcido segue na família --red. */
      .adm-prod-tag.bloq-problema {
        background: rgba(239, 68, 68, 0.16);
        color: var(--adm-bad-bright);
        border-color: rgba(239, 68, 68, 0.35);
      }
      .adm-prod-tag.bloq-fluxo {
        background: rgba(245, 158, 11, 0.16);
        color: var(--amber-primary);
        border-color: rgba(245, 158, 11, 0.35);
      }
      .adm-prod-tag svg {
        flex-shrink: 0;
      }
      .adm-prod-tag.atraso {
        background: rgba(245, 158, 11, 0.16);
        color: var(--amber-primary);
        border-color: rgba(245, 158, 11, 0.35);
      }
      .adm-prod-card-modelo {
        font-size: 12.5px;
        color: var(--text-secondary);
      }
      .adm-prod-card-motivo {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 600;
        color: var(--text-secondary);
      }
      .adm-prod-card-motivo svg {
        flex-shrink: 0;
      }
      /* Motivo segue a categoria do bloqueio (mesma escada de cor da tag/borda).
         Texto pequeno → vermelho mais claro (legível de longe). */
      .adm-prod-card-motivo.bloq-problema {
        color: var(--adm-bad-bright);
      }
      .adm-prod-card-motivo.bloq-fluxo {
        color: var(--amber-primary);
      }
      .adm-prod-card-ativos {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 2px;
      }
      .adm-prod-mini {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        padding: 2px 8px 2px 6px;
        border-radius: 999px;
        font-weight: 600;
        border: 1px solid transparent;
      }
      .adm-prod-mini-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
        background: currentColor;
        box-shadow: 0 0 6px currentColor;
      }
      .adm-prod-mini.mini-trab {
        background: rgba(34, 197, 94, 0.16);
        color: var(--green-primary);
        border-color: rgba(34, 197, 94, 0.3);
      }
      .adm-prod-mini.mini-pausa {
        background: rgba(245, 158, 11, 0.16);
        color: var(--amber-primary);
        border-color: rgba(245, 158, 11, 0.3);
      }
      .adm-prod-mini.mini-pausa .adm-prod-mini-dot {
        box-shadow: none;
      }
      .adm-prod-card-vazio {
        font-size: 11px;
        color: var(--text-muted);
        font-style: italic;
      }
      .adm-prod-card-prazo {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 1px;
      }
      .adm-prod-card-prazo.atraso {
        color: var(--amber-primary);
        font-weight: 700;
      }

      /* ─── Sem etapa iniciada ─── */
      .adm-prod-sem-etapa {
        padding-top: 4px;
      }
      .adm-prod-sem-etapa .adm-prod-sec-titulo {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin: 12px 0;
      }
      .adm-prod-sem-etapa-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 8px;
      }
    `}</style>
  );
}
