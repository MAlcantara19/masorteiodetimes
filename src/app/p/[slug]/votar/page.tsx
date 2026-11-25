"use client";
// Votação do dia: craque, bagre e melhor goleiro. 1 voto por pessoa logada em cada categoria.
// A galera vê só a contagem; os admins veem quem votou em quem.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { nomeCurto, usePelada, type Membro, elencoRapido } from "@/lib/pelada";
import { carregarPresencas, carregarSorteios, type Evento } from "@/lib/evento";
import { curtaDia, horaDe } from "@/lib/datas";
import { Carregando } from "@/components/Topo";
import Capa from "@/components/Capa";

type Votacao = { id: string; categoria: "craque" | "bagre" | "goleiro"; abre: string; fecha: string };
type Contagem = { categoria: string; votado_id: string; votos: number };
type VotoAdmin = { votacao_id: string; eleitor_id: string; votado_id: string };

const CATEGORIAS = [
  { id: "craque" as const, titulo: "Craque do dia", ico: "⭐", sub: "quem jogou mais" },
  { id: "bagre" as const, titulo: "Bagre do dia", ico: "🐟", sub: "na brincadeira, sem maldade" },
  { id: "goleiro" as const, titulo: "Melhor goleiro", ico: "🧤", sub: "só goleiro de verdade" },
];

