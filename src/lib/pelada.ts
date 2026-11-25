"use client";
// Tipos e carregamento de uma pelada pelo endereço (/bola-fora/...).
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { definirPeladaAtual } from "@/lib/pelada-atual";
import type { Posicao } from "@/lib/sorteio";

export type Pelada = {
  id: string;
  nome: string;
  slug: string;
  dia_semana: number | null;
  horario: string | null;
  horario_fim: string | null;
  local: string | null;
  logo_url: string | null;
  cor_banner: string;
  regra_fim: "tempo" | "tempo_ou_gols" | "gols";
  minutos: number;
  gols_limite: number;
  regra_empate: "sai_quem_ficou" | "sai_os_dois" | "penaltis";
  lembrete_horas_antes: number;
  mensalidade: number | null;
  pix_chave?: string | null; // (SQL 0003)
  pix_nome?: string | null;
  pix_cidade?: string | null;
  valor_diaria?: number | null; // (SQL 0006) quem paga por pelada
  lista_app?: boolean; // (SQL 0007) lista da semana no app
  lista_vagas?: number;
  lista_espera?: number;
  lista_goleiros?: number;
  lista_abre_dia?: number | null;
  lista_abre_hora?: string | null;
  publica?: boolean; // (SQL 0009) aparece em "Achar pelada"
  contato_whatsapp?: string | null;
  aviso_dia?: boolean;
  aviso_2h?: boolean;
  cor_menu?: string | null; // (SQL 0009) cor (padrão) | claro | escuro
  cor_secundaria?: string | null; // (SQL 0004)
  camisa_estilo?: string | null;
  plano?: string | null;
  recursos?: Record<string, boolean> | null;
  plano_ate?: string | null;
  demo?: boolean;
};

export type Atributos = {
  folego: number;
  habilidade: number;
  nocao: number;
  joga_pro_time: number;
  fisico: number;
  defesa: number;
  finalizacao: number;
};

export type Nota = { nota_simples: number; atributos: Atributos | null; usar_completa: boolean };

export type Membro = {
  id: string;
  pelada_id: string;
  profile_id: string | null;
  nome: string;
  apelido: string | null;
  apelidos?: string[] | null; // outros jeitos de chamar (pra reconhecer na lista do Zap)
  papel: "admin" | "jogador";
  posicao: Posicao;
  sabe_marcar: boolean;
  goleiro: boolean;
  convidado: boolean;
  ativo: boolean;
  nascimento?: string | null; // "AAAA-MM-DD" (SQL 0003)
  mensalista?: boolean; // (SQL 0007) entra direto na lista toda semana
  nota?: Nota | null; // só vem pra admin (RLS)
};

export const ATRIBUTOS: { chave: keyof Atributos; rotulo: string }[] = [
  { chave: "folego", rotulo: "Fôlego" },
  { chave: "habilidade", rotulo: "Habilidade" },
  { chave: "nocao", rotulo: "Noção de jogo" },
  { chave: "joga_pro_time", rotulo: "Joga pro time" },
  { chave: "fisico", rotulo: "Físico" },
  { chave: "defesa", rotulo: "Defesa" },
  { chave: "finalizacao", rotulo: "Finalização" },
];

export const ATRIBUTOS_PADRAO: Atributos = { folego: 5, habilidade: 5, nocao: 5, joga_pro_time: 5, fisico: 5, defesa: 5, finalizacao: 5 };

export function mediaAtributos(a: Atributos): number {
  const v = ATRIBUTOS.map((x) => a[x.chave]);
  return v.reduce((s, n) => s + n, 0) / v.length;
}

// Média de 0–10 → estrelas de 0,5 em 0,5 (mínimo 0,5).
export function atributosParaEstrelas(a: Atributos): number {
  return Math.max(0.5, Math.round(mediaAtributos(a)) / 2);
}

// Nota usada no sorteio: a completa (convertida) se for o modo escolhido, senão a simples.
export function notaDoMembro(m: Membro, modo: "simples" | "completa" = "simples"): number {
  const n = m.nota;
  if (!n) return 3;
  if (modo === "completa" && n.atributos) return mediaAtributos(n.atributos) / 2;
  return Number(n.nota_simples);
}

