// Lista da semana no app (SQL 0007): mensalistas já entram, a lista abre num dia/hora,
// cada um põe ou tira o próprio nome e convidado fica atrás da galera do grupo.
// Funciona com o cliente do navegador (admin) e com o do servidor (o lembrete automático).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Membro, Pelada } from "@/lib/pelada";
import type { Presenca } from "@/lib/evento";

export type ConfigLista = {
  lista_app?: boolean;
  lista_vagas?: number;
  lista_espera?: number;
  lista_goleiros?: number;
  lista_abre_dia?: number | null;
  lista_abre_hora?: string | null;
};

export type PresencaLista = Presenca & { origem?: string | null; convidado_por?: string | null; entrou_em?: string | null };

const somaDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diaDaSemana = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

// Quando a lista desse dia abre: o último "dia/hora de abrir" antes do dia da pelada (horário de Brasília).
// (Pode ser no próprio dia, se for antes do horário do jogo.)
export function aberturaDaLista(p: ConfigLista & { horario?: string | null }, dataEvento: string): Date | null {
  if (p.lista_abre_dia === null || p.lista_abre_dia === undefined || !p.lista_abre_hora) return null;
  const hora = p.lista_abre_hora.slice(0, 5);
  for (let n = 0; n <= 7; n++) {
    const dia = somaDias(dataEvento, -n);
    if (diaDaSemana(dia) !== p.lista_abre_dia) continue;
    if (n === 0 && hora >= String(p.horario ?? "00:00").slice(0, 5)) continue;
    return new Date(`${dia}T${hora}:00-03:00`);
  }
  return null;
}

// Próximo dia da pelada a partir de uma data "AAAA-MM-DD" (e da hora, pra não pular a pelada de hoje).
export function proximoDiaDaPelada(p: Pick<Pelada, "dia_semana" | "horario">, hoje: string, horaAgora: number): string | null {
  if (p.dia_semana === null || p.dia_semana === undefined) return null;
  const [h] = String(p.horario ?? "00:00").split(":").map(Number);
  let dif = (p.dia_semana - diaDaSemana(hoje) + 7) % 7;
  if (dif === 0 && horaAgora > h + 3) dif = 7;
  return somaDias(hoje, dif);
}

// Lança a lista do dia: cria o dia (se não existe) e põe os mensalistas em ordem alfabética.
export async function lancarLista(sb: SupabaseClient, pelada: Pick<Pelada, "id" | "horario">, data: string, abreEm: Date | null): Promise<{ id: string; nova: boolean } | null> {
  const { data: ja } = await sb.from("eventos").select("id").eq("pelada_id", pelada.id).eq("data", data).neq("status", "cancelado").maybeSingle();
  if (ja) return { id: ja.id as string, nova: false };
  const { data: ev, error } = await sb
    .from("eventos")
    .insert({ pelada_id: pelada.id, data, horario: pelada.horario?.slice(0, 5) ?? null, status: "lista", lista_abre_em: abreEm?.toISOString() ?? null })
    .select("id")
    .single();
  if (error || !ev) return null;
  const { data: ms } = await sb.from("membros").select("id, nome, apelido, goleiro").eq("pelada_id", pelada.id).eq("ativo", true).eq("mensalista", true);
  const mensalistas = ((ms ?? []) as { id: string; nome: string; apelido: string | null; goleiro: boolean }[]).sort((a, b) =>
    (a.apelido || a.nome).localeCompare(b.apelido || b.nome, "pt-BR"),
  );
  if (mensalistas.length) {
    await sb.from("presencas").insert(
      mensalistas.map((m, i) => ({ evento_id: ev.id, membro_id: m.id, status: "confirmado", goleiro: m.goleiro, ordem: i + 1, origem: "mensalista" })),
    );
  }
  return { id: ev.id as string, nova: true };
}

export type Vaga = { p: PresencaLista; m: Membro | undefined };

// Monta a lista como aparece pra todo mundo (e como o sorteio usa): grupo na frente, convidado atrás.
export function montarVagas(pres: PresencaLista[], porId: Map<string, Membro>, cfg: ConfigLista) {
  const vagas = cfg.lista_vagas ?? 15;
  const gks = cfg.lista_goleiros ?? 3;
  const ordem = (a: PresencaLista, b: PresencaLista) => (a.status === b.status ? 0 : a.status === "confirmado" ? -1 : 1) || (a.ordem ?? 0) - (b.ordem ?? 0);
  const ativos = pres.filter((p) => p.status !== "saiu");
  const linhaTodos = ativos.filter((p) => !p.goleiro).sort(ordem);
  const gkTodos = ativos.filter((p) => p.goleiro).sort(ordem);
  const v = (p: PresencaLista): Vaga => ({ p, m: porId.get(p.membro_id) });
  return {
    linha: linhaTodos.slice(0, vagas).map(v),
    goleiros: gkTodos.slice(0, gks).map(v),
    espera: [...linhaTodos.slice(vagas), ...gkTodos.slice(gks)].map(v),
    sairam: pres.filter((p) => p.status === "saiu").map(v),
    vagas,
    gks,
  };
}

export const ERROS_LISTA: Record<string, string> = {
  entre_primeiro: "Entra com sua conta primeiro.",
  lista_fechada: "A lista já fechou (ou os times já foram sorteados).",
  sem_vinculo: "Sua conta ainda não está ligada a um nome do grupo. Pede pro admin ligar (ou entra como convidado).",
  ainda_nao_abriu: "A lista ainda não abriu. Espera dar o horário.",
  falta_nome: "Escreve o nome do convidado.",
  lista_lotada: "A lista lotou (até a espera).",
  sem_permissao: "Você só pode tirar o seu nome ou o do seu convidado.",
};

export function erroLista(msg: string | undefined): string {
  const chave = Object.keys(ERROS_LISTA).find((k) => msg?.includes(k));
  if (chave) return ERROS_LISTA[chave];
  if (msg?.includes("lista_entrar") || msg?.includes("Could not find")) return "Falta rodar o SQL 0007 no Supabase.";
  return "Não deu certo. Tenta de novo.";
}
