"use client";
// Convite por link: a pessoa entra (Google ou e-mail) e escolhe se já está no elenco ("sou eu") ou se é nova.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessao } from "@/lib/sessao";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { Carregando } from "@/components/Topo";
import Capa from "@/components/Capa";

export default function ConvitePage() {
  const router = useRouter();
  const q = useSearchParams();
  const codigo = q.get("c") ?? "";
  const { pelada, slug, naoAchou } = usePelada();
  const { carregando, usuario, vinculos, recarregar } = useSessao();
  const [livres, setLivres] = useState<Membro[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const jaEsta = !!pelada && vinculos.some((v) => v.pelada.id === pelada.id);

  useEffect(() => {
    if (pelada) carregarElenco(pelada.id, false).then((el) => setLivres(el.filter((m) => m.ativo && !m.profile_id)));
  }, [pelada]);

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando) return <Carregando />;

  async function entrar(membroId: string | null) {
    setEnviando(true);
    setErro(null);
    const r = await fetch("/api/convite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, codigo, membro_id: membroId }),
    });
    const j = await r.json();
    setEnviando(false);
    if (!r.ok) return setErro(j.erro ?? "Deu erro.");
    await recarregar();
    router.replace("/");
  }

  const volta = `/p/${slug}/convite?c=${encodeURIComponent(codigo)}`;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-8">
      <Capa titulo={pelada.nome} sub="Você foi convidado pra jogar no MA Sorteio" voltar="/" logo={pelada.logo_url} />

      {!usuario && (
        <Link href={`/entrar?volta=${encodeURIComponent(volta)}`} className="flex h-14 items-center justify-center rounded-2xl bg-roxo text-lg font-bold text-white">
          Entrar pra aceitar
        </Link>
      )}

      {usuario && jaEsta && (
        <>
          <p className="rounded-2xl bg-roxo-suave p-4 text-center font-semibold text-roxo-escuro">Você já está nessa pelada! 💜</p>
          <Link href="/" className="flex h-12 items-center justify-center rounded-xl bg-roxo font-semibold text-white">
            Ir pro início
          </Link>
        </>
      )}

      {usuario && !jaEsta && (
        <>
          {livres.length > 0 && (
            <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
              <span className="font-semibold">Você já está no elenco? Toca no seu nome:</span>
              <div className="grid grid-cols-2 gap-2">
                {livres.map((m) => (
                  <button key={m.id} type="button" disabled={enviando} onClick={() => entrar(m.id)} className="h-11 rounded-xl border border-borda text-sm font-semibold">
                    {nomeCurto(m)}
                  </button>
                ))}
              </div>
            </section>
          )}
          <button type="button" disabled={enviando} onClick={() => entrar(null)} className="h-14 rounded-2xl bg-roxo text-lg font-bold text-white disabled:opacity-50">
            {livres.length ? "Não tô na lista, sou novo" : "Entrar na pelada"}
          </button>
        </>
      )}
      {erro && <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{erro}</p>}
    </main>
  );
}
