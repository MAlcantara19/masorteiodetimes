"use client";
// Retrospectiva do ano (estilo "Wrapped"): o ano da pelada e o ano de cada jogador,
// com um card em formato de story pra baixar e postar. Sem nota/estrelas, só jogo.
import { useEffect, useMemo, useRef, useState } from "react";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { useSessao } from "@/lib/sessao";
import { calcularEstatisticas, carregarPeriodo, lideres, premioPorDias, vencedorDe, type DadosPeriodo } from "@/lib/estatisticas";
import { curtaDia } from "@/lib/datas";
import { compartilharDataUrl, baixarDataUrl, gerarPng } from "@/lib/imagem";
import Topo, { Carregando } from "@/components/Topo";

type Ano = {
  peladas: number;
  jogos: number;
  gols: number;
  vitorias: number;
  assist: number;
  aproveitamento: number;
  parceiro: { nome: string; vitorias: number } | null;
  melhorDia: { data: string; gols: number } | null;
  craques: number;
  medalhas: number;
};

function anoDoJogador(id: string, d: DadosPeriodo, nome: (id: string) => string, craquesDias: string[]): Ano | null {
  const est = calcularEstatisticas(d).get(id);
  if (!est || (!est.jogos && !est.goleiro.jogos)) return null;
  const sorteioDo = new Map(d.sorteios.map((s) => [s.evento_id, s]));
  // Parceiro de vitória: com quem ganhou mais jogos no mesmo time.
  const juntos = new Map<string, number>();
  for (const p of d.partidas) {
    const v = vencedorDe(p);
    const s = sorteioDo.get(p.evento_id);
    if (v === null || !s) continue;
    const time = s.times[v] ?? [];
    if (!time.includes(id)) continue;
    time.filter((x) => x !== id).forEach((x) => juntos.set(x, (juntos.get(x) ?? 0) + 1));
  }
  const top = [...juntos.entries()].sort((a, b) => b[1] - a[1])[0];
  // Melhor dia: mais gols numa pelada.
  let melhorDia: Ano["melhorDia"] = null;
  for (const e of d.eventos) {
    const pids = new Set(d.partidas.filter((p) => p.evento_id === e.id).map((p) => p.id));
    const g = d.lances.filter((l) => pids.has(l.partida_id) && l.tipo === "gol" && l.autor_id === id).length;
    if (g > (melhorDia?.gols ?? 0)) melhorDia = { data: e.data, gols: g };
  }
  const jogos = est.jogos || est.goleiro.jogos;
  return {
    peladas: est.peladas,
    jogos,
    gols: est.gols,
    assist: est.assist,
    vitorias: est.vitorias,
    aproveitamento: jogos ? Math.round((est.vitorias / jogos) * 100) : 0,
    parceiro: top ? { nome: nome(top[0]), vitorias: top[1] } : null,
    melhorDia,
    craques: craquesDias.filter((x) => x === id).length,
    medalhas: 0,
  };
}

function Linha({ n, t }: { n: string | number; t: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-display text-4xl font-bold tabular-nums">{n}</span>
      <span className="text-sm text-[#E8DEFF]">{t}</span>
    </div>
  );
}

