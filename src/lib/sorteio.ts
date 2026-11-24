// Sorteio de times equilibrados (regras do PROJETO.md, seção 7.3).

export type Posicao = "D" | "M" | "A" | "Q";

export type JogadorSorteio = {
  id: string;
  nome: string;
  nota: number; // 0,5 a 5
  posicao: Posicao;
};

export type ConfigSorteio = {
  times: number;
  porTime: number;
  juntos: string[][]; // grupos de ids que jogam no mesmo time
  separar: [string, string][]; // pares de ids que não podem cair juntos
  equilibrarPosicoes: boolean;
};

export type ResultadoSorteio = {
  times: JogadorSorteio[][];
  espera: JogadorSorteio[];
};

const soma = (t: JogadorSorteio[]) => t.reduce((a, j) => a + j.nota, 0);
const defensores = (t: JogadorSorteio[]) => t.filter((j) => j.posicao === "D").length;

function embaralhar<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const k = Math.floor(Math.random() * (i + 1));
    [a[i], a[k]] = [a[k], a[i]];
  }
  return a;
}

export function sortear(jogadores: JogadorSorteio[], cfg: ConfigSorteio): ResultadoSorteio {
  const vagas = cfg.times * cfg.porTime;
  // Quem passa do limite fica na espera (os últimos da lista).
  const emJogo = jogadores.slice(0, vagas);
  const espera = jogadores.slice(vagas);
  const porId = new Map(emJogo.map((j) => [j.id, j]));

  const T: JogadorSorteio[][] = Array.from({ length: cfg.times }, () => []);
  const fixo = new Set<string>();

  const proibido = (time: JogadorSorteio[], j: JogadorSorteio) =>
    cfg.separar.some(([a, b]) =>
      (j.id === a && time.some((x) => x.id === b)) || (j.id === b && time.some((x) => x.id === a)),
    );

  // 1. Grupos "jogar junto", cada um num time diferente, do mais forte pro mais fraco.
  const grupos = cfg.juntos
    .map((g) => g.map((id) => porId.get(id)).filter((j): j is JogadorSorteio => !!j))
    .filter((g) => g.length > 1)
    .sort((a, b) => soma(b) - soma(a));
  for (const g of grupos) {
    const alvo = T.map((t, i) => i)
      .filter((i) => T[i].length + g.length <= cfg.porTime && !g.some((j) => proibido(T[i], j)))
      .sort((a, b) => soma(T[a]) - soma(T[b]))[0];
    if (alvo === undefined) continue;
    T[alvo].push(...g);
    g.forEach((j) => fixo.add(j.id));
  }

  // 2. Resto: ordena por nota (com um pouco de sorte) e põe no time mais fraco.
  const resto = emJogo
    .filter((j) => !fixo.has(j.id))
    .map((j) => ({ j, k: j.nota + (Math.random() - 0.5) * 0.8 }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.j);

  for (const j of resto) {
    const abertos = T.map((t, i) => i).filter((i) => T[i].length < cfg.porTime);
    const validos = abertos.filter((i) => !proibido(T[i], j));
    const opcoes = validos.length ? validos : abertos;
    opcoes.sort((a, b) => soma(T[a]) - soma(T[b]) || (cfg.equilibrarPosicoes ? defensores(T[a]) - defensores(T[b]) : 0));
    T[opcoes[0]].push(j);
  }

  // 3. Busca local: troca 2 jogadores se melhorar o equilíbrio sem quebrar regra.
  const custo = () => {
    const s = T.map(soma);
    let c = 2 * (Math.max(...s) - Math.min(...s));
    if (cfg.equilibrarPosicoes) {
      const d = T.map(defensores);
      c += Math.max(...d) - Math.min(...d);
    }
    return c;
  };
  for (let n = 0; n < 500 && T.length > 1; n++) {
    const i = Math.floor(Math.random() * T.length);
    const k = Math.floor(Math.random() * T.length);
    if (i === k || !T[i].length || !T[k].length) continue;
    const a = Math.floor(Math.random() * T[i].length);
    const b = Math.floor(Math.random() * T[k].length);
    const x = T[i][a];
    const y = T[k][b];
    if (fixo.has(x.id) || fixo.has(y.id)) continue;
    const antes = custo();
    T[i][a] = y;
    T[k][b] = x;
    const quebra = proibido(T[i].filter((z) => z !== y), y) || proibido(T[k].filter((z) => z !== x), x);
    if (custo() > antes || quebra) {
      T[i][a] = x;
      T[k][b] = y;
    }
  }

  return { times: T.map((t) => embaralhar(t)), espera };
}

export function mediaTime(t: JogadorSorteio[]): number {
  return t.length ? soma(t) / t.length : 0;
}

export function somaTime(t: JogadorSorteio[]): number {
  return soma(t);
}
