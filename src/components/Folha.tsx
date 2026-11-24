"use client";
// "Folha" que sobe de baixo da tela (bottom sheet), usada pra editar jogador, escolher autor do gol etc.
import { useEffect, type ReactNode } from "react";
import Icone from "./Icone";

type Props = { aberta: boolean; titulo: string; aoFechar: () => void; children: ReactNode };

export default function Folha({ aberta, titulo, aoFechar, children }: Props) {
  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = antes;
    };
  }, [aberta, aoFechar]);

  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-noite/50" onClick={aoFechar}>
      <div
        role="dialog"
        aria-label={titulo}
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(20px+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <span className="font-display text-xl font-bold">{titulo}</span>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-full bg-fundo">
            <Icone nome="fechar" tamanho={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Interruptor liga/desliga no estilo do protótipo.
export function Interruptor({ ligado, aoMudar, rotulo }: { ligado: boolean; aoMudar: (v: boolean) => void; rotulo: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={() => aoMudar(!ligado)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${ligado ? "bg-roxo" : "bg-[#B9B3C6]"}`}
    >
      <span className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-all ${ligado ? "left-[23px]" : "left-[3px]"}`} />
    </button>
  );
}

// Grupo de botões (Simples | Completa, Defesa | Meio …)
export function Escolha<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
}: {
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  aoMudar: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-2">
      {opcoes.map((o) => {
        const on = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={on}
            onClick={() => aoMudar(o.valor)}
            className={`h-10 rounded-xl border px-3.5 text-sm font-semibold ${on ? "border-roxo bg-roxo text-white" : "border-borda bg-white text-tinta"}`}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
