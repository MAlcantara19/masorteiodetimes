"use client";
// Regras da partida ao vivo: tempo calculado pelo banco, fila "quem ganha fica" e envio das ações.
import { criarClienteSupabase } from "@/lib/supabase/client";
import type { Pelada } from "@/lib/pelada";

export type Partida = {
  id: string;
  evento_id: string;
  numero: number;
  time_a: number;
  time_b: number;
  goleiro_a: string | null;
  goleiro_b: string | null;
  goleiro_a_linha: boolean;
  goleiro_b_linha: boolean;
  duracao_seg: number;
  inicio_em: string | null;
  pausado_em: string | null;
  segundos_pausados: number;
  encerrada_em: string | null;
  status: "aguardando" | "rolando" | "pausado" | "encerrada";
  placar_a: number;
  placar_b: number;
  vencedor: number | null;
};

export type Lance = {
  id: string;
  partida_id: string;
  tipo: "gol" | "gol_contra";
  time: number;
  autor_id: string | null;
  assist_id: string | null;
  minuto: number | null;
  criado_por_nome: string | null;
  desfeito: boolean;
  created_at: string;
};

export type Pausa = { id: string; partida_id: string; inicio: string; fim: string | null; motivo: string | null };

// ---------- Relógio ----------

// Diferença entre o relógio do servidor e o do aparelho (ms). Todo mundo calcula com a hora do servidor.
export async function medirDiferencaRelogio(): Promise<number> {
  const sb = criarClienteSupabase();
  let melhor = { ida: Infinity, dif: 0 };
  // 3 medições, fica com a de resposta mais rápida (mais precisa).
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    const { data } = await sb.rpc("hora_servidor");
    const t1 = Date.now();
    if (!data) continue;
    const ida = t1 - t0;
    const dif = new Date(data as string).getTime() - (t0 + ida / 2);
    if (ida < melhor.ida) melhor = { ida, dif };
  }
  return melhor.dif;
}

// Segundos de bola rolando.
export function segundosRolando(p: Partida, agoraServidor: number): number {
  if (!p.inicio_em) return 0;
  const fim = p.pausado_em ?? p.encerrada_em;
  const ate = fim ? new Date(fim).getTime() : agoraServidor;
  return Math.max(0, (ate - new Date(p.inicio_em).getTime()) / 1000 - p.segundos_pausados);
}

