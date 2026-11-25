"use client";
// Estatísticas a partir dos jogos: gols, assistências, vitórias, goleiros e votos.
// Usado no fim da pelada, campeonato, perfil, cards e banners. Nunca usa notas/estrelas.
import { criarClienteSupabase } from "@/lib/supabase/client";
import type { Evento, Presenca, SorteioSalvo } from "@/lib/evento";
import type { Lance, Partida, Pausa } from "@/lib/partida";

export type Voto = { evento_id: string; categoria: "craque" | "bagre" | "goleiro"; votado_id: string; votos: number };

export type DadosPeriodo = {
  eventos: Evento[];
  partidas: Partida[];
  lances: Lance[];
  sorteios: SorteioSalvo[]; // só o oficial (ou o último) de cada evento
  presencas: (Presenca & { evento_id: string })[];
  pausas: Pausa[];
  votos: Voto[];
};

type Pedido = (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>;

// O Supabase devolve no máximo 1000 linhas por pedido: busca de 1000 em 1000 até acabar.
async function todasAsLinhas<T>(pedido: Pedido): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await pedido(de, de + 999);
    if (error || !data) break;
    out.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return out;
}

// Lista grande de ids vira vários pedidos pequenos (a URL do pedido tem limite de tamanho).
async function emLotes<T>(ids: string[], pedido: (lote: string[]) => Pedido): Promise<T[]> {
  const lotes: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) lotes.push(ids.slice(i, i + 100));
  return (await Promise.all(lotes.map((l) => todasAsLinhas<T>(pedido(l))))).flat();
}

// Votos de vários dias num pedido só (SQL 0006); sem ele, um pedido por dia.
async function carregarVotos(ids: string[]): Promise<Voto[]> {
  const sb = criarClienteSupabase();
  const lotes: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) lotes.push(ids.slice(i, i + 100));
  const r = await Promise.all(lotes.map((l) => sb.rpc("contagem_votos_eventos", { p_eventos: l })));
  if (r.every((x) => !x.error)) return r.flatMap((x) => ((x.data ?? []) as Voto[]).map((v) => ({ ...v, votos: Number(v.votos) })));
  const porEvento = await Promise.all(
    ids.map((id) => sb.rpc("contagem_votos", { p_evento: id }).then(({ data }) => ((data ?? []) as Omit<Voto, "evento_id">[]).map((v) => ({ ...v, evento_id: id, votos: Number(v.votos) })))),
  );
  return porEvento.flat();
}

// Carrega tudo de uma pelada entre duas datas ("AAAA-MM-DD"), ou de eventos específicos.
// O RESERVA (vaga vazia do sorteio) sai daqui: não entra em ranking, card nem estatística.
export async function carregarPeriodo(peladaId: string, desde?: string, ate?: string, eventoIds?: string[]): Promise<DadosPeriodo> {
  const sb = criarClienteSupabase();
  const eventos = await todasAsLinhas<Evento>((de, a) => {
    let q = sb.from("eventos").select("*").eq("pelada_id", peladaId).neq("status", "cancelado");
    if (desde) q = q.gte("data", desde);
    if (ate) q = q.lte("data", ate);
    if (eventoIds) q = q.in("id", eventoIds);
    return q.order("data").order("id").range(de, a);
  });
  const ids = eventos.map((e) => e.id);
  if (!ids.length) return { eventos, partidas: [], lances: [], sorteios: [], presencas: [], pausas: [], votos: [] };

  const [partidas, todos, presencas, reservasDb] = await Promise.all([
    emLotes<Partida>(ids, (l) => (de, a) => sb.from("partidas").select("*").in("evento_id", l).order("numero").order("id").range(de, a)),
    emLotes<SorteioSalvo>(ids, (l) => (de, a) => sb.from("sorteios").select("*").in("evento_id", l).order("numero").order("id").range(de, a)),
    emLotes<Presenca & { evento_id: string }>(ids, (l) => (de, a) => sb.from("presencas").select("evento_id, membro_id, status, goleiro, ordem").in("evento_id", l).order("membro_id").order("evento_id").range(de, a)),
    sb.from("membros").select("id").eq("pelada_id", peladaId).eq("convidado", true).eq("ativo", false).like("nome", "RESERVA%"),
  ]);
  partidas.sort((a, b) => a.numero - b.numero);
  const pids = partidas.map((p) => p.id);
  const [lances, pausas, votos] = await Promise.all([
    emLotes<Lance>(pids, (l) => (de, a) => sb.from("lances").select("*").in("partida_id", l).eq("desfeito", false).order("created_at").order("id").range(de, a)),
    emLotes<Pausa>(pids, (l) => (de, a) => sb.from("pausas").select("*").in("partida_id", l).order("id").range(de, a)),
    carregarVotos(ids),
  ]);
  lances.sort((a, b) => a.created_at.localeCompare(b.created_at));

  const reserva = new Set(((reservasDb.data ?? []) as { id: string }[]).map((m) => m.id));
  const tira = (id: string | null) => (id && reserva.has(id) ? null : id);

  // Um sorteio por evento: o oficial, senão o último.
  const sorteios = ids
    .map((id) => {
      const doEvento = todos.filter((s) => s.evento_id === id).sort((a, b) => a.numero - b.numero);
      return doEvento.find((s) => s.oficial) ?? doEvento[doEvento.length - 1];
    })
    .filter((s): s is SorteioSalvo => !!s)
    .map((s) => (reserva.size ? { ...s, times: s.times.map((t) => t.filter((id) => !reserva.has(id))) } : s));

  return {
    eventos,
    partidas,
    lances: reserva.size ? lances.map((l) => ({ ...l, autor_id: tira(l.autor_id), assist_id: tira(l.assist_id) })) : lances,
    sorteios,
    presencas: presencas.filter((p) => !reserva.has(p.membro_id)),
    pausas,
    votos: votos.filter((v) => !reserva.has(v.votado_id)),
  };
}

