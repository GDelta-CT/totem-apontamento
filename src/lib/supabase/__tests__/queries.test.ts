/**
 * Testes UNITÁRIOS das funções PURAS de queries.ts.
 *
 * Cobre: normalizarPlaca, parseISOComUTC, formatarHora.
 * Tudo aqui é lógica pura (string/data) — nenhuma chamada ao Supabase/rede.
 * As assertivas de tempo comparam contra Date.UTC(...) para serem
 * independentes de fuso. (O setup fixa TZ=UTC para formatarHora.)
 */
import { describe, it, expect } from 'vitest';
import { normalizarPlaca, parseISOComUTC, formatarHora } from '@/lib/supabase/queries';

describe('normalizarPlaca', () => {
  it('passa para maiúsculas', () => {
    expect(normalizarPlaca('abc1d23')).toBe('ABC1D23');
  });

  it('remove tudo que não é letra/número (hífen, espaço, ponto)', () => {
    expect(normalizarPlaca('abc-1d23')).toBe('ABC1D23');
    expect(normalizarPlaca('ABC 1D23')).toBe('ABC1D23');
    expect(normalizarPlaca('a.b.c.1.d.2.3')).toBe('ABC1D23');
  });

  it('apara espaços nas pontas e no meio', () => {
    expect(normalizarPlaca('  abc1d23  ')).toBe('ABC1D23');
  });

  it('placa Mercosul (já normalizada) permanece igual', () => {
    expect(normalizarPlaca('ABC1D23')).toBe('ABC1D23');
  });

  it('placa antiga com hífen vira só alfanumérico', () => {
    expect(normalizarPlaca('abc-1234')).toBe('ABC1234');
  });

  it('string vazia continua vazia (caminho de erro de "digite a placa")', () => {
    expect(normalizarPlaca('')).toBe('');
  });

  it('só símbolos colapsa para vazio', () => {
    expect(normalizarPlaca('---  ...')).toBe('');
  });

  it('acentos não são alfanuméricos ASCII e são removidos', () => {
    // /[^A-Z0-9]/ após toUpperCase: Ç/Ã saem.
    expect(normalizarPlaca('abçã12')).toBe('AB12');
  });
});

describe('parseISOComUTC', () => {
  it('trata timestamp do banco (sem Z, com espaço) como UTC', () => {
    // O Postgres grava "YYYY-MM-DD HH:MM:SS" sem fuso. Deve ser lido como UTC.
    const ms = parseISOComUTC('2026-06-02 13:30:00');
    expect(ms).toBe(Date.UTC(2026, 5, 2, 13, 30, 0));
  });

  it('trata timestamp sem Z (com T) como UTC', () => {
    const ms = parseISOComUTC('2026-06-02T13:30:00');
    expect(ms).toBe(Date.UTC(2026, 5, 2, 13, 30, 0));
  });

  it('respeita o Z explícito (não duplica fuso)', () => {
    const ms = parseISOComUTC('2026-06-02T13:30:00Z');
    expect(ms).toBe(Date.UTC(2026, 5, 2, 13, 30, 0));
  });

  it('respeita offset explícito +00:00', () => {
    const ms = parseISOComUTC('2026-06-02T13:30:00+00:00');
    expect(ms).toBe(Date.UTC(2026, 5, 2, 13, 30, 0));
  });

  it('respeita offset explícito -03:00 (converte para UTC)', () => {
    // 10:30 em -03:00 == 13:30 UTC.
    const ms = parseISOComUTC('2026-06-02T10:30:00-03:00');
    expect(ms).toBe(Date.UTC(2026, 5, 2, 13, 30, 0));
  });

  it('respeita offset explícito sem dois-pontos (+0000)', () => {
    // O regex aceita [+-]\d{2}:?\d{2}, então "+0000" não recebe o Z extra.
    const ms = parseISOComUTC('2026-06-02T13:30:00+0000');
    expect(ms).toBe(Date.UTC(2026, 5, 2, 13, 30, 0));
  });

  it('com fração de segundos sem Z também é UTC', () => {
    const ms = parseISOComUTC('2026-06-02T13:30:00.500');
    expect(ms).toBe(Date.UTC(2026, 5, 2, 13, 30, 0, 500));
  });

  it('é consistente: mesmo instante por dois caminhos (com/sem Z) bate', () => {
    expect(parseISOComUTC('2026-01-15 08:00:00')).toBe(
      parseISOComUTC('2026-01-15T08:00:00Z')
    );
  });
});

describe('formatarHora', () => {
  it('retorna placeholder quando a entrada é nula/indefinida/vazia', () => {
    expect(formatarHora(null)).toBe('--:--');
    expect(formatarHora(undefined)).toBe('--:--');
    expect(formatarHora('')).toBe('--:--');
  });

  it('formata HH:MM com zero à esquerda (TZ=UTC fixo no setup)', () => {
    // 08:05 UTC -> "08:05" (runner em UTC).
    expect(formatarHora('2026-06-02 08:05:00')).toBe('08:05');
  });

  it('formata meia-noite como 00:00', () => {
    expect(formatarHora('2026-06-02 00:00:00')).toBe('00:00');
  });

  it('formata fim de tarde 23:59', () => {
    expect(formatarHora('2026-06-02 23:59:00')).toBe('23:59');
  });

  it('lê timestamp UTC explícito de forma consistente com o sem-Z', () => {
    expect(formatarHora('2026-06-02T14:07:00Z')).toBe('14:07');
  });
});
