'use client';

/**
 * Porteiro do /admin (passo 3).
 * - Sem sessão        -> tela de login (e-mail + senha).
 * - Logado, papel ok  -> renderiza o painel.
 * - Logado, sem papel -> "sem acesso" (só gerente/dono entram).
 *
 * Segurança real é o RLS no banco; este porteiro é a camada de UX.
 */

import { useEffect, useState } from 'react';
import type { ReactNode, FormEvent } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { papelDoUsuarioAtual } from '@/lib/supabase/admin-queries';

type Estado = 'carregando' | 'deslogado' | 'sem-permissao' | 'liberado';

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('carregando');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const checarPapel = async () => {
    const r = await papelDoUsuarioAtual();
    if (r.status === 'success' && (r.data.papel === 'gerente' || r.data.papel === 'dono')) {
      setEstado('liberado');
    } else {
      setEstado('sem-permissao');
    }
  };

  useEffect(() => {
    const sb = getSupabase();
    let ativo = true;
    sb.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      if (data.session) checarPapel();
      else setEstado('deslogado');
    });
    const { data: sub } = sb.auth.onAuthStateChange((_evento, session) => {
      if (session) {
        setEstado('carregando');
        checarPapel();
      } else {
        setEstado('deslogado');
      }
    });
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    setEnviando(false);
    if (error) setErro('Não foi possível entrar. Confira o e-mail e a senha.');
    // Em caso de sucesso, onAuthStateChange dispara checarPapel().
  };

  const sair = async () => {
    await getSupabase().auth.signOut();
  };

  if (estado === 'carregando') {
    return (
      <div className="gd-auth gd-auth--dark">
        <div className="gd-auth__card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gd-auth__logo" src="/gdelta-logo.png" alt="GDelta" />
          <p className="gd-auth__sub" style={{ margin: 0 }}>
            Verificando acesso…
          </p>
        </div>
      </div>
    );
  }

  if (estado === 'liberado') return <>{children}</>;

  if (estado === 'sem-permissao') {
    return (
      <div className="gd-auth gd-auth--dark">
        <div className="gd-auth__card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gd-auth__logo" src="/gdelta-logo.png" alt="GDelta" />
          <h1 className="gd-auth__title">Sem acesso</h1>
          <p className="gd-auth__sub">
            Esta conta não tem papel de <strong>gerente</strong> ou <strong>dono</strong> nesta
            oficina. Fale com o responsável.
          </p>
          <button className="gd-auth__btn gd-auth__btn--ghost" onClick={sair}>
            Sair
          </button>
          <p className="gd-auth__foot">
            <strong aria-label="GDelta">
              G<span className="gd-auth__bar">|</span>DELTA
            </strong>{' '}
            · Painel
          </p>
        </div>
      </div>
    );
  }

  // deslogado
  return (
    <div className="gd-auth gd-auth--dark">
      <div className="gd-auth__card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="gd-auth__logo" src="/gdelta-logo.png" alt="GDelta" />
        <h1 className="gd-auth__title">Painel do gestor</h1>
        <p className="gd-auth__sub">Entre com sua conta de gestor.</p>
        <form onSubmit={entrar} className="gd-auth__form">
          <input
            className="gd-auth__input"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="gd-auth__input"
            type="password"
            autoComplete="current-password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />
          {erro && <p className="gd-auth__error">{erro}</p>}
          <button type="submit" disabled={enviando} className="gd-auth__btn">
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p className="gd-auth__foot">
          <strong>GDelta</strong> · Painel
        </p>
      </div>
    </div>
  );
}
