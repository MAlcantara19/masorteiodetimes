"use client";
// Encerrar a pelada do dia: fecha o jogo em andamento, marca o dia como encerrado,
// abre a votação (24h) e guarda as medalhas do dia. Devolve uma mensagem de erro ou null.
import { criarClienteSupabase } from "@/lib/supabase/client";
import type { Pelada } from "@/lib/pelada";
import type { Evento } from "@/lib/evento";
import { calcularEstatisticas, calcularPremios, carregarPeriodo } from "@/lib/estatisticas";
import { avisarPush } from "@/lib/push-cliente";

export async function encerrarPelada(pelada: Pelada, evento: Evento): Promise<string | null> {
  const sb = criarClienteSupabase();
  const { data: abertas } = await sb.from("partidas").select("id").eq("evento_id", evento.id).neq("status", "encerrada");
  for (const p of abertas ?? []) await sb.rpc("acao_partida", { p_partida: p.id, p_acao: "encerrar", p_dados: {} });

  const { error } = await sb.from("eventos").update({ status: "encerrado", encerrado_em: new Date().toISOString() }).eq("id", evento.id);
  if (error) return "Não deu pra encerrar a pelada.";

  const fecha = new Date(Date.now() + 24 * 3600_000).toISOString();
  await sb.from("votacoes").upsert(
    (["craque", "bagre", "goleiro"] as const).map((categoria) => ({ evento_id: evento.id, categoria, abre: new Date().toISOString(), fecha })),
    { onConflict: "evento_id,categoria" },
  );

  // Medalhas do dia (craque entra quando a votação fechar, calculado na hora).
  const d = await carregarPeriodo(pelada.id, undefined, undefined, [evento.id]);
  const pr = calcularPremios(calcularEstatisticas(d));
  const medalhas = [
    ...pr.artilheiro.ids.map((id) => ({ membro_id: id, tipo: "artilheiro", periodo: evento.data, valor: pr.artilheiro.valor })),
    ...pr.garcom.ids.map((id) => ({ membro_id: id, tipo: "garcom", periodo: evento.data, valor: pr.garcom.valor })),
    ...pr.muralha.ids.map((id) => ({ membro_id: id, tipo: "muralha", periodo: evento.data, valor: pr.muralha.valor })),
  ];
  if (medalhas.length) await sb.from("medalhas").upsert(medalhas, { onConflict: "membro_id,tipo,periodo", ignoreDuplicates: true });

  avisarPush({ pelada_id: pelada.id, tipo: "votacao" });
  if (medalhas.length) avisarPush({ pelada_id: pelada.id, tipo: "medalha", membros: medalhas.map((m) => m.membro_id) });
  return null;
}
