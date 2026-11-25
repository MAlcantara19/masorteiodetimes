"use client";
// Evento = o dia da pelada (lista, presença, sorteios, partidas).
import { criarClienteSupabase } from "@/lib/supabase/client";
import { isoDia } from "@/lib/datas";
import { notaDoMembro, type Membro } from "@/lib/pelada";
import { sortear, type JogadorSorteio } from "@/lib/sorteio";

export type Evento = {
  id: string;
  pelada_id: string;
  data: string;
  horario: string | null;
  status: "lista" | "sorteado" | "em_jogo" | "encerrado" | "cancelado";
  lista_texto: string | null;
  iniciado_em: string | null;
  encerrado_em: string | null;
  created_at: string;
};

export type Presenca = { membro_id: string; status: "confirmado" | "espera" | "saiu"; goleiro: boolean; ordem: number | null };

export type SorteioSalvo = {
  id: string;
  evento_id: string;
  numero: number;
  times: string[][];
  goleiros: (string | null)[] | null;
  espera: string[] | null;
  oficial: boolean;
};

export type Regra = { id: string; tipo: "junto" | "separar"; membros: string[] };

export type ConfigSorteio = {
  times: number;
  porTime: number;
  modo: "simples" | "completa";
  equilibrarPosicoes: boolean;
  goleiroFixo: boolean;
};

export const CONFIG_PADRAO: ConfigSorteio = { times: 3, porTime: 5, modo: "simples", equilibrarPosicoes: true, goleiroFixo: true };

// O evento "do momento": o mais recente a partir de ontem (pra não perder a pelada que passou da meia-noite).
// Com `lancarErro`, sem internet dá erro em vez de "nenhuma pelada" (a tela da partida usa pra manter o que já tem).
export async function eventoAtual(peladaId: string, lancarErro = false): Promise<Evento | null> {
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const { data, error } = await criarClienteSupabase()
    .from("eventos")
    .select("*")
    .eq("pelada_id", peladaId)
    .neq("status", "cancelado")
    .gte("data", isoDia(ontem))
    .order("data", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(5);
  if (error && lancarErro) throw new Error(error.message);
  const lista = (data ?? []) as Evento[];
  // Prefere o que está em andamento; senão o mais próximo.
  return lista.find((e) => e.status === "em_jogo") ?? lista.find((e) => e.status !== "encerrado") ?? lista[0] ?? null;
}

export async function ultimoEvento(peladaId: string): Promise<Evento | null> {
  const { data } = await criarClienteSupabase()
    .from("eventos")
    .select("*")
    .eq("pelada_id", peladaId)
    .neq("status", "cancelado")
    .order("data", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  return ((data ?? [])[0] as Evento) ?? null;
}

export async function carregarPresencas(eventoId: string): Promise<Presenca[]> {
  const { data } = await criarClienteSupabase().from("presencas").select("membro_id, status, goleiro, ordem").eq("evento_id", eventoId).order("ordem");
  return (data ?? []) as Presenca[];
}

export async function carregarSorteios(eventoId: string): Promise<SorteioSalvo[]> {
  const { data } = await criarClienteSupabase().from("sorteios").select("*").eq("evento_id", eventoId).order("numero");
  return (data ?? []) as SorteioSalvo[];
}

// Configuração do sorteio fica guardada no aparelho, por pelada.
export function lerConfig(slug: string): ConfigSorteio {
  try {
    const raw = window.localStorage.getItem(`masorteio:config:${slug}`);
    return raw ? { ...CONFIG_PADRAO, ...JSON.parse(raw) } : CONFIG_PADRAO;
  } catch {
    return CONFIG_PADRAO;
  }
}

export function salvarConfig(slug: string, c: ConfigSorteio) {
  try {
    window.localStorage.setItem(`masorteio:config:${slug}`, JSON.stringify(c));
  } catch {}
}

// Roda o algoritmo (src/lib/sorteio.ts) com os dados do banco.
export function rodarSorteio(
  linha: Membro[], // na ordem da lista (os últimos ficam na espera)
  goleiros: Membro[],
  cfg: ConfigSorteio,
  regras: Regra[],
): { times: string[][]; goleiros: (string | null)[]; espera: string[] } {
  const jogadores: JogadorSorteio[] = linha.map((m) => ({ id: m.id, nome: m.apelido || m.nome, nota: notaDoMembro(m, cfg.modo), posicao: m.posicao }));
  const ids = new Set(linha.map((m) => m.id));
  const r = sortear(jogadores, {
    times: cfg.times,
    porTime: cfg.porTime,
    juntos: regras.filter((x) => x.tipo === "junto").map((x) => x.membros.filter((id) => ids.has(id))),
    separar: regras
      .filter((x) => x.tipo === "separar" && x.membros.length === 2 && x.membros.every((id) => ids.has(id)))
      .map((x) => [x.membros[0], x.membros[1]] as [string, string]),
    equilibrarPosicoes: cfg.equilibrarPosicoes,
  });
  // Goleiro fixo: um por time, na ordem da lista (fora da média).
  const gk: (string | null)[] = Array.from({ length: cfg.times }, (_, i) => (cfg.goleiroFixo ? (goleiros[i]?.id ?? null) : null));
  return { times: r.times.map((t) => t.map((j) => j.id)), goleiros: gk, espera: r.espera.map((j) => j.id) };
}

export const NOMES_TIMES = ["Time 1", "Time 2", "Time 3", "Time 4", "Time 5"];
export const CORES_TIMES = ["#7444D6", "#1A8F4E", "#B4460B", "#1B6FD6", "#C2185B"];
