/**
 * Testes UNITÁRIOS das funções PURAS de admin-queries.ts.
 *
 * Cobre: somarDias (sugestão de data prometida) e osEstaAtiva (regra da placa
 * única-PARCIAL: só "Entregue" sai do quadro ativo). Ambas são lógica pura.
 *
 * somarDias depende do fuso ao formatar (toISOString). O setup fixa TZ=UTC,
 * então a virada de dia/mês é determinística. As asserções de "base ausente ->
 * hoje" usam fake timers para não depender do relógio real (sem flaky).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { somarDias, osEstaAtiva } from '@/lib/supabase/admin-queries';

describe('somarDias', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('soma dias dentro do mesmo mês', () => {
    expect(somarDias('2026-06-02', 13)).toBe('2026-06-15');
  });

  it('soma o prazo de seguradora (30 dias) virando o mês', () => {
    expect(somarDias('2026-06-02', 30)).toBe('2026-07-02');
  });

  it('soma o prazo de particular (15 dias)', () => {
    expect(somarDias('2026-06-02', 15)).toBe('2026-06-17');
  });

  it('atravessa a virada de ano', () => {
    expect(somarDias('2026-12-20', 20)).toBe('2027-01-09');
  });

  it('respeita ano bissexto (2024 tem 29 de fevereiro)', () => {
    expect(somarDias('2024-02-28', 1)).toBe('2024-02-29');
    expect(somarDias('2024-02-28', 2)).toBe('2024-03-01');
  });

  it('ano não bissexto pula 29/02', () => {
    expect(somarDias('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('somar zero dias devolve a própria data', () => {
    expect(somarDias('2026-06-02', 0)).toBe('2026-06-02');
  });

  it('aceita dias negativos (volta no calendário)', () => {
    expect(somarDias('2026-06-02', -2)).toBe('2026-05-31');
  });

  it('base ausente (null) usa hoje como referência', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T10:00:00Z'));
    expect(somarDias(null, 0)).toBe('2026-06-02');
    expect(somarDias(null, 5)).toBe('2026-06-07');
  });

  it('base ausente (undefined) usa hoje como referência', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-02T10:00:00Z'));
    expect(somarDias(undefined, 1)).toBe('2026-06-03');
  });
});

describe('osEstaAtiva', () => {
  it('OS Entregue NÃO está ativa (sai do quadro)', () => {
    expect(osEstaAtiva('Entregue')).toBe(false);
  });

  it('os demais status contam como ativos', () => {
    expect(osEstaAtiva('Aguardando Produção')).toBe(true);
    expect(osEstaAtiva('Em Produção')).toBe(true);
    expect(osEstaAtiva('Pronto para Entrega')).toBe(true);
  });

  it('null/undefined são tratados como ativos (ainda não entregue)', () => {
    expect(osEstaAtiva(null)).toBe(true);
    expect(osEstaAtiva(undefined)).toBe(true);
  });

  it('é case-sensitive: "entregue" minúsculo NÃO casa com "Entregue"', () => {
    // O status canônico é "Entregue"; qualquer outra grafia conta como ativo.
    expect(osEstaAtiva('entregue')).toBe(true);
  });
});