export default function RetrospectivaPage() {
  const { pelada, naoAchou } = usePelada();
  const { vinculos } = useSessao();
  const [ano, setAno] = useState(() => new Date().getFullYear());
  const [d, setD] = useState<DadosPeriodo | null>(null);
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [quem, setQuem] = useState<string>("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pelada) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setD(null);
    carregarPeriodo(pelada.id, `${ano}-01-01`, `${ano}-12-31`).then(setD);
    carregarElenco(pelada.id, false).then(setElenco);
  }, [pelada, ano]);

  const meu = vinculos.find((v) => v.pelada.id === pelada?.id)?.membro_id ?? "";
  const escolhido = quem || meu;
  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const nome = (id: string) => (porId.get(id) ? nomeCurto(porId.get(id) as Membro) : "?");

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || !d) return <Carregando />;

  const est = calcularEstatisticas(d);
  const linhas = [...est.values()];
  const craquesDias = premioPorDias(d, "craque", true);
  const totalGols = d.lances.filter((l) => l.tipo === "gol" || l.tipo === "gol_contra").length;
  const jogos = d.partidas.filter((p) => p.status === "encerrada").length;
  const art = lideres(linhas, (l) => l.gols);
  const pres = lideres(linhas, (l) => l.peladas);
  const vit = lideres(linhas, (l) => l.vitorias);
  const jogadores = linhas.filter((l) => l.jogos || l.goleiro.jogos).sort((a, b) => nome(a.membro_id).localeCompare(nome(b.membro_id)));
  const a = escolhido ? anoDoJogador(escolhido, d, nome, craquesDias) : null;

  async function imagem(acao: "baixar" | "compartilhar") {
    if (!ref.current) return;
    const url = await gerarPng(ref.current, { escala: 3 });
    const arquivo = `retrospectiva-${ano}-${escolhido ? nome(escolhido).toLowerCase().replace(/\s+/g, "-") : pelada!.slug}.png`;
    if (acao === "baixar") baixarDataUrl(url, arquivo);
    else await compartilharDataUrl(url, arquivo, `Minha retrospectiva ${ano} na ${pelada!.nome} · MA Sorteio`);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo
        titulo={`Retrospectiva ${ano}`}
        sub={pelada.nome}
        voltar="/mais"
        direita={
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-10 rounded-xl border border-borda bg-white px-2 text-sm">
            {[0, 1, 2].map((k) => (
              <option key={k} value={new Date().getFullYear() - k}>
                {new Date().getFullYear() - k}
              </option>
            ))}
          </select>
        }
      />

      <select value={escolhido} onChange={(e) => setQuem(e.target.value)} className="h-11 rounded-xl border border-borda bg-white px-2">
        <option value="">O ano da pelada</option>
        {jogadores.map((l) => (
          <option key={l.membro_id} value={l.membro_id}>
            {nome(l.membro_id)}
            {l.membro_id === meu ? " (você)" : ""}
          </option>
        ))}
      </select>

      {!jogos && <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">Nenhum jogo registrado em {ano}.</p>}

      {jogos > 0 && (
        <div className="flex justify-center">
          <div
            ref={ref}
            className="relative flex shrink-0 flex-col gap-5 overflow-hidden p-7 text-white"
            style={{ width: 340, height: 604, background: "radial-gradient(circle at 20% 10%, var(--marca-luz) 0%, var(--marca) 40%, var(--marca-escuro) 85%, #1B1430 100%)" }}
          >
            <div aria-hidden="true" className="absolute inset-0" style={{ background: "repeating-linear-gradient(125deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 40px)" }} />
            <div className="relative flex flex-col">
              <span className="text-xs font-bold tracking-[0.25em] text-roxo-claro">RETROSPECTIVA {ano}</span>
              <span className="font-display text-3xl leading-tight font-bold">{escolhido && a ? nome(escolhido) : pelada.nome}</span>
              <span className="text-sm text-[#E8DEFF]">{escolhido && a ? pelada.nome : "o ano da pelada"}</span>
            </div>
            {escolhido && a ? (
              <div className="relative flex flex-1 flex-col gap-3">
                <Linha n={a.peladas} t="peladas" />
                <Linha n={a.jogos} t="jogos" />
                <Linha n={a.gols} t={a.gols === 1 ? "gol" : "gols"} />
                <Linha n={a.assist} t="assistências" />
                <Linha n={`${a.aproveitamento}%`} t={`de vitórias (${a.vitorias}V)`} />
                {a.parceiro && (
                  <div className="rounded-2xl bg-white/12 p-3 text-sm">
                    🤝 Parceiro de vitória: <strong>{a.parceiro.nome}</strong> ({a.parceiro.vitorias} vitórias juntos)
                  </div>
                )}
                {a.melhorDia && (
                  <div className="rounded-2xl bg-white/12 p-3 text-sm">
                    🔥 Melhor dia: <strong>{a.melhorDia.gols} gols</strong> em {curtaDia(a.melhorDia.data)}
                  </div>
                )}
                {a.craques > 0 && (
                  <div className="rounded-2xl bg-white/12 p-3 text-sm">
                    ⭐ Craque do dia <strong>{a.craques}×</strong>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative flex flex-1 flex-col gap-3">
                <Linha n={d.eventos.length} t="peladas" />
                <Linha n={jogos} t="jogos" />
                <Linha n={totalGols} t="gols" />
                <div className="rounded-2xl bg-white/12 p-3 text-sm">
                  ⚽ Artilheiro: <strong>{art.ids.map(nome).join(" e ") || "—"}</strong> ({art.valor})
                </div>
                <div className="rounded-2xl bg-white/12 p-3 text-sm">
                  🏅 Mais vitorioso: <strong>{vit.ids.map(nome).join(" e ") || "—"}</strong> ({vit.valor}V)
                </div>
                <div className="rounded-2xl bg-white/12 p-3 text-sm">
                  📅 Mais presente: <strong>{pres.ids.map(nome).join(" e ") || "—"}</strong> ({pres.valor} peladas)
                </div>
              </div>
            )}
            <span className="relative text-center text-[11px] font-semibold tracking-widest text-roxo-claro">MA SORTEIO DE TIMES</span>
          </div>
        </div>
      )}

      {jogos > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => imagem("baixar")} className="h-12 rounded-xl border-2 border-noite bg-white font-semibold">
            Baixar
          </button>
          <button type="button" onClick={() => imagem("compartilhar")} className="h-12 rounded-xl bg-roxo font-semibold text-white">
            Compartilhar
          </button>
        </div>
      )}
    </main>
  );
}
