"use client";
// Meu dia: o card do resultado da pelada de hoje (ou da última) com a foto do jogador,
// os jogos dele, gols, assistências, vitórias e conquistas do dia. Vira imagem pra postar.
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSessao } from "@/lib/sessao";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { eventoAtual, ultimoEvento, CORES_TIMES, NOMES_TIMES, type Evento } from "@/lib/evento";
import { calcularEstatisticas, carregarPeriodo, vencedorDe, type DadosPeriodo } from "@/lib/estatisticas";
import { calcularConquistas, CONQUISTAS } from "@/lib/conquistas";
import { carregarPerfisPublicos, type PerfilPublico } from "@/lib/cartas";
import { dataExtenso, deIso } from "@/lib/datas";
import { corLegivel, misturar } from "@/lib/cores";
import { baixarDataUrl, compartilharDataUrl, gerarPng } from "@/lib/imagem";
import { carregarCraques, craquesPorJogo } from "@/components/CraqueDaPartida";
import Topo, { Carregando } from "@/components/Topo";

// Conquistas que fazem sentido num dia só.
const DO_DIA = new Set(["hat_trick", "goleador_dia", "garcom_dia", "invicto_dia", "pe_quente"]);

export default function MeuDiaPage() {
  const { pelada, naoAchou } = usePelada();
  const q = useSearchParams();
  const { carregando, vinculos, ehAdmin } = useSessao();
  const admin = !!pelada && ehAdmin(pelada.id);
  const meuId = pelada ? vinculos.find((v) => v.pelada.id === pelada.id)?.membro_id : undefined;
  const [escolhido, setEscolhido] = useState<string | null>(q.get("m"));
  const membroId = escolhido ?? meuId ?? null;
  const [evento, setEvento] = useState<Evento | null | undefined>(undefined);
  const [d, setD] = useState<DadosPeriodo | null>(null);
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [perfis, setPerfis] = useState<Map<string, PerfilPublico>>(new Map());
  const [craques, setCraques] = useState<Map<string, string[]>>(new Map());
  const [aviso, setAviso] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pelada) return;
    (async () => {
      const ultimo = await ultimoEvento(pelada.id);
      const ev = ultimo?.status === "encerrado" ? ultimo : ((await eventoAtual(pelada.id)) ?? ultimo);
      setEvento(ev);
      if (!ev) return;
      setD(await carregarPeriodo(pelada.id, undefined, undefined, [ev.id]));
      carregarCraques(ev.id).then((v) => setCraques(craquesPorJogo(v)));
    })();
    carregarElenco(pelada.id, false).then((el) => {
      setElenco(el);
      carregarPerfisPublicos(el.map((m) => m.profile_id).filter((x): x is string => !!x)).then(setPerfis);
    });
  }, [pelada]);

  const m = elenco.find((x) => x.id === membroId) ?? null;
  const calc = useMemo(() => {
    if (!d || !membroId) return null;
    const linha = calcularEstatisticas(d).get(membroId) ?? null;
    const conquistas = (calcularConquistas(d).get(membroId) ?? []).filter((c) => DO_DIA.has(c.id));
    const s = d.sorteios[0];
    const meuTime = s ? s.times.findIndex((t) => t.includes(membroId)) : -1;
    const jogos = d.partidas
      .filter((p) => p.status === "encerrada" && (p.time_a === meuTime || p.time_b === meuTime || p.goleiro_a === membroId || p.goleiro_b === membroId))
      .map((p) => {
        const lado = p.time_a === meuTime || p.goleiro_a === membroId ? p.time_a : p.time_b;
        const v = vencedorDe(p);
        const gols = d.lances.filter((l) => l.partida_id === p.id && l.tipo === "gol" && l.autor_id === membroId).length;
        return { p, lado, r: v === null ? "E" : v === lado ? "V" : "D", gols, craque: (craques.get(p.id) ?? []).includes(membroId) };
      });
    const votosCraque = d.votos.filter((v) => v.votado_id === membroId && v.categoria === "craque").reduce((s2, v) => s2 + v.votos, 0);
    return { linha, conquistas, meuTime, jogos, votosCraque };
  }, [d, membroId, craques]);

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando || evento === undefined) return <Carregando />;
  if (!evento) return <main className="p-6 text-center text-apagado">Ainda não teve pelada.</main>;

  const cor = corLegivel(pelada.cor_banner || "#7444D6");
  const foto = m?.profile_id ? perfis.get(m.profile_id)?.foto_url : null;
  const l = calc?.linha;
  const v = calc?.jogos.filter((j) => j.r === "V").length ?? 0;
  const e = calc?.jogos.filter((j) => j.r === "E").length ?? 0;
  const dd = calc?.jogos.filter((j) => j.r === "D").length ?? 0;

  async function imagem(acao: "baixar" | "compartilhar") {
    if (!ref.current || !m) return;
    try {
      const url = await gerarPng(ref.current, { escala: 3 });
      const nome = `meu-dia-${nomeCurto(m).toLowerCase().replace(/\s+/g, "-")}.png`;
      if (acao === "baixar") baixarDataUrl(url, nome);
      else await compartilharDataUrl(url, nome, `Meu dia na ${pelada!.nome} · MA Sorteio`);
    } catch {
      setAviso("Não deu pra gerar a imagem neste navegador.");
    }
  }

  const ativos = elenco.filter((x) => x.ativo).sort((a, b) => nomeCurto(a).localeCompare(nomeCurto(b)));

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Meu dia" sub={`${pelada.nome} · ${dataExtenso(deIso(evento.data))}`} voltar="/" />

      {(admin || !meuId) && (
        <select value={membroId ?? ""} onChange={(ev) => setEscolhido(ev.target.value || null)} aria-label="Jogador" className="h-11 rounded-xl border border-borda bg-white px-3 text-[15px]">
          <option value="">Escolha o jogador…</option>
          {ativos.map((x) => (
            <option key={x.id} value={x.id}>
              {nomeCurto(x)}
            </option>
          ))}
        </select>
      )}

      {!m || !calc || !d ? (
        membroId ? <Carregando /> : <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">Escolha um jogador pra ver o dia dele.</p>
      ) : (
        <>
          <div className="flex justify-center">
            <div
              ref={ref}
              className="relative flex w-[340px] flex-col gap-3 overflow-hidden rounded-[28px] p-5 text-white"
              style={{ background: `linear-gradient(160deg, ${misturar(cor, "#FFFFFF", 0.25)} 0%, ${cor} 35%, ${misturar(cor, "#000000", 0.45)} 80%, #1B1430 100%)` }}
            >
              <div className="flex items-center justify-between text-[11px] font-bold tracking-widest text-white/80">
                <span>{pelada.nome.toUpperCase()}</span>
                <span>{dataExtenso(deIso(evento.data)).toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-white/80 bg-white/15 font-display text-2xl font-bold">
                  {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={foto} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />
                  ) : (
                    nomeCurto(m).slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="text-xs font-semibold text-white/75">MEU DIA</span>
                  <span className="truncate font-display text-[28px] leading-tight font-bold">{nomeCurto(m)}</span>
                  {calc.meuTime >= 0 && (
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full border border-white" style={{ background: CORES_TIMES[calc.meuTime] }} />
                      {NOMES_TIMES[calc.meuTime]}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-center">
                {[
                  [l?.gols ?? 0, "GOLS"],
                  [l?.assist ?? 0, "ASSIST."],
                  [v, "VITÓRIAS"],
                  [calc.jogos.length, "JOGOS"],
                ].map(([n, t]) => (
                  <div key={t as string} className="rounded-2xl bg-white/15 py-2">
                    <div className="font-display text-[26px] leading-none font-bold">{n}</div>
                    <div className="pt-1 text-[9px] font-bold tracking-wider text-white/80">{t}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1 rounded-2xl bg-black/20 p-3 text-[13px]">
                {calc.jogos.map((j) => (
                  <div key={j.p.id} className="flex items-center gap-2">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${j.r === "V" ? "bg-zap" : j.r === "E" ? "bg-white/30" : "bg-alerta"}`}>{j.r}</span>
                    <span className="flex-1 truncate">
                      {NOMES_TIMES[j.p.time_a]} <strong>{j.p.placar_a} × {j.p.placar_b}</strong> {NOMES_TIMES[j.p.time_b]}
                    </span>
                    <span className="text-xs">
                      {j.gols > 0 && "⚽".repeat(Math.min(j.gols, 4))}
                      {j.craque && " ⭐"}
                    </span>
                  </div>
                ))}
                {!calc.jogos.length && <span className="text-white/70">Não jogou nesse dia.</span>}
                {calc.jogos.length > 0 && (
                  <span className="pt-1 text-[11px] text-white/70">
                    {v}V {e}E {dd}D{calc.jogos.some((j) => j.craque) ? " · ⭐ craque da partida" : ""}
                    {calc.votosCraque ? ` · ${calc.votosCraque} votos de craque do dia` : ""}
                  </span>
                )}
              </div>

              {calc.conquistas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {calc.conquistas.map((c) => (
                    <span key={c.id} className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">
                      {CONQUISTAS[c.id].emoji} {CONQUISTAS[c.id].titulo}
                      {c.vezes > 1 ? ` ×${c.vezes}` : ""}
                    </span>
                  ))}
                </div>
              )}

              <span className="text-center text-[10px] font-bold tracking-[0.2em] text-white/60">MA SORTEIO</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => imagem("baixar")} className="h-12 rounded-xl border-2 border-noite bg-white font-semibold">
              Baixar
            </button>
            <button type="button" onClick={() => imagem("compartilhar")} className="h-12 rounded-xl bg-roxo font-semibold text-white">
              Compartilhar
            </button>
          </div>
          {aviso && <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{aviso}</p>}
        </>
      )}
    </main>
  );
}
