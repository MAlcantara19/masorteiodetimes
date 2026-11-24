"use client";
// "Ao vivo agora" no Início: as peladas que estão rolando neste momento (só pra assistir).
// Quem é da pelada e está logado mexe no placar dentro da tela da partida.
import Link from "next/link";
import { useEffect, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { NOMES_TIMES } from "@/lib/evento";

type AoVivo = { slug: string; nome: string; jogo: number | null; placar: string | null; status: string | null };

export default function AoVivoAgora() {
  const [lista, setLista] = useState<AoVivo[]>([]);

  useEffect(() => {
    const sb = criarClienteSupabase();
    const carregar = async () => {
      const { data } = await sb
        .from("eventos")
        .select("id, peladas!inner(nome, slug), partidas(numero, time_a, time_b, placar_a, placar_b, status)")
        .eq("status", "em_jogo")
        .limit(10);
      const linhas = (data ?? []) as unknown as {
        peladas: { nome: string; slug: string };
        partidas: { numero: number; time_a: number; time_b: number; placar_a: number; placar_b: number; status: string }[];
      }[];
      setLista(
        linhas.map((e) => {
          const p = [...(e.partidas ?? [])].sort((a, b) => b.numero - a.numero)[0];
          return {
            slug: e.peladas.slug,
            nome: e.peladas.nome,
            jogo: p?.numero ?? null,
            placar: p ? `${NOMES_TIMES[p.time_a]} ${p.placar_a} × ${p.placar_b} ${NOMES_TIMES[p.time_b]}` : null,
            status: p?.status ?? null,
          };
        }),
      );
    };
    carregar();
    const t = setInterval(carregar, 30_000);
    return () => clearInterval(t);
  }, []);

  if (!lista.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide text-apagado uppercase">
        <span className="h-2 w-2 animate-pulse rounded-full bg-alerta" /> Ao vivo agora
      </h2>
      {lista.map((a) => (
        <Link key={a.slug} href={`/p/${a.slug}/ao-vivo`} className="flex items-center gap-3 rounded-2xl bg-noite p-4 text-white">
          <span className="flex flex-1 flex-col">
            <span className="font-display text-lg font-bold">{a.nome}</span>
            <span className="text-sm text-[#CFC7E0]">
              {a.jogo ? `Jogo ${a.jogo} · ${a.placar}` : "Começando"}
              {a.status === "pausado" ? " · pausado" : ""}
            </span>
          </span>
          <span className="rounded-full bg-alerta px-2.5 py-1 text-xs font-bold">ASSISTIR</span>
        </Link>
      ))}
    </section>
  );
}
