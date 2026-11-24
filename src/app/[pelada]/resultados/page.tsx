"use client";
// Resultados do dia: jogos, placares, gols, fila, "Corrigir" em cada jogo e gols sem autor destacados.
// O admin encerra a pelada aqui: abre a votação e gera o resumo.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { eventoAtual, ultimoEvento, CORES_TIMES, NOMES_TIMES, type Evento } from "@/lib/evento";
import { calcularFila, type Lance, type Partida } from "@/lib/partida";
import { calcularEstatisticas, calcularPremios, carregarPeriodo, vencedorDe, type DadosPeriodo } from "@/lib/estatisticas";
import { curtaDia, DIAS, deIso } from "@/lib/datas";
import { encerrarPelada } from "@/lib/encerrar";
import Folha from "@/components/Folha";
import Topo, { Carregando } from "@/components/Topo";

const REGRA_EMPATE = { sai_quem_ficou: "empate sai quem está há mais tempo", sai_os_dois: "empate saem os dois", penaltis: "empate vai pros pênaltis" };

type Rascunho = { partida: Partida; lances: (Lance & { novo?: boolean; apagar?: boolean })[]; vencedor: number | null };

export default function ResultadosPage() {
  const router = useRouter();
  const { pelada, slug, naoAchou } = usePelada();
  const { carregando, usuario, ehAdmin } = useSessao();
  const admin = pelada ? ehAdmin(pelada.id) : false;
  const [evento, setEvento] = useState<Evento | null | undefined>(undefined);
  const [d, setD] = useState<DadosPeriodo | null>(null);
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [edit, setEdit] = useState<Rascunho | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!pelada) return;
    const ev = (await eventoAtual(pelada.id)) ?? (await ultimoEvento(pelada.id));
    setEvento(ev);
    if (ev) setD(await carregarPeriodo(pelada.id, undefined, undefined, [ev.id]));
  }, [pelada]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
    if (pelada) carregarElenco(pelada.id, false).then(setElenco);
  }, [carregar, pelada]);

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const nome = (id: string | null) => (id ? (porId.get(id) ? nomeCurto(porId.get(id) as Membro) : "?") : "Sem autor");

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando || evento === undefined) return <Carregando />;
  if (!evento || !d) {
    return (
      <main className="mx-auto max-w-xl px-4 py-6">
        <Topo titulo="Resultados" sub={pelada.nome} voltar="/" />
        <p className="text-sm text-apagado">Nenhuma pelada registrada ainda.</p>
      </main>
    );
  }

  const sorteio = d.sorteios[0];
  const qtd = sorteio?.times.length ?? 0;
  const atual = d.partidas[d.partidas.length - 1];
  const fila = calcularFila(qtd, d.partidas, pelada.regra_empate);
  const premios = calcularPremios(calcularEstatisticas(d));
  const artilharia = [...calcularEstatisticas(d).values()].filter((l) => l.gols > 0).sort((a, b) => b.gols - a.gols).slice(0, 8);
  const dt = deIso(evento.data);

  function abrirCorrecao(p: Partida) {
    setEdit({ partida: p, lances: d!.lances.filter((l) => l.partida_id === p.id).map((l) => ({ ...l })), vencedor: p.vencedor });
  }

  async function salvarCorrecao() {
    if (!edit || !usuario) return;
    setOcupado(true);
    const sb = criarClienteSupabase();
    for (const l of edit.lances) {
      if (l.novo && !l.apagar) {
        await sb.from("lances").insert({ partida_id: edit.partida.id, tipo: l.tipo, time: l.time, autor_id: l.autor_id, assist_id: l.assist_id, minuto: null, criado_por: usuario.id, criado_por_nome: "correção" });
      } else if (!l.novo && l.apagar) {
        await sb.from("lances").update({ desfeito: true }).eq("id", l.id);
      } else if (!l.novo) {
        await sb.from("lances").update({ autor_id: l.autor_id, assist_id: l.assist_id, time: l.time, tipo: l.tipo }).eq("id", l.id);
      }
    }
    // Placar refeito a partir dos gols que valem.
    const validos = edit.lances.filter((l) => !l.apagar);
    const pa = validos.filter((l) => l.time === edit.partida.time_a).length;
    const pb = validos.filter((l) => l.time === edit.partida.time_b).length;
    const vencedor = pa > pb ? edit.partida.time_a : pb > pa ? edit.partida.time_b : edit.vencedor;
    const fechar = edit.partida.status !== "encerrada" && edit.partida !== atual;
    const { error } = await sb
      .from("partidas")
      .update({ placar_a: pa, placar_b: pb, vencedor, ...(fechar ? { status: "encerrada", encerrada_em: new Date().toISOString() } : {}) })
      .eq("id", edit.partida.id);
    setOcupado(false);
    if (error) return setAviso("Não deu pra salvar a correção.");
    setEdit(null);
    carregar();
  }

  async function encerrar() {
    if (!evento || !pelada) return;
    if (!confirm("Encerrar a pelada de hoje? Isso fecha o jogo em andamento e abre a votação.")) return;
    setOcupado(true);
    const r = await encerrarPelada(pelada, evento);
    setOcupado(false);
    if (r) return setAviso(r);
    router.push(`/${slug}/fim`);
  }

  const linkAvaliar = typeof window !== "undefined" ? `${window.location.origin}/p/${slug}/avaliar` : "";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-6">
      <Topo
        titulo="Resultados"
        sub={`${DIAS[dt.getDay()]} · ${curtaDia(evento.data)}`}
        voltar={`/${slug}/jogo`}
        direita={
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Como foi a pelada de hoje? Avalia aqui (1 minutinho): ${linkAvaliar}`)}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-roxo"
          >
            Pedir avaliação
          </a>
        }
      />

      {atual && evento.status !== "encerrado" && (
        <section className="flex flex-col gap-1 rounded-2xl bg-noite p-4 text-sm text-white">
          <span className="text-xs font-bold tracking-wider text-roxo-claro">FILA AGORA</span>
          <span>
            Em campo: {NOMES_TIMES[atual.time_a]} × {NOMES_TIMES[atual.time_b]} · {atual.placar_a} a {atual.placar_b}
          </span>
          <span>Próximo: {fila.espera.length ? NOMES_TIMES[fila.espera[0]] : "—"}</span>
          <span className="text-xs text-[#CFC7E0]">Regra: quem ganha fica · {REGRA_EMPATE[pelada.regra_empate]}</span>
        </section>
      )}

      {d.partidas.map((p) => {
        const ls = d.lances.filter((l) => l.partida_id === p.id);
        const semAutor = ls.filter((l) => l.tipo === "gol" && !l.autor_id).length;
        const v = vencedorDe(p);
        return (
          <section key={p.id} className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-apagado">
                JOGO {p.numero}
                {p.status !== "encerrada" ? " · em andamento" : ""}
              </span>
              {admin && (
                <button type="button" onClick={() => abrirCorrecao(p)} className="text-sm font-semibold text-roxo">
                  Corrigir
                </button>
              )}
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <span className={`text-sm font-bold ${v === p.time_a ? "" : "opacity-70"}`} style={{ color: CORES_TIMES[p.time_a] }}>
                {NOMES_TIMES[p.time_a]}
              </span>
              <span className="font-display text-2xl font-bold tabular-nums">
                {p.placar_a} × {p.placar_b}
              </span>
              <span className={`text-right text-sm font-bold ${v === p.time_b ? "" : "opacity-70"}`} style={{ color: CORES_TIMES[p.time_b] }}>
                {NOMES_TIMES[p.time_b]}
              </span>
            </div>
            {ls.length > 0 && (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {ls.map((l) => (
                  <span key={l.id} className={`rounded-full px-2 py-0.5 ${!l.autor_id && l.tipo === "gol" ? "bg-alerta-suave font-semibold text-alerta-escuro" : "bg-fundo"}`}>
                    ⚽ {l.tipo === "gol_contra" ? "contra" : nome(l.autor_id)}
                    {l.assist_id ? ` (${nome(l.assist_id)})` : ""}
                  </span>
                ))}
              </div>
            )}
            {(() => {
              const pz = d.pausas.filter((x) => x.partida_id === p.id && x.fim);
              if (!pz.length) return null;
              const seg = pz.reduce((t, x) => t + (new Date(x.fim as string).getTime() - new Date(x.inicio).getTime()) / 1000, 0);
              const motivos = [...new Set(pz.map((x) => x.motivo).filter(Boolean))];
              return (
                <span className="text-xs text-apagado">
                  ⏸ {pz.length} {pz.length === 1 ? "pausa" : "pausas"} · {Math.floor(seg / 60)}:{String(Math.round(seg % 60)).padStart(2, "0")} parado
                  {motivos.length ? ` (${motivos.join(", ")})` : ""}
                </span>
              );
            })()}
            {semAutor > 0 && <span className="text-xs font-semibold text-alerta-escuro">{semAutor === 1 ? "1 gol sem autor" : `${semAutor} gols sem autor`}: toca em Corrigir</span>}
          </section>
        );
      })}
      {!d.partidas.length && <p className="text-sm text-apagado">Nenhum jogo ainda.</p>}

      {artilharia.length > 0 && (
        <section className="flex flex-col gap-1.5 rounded-2xl border border-borda bg-white p-4">
          <span className="text-xs font-bold tracking-wider text-apagado">ARTILHARIA DO DIA</span>
          {artilharia.map((l, i) => (
            <div key={l.membro_id} className="flex justify-between text-sm">
              <span>
                {i + 1}. {nome(l.membro_id)}
              </span>
              <span className="tabular-nums">
                {l.gols} {l.gols === 1 ? "gol" : "gols"}
                {l.assist ? ` · ${l.assist} assist.` : ""}
              </span>
            </div>
          ))}
          {premios.garcom.ids.length > 0 && <span className="pt-1 text-xs text-apagado">Garçom: {premios.garcom.ids.map(nome).join(", ")}</span>}
        </section>
      )}

      {aviso && <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{aviso}</p>}

      {admin && evento.status !== "encerrado" && (
        <button type="button" onClick={encerrar} disabled={ocupado} className="h-14 rounded-2xl bg-roxo text-lg font-bold text-white disabled:opacity-50">
          Encerrar pelada e gerar resumo
        </button>
      )}
      {evento.status === "encerrado" && (
        <button type="button" onClick={() => router.push(`/${slug}/fim`)} className="h-14 rounded-2xl bg-roxo text-lg font-bold text-white">
          Ver resumo e prêmios
        </button>
      )}

      <Folha aberta={!!edit} titulo={edit ? `Corrigir jogo ${edit.partida.numero}` : ""} aoFechar={() => setEdit(null)}>
        {edit && sorteio && (
          <div className="flex flex-col gap-3">
            {[edit.partida.time_a, edit.partida.time_b].map((t) => {
              const doTime = edit.lances.map((l, i) => [l, i] as const).filter(([l]) => l.time === t && !l.apagar);
              const jogadores = [...(sorteio.times[t] ?? []), ...((sorteio.espera ?? []) as string[])];
              return (
                <div key={t} className="flex flex-col gap-2 rounded-xl bg-fundo p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold" style={{ color: CORES_TIMES[t] }}>
                      {NOMES_TIMES[t]} · {doTime.length}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setEdit({
                          ...edit,
                          lances: [
                            ...edit.lances,
                            { id: crypto.randomUUID(), partida_id: edit.partida.id, tipo: "gol", time: t, autor_id: null, assist_id: null, minuto: null, criado_por_nome: null, desfeito: false, created_at: "", novo: true },
                          ],
                        })
                      }
                      className="text-sm font-semibold text-roxo"
                    >
                      + Gol
                    </button>
                  </div>
                  {doTime.map(([l, i]) => (
                    <div key={l.id} className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
                      <select
                        aria-label="Autor"
                        value={l.tipo === "gol_contra" ? "__contra" : (l.autor_id ?? "")}
                        onChange={(e) => {
                          const v = e.target.value;
                          const n = [...edit.lances];
                          n[i] = { ...l, tipo: v === "__contra" ? "gol_contra" : "gol", autor_id: v && v !== "__contra" ? v : null };
                          setEdit({ ...edit, lances: n });
                        }}
                        className={`h-10 rounded-lg border px-2 text-sm ${!l.autor_id && l.tipo === "gol" ? "border-alerta bg-alerta-suave" : "border-borda bg-white"}`}
                      >
                        <option value="">Sem autor</option>
                        <option value="__contra">Gol contra</option>
                        {jogadores.map((id) => (
                          <option key={id} value={id}>
                            {nome(id)}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Assistência"
                        value={l.assist_id ?? ""}
                        onChange={(e) => {
                          const n = [...edit.lances];
                          n[i] = { ...l, assist_id: e.target.value || null };
                          setEdit({ ...edit, lances: n });
                        }}
                        className="h-10 rounded-lg border border-borda bg-white px-2 text-sm"
                      >
                        <option value="">Sem assist.</option>
                        {jogadores.map((id) => (
                          <option key={id} value={id}>
                            {nome(id)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label="Apagar gol"
                        onClick={() => {
                          const n = [...edit.lances];
                          n[i] = { ...l, apagar: true };
                          setEdit({ ...edit, lances: n });
                        }}
                        className="h-10 w-10 rounded-lg border border-borda bg-white"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
            {edit.lances.filter((l) => !l.apagar && l.time === edit.partida.time_a).length ===
              edit.lances.filter((l) => !l.apagar && l.time === edit.partida.time_b).length && (
              <label className="flex flex-col gap-1 text-[13px] font-semibold">
                Empate. Quem ganhou (pênaltis)?
                <select
                  value={edit.vencedor ?? ""}
                  onChange={(e) => setEdit({ ...edit, vencedor: e.target.value === "" ? null : Number(e.target.value) })}
                  className="h-10 rounded-lg border border-borda bg-white px-2 font-normal"
                >
                  <option value="">Ninguém (empate)</option>
                  <option value={edit.partida.time_a}>{NOMES_TIMES[edit.partida.time_a]}</option>
                  <option value={edit.partida.time_b}>{NOMES_TIMES[edit.partida.time_b]}</option>
                </select>
              </label>
            )}
            <button type="button" onClick={salvarCorrecao} disabled={ocupado} className="h-12 rounded-xl bg-roxo font-semibold text-white disabled:opacity-50">
              Salvar correção
            </button>
          </div>
        )}
      </Folha>
    </main>
  );
}
