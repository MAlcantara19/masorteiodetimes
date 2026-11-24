// Lê a lista da pelada colada do WhatsApp.
// Formato esperado (flexível):
//   Pelada 23/11/2026
//   Horário: 18:30 até 20:30
//   1 - Fulano
//   Goleiros
//   1-Ciclano
//   Suplentes
//   1-Beltrano

export type ListaLida = {
  data: string | null;
  horario: string | null;
  linha: string[];
  goleiros: string[];
  suplentes: string[];
};

type Secao = "linha" | "goleiros" | "suplentes";

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
const NUMERACAO = /^\s*\d{1,3}\s*[-.)–:]?\s*/;

export function normalizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function lerLista(texto: string): ListaLida {
  const out: ListaLida = { data: null, horario: null, linha: [], goleiros: [], suplentes: [] };
  let secao: Secao = "linha";

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(EMOJI, "").trim();
    if (!linha) continue;
    const n = normalizar(linha);

    const data = linha.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
    if (/^pelada|^jogo|^futebol/.test(n) && data) {
      out.data = data[1];
      continue;
    }
    if (/^hor[aá]rio/.test(n) || /^\d{1,2}[:h]\d{2}\s*(ate|as|-)/.test(n)) {
      const h = linha.match(/(\d{1,2}[:h]\d{2})/);
      if (h) out.horario = h[1].replace("h", ":");
      continue;
    }
    if (/^goleiros?:?$/.test(n)) { secao = "goleiros"; continue; }
    if (/^(suplentes?|reservas?|espera|lista de espera):?$/.test(n)) { secao = "suplentes"; continue; }
    if (/^(linha|jogadores|confirmados):?$/.test(n)) { secao = "linha"; continue; }

    // Só conta como nome se a linha começa com numeração (padrão da lista).
    if (!NUMERACAO.test(linha)) continue;
    const nome = linha.replace(NUMERACAO, "").trim();
    if (!nome || /^[-–.]+$/.test(nome)) continue; // vaga vazia: "2-"
    out[secao].push(nome);
  }
  return out;
}

// Similaridade simples (Dice em bigramas) pra casar "Felipe" com "Feliph".
function bigramas(s: string): string[] {
  const t = ` ${normalizar(s)} `;
  const r: string[] = [];
  for (let i = 0; i < t.length - 1; i++) r.push(t.slice(i, i + 2));
  return r;
}

export function similaridade(a: string, b: string): number {
  const A = bigramas(a);
  const B = bigramas(b);
  const usados = new Array(B.length).fill(false);
  let iguais = 0;
  for (const x of A) {
    const i = B.findIndex((y, k) => !usados[k] && y === x);
    if (i >= 0) { usados[i] = true; iguais++; }
  }
  return (2 * iguais) / (A.length + B.length || 1);
}

export type Casamento<T> =
  | { tipo: "exato"; nome: string; jogador: T }
  | { tipo: "parecido"; nome: string; jogador: T; score: number }
  | { tipo: "novo"; nome: string };

// Procura cada nome da lista no elenco: igual, começo do nome, ou parecido.
export function casarComElenco<T extends { nome: string; apelido?: string | null }>(
  nomes: string[],
  elenco: T[],
): Casamento<T>[] {
  return nomes.map((nome) => {
    const n = normalizar(nome);
    const exato = elenco.find((j) => normalizar(j.apelido || "") === n || normalizar(j.nome) === n);
    if (exato) return { tipo: "exato", nome, jogador: exato };
    // "Budziak" casa com "Lucas Budziak", "Renan" com "Renan Tarcitano" (se só houver um).
    const temPalavra = (alvo: string) => normalizar(alvo).split(" ").length > 1 && (" " + normalizar(alvo) + " ").includes(" " + n + " ");
    const prefixo = elenco.filter((j) => temPalavra(j.nome) || temPalavra(j.apelido || ""));
    if (prefixo.length === 1) return { tipo: "exato", nome, jogador: prefixo[0] };
    let melhor: T | null = null;
    let score = 0;
    for (const j of elenco) {
      const s = Math.max(similaridade(nome, j.nome), j.apelido ? similaridade(nome, j.apelido) : 0);
      if (s > score) { score = s; melhor = j; }
    }
    if (melhor && score >= 0.6) return { tipo: "parecido", nome, jogador: melhor, score };
    return { tipo: "novo", nome };
  });
}
