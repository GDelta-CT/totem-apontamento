"use client";

import { useEffect, useState } from "react";
import { buscarApontamentoEmAndamento } from "@/lib/supabase/queries";

export default function DiagnosticoPage() {
  const [resultado, setResultado] = useState<string>("Carregando...");

  useEffect(() => {
    (async () => {
      const r = await buscarApontamentoEmAndamento("João Silva");
      const linhas: string[] = [];

      linhas.push("==== TIMESTAMP DESTA TELA ====");
      linhas.push("Date.now() agora = " + Date.now());
      linhas.push("Hora local = " + new Date().toLocaleString("pt-BR"));
      linhas.push("Hora ISO = " + new Date().toISOString());
      linhas.push("");
      linhas.push("==== RESULTADO DA BUSCA NO SUPABASE ====");
      linhas.push("Status: " + r.status);

      if (r.status === "success") {
        const a = r.data;
        linhas.push("");
        linhas.push("Apontamento encontrado:");
        linhas.push("  id = " + a.id);
        linhas.push("  nome_funcionario = " + a.nome_funcionario);
        linhas.push("  status_tarefa = " + a.status_tarefa);
        linhas.push("  hora_inicio (raw) = " + JSON.stringify(a.hora_inicio));
        linhas.push("  hora_inicio tipo = " + typeof a.hora_inicio);
        if (a.hora_inicio) {
          const inicioMs = new Date(a.hora_inicio).getTime();
          linhas.push("  hora_inicio em ms = " + inicioMs);
          linhas.push("  hora_inicio é NaN? = " + isNaN(inicioMs));
          linhas.push("  hora_inicio em pt-BR = " + new Date(a.hora_inicio).toLocaleString("pt-BR"));
          linhas.push("  diferença ms = " + (Date.now() - inicioMs));
          linhas.push("  diferença segundos = " + Math.floor((Date.now() - inicioMs) / 1000));
        }
      } else if (r.status === "empty") {
        linhas.push("");
        linhas.push("Nenhuma tarefa Em andamento para Joao Silva.");
      } else if (r.status === "error") {
        linhas.push("ERRO: " + r.message);
      }

      setResultado(linhas.join("\n"));
    })();
  }, []);

  return (
    <main style={{ padding: 20, fontFamily: "monospace", color: "#0f0", background: "#000", minHeight: "100vh" }}>
      <h1 style={{ color: "#ffb000", fontSize: 24 }}>DIAGNOSTICO RAPIDO</h1>
      <pre style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {resultado}
      </pre>
    </main>
  );
}