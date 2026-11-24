"use client";
// Painel master: só o Matheus vê. Peladas, admins e acessos (cadastro completo na etapa 2).
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessao } from "@/lib/sessao";
import Topo, { Carregando } from "@/components/Topo";

export default function MasterPage() {
  const router = useRouter();
  const { carregando, usuario, ehMaster, peladas } = useSessao();

  useEffect(() => {
    if (carregando) return;
    if (!usuario) router.replace("/entrar");
    else if (!ehMaster) router.replace("/");
  }, [carregando, usuario, ehMaster, router]);

  if (carregando || !ehMaster) return <Carregando />;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Painel master" sub="Peladas, admins e acessos" voltar="/mais" />
      <section className="rounded-2xl border border-borda bg-white p-4">
        <h2 className="font-semibold">Peladas ({peladas.length})</h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm text-apagado">
          {peladas.map((p) => (
            <li key={p.id}>{p.nome}</li>
          ))}
          {!peladas.length && <li>Nenhuma pelada ainda.</li>}
        </ul>
      </section>
    </main>
  );
}
