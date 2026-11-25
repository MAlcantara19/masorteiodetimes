"use client";
// Configurar a lista da semana no app: liga/desliga, vagas de linha, goleiros, espera e quando abre.
// Mostra o link fixo pra deixar fixado no grupo do Zap.
import { useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { DIAS } from "@/lib/datas";
import type { Pelada } from "@/lib/pelada";
import { Interruptor } from "@/components/Folha";

export default function ConfigLista({ pelada, aoSalvar }: { pelada: Pelada; aoSalvar: () => void }) {
  const [ligada, setLigada] = useState(!!pelada.lista_app);
  const [vagas, setVagas] = useState(pelada.lista_vagas ?? 15);
  const [goleiros, setGoleiros] = useState(pelada.lista_goleiros ?? 3);
  const [espera, setEspera] = useState(pelada.lista_espera ?? 10);
  const [dia, setDia] = useState<string>(pelada.lista_abre_dia === null || pelada.lista_abre_dia === undefined ? "" : String(pelada.lista_abre_dia));
  const [hora, setHora] = useState(pelada.lista_abre_hora?.slice(0, 5) ?? "12:00");
  const [erro, setErro] = useState<string | null>(null);
  const [copiou, setCopiou] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/p/${pelada.slug}/lista` : "";

  async function salvar() {
    const { error } = await criarClienteSupabase()
      .from("peladas")
      .update({
        lista_app: ligada,
        lista_vagas: vagas,
        lista_goleiros: goleiros,
        lista_espera: espera,
        lista_abre_dia: dia === "" ? null : Number(dia),
        lista_abre_hora: dia === "" ? null : hora,
      })
      .eq("id", pelada.id);
    if (error) return setErro("Pra salvar a lista, rode no Supabase o SQL novo (supabase/migrations/0007).");
    setErro(null);
    aoSalvar();
  }

  const numero = (rotulo: string, valor: number, set: (n: number) => void, min: number, max: number) => (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold">{rotulo}</span>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={`Menos ${rotulo}`} onClick={() => set(Math.max(min, valor - 1))} className="h-9 w-9 rounded-lg border border-borda bg-fundo">
          −
        </button>
        <span className="w-9 text-center font-display text-lg font-bold">{valor}</span>
        <button type="button" aria-label={`Mais ${rotulo}`} onClick={() => set(Math.min(max, valor + 1))} className="h-9 w-9 rounded-lg border border-borda bg-fundo">
          +
        </button>
      </div>
    </div>
  );

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="font-semibold">Lista da semana no app</span>
          <span className="text-[13px] text-apagado">Cada um põe e tira o próprio nome. Mensalistas já entram.</span>
        </span>
        <Interruptor rotulo="Lista no app" ligado={ligada} aoMudar={setLigada} />
      </div>
      {ligada && (
        <>
          {numero("Vagas de linha", vagas, setVagas, 4, 40)}
          {numero("Goleiros", goleiros, setGoleiros, 0, 6)}
          {numero("Vagas na espera", espera, setEspera, 0, 30)}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              A lista abre
              <select value={dia} onChange={(e) => setDia(e.target.value)} className="h-11 rounded-xl border border-borda bg-white px-2 text-[15px] font-normal">
                <option value="">Na hora que eu lançar</option>
                {DIAS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Às
              <input type="time" value={hora} disabled={dia === ""} onChange={(e) => setHora(e.target.value)} className="h-11 rounded-xl border border-borda px-2 text-[15px] font-normal disabled:opacity-40" />
            </label>
          </div>
          {dia !== "" && (
            <span className="text-xs text-apagado">
              Toda {DIAS[Number(dia)].toLowerCase()} às {hora} a lista da próxima pelada abre sozinha, com os mensalistas. Uma hora antes e na hora, quem tem o app com notificação ligada recebe o aviso.
            </span>
          )}
          <div className="flex items-center gap-2 rounded-xl bg-fundo p-2 text-[13px]">
            <span className="min-w-0 flex-1 truncate">{link}</span>
            <button
              type="button"
              onClick={() =>
                navigator.clipboard
                  .writeText(link)
                  .then(() => setCopiou(true))
                  .catch(() => {})
              }
              className="shrink-0 rounded-lg bg-roxo px-3 py-1.5 font-semibold text-white"
            >
              {copiou ? "Copiado!" : "Copiar link"}
            </button>
          </div>
          <span className="text-xs text-apagado">Deixa esse link fixado no grupo: ele sempre abre a lista da semana.</span>
        </>
      )}
      {erro && <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{erro}</p>}
      <button type="button" onClick={salvar} className="h-11 rounded-xl bg-roxo font-semibold text-white">
        Salvar lista
      </button>
    </section>
  );
}
