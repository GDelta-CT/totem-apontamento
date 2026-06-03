/**
 * Testes UNITÁRIOS das partes PURAS de dono-queries.ts.
 *
 * Cobre: brl() (formatação de moeda) e a constante de domínio DIAS_ALERTA_PRAZO.
 *
 * NOTA: brl() usa Intl/toLocaleString('pt-BR'), que depende do ICU do Node. O
 * caractere de espaço entre "R$" e o número varia entre versões do CLDR (NBSP
 * x NNBSP), então NÃO comparamos a string exata — afirmamos o comportamento
 * observável (prefixo R$, dígitos, vírgula decimal, milhar). Assim o teste não
 * fica frágil a versão do runtime.
 *
 * diffDias() e a classificação de SaudePrazo NÃO são exportadas (vivem dentro
 * de carregarPainelDono, que chama o Supabase) — ver "pulados" no relatório.
 */
import { describe, it, expect } from 'vitest';
import { brl, DIAS_ALERTA_PRAZO } from '@/lib/supabase/dono-queries';

/** Normaliza qualquer espaço unicode (NBSP/NNBSP) para espaço comum. */
function semEspacosExoticos(s: string): string {
  return s.replace(/\s/g, ' ');
}

describe('brl', () => {
  it('formata zero com símbolo e duas casas decimais', () => {
    const out = semEspacosExoticos(brl(0));
    expect(out).toContain('R$');
    expect(out).toContain('0,00');
  });

  it('formata centavos com vírgula decimal (pt-BR)', () => {
    const out = semEspacosExoticos(brl(1234.5));
    expect(out).toContain('R$');
    expect(out).toContain('1.234,50'); // milhar com ponto, decimal com vírgula
  });

  it('usa ponto como separador de milhar', () => {
    const out = semEspacosExoticos(brl(1000000));
    expect(out).toContain('1.000.000,00');
  });

  it('arredonda para duas casas', () => {
    const out = semEspacosExoticos(brl(9.999));
    expect(out).toContain('10,00');
  });

  it('valores negativos preservam o sinal', () => {
    const out = semEspacosExoticos(brl(-50));
    expect(out).toContain('50,00');
    expect(out).toMatch(/-/);
  });
});

describe('DIAS_ALERTA_PRAZO (contrato de domínio)', () => {
  it('a janela de "perto de estourar" é de 3 dias', () => {
    expect(DIAS_ALERTA_PRAZO).toBe(3);
  });
});
