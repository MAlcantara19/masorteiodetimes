"use client";
// Gráficos simples, sem biblioteca: barras deitadas (ranking) e colunas (ao longo das peladas).
// Uma cor só (roxo), valores em texto escuro, e o detalhe aparece ao tocar/passar o mouse.
import { useState } from "react";

type Item = { rotulo: string; valor: number; detalhe?: string };

// Ranking: barras deitadas com o valor no fim.
export function GraficoBarras({ titulo, itens, unidade }: { titulo: string; itens: Item[]; unidade: string }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const max = Math.max(1, ...itens.map((i) => i.valor));
  if (!itens.length) return null;
  return (
    <figure className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
      <figcaption className="text-xs font-bold tracking-wider text-apagado">{titulo}</figcaption>
      <div className="flex flex-col gap-1.5" role="list">
        {itens.map((it, i) => (
          <button
            key={it.rotulo + i}
            type="button"
            role="listitem"
            onMouseEnter={() => setAtivo(i)}
            onMouseLeave={() => setAtivo(null)}
            onClick={() => setAtivo(ativo === i ? null : i)}
            aria-label={`${it.rotulo}: ${it.valor} ${unidade}${it.detalhe ? `, ${it.detalhe}` : ""}`}
            className={`grid grid-cols-[88px_1fr_28px] items-center gap-2 rounded-md py-0.5 text-left text-sm ${ativo === i ? "bg-fundo" : ""}`}
          >
            <span className="truncate font-semibold">{it.rotulo}</span>
            <span className="h-3.5 w-full">
              <span className="block h-full rounded-r-[4px] bg-roxo" style={{ width: `${Math.max(2, (it.valor / max) * 100)}%` }} />
            </span>
            <span className="text-right font-display font-bold tabular-nums text-tinta">{it.valor}</span>
          </button>
        ))}
      </div>
      <p className="min-h-4 text-xs text-apagado" aria-live="polite">
        {ativo !== null ? `${itens[ativo].rotulo}: ${itens[ativo].valor} ${unidade}${itens[ativo].detalhe ? ` · ${itens[ativo].detalhe}` : ""}` : "Toque numa barra pra ver o detalhe"}
      </p>
    </figure>
  );
}

// Evolução: uma coluna por pelada, com o rótulo da data embaixo. O maior valor ganha o número em cima.
export function GraficoColunas({ titulo, itens, unidade }: { titulo: string; itens: Item[]; unidade: string }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const max = Math.max(1, ...itens.map((i) => i.valor));
  const iMax = itens.findIndex((i) => i.valor === max);
  if (!itens.length) return null;
  return (
    <figure className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
      <figcaption className="text-xs font-bold tracking-wider text-apagado">{titulo}</figcaption>
      <div className="flex h-36 items-end gap-[2px] border-b border-borda" role="list">
        {itens.map((it, i) => {
          const alto = (it.valor / max) * 100;
          return (
            <button
              key={it.rotulo + i}
              type="button"
              role="listitem"
              onMouseEnter={() => setAtivo(i)}
              onMouseLeave={() => setAtivo(null)}
              onClick={() => setAtivo(ativo === i ? null : i)}
              aria-label={`${it.rotulo}: ${it.valor} ${unidade}`}
              className="relative flex h-full flex-1 flex-col items-center justify-end"
            >
              {(i === iMax || i === ativo) && it.valor > 0 && (
                <span className="absolute text-[11px] font-bold tabular-nums text-tinta" style={{ bottom: `calc(${alto * 0.85}% + 2px)` }}>
                  {it.valor}
                </span>
              )}
              <span className={`w-full max-w-7 rounded-t-[4px] ${ativo === i ? "bg-roxo-escuro" : "bg-roxo"}`} style={{ height: `${it.valor ? Math.max(3, alto * 0.85) : 0}%` }} />
            </button>
          );
        })}
      </div>
      <div className="flex gap-[2px]">
        {itens.map((it, i) => (
          <span key={i} className="flex-1 text-center text-[10px] text-apagado">
            {itens.length > 10 && i % 2 ? "" : it.rotulo}
          </span>
        ))}
      </div>
      <p className="min-h-4 text-xs text-apagado" aria-live="polite">
        {ativo !== null ? `${itens[ativo].rotulo}: ${itens[ativo].valor} ${unidade}${itens[ativo].detalhe ? ` · ${itens[ativo].detalhe}` : ""}` : "Toque numa coluna pra ver o detalhe"}
      </p>
    </figure>
  );
}
