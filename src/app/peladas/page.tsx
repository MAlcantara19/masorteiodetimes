"use client";
// Achar pelada: as peladas que quiseram aparecer (o admin liga em Configurar), com dia, horário,
// local, valores e o WhatsApp de contato. Abre sem login.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { DIAS } from "@/lib/datas";
import type { Pelada } from "@/lib/pelada";
import { linkZapPara } from "@/lib/whatsapp";
import { normalizar } from "@/lib/lista";
import Topo, { Carregando } from "@/components/Topo";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AcharPeladaPage() {
  const [peladas, setPeladas] = useState<Pelada[] | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    criarClienteSupabase()
      .from("peladas")
      .select("*")
      .eq("publica", true)
      .order("nome")
      .then(({ data }) => setPeladas(((data ?? []) as Pelada[]).filter((p) => !p.demo)));
  }, []);

  const lista = useMemo(() => {
    const q = normalizar(busca);
    return (peladas ?? []).filter((p) => !q || normalizar(`${p.nome} ${p.local ?? ""} ${p.dia_semana !== null ? DIAS[p.dia_semana] : ""}`).includes(q));
  }, [peladas, busca]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Achar pelada" sub="peladas abertas pra galera nova" voltar="/" />
      <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar por nome, bairro, dia…" aria-label="Procurar pelada" className="h-12 rounded-xl border border-borda bg-white px-3 text-[15px]" />

      {peladas === null ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <p className="rounded-2xl border border-borda bg-white p-4 text-center text-sm text-apagado">
          {peladas.length ? "Nenhuma pelada com esse nome." : "Ainda não tem pelada aberta por aqui."}
        </p>
      ) : (
        lista.map((p) => (
          <article key={p.id} className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-lg font-bold text-white" style={{ background: p.cor_banner || "#7444D6" }}>
                {p.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logo_url} alt="" className="h-full w-full bg-white object-contain" />
                ) : (
                  p.nome.slice(0, 1)
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-display text-lg font-bold">{p.nome}</span>
                <span className="text-[13px] text-apagado">
                  {p.dia_semana !== null ? DIAS[p.dia_semana] : "Dia a combinar"}
                  {p.horario ? ` · ${p.horario.slice(0, 5)}${p.horario_fim ? ` às ${p.horario_fim.slice(0, 5)}` : ""}` : ""}
                </span>
              </span>
            </div>
            {p.local && <span className="text-sm">📍 {p.local}</span>}
            {(p.mensalidade || p.valor_diaria) && (
              <span className="text-sm">
                💰 {[p.mensalidade ? `Mensalidade ${brl(Number(p.mensalidade))}` : null, p.valor_diaria ? `Diária ${brl(Number(p.valor_diaria))}` : null].filter(Boolean).join(" · ")}
              </span>
            )}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Link href={`/p/${p.slug}`} className="flex h-11 items-center justify-center rounded-xl border border-borda text-sm font-semibold">
                Ver a pelada
              </Link>
              {p.contato_whatsapp ? (
                <a
                  href={linkZapPara(p.contato_whatsapp, `Oi! Vi a ${p.nome} no MA Sorteio de Times. Tem vaga pra jogar?`)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-11 items-center justify-center rounded-xl bg-zap text-sm font-semibold text-white"
                >
                  Falar com o admin
                </a>
              ) : (
                <span />
              )}
            </div>
          </article>
        ))
      )}
    </main>
  );
}
