"use client";
// Confrontos (só master, ou admin quando o master libera): duplas que vencem juntas,
// frente a frente entre dois jogadores, fregueses e carrascos. Nunca mostra notas.
import { useEffect, useMemo, useState } from "react";
import { useSessao } from "@/lib/sessao";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { carregarPeriodo, type DadosPeriodo } from "@/lib/estatisticas";
import { caemJuntas, duplas, frenteAFrente, relacoes, type Placar } from "@/lib/confrontos";
import { inicioMes, isoDia } from "@/lib/datas";
import { temRecurso } from "@/lib/planos";
import Topo, { Carregando } from "@/components/Topo";
import Bloqueado from "@/components/Bloqueado";
import { Escolha } from "@/components/Folha";

type Periodo = "mes" | "ano" | "tudo";

function Barra({ pct }: { pct: number }) {
  return (
    <span className="h-2 overflow-hidden rounded-full bg-roxo-suave">
      <span className="block h-full bg-roxo" style={{ width: `${pct}%` }} />
    </span>
  );
}

const vde = (p: Placar) => `${p.v}V ${p.e}E ${p.d}D`;

export default function ConfrontosPage() {
  const { pelada, naoAchou } = usePelada();
  const { carregando, usuario, ehMaster, ehAdmin } = useSessao();
  const admin = !!pelada && ehAdmin(pelada.id);
  const pode = !!pelada && (ehMaster || (admin && temRecurso(pelada, "confrontos_admin")));
  const verDuplasSorteio = !!pelada && (ehMaster || (admin && temRecurso(pelada, "duplas_admin")));
  const [periodo, setPeriodo] = useState<Periodo>("ano");
  const [minJogos, setMinJogos] = useState(3);
  const [d, setD] = useState<DadosPeriodo | null>(null);
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  useEffect(() => {
    if (!pelada || !pode) return;
    carregarElenco(pelada.id, false).then(setElenco);
  }, [pelada, pode]);

  useEffect(() => {
    if (!pelada || !pode) return;
    const desde = periodo === "mes" ? inicioMes() : periodo === "ano" ? `${new Date().getFullYear()}-01-01` : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setD(null);
    carregarPeriodo(pelada.id, desde, isoDia(new Date())).then(setD);
  }, [pelada, pode, periodo]);

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const nome = (id: string) => (porId.get(id) ? nomeCurto(porId.get(id) as Membro) : "?");
  const lista = useMemo(() => (d ? duplas(d, minJogos) : []), [d, minJogos]);
  const melhores = useMemo(() => [...lista].sort((x, y) => y.pct - x.pct || y.jogos - x.jogos).slice(0, 8), [lista]);
  const piores = useMemo(() => [...lista].sort((x, y) => x.pct - y.pct || y.jogos - x.jogos).slice(0, 5), [lista]);
  const juntas = useMemo(() => (d && verDuplasSorteio ? caemJuntas(d).slice(0, 8) : []), [d, verDuplasSorteio]);
  const ff = d && a && b && a !== b ? frenteAFrente(d, a, b) : null;
  const rel = d && a ? relacoes(d, a, minJogos) : null;

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando) return <Carregando />;
  if (!usuario || !admin)
    return <main className="p-6 text-center text-apagado">Só admin vê os confrontos.</main>;
  if (!pode)
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
        <Topo titulo="Confrontos" sub={pelada.nome} voltar="/" />
        <Bloqueado titulo="Histórico de confrontos" pelada={pelada.nome} admin />
      </main>
    );

  const jogadores = [...elenco].filter((m) => m.ativo).sort((x, y) => nomeCurto(x).localeCompare(nomeCurto(y)));
  const sel = "h-11 min-w-0 flex-1 rounded-xl border border-borda bg-white px-2 text-[15px]";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo
        titulo="Confrontos"
        sub={pelada.nome}
        voltar="/"
        direita={ehMaster && !temRecurso(pelada, "confrontos_admin") ? <span className="rounded-full bg-noite px-2.5 py-1 text-xs font-bold text-roxo-claro">SÓ MASTER</span> : undefined}
      />

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
      <label className="flex items-center justify-between gap-2 text-sm">
        <span className="text-apagado">Contar só quem jogou junto pelo menos</span>
        <select value={minJogos} onChange={(e) => setMinJogos(Number(e.target.value))} className="h-9 rounded-lg border border-borda bg-white px-2 font-semibold">
          {[1, 3, 5, 10].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "jogo" : "jogos"}
            </option>
          ))}
        </select>
      </label>

      {!d ? (
        <Carregando texto="Somando os jogos…" />
      ) : (
        <>
          <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
            <span className="font-semibold">Frente a frente</span>
            <div className="flex gap-2">
              <select aria-label="Jogador 1" value={a} onChange={(e) => setA(e.target.value)} className={sel}>
                <option value="">Escolha…</option>
                {jogadores.map((m) => (
                  <option key={m.id} value={m.id}>
                    {nomeCurto(m)}
                  </option>
                ))}
              </select>
              <span className="self-center font-display font-bold text-apagado">×</span>
              <select aria-label="Jogador 2" value={b} onChange={(e) => setB(e.target.value)} className={sel}>
                <option value="">Escolha…</option>
                {jogadores.filter((m) => m.id !== a).map((m) => (
                  <option key={m.id} value={m.id}>
                    {nomeCurto(m)}
                  </option>
                ))}
              </select>
            </div>
            {ff && (
              <div className="grid grid-cols-2 gap-2 pt-1 text-center">
                <div className="rounded-xl bg-fundo p-3">
                  <div className="text-[11px] font-bold tracking-wider text-apagado">UM CONTRA O OUTRO</div>
                  <div className="font-display text-2xl font-bold tabular-nums">
                    {ff.contra.va} <span className="text-apagado">×</span> {ff.contra.vb}
                  </div>
                  <div className="text-xs text-apagado">
                    {ff.contra.jogos} jogos · {ff.contra.e} empates
                    <br />
                    gols: {nome(a)} {ff.contra.golsA} · {nome(b)} {ff.contra.golsB}
                  </div>
                </div>
                <div className="rounded-xl bg-fundo p-3">
                  <div className="text-[11px] font-bold tracking-wider text-apagado">NO MESMO TIME</div>
                  <div className="font-display text-2xl font-bold tabular-nums">{ff.juntos.jogos ? `${Math.round((ff.juntos.v / ff.juntos.jogos) * 100)}%` : "—"}</div>
                  <div className="text-xs text-apagado">
                    {ff.juntos.jogos} jogos · {vde(ff.juntos)}
                  </div>
                </div>
              </div>
            )}
            {rel && (
              <div className="flex flex-col gap-1 border-t border-borda pt-2 text-sm">
                <span className="font-semibold">{nome(a)}</span>
                {[
                  ["🤝 Melhor parceiro", rel.melhoresParceiros],
                  ["😎 Freguês (ganha dele)", rel.fregueses],
                  ["😬 Carrasco (perde pra ele)", rel.carrascos],
                ].map(([t, l]) => (
                  <div key={t as string} className="flex justify-between gap-2">
                    <span className="text-apagado">{t as string}</span>
                    <span className="text-right">
                      {(l as { id: string; v: number; e: number; d: number; jogos: number }[]).map((x) => `${nome(x.id)} (${x.v}V ${x.d}D)`).join(", ") || "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {!a && <span className="text-[13px] text-apagado">Escolha um jogador pra ver parceiros, fregueses e carrascos. Escolha dois pra ver o frente a frente.</span>}
          </section>

          <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
            <span className="font-semibold">Duplas que mais vencem juntas</span>
            <span className="text-[13px] text-apagado">Aproveitamento: vitória vale 3, empate 1.</span>
            {melhores.map((x) => (
              <div key={x.a + x.b} className="grid grid-cols-[1fr_70px_78px] items-center gap-2 text-sm">
                <span className="truncate">
                  {nome(x.a)} + {nome(x.b)}
                </span>
                <Barra pct={x.pct} />
                <span className="text-right tabular-nums text-apagado">
                  <strong className="text-tinta">{x.pct}%</strong> · {x.jogos}j
                </span>
              </div>
            ))}
            {!melhores.length && <p className="text-sm text-apagado">Ainda não tem jogos suficientes nesse período.</p>}
          </section>

          {piores.length > 0 && (
            <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
              <span className="font-semibold">Duplas que não estão dando liga</span>
              {piores.map((x) => (
                <div key={x.a + x.b} className="grid grid-cols-[1fr_70px_78px] items-center gap-2 text-sm">
                  <span className="truncate">
                    {nome(x.a)} + {nome(x.b)}
                  </span>
                  <Barra pct={x.pct} />
                  <span className="text-right tabular-nums text-apagado">
                    <strong className="text-tinta">{x.pct}%</strong> · {x.jogos}j
                  </span>
                </div>
              ))}
            </section>
          )}

          {verDuplasSorteio && (
            <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
              <span className="font-semibold">Duplas que mais caem juntas no sorteio</span>
              <span className="text-[13px] text-apagado">Em {d.sorteios.length} sorteios oficiais. Se uma dupla cai junto demais, vale uma regra “separar”.</span>
              {juntas.map((x) => (
                <div key={x.a + x.b} className="grid grid-cols-[1fr_70px_64px] items-center gap-2 text-sm">
                  <span className="truncate">
                    {nome(x.a)} + {nome(x.b)}
                  </span>
                  <Barra pct={d.sorteios.length ? Math.round((x.vezes / d.sorteios.length) * 100) : 0} />
                  <span className="text-right tabular-nums text-apagado">
                    {x.vezes} de {d.sorteios.length}
                  </span>
                </div>
              ))}
              {!juntas.length && <p className="text-sm text-apagado">Aparece depois dos primeiros sorteios.</p>}
            </section>
          )}
        </>
      )}
    </main>
  );
}
