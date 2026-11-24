"use client";
// Raridade das cartas (PROJETO.md 7.6):
// bronze no início; prata com 10 peladas na temporada; ouro com 25 peladas ou medalha no mês;
// "Destaque da semana" (preta) = craque da semana passada, vale 7 dias;
// "Jogador do mês" = craque do mês passado (cor escolhida por ele).
import { criarClienteSupabase } from "@/lib/supabase/client";
import { calcularEstatisticas, carregarPeriodo, premioPorDias, type DadosPeriodo, type Linha } from "@/lib/estatisticas";
import { inicioMes, inicioSemana, isoDia, deIso } from "@/lib/datas";
import type { Membro } from "@/lib/pelada";
import type { Raridade } from "@/components/Carta";

export type InfoCarta = { raridade: Raridade; temporada: Linha | null; medalhasMes: number };

export const POS_CARTA: Record<string, string> = { D: "DEF", M: "MEI", A: "ATA", Q: "QLQ" };

export function posicaoCarta(m: Membro): string {
  return m.goleiro ? "GOL" : POS_CARTA[m.posicao] ?? "QLQ";
}

export function statsCarta(m: Membro, l: Linha | null, medalhas: number) {
  if (m.goleiro) {
    return [
      { v: l?.goleiro.jogos ?? 0, l: "JOG" },
      { v: l?.vitorias ?? 0, l: "VIT" },
      { v: l?.goleiro.semSofrer ?? 0, l: "S/GOL" },
      { v: medalhas, l: "MED" },
    ];
  }
  return [
    { v: l?.jogos ?? 0, l: "JOG" },
    { v: l?.vitorias ?? 0, l: "VIT" },
    { v: l?.gols ?? 0, l: "GOL" },
    { v: l?.assist ?? 0, l: "AST" },
  ];
}

// Calcula a carta de todo mundo da pelada de uma vez.
export async function carregarCartas(peladaId: string): Promise<{ cartas: Map<string, InfoCarta>; temporada: DadosPeriodo }> {
  const hoje = new Date();
  const anoIni = `${hoje.getFullYear()}-01-01`;
  const mesAtual = inicioMes(hoje);
  const semanaAtual = deIso(inicioSemana(hoje));
  const semanaPassadaIni = new Date(semanaAtual);
  semanaPassadaIni.setDate(semanaPassadaIni.getDate() - 7);
  const semanaPassadaFim = new Date(semanaAtual);
  semanaPassadaFim.setDate(semanaPassadaFim.getDate() - 1);
  const mesPassadoIni = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1, 12);
  const mesPassadoFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0, 12);

  // A temporada cobre quase tudo; o mês passado pode ser dezembro do ano anterior.
  const desde = mesPassadoIni < deIso(anoIni) ? isoDia(mesPassadoIni) : anoIni;
  const tudo = await carregarPeriodo(peladaId, desde);
  const filtrar = (de: string, ate: string): DadosPeriodo => {
    const evs = tudo.eventos.filter((e) => e.data >= de && e.data <= ate);
    const ids = new Set(evs.map((e) => e.id));
    const pids = new Set(tudo.partidas.filter((p) => ids.has(p.evento_id)).map((p) => p.id));
    return {
      eventos: evs,
      partidas: tudo.partidas.filter((p) => ids.has(p.evento_id)),
      lances: tudo.lances.filter((l) => pids.has(l.partida_id)),
      sorteios: tudo.sorteios.filter((s) => ids.has(s.evento_id)),
      presencas: tudo.presencas.filter((p) => ids.has(p.evento_id)),
      pausas: tudo.pausas.filter((p) => pids.has(p.partida_id)),
      votos: tudo.votos.filter((v) => ids.has(v.evento_id)),
    };
  };
  const temporada = filtrar(anoIni, isoDia(hoje));
  const estTemporada = calcularEstatisticas(temporada);
  const destaque = new Set(premioPorDias(filtrar(isoDia(semanaPassadaIni), isoDia(semanaPassadaFim)), "craque"));
  const doMes = new Set(premioPorDias(filtrar(isoDia(mesPassadoIni), isoDia(mesPassadoFim)), "craque"));
  const craquesMesAtual = premioPorDias(filtrar(mesAtual, isoDia(hoje)), "craque", true);

  const { data: med } = await criarClienteSupabase().from("medalhas").select("membro_id, periodo").gte("periodo", mesAtual.slice(0, 7));
  const medalhasMes = new Map<string, number>();
  for (const m of med ?? []) if (String(m.periodo).startsWith(mesAtual.slice(0, 7))) medalhasMes.set(m.membro_id, (medalhasMes.get(m.membro_id) ?? 0) + 1);
  for (const id of craquesMesAtual) medalhasMes.set(id, (medalhasMes.get(id) ?? 0) + 1);

  const cartas = new Map<string, InfoCarta>();
  const ids = new Set([...estTemporada.keys(), ...medalhasMes.keys(), ...destaque, ...doMes]);
  for (const id of ids) {
    const l = estTemporada.get(id) ?? null;
    const peladas = l?.peladas ?? 0;
    const meds = medalhasMes.get(id) ?? 0;
    let raridade: Raridade = "bronze";
    if (peladas >= 10) raridade = "prata";
    if (peladas >= 25 || meds > 0) raridade = "ouro";
    if (destaque.has(id)) raridade = "destaque";
    if (doMes.has(id)) raridade = "mes";
    cartas.set(id, { raridade, temporada: l, medalhasMes: meds });
  }
  return { cartas, temporada };
}
