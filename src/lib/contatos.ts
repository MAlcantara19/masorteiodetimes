"use client";
// Contato e cadastro de quem é da pelada (WhatsApp, aniversário, onde gosta de jogar, autoavaliação).
// Só admin recebe (SQL 0009). Pra mandar mensagem pronta direto no WhatsApp da pessoa.
import { useEffect, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";

export type Contato = { membro_id: string; whatsapp: string | null; nascimento: string | null; posicao: string | null; pe: string | null; autoavaliacao: number | null };

export function useContatos(peladaId: string | undefined, admin: boolean): Map<string, Contato> {
  const [mapa, setMapa] = useState<Map<string, Contato>>(new Map());
  useEffect(() => {
    if (!peladaId || !admin) return;
    criarClienteSupabase()
      .rpc("contatos_da_pelada", { p_pelada: peladaId })
      .then(({ data }) => setMapa(new Map(((data ?? []) as Contato[]).map((c) => [c.membro_id, c]))));
  }, [peladaId, admin]);
  return mapa;
}

export const NOME_POSICAO: Record<string, string> = { D: "defesa", M: "meio", A: "ataque", Q: "tanto faz", G: "gol" };
export const NOME_PE: Record<string, string> = { destro: "pé direito", canhoto: "pé esquerdo", ambos: "os dois pés" };
export const NIVEL_TXT = ["", "tô começando", "quebro o galho", "jogo direitinho", "jogo bem", "sou craque"];
