/**
 * Testes UNITÁRIOS dos lookups PUROS de client.ts.
 *
 * Cobre: buscarEtapa e buscarMotivoPausa — buscas por id em arrays constantes
 * (ETAPAS / MOTIVOS_PAUSA). Lógica pura, sem Supabase.
 */
import { describe, it, expect } from 'vitest';
import { buscarEtapa, buscarMotivoPausa, ETAPAS, MOTIVOS_PAUSA } from '@/lib/supabase/client';

describe('buscarEtapa', () => {
  it('encontra uma etapa válida pelo id e devolve o objeto certo', () => {
    const e = buscarEtapa('Pintura');
    expect(e).not.toBeNull();
    expect(e?.id).toBe('Pintura');
    expect(e?.ordem).toBe(4);
  });

  it('encontra a primeira e a última etapa do fluxo', () => {
    expect(buscarEtapa('Desmontagem')?.ordem).toBe(1);
    expect(buscarEtapa('Entrega')?.ordem).toBe(8);
  });

  it('id inexistente retorna null', () => {
    expect(buscarEtapa('Inexistente')).toBeNull();
  });

  it('null/undefined/vazio retornam null (sem estourar)', () => {
    expect(buscarEtapa(null)).toBeNull();
    expect(buscarEtapa(undefined)).toBeNull();
    expect(buscarEtapa('')).toBeNull();
  });

  it('é case-sensitive: "pintura" minúsculo não casa', () => {
    expect(buscarEtapa('pintura')).toBeNull();
  });

  it('toda etapa do catálogo é encontrável pelo próprio id', () => {
    for (const et of ETAPAS) {
      expect(buscarEtapa(et.id)?.id).toBe(et.id);
    }
  });
});

describe('buscarMotivoPausa', () => {
  it('encontra um motivo válido pelo id', () => {
    const m = buscarMotivoPausa('almoco');
    expect(m).not.toBeNull();
    expect(m?.id).toBe('almoco');
    expect(m?.categoria).toBe('pessoal');
  });

  it('motivo técnico carrega a categoria correta', () => {
    expect(buscarMotivoPausa('secagem')?.categoria).toBe('tecnica');
  });

  it('id inexistente retorna null', () => {
    expect(buscarMotivoPausa('cafezinho')).toBeNull();
  });

  it('null/undefined/vazio retornam null', () => {
    expect(buscarMotivoPausa(null)).toBeNull();
    expect(buscarMotivoPausa(undefined)).toBeNull();
    expect(buscarMotivoPausa('')).toBeNull();
  });

  it('todo motivo do catálogo é encontrável pelo próprio id', () => {
    for (const mp of MOTIVOS_PAUSA) {
      expect(buscarMotivoPausa(mp.id)?.id).toBe(mp.id);
    }
  });
});
