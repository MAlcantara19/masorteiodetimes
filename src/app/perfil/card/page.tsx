"use client";
// Meu card: a carta do jogador em cada pelada, com a raridade calculada sozinha.
// Quando sobe de raridade, roda a animação de "abrir pacote".
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { carregarElenco, nomeCurto, type Membro } from "@/lib/pelada";
import { carregarCartas, cartaFinal, posicaoCarta, statsCarta, type InfoCarta } from "@/lib/cartas";
import { compartilharDataUrl, baixarDataUrl, gerarPng } from "@/lib/imagem";
import Carta, { ESTILOS, LIBERA, ORDEM_RARIDADE, type Raridade } from "@/components/Carta";
import Topo, { Carregando } from "@/components/Topo";

const CORES = ["#C8102E", "#7444D6", "#1A8F4E", "#1B6FD6", "#E07A10", "#121212", "#C2185B", "#0E7C86"];

export default function MeuCardPage() {
  const router = useRouter();
  const { carregando, usuario, perfil, vinculos, recarregar } = useSessao();
  const [idx, setIdx] = useState(0);
  const [membro, setMembro] = useState<Membro | null>(null);
  const [info, setInfo] = useState<InfoCarta | null>(null);
  const [cor, setCor] = useState<string | null>(null);
  const [estilo, setEstilo] = useState<string | null>(null);
  const [pacote, setPacote] = useState<"fechado" | "aberto" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const v = vinculos[idx];

  useEffect(() => {
    if (!carregando && !usuario) router.replace("/entrar?volta=/perfil/card");
  }, [carregando, usuario, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (perfil) setCor(perfil.cor_card);
    if (perfil) setEstilo(perfil.estilo_card ?? null);
  }, [perfil]);

  useEffect(() => {
    if (!v) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInfo(null);
    carregarElenco(v.pelada.id, false).then((el) => setMembro(el.find((m) => m.id === v.membro_id) ?? null));
    carregarCartas(v.pelada.id).then(({ cartas }) => {
      const i = cartas.get(v.membro_id) ?? { raridade: "bronze" as const, temporada: null, medalhasMes: 0, desbloqueadas: ["bronze" as const] };
      setInfo(i);
      // Subiu de raridade desde a última vez? Abre o pacote.
      try {
        const chave = `masorteio:raridade:${v.membro_id}`;
        const antes = window.localStorage.getItem(chave);
        if (antes && ORDEM_RARIDADE.indexOf(i.raridade) > ORDEM_RARIDADE.indexOf(antes as never)) setPacote("fechado");
        window.localStorage.setItem(chave, i.raridade);
      } catch {}
    });
  }, [v]);

  if (carregando || !usuario) return <Carregando />;
  if (!vinculos.length) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
        <Topo titulo="Meu card" voltar="/mais" />
        <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">
          Seu card aparece quando o admin te ligar ao elenco da pelada (pelo seu e-mail: {perfil?.email}).
        </p>
      </main>
    );
  }

  async function escolherCor(c: string) {
    if (!usuario) return;
    setCor(c);
    await criarClienteSupabase().from("profiles").update({ cor_card: c }).eq("id", usuario.id);
    recarregar();
  }

  async function escolherEstilo(r: Raridade) {
    if (!usuario) return;
    setEstilo(r);
    const { error } = await criarClienteSupabase().from("profiles").update({ estilo_card: r }).eq("id", usuario.id);
    if (error) setAviso("Pra salvar o design escolhido, o admin precisa rodar o SQL novo no Supabase (0002).");
  }

  async function imagem(acao: "baixar" | "compartilhar") {
    if (!ref.current) return;
    try {
      const url = await gerarPng(ref.current, { escala: 4 });
      const nome = `card-${(membro ? nomeCurto(membro) : "jogador").toLowerCase().replace(/\s+/g, "-")}.png`;
      if (acao === "baixar") baixarDataUrl(url, nome);
      else await compartilharDataUrl(url, nome, `Meu card na ${v.pelada.nome} · MA Sorteio`);
    } catch {
      setAviso("Não deu pra gerar a imagem neste navegador.");
    }
  }

  const carta =
    membro && info ? (
      <Carta
        ref={ref}
        apelido={nomeCurto(membro)}
        posicao={posicaoCarta(membro)}
        pelada={v.pelada.nome}
        raridade={cartaFinal(info, estilo)}
        cor={cor}
        foto={perfil?.foto_url}
        stats={statsCarta(membro, info.temporada, info.medalhasMes)}
        escala={1.3}
      />
    ) : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo
        titulo="Meu card"
        sub={`${perfil?.nome ?? ""} · ${v.pelada.nome}`}
        voltar="/mais"
        direita={
          <Link href={`/${v.pelada.slug}/album`} className="text-sm font-semibold text-roxo">
            Ver álbum →
          </Link>
        }
      />

      {vinculos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {vinculos.map((x, i) => (
            <button
              key={x.membro_id}
              type="button"
              onClick={() => setIdx(i)}
              className={`h-9 shrink-0 rounded-full border px-3 text-sm font-semibold ${i === idx ? "border-noite bg-noite text-white" : "border-borda bg-white"}`}
            >
              {x.pelada.nome}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-center py-2">{carta ?? <Carregando />}</div>

      {info && (
        <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4 text-sm">
          <span className="font-semibold">Raridade: {ESTILOS[info.raridade].label.toLowerCase()}</span>
          <span className="text-apagado">
            Ela muda sozinha: prata com 10 peladas no ano, ouro com 25 ou com uma medalha no mês, carta preta pro destaque da semana e a sua cor pro
            jogador do mês.
          </span>
          <span className="pt-1 font-semibold">Design da carta</span>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {ORDEM_RARIDADE.filter((r) => r !== "destaque" && r !== "mes").map((r) => {
              const liberada = info.desbloqueadas.includes(r);
              const ativa = cartaFinal(info, estilo) === r;
              return (
                <button
                  key={r}
                  type="button"
                  disabled={!liberada}
                  onClick={() => escolherEstilo(r)}
                  aria-pressed={ativa}
                  title={liberada ? ESTILOS[r].label : `Bloqueada: ${LIBERA[r] ?? "jogue mais peladas"}`}
                  className={`flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl p-1 text-[10px] font-bold ${ativa ? "bg-roxo-suave ring-2 ring-roxo" : ""} ${liberada ? "" : "opacity-40"}`}
                >
                  <span className="h-14 w-10 rounded-md" style={{ background: ESTILOS[r].bg(cor || "#C8102E") }} />
                  {liberada ? ESTILOS[r].label.split(" ")[0] : "🔒"}
                </button>
              );
            })}
          </div>
          <span className="text-xs text-apagado">
            Especiais: artilheiro, garçom, muralha e lenda (craque) liberam quando você ganha a medalha. Destaque da semana e jogador do mês aparecem sozinhos.
          </span>
          <span className="pt-1 font-semibold">Cor escolhida pro jogador do mês</span>
          <div className="flex flex-wrap gap-2">
            {CORES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor ${c}`}
                aria-pressed={cor === c}
                onClick={() => escolherCor(c)}
                className={`h-9 w-9 rounded-full border-2 ${cor === c ? "border-tinta" : "border-white"}`}
                style={{ background: c, boxShadow: "0 0 0 1px #E6E1EF" }}
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Link href="/perfil" className="flex h-11 items-center justify-center rounded-xl border border-borda bg-white text-sm font-semibold">
          Trocar foto
        </Link>
        <Link href="/perfil" className="flex h-11 items-center justify-center rounded-xl border border-borda bg-white text-sm font-semibold">
          Editar apelido
        </Link>
        <button type="button" onClick={() => imagem("baixar")} className="h-12 rounded-xl border-2 border-noite bg-white font-semibold">
          Baixar card
        </button>
        <button type="button" onClick={() => imagem("compartilhar")} className="h-12 rounded-xl bg-roxo font-semibold text-white">
          Compartilhar
        </button>
      </div>
      {aviso && <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{aviso}</p>}

      {pacote && info && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-noite/95 p-6 text-white" onClick={() => setPacote(null)}>
          {pacote === "fechado" ? (
            <>
              <span className="font-display text-2xl font-bold">Você subiu de nível!</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPacote("aberto");
                }}
                className="pacote-tremer flex h-72 w-52 flex-col items-center justify-center gap-2 rounded-3xl border-2 border-roxo-claro bg-gradient-to-br from-roxo to-roxo-escuro text-lg font-bold shadow-2xl"
              >
                <span className="text-5xl">🎁</span>
                Toca pra abrir
              </button>
            </>
          ) : (
            <>
              <div className="relative">
                <div className="pacote-brilho absolute inset-0 rounded-full bg-roxo-claro/60 blur-2xl" />
                <div className="pacote-revelar relative">{carta}</div>
              </div>
              <span className="font-display text-2xl font-bold">Nova carta: {ESTILOS[info.raridade].label.toLowerCase()}</span>
              <span className="text-sm text-[#CFC7E0]">Toca em qualquer lugar pra fechar</span>
            </>
          )}
        </div>
      )}
    </main>
  );
}
