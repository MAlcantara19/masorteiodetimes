"use client";
// Depois do login, volta pra página de onde a pessoa veio (ex.: link da votação).
// A página /entrar?volta=/p/bola-fora/votar guarda o destino; aqui a gente usa e apaga.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessao } from "@/lib/sessao";

export const CHAVE_VOLTA = "masorteio:voltar";

export default function RetornoLogin() {
  const { usuario, perfil } = useSessao();
  const router = useRouter();
  useEffect(() => {
    if (!usuario || !perfil?.perfil_completo) return;
    try {
      const destino = window.localStorage.getItem(CHAVE_VOLTA);
      if (destino && destino.startsWith("/") && !destino.startsWith("//")) {
        window.localStorage.removeItem(CHAVE_VOLTA);
        router.replace(destino);
      }
    } catch {}
  }, [usuario, perfil, router]);
  return null;
}
