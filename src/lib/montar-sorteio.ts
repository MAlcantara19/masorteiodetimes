// Monta o sorteio com as duas ajudas do admin:
// 1. Vaga vazia vira RESERVA: um jogador "coringa" com a nota mais alta da pelada
//    (quem costuma completar é o melhor do time de fora, então é melhor esperar alguém forte).
//    Depois, nos times, toca no RESERVA pra trocar por quem chegou.
// 2. Sorteio que aprende: tenta não repetir as duplas que jogaram juntas na última pelada.
import { criarClienteSupabase } from "@/lib/supabase/client";
import { notaDoMembro, type Membro } from "@/lib/pelada";
import { chaveDupla } from "@/lib/sorteio";
import { carregarSorteios, rodarSorteio, type ConfigSorteio, type Regra } from "@/lib/evento";

const BASE = "id, pelada_id, profile_id, nome, apelido, papel, posicao, sabe_marcar, goleiro, convidado, ativo";

// O RESERVA é um membro escondido: convidado, fora do elenco ativo, nome "RESERVA" ou "RESERVA 2"...
export function ehReserva(m: { nome: string; convidado: boolean; ativo: boolean }): boolean {
  return m.convidado && !m.ativo && /^RESERVA( \d+)?$/.test(m.nome);
}

export function notaReserva(elenco: Membro[], modo: ConfigSorteio["modo"]): number {
  const notas = elenco.filter((m) => m.ativo && !m.goleiro && !ehReserva(m)).map((m) => notaDoMembro(m, modo));
  return notas.length ? Math.round(Math.max(...notas) * 10) / 10 : 3;
}

async function garantirReservas(peladaId: string, n: number, elenco: Membro[], nota: number, usuarioId: string): Promise<Membro[]> {
  const sb = criarClienteSupabase();
  const nomes = Array.from({ length: n }, (_, i) => (i === 0 ? "RESERVA" : `RESERVA ${i + 1}`));
  const existentes = elenco.filter((m) => ehReserva(m) && nomes.includes(m.nome));
  const faltam = nomes.filter((x) => !existentes.some((m) => m.nome === x));
  let criados: Membro[] = [];
  if (faltam.length) {
    const { data, error } = await sb
      .from("membros")
      .insert(faltam.map((nome) => ({ pelada_id: peladaId, nome, convidado: true, ativo: false, posicao: "Q" })))
      .select(BASE);
    if (error) throw new Error("Não deu pra criar o RESERVA.");
    criados = (data ?? []) as unknown as Membro[];
  }
  const todos = [...existentes, ...criados].sort((a, b) => nomes.indexOf(a.nome) - nomes.indexOf(b.nome));
  // A nota acompanha a pelada: sempre a mais alta de hoje (só admin vê).
  await sb.from("notas").upsert(todos.map((m) => ({ membro_id: m.id, nota_simples: Math.min(5, Math.max(0.5, nota)), usar_completa: false, atualizado_por: usuarioId })));
  return todos.map((m) => ({ ...m, nota: { nota_simples: nota, atributos: null, usar_completa: false } }));
}

// Duplas que caíram no mesmo time no sorteio oficial da última pelada antes desta data.
async function duplasDaUltima(peladaId: string, antesDe: string): Promise<Set<string>> {
  const { data } = await criarClienteSupabase()
    .from("eventos")
    .select("id")
    .eq("pelada_id", peladaId)
    .lt("data", antesDe)
    .neq("status", "cancelado")
    .order("data", { ascending: false })
    .limit(3);
  for (const ev of (data ?? []) as { id: string }[]) {
    const ss = await carregarSorteios(ev.id);
    const s = ss.find((x) => x.oficial) ?? ss[ss.length - 1];
    if (!s) continue;
    const pares = new Set<string>();
    for (const t of s.times) for (let a = 0; a < t.length; a++) for (let b = a + 1; b < t.length; b++) pares.add(chaveDupla(t[a], t[b]));
    return pares;
  }
  return new Set();
}

export async function montarSorteio(o: {
  peladaId: string;
  eventoData: string;
  linha: Membro[]; // na ordem da lista
  goleiros: Membro[];
  elenco: Membro[];
  cfg: ConfigSorteio;
  regras: Regra[];
  usuarioId: string;
}) {
  const vagas = o.cfg.times * o.cfg.porTime;
  let linha = o.linha;
  let regras = o.regras;
  let reservas = 0;
  if (o.cfg.completarReserva && linha.length < vagas) {
    reservas = vagas - linha.length;
    const rs = await garantirReservas(o.peladaId, reservas, o.elenco, notaReserva(o.elenco, o.cfg.modo), o.usuarioId);
    linha = [...linha, ...rs];
    // Dois RESERVA no mesmo time, não.
    if (rs.length > 1) regras = [...regras, { id: "reservas", tipo: "separar", membros: rs.map((r) => r.id) }];
  }
  const evitar = o.cfg.naoRepetir ? await duplasDaUltima(o.peladaId, o.eventoData) : undefined;
  return { ...rodarSorteio(linha, o.goleiros, o.cfg, regras, evitar), reservas };
}
