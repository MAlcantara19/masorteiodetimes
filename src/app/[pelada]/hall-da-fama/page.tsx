"use client";
// Hall da fama: os números de todos os tempos da pelada, guardados pra sempre.
// Artilheiros, garçons, quem mais jogou, recordes e o artilheiro de cada mês. Nunca mostra notas.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { nomeCurto, usePelada, type Membro, elencoRapido } from "@/lib/pelada";
import { calcularEstatisticas, carregarPeriodo, vencedorDe, type DadosPeriodo, type Linha } from "@/lib/estatisticas";
import { curtaDia, deIso, nomeMes } from "@/lib/datas";
import { NOMES_TIMES } from "@/lib/evento";
import Topo, { Carregando } from "@/components/Topo";

const MEDALHA = ["🥇", "🥈", "🥉"];

function Top({ titulo, emoji, lista, nome, slug, unidade }: { titulo: string; emoji: string; lista: [string, number][]; nome: (id: string) => string; slug: string; unidade: string }) {
  if (!lista.length) return null;
  return (
    <section className="flex flex-col gap-1.5 rounded-2xl border border-borda bg-white p-4">
      <span className="font-semibold">
        {emoji} {titulo}
      </span>
      {lista.map(([id, n], i) => (
        <Link key={id} href={`/${slug}/jogador/${id}`} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${i === 0 ? "bg-roxo-suave" : ""}`}>
          <span className="w-6 text-center">{MEDALHA[i] ?? <span className="text-sm text-apagado">{i + 1}º</span>}</span>
          <span className={`flex-1 truncate ${i === 0 ? "font-display text-lg font-bold" : ""}`}>{nome(id)}</span>
          <span className="tabular-nums">
            <strong>{n}</strong> <span className="text-xs text-apagado">{n === 1 ? unidade.replace(/s$/, "") : unidade}</span>
          </span>
        </Link>
      ))}
    </section>
  );
}

export default function HallDaFamaPage() {
  const { pelada, slug, naoAchou } = usePelada();
  const [d, setD] = useState<DadosPeriodo | null>(null);
  const [elenco, setElenco] = useState<Membro[]>([]);

  useEffect(() => {
    if (!pelada) return;
    elencoRapido(pelada.id, setElenco);
    carregarPeriodo(pelada.id).then(setD);
  }, [pelada]);

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const nome = (id: string) => (porId.get(id) ? nomeCurto(porId.get(id) as Membro) : "?");

  const calc = useMemo(() => {
    if (!d) return null;
    const est = [...calcularEstatisticas(d).values()];
    const top = (f: (l: Linha) => number, n = 5): [string, number][] =>
      est
        .filter((l) => f(l) > 0)
        .sort((a, b) => f(b) - f(a))
        .slice(0, n)
        .map((l) => [l.membro_id, f(l)]);

    const dataDo = new Map(d.eventos.map((e) => [e.id, e.data]));
    const encerradas = d.partidas.filter((p) => p.status === "encerrada");
    // Maior goleada e jogo com mais gols
    const goleada = [...encerradas].sort((a, b) => Math.abs(b.placar_a - b.placar_b) - Math.abs(a.placar_a - a.placar_b) || b.placar_a + b.placar_b - (a.placar_a + a.placar_b))[0];
    const maisGols = [...encerradas].sort((a, b) => b.placar_a + b.placar_b - (a.placar_a + a.placar_b))[0];
    // Mais gols num jogo e num dia
    const porJogo = new Map<string, number>();
    const porDia = new Map<string, number>();
    const eventoDa = new Map(d.partidas.map((p) => [p.id, p.evento_id]));
    for (const l of d.lances) {
      if (l.desfeito || l.tipo !== "gol" || !l.autor_id) continue;
      porJogo.set(`${l.partida_id}|${l.autor_id}`, (porJogo.get(`${l.partida_id}|${l.autor_id}`) ?? 0) + 1);
      const ev = eventoDa.get(l.partida_id);
      if (ev) porDia.set(`${ev}|${l.autor_id}`, (porDia.get(`${ev}|${l.autor_id}`) ?? 0) + 1);
    }
    const recJogo = [...porJogo].sort((a, b) => b[1] - a[1])[0];
    const recDia = [...porDia].sort((a, b) => b[1] - a[1])[0];
    // Maior sequência de vitórias de um jogador
    const sorteioDo = new Map(d.sorteios.map((s) => [s.evento_id, s]));
    const ordemEv = new Map(d.eventos.map((e, i) => [e.id, i]));
    const seq = new Map<string, { atual: number; max: number }>();
    for (const p of [...encerradas].sort((a, b) => (ordemEv.get(a.evento_id) ?? 0) - (ordemEv.get(b.evento_id) ?? 0) || a.numero - b.numero)) {
      const s = sorteioDo.get(p.evento_id);
      if (!s) continue;
      const v = vencedorDe(p);
      for (const t of [p.time_a, p.time_b]) {
        for (const id of s.times[t] ?? []) {
          const x = seq.get(id) ?? { atual: 0, max: 0 };
          x.atual = v === t ? x.atual + 1 : 0;
          x.max = Math.max(x.max, x.atual);
          seq.set(id, x);
        }
      }
    }
    const recSeq = [...seq].sort((a, b) => b[1].max - a[1].max)[0];
    // Artilheiro de cada mês (galeria)
    const meses = new Map<string, Map<string, number>>();
    for (const [k, n] of porDia) {
      const [ev, id] = k.split("|");
      const mes = (dataDo.get(ev) ?? "").slice(0, 7);
      if (!mes) continue;
      const m = meses.get(mes) ?? new Map<string, number>();
      m.set(id, (m.get(id) ?? 0) + n);
      meses.set(mes, m);
    }
    const galeria = [...meses]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([mes, m]) => {
        const max = Math.max(...m.values());
        return { mes, ids: [...m].filter(([, n]) => n === max).map(([id]) => id), gols: max };
      });

    return {
      artilheiros: top((l) => l.gols, 10),
      garcons: top((l) => l.assist),
      jogos: top((l) => l.jogos),
      peladas: top((l) => l.peladas),
      vitorias: top((l) => l.vitorias),
      paredoes: top((l) => l.goleiro.semSofrer, 3),
      craques: top((l) => l.votos.craque, 3),
      goleada,
      maisGols,
      recJogo,
      recDia,
      recSeq,
      galeria,
      dataDo,
      dias: d.eventos.filter((e) => d.partidas.some((p) => p.evento_id === e.id)).length,
      totalGols: d.lances.filter((l) => !l.desfeito).length,
      desde: d.eventos[0]?.data,
    };
  }, [d]);

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada) return <Carregando />;

  const jogoTxt = (p: NonNullable<typeof calc>["goleada"]) =>
    p ? `${NOMES_TIMES[p.time_a]} ${p.placar_a} × ${p.placar_b} ${NOMES_TIMES[p.time_b]} · ${curtaDia(calc!.dataDo.get(p.evento_id) ?? "")}` : "—";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Hall da fama" sub={pelada.nome} voltar="/" />

      {!calc ? (
        <Carregando texto="Abrindo o museu…" />
      ) : (
        <>
          <section className="flex flex-col items-center gap-1 rounded-3xl bg-gradient-to-br from-[var(--marca-luz)] via-[var(--marca)] to-[var(--marca-escuro)] p-5 text-center text-white">
            <span className="text-4xl">🏛️</span>
            <span className="font-display text-2xl font-bold">{pelada.nome}</span>
            <span className="text-sm text-white/80">{calc.desde ? `desde ${curtaDia(calc.desde)}` : "a história começa no primeiro jogo"}</span>
            <div className="mt-2 grid w-full grid-cols-2 gap-2">
              <div className="rounded-2xl bg-white/15 py-2">
                <div className="font-display text-2xl font-bold">{calc.dias}</div>
                <div className="text-xs">peladas</div>
              </div>
              <div className="rounded-2xl bg-white/15 py-2">
                <div className="font-display text-2xl font-bold">{calc.totalGols}</div>
                <div className="text-xs">gols</div>
              </div>
            </div>
          </section>

          <Top titulo="Artilheiros de todos os tempos" emoji="⚽" lista={calc.artilheiros} nome={nome} slug={slug} unidade="gols" />

          <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4 text-sm">
            <span className="font-semibold">📜 Recordes</span>
            {[
              ["Maior goleada", jogoTxt(calc.goleada)],
              ["Jogo com mais gols", jogoTxt(calc.maisGols)],
              ["Mais gols num jogo", calc.recJogo ? `${nome(calc.recJogo[0].split("|")[1])} · ${calc.recJogo[1]} gols` : "—"],
              ["Mais gols numa pelada", calc.recDia ? `${nome(calc.recDia[0].split("|")[1])} · ${calc.recDia[1]} gols` : "—"],
              ["Mais vitórias seguidas", calc.recSeq && calc.recSeq[1].max > 1 ? `${nome(calc.recSeq[0])} · ${calc.recSeq[1].max} seguidas` : "—"],
            ].map(([t, v]) => (
              <div key={t} className="flex justify-between gap-3 border-b border-borda pb-1.5 last:border-0 last:pb-0">
                <span className="text-apagado">{t}</span>
                <span className="text-right font-semibold">{v}</span>
              </div>
            ))}
          </section>

          <Top titulo="Garçons" emoji="🎯" lista={calc.garcons} nome={nome} slug={slug} unidade="assist." />
          <Top titulo="Mais vitórias" emoji="🏆" lista={calc.vitorias} nome={nome} slug={slug} unidade="vitórias" />
          <Top titulo="Quem mais jogou" emoji="👟" lista={calc.jogos} nome={nome} slug={slug} unidade="jogos" />
          <Top titulo="Mais presente" emoji="📅" lista={calc.peladas} nome={nome} slug={slug} unidade="peladas" />
          <Top titulo="Paredões (jogos sem sofrer gol)" emoji="🧤" lista={calc.paredoes} nome={nome} slug={slug} unidade="jogos" />
          <Top titulo="Mais votado craque" emoji="⭐" lista={calc.craques} nome={nome} slug={slug} unidade="votos" />

          {calc.galeria.length > 0 && (
            <section className="flex flex-col gap-1.5 rounded-2xl border border-borda bg-white p-4 text-sm">
              <span className="font-semibold">🖼️ Galeria dos artilheiros do mês</span>
              {calc.galeria.map((g) => (
                <div key={g.mes} className="flex justify-between gap-3">
                  <span className="text-apagado capitalize">
                    {nomeMes(deIso(`${g.mes}-15`))} {g.mes.slice(0, 4)}
                  </span>
                  <span className="text-right font-semibold">
                    {g.ids.map(nome).join(" e ")} · {g.gols}
                  </span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
