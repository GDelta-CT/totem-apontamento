// ============================================================
//  Importa as OSs reais da oficina-piloto (Relatório de Orçamentos GDelta,
//  gerado 09/06/2026) para a tabela `ordens_servico` do Supabase.
//
//  Mapeamento APROVADO pelo fundador (09/06/2026):
//    - Aprovado  -> status_geral 'Em Produção'  (pátio ativo)
//    - Concluído -> status_geral 'Entregue'      (histórico)
//    - Aguardando aprovação / Cancelado -> NÃO importados (pré-produção/fora do escopo)
//  tipo_cliente inferido do nome do cliente. ref_externa = Nº OS (idempotência).
//
//  Uso:
//    # 1) revisar o mapeamento, SEM gravar (não precisa de chave):
//    node scripts/importar-os-piloto.mjs --dry-run
//
//    # 2) gravar de verdade (no TESTE; nunca produção):
//    SUPABASE_SERVICE_ROLE_KEY=... IMPORT_OFICINA_ID=<uuid-da-piloto> \
//      NEXT_PUBLIC_SUPABASE_URL=https://pvrnimckfgdmgjrjueap.supabase.co \
//      node scripts/importar-os-piloto.mjs
//
//  Segurança: usa a SERVICE ROLE (ignora RLS) e grava oficina_id explícito
//  (o gatilho só carimba quando vem NULL — migration 009 — então o valor é
//  respeitado). É idempotente: pula OSs cujo ref_externa já existe na oficina.
// ============================================================

const DRY = process.argv.includes('--dry-run');

// Só Aprovadas (A) + Concluídas (C) do relatório. cliente = nome cru (a inferência
// de tipo_cliente roda abaixo, transparente). valor = total exibido (já líquido).
const OS = [
  // ---- Aprovadas (-> Em Produção, pátio ativo) ----
  { os: '1140125', cliente: 'AUTOCAR ASSOCIAÇÃO',        veiculo: 'GM Corsa Sedan Maxx 2006', placa: 'IAA5J11', valor: 8418.75, entrada: '02/06/2026', st: 'A' },
  { os: '1140108', cliente: 'Yelum Seguradora',          veiculo: 'Toyota Hilux 2021',        placa: 'QMM4H80', valor: 1730.00, entrada: '02/06/2026', st: 'A' },
  { os: '1138064', cliente: 'Atena Proteção Veicular',   veiculo: 'Corolla XEI 2020',         placa: 'RGO6A10', valor: 3352.50, entrada: '20/05/2026', st: 'A' },
  { os: '1137066', cliente: 'ALADIM',                    veiculo: 'Honda Civic 2020',         placa: 'QWL7E95', valor: 6180.00, entrada: '14/05/2026', st: 'A' },
  { os: '1135449', cliente: 'Atena Proteção Veicular',   veiculo: 'Ford KA 2017',             placa: 'QKZ7502', valor: 7570.00, entrada: '06/05/2026', st: 'A' },
  { os: '1134636', cliente: 'Bismarck',                  veiculo: 'Corsa Premium 2009',       placa: 'JSR4H37', valor: 17430.00, entrada: '07/05/2026', st: 'A' },
  { os: '1134615', cliente: 'JR Proteção Veicular',      veiculo: 'Corsa Classic 2009',       placa: 'JSV4A97', valor: 2950.00, entrada: '30/04/2026', st: 'A' },
  { os: '1132887', cliente: 'Atena Proteção Veicular',   veiculo: 'Spin 2019',                placa: 'QMH1I49', valor: 10091.64, entrada: '20/04/2026', st: 'A' },
  { os: '1132685', cliente: 'Atena Proteção Veicular',   veiculo: 'Honda Fit 2015',           placa: 'QDM1J81', valor: 11800.00, entrada: '17/04/2026', st: 'A' },

  // ---- Concluídas (-> Entregue, histórico) ----
  { os: '1139126', cliente: 'Wagner Trocador',           veiculo: 'Fiat Strada 2018',         placa: 'QMD5289', valor: 400.00,  entrada: '27/05/2026', st: 'C' },
  { os: '1137652', cliente: 'JR Proteção Veicular',      veiculo: 'Gol 2013',                 placa: 'FIZ219',  valor: 1500.00, entrada: '18/05/2026', st: 'C' },
  { os: '1136871', cliente: 'Cristian Santos Moto',      veiculo: 'Yares 2021',               placa: 'QMN5H48', valor: 630.00,  entrada: '19/05/2026', st: 'C' },
  { os: '1136812', cliente: 'Velho do Coco',             veiculo: 'S10 2017',                 placa: 'RPE2A31', valor: 2070.00, entrada: '13/05/2026', st: 'C' },
  { os: '1136239', cliente: 'Discar Dist. de Carros',    veiculo: 'Saveiro 2027',             placa: '0000III', valor: 400.00,  entrada: '11/05/2026', st: 'C' },
  { os: '1136238', cliente: 'Discar Dist. de Carros',    veiculo: 'Saveiro 2026',             placa: '0000III', valor: 500.00,  entrada: '11/05/2026', st: 'C' },
  { os: '1135761', cliente: 'Marcones',                  veiculo: 'Strada 2014',              placa: 'OHG9J52', valor: 550.00,  entrada: '07/05/2026', st: 'C' },
  { os: '1135758', cliente: 'JR Proteção Veicular',      veiculo: 'Polo 2019',                placa: 'QMD2C21', valor: 1200.00, entrada: '07/05/2026', st: 'C' },
  { os: '1135652', cliente: 'Junior',                    veiculo: 'Fiat Argo 2024',           placa: 'SIU8J89', valor: 300.00,  entrada: '06/05/2026', st: 'C' },
  { os: '1134685', cliente: 'Bruno Lima',                veiculo: 'Corsa 2009',               placa: 'JSV4A97', valor: 3150.00, entrada: '30/04/2026', st: 'C' },
  { os: '1134175', cliente: 'Junior',                    veiculo: 'Argo 2024',                placa: 'SIU8J89', valor: 2291.00, entrada: '28/04/2026', st: 'C' },
  { os: '1134026', cliente: 'Bernadete',                 veiculo: 'L200 2013',                placa: 'OEQ2D13', valor: 2520.00, entrada: '27/04/2026', st: 'C' },
  { os: '1133415', cliente: 'JR Proteção Veicular',      veiculo: 'Corsa Premium 2008',       placa: 'EEX6G78', valor: 4500.00, entrada: '23/04/2026', st: 'C' },
  { os: '1133097', cliente: 'Atena Proteção Veicular',   veiculo: 'Chevrolet Celta 2005',     placa: 'MVZ7H44', valor: 2482.00, entrada: '22/04/2026', st: 'C' },
];