export function formatarRelogio(seg: number): string {
  const s = Math.max(0, Math.ceil(seg));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function textoRegra(p: Pick<Pelada, "regra_fim" | "minutos" | "gols_limite">): string {
  if (p.regra_fim === "tempo") return `${p.minutos} min (só tempo)`;
  if (p.regra_fim === "gols") return `${p.gols_limite} gols`;
  return `${p.minutos} min ou ${p.gols_limite} gols`;
}

// ---------- Fila "quem ganha fica" ----------

export type Fila = { proximo: [number, number] | null; espera: number[] };

// Refaz a fila a partir dos jogos já encerrados. `regra` = o que fazer no empate.
export function calcularFila(qtdTimes: number, partidas: Partida[], regra: Pelada["regra_empate"]): Fila {
  const ordenadas = [...partidas].sort((a, b) => a.numero - b.numero);
  const todos = Array.from({ length: qtdTimes }, (_, i) => i);
  if (!ordenadas.length) return { proximo: qtdTimes >= 2 ? [0, 1] : null, espera: todos.slice(2) };

  let fila = todos.filter((t) => t !== ordenadas[0].time_a && t !== ordenadas[0].time_b);
  let anterior: Partida | null = null;
  let sugestao: [number, number] | null = null;

  for (const p of ordenadas) {
    // Se o jogo real foi diferente da sugestão, tira da fila quem entrou.
    fila = fila.filter((t) => t !== p.time_a && t !== p.time_b);
    if (sugestao) for (const t of sugestao) if (t !== p.time_a && t !== p.time_b && !fila.includes(t)) fila.unshift(t);
    if (p.status !== "encerrada") return { proximo: null, espera: fila };

    const a = p.time_a;
    const b = p.time_b;
    // Quem "já estava" é quem também jogou o jogo anterior.
    const veterano = anterior && (anterior.time_a === a || anterior.time_b === a) ? a : anterior && (anterior.time_a === b || anterior.time_b === b) ? b : a;
    const novato = veterano === a ? b : a;
    let vencedor = p.vencedor;
    if (vencedor === null && p.placar_a !== p.placar_b) vencedor = p.placar_a > p.placar_b ? a : b;

    if (fila.length === 0) {
      sugestao = [a, b];
    } else if (vencedor !== null) {
      const perdedor = vencedor === a ? b : a;
      fila.push(perdedor);
      sugestao = [vencedor, fila.shift() as number];
    } else if (regra === "sai_os_dois") {
      fila.push(veterano, novato);
      sugestao = [fila.shift() as number, fila.shift() as number];
    } else {
      // sai quem já estava (ou, nos pênaltis sem vencedor marcado, o mesmo)
      fila.push(veterano);
      sugestao = [novato, fila.shift() as number];
    }
    anterior = p;
  }
  return { proximo: sugestao, espera: fila };
}

// ---------- Ações (com fila offline) ----------

type Acao = { partida: string; acao: string; dados: Record<string, unknown>; pin: string | null; nome: string | null };
const CHAVE_FILA = "masorteio:fila-acoes";

function lerFila(): Acao[] {
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE_FILA) || "[]");
  } catch {
    return [];
  }
}
function gravarFila(f: Acao[]) {
  try {
    window.localStorage.setItem(CHAVE_FILA, JSON.stringify(f));
  } catch {}
}

export function acoesPendentes(): number {
  return typeof window === "undefined" ? 0 : lerFila().length;
}

function ehErroDeRede(msg: string) {
  return /fetch|network|Failed|Load failed|timeout/i.test(msg);
}

// Manda a ação pro banco. Sem internet, guarda e reenvia depois.
export async function enviarAcao(a: Acao): Promise<{ ok: boolean; erro?: string; offline?: boolean }> {
  const sb = criarClienteSupabase();
  try {
    const { error } = await sb.rpc("acao_partida", { p_partida: a.partida, p_acao: a.acao, p_dados: a.dados, p_pin: a.pin, p_nome: a.nome });
    if (!error) return { ok: true };
    if (ehErroDeRede(error.message)) throw new Error(error.message);
    return { ok: false, erro: error.message };
  } catch {
    gravarFila([...lerFila(), a]);
    return { ok: false, offline: true };
  }
}

let reenviando = false;
export async function reenviarPendentes(): Promise<number> {
  if (reenviando) return lerFila().length;
  reenviando = true;
  const sb = criarClienteSupabase();
  try {
    let fila = lerFila();
    while (fila.length) {
      const a = fila[0];
      const { error } = await sb.rpc("acao_partida", { p_partida: a.partida, p_acao: a.acao, p_dados: a.dados, p_pin: a.pin, p_nome: a.nome });
      if (error && ehErroDeRede(error.message)) break; // ainda sem internet
      fila = fila.slice(1); // enviada (ou recusada de vez): tira da fila
      gravarFila(fila);
    }
    return fila.length;
  } catch {
    return lerFila().length;
  } finally {
    reenviando = false;
  }
}

// PIN e nome do visitante ficam guardados no aparelho, por pelada.
export function lerPin(peladaId: string): { pin: string; nome: string } | null {
  try {
    const raw = window.localStorage.getItem(`masorteio:pin:${peladaId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function gravarPin(peladaId: string, v: { pin: string; nome: string } | null) {
  try {
    if (v) window.localStorage.setItem(`masorteio:pin:${peladaId}`, JSON.stringify(v));
    else window.localStorage.removeItem(`masorteio:pin:${peladaId}`);
  } catch {}
}
