"use client";
// O "cartão" dos times: é ele que vira imagem pra mandar no grupo.
// Regra de ouro: nada de nota aqui quando `semNotas` (imagem). As médias só aparecem pra admin, no app.
import { forwardRef } from "react";
import { CORES_TIMES, NOMES_TIMES } from "@/lib/evento";

export type TimeCard = { jogadores: { id: string; nome: string }[]; goleiro: string | null; media?: number };

type Props = {
  pelada: string;
  subtitulo: string;
  times: TimeCard[];
  escuro: boolean;
  formato: "quadrada" | "vertical";
  selecionado?: [number, number] | null;
  aoTocar?: (time: number, pos: number) => void;
  mostrarMedias?: boolean;
};

const CardTimes = forwardRef<HTMLDivElement, Props>(function CardTimes(
  { pelada, subtitulo, times, escuro, formato, selecionado, aoTocar, mostrarMedias },
  ref,
) {
  const colunas = formato === "vertical" ? 1 : times.length === 3 ? 3 : 2;
  return (
    <div ref={ref} className={`flex flex-col gap-3 rounded-2xl p-4 ${escuro ? "bg-noite text-white" : "bg-white text-tinta"}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-xl font-bold">{pelada}</span>
        <span className={`text-sm font-semibold ${escuro ? "text-[#B9AFCB]" : "text-apagado"}`}>{subtitulo}</span>
      </div>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }}>
        {times.map((t, ti) => (
          <div key={ti} className={`flex flex-col overflow-hidden rounded-xl ${escuro ? "bg-white/5" : "bg-fundo"}`}>
            <div className="flex items-center justify-between px-2.5 py-1.5 text-[15px] font-bold text-white" style={{ background: CORES_TIMES[ti] }}>
              {NOMES_TIMES[ti]}
              {mostrarMedias && t.media !== undefined && <span className="text-xs font-semibold opacity-90">★ {t.media.toFixed(1).replace(".", ",")}</span>}
            </div>
            <div className="flex flex-col py-1">
              {t.jogadores.map((j, pi) => {
                const sel = selecionado?.[0] === ti && selecionado?.[1] === pi;
                const classe = `min-h-8 px-2.5 text-left text-sm font-medium leading-tight ${sel ? (escuro ? "bg-roxo/60" : "bg-roxo-suave") : ""}`;
                return aoTocar ? (
                  <button key={j.id} type="button" onClick={() => aoTocar(ti, pi)} className={classe}>
                    {j.nome}
                  </button>
                ) : (
                  <span key={j.id} className={`${classe} flex items-center`}>
                    {j.nome}
                  </span>
                );
              })}
              {t.goleiro && <span className={`px-2.5 pt-1 pb-0.5 text-[13px] ${escuro ? "text-[#B9AFCB]" : "text-apagado"}`}>🧤 {t.goleiro}</span>}
            </div>
          </div>
        ))}
      </div>
      <p className={`text-center text-xs font-semibold ${escuro ? "text-roxo-claro" : "text-roxo"}`}>Times gerados pelo MA Sorteio</p>
    </div>
  );
});

export default CardTimes;