function tipoCliente(nome) {
  const n = nome.toLowerCase();
  if (/(prote[cç][aã]o\s+veicular|associa[cç][aã]o|\bassoc\b)/.test(n)) return 'cooperativa';
  if (/(seguradora|seguro|yelum|porto\s+seguro|sulam|mapfre|tokio|bradesco|azul\s+seguros)/.test(n)) return 'seguradora';
  return 'particular';
}
const placaNorm = (p) => p.toUpperCase().replace(/[^A-Z0-9]/g, '');
const dataISO = (br) => { const [d, m, y] = br.split('/'); return `${y}-${m}-${d}`; };
const statusGeral = (st) => (st === 'A' ? 'Em Produção' : 'Entregue');

function mapear(oficinaId) {
  return OS.map((o) => ({
    oficina_id: oficinaId,
    placa: placaNorm(o.placa),
    modelo_veiculo: o.veiculo,
    tipo_cliente: tipoCliente(o.cliente),
    valor_orcamento: o.valor,
    data_entrada: dataISO(o.entrada),
    status_geral: statusGeral(o.st),
    ref_externa: o.os,
  }));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oficinaId = process.env.IMPORT_OFICINA_ID;

  if (DRY) {
    const rows = mapear(oficinaId || '<OFICINA_ID>');
    console.log(`DRY-RUN — ${rows.length} OS seriam importadas (sem gravar):\n`);
    for (const r of rows) {
      console.log(
        `  ${r.ref_externa}  ${r.placa.padEnd(8)} ${r.status_geral.padEnd(12)} ${r.tipo_cliente.padEnd(11)} ` +
          `R$ ${r.valor_orcamento.toFixed(2).padStart(10)}  ${r.data_entrada}  ${r.modelo_veiculo}`
      );
    }
    const porStatus = rows.reduce((a, r) => ((a[r.status_geral] = (a[r.status_geral] || 0) + 1), a), {});
    const porTipo = rows.reduce((a, r) => ((a[r.tipo_cliente] = (a[r.tipo_cliente] || 0) + 1), a), {});
    console.log('\n  por status:', porStatus, '\n  por tipo:  ', porTipo);
    console.log('\n(Use sem --dry-run, com SUPABASE_SERVICE_ROLE_KEY + IMPORT_OFICINA_ID, para gravar no teste.)');
    return;
  }

  if (!url || !key || !oficinaId) {
    console.error('Faltam envs: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IMPORT_OFICINA_ID.');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Idempotência: não reimporta OSs cujo ref_externa já existe nesta oficina.
  const { data: existentes, error: errLista } = await sb
    .from('ordens_servico')
    .select('ref_externa')
    .eq('oficina_id', oficinaId);
  if (errLista) { console.error('Erro ao listar existentes:', errLista.message); process.exit(1); }
  const jaImportadas = new Set((existentes || []).map((r) => r.ref_externa));

  const rows = mapear(oficinaId).filter((r) => !jaImportadas.has(r.ref_externa));
  if (rows.length === 0) { console.log('Nada novo a importar (todas já existem).'); return; }

  const { data, error } = await sb.from('ordens_servico').insert(rows).select('ref_externa');
  if (error) { console.error('Erro ao inserir:', error.message); process.exit(1); }
  console.log(`OK — ${data.length} OS importadas (${jaImportadas.size} já existiam e foram puladas).`);
}

main().catch((e) => { console.error('FALHA:', e.message); process.exit(1); });
