"use client";
// Fim da pelada: capa do campeão, prêmios do dia, tempo real × com pausas, pendências e mensagem pro Zap.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { eventoAtual, ultimoEvento, CORES_TIMES, NOMES_TIMES, type Evento } from "@/lib/evento";
import { calcularEstatisticas, calcularPremios, carregarPeriodo, duracaoTexto, temposDoDia, vencedorDe, type DadosPeriodo } from "@/lib/estatisticas";
import { curtaDia, DIAS, deIso, horaDe } from "@/lib/datas";
import Topo, { Carregando } from "@/components/Topo";

export default function FimPage() {
  const { pelada, slug, naoAchou } = usePelada();
  const { carregando, ehAdmin } = useSessao();
  const admin = pelada ? ehAdmin(pelada.id) : false;
  const [evento, setEvento] = useState<Evento | null | undefined>(undefined);
  const [d, setD] = useState<DadosPeriodo | null>(null);
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [fechaVotacao, setFechaVotacao] = useState<string | null>(null);
  const [votacaoAberta, setVotacaoAberta] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    if (!pelada) return;
    const ultimo = await ultimoEvento(pelada.id);
    const ev = ultimo?.status === "encerrado" ? ultimo : ((await eventoAtual(pelada.id)) ?? ultimo);
    setEvento(ev);
    if (!ev) return;
    setD(await carregarPeriodo(pelada.id, undefined, undefined, [ev.id]));
    const { data } = await criarClienteSupabase().from("votacoes").select("fecha").eq("evento_id", ev.id).limit(1);
    const fecha = data?.[0]?.fecha ?? null;
    setFechaVotacao(fecha);
    setVotacaoAberta(fecha ? new Date(fecha).getTime() > Date.now() : false);
  }, [pelada]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
    if (pelada) carregarElenco(pelada.id, false).then(setElenco);
  }, [carregar, pelada]);

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const nome = (id: string) => (porId.get(id) ? nomeCurto(porId.get(id) as Membro) : "?");
  const nomes = (ids: string[]) => ids.map(nome).join(" e ");

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando || evento === undefined || (evento && !d)) return <Carregando />;
  if (!evento || !d) return <main className="p-6 text-center text-apagado">Nenhuma pelada registrada ainda.</main>;

  const sorteio = d.sorteios[0];
  const est = calcularEstatisticas(d);
  const pr = calcularPremios(est);
  const encerradas = d.partidas.filter((p) => p.status === "encerrada");
  const placarTimes = (sorteio?.times ?? []).map((_, t) => {
    const jogos = encerradas.filter((p) => p.time_a === t || p.time_b === t);
    const v = jogos.filter((p) => vencedorDe(p) === t).length;
    const e = jogos.filter((p) => vencedorDe(p) === null).length;
    const gp = jogos.reduce((s, p) => s + (p.time_a === t ? p.placar_a : p.placar_b), 0);
    const gc = jogos.reduce((s, p) => s + (p.time_a === t ? p.placar_b : p.placar_a), 0);
    return { t, v, e, der: jogos.length - v - e, saldo: gp - gc };
  });
  const ranking = [...placarTimes].sort((a, b) => b.v - a.v || b.saldo - a.saldo);
  const campeao = ranking[0];
  const tempos = temposDoDia(d.partidas);
  const semAutor = d.lances.filter((l) => l.tipo === "gol" && !l.autor_id).length;
  const semResultado = d.partidas.filter((p) => p.status !== "encerrada").map((p) => p.numero);
  const dt = deIso(evento.data);
  const muralha = pr.muralha.ids.length ? est.get(pr.muralha.ids[0]) : null;

  const golsDe = (ids: string[]) => (ids.length ? est.get(ids[0])?.gols ?? 0 : 0);
  const assistDe = (ids: string[]) => (ids.length ? est.get(ids[0])?.assist ?? 0 : 0);
  const origem = typeof window !== "undefined" ? window.location.origin : "";

  const msg = [
    `⚽ *${pelada.nome.toUpperCase()} · ${curtaDia(evento.data)}*`,
    "",
    campeao && sorteio
      ? `🏆 *Campeão do dia: ${NOMES_TIMES[campeao.t]}* (${campeao.v}V ${campeao.e}E ${campeao.der}D)\n${sorteio.times[campeao.t].map(nome).join(", ")}`
      : "",
    "",
    pr.artilheiro.ids.length ? `⚽ Artilheiro: ${nomes(pr.artilheiro.ids)} (${golsDe(pr.artilheiro.ids)} gols)` : "",
    pr.garcom.ids.length ? `👟 Garçom: ${nomes(pr.garcom.ids)} (${assistDe(pr.garcom.ids)} assistências)` : "",
    muralha ? `🧤 Menos vazado: ${nomes(pr.muralha.ids)} (${muralha.goleiro.sofridos} gols em ${muralha.goleiro.jogos} jogos)` : "",
    pr.craque.ids.length && !votacaoAberta ? `⭐ Craque: ${nomes(pr.craque.ids)}` : "",
    "",
    `📊 ${ranking.map((r) => `${NOMES_TIMES[r.t]}: ${r.v}V`).join(" · ")}`,
    `⏱️ ${encerradas.length} jogos · ${duracaoTexto(tempos.rolando)} de bola rolando`,
    votacaoAberta ? `\n🗳️ Vota no craque e no bagre: ${origem}/p/${slug}/votar` : "",
    `📝 Avalia a pelada: ${origem}/p/${slug}/avaliar`,
  ]
    .filter((x, i, a) => !(x === "" && a[i - 1] === ""))
    .join("\n");

  const cards = [
    { rotulo: "Artilheiro", ico: "⚽", quem: pr.artilheiro.ids, extra: `${golsDe(pr.artilheiro.ids)} gols` },
    { rotulo: "Garçom", ico: "👟", quem: pr.garcom.ids, extra: `${assistDe(pr.garcom.ids)} assist.` },
    { rotulo: "Menos vazado", ico: "🧤", quem: pr.muralha.ids, extra: muralha ? `${muralha.goleiro.sofridos} em ${muralha.goleiro.jogos} jogos` : "" },
    { rotulo: "Craque", ico: "⭐", quem: votacaoAberta ? [] : pr.craque.ids, extra: votacaoAberta ? `votação até ${horaDe(fechaVotacao!)}` : `${pr.craque.valor} votos` },
  ];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-6">
      <Topo titulo="Fim da pelada" sub={`${pelada.nome} · ${DIAS[dt.getDay()].toLowerCase()} ${curtaDia(evento.data)} · ${encerradas.length} jogos`} voltar={`/${slug}/resultados`} />

      {campeao && sorteio && (
        <section className="flex flex-col gap-2 rounded-3xl bg-noite p-5 text-white">
          <span className="text-xs font-bold tracking-wider text-roxo-claro">CAPA · CAMPEÃO DO DIA</span>
          <span className="font-display text-4xl font-bold" style={{ color: CORES_TIMES[campeao.t] === "#7444D6" ? "#C9B2FF" : CORES_TIMES[campeao.t] }}>
            🏆 {NOMES_TIMES[campeao.t]}
          </span>
          <span className="text-sm font-semibold">
            {campeao.v} {campeao.v === 1 ? "vitória" : "vitórias"} · {campeao.e} {campeao.e === 1 ? "empate" : "empates"} · {campeao.der} {campeao.der === 1 ? "derrota" : "derrotas"}
          </span>
          <span className="text-sm text-[#CFC7E0]">
            {sorteio.times[campeao.t].map(nome).join(", ")}
            {sorteio.goleiros?.[campeao.t] ? ` · gol: ${nome(sorteio.goleiros[campeao.t] as string)}` : ""}
          </span>
          <Link href={`/${slug}/banners?tipo=campeao&periodo=dia`} className="mt-1 self-start rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold">
            Baixar banner
          </Link>
        </section>
      )}

      <section className="grid grid-cols-2 gap-2">
        {cards.map((c) => (
          <div key={c.rotulo} className="flex flex-col gap-0.5 rounded-2xl border border-borda bg-white p-3">
            <span className="text-xs text-apagado">
              {c.ico} {c.rotulo}
            </span>
            <span className="font-semibold">{c.quem.length ? nomes(c.quem) : c.rotulo === "Craque" && votacaoAberta ? "em votação" : "—"}</span>
            <span className="text-xs text-apagado">{c.quem.length || c.rotulo === "Craque" ? c.extra : ""}</span>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Bola rolando", tempos.rolando],
          ["Com pausas", tempos.total],
          ["Parado", Math.max(0, tempos.total - tempos.rolando)],
        ].map(([r, v]) => (
          <div key={r as string} className="rounded-2xl border border-borda bg-white p-3">
            <div className="text-[11px] text-apagado">{r}</div>
            <div className="font-display text-lg font-bold">{duracaoTexto(v as number)}</div>
          </div>
        ))}
      </section>

      {admin && (semAutor > 0 || semResultado.length > 0) && (
        <section className="flex items-center gap-2 rounded-xl bg-alerta-suave px-3 py-2.5 text-sm text-alerta-escuro">
          <span className="flex-1">
            <strong>Pendências (opcional):</strong> {semAutor > 0 ? `${semAutor} ${semAutor === 1 ? "gol" : "gols"} sem autor` : ""}
            {semAutor > 0 && semResultado.length ? " · " : ""}
            {semResultado.length ? `jogo ${semResultado.join(", ")} sem resultado` : ""}
          </span>
          <Link href={`/${slug}/resultados`} className="font-semibold underline">
            Resolver
          </Link>
        </section>
      )}

      <section className="flex flex-col gap-1.5 rounded-2xl border border-borda bg-white p-4">
        <span className="text-xs font-bold tracking-wider text-apagado">VITÓRIAS DO DIA</span>
        {ranking.map((r) => (
          <div key={r.t} className="flex items-center justify-between text-sm">
            <span className="font-semibold" style={{ color: CORES_TIMES[r.t] }}>
              {NOMES_TIMES[r.t]}
            </span>
            <span className="tabular-nums text-apagado">
              {r.v}V · {r.e}E · {r.der}D · saldo {r.saldo > 0 ? "+" : ""}
              {r.saldo}
            </span>
          </div>
        ))}
        <span className="pt-1 text-xs text-apagado">Puxado do ao vivo. Esqueceu de marcar algum jogo? Corrige em Resultados.</span>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
        <span className="text-xs font-bold tracking-wider text-apagado">MENSAGEM PRONTA PRO GRUPO</span>
        <div className="rounded-xl bg-[#E7F5EC] p-3 text-[13.5px] leading-relaxed whitespace-pre-line">{msg}</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(msg).then(() => setCopiado(true)).catch(() => {})}
            className="h-12 rounded-xl border-2 border-zap font-semibold text-zap"
          >
            {copiado ? "Copiado!" : "Copiar texto"}
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center rounded-xl bg-zap font-semibold text-white">
            Mandar no Zap
          </a>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Link href={`/p/${slug}/votar`} className="flex h-12 items-center justify-center rounded-xl border border-roxo bg-white font-semibold text-roxo">
          Votação
        </Link>
        <Link href={`/${slug}/campeonato`} className="flex h-12 items-center justify-center rounded-xl border border-roxo bg-white font-semibold text-roxo">
          Campeonato
        </Link>
      </div>
    </main>
  );
}
