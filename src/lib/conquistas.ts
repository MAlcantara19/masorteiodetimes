// Conquistas do jogador (hat-trick, 10 peladas seguidas, muralha…), calculadas a partir dos jogos.
// Aparecem como selos no card e na página do jogador. Nunca usam nota/estrela.
import { vencedorDe, type DadosPeriodo } from "@/lib/estatisticas";

export type IdConquista =
  | "hat_trick"
  | "goleador_dia"
  | "garcom_dia"
  | "invicto_dia"
  | "pe_quente"
  | "seguidas_10"
  | "jogos_50"
  | "jogos_100"
  | "paredao"
  | "artilheiro_mes"
  | "garcom_mes"
  | "muralha_mes";

export type Conquista = { id: IdConquista; emoji: string; titulo: string; como: string };

export const CONQUISTAS: Record<IdConquista, Conquista> = {
  hat_trick: { id: "hat_trick", emoji: "🎩", titulo: "Hat-trick", como: "3 gols num jogo só" },
  goleador_dia: { id: "goleador_dia", emoji: "💥", titulo: "Dia de artilheiro", como: "5 gols numa pelada" },
  garcom_dia: { id: "garcom_dia", emoji: "🍽️", titulo: "Garçom do dia", como: "3 assistências numa pelada" },
  invicto_dia: { id: "invicto_dia", emoji: "🛡️", titulo: "Invicto", como: "pelada inteira sem perder (3 jogos ou mais)" },
  pe_quente: { id: "pe_quente", emoji: "🔥", titulo: "Pé quente", como: "5 vitórias seguidas" },
  seguidas_10: { id: "seguidas_10", emoji: "📅", titulo: "10 seguidas", como: "10 peladas seguidas sem faltar" },
  jogos_50: { id: "jogos_50", emoji: "🏅", titulo: "50 jogos", como: "50 jogos na temporada" },
  jogos_100: { id: "jogos_100", emoji: "💯", titulo: "100 jogos", como: "100 jogos na temporada" },
  paredao: { id: "paredao", emoji: "🧤", titulo: "Paredão", como: "goleiro com 5 jogos sem sofrer gol" },
  artilheiro_mes: { id: "artilheiro_mes", emoji: "👟", titulo: "Artilheiro do mês", como: "mais gols num mês" },
  garcom_mes: { id: "garcom_mes", emoji: "🎯", titulo: "Garçom do mês", como: "mais assistências num mês" },
  muralha_mes: { id: "muralha_mes", emoji: "🧱", titulo: "Muralha do mês", como: "goleiro menos vazado do mês" },
};

// Ordem dos selos no card (os mais raros primeiro).
const ORDEM: IdConquista[] = [
  "jogos_100", "artilheiro_mes", "garcom_mes", "muralha_mes", "seguidas_10", "hat_trick", "pe_quente",
  "goleador_dia", "invicto_dia", "paredao", "garcom_dia", "jogos_50",
];

export type Ganha = { id: IdConquista; vezes: number };

