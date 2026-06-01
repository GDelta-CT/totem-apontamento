'use client';

/**
 * /admin — Painel do Gestor (hub de navegação).
 * Porta de entrada do gestor/dono: cabeçalho de marca + selo do usuário +
 * cartões para as áreas (OS · Equipe · Produção ao vivo). Segue o
 * docs/GUIA-DESIGN.md (tokens --gd-*, Inter, superfícies claras).
 *
 * A "prova do isolamento" (e-mail + oficina_id carimbado no JWT + papel) fica
 * numa linha de sessão discreta no rodapé — útil pra conferência, sem cara de
 * tela de diagnóstico.
 */

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { AdminAuthGate } from './AdminAuthGate';
import { cracheDaSessao, papelDoUsuarioAtual } from '@/lib/supabase/admin-queries';

export default function AdminPage() {
  return (
    <AdminAuthGate>
      <AdminHome />
    </AdminAuthGate>
  );
}

const CARDS = [
  { href: '/admin/os', icone: '📋', titulo: 'Ordens de Serviço', sub: 'Criar, listar e editar OS' },
  { href: '/admin/funcionarios', icone: '👥', titulo: 'Equipe', sub: 'Funcionários · ativar/desativar' },
  { href: '/admin/producao', icone: '🏭', titulo: 'Produção ao vivo', sub: 'Kanban + estados da equipe' },
];

function AdminHome() {
  const [email, setEmail] = useState<string | null>(null);
  const [oficinaJWT, setOficinaJWT] = useState<string | null>(null);
  const [papel, setPapel] = useState<string | null>(null);

  useEffect(() => {
    cracheDaSessao().then((c) => {
      if (c) {
        setEmail(c.email);
        setOficinaJWT(c.oficinaIdNoJWT);
      }
    });
    papelDoUsuarioAtual().then((r) => {
      if (r.status === 'success') setPapel(r.data.papel);
    });
  }, []);

  const sair = async () => {
    await getSupabase().auth.signOut();
  };

  const iniciais = (email ?? '?').split('@')[0].slice(0, 2).toUpperCase();

  return (
    <main className="wrap">
      <header className="topbar">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gdelta-symbol.png" alt="" className="brand-symbol" />
          <span className="brand-title">Painel do Gestor</span>
        </div>
        <div className="user">
          <span className="avatar" aria-hidden="true">
            {iniciais}
          </span>
          <div className="user-info">
            <strong>{email ?? '—'}</strong>
            {papel && <span className="user-papel">{papel}</span>}
          </div>
          <button className="btn-sair" onClick={sair}>
            Sair
          </button>
        </div>
      </header>

      <section className="conteudo">
        <h1 className="hello">O que você quer ver?</h1>

        <div className="cards">
          {CARDS.map((c) => (
            <a key={c.href} href={c.href} className="card">
              <span className="card-ic" aria-hidden="true">
                {c.icone}
              </span>
              <strong className="card-tit">{c.titulo}</strong>
              <span className="card-sub">{c.sub}</span>
              <span className="card-arrow" aria-hidden="true">
                →
              </span>
            </a>
          ))}
        </div>

        <div className="sessao" title="Prova do isolamento multi-tenant">
          <span className="sessao-lbl">Sessão</span>
          <span className="sessao-val">{email ?? '—'}</span>
          <span className="sessao-sep">·</span>
          <span className="sessao-papel">{papel ?? '—'}</span>
          <span className="sessao-sep">·</span>
          <span className="sessao-oid">
            oficina {oficinaJWT ? '…' + oficinaJWT.slice(-6) : '—'}
          </span>
        </div>
      </section>

      <Estilos />
    </main>
  );
}

function Estilos() {
  return (
    <style jsx global>{`
      .wrap {
        min-height: 100vh;
        background: #f7f8fa;
        color: var(--gd-ink, #0b2233);
        font-family: 'Inter', system-ui, sans-serif;
      }
      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 24px;
        background: #fff;
        border-bottom: 1px solid #e6ebf0;
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      .brand-symbol {
        width: 30px;
        height: 30px;
        object-fit: contain;
        user-select: none;
      }
      .brand-title {
        font-size: 16px;
        font-weight: 700;
        color: var(--gd-navy, #0b3857);
        letter-spacing: -0.01em;
        white-space: nowrap;
      }
      .user {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .avatar {
        flex-shrink: 0;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--gd-teal, #13678d);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .user-info {
        display: flex;
        flex-direction: column;
        line-height: 1.25;
        min-width: 0;
      }
      .user-info strong {
        font-size: 13px;
        color: var(--gd-ink, #0b2233);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
      }
      .user-papel {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--gd-teal, #13678d);
      }
      .btn-sair {
        margin-left: 6px;
        padding: 8px 14px;
        border-radius: 9px;
        border: 1.5px solid var(--gd-line, #d7dde2);
        background: transparent;
        color: var(--gd-muted, #5d7689);
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition:
          background 120ms ease,
          color 120ms ease;
      }
      .btn-sair:hover {
        background: var(--gd-paper-2, #eceae6);
        color: var(--gd-ink, #0b2233);
      }
      .conteudo {
        max-width: 980px;
        margin: 0 auto;
        padding: 28px 24px;
      }
      .hello {
        font-size: 15px;
        font-weight: 600;
        color: var(--gd-muted, #5d7689);
        margin: 0 0 16px;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 14px;
      }
      .card {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 22px 20px;
        background: #fff;
        border: 1px solid #e6ebf0;
        border-radius: 12px;
        text-decoration: none;
        color: var(--gd-ink, #0b2233);
        transition:
          border-color 120ms ease,
          box-shadow 120ms ease,
          transform 120ms ease;
      }
      .card:hover {
        border-color: var(--gd-teal-bright, #1c84ad);
        box-shadow: 0 6px 18px rgba(11, 56, 87, 0.08);
        transform: translateY(-1px);
      }
      .card-ic {
        font-size: 22px;
      }
      .card-tit {
        font-size: 16px;
        font-weight: 700;
        color: var(--gd-navy, #0b3857);
      }
      .card-sub {
        font-size: 13px;
        color: var(--gd-muted, #5d7689);
      }
      .card-arrow {
        position: absolute;
        top: 20px;
        right: 18px;
        font-size: 18px;
        color: var(--gd-line, #d7dde2);
        transition:
          color 120ms ease,
          transform 120ms ease;
      }
      .card:hover .card-arrow {
        color: var(--gd-teal-bright, #1c84ad);
        transform: translateX(2px);
      }
      .sessao {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 28px;
        padding-top: 16px;
        border-top: 1px solid #e6ebf0;
        font-size: 12px;
        color: var(--gd-muted, #5d7689);
      }
      .sessao-lbl {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: #9aa7b2;
      }
      .sessao-papel {
        font-weight: 700;
        color: var(--gd-teal, #13678d);
        text-transform: capitalize;
      }
      .sessao-sep {
        color: #c7d0d8;
      }
      .sessao-oid {
        font-variant-numeric: tabular-nums;
      }
      @media (max-width: 560px) {
        .user-info {
          display: none;
        }
      }
    `}</style>
  );
}
