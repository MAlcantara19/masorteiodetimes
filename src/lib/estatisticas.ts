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

// Carrega tudo de uma pelada entre duas datas ("AAAA-MM-DD"), ou de eventos específicos.
export async function carregarPeriodo(peladaId: string, desde?: string, ate?: string, eventoIds?: string[]): Promise<DadosPeriodo> {
  const sb = criarClienteSupabase();
  let q = sb.from("eventos").select("*").eq("pelada_id", peladaId).neq("status", "cancelado").order("data");
  if (desde) q = q.gte("data", desde);
  if (ate) q = q.lte("data", ate);
  if (eventoIds) q = q.in("id", eventoIds);
  const { data: evs } = await q;
  const eventos = (evs ?? []) as Evento[];
  const ids = eventos.map((e) => e.id);
  if (!ids.length) return { eventos, partidas: [], lances: [], sorteios: [], presencas: [], pausas: [], votos: [] };

  const [{ data: ps }, { data: ss }, { data: pr }] = await Promise.all([
    sb.from("partidas").select("*").in("evento_id", ids).order("numero"),
    sb.from("sorteios").select("*").in("evento_id", ids).order("numero"),
    sb.from("presencas").select("evento_id, membro_id, status, goleiro, ordem").in("evento_id", ids),
  ]);
  const partidas = (ps ?? []) as Partida[];
  const pids = partidas.map((p) => p.id);
  const [{ data: ls }, { data: pa }, votosPorEvento] = await Promise.all([
    pids.length ? sb.from("lances").select("*").in("partida_id", pids).eq("desfeito", false).order("created_at") : Promise.resolve({ data: [] }),
    pids.length ? sb.from("pausas").select("*").in("partida_id", pids) : Promise.resolve({ data: [] }),
    Promise.all(ids.map((id) => sb.rpc("contagem_votos", { p_evento: id }).then(({ data }) => ((data ?? []) as Omit<Voto, "evento_id">[]).map((v) => ({ ...v, evento_id: id, votos: Number(v.votos) }))))),
  ]);

  // Um sorteio por evento: o oficial, senão o último.
  const todos = (ss ?? []) as SorteioSalvo[];
  const sorteios = ids
    .map((id) => {
      const doEvento = todos.filter((s) => s.evento_id === id);
      return doEvento.find((s) => s.oficial) ?? doEvento[doEvento.length - 1];
    })
    .filter((s): s is SorteioSalvo => !!s);

  return {
    eventos,
    partidas,
    lances: (ls ?? []) as Lance[],
    sorteios,
    presencas: (pr ?? []) as (Presenca & { evento_id: string })[],
    pausas: (pa ?? []) as Pausa[],
    votos: votosPorEvento.flat(),
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