export default function VotarPage() {
  const { pelada, slug, naoAchou } = usePelada();
  const { carregando, usuario, ehAdmin } = useSessao();
  const admin = !!usuario && !!pelada && ehAdmin(pelada.id);
  const [evento, setEvento] = useState<Evento | null | undefined>(undefined);
  const [votacoes, setVotacoes] = useState<Votacao[]>([]);
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [jogaram, setJogaram] = useState<string[]>([]);
  const [goleiros, setGoleiros] = useState<string[]>([]);
  const [contagem, setContagem] = useState<Contagem[]>([]);
  const [meus, setMeus] = useState<Record<string, string>>({});
  const [todos, setTodos] = useState<VotoAdmin[]>([]);
  const [nomesEleitores, setNomesEleitores] = useState<Record<string, string>>({});
  const [agora, setAgora] = useState(0);

  const carregar = useCallback(async () => {
    if (!pelada) return;
    const sb = criarClienteSupabase();
    // Última pelada com votação.
    const { data: vs } = await sb
      .from("votacoes")
      .select("id, categoria, abre, fecha, eventos!inner(id, pelada_id, data, status, horario, lista_texto, iniciado_em, encerrado_em, created_at)")
      .eq("eventos.pelada_id", pelada.id)
      .order("abre", { ascending: false })
      .limit(3);
    const lista = (vs ?? []) as unknown as (Votacao & { eventos: Evento })[];
    const ev = lista[0]?.eventos ?? null;
    setEvento(ev);
    setAgora(Date.now());
    if (!ev) return;
    setVotacoes(lista.filter((v) => v.eventos.id === ev.id));
    const [sorteios, pres, { data: c }] = await Promise.all([carregarSorteios(ev.id), carregarPresencas(ev.id), sb.rpc("contagem_votos", { p_evento: ev.id })]);
    const s = sorteios.find((x) => x.oficial) ?? sorteios[sorteios.length - 1];
    const gks = [...new Set([...((s?.goleiros ?? []).filter(Boolean) as string[]), ...pres.filter((p) => p.goleiro && p.status !== "saiu").map((p) => p.membro_id)])];
    setGoleiros(gks);
    setJogaram([...new Set([...(s?.times.flat() ?? []), ...gks])]);
    setContagem(((c ?? []) as Contagem[]).map((x) => ({ ...x, votos: Number(x.votos) })));
    const ids = lista.filter((v) => v.eventos.id === ev.id).map((v) => v.id);
    if (usuario) {
      const { data: vv } = await sb.from("votos").select("votacao_id, eleitor_id, votado_id").in("votacao_id", ids);
      const linhas = (vv ?? []) as VotoAdmin[];
      const m: Record<string, string> = {};
      linhas.filter((x) => x.eleitor_id === usuario.id).forEach((x) => (m[x.votacao_id] = x.votado_id));
      setMeus(m);
      setTodos(linhas); // o banco só devolve os de todo mundo pra admin
      const eleitores = [...new Set(linhas.map((x) => x.eleitor_id))];
      if (eleitores.length) {
        const { data: pp } = await sb.from("perfis_publicos").select("id, nome, apelido").in("id", eleitores);
        setNomesEleitores(Object.fromEntries((pp ?? []).map((p) => [p.id, p.apelido || p.nome])));
      }
    }
  }, [pelada, usuario]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!carregando) carregar();
    if (pelada) elencoRapido(pelada.id, setElenco);
  }, [carregar, carregando, pelada]);

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const nome = (id: string) => (porId.get(id) ? nomeCurto(porId.get(id) as Membro) : "?");
  const euMembro = elenco.find((m) => m.profile_id && m.profile_id === usuario?.id)?.id;

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando || evento === undefined) return <Carregando />;

  async function votar(v: Votacao, membroId: string) {
    if (!usuario) return;
    setMeus({ ...meus, [v.id]: membroId });
    const { error } = await criarClienteSupabase().from("votos").upsert({ votacao_id: v.id, eleitor_id: usuario.id, votado_id: membroId });
    if (error) alert("Não deu pra votar: a votação pode ter fechado.");
    carregar();
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Capa titulo="Votação" sub={`${pelada.nome}${evento ? ` · pelada de ${curtaDia(evento.data)}` : ""}`} voltar={`/p/${slug}`} logo={pelada.logo_url} />

      {!evento && <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">A votação abre quando o admin encerra a pelada.</p>}

      {evento && !usuario && (
        <Link href={`/entrar?volta=/p/${slug}/votar`} className="flex h-14 items-center justify-center rounded-2xl bg-roxo text-lg font-bold text-white">
          Entrar pra votar
        </Link>
      )}

      {evento &&
        CATEGORIAS.map((cat) => {
          const v = votacoes.find((x) => x.categoria === cat.id);
          if (!v) return null;
          const aberta = agora >= new Date(v.abre).getTime() && agora <= new Date(v.fecha).getTime();
          const opcoes = cat.id === "goleiro" ? goleiros : jogaram;
          const cont = contagem.filter((c) => c.categoria === cat.id);
          const total = cont.reduce((s, c) => s + c.votos, 0);
          return (
            <section key={cat.id} className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="flex flex-col">
                  <span className="font-display text-lg font-bold">
                    {cat.ico} {cat.titulo}
                  </span>
                  <span className="text-[13px] text-apagado">{cat.sub}</span>
                </span>
                <span className="text-right text-xs text-apagado">
                  {aberta ? `até ${horaDe(v.fecha)}` : "fechada"}
                  <br />
                  {total} {total === 1 ? "voto" : "votos"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {opcoes
                  .filter((id) => !/^RESERVA( \d+)?$/.test(nome(id)))
                  .map((id) => ({ id, votos: cont.find((c) => c.votado_id === id)?.votos ?? 0 }))
                  .sort((a, b) => (aberta ? nome(a.id).localeCompare(nome(b.id)) : b.votos - a.votos))
                  .map(({ id, votos }) => {
                    const meu = meus[v.id] === id;
                    const pct = total ? (votos / total) * 100 : 0;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={!usuario || !aberta || id === euMembro}
                        onClick={() => votar(v, id)}
                        aria-pressed={meu}
                        className={`relative flex h-12 items-center justify-between overflow-hidden rounded-xl border px-3 text-left text-sm font-semibold disabled:cursor-default ${meu ? "border-roxo text-roxo-escuro" : "border-borda"}`}
                      >
                        <span className="absolute inset-y-0 left-0 bg-roxo-suave" style={{ width: `${pct}%` }} />
                        <span className="relative truncate">
                          {meu ? "✓ " : ""}
                          {nome(id)}
                        </span>
                        <span className="relative text-xs tabular-nums text-apagado">{votos || ""}</span>
                      </button>
                    );
                  })}
              </div>
              {admin && todos.filter((t) => t.votacao_id === v.id).length > 0 && (
                <details className="text-[13px] text-apagado">
                  <summary className="cursor-pointer font-semibold text-roxo">Quem votou em quem (só admin)</summary>
                  <ul className="mt-1">
                    {todos
                      .filter((t) => t.votacao_id === v.id)
                      .map((t) => (
                        <li key={t.eleitor_id}>
                          {nomesEleitores[t.eleitor_id] ?? "alguém"} → {nome(t.votado_id)}
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </section>
          );
        })}

      <Link href={`/p/${slug}/avaliar`} className="flex h-12 items-center justify-center rounded-xl border border-roxo bg-white font-semibold text-roxo">
        Avaliar a pelada
      </Link>
    </main>
  );
}
