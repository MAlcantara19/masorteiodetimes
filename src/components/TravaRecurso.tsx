"use client";
// Trava uma tela inteira pelo plano da pelada (usado nos layout.tsx de pagar, retrospectiva etc.).
// Se a pelada não tem o recurso, mostra o aviso com o contato no lugar da tela.
import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useSessao } from "@/lib/sessao";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { temRecurso, type Recurso } from "@/lib/planos";
import Bloqueado from "./Bloqueado";
import Topo from "./Topo";

type Info = { id: string; nome: string; plano?: string | null; recursos?: Record<string, boolean> | null; plano_ate?: string | null };

export default function TravaRecurso({ recurso, titulo, children }: { recurso: Recurso; titulo: string; children: ReactNode }) {
  const { pelada: slug } = useParams<{ pelada: string }>();
  const { peladas, ehMaster, ehAdmin, carregando } = useSessao();
  const conhecida = peladas.find((p) => p.slug === slug) as Info | undefined;
  const [buscada, setBuscada] = useState<Info | null | undefined>(undefined);

  useEffect(() => {
    if (conhecida || carregando) return;
    criarClienteSupabase()
      .from("peladas")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => setBuscada((data as Info) ?? null));
  }, [conhecida, carregando, slug]);

  const p = conhecida ?? buscada;
  // Enquanto não sabe (ou pelada não existe), deixa a própria tela cuidar.
  if (!p || temRecurso(p, recurso, ehMaster)) return <>{children}</>;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo={titulo} sub={p.nome} voltar="/" />
      <Bloqueado titulo={titulo} pelada={p.nome} admin={ehAdmin(p.id)} />
    </main>
  );
}
