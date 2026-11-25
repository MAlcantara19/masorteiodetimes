"use client";
// Recebe a lista compartilhada do WhatsApp (app instalado no Android) e leva pra tela "Colar lista"
// da pelada certa. Se a pessoa é admin de mais de uma, pergunta qual.
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessao } from "@/lib/sessao";
import { usePeladaAtual } from "@/lib/pelada-atual";
import Topo, { Carregando } from "@/components/Topo";
import { CHAVE_LISTA } from "@/lib/lista";

function Receber() {
  const router = useRouter();
  const busca = useSearchParams();
  const { carregando, usuario, peladas, ehAdmin } = useSessao();
  const atual = usePeladaAtual();
  const daUrl = [busca.get("title"), busca.get("text"), busca.get("url")].filter(Boolean).join("\n").trim();
  const [guardado, setGuardado] = useState("");
  const texto = daUrl || guardado;
  const minhas = peladas.filter((p) => ehAdmin(p.id));
  const destino = minhas.length === 1 ? minhas[0] : (minhas.find((p) => p.slug === atual) ?? null);

  // Guarda a lista (e recupera se voltou do login sem ela no endereço).
  useEffect(() => {
    try {
      if (daUrl) window.sessionStorage.setItem(CHAVE_LISTA, daUrl);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      else setGuardado(window.sessionStorage.getItem(CHAVE_LISTA) ?? "");
    } catch {}
  }, [daUrl]);

  useEffect(() => {
    if (!carregando && usuario && destino && texto && minhas.length === 1) router.replace(`/${destino.slug}/lista`);
  }, [carregando, usuario, destino, texto, minhas.length, router]);

  if (carregando) return <Carregando />;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Lista recebida" sub="do WhatsApp" voltar="/" />
      {!texto && <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">Não chegou nenhum texto. No Zap, segure a mensagem da lista → Compartilhar → MA Sorteio.</p>}
      {texto && !usuario && (
        <p className="rounded-2xl border border-borda bg-white p-4 text-sm">
          Entre na sua conta pra usar a lista.{" "}
          <Link href="/entrar?volta=/compartilhar" className="font-semibold text-roxo">
            Entrar
          </Link>
        </p>
      )}
      {texto && usuario && !minhas.length && <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">Só admin da pelada monta o sorteio pela lista.</p>}
      {texto && minhas.length > 1 && (
        <section className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Essa lista é de qual pelada?</span>
          {minhas.map((p) => (
            <Link key={p.id} href={`/${p.slug}/lista`} className="flex h-14 items-center gap-3 rounded-2xl border border-borda bg-white px-4 font-semibold">
              <span className="h-3 w-3 rounded-full" style={{ background: p.cor_banner || "#7444D6" }} />
              {p.nome}
              {p.slug === atual && <span className="text-xs font-normal text-apagado">· a última que você abriu</span>}
            </Link>
          ))}
        </section>
      )}
      {texto && (
        <pre className="max-h-64 overflow-auto rounded-2xl border border-borda bg-white p-3 font-mono text-xs whitespace-pre-wrap text-apagado">{texto}</pre>
      )}
    </main>
  );
}

export default function CompartilharPage() {
  return (
    <Suspense fallback={<Carregando />}>
      <Receber />
    </Suspense>
  );
}
