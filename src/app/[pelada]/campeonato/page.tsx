"use client";
// Campeonato da pelada: semana e mês, prêmios, tabela de pontos (3 por vitória + 1 por gol),
// disputa dos goleiros (quem é de linha e foi pro gol aparece separado) e recordes.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { calcularEstatisticas, carregarPeriodo, lideres, premioPorDias, type DadosPeriodo, type Linha } from "@/lib/estatisticas";
import { curtaDia, inicioMes, inicioSemana, isoDia, nomeMes, deIso } from "@/lib/datas";
import { Escolha } from "@/components/Folha";
import Topo, { Carregando } from "@/components/Topo";
import { GraficoBarras, GraficoColunas } from "@/components/Graficos";

type Periodo = "semana" | "mes";

function intervalo(p: Periodo, desloc: number): { desde: string; ate: string; rotulo: string } {
  const hoje = new Date();
  if (p === "semana") {
    const ini = deIso(inicioSemana(hoje));
    ini.setDate(ini.getDate() + desloc * 7);
    const fim = new Date(ini);
    fim.setDate(fim.getDate() + 6);
    return { desde: isoDia(ini), ate: isoDia(fim), rotulo: `${curtaDia(isoDia(ini))} a ${curtaDia(isoDia(fim))}` };
  }
  const ini = new Date(hoje.getFullYear(), hoje.getMonth() + desloc, 1, 12);
  const fim = new Date(ini.getFullYear(), ini.getMonth() + 1, 0, 12);
  return { desde: inicioMes(ini), ate: isoDia(fim), rotulo: `${nomeMes(ini)} ${ini.getFullYear()}` };
}

