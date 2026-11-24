"use client";
// Perfil do jogador: apelido em destaque, nome embaixo, foto, carta, estatísticas, medalhas,
// selo de convidado e comparar com outro jogador. Sem nota/estrelas.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { calcularEstatisticas, premioPorDias, type Linha } from "@/lib/estatisticas";
import { carregarCartas, posicaoCarta, statsCarta, type InfoCarta } from "@/lib/cartas";
import { curtaDia } from "@/lib/datas";
import { POSICOES } from "@/lib/elenco";
import Carta from "@/components/Carta";
import Topo, { Carregando } from "@/components/Topo";
import { GraficoColunas } from "@/components/Graficos";

type Medalha = { tipo: string; periodo: string; valor: number | null };
const NOMES_MEDALHA: Record<string, string> = {
  artilheiro: "⚽ Artilheiro",
  garcom: "👟 Garçom",
  muralha: "🧤 Menos vazado",
  craque: "⭐ Craque",
  bagre: "🐟 Bagre",
  mais_vitorioso: "🏅 Mais vitorioso",
  destaque_semana: "🖤 Destaque da semana",
  jogador_mes: "👑 Jogador do mês",
};

export default function JogadorPage() {
  const { id } = useParams<{ id: string }>();
  const { pelada, slug, naoAchou } = usePelada();
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [cartas, setCartas] = useState<Map<string, InfoCarta> | null>(null);
  const [est, setEst] = useState<Map<string, Linha>>(new Map());
  const [porPelada, setPorPelada] = useState<{ rotulo: string; valor: number; detalhe: string }[]>([]);
  const [medalhas, setMedalhas] = useState<Medalha[]>([]);
  const [foto, setFoto] = useState<{ foto_url: string | null; cor_card: string | null } | null>(null);
  const [outro, setOutro] = useState("");

  useEffect(() => {
    if (!pelada) return;
    carregarElenco(pelada.id, false).then(setElenco);
    carregarCartas(pelada.id).then(({ cartas: c, temporada }) => {
      setCartas(c);
      setEst(calcularEstatisticas(temporada));
      // Gols + assistências em cada pelada da temporada em que jogou.
      setPorPelada(
        temporada.eventos
          .map((e) => {
            const um = calcularEstatisticas({ ...temporada, eventos: [e], partidas: temporada.partidas.filter((p) => p.evento_id === e.id) }).get(id);
            return um && (um.jogos || um.goleiro.jogos) ? { rotulo: curtaDia(e.data), valor: um.gols + um.assist, detalhe: `${um.gols} gols, ${um.assist} assist., ${um.vitorias}V em ${um.jogos || um.goleiro.jogos} jogos` } : null;
          })
          .filter((x): x is { rotulo: string; valor: number; detalhe: string } => !!x)
          .slice(-12),
      );
      // Craque do dia também conta como medalha.
      const craques = temporada.eventos.flatMap((e) =>
        premioPorDias({ ...temporada, eventos: [e] }, "craque").filter((x) => x === id).map(() => ({ tipo: "craque", periodo: e.data, valor: null })),
      );
      criarClienteSupabase()
        .from("medalhas")
        .select("tipo, periodo, valor")
        .eq("membro_id", id)
        .order("periodo", { ascending: false })
        .then(({ data }) => setMedalhas([...craques, ...((data ?? []) as Medalha[])].sort((a, b) => b.periodo.localeCompare(a.periodo))));
    });
  }, [pelada, id]);

  const m = elenco.find((x) => x.id === id);
  useEffect(() => {
    if (!m?.profile_id) return;
    criarClienteSupabase().from("perfis_publicos").select("foto_url, cor_card").eq("id", m.profile_id).maybeSingle().then(({ data }) => setFoto(data));
  }, [m?.profile_id]);

  const porId = useMemo(() => new Map(elenco.map((x) => [x.id, x])), [elenco]);

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || !cartas || !elenco.length) return <Carregando />;
  if (!m) return <main className="p-6 text-center text-apagado">Jogador não encontrado.</main>;

  const info = cartas.get(id);
  const l = est.get(id) ?? null;
  const o = outro ? est.get(outro) ?? null : null;
  const linhasComparar: [string, (x: Linha | null) => number][] = [
    ["Peladas", (x) => x?.peladas ?? 0],
    ["Jogos", (x) => x?.jogos ?? 0],
    ["Vitórias", (x) => x?.vitorias ?? 0],
    ["Gols", (x) => x?.gols ?? 0],
    ["Assistências", (x) => x?.assist ?? 0],
    ["Pontos", (x) => x?.pontos ?? 0],
    ["Votos de craque", (x) => x?.votos.craque ?? 0],
  ];
  const aproveitamento = l && l.jogos ? Math.round((l.vitorias / l.jogos) * 100) : 0;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="" voltar={`/${slug}/campeonato`} />
      <section className="-mt-6 flex flex-col items-center gap-2 text-center">
        <Carta
          apelido={nomeCurto(m)}
          posicao={posicaoCarta(m)}
          pelada={pelada.nome}
          raridade={info?.raridade ?? "bronze"}
          cor={foto?.cor_card}
          foto={foto?.foto_url}
          stats={statsCarta(m, l, info?.medalhasMes ?? 0)}
        />
        <h1 className="pt-2 font-display text-3xl font-bold">{nomeCurto(m)}</h1>
        <span className="text-sm text-apagado">
          {m.apelido && m.apelido !== m.nome ? `${m.nome} · ` : ""}
          {m.goleiro ? "Goleiro" : POSICOES[m.posicao]}
        </span>
        {m.convidado && <span className="rounded-full bg-alerta-suave px-3 py-1 text-xs font-bold text-alerta-escuro">CONVIDADO</span>}
      </section>

      <section className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Peladas", l?.peladas ?? 0],
          ["Jogos", l?.jogos ?? 0],
          ["Aproveit.", `${aproveitamento}%`],
          [m.goleiro ? "Sem sofrer" : "Gols", m.goleiro ? (l?.goleiro.semSofrer ?? 0) : (l?.gols ?? 0)],
          [m.goleiro ? "Sofridos" : "Assist.", m.goleiro ? (l?.goleiro.sofridos ?? 0) : (l?.assist ?? 0)],
          ["Pontos", l?.pontos ?? 0],
        ].map(([r, v]) => (
          <div key={r as string} className="rounded-2xl border border-borda bg-white p-3">
            <div className="font-display text-2xl font-bold">{v}</div>
            <div className="text-xs text-apagado">{r}</div>
          </div>
        ))}
      </section>
      <span className="-mt-2 text-center text-xs text-apagado">Temporada {new Date().getFullYear()}</span>

      {porPelada.length > 1 && !m.goleiro && <GraficoColunas titulo="GOLS + ASSISTÊNCIAS POR PELADA" unidade="participações em gol" itens={porPelada} />}

      <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
        <span className="text-xs font-bold tracking-wider text-apagado">MEDALHAS</span>
        {medalhas.length ? (
          <div className="flex flex-wrap gap-2">
            {medalhas.slice(0, 30).map((x, i) => (
              <span key={i} className="rounded-full bg-roxo-suave px-3 py-1 text-[13px] font-semibold text-roxo-escuro">
                {NOMES_MEDALHA[x.tipo] ?? x.tipo} · {x.periodo.length === 10 ? curtaDia(x.periodo) : x.periodo}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-sm text-apagado">Nenhuma medalha ainda. Bora!</span>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
        <span className="text-xs font-bold tracking-wider text-apagado">COMPARAR</span>
        <select value={outro} onChange={(e) => setOutro(e.target.value)} className="h-11 rounded-xl border border-borda bg-white px-2">
          <option value="">Comparar com…</option>
          {elenco
            .filter((x) => x.id !== id && x.ativo)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {nomeCurto(x)}
              </option>
            ))}
        </select>
        {outro && (
          <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-1.5 text-center text-sm">
            <span className="font-bold">{nomeCurto(m)}</span>
            <span />
            <span className="font-bold">{porId.get(outro) ? nomeCurto(porId.get(outro) as Membro) : ""}</span>
            {linhasComparar.map(([r, f]) => {
              const a = f(l);
              const b = f(o);
              return [
                <span key={r + "a"} className={a > b ? "font-bold text-roxo" : ""}>{a}</span>,
                <span key={r} className="text-xs text-apagado">{r}</span>,
                <span key={r + "b"} className={b > a ? "font-bold text-roxo" : ""}>{b}</span>,
              ];
            })}
          </div>
        )}
      </section>
    </main>
  );
}
