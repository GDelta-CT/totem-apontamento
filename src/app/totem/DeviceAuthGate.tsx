'use client';

/**
 * Gate de sessão do device (Fase 1).
 * O totem compartilhado roda como a OFICINA: o device autentica uma vez
 * (login manual no kiosk) e a sessão persiste. É essa sessão que carrega o
 * oficina_id no JWT — usado pelo RLS e pelos triggers que preenchem oficina_id.
 *
 * Sem sessão  -> tela "Login da Oficina".
 * Com sessão  -> renderiza o totem normalmente.
 */

import { useEffect, useState } from 'react';
import type { ReactNode, FormEvent } from 'react';
import { getSupabase } from '@/lib/supabase/client';

type Estado = 'carregando' | 'logado' | 'deslogado';

export function DeviceAuthGate({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('carregando');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    let ativo = true;
    sb.auth.getSession().then(({ data }) => {
      if (ativo) setEstado(data.session ? 'logado' : 'deslogado');
    });
    const { data: sub } = sb.auth.onAuthStateChange((_evento, session) => {
      setEstado(session ? 'logado' : 'deslogado');
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
    if (error) setErro('Não foi possível entrar. Confira o e-mail e a senha da oficina.');
    // Em caso de sucesso, onAuthStateChange muda o estado para 'logado'.
  };

  if (estado === 'carregando') {
    return (
      <div className="gd-auth gd-auth--dark gd-auth--kiosk">
        <div className="gd-auth__card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gd-auth__logo" src="/gdelta-logo.png" alt="GDelta" />
          <p className="gd-auth__sub" style={{ margin: 0 }}>
            Verificando sessão do totem…
          </p>
        </div>
      </div>
    );
  }

  if (estado === 'logado') return <>{children}</>;

  return (
    <div className="gd-auth gd-auth--dark gd-auth--kiosk">
      <div className="gd-auth__card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="gd-auth__logo" src="/gdelta-logo.png" alt="GDelta" />
        <h1 className="gd-auth__title">Login da oficina</h1>
        <p className="gd-auth__sub">Acesso do totem — faça uma vez neste aparelho.</p>
        <form onSubmit={entrar} className="gd-auth__form">
          <input
            className="gd-auth__input"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="E-mail da oficina"
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
          <strong>GDelta</strong> · Apontamento de oficina
        </p>
      </div>
    </div>
  );
}
