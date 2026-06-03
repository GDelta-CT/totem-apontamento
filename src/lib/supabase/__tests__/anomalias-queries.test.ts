/**
 * Teste UNITÁRIO da parte PURA de anomalias-queries.ts.
 *
 * Cobre: a constante TETO_FANTASMA_MS (teto anti-fantasma de ~10,5h, CLAUDE.md)
 * e a aritmética de "horasDecorridas" que listarAnomalias aplica sobre ela.
 *
 * A função listarAnomalias() em si chama o Supabase (lê apontamentos +
 * correções), então NÃO é testável sem mock — ver "pulados" no relatório. Aqui
 * provamos a REGRA pura: dado um hora_inicio, o mesmo cálculo que a função faz
 * (agora - parseISOComUTC(inicio) > TETO) classifica como anomalia ou não, e o
 * horasDecorridas resultante. Reproduzimos a fórmula com parseISOComUTC real.
 */
import { describe, it, expect } from 'vitest';
import { TETO_FANTASMA_MS } from '@/lib/supabase/anomalias-queries';
import { parseISOComUTC } from '@/lib/supabase/queries';

const HORA_MS = 60 * 60 * 1000;

/** Reproduz a classificação que listarAnomalias aplica (sem o I/O). */
function ehAnomalia(horaInicioISO: string, agoraMs: number): boolean {
  return agoraMs - parseISOComUTC(horaInicioISO) > TETO_FANTASMA_MS;
}
function horasDecorridas(horaInicioISO: string, agoraMs: number): number {
  return (agoraMs - parseISOComUTC(horaInicioISO)) / HORA_MS;
}

describe('TETO_FANTASMA_MS (contrato de domínio)', () => {
  it('vale exatamente 10,5 horas em milissegundos', () => {
    expect(TETO_FANTASMA_MS).toBe(10.5 * HORA_MS);
    expect(TETO_FANTASMA_MS).toBe(37_800_000);
  });
});

describe('regra do teto anti-fantasma (aritmética pura)', () => {
  const inicio = '2026-06-02 08:00:00'; // UTC (banco grava sem Z)

  it('apontamento aberto há 9h NÃO é anomalia (abaixo do teto)', () => {
    const agora = parseISOComUTC(inicio) + 9 * HORA_MS;
    expect(ehAnomalia(inicio, agora)).toBe(false);
  });

  it('apontamento aberto há exatamente 10,5h NÃO é anomalia (limite, é > estrito)', () => {
    const agora = parseISOComUTC(inicio) + 10.5 * HORA_MS;
    expect(ehAnomalia(inicio, agora)).toBe(false);
  });

  it('apontamento aberto há 10,5h + 1ms JÁ é anomalia (passou do limite)', () => {
    const agora = parseISOComUTC(inicio) + 10.5 * HORA_MS + 1;
    expect(ehAnomalia(inicio, agora)).toBe(true);
  });

  it('apontamento aberto há 12h é anomalia', () => {
    const agora = parseISOComUTC(inicio) + 12 * HORA_MS;
    expect(ehAnomalia(inicio, agora)).toBe(true);
  });

  it('horasDecorridas calcula as horas desde o início (12h -> 12)', () => {
    const agora = parseISOComUTC(inicio) + 12 * HORA_MS;
    expect(horasDecorridas(inicio, agora)).toBeCloseTo(12, 6);
  });

  it('horasDecorridas com timestamp UTC explícito bate com o sem-Z', () => {
    const agora = parseISOComUTC('2026-06-02T08:00:00Z') + 11 * HORA_MS;
    expect(horasDecorridas('2026-06-02T08:00:00Z', agora)).toBeCloseTo(11, 6);
  });
});
