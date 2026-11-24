"use client";
// No primeiro acesso, manda a pessoa completar o perfil (nome e apelido) antes de usar o app.
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSessao } from "@/lib/sessao";

const LIVRES = ["/perfil", "/entrar", "/auth", "/p/", "/privacidade", "/acompanhar", "/cronometro", "/tour"];

export default function GuardaPerfil() {
  const { carregando, usuario, perfil } = useSessao();
  const caminho = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (carregando || !usuario || !perfil) return;
    if (perfil.perfil_completo) return;
    if (LIVRES.some((l) => caminho.startsWith(l))) return;
    router.replace("/perfil?primeiro=1");
  }, [carregando, usuario, perfil, caminho, router]);
  return null;
}