export function calcularConquistas(d: DadosPeriodo): Map<string, Ganha[]> {
  const cont = new Map<string, Map<IdConquista, number>>();
  const dar = (membro: string, id: IdConquista, n = 1) => {
    const m = cont.get(membro) ?? new Map<IdConquista, number>();
    m.set(id, (m.get(id) ?? 0) + n);
    cont.set(membro, m);
  };
  const sorteioDo = new Map(d.sorteios.map((s) => [s.evento_id, s]));
  const encerradas = d.partidas.filter((p) => p.status === "encerrada");
  const ordemEvento = new Map(d.eventos.map((e, i) => [e.id, i]));
  encerradas.sort((a, b) => (ordemEvento.get(a.evento_id) ?? 0) - (ordemEvento.get(b.evento_id) ?? 0) || a.numero - b.numero);

  // Gols e assistências por jogo e por dia
  const golsJogo = new Map<string, number>(); // partida|membro
  const golsDia = new Map<string, number>(); // evento|membro
  const assDia = new Map<string, number>();
  const eventoDa = new Map(d.partidas.map((p) => [p.id, p.evento_id]));
  for (const l of d.lances) {
    if (l.desfeito) continue;
    const ev = eventoDa.get(l.partida_id);
    if (!ev) continue;
    if (l.tipo === "gol" && l.autor_id) {
      golsJogo.set(`${l.partida_id}|${l.autor_id}`, (golsJogo.get(`${l.partida_id}|${l.autor_id}`) ?? 0) + 1);
      golsDia.set(`${ev}|${l.autor_id}`, (golsDia.get(`${ev}|${l.autor_id}`) ?? 0) + 1);
    }
    if (l.assist_id) assDia.set(`${ev}|${l.assist_id}`, (assDia.get(`${ev}|${l.assist_id}`) ?? 0) + 1);
  }
  for (const [k, n] of golsJogo) if (n >= 3) dar(k.split("|")[1], "hat_trick");
  for (const [k, n] of golsDia) if (n >= 5) dar(k.split("|")[1], "goleador_dia");
  for (const [k, n] of assDia) if (n >= 3) dar(k.split("|")[1], "garcom_dia");

  // Resultados jogo a jogo de cada um (pra invicto, pé quente e jogos)
  const resultados = new Map<string, { ev: string; r: 1 | 0 | -1 }[]>();
  const semSofrer = new Map<string, number>();
  for (const p of encerradas) {
    const s = sorteioDo.get(p.evento_id);
    if (!s) continue;
    const v = vencedorDe(p);
    for (const [time, gk, linha, sofreu] of [
      [p.time_a, p.goleiro_a, p.goleiro_a_linha, p.placar_b],
      [p.time_b, p.goleiro_b, p.goleiro_b_linha, p.placar_a],
    ] as const) {
      const ids = new Set(s.times[time] ?? []);
      if (gk && !linha) ids.add(gk);
      const r: 1 | 0 | -1 = v === null ? 0 : v === time ? 1 : -1;
      for (const id of ids) resultados.set(id, [...(resultados.get(id) ?? []), { ev: p.evento_id, r }]);
      if (gk && !linha && sofreu === 0) semSofrer.set(gk, (semSofrer.get(gk) ?? 0) + 1);
    }
  }
  for (const [id, lista] of resultados) {
    // Pé quente: a cada 5 vitórias seguidas
    let seq = 0;
    for (const x of lista) {
      seq = x.r === 1 ? seq + 1 : 0;
      if (seq === 5) {
        dar(id, "pe_quente");
        seq = 0;
      }
    }
    // Invicto: um dia inteiro (3+ jogos) sem perder
    const porDia = new Map<string, (1 | 0 | -1)[]>();
    for (const x of lista) porDia.set(x.ev, [...(porDia.get(x.ev) ?? []), x.r]);
    for (const rs of porDia.values()) if (rs.length >= 3 && !rs.includes(-1)) dar(id, "invicto_dia");
    if (lista.length >= 100) dar(id, "jogos_100");
    else if (lista.length >= 50) dar(id, "jogos_50");
  }
  for (const [id, n] of semSofrer) if (n >= 5) dar(id, "paredao", Math.floor(n / 5));

  // 10 peladas seguidas: quem esteve no sorteio de 10 dias com jogo, um atrás do outro
  const diasComJogo = d.eventos.filter((e) => d.partidas.some((p) => p.evento_id === e.id) && sorteioDo.has(e.id));
  const seguidas = new Map<string, number>();
  for (const e of diasComJogo) {
    const s = sorteioDo.get(e.id)!;
    const ids = new Set([...s.times.flat(), ...((s.goleiros ?? []).filter(Boolean) as string[])]);
    for (const id of new Set([...seguidas.keys(), ...ids])) {
      const n = ids.has(id) ? (seguidas.get(id) ?? 0) + 1 : 0;
      if (n === 10) dar(id, "seguidas_10");
      seguidas.set(id, n === 10 ? 0 : n);
    }
  }

  // Líderes de cada mês
  const meses = new Map<string, string[]>();
  for (const e of d.eventos) meses.set(e.data.slice(0, 7), [...(meses.get(e.data.slice(0, 7)) ?? []), e.id]);
  const mesAtual = new Date().toISOString().slice(0, 7);
  for (const [mes, evs] of meses) {
    if (mes === mesAtual) continue; // mês ainda rolando não conta
    const set = new Set(evs);
    const g = new Map<string, number>();
    const a = new Map<string, number>();
    for (const [k, n] of golsDia) if (set.has(k.split("|")[0])) g.set(k.split("|")[1], (g.get(k.split("|")[1]) ?? 0) + n);
    for (const [k, n] of assDia) if (set.has(k.split("|")[0])) a.set(k.split("|")[1], (a.get(k.split("|")[1]) ?? 0) + n);
    const lider = (m: Map<string, number>) => {
      const max = Math.max(0, ...m.values());
      return max > 0 ? [...m].filter(([, n]) => n === max).map(([id]) => id) : [];
    };
    lider(g).forEach((id) => dar(id, "artilheiro_mes"));
    lider(a).forEach((id) => dar(id, "garcom_mes"));
    // Muralha: goleiro de verdade com pelo menos 3 jogos e menos gols sofridos por jogo
    const gk = new Map<string, { j: number; s: number }>();
    for (const p of encerradas.filter((x) => set.has(x.evento_id))) {
      for (const [id, linha, sofreu] of [
        [p.goleiro_a, p.goleiro_a_linha, p.placar_b],
        [p.goleiro_b, p.goleiro_b_linha, p.placar_a],
      ] as const) {
        if (!id || linha) continue;
        const x = gk.get(id) ?? { j: 0, s: 0 };
        gk.set(id, { j: x.j + 1, s: x.s + sofreu });
      }
    }
    const validos = [...gk].filter(([, x]) => x.j >= 3);
    if (validos.length) {
      const min = Math.min(...validos.map(([, x]) => x.s / x.j));
      validos.filter(([, x]) => x.s / x.j === min).forEach(([id]) => dar(id, "muralha_mes"));
    }
  }

  const r = new Map<string, Ganha[]>();
  for (const [id, m] of cont) r.set(id, ORDEM.filter((c) => m.has(c)).map((c) => ({ id: c, vezes: m.get(c)! })));
  return r;
}

export const seloDe = (g: Ganha) => CONQUISTAS[g.id].emoji;
