"use client";
// Modo noturno "igual ao celular": acompanha quando o celular troca entre claro e escuro.
import { useEffect } from "react";
import { aplicarTema } from "@/lib/tema";

export default function TemaNoturno() {
  useEffect(() => {
    aplicarTema();
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const mudou = () => aplicarTema();
    m.addEventListener("change", mudou);
    return () => m.removeEventListener("change", mudou);
  }, []);
  return null;
}
