"use client";
// Pinta o app com a cor da pelada: nas telas da pelada (/bola-fora/..., /p/bola-fora/...)
// e, fora delas, com a cor da pelada que a pessoa abriu por último.
// Só vale se o plano da pelada tiver "Cores e camisa" (sem isso fica o roxo da marca).
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSessao } from "@/lib/sessao";
import { usePeladaAtual } from "@/lib/pelada-atual";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { varsDaMarca } from "@/lib/cores";
import { temRecurso } from "@/lib/planos";

type Tema = { cor_banner?: string | null; cor_menu?: string | null; plano?: string | null; recursos?: Record<string, boolean> | null; plano_ate?: string | null };

export default function TemaPelada() {
  const caminho = usePathname();
  const { peladas } = useSessao();
  const atualSlug = usePeladaAtual();
  const [publicas, setPublicas] = useState<Record<string, Tema | null>>({});

  const partes = caminho.split("/").filter(Boolean);
  const slugPublico = partes[0] === "p" ? partes[1] : null;
  const daRota = peladas.find((p) => p.slug === (slugPublico ?? partes[0]));
  const slug = slugPublico ?? daRota?.slug ?? atualSlug;
  const conhecida = peladas.find((p) => p.slug === slug);
  const tema: Tema | null | undefined = conhecida ?? (slug ? publicas[slug] : null);

  // Visitante sem conta numa página pública: busca a cor pelo endereço.
  useEffect(() => {
    if (!slugPublico || conhecida || slugPublico in publicas) return;
    criarClienteSupabase()
      .from("peladas")
      .select("*")
      .eq("slug", slugPublico)
      .maybeSingle()
      .then(({ data }) => setPublicas((m) => ({ ...m, [slugPublico]: (data as Tema) ?? null })));
  }, [slugPublico, conhecida, publicas]);

  const comCores = !!tema && temRecurso(tema, "cores");
  const cor = comCores ? tema.cor_banner : null;
  // Barra de menu: na cor da pelada (padrão, roxo da marca), branca ou escura.
  const menu = comCores && (tema.cor_menu === "claro" || tema.cor_menu === "escuro") ? tema.cor_menu : "cor";
  useEffect(() => {
    const vars = varsDaMarca(cor);
    const raiz = document.documentElement;
    for (const [k, v] of Object.entries(vars)) raiz.style.setProperty(k, v);
  }, [cor]);
  useEffect(() => {
    document.documentElement.dataset.menu = menu;
  }, [menu]);

  return null;
}
