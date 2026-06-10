/**
 * Extração dos campos da OS a partir de um PDF de orçamento (Cília, WM, etc.) via IA
 * multimodal. Roda SÓ no servidor. Provider trocável: hoje Anthropic (Claude), porque o
 * projeto já tem ANTHROPIC_API_KEY; migrar p/ Gemini/Vertex-SP (LGPD) = trocar esta função.
 *
 * ⚠️ Cada chamada custa centavos (uso pago de API). Quem dispara é o admin, ao subir o PDF.
 * O resultado NUNCA é salvo direto: pré-preenche o formulário e o admin confere (ver pesquisa
 * em docs/PESQUISA-INGESTAO-PDF-IA.md).
 */
import 'server-only';

export type TipoCliente = 'seguradora' | 'cooperativa' | 'particular';

export interface CamposOrcamento {
  placa: string | null;
  modelo_veiculo: string | null;
  tipo_cliente: TipoCliente | null;
  valor_orcamento: number | null;
  data_prometida: string | null; // AAAA-MM-DD
  ref_externa: string | null;
  cliente_nome: string | null;
  cliente_whatsapp: string | null;
}

const PROMPT = `Você recebe o PDF de um orçamento de oficina de funilaria e pintura (pode vir da
plataforma WM, Cília ou similar). Extraia e devolva SOMENTE um JSON (sem texto fora dele, sem
markdown) com exatamente estas chaves:
- "placa": placa do veículo em MAIÚSCULAS sem espaços (ex.: "IAA5J11"), ou null.
- "modelo_veiculo": marca + modelo + ano se houver (ex.: "GM Corsa Sedan Maxx 2006"), ou null.
- "tipo_cliente": um de "seguradora" | "cooperativa" | "particular". Associação/cooperativa de
  proteção veicular = "cooperativa"; seguradora tradicional = "seguradora"; pessoa física = "particular". null se não der pra inferir.
- "valor_orcamento": número (total do orçamento em reais, ex.: 8418.75), ou null. Use ponto decimal, sem "R$".
- "data_prometida": prazo de entrega em "AAAA-MM-DD", ou null se não informado.
- "ref_externa": número/identificador do orçamento na plataforma (ex.: "1140125"), ou null.
- "cliente_nome": nome do cliente/segurado dono do veículo (pessoa física ou empresa), ou null.
- "cliente_whatsapp": telefone/celular/WhatsApp do cliente, SÓ os dígitos com DDD (ex.: "11999887766"), ou null.
Se um campo não existir no documento, use null. Não invente.`;

function extrairJSON(texto: string): unknown {
  const limpo = texto.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const ini = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (ini === -1 || fim === -1) throw new Error('IA não retornou JSON');
  return JSON.parse(limpo.slice(ini, fim + 1));
}

function normalizar(raw: Record<string, unknown>): CamposOrcamento {
  const placa = typeof raw.placa === 'string' ? raw.placa.toUpperCase().replace(/[^A-Z0-9]/g, '') : null;
  const tipo = raw.tipo_cliente;
  const tipo_cliente: TipoCliente | null =
    tipo === 'seguradora' || tipo === 'cooperativa' || tipo === 'particular' ? tipo : null;
  const valorNum = typeof raw.valor_orcamento === 'number' ? raw.valor_orcamento : Number(raw.valor_orcamento);
  return {
    placa: placa || null,
    modelo_veiculo: typeof raw.modelo_veiculo === 'string' ? raw.modelo_veiculo : null,
    tipo_cliente,
    valor_orcamento: Number.isFinite(valorNum) && valorNum >= 0 ? valorNum : null,
    data_prometida: typeof raw.data_prometida === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.data_prometida)
      ? raw.data_prometida
      : null,
    ref_externa: raw.ref_externa == null ? null : String(raw.ref_externa),
    cliente_nome:
      typeof raw.cliente_nome === 'string' && raw.cliente_nome.trim() ? raw.cliente_nome.trim() : null,
    cliente_whatsapp:
      raw.cliente_whatsapp == null ? null : String(raw.cliente_whatsapp).replace(/\D/g, '') || null,
  };
}

/** Manda o PDF (base64) à IA e devolve os 6 campos já normalizados. */
export async function extrairCamposOrcamento(pdfBase64: string): Promise<CamposOrcamento> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY ausente');
  // Opus 4.8: mais preciso/robusto em PDFs variados (WM, Cília…). ~R$0,10/PDF.
  // Trocável por env ORCAMENTO_MODEL (ex.: 'claude-haiku-4-5' p/ mais barato).
  const model = process.env.ORCAMENTO_MODEL || 'claude-opus-4-8';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    throw new Error(`IA HTTP ${res.status}: ${corpo.slice(0, 200)}`);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const texto = data.content?.find((c) => c.type === 'text')?.text ?? '';
  const parsed = extrairJSON(texto);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Resposta da IA inválida');
  return normalizar(parsed as Record<string, unknown>);
}
