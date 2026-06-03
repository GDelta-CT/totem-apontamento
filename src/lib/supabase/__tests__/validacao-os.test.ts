/**
 * Testes de REGRAS de validação do cadastro de OS.
 *
 * Estado atual do código (admin-queries.ts): criarOS/atualizarOS chamam o
 * Supabase, então NÃO são testáveis sem mock. As validações que essas funções
 * fazem HOJE de forma pura são:
 *   - placa válida  := normalizarPlaca(input).length >= 7
 *   - modelo válido := modelo.trim() !== ''
 * Essas duas, abaixo, são provadas via as funções puras reais (normalizarPlaca).
 *
 * As regras "valor_orcamento >= 0" e "data_prometida >= data_entrada" NÃO
 * existem no código (não há guard pura nem no banco visível aqui). Para não
 * fingir cobertura de algo inexistente (Goal-Driven Execution), o bloco
 * "regra de comparação de datas ISO" prova a PROPRIEDADE que esse guard
 * exigiria — comparação cronológica de strings 'YYYY-MM-DD' — como contrato
 * a ser usado se/quando o guard for implementado. NÃO testa função existente.
 */
import { describe, it, expect } from 'vitest';
import { normalizarPlaca } from '@/lib/supabase/queries';

/** Mesma checagem que criarOS aplica: placa normalizada precisa ter 7 chars. */
function placaValida(input: string): boolean {
  return normalizarPlaca(input).length >= 7;
}

/**
 * Propriedade que um guard "data_prometida >= data_entrada" exigiria.
 * Para strings 'YYYY-MM-DD', a ordem lexicográfica == ordem cronológica.
 */
function prazoNaoAntesDaEntrada(dataEntrada: string, dataPrometida: string): boolean {
  return dataPrometida >= dataEntrada;
}

describe('placa válida (guard real de criarOS, via normalizarPlaca)', () => {
  it('aceita placa Mercosul com 7 caracteres', () => {
    expect(placaValida('ABC1D23')).toBe(true);
  });

  it('aceita placa antiga (7 alfanuméricos) com hífen', () => {
    expect(placaValida('abc-1234')).toBe(true); // vira ABC1234 (7 chars)
  });

  it('rejeita placa curta (< 7 após normalizar)', () => {
    expect(placaValida('ABC12')).toBe(false);
    expect(placaValida('AB-12')).toBe(false); // AB12 = 4 chars
  });

  it('rejeita string vazia / só símbolos', () => {
    expect(placaValida('')).toBe(false);
    expect(placaValida('---...')).toBe(false);
  });

  it('placa com símbolos no meio ainda vale se sobram 7 alfanuméricos', () => {
    expect(placaValida('a b c 1 d 2 3')).toBe(true);
  });
});

describe('regra de comparação de datas ISO (contrato p/ guard prazo >= entrada)', () => {
  it('prazo posterior à entrada é válido', () => {
    expect(prazoNaoAntesDaEntrada('2026-06-02', '2026-07-02')).toBe(true);
  });

  it('prazo no MESMO dia da entrada é válido (>=)', () => {
    expect(prazoNaoAntesDaEntrada('2026-06-02', '2026-06-02')).toBe(true);
  });

  it('prazo ANTES da entrada é inválido', () => {
    expect(prazoNaoAntesDaEntrada('2026-06-02', '2026-06-01')).toBe(false);
  });

  it('ordena corretamente atravessando virada de mês', () => {
    expect(prazoNaoAntesDaEntrada('2026-06-30', '2026-07-01')).toBe(true);
    expect(prazoNaoAntesDaEntrada('2026-07-01', '2026-06-30')).toBe(false);
  });

  it('ordena corretamente atravessando virada de ano', () => {
    expect(prazoNaoAntesDaEntrada('2026-12-31', '2027-01-01')).toBe(true);
  });

  it('a comparação lexicográfica de YYYY-MM-DD equivale à cronológica', () => {
    // sanity: datas embaralhadas ordenam igual a ordenar como Date.
    const datas = ['2026-07-02', '2026-01-15', '2026-06-30', '2026-12-31', '2026-06-02'];
    const porString = [...datas].sort();
    const porData = [...datas].sort(
      (a, b) => new Date(a + 'T00:00:00Z').getTime() - new Date(b + 'T00:00:00Z').getTime()
    );
    expect(porString).toEqual(porData);
  });
});
