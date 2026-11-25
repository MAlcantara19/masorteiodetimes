"use client";
// Raridade das cartas (PROJETO.md 7.6):
// bronze no início; prata com 10 peladas na temporada; ouro com 25 peladas ou medalha no mês;
// "Destaque da semana" (preta) = craque da semana passada, vale 7 dias;
// "Jogador do mês" = craque do mês passado (cor escolhida por ele).
import { criarClienteSupabase } from "@/lib/supabase/client";
import { calcularEstatisticas, carregarPeriodo, lideres, premioPorDias, type DadosPeriodo, type Linha } from "@/lib/estatisticas";
import { inicioMes, inicioSemana, isoDia, deIso } from "@/lib/datas";
import { type Membro } from "@/lib/pelada";
import type { Raridade } from "@/components/Carta";
import { calcularConquistas, seloDe, type Ganha } from "@/lib/conquistas";

// raridade = a carta automática; desbloqueadas = especiais que o jogador já pode escolher.
export type InfoCarta = {
  raridade: Raridade;
  temporada: Linha | null;
  medalhasMes: number;
  desbloqueadas: Raridade[];
  artilheiroSemana?: boolean; // evento: artilheiro da semana passada ganha a carta Artilheiro por 7 dias
  conquistas?: Ganha[]; // conquistas da temporada (selos no card)
};

// Até 4 selos de conquista pra mostrar no card.
export const selosCarta = (info: InfoCarta | undefined | null) => (info?.conquistas ?? []).slice(0, 4).map(seloDe);

export function ehAniversario(nascimento?: string | null, hoje = new Date()): boolean {
  if (!nascimento) return false;
  const [, m, d] = nascimento.split("-").map(Number);
  return m === hoje.getMonth() + 1 && d === hoje.getDate();
}

// Selo especial da carta nos dias de evento.
export function rotuloEvento(info: InfoCarta | undefined | null, nascimento?: string | null): string | undefined {
  if (ehAniversario(nascimento)) return "🎂 ANIVERSARIANTE";
  if (info?.artilheiroSemana && info.raridade !== "destaque" && info.raridade !== "mes") return "ARTILHEIRO DA SEMANA";
  return undefined;
}

// Carta que aparece: destaque da semana e jogador do mês sempre ganham; senão a escolhida (se liberada).
export function cartaFinal(info: InfoCarta | undefined | null, escolhida?: string | null, nascimento?: string | null): Raridade {
  if (ehAniversario(nascimento)) return "aniversario";
  if (!info) return "bronze";
  if (info.raridade === "destaque" || info.raridade === "mes") return info.raridade;
  if (info.artilheiroSemana) return "artilheiro";
  if (escolhida && (info.desbloqueadas as string[]).includes(escolhida)) return escolhida as Raridade;
  return info.raridade;
}

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
  const conquistas = calcularConquistas(temporada);
  const semanaPassada = filtrar(isoDia(semanaPassadaIni), isoDia(semanaPassadaFim));
  const destaque = new Set(premioPorDias(semanaPassada, "craque"));
  const artSemana = new Set(lideres([...calcularEstatisticas(semanaPassada).values()], (l) => l.gols).ids);
  const doMes = new Set(premioPorDias(filtrar(isoDia(mesPassadoIni), isoDia(mesPassadoFim)), "craque"));
  const craquesMesAtual = premioPorDias(filtrar(mesAtual, isoDia(hoje)), "craque", true);

  const ids = new Set(temporada.eventos.length ? [...estTemporada.keys()] : []);
  const { data: med } = await criarClienteSupabase().from("medalhas").select("membro_id, tipo, periodo").gte("periodo", anoIni.slice(0, 4));
  const medalhasMes = new Map<string, number>();
  const especiais = new Map<string, Set<Raridade>>();
  const liberar = (id: string, r: Raridade) => especiais.set(id, (especiais.get(id) ?? new Set<Raridade>()).add(r));
  for (const m of med ?? []) {
    if (!ids.has(m.membro_id) && !estTemporada.has(m.membro_id)) continue;
    if (String(m.periodo).startsWith(mesAtual.slice(0, 7))) medalhasMes.set(m.membro_id, (medalhasMes.get(m.membro_id) ?? 0) + 1);
    if (m.tipo === "artilheiro") liberar(m.membro_id, "artilheiro");
    if (m.tipo === "garcom") liberar(m.membro_id, "garcom");
    if (m.tipo === "muralha") liberar(m.membro_id, "muralha");
  }
  for (const id of craquesMesAtual) medalhasMes.set(id, (medalhasMes.get(id) ?? 0) + 1);
  for (const id of premioPorDias(temporada, "craque", true)) liberar(id, "lenda");

  const cartas = new Map<string, InfoCarta>();
  const todos = new Set([...estTemporada.keys(), ...medalhasMes.keys(), ...destaque, ...doMes, ...especiais.keys(), ...artSemana]);
  for (const id of todos) {
    const l = estTemporada.get(id) ?? null;
    const peladas = l?.peladas ?? 0;
    const meds = medalhasMes.get(id) ?? 0;
    let raridade: Raridade = "bronze";
    if (peladas >= 10) raridade = "prata";
    if (peladas >= 25 || meds > 0) raridade = "ouro";
    if (destaque.has(id)) raridade = "destaque";
    if (doMes.has(id)) raridade = "mes";
    const base: Raridade[] = raridade === "ouro" ? ["bronze", "prata", "ouro"] : raridade === "prata" ? ["bronze", "prata"] : ["bronze"];
    cartas.set(id, { raridade, temporada: l, medalhasMes: meds, desbloqueadas: [...base, ...(especiais.get(id) ?? [])], artilheiroSemana: artSemana.has(id), conquistas: conquistas.get(id) ?? [] });
  }
  return { cartas, temporada };
}

