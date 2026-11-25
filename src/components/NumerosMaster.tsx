"use client";
// Números do app pro master: peladas, gente, jogos e gols, quem está no Grátis e quem paga.
import { useEffect, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import type { Pelada } from "@/lib/pelada";
import { planoDe } from "@/lib/planos";
import { curtaDia, isoDia } from "@/lib/datas";

type PorPelada = { id: string; ultima: string | null; dias30: number; jogos30: number };
type Numeros = { contas: number; contasNovas: number; jogos30: number; gols30: number; porPelada: Map<string, PorPelada> };

const PRECO = 29.9;

export default function NumerosMaster({ peladas }: { peladas: Pelada[] }) {
  const [n, setN] = useState<Numeros | null>(null);

  useEffect(() => {
    if (!peladas.length) return;
    (async () => {
      const sb = criarClienteSupabase();
      const desde = new Date();
      desde.setDate(desde.getDate() - 30);
      const [{ count: contas }, { count: novas }, { data: evs }] = await Promise.all([
        sb.from("profiles").select("id", { count: "exact", head: true }),
        sb.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", desde.toISOString()),
        sb.from("eventos").select("id, pelada_id, data").neq("status", "cancelado").gte("data", isoDia(desde)).lte("data", isoDia(new Date())),
      ]);
      const eventos = (evs ?? []) as { id: string; pelada_id: string; data: string }[];
      const ids = eventos.map((e) => e.id);
      const { data: ps } = ids.length ? await sb.from("partidas").select("id, evento_id, placar_a, placar_b").in("evento_id", ids) : { data: [] };
      const partidas = (ps ?? []) as { id: string; evento_id: string; placar_a: number; placar_b: number }[];
      const peladaDo = new Map(eventos.map((e) => [e.id, e.pelada_id]));
      const porPelada = new Map<string, PorPelada>();
      for (const p of peladas) porPelada.set(p.id, { id: p.id, ultima: null, dias30: 0, jogos30: 0 });
      for (const e of eventos) {
        const x = porPelada.get(e.pelada_id);
        if (!x || !partidas.some((p) => p.evento_id === e.id)) continue;
        x.dias30++;
        if (!x.ultima || e.data > x.ultima) x.ultima = e.data;
      }
      for (const p of partidas) {
        const x = porPelada.get(peladaDo.get(p.evento_id) ?? "");
        if (x) x.jogos30++;
      }
      setN({
        contas: contas ?? 0,
        contasNovas: novas ?? 0,
        jogos30: partidas.length,
        gols30: partidas.reduce((s, p) => s + p.placar_a + p.placar_b, 0),
        porPelada,
      });
    })();
  }, [peladas]);

  const reais = peladas.filter((p) => !p.demo);
  const pagantes = reais.filter((p) => planoDe(p) === "completo");
  const ativas = n ? reais.filter((p) => (n.porPelada.get(p.id)?.dias30 ?? 0) > 0) : [];
  const card = (valor: string | number, rotulo: string) => (
    <div className="rounded-2xl bg-white/10 p-3">
      <div className="font-display text-2xl font-bold tabular-nums">{valor}</div>
      <div className="text-xs text-[#CFC7E0]">{rotulo}</div>
    </div>
  );

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-noite p-4 text-white">
      <span className="text-xs font-bold tracking-wider text-roxo-claro">NÚMEROS DO APP</span>
      <div className="grid grid-cols-3 gap-2">
        {card(reais.length, "peladas")}
        {card(n ? ativas.length : "…", "jogaram em 30 dias")}
        {card(pagantes.length, "no Completo")}
        {card(n ? n.contas : "…", "contas")}
        {card(n ? `+${n.contasNovas}` : "…", "contas em 30 dias")}
        {card((pagantes.length * PRECO).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }), "por mês (estimado)")}
        {card(n ? n.jogos30 : "…", "jogos em 30 dias")}
        {card(n ? n.gols30 : "…", "gols em 30 dias")}
        {card(n && ativas.length ? (n.jogos30 / ativas.length).toFixed(0) : "—", "jogos por pelada ativa")}
      </div>
      <div className="flex flex-col gap-1 text-sm">
        {reais.map((p) => {
          const x = n?.porPelada.get(p.id);
          const plano = planoDe(p);
          return (
            <div key={p.id} className="flex items-center justify-between gap-2 border-t border-white/10 pt-1.5">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.cor_banner || "#7444D6" }} />
                <span className="truncate">{p.nome}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${plano === "completo" ? "bg-roxo text-white" : "bg-white/15 text-[#CFC7E0]"}`}>
                  {plano === "completo" ? "COMPLETO" : "GRÁTIS"}
                  {p.plano_ate ? ` até ${curtaDia(p.plano_ate)}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-xs text-[#CFC7E0]">{x ? (x.ultima ? `${x.jogos30} jogos · última ${curtaDia(x.ultima)}` : "parada há 30+ dias") : "…"}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
