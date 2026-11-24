"use client";
// Lembra qual pelada a pessoa abriu por último (pra barra de baixo saber pra onde levar).
import { useSyncExternalStore } from "react";

const CHAVE = "masorteio:pelada-atual";
const ouvintes = new Set<() => void>();

export function definirPeladaAtual(slug: string) {
  try {
    if (window.localStorage.getItem(CHAVE) === slug) return;
    window.localStorage.setItem(CHAVE, slug);
  } catch {}
  ouvintes.forEach((f) => f());
}

function ler(): string | null {
  try {
    return window.localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function usePeladaAtual(): string | null {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => {
        ouvintes.delete(f);
      };
    },
    ler,
    () => null,
  );
}