export type Linha = {
  membro_id: string;
  peladas: number;
  jogos: number;
  gols: number;
  assist: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  pontos: number; // 3 por vitória + 1 por gol
  goleiro: { jogos: number; sofridos: number; semSofrer: number }; // goleiro de verdade
  linhaNoGol: { jogos: number; sofridos: number }; // de linha que foi pro gol (não concorre)
  votos: { craque: number; bagre: number; goleiro: number };
};

function novaLinha(id: string): Linha {
  return {
    membro_id: id, peladas: 0, jogos: 0, gols: 0, assist: 0, vitorias: 0, empates: 0, derrotas: 0, pontos: 0,
    goleiro: { jogos: 0, sofridos: 0, semSofrer: 0 }, linhaNoGol: { jogos: 0, sofridos: 0 },
    votos: { craque: 0, bagre: 0, goleiro: 0 },
  };
}

export function vencedorDe(p: Partida): number | null {
  if (p.vencedor !== null && p.vencedor !== undefined) return p.vencedor;
  if (p.placar_a === p.placar_b) return null;
  return p.placar_a > p.placar_b ? p.time_a : p.time_b;
}

export function calcularEstatisticas(d: DadosPeriodo): Map<string, Linha> {
  const m = new Map<string, Linha>();
  const L = (id: string) => {
    if (!m.has(id)) m.set(id, novaLinha(id));
    return m.get(id) as Linha;
  };
  const sorteioDo = new Map(d.sorteios.map((s) => [s.evento_id, s]));

  // Peladas: quem estava no sorteio oficial (linha ou goleiro) ou confirmado na presença.
  for (const e of d.eventos) {
    const s = sorteioDo.get(e.id);
    const ids = new Set<string>([...(s?.times.flat() ?? []), ...((s?.goleiros ?? []).filter(Boolean) as string[])]);
    if (e.status === "encerrado" || e.status === "em_jogo") {
      d.presencas.filter((p) => p.evento_id === e.id && p.status === "confirmado").forEach((p) => ids.add(p.membro_id));
    }
    if (d.partidas.some((p) => p.evento_id === e.id)) ids.forEach((id) => L(id).peladas++);
  }

  for (const p of d.partidas) {
    if (p.status !== "encerrada") continue;
    const s = sorteioDo.get(p.evento_id);
    if (!s) continue;
    const v = vencedorDe(p);
    const lados = [
      { time: p.time_a, sofreu: p.placar_b, gk: p.goleiro_a, linha: p.goleiro_a_linha },
      { time: p.time_b, sofreu: p.placar_a, gk: p.goleiro_b, linha: p.goleiro_b_linha },
    ];
    for (const lado of lados) {
      for (const id of s.times[lado.time] ?? []) {
        const l = L(id);
        l.jogos++;
        if (v === null) l.empates++;
        else if (v === lado.time) l.vitorias++;
        else l.derrotas++;
      }
      if (lado.gk) {
        const g = L(lado.gk);
        if (lado.linha) {
          g.linhaNoGol.jogos++;
          g.linhaNoGol.sofridos += lado.sofreu;
        } else {
          g.goleiro.jogos++;
          g.goleiro.sofridos += lado.sofreu;
          if (lado.sofreu === 0) g.goleiro.semSofrer++;
          // goleiro fixo também ganha a vitória do time
          if (!(s.times[lado.time] ?? []).includes(lado.gk)) {
            if (v === null) g.empates++;
            else if (v === lado.time) g.vitorias++;
            else g.derrotas++;
          }
        }
      }
    }
  }

  const encerradas = new Set(d.partidas.map((p) => p.id));
  for (const l of d.lances) {
    if (l.desfeito || !encerradas.has(l.partida_id)) continue;
    if (l.tipo === "gol" && l.autor_id) L(l.autor_id).gols++;
    if (l.assist_id) L(l.assist_id).assist++;
  }
  for (const v of d.votos) L(v.votado_id).votos[v.categoria] += v.votos;
  for (const l of m.values()) l.pontos = l.vitorias * 3 + l.gols;
  return m;
}

