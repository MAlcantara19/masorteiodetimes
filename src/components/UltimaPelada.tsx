"use client";
// Resumo da última pelada no Início: jogos, artilheiro e craque.
import Link from "next/link";
import { useEffect, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { carregarElenco, nomeCurto, type Membro } from "@/lib/pelada";
import { calcularEstatisticas, calcularPremios, carregarPeriodo } from "@/lib/estatisticas";
import { DIAS, curtaDia, deIso } from "@/lib/datas";
import type { PeladaResumo } from "@/lib/sessao";

type Resumo = { data: string; jogos: number; artilheiro: string; craque: string };

export default function UltimaPelada({ pelada }: { pelada: PeladaResumo }) {
  const [r, setR] = useState<Resumo | null>(null);

  useEffect(() => {
    (async () => {
      const { data: ev } = await criarClienteSupabase()
        .from("eventos")
        .select("id, data")
        .eq("pelada_id", pelada.id)
        .eq("status", "encerrado")
        .order("data", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!ev) return;
      const [d, el] = await Promise.all([carregarPeriodo(pelada.id, undefined, undefined, [ev.id]), carregarElenco(pelada.id, false)]);
      const porId = new Map(el.map((m) => [m.id, m]));
      const nome = (ids: string[]) => ids.map((id) => (porId.get(id) ? nomeCurto(porId.get(id) as Membro) : "?")).join(", ") || "—";
      const est = calcularEstatisticas(d);
      const pr = calcularPremios(est);
      const gols = pr.artilheiro.ids.length ? ` · ${pr.artilheiro.valor}` : "";
      setR({ data: ev.data, jogos: d.partidas.filter((p) => p.status === "encerrada").length, artilheiro: nome(pr.artilheiro.ids) + gols, craque: nome(pr.craque.ids) });
    })();
  }, [pelada.id]);

  if (!r) return null;
  const dt = deIso(r.data);
  return (
    <div className="flex flex-col gap-2.5">
      <h2 className="text-[13px] font-semibold tracking-wide text-apagado uppercase">
        Última pelada · {DIAS[dt.getDay()].toLowerCase()} {curtaDia(r.data)}
      </h2>
      <Link href={`/${pelada.slug}/fim`} className="grid grid-cols-3 gap-2 text-tinta">
        <div className="flex flex-col gap-0.5 rounded-[14px] border border-borda bg-white p-3">
          <span className="text-[11px] text-apagado">Jogos</span>
          <span className="font-display text-[22px] font-bold">{r.jogos}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-[14px] border border-borda bg-white p-3">
          <span className="text-[11px] text-apagado">Artilheiro</span>
          <span className="truncate text-sm font-semibold">{r.artilheiro}</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-[14px] border border-borda bg-white p-3">
          <span className="text-[11px] text-apagado">Craque</span>
          <span className="truncate text-sm font-semibold">{r.craque}</span>
        </div>
      </Link>
    </div>
  );
}