export default function CampeonatoPage() {
  const { pelada, slug, naoAchou } = usePelada();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [desloc, setDesloc] = useState(0);
  const [d, setD] = useState<DadosPeriodo | null>(null);
  const [historico, setHistorico] = useState<DadosPeriodo | null>(null);
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [duelo, setDuelo] = useState<[string, string]>(["", ""]);
  const iv = intervalo(periodo, desloc);

  useEffect(() => {
    if (!pelada) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setD(null);
    carregarPeriodo(pelada.id, iv.desde, iv.ate).then(setD);
  }, [pelada, iv.desde, iv.ate]);

  useEffect(() => {
    if (!pelada) return;
    carregarElenco(pelada.id, false).then(setElenco);
    carregarPeriodo(pelada.id).then(setHistorico);
  }, [pelada]);

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const nome = (id: string) => (porId.get(id) ? nomeCurto(porId.get(id) as Membro) : "?");
  const nomes = (ids: string[]) => (ids.length ? ids.map(nome).join(" e ") : "—");

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada) return <Carregando />;

  const est = d ? calcularEstatisticas(d) : new Map<string, Linha>();
  const linhas = [...est.values()];
  const tabela = linhas.filter((l) => l.jogos > 0).sort((a, b) => b.pontos - a.pontos || b.vitorias - a.vitorias || b.gols - a.gols);
  const goleiros = linhas.filter((l) => l.goleiro.jogos > 0).sort((a, b) => a.goleiro.sofridos / a.goleiro.jogos - b.goleiro.sofridos / b.goleiro.jogos);
  const linhaNoGol = linhas.filter((l) => l.linhaNoGol.jogos > 0);
  const art = lideres(linhas, (l) => l.gols);
  const gar = lideres(linhas, (l) => l.assist);
  const vit = lideres(linhas, (l) => l.vitorias);
  const premios = d
    ? [
        { ico: "⭐", rotulo: "Craque", quem: premioPorDias(d, "craque"), extra: "mais vezes craque do dia" },
        { ico: "⚽", rotulo: "Artilheiro", quem: art.ids, extra: art.valor ? `${art.valor} gols` : "" },
        { ico: "👟", rotulo: "Garçom", quem: gar.ids, extra: gar.valor ? `${gar.valor} assist.` : "" },
        { ico: "🐟", rotulo: "Bagre", quem: premioPorDias(d, "bagre"), extra: "na zoeira" },
        { ico: "🏅", rotulo: "Mais vitorioso", quem: vit.ids, extra: vit.valor ? `"joga comigo que é vitória" · ${vit.valor}V` : "" },
      ]
    : [];

  // Recordes de todos os tempos
  const recordes: { rotulo: string; valor: string }[] = [];
  if (historico) {
    const h = calcularEstatisticas(historico);
    const hl = [...h.values()];
    const artH = lideres(hl, (l) => l.gols);
    if (artH.ids.length) recordes.push({ rotulo: "Artilheiro de todos os tempos", valor: `${nomes(artH.ids)} · ${artH.valor} gols` });
    const pel = lideres(hl, (l) => l.peladas);
    if (pel.ids.length) recordes.push({ rotulo: "Mais peladas", valor: `${nomes(pel.ids)} · ${pel.valor}` });
    let goleada: { dif: number; txt: string } = { dif: 0, txt: "" };
    for (const p of historico.partidas) {
      const dif = Math.abs(p.placar_a - p.placar_b);
      if (dif > goleada.dif) {
        const e = historico.eventos.find((x) => x.id === p.evento_id);
        goleada = { dif, txt: `${Math.max(p.placar_a, p.placar_b)} a ${Math.min(p.placar_a, p.placar_b)} em ${e ? curtaDia(e.data) : "?"}` };
      }
    }
    if (goleada.dif) recordes.push({ rotulo: "Maior goleada", valor: goleada.txt });
    // Mais gols de um jogador num dia
    let dia = { n: 0, txt: "" };
    for (const e of historico.eventos) {
      const pids = new Set(historico.partidas.filter((p) => p.evento_id === e.id).map((p) => p.id));
      const cont = new Map<string, number>();
      historico.lances.filter((l) => pids.has(l.partida_id) && l.tipo === "gol" && l.autor_id).forEach((l) => cont.set(l.autor_id as string, (cont.get(l.autor_id as string) ?? 0) + 1));
      for (const [id, n] of cont) if (n > dia.n) dia = { n, txt: `${nome(id)} · ${n} gols em ${curtaDia(e.data)}` };
    }
    if (dia.n) recordes.push({ rotulo: "Mais gols num dia", valor: dia.txt });
    const jogos = historico.partidas.filter((p) => p.status === "encerrada").length;
    recordes.push({ rotulo: "Jogos registrados", valor: `${jogos} em ${historico.eventos.length} peladas` });
  }

  const g1 = duelo[0] ? est.get(duelo[0]) : null;
  const g2 = duelo[1] ? est.get(duelo[1]) : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Campeonato" sub={pelada.nome} voltar="/mais" />

      <div className="flex items-center justify-between gap-2">
        <Escolha
          rotulo="Período"
          valor={periodo}
          aoMudar={(v) => {
            setPeriodo(v);
            setDesloc(0);
          }}
          opcoes={[{ valor: "semana", rotulo: "Semana" }, { valor: "mes", rotulo: "Mês" }]}
        />
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Anterior" onClick={() => setDesloc(desloc - 1)} className="h-10 w-10 rounded-xl border border-borda bg-white">
            ‹
          </button>
          <span className="min-w-[110px] text-center text-sm font-semibold">{iv.rotulo}</span>
          <button type="button" aria-label="Próximo" disabled={desloc >= 0} onClick={() => setDesloc(desloc + 1)} className="h-10 w-10 rounded-xl border border-borda bg-white disabled:opacity-30">
            ›
          </button>
        </div>
      </div>

      {!d && <Carregando />}
      {d && !tabela.length && <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">Nenhum jogo nesse período.</p>}

      {d && tabela.length > 0 && (
        <>
          <section className="grid grid-cols-2 gap-2">
            {premios.map((p, i) => (
              <div key={p.rotulo} className={`flex flex-col gap-0.5 rounded-2xl p-3 ${i === 0 ? "col-span-2 bg-noite text-white" : "border border-borda bg-white"}`}>
                <span className={`text-xs ${i === 0 ? "text-roxo-claro" : "text-apagado"}`}>
                  {p.ico} {p.rotulo}
                </span>
                <span className={`font-semibold ${i === 0 ? "font-display text-2xl" : ""}`}>{nomes(p.quem)}</span>
                <span className={`text-xs ${i === 0 ? "text-[#CFC7E0]" : "text-apagado"}`}>{p.quem.length ? p.extra : ""}</span>
              </div>
            ))}
          </section>

          <GraficoBarras
            titulo="ARTILHARIA"
            unidade="gols"
            itens={[...linhas].filter((l) => l.gols > 0).sort((a, b) => b.gols - a.gols).slice(0, 8).map((l) => ({ rotulo: nome(l.membro_id), valor: l.gols, detalhe: `${l.assist} assist. em ${l.jogos} jogos` }))}
          />
          <GraficoBarras
            titulo="MAIS VITÓRIAS"
            unidade="vitórias"
            itens={[...linhas].filter((l) => l.vitorias > 0).sort((a, b) => b.vitorias - a.vitorias).slice(0, 8).map((l) => ({ rotulo: nome(l.membro_id), valor: l.vitorias, detalhe: `${l.jogos ? Math.round((l.vitorias / l.jogos) * 100) : 0}% de aproveitamento` }))}
          />
          {d.eventos.length > 1 && (
            <GraficoColunas
              titulo="GOLS POR PELADA"
              unidade="gols"
              itens={d.eventos.map((e) => {
                const pids = new Set(d.partidas.filter((p) => p.evento_id === e.id).map((p) => p.id));
                const jogos = pids.size;
                return { rotulo: curtaDia(e.data), valor: d.lances.filter((l) => pids.has(l.partida_id)).length, detalhe: `${jogos} jogos` };
              })}
            />
          )}

          <section className="flex flex-col rounded-2xl border border-borda bg-white p-3">
            <span className="px-1 pb-2 text-xs font-bold tracking-wider text-apagado">TABELA · 3 POR VITÓRIA + 1 POR GOL</span>
            <div className="grid grid-cols-[24px_1fr_32px_32px_32px_32px_40px] gap-1 px-1 pb-1 text-[11px] font-bold text-apagado">
              <span>#</span>
              <span>Jogador</span>
              <span className="text-center">J</span>
              <span className="text-center">V</span>
              <span className="text-center">G</span>
              <span className="text-center">A</span>
              <span className="text-right">Pts</span>
            </div>
            {tabela.map((l, i) => (
              <Link
                key={l.membro_id}
                href={`/${slug}/jogador/${l.membro_id}`}
                className="grid grid-cols-[24px_1fr_32px_32px_32px_32px_40px] items-center gap-1 border-t border-borda px-1 py-2 text-sm"
              >
                <span className="font-display font-bold text-apagado">{i + 1}</span>
                <span className="truncate font-semibold">
                  {nome(l.membro_id)}
                  {porId.get(l.membro_id)?.convidado && <span className="ml-1 text-[10px] text-alerta-escuro">conv.</span>}
                </span>
                <span className="text-center tabular-nums">{l.jogos}</span>
                <span className="text-center tabular-nums">{l.vitorias}</span>
                <span className="text-center tabular-nums">{l.gols}</span>
                <span className="text-center tabular-nums">{l.assist}</span>
                <span className="text-right font-display font-bold tabular-nums">{l.pontos}</span>
              </Link>
            ))}
          </section>

          <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
            <span className="text-xs font-bold tracking-wider text-apagado">🧤 DISPUTA DOS GOLEIROS</span>
            {goleiros.map((l, i) => (
              <div key={l.membro_id} className="flex items-center justify-between text-sm">
                <span className="font-semibold">
                  {i + 1}. {nome(l.membro_id)}
                </span>
                <span className="tabular-nums text-apagado">
                  {(l.goleiro.sofridos / l.goleiro.jogos).toFixed(1).replace(".", ",")} sofridos/jogo · {l.goleiro.semSofrer} sem sofrer · {l.goleiro.jogos}J
                </span>
              </div>
            ))}
            {!goleiros.length && <span className="text-sm text-apagado">Nenhum goleiro registrado no período.</span>}
            {goleiros.length >= 2 && (
              <div className="flex flex-col gap-2 border-t border-borda pt-3">
                <span className="text-sm font-semibold">Duelo</span>
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1].map((k) => (
                    <select
                      key={k}
                      value={duelo[k]}
                      onChange={(e) => setDuelo(k === 0 ? [e.target.value, duelo[1]] : [duelo[0], e.target.value])}
                      className="h-10 rounded-xl border border-borda bg-white px-2 text-sm"
                    >
                      <option value="">Escolher</option>
                      {goleiros.map((g) => (
                        <option key={g.membro_id} value={g.membro_id}>
                          {nome(g.membro_id)}
                        </option>
                      ))}
                    </select>
                  ))}
                </div>
                {g1 && g2 && (
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-1 text-center text-sm">
                    {(
                      [
                        ["Jogos", g1.goleiro.jogos, g2.goleiro.jogos, false],
                        ["Sofridos/jogo", g1.goleiro.sofridos / g1.goleiro.jogos, g2.goleiro.sofridos / g2.goleiro.jogos, true],
                        ["Sem sofrer", g1.goleiro.semSofrer, g2.goleiro.semSofrer, false],
                        ["Vitórias", g1.vitorias, g2.vitorias, false],
                      ] as [string, number, number, boolean][]
                    ).map(([r, a, b, menor]) => {
                      const melhorA = menor ? a < b : a > b;
                      const melhorB = menor ? b < a : b > a;
                      const f = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));
                      return [
                        <span key={r + "a"} className={melhorA ? "font-bold text-roxo" : ""}>{f(a)}</span>,
                        <span key={r} className="text-xs text-apagado">{r}</span>,
                        <span key={r + "b"} className={melhorB ? "font-bold text-roxo" : ""}>{f(b)}</span>,
                      ];
                    })}
                  </div>
                )}
              </div>
            )}
            {linhaNoGol.length > 0 && (
              <div className="border-t border-borda pt-2 text-[13px] text-apagado">
                <span className="font-semibold">De linha no gol (não concorre):</span>{" "}
                {linhaNoGol.map((l) => `${nome(l.membro_id)} (${l.linhaNoGol.sofridos} em ${l.linhaNoGol.jogos}J)`).join(", ")}
              </div>
            )}
          </section>
        </>
      )}

      {recordes.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
          <span className="text-xs font-bold tracking-wider text-apagado">🏆 RECORDES DA {pelada.nome.toUpperCase()}</span>
          {recordes.map((r) => (
            <div key={r.rotulo} className="flex flex-col text-sm">
              <span className="text-xs text-apagado">{r.rotulo}</span>
              <span className="font-semibold">{r.valor}</span>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
