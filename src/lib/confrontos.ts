// Histórico de confrontos: duplas que vencem juntas, frente a frente, fregueses e carrascos.
// Tudo calculado dos jogos encerrados (sorteio oficial de cada dia). Nunca usa notas.
import type { DadosPeriodo } from "@/lib/estatisticas";
import { vencedorDe } from "@/lib/estatisticas";

export type Placar = { jogos: number; v: number; e: number; d: number };
export type Dupla = Placar & { a: string; b: string; pct: number };

const novo = (): Placar => ({ jogos: 0, v: 0, e: 0, d: 0 });
const somar = (p: Placar, r: 1 | 0 | -1) => {
  p.jogos++;
  if (r === 1) p.v++;
  else if (r === 0) p.e++;
  else p.d++;
};
export const aproveitamento = (p: Placar) => (p.jogos ? Math.round(((p.v * 3 + p.e) / (p.jogos * 3)) * 100) : 0);

type Lado = { ids: string[]; resultado: 1 | 0 | -1 };
type Jogo = { partidaId: string; lados: [Lado, Lado] };

// Cada jogo encerrado com quem estava de cada lado (linha + goleiro de verdade).
export function jogosComLados(d: DadosPeriodo): Jogo[] {
  const sorteioDo = new Map(d.sorteios.map((s) => [s.evento_id, s]));
  const out: Jogo[] = [];
  for (const p of d.partidas) {
    if (p.status !== "encerrada") continue;
    const s = sorteioDo.get(p.evento_id);
    if (!s) continue;
    const v = vencedorDe(p);
    const lado = (time: number, gk: string | null, linha: boolean): Lado => {
      const ids = [...(s.times[time] ?? [])];
      if (gk && !linha && !ids.includes(gk)) ids.push(gk);
      return { ids, resultado: v === null ? 0 : v === time ? 1 : -1 };
    };
    out.push({ partidaId: p.id, lados: [lado(p.time_a, p.goleiro_a, p.goleiro_a_linha), lado(p.time_b, p.goleiro_b, p.goleiro_b_linha)] });
  }
  return out;
}

// Duplas que jogaram juntas no mesmo time.
export function duplas(d: DadosPeriodo, minJogos = 3): Dupla[] {
  const m = new Map<string, Placar>();
  for (const j of jogosComLados(d)) {
    for (const l of j.lados) {
      const ids = [...l.ids].sort();
      for (let i = 0; i < ids.length; i++)
        for (let k = i + 1; k < ids.length; k++) {
          const ch = ids[i] + "|" + ids[k];
          if (!m.has(ch)) m.set(ch, novo());
          somar(m.get(ch)!, l.resultado);
        }
    }
  }
  return [...m.entries()]
    .filter(([, p]) => p.jogos >= minJogos)
    .map(([ch, p]) => {
      const [a, b] = ch.split("|");
      return { a, b, ...p, pct: aproveitamento(p) };
    });
}

// Quantas vezes cada dupla caiu no mesmo time (sorteios oficiais).
export function caemJuntas(d: DadosPeriodo): { a: string; b: string; vezes: number }[] {
  const m = new Map<string, number>();
  for (const s of d.sorteios) {
    for (const t of s.times) {
      const ids = [...t].sort();
      for (let i = 0; i < ids.length; i++) for (let k = i + 1; k < ids.length; k++) m.set(ids[i] + "|" + ids[k], (m.get(ids[i] + "|" + ids[k]) ?? 0) + 1);
    }
  }
  return [...m.entries()].map(([ch, vezes]) => ({ a: ch.split("|")[0], b: ch.split("|")[1], vezes })).sort((x, y) => y.vezes - x.vezes);
}

export type FrenteAFrente = { juntos: Placar; contra: { jogos: number; va: number; vb: number; e: number; golsA: number; golsB: number } };

export function frenteAFrente(d: DadosPeriodo, a: string, b: string): FrenteAFrente {
  const juntos = novo();
  const contra = { jogos: 0, va: 0, vb: 0, e: 0, golsA: 0, golsB: 0 };
  const jogosContra = new Set<string>();
  for (const j of jogosComLados(d)) {
    const la = j.lados.findIndex((l) => l.ids.includes(a));
    const lb = j.lados.findIndex((l) => l.ids.includes(b));
    if (la < 0 || lb < 0) continue;
    if (la === lb) somar(juntos, j.lados[la].resultado);
    else {
      contra.jogos++;
      jogosContra.add(j.partidaId);
      const r = j.lados[la].resultado;
      if (r === 1) contra.va++;
      else if (r === -1) contra.vb++;
      else contra.e++;
    }
  }
  for (const l of d.lances) {
    if (l.desfeito || l.tipo !== "gol" || !jogosContra.has(l.partida_id)) continue;
    if (l.autor_id === a) contra.golsA++;
    if (l.autor_id === b) contra.golsB++;
  }
  return { juntos, contra };
}

// Pra um jogador: com quem mais vence junto e contra quem mais ganha/perde.
export function relacoes(d: DadosPeriodo, id: string, minJogos = 3) {
  const parceiros = new Map<string, Placar>();
  const rivais = new Map<string, Placar>();
  for (const j of jogosComLados(d)) {
    const meu = j.lados.findIndex((l) => l.ids.includes(id));
    if (meu < 0) continue;
    const r = j.lados[meu].resultado;
    for (const o of j.lados[meu].ids) {
      if (o === id) continue;
      if (!parceiros.has(o)) parceiros.set(o, novo());
      somar(parceiros.get(o)!, r);
    }
    for (const o of j.lados[1 - meu].ids) {
      if (!rivais.has(o)) rivais.set(o, novo());
      somar(rivais.get(o)!, r);
    }
  }
  const lista = (m: Map<string, Placar>) => [...m.entries()].filter(([, p]) => p.jogos >= minJogos).map(([o, p]) => ({ id: o, ...p, pct: aproveitamento(p) }));
  const ps = lista(parceiros);
  const rs = lista(rivais);
  return {
    melhoresParceiros: [...ps].sort((x, y) => y.pct - x.pct || y.jogos - x.jogos).slice(0, 3),
    fregueses: [...rs].filter((r) => r.v > r.d).sort((x, y) => y.v - y.d - (x.v - x.d) || y.pct - x.pct).slice(0, 3),
    carrascos: [...rs].filter((r) => r.d > r.v).sort((x, y) => y.d - y.v - (x.d - x.v) || x.pct - y.pct).slice(0, 3),
  };
}
