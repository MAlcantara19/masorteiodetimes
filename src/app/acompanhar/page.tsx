"use client";
// "Só acompanhar": lista as peladas pra abrir o ao vivo sem login.
import Link from "next/link";
import { useEffect, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import Topo, { Carregando } from "@/components/Topo";
import { DIAS, horaCurta } from "@/lib/datas";

type P = { id: string; nome: string; slug: string; dia_semana: number | null; horario: string | null };

export default function AcompanharPage() {
  const [peladas, setPeladas] = useState<P[] | null>(null);

  useEffect(() => {
    criarClienteSupabase()
      .from("peladas")
      .select("id, nome, slug, dia_semana, horario")
      .order("nome")
      .then(({ data }) => setPeladas((data ?? []) as P[]));
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Acompanhar" sub="Escolha a pelada pra ver o placar ao vivo" voltar="/" />
      {!peladas && <Carregando />}
      {peladas?.map((p) => (
        <Link key={p.id} href={`/p/${p.slug}/ao-vivo`} className="flex items-center justify-between rounded-2xl border border-borda bg-white p-4">
          <span className="flex flex-col">
            <span className="font-display text-lg font-semibold">{p.nome}</span>
            <span className="text-[13px] text-apagado">
              {p.dia_semana !== null ? `${DIAS[p.dia_semana]} · ${horaCurta(p.horario)}` : "Sem dia fixo"}
            </span>
          </span>
          <span className="font-semibold text-roxo">Ao vivo →</span>
        </Link>
      ))}
      {peladas && !peladas.length && <p className="text-sm text-apagado">Nenhuma pelada cadastrada ainda.</p>}
    </main>
  );
}