export function nomeCurto(m: { nome: string; apelido?: string | null }): string {
  return m.apelido?.trim() || m.nome;
}

export const SLUGS_RESERVADOS = ["mais", "peladas", "entrar", "perfil", "master", "p", "auth", "api", "acompanhar", "sortear", "privacidade", "telao", "compartilhar", "cronometro", "tour", "marca", "icons"];

export function criarSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Carrega a pelada do endereço atual. `naoAchou` = slug inválido.
export function usePelada() {
  const params = useParams<{ pelada?: string; slug?: string }>();
  const slug = params.pelada ?? params.slug ?? "";
  const [pelada, setPelada] = useState<Pelada | null>(null);
  const [naoAchou, setNaoAchou] = useState(false);

  const carregar = useCallback(async () => {
    if (!slug) return;
    // "*" pega também as colunas novas (Pix) quando o SQL 0003 já rodou.
    const { data } = await criarClienteSupabase().from("peladas").select("*").eq("slug", slug).maybeSingle();
    if (!data) setNaoAchou(true);
    else {
      setPelada(data as Pelada);
      definirPeladaAtual(slug);
    }
  }, [slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  return { slug, pelada, naoAchou, recarregar: carregar };
}

// Elenco da pelada. Pra admin, já vem com as notas; pra jogador, `nota` vem vazio (o banco não deixa ler).
export async function carregarElenco(peladaId: string, comNotas: boolean): Promise<Membro[]> {
  const sb = criarClienteSupabase();
  const base = "id, pelada_id, profile_id, nome, apelido, papel, posicao, sabe_marcar, goleiro, convidado, ativo";
  const notas = comNotas ? ", nota:notas(nota_simples, atributos, usar_completa)" : "";
  let { data, error } = await sb.from("membros").select(`${base}, apelidos, nascimento, mensalista${notas}`).eq("pelada_id", peladaId).order("nome");
  // Sem o SQL 0007 (mensalista), tenta sem essa coluna.
  if (error) ({ data, error } = await sb.from("membros").select(`${base}, apelidos, nascimento${notas}`).eq("pelada_id", peladaId).order("nome"));
  // Sem o SQL 0003 (nascimento), tenta só com os apelidos (SQL 0002).
  if (error) ({ data, error } = await sb.from("membros").select(`${base}, apelidos${notas}`).eq("pelada_id", peladaId).order("nome"));
  // Se o SQL novo (apelidos) ainda não foi rodado no Supabase, carrega sem essa coluna.
  if (error) ({ data, error } = await sb.from("membros").select(`${base}${notas}`).eq("pelada_id", peladaId).order("nome"));
  // Sem internet: usa o elenco guardado neste aparelho.
  if (error || !data) return elencoGuardado(peladaId) ?? [];
  const lista = ((data ?? []) as unknown as Membro[]).map((m) => ({
    ...m,
    nota: Array.isArray(m.nota) ? (m.nota[0] ?? null) : (m.nota ?? null),
  }));
  guardarElenco(peladaId, lista);
  return lista;
}

// Elenco guardado no aparelho (sem as notas, que nunca ficam salvas fora do banco).
const chaveElenco = (peladaId: string) => `masorteio:elenco-membros:${peladaId}`;

function guardarElenco(peladaId: string, lista: Membro[]) {
  try {
    window.localStorage.setItem(chaveElenco(peladaId), JSON.stringify(lista.map((m) => ({ ...m, nota: null }))));
  } catch {}
}

export function elencoGuardado(peladaId: string): Membro[] | null {
  try {
    const raw = window.localStorage.getItem(chaveElenco(peladaId));
    return raw ? (JSON.parse(raw) as Membro[]) : null;
  } catch {
    return null;
  }
}

// Mostra na hora o elenco guardado e depois troca pelo do banco (a tela abre rápido mesmo com internet ruim).
export function elencoRapido(peladaId: string, aoTer: (el: Membro[]) => void) {
  const guardado = elencoGuardado(peladaId);
  if (guardado?.length) aoTer(guardado);
  carregarElenco(peladaId, false).then((el) => {
    if (el.length || !guardado?.length) aoTer(el);
  });
}
