// Lê a lista da pelada colada do WhatsApp.
// Entende também: convidado do Fulano, "+1", (gol), (pago), quem riscou o nome ou escreveu "saí".
// Formato esperado (flexível):
//   Pelada 23/11/2026
//   Horário: 18:30 até 20:30
//   1 - Fulano
//   Goleiros
//   1-Ciclano
//   Suplentes
//   1-Beltrano

// Cada nome lido. `convidadoDe`: "Fulano (convidado do Beltrano)" ou "+1 do Beltrano".
export type NomeLido = { nome: string; convidadoDe: string | null };

export type ListaLida = {
  data: string | null;
  horario: string | null;
  linha: NomeLido[];
  goleiros: NomeLido[];
  suplentes: NomeLido[];
  riscados: string[]; // ~Fulano~, "Fulano (saí)", "Fulano - não vou": saiu da lista
  vazias: number; // vagas da linha sem nome ("7-"): no sorteio viram RESERVA
};

type Secao = "linha" | "goleiros" | "suplentes";

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
const NUMERACAO = /^\s*\d{1,3}\s*[-.)–:]?\s*/;
// Procurado no texto já sem acento.
const SAIU = /(^|[\s(\-–,])(sai|saiu|nao vou|nao vai|nao posso|fora|desisti|cancelei)([\s)!.,]|$)/;
const SAIU_TEXTO = /[(\-–,]?\s*(saí|sai|saiu|não vou|nao vou|não vai|nao vai|não posso|nao posso|fora|desisti|cancelei)(?=[\s)!.,]|$)[)!.,]?/gi;
const GOLEIRO = /\s*[(\-–]?\s*\b(gol|goleiro|gk|no gol)\b\s*\)?\s*$/i;
const PAGO = /\s*[(\-–]?\s*(pago|paguei|pix ok|pix feito|já paguei|ja paguei)(?=[\s)!.,]|$)\s*\)?/gi;
// "Fulano (convidado do Beltrano)", "Fulano - conv. Beltrano", "Fulano amigo do Beltrano"
const CONVIDADO_DE = /^(.+?)\s*[(\-–]?\s*(?:convidad[oa]|conv\.?|amig[oa])\s+(?:d[oae]s?\s+)?([^)]+?)\)?\s*$/i;
// "+1 do Beltrano", "Convidado do Beltrano" (sem nome próprio)
const SO_CONVIDADO = /^(?:\+\s*1|convidad[oa]|conv\.?)\s*(?:d[oae]s?\s+)?(.*?)\)?\s*$/i;

export function normalizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const limparBordas = (t: string) =>
  t
    .replace(/\(\s*\)/g, "")
    .replace(/^[\s\-–:,.]+|[\s\-–:,.]+$/g, "")
    .trim();

// Lê um nome da lista: tira etiquetas (pago, gol) e entende convidado / +1.
// `saiu` vem preenchido se a pessoa riscou o nome ou escreveu "saí".
export function lerNome(bruto: string): { nomes: NomeLido[]; goleiro: boolean; saiu: string | null } {
  let t = bruto.trim();
  // ~Fulano~ (riscado no WhatsApp)
  if (/^~[^~]+~$/.test(t)) return { nomes: [], goleiro: false, saiu: limparBordas(t.slice(1, -1).replace(EMOJI, "")) || null };
  const goleiroEmoji = t.includes("🧤");
  t = t.replace(EMOJI, " ").replace(/\s+/g, " ").trim();
  if (SAIU.test(normalizar(t))) return { nomes: [], goleiro: false, saiu: limparBordas(t.replace(SAIU_TEXTO, "")) || null };
  t = t.replace(PAGO, " ").replace(/\s+/g, " ").trim();
  let goleiro = goleiroEmoji;
  if (GOLEIRO.test(t) && t.replace(GOLEIRO, "").trim()) {
    goleiro = true;
    t = t.replace(GOLEIRO, "");
  }
  t = limparBordas(t);
  if (!t) return { nomes: [], goleiro, saiu: null };

  if (/^(\+\s*1|convidad|conv\b|conv\.)/i.test(t)) {
    const de = limparBordas(t.match(SO_CONVIDADO)?.[1] ?? "");
    return { nomes: [{ nome: de ? `Convidado do ${de}` : "Convidado", convidadoDe: de || null }], goleiro, saiu: null };
  }
  // "Fulano +1": o Fulano e mais um convidado dele.
  const mais1 = t.match(/^(.+?)\s*\+\s*1$/);
  if (mais1) {
    const dono = limparBordas(mais1[1]);
    return { nomes: [{ nome: dono, convidadoDe: null }, { nome: `Convidado do ${dono}`, convidadoDe: dono }], goleiro, saiu: null };
  }
  const conv = t.match(CONVIDADO_DE);
  if (conv && limparBordas(conv[1])) return { nomes: [{ nome: limparBordas(conv[1]), convidadoDe: limparBordas(conv[2]) }], goleiro, saiu: null };
  return { nomes: [{ nome: t, convidadoDe: null }], goleiro, saiu: null };
}

