"use client";
// Ranking de presença: quem mais veio no mês/ano, quem está numa sequência boa
// e (só pro admin) quem sumiu, com a mensagem pronta pro Zap.
import { useEffect, useMemo, useState } from "react";
import { useSessao } from "@/lib/sessao";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { carregarPeriodo, filtrarPeriodo, presentesPorDia, type DadosPeriodo } from "@/lib/estatisticas";
import { curtaDia, DIAS, inicioMes, isoDia, proximaPelada } from "@/lib/datas";
import { linkZap } from "@/lib/resumo-zap";
import { Escolha } from "@/components/Folha";
import Topo, { Carregando } from "@/components/Topo";

type Periodo = "mes" | "ano" | "tudo";

export default function PresencaPage() {
  const { pelada, naoAchou } = usePelada();
  const { ehAdmin } = useSessao();
  const admin = !!pelada && ehAdmin(pelada.id);
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [tudo, setTudo] = useState<DadosPeriodo | null>(null);
  const [elenco, setElenco] = useState<Membro[]>([]);

  useEffect(() => {
    if (!pelada) return;
    carregarElenco(pelada.id, false).then(setElenco);
    carregarPeriodo(pelada.id).then(setTudo);
  }, [pelada]);

  const calc = useMemo(() => {
    if (!tudo) return null;
    const desde = periodo === "mes" ? inicioMes() : periodo === "ano" ? `${new Date().getFullYear()}-01-01` : undefined;
    const dias = presentesPorDia(filtrarPeriodo(tudo, desde, isoDia(new Date())));
    const todosDias = presentesPorDia(tudo);
    const vezes = new Map<string, number>();
    for (const d of dias) for (const id of d.ids) vezes.set(id, (vezes.get(id) ?? 0) + 1);
    // Última vez e sequência atual (de todos os tempos)
    const ultima = new Map<string, string>();
    const seq = new Map<string, number>();
    for (const d of todosDias) {
      for (const id of d.ids) ultima.set(id, d.data);
      for (const m of elenco) seq.set(m.id, d.ids.has(m.id) ? (seq.get(m.id) ?? 0) + 1 : 0);
    }
    return { dias: dias.length, vezes, ultima, seq, ultimosDias: todosDias.slice(-3) };
  }, [tudo, periodo, elenco]);

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada) return <Carregando />;

  const ativos = elenco.filter((m) => m.ativo && !m.convidado);
  const ranking = calc ? ativos.map((m) => ({ m, n: calc.vezes.get(m.id) ?? 0 })).sort((a, b) => b.n - a.n || nomeCurto(a.m).localeCompare(nomeCurto(b.m))) : [];
  // Sumido: não veio em nenhuma das últimas 3 peladas (mas já veio alguma vez).
  const sumidos = calc && calc.ultimosDias.length >= 3 ? ativos.filter((m) => calc.ultima.has(m.id) && !calc.ultimosDias.some((d) => d.ids.has(m.id))) : [];
  const emChamas = calc ? ativos.filter((m) => (calc.seq.get(m.id) ?? 0) >= 4).sort((a, b) => (calc.seq.get(b.id) ?? 0) - (calc.seq.get(a.id) ?? 0)) : [];
  const prox = proximaPelada(pelada.dia_semana, pelada.horario);
  const textoSumido = (m: Membro) =>
    [
      `Fala, ${nomeCurto(m)}! 👀`,
      `Sumiu da ${pelada.nome}, hein? A última vez foi em ${curtaDia(calc?.ultima.get(m.id) ?? "")}.`,
      prox ? `${DIAS[prox.getDay()]} tem pelada${pelada.horario ? ` às ${pelada.horario.slice(0, 5)}` : ""}. Bora voltar? ⚽` : "Bora voltar? ⚽",
    ].join("\n");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Presença" sub={pelada.nome} voltar="/" />
      <Escolha
        rotulo="Período"
        valor={periodo}
        aoMudar={setPeriodo}
        opcoes={[
          { valor: "mes", rotulo: "Este mês" },
          { valor: "ano", rotulo: "Este ano" },
          { valor: "tudo", rotulo: "Tudo" },
        ]}
      />

      {!calc ? (
        <Carregando texto="Contando quem veio…" />
      ) : (
        <>
          {emChamas.length > 0 && (
            <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
              <span className="font-semibold">🔥 Não falta uma</span>
              <div className="flex flex-wrap gap-1.5">
                {emChamas.map((m) => (
                  <span key={m.id} className="rounded-full bg-roxo-suave px-3 py-1 text-sm font-semibold text-roxo-escuro">
                    {nomeCurto(m)} · {calc.seq.get(m.id)} seguidas
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-col gap-1.5 rounded-2xl border border-borda bg-white p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Quem mais veio</span>
              <span className="text-xs text-apagado">
                {calc.dias} {calc.dias === 1 ? "pelada" : "peladas"} no período
              </span>
            </div>
            {ranking.map(({ m, n }, i) => {
              const pct = calc.dias ? Math.round((n / calc.dias) * 100) : 0;
              return (
                <div key={m.id} className="grid grid-cols-[24px_1fr_90px_52px] items-center gap-2 text-sm">
                  <span className="text-center text-apagado">{n ? (["🥇", "🥈", "🥉"][i] ?? `${i + 1}º`) : "—"}</span>
                  <span className="truncate">{nomeCurto(m)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-roxo-suave">
                    <span className="block h-full bg-roxo" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-right tabular-nums">
                    <strong>{n}</strong> <span className="text-xs text-apagado">{pct}%</span>
                  </span>
                </div>
              );
            })}
            {!calc.dias && <p className="text-sm text-apagado">Ainda não teve pelada nesse período.</p>}
          </section>

          {admin && (
            <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
              <span className="font-semibold">😴 Sumidos</span>
              <span className="text-[13px] text-apagado">Não vieram em nenhuma das últimas 3 peladas. Só o admin vê esta parte.</span>
              {sumidos.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {nomeCurto(m)} <span className="text-xs text-apagado">· última vez {curtaDia(calc.ultima.get(m.id) ?? "")}</span>
                  </span>
                  <a href={linkZap(textoSumido(m))} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-zap px-3 py-1.5 text-xs font-bold text-white">
                    Chamar no Zap
                  </a>
                </div>
              ))}
              {!sumidos.length && <p className="text-sm text-apagado">Ninguém sumido. Galera firme! 💪</p>}
            </section>
          )}
        </>
      )}
    </main>
  );
}
