"use client";
// No primeiro acesso, manda a pessoa completar o perfil (nome, apelido e WhatsApp) antes de usar o app.
// Quem já tinha perfil mas ainda não pôs o WhatsApp (SQL 0009) é levado pro perfil uma vez por sessão.
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSessao } from "@/lib/sessao";

const LIVRES = ["/perfil", "/entrar", "/auth", "/p/", "/privacidade", "/acompanhar", "/cronometro", "/tour", "/peladas"];

export default function GuardaPerfil() {
  const { carregando, usuario, perfil } = useSessao();
  const caminho = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (carregando || !usuario || !perfil) return;
    if (LIVRES.some((l) => caminho.startsWith(l))) return;
    if (!perfil.perfil_completo) return router.replace("/perfil?primeiro=1");
    const semZap = "whatsapp" in perfil && !perfil.whatsapp;
    if (semZap) {
      try {
        if (window.sessionStorage.getItem("masorteio:pediu-zap")) return;
        window.sessionStorage.setItem("masorteio:pediu-zap", "1");
      } catch {}
      router.replace("/perfil?zap=1");
    }
  }, [carregando, usuario, perfil, caminho, router]);
  return null;
}
