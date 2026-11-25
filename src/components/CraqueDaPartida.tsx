"use client";
// Craque da partida: voto rápido depois de cada jogo (10 segundos).
// Vale quem está logado (1 voto por conta) e visitante (1 voto por aparelho). Fecha 3 horas depois do jogo.
// Precisa do SQL 0005; sem ele, o quadro não aparece.
import { useCallback, useEffect, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { NOMES_TIMES } from "@/lib/evento";
import type { Partida } from "@/lib/partida";

const CHAVE_APARELHO = "masorteio:aparelho";

export function idDoAparelho(): string {
  try {
    let id = window.localStorage.getItem(CHAVE_APARELHO);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(CHAVE_APARELHO, id);
    }
    return id;
  } catch {
    return "";
  }
}

export type VotoCraque = { partida_id: string; votado_id: string; votos: number };

// Votos de craque de todos os jogos do dia (lista vazia se o SQL 0005 não rodou).
export async function carregarCraques(eventoId: string): Promise<VotoCraque[]> {
  const { data, error } = await criarClienteSupabase().rpc("craques_partidas", { p_evento: eventoId });
  if (error) return [];
  return ((data ?? []) as VotoCraque[]).map((v) => ({ ...v, votos: Number(v.votos) }));
}

// Quem é o craque de cada jogo (o mais votado; empate entram os dois).
export function craquesPorJogo(votos: VotoCraque[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const pid of new Set(votos.map((v) => v.partida_id))) {
    const vs = votos.filter((v) => v.partida_id === pid);
    const max = Math.max(...vs.map((v) => v.votos));
    m.set(pid, vs.filter((v) => v.votos === max).map((v) => v.votado_id));
  }
  return m;
}

type Props = {
  partida: Partida;
  times: string[][];
  nome: (id: string | null) => string;
  agoraServidor: number;
  aoVotar?: () => void;
};

export default function CraqueDaPartida({ partida, times, nome, agoraServidor, aoVotar }: Props) {
  const [meu, setMeu] = useState<string | null>(null);
  const [votos, setVotos] = useState<Map<string, number> | null>(null);
  const [funciona, setFunciona] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const sb = criarClienteSupabase();
    const [{ data: lista, error }, { data: eu }] = await Promise.all([
      sb.rpc("craques_partidas", { p_evento: partida.evento_id }),
      sb.rpc("meu_voto_partida", { p_partida: partida.id, p_aparelho: idDoAparelho() }),
    ]);
    if (error) return setFunciona(false);
    const m = new Map<string, number>();
    for (const v of (lista ?? []) as VotoCraque[]) if (v.partida_id === partida.id) m.set(v.votado_id, Number(v.votos));
    setVotos(m);
    setMeu((eu as string | null) ?? null);
  }, [partida.id, partida.evento_id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  const aberta = !!partida.encerrada_em && agoraServidor - new Date(partida.encerrada_em).getTime() < 3 * 3600_000;
  if (!funciona || !votos) return null;

  async function votar(id: string) {
    setErro(null);
    setMeu(id);
    if (navigator.vibrate) navigator.vibrate(30);
    const { error } = await criarClienteSupabase().rpc("votar_craque_partida", { p_partida: partida.id, p_votado: id, p_aparelho: idDoAparelho() });
    if (error) setErro(error.message);
    await carregar();
    aoVotar?.();
  }

  const total = [...votos.values()].reduce((s, n) => s + n, 0);
  const max = Math.max(0, ...votos.values());
  const lados = [partida.time_a, partida.time_b].map((t) => ({
    t,
    // O RESERVA (vaga vazia do sorteio) não recebe voto.
    ids: [...(times[t] ?? []), ...([t === partida.time_a ? partida.goleiro_a : partida.goleiro_b].filter((g): g is string => !!g && !(times[t] ?? []).includes(g)))].filter((id) => !/^RESERVA( \d+)?$/.test(nome(id))),
  }));

  return (
    <section className="flex flex-col gap-2 rounded-2xl border-2 border-roxo/30 bg-white p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">⭐ Craque do jogo {partida.numero}</span>
        <span className="text-xs text-apagado">
          {total} {total === 1 ? "voto" : "votos"}
          {aberta ? "" : " · fechou"}
        </span>
      </div>
      {aberta && !meu && <span className="text-[13px] text-apagado">Quem jogou mais? Toca no nome. Dá pra trocar depois.</span>}
      {lados.map((l) => (
        <div key={l.t} className="flex flex-col gap-1">
          <span className="text-[11px] font-bold tracking-wider text-apagado">{NOMES_TIMES[l.t].toUpperCase()}</span>
          <div className="flex flex-wrap gap-1.5">
            {l.ids.map((id) => {
              const n = votos.get(id) ?? 0;
              const lider = n > 0 && n === max;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={!aberta}
                  onClick={() => votar(id)}
                  aria-pressed={meu === id}
                  className={`flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${meu === id ? "border-roxo bg-roxo text-white" : lider ? "border-roxo bg-roxo-suave text-roxo-escuro" : "border-borda bg-white"}`}
                >
                  {lider && "⭐"} {nome(id)}
                  {n > 0 && <span className={`tabular-nums ${meu === id ? "text-white/80" : "text-apagado"}`}>{n}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {erro && <p className="text-sm text-alerta-escuro">{erro}</p>}
    </section>
  );
}