export function lerLista(texto: string): ListaLida {
  const out: ListaLida = { data: null, horario: null, linha: [], goleiros: [], suplentes: [], riscados: [], vazias: 0 };
  let secao: Secao = "linha";

  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(EMOJI, "").trim();
    if (!linha) continue;
    const n = normalizar(linha);

    const data = linha.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
    if (/^pelada|^jogo|^futebol|^futsal|^fut\b/.test(n) && data) {
      out.data = data[1];
      continue;
    }
    if (/^hor[aá]rio/.test(n) || /^\d{1,2}[:h]\d{2}\s*(ate|as|-)/.test(n)) {
      const h = linha.match(/(\d{1,2}[:h]\d{2})/);
      if (h) out.horario = h[1].replace("h", ":");
      continue;
    }
    if (/^goleiros?:?$/.test(n)) { secao = "goleiros"; continue; }
    if (/^(suplentes?|reservas?|espera|lista de espera|banco):?$/.test(n)) { secao = "suplentes"; continue; }
    if (/^(linha|jogadores|confirmados):?$/.test(n)) { secao = "linha"; continue; }

    // Só conta como nome se a linha começa com numeração (padrão da lista).
    if (!NUMERACAO.test(linha)) continue;
    const resto = bruta.trim().replace(NUMERACAO, "").trim();
    const semEmoji = resto.replace(EMOJI, "").trim();
    if (!semEmoji || /^[-–._~]+$/.test(semEmoji)) {
      if (secao === "linha") out.vazias++; // vaga vazia: "7-"
      continue;
    }
    const lido = lerNome(resto);
    if (lido.saiu !== null || !lido.nomes.length) {
      if (lido.saiu) out.riscados.push(lido.saiu);
      if (secao === "linha") out.vazias++;
      continue;
    }
    const destino: Secao = lido.goleiro && secao === "linha" ? "goleiros" : secao;
    out[destino].push(...lido.nomes);
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
  | { tipo: "ambiguo"; nome: string; opcoes: T[] }
  | { tipo: "novo"; nome: string };

type ComNomes = { nome: string; apelido?: string | null; apelidos?: string[] | null };

// Todos os jeitos de chamar o jogador: nome, apelido principal e os outros apelidos.
function nomesDe(j: ComNomes): string[] {
  return [j.nome, j.apelido ?? "", ...(j.apelidos ?? [])].filter((x) => x && x.trim());
}

// Procura cada nome da lista no elenco: igual (nome ou qualquer apelido), palavra do nome, ou parecido.
// Se bater com mais de um jogador, devolve "ambiguo" pra pessoa escolher.
export function casarComElenco<T extends ComNomes>(nomes: string[], elenco: T[]): Casamento<T>[] {
  return nomes.map((nome) => {
    const n = normalizar(nome);
    const exatos = elenco.filter((j) => nomesDe(j).some((x) => normalizar(x) === n));
    if (exatos.length === 1) return { tipo: "exato", nome, jogador: exatos[0] };
    if (exatos.length > 1) return { tipo: "ambiguo", nome, opcoes: exatos };
    // "Convidado do X" só casa com o mesmo nome exato (não com o X).
    if (n.startsWith("convidado")) return { tipo: "novo", nome };
    // "Budziak" casa com "Lucas Budziak", "Renan" com "Renan Tarcitano" (se só houver um).
    const temPalavra = (alvo: string) => normalizar(alvo).split(" ").length > 1 && (" " + normalizar(alvo) + " ").includes(" " + n + " ");
    const porPalavra = elenco.filter((j) => nomesDe(j).some(temPalavra));
    if (porPalavra.length === 1) return { tipo: "exato", nome, jogador: porPalavra[0] };
    if (porPalavra.length > 1) return { tipo: "ambiguo", nome, opcoes: porPalavra };
    let melhor: T | null = null;
    let score = 0;
    for (const j of elenco) {
      const sc = Math.max(...nomesDe(j).map((x) => similaridade(nome, x)));
      if (sc > score) {
        score = sc;
        melhor = j;
      }
    }
    if (melhor && score >= 0.6) return { tipo: "parecido", nome, jogador: melhor, score };
    return { tipo: "novo", nome };
  });
}

// Texto da lista no formato do Zap (pra colar de volta no grupo depois de editar no app).
export function montarTextoLista(o: { titulo: string; horario: string | null; vagas: number; linha: string[]; goleiros: string[]; suplentes: string[] }): string {
  const linhas = [o.titulo];
  if (o.horario) linhas.push(`Horário: ${o.horario}`);
  linhas.push("");
  const total = Math.max(o.vagas, o.linha.length);
  for (let i = 0; i < total; i++) linhas.push(`${i + 1} - ${o.linha[i] ?? ""}`.trimEnd());
  if (o.goleiros.length) {
    linhas.push("", "Goleiros");
    o.goleiros.forEach((g, i) => linhas.push(`${i + 1} - ${g}`));
  }
  linhas.push("", "Suplentes");
  if (o.suplentes.length) o.suplentes.forEach((g, i) => linhas.push(`${i + 1} - ${g}`));
  else linhas.push("1 -");
  return linhas.join("\n");
}

// Onde a tela /compartilhar guarda a lista que veio do Zap até a tela "Colar lista" abrir.
export const CHAVE_LISTA = "masorteio:lista-compartilhada";