// Pontuação da seleção: votos de craque pesam mais, depois gols, assistências e vitórias.
const pontuar = (l: Linha) => l.votos.craque * 3 + l.gols * 2 + l.assist * 2 + l.vitorias;

export function montarSelecao(elenco: Membro[], est: Map<string, Linha>) {
  const com = elenco.filter((m) => est.get(m.id)?.jogos || est.get(m.id)?.goleiro.jogos);
  const goleiros = com
    .filter((m) => (est.get(m.id)?.goleiro.jogos ?? 0) > 0)
    .sort((a, b) => {
      const la = est.get(a.id) as Linha;
      const lb = est.get(b.id) as Linha;
      return lb.votos.goleiro - la.votos.goleiro || la.goleiro.sofridos / la.goleiro.jogos - lb.goleiro.sofridos / lb.goleiro.jogos;
    });
  const linha = com.filter((m) => !m.goleiro).sort((a, b) => pontuar(est.get(b.id) as Linha) - pontuar(est.get(a.id) as Linha));
  const usados = new Set<string>();
  const pegar = (pref: string[], n: number) => {
    const r: Membro[] = [];
    for (const m of [...linha.filter((x) => pref.includes(x.posicao)), ...linha]) {
      if (r.length === n) break;
      if (!usados.has(m.id)) {
        usados.add(m.id);
        r.push(m);
      }
    }
    return r;
  };
  const ataque = pegar(["A"], 2);
  const meio = pegar(["M", "Q", "D"], 2);
  return { goleiro: goleiros[0] ?? null, meio, ataque };
}


export type PerfilPublico = { id: string; foto_url: string | null; cor_card: string | null; estilo_card?: string | null };

// Foto, cor e design de carta de várias pessoas. Funciona mesmo antes do SQL 0002 (sem estilo_card).
export async function carregarPerfisPublicos(ids: string[]): Promise<Map<string, PerfilPublico>> {
  if (!ids.length) return new Map();
  const sb = criarClienteSupabase();
  const r = await sb.from("perfis_publicos").select("id, foto_url, cor_card, estilo_card").in("id", ids);
  let lista = (r.data ?? []) as PerfilPublico[];
  if (r.error) lista = ((await sb.from("perfis_publicos").select("id, foto_url, cor_card").in("id", ids)).data ?? []) as PerfilPublico[];
  return new Map(lista.map((p) => [p.id, p]));
}