// Quem lidera um critério (empates entram juntos). Ignora quem tem zero.
export function lideres(linhas: Linha[], valor: (l: Linha) => number, menorMelhor = false): { ids: string[]; valor: number } {
  const com = linhas.filter((l) => valor(l) !== null && !Number.isNaN(valor(l)));
  if (!com.length) return { ids: [], valor: 0 };
  const melhor = menorMelhor ? Math.min(...com.map(valor)) : Math.max(...com.map(valor));
  if (!menorMelhor && melhor <= 0) return { ids: [], valor: 0 };
  return { ids: com.filter((l) => valor(l) === melhor).map((l) => l.membro_id), valor: melhor };
}

export type Premios = {
  artilheiro: { ids: string[]; valor: number };
  garcom: { ids: string[]; valor: number };
  muralha: { ids: string[]; valor: number }; // menos gols sofridos por jogo (só goleiro de verdade)
  craque: { ids: string[]; valor: number };
  bagre: { ids: string[]; valor: number };
  goleiroVotado: { ids: string[]; valor: number };
  maisVitorioso: { ids: string[]; valor: number };
};

export function calcularPremios(est: Map<string, Linha>): Premios {
  const linhas = [...est.values()];
  const goleiros = linhas.filter((l) => l.goleiro.jogos > 0);
  return {
    artilheiro: lideres(linhas, (l) => l.gols),
    garcom: lideres(linhas, (l) => l.assist),
    muralha: lideres(goleiros, (l) => l.goleiro.sofridos / l.goleiro.jogos, true),
    craque: lideres(linhas, (l) => l.votos.craque),
    bagre: lideres(linhas, (l) => l.votos.bagre),
    goleiroVotado: lideres(linhas, (l) => l.votos.goleiro),
    maisVitorioso: lideres(linhas, (l) => l.vitorias),
  };
}

// Tempo do dia: bola rolando × do primeiro apito ao último.
export function temposDoDia(partidas: Partida[]): { rolando: number; total: number } {
  let rolando = 0;
  let inicio = Infinity;
  let fim = 0;
  for (const p of partidas) {
    if (!p.inicio_em || !p.encerrada_em) continue;
    const i = new Date(p.inicio_em).getTime();
    const f = new Date(p.encerrada_em).getTime();
    rolando += Math.max(0, (f - i) / 1000 - p.segundos_pausados);
    inicio = Math.min(inicio, i);
    fim = Math.max(fim, f);
  }
  return { rolando, total: fim > inicio ? (fim - inicio) / 1000 : 0 };
}

export function duracaoTexto(seg: number): string {
  const min = Math.round(seg / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

// Prêmio de votação num período = quem ganhou mais dias (desempate: total de votos).
// Com `todosOsDias`, devolve o vencedor de cada dia (repetido se ganhou mais de um).
export function premioPorDias(d: DadosPeriodo, cat: "craque" | "bagre", todosOsDias = false): string[] {
  const vitorias = new Map<string, number>();
  const diarios: string[] = [];
  for (const e of d.eventos) {
    const vs = d.votos.filter((v) => v.evento_id === e.id && v.categoria === cat);
    if (!vs.length) continue;
    const max = Math.max(...vs.map((v) => v.votos));
    vs.filter((v) => v.votos === max).forEach((v) => {
      vitorias.set(v.votado_id, (vitorias.get(v.votado_id) ?? 0) + 1);
      diarios.push(v.votado_id);
    });
  }
  if (todosOsDias) return diarios;
  if (!vitorias.size) return [];
  const total = (id: string) => d.votos.filter((v) => v.votado_id === id && v.categoria === cat).reduce((s, v) => s + v.votos, 0);
  const ord = [...vitorias.entries()].sort((a, b) => b[1] - a[1] || total(b[0]) - total(a[0]));
  return ord.filter((x) => x[1] === ord[0][1] && total(x[0]) === total(ord[0][0])).map((x) => x[0]);
}

// Recorta um período de dados já carregados (sem ir de novo no banco).
export function filtrarPeriodo(tudo: DadosPeriodo, de?: string, ate?: string): DadosPeriodo {
  const evs = tudo.eventos.filter((e) => (!de || e.data >= de) && (!ate || e.data <= ate));
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
}

// Quem esteve em cada pelada (dia com jogo): sorteio oficial + confirmados.
export function presentesPorDia(d: DadosPeriodo): { evento_id: string; data: string; ids: Set<string> }[] {
  const sorteioDo = new Map(d.sorteios.map((s) => [s.evento_id, s]));
  return d.eventos
    .filter((e) => d.partidas.some((p) => p.evento_id === e.id))
    .map((e) => {
      const s = sorteioDo.get(e.id);
      const ids = new Set<string>([...(s?.times.flat() ?? []), ...((s?.goleiros ?? []).filter(Boolean) as string[])]);
      d.presencas.filter((p) => p.evento_id === e.id && p.status === "confirmado").forEach((p) => ids.add(p.membro_id));
      return { evento_id: e.id, data: e.data, ids };
    });
}
