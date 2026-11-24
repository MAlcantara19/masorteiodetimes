// Elenco guardado no próprio aparelho (fase 1, antes do Supabase).
import type { Posicao } from "./sorteio";

export type Jogador = {
  id: string;
  nome: string;
  apelido?: string | null;
  nota: number; // 0,5 a 5
  posicao: Posicao;
  goleiro: boolean;
};

export const NIVEIS: Record<string, string> = {
  "0.5": "Começando agora",
  "1": "Muito fraco",
  "1.5": "Ruim, sabe menos que o básico (não manja de posicionamento)",
  "2": "Noção básica, quase tudo no básico",
  "2.5": "Abaixo da média, mas tem noção (pesado, não corre…)",
  "3": "Na média",
  "3.5": "Um pouco acima da média",
  "4": "Bom, tem bastante noção, mas não carrega o time",
  "4.5": "Muito bom, carrega o time",
  "5": "Quase profissional na pelada",
};

export const POSICOES: Record<Posicao, string> = { D: "Defesa", M: "Meio", A: "Ataque", Q: "Qualquer lugar" };

const CHAVE = "masorteio:elenco:bola-fora";

export function carregarElenco(): Jogador[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHAVE);
    return raw ? (JSON.parse(raw) as Jogador[]) : [];
  } catch {
    return [];
  }
}

export function salvarElenco(elenco: Jogador[]) {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(elenco));
  } catch {
    // sem espaço ou modo privado: segue só na memória
  }
}

export function novoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function formatarNota(n: number): string {
  return n.toFixed(1).replace(".", ",").replace(",0", "");
}
