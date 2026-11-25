// Textos prontos pro grupo do WhatsApp: resultado de cada jogo e o placar do dia.
// O WhatsApp não deixa app postar sozinho em grupo, então o app abre o Zap com a mensagem pronta
// e a pessoa só escolhe o grupo e manda.
import { NOMES_TIMES } from "@/lib/evento";
import type { Lance, Partida } from "@/lib/partida";

const venc = (p: Partida) => p.vencedor ?? (p.placar_a > p.placar_b ? p.time_a : p.placar_b > p.placar_a ? p.time_b : null);

function golsDoJogo(p: Partida, lances: Lance[], nome: (id: string | null) => string): string[] {
  const doJogo = lances.filter((l) => l.partida_id === p.id && !l.desfeito);
  return [p.time_a, p.time_b].map((t) => {
    const cont = new Map<string, number>();
    for (const l of doJogo.filter((x) => x.time === t)) {
      const quem = l.tipo === "gol_contra" ? "gol contra" : nome(l.autor_id);
      cont.set(quem, (cont.get(quem) ?? 0) + 1);
    }
    const txt = [...cont.entries()].map(([q, n]) => (n > 1 ? `${q} (${n})` : q)).join(", ");
    return `${NOMES_TIMES[t]}: ${txt || "—"}`;
  });
}

function vitoriasDoDia(partidas: Partida[]): string {
  const v = new Map<number, number>();
  for (const p of partidas.filter((x) => x.status === "encerrada")) {
    const w = venc(p);
    if (w !== null) v.set(w, (v.get(w) ?? 0) + 1);
  }
  return [...v.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${NOMES_TIMES[t]} ${n}`).join(" · ");
}

function artilhariaDoDia(lances: Lance[], nome: (id: string | null) => string, max = 5): string {
  const g = new Map<string, number>();
  for (const l of lances) if (!l.desfeito && l.tipo === "gol" && l.autor_id) g.set(l.autor_id, (g.get(l.autor_id) ?? 0) + 1);
  return [...g.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([id, n]) => `${nome(id)} ${n}`).join(" · ");
}

export function textoDoJogo(o: {
  pelada: string;
  partida: Partida;
  partidas: Partida[];
  lances: Lance[];
  nome: (id: string | null) => string;
  proximo: [number, number] | null;
  link: string;
}): string {
  const { partida: p } = o;
  const w = venc(p);
  const linhas = [
    `⚽ *${o.pelada}* · Jogo ${p.numero} encerrado`,
    `${NOMES_TIMES[p.time_a]} *${p.placar_a} × ${p.placar_b}* ${NOMES_TIMES[p.time_b]}`,
    w === null ? "Empate" : `✅ Venceu o ${NOMES_TIMES[w]}`,
    "",
    "Gols:",
    ...golsDoJogo(p, o.lances, o.nome).map((l) => `• ${l}`),
  ];
  const vit = vitoriasDoDia(o.partidas);
  if (vit) linhas.push("", `🏆 Vitórias hoje: ${vit}`);
  const art = artilhariaDoDia(o.lances, o.nome, 3);
  if (art) linhas.push(`👟 Artilharia: ${art}`);
  if (o.proximo) linhas.push(`➡️ Agora: ${NOMES_TIMES[o.proximo[0]]} × ${NOMES_TIMES[o.proximo[1]]}`);
  linhas.push("", `Ao vivo: ${o.link}`);
  return linhas.join("\n");
}

export function textoDoDia(o: { pelada: string; partidas: Partida[]; lances: Lance[]; nome: (id: string | null) => string; link: string }): string {
  const enc = o.partidas.filter((p) => p.status === "encerrada");
  const linhas = [`📋 *${o.pelada}* · placar do dia (${enc.length} ${enc.length === 1 ? "jogo" : "jogos"})`, ""];
  for (const p of enc) linhas.push(`Jogo ${p.numero}: ${NOMES_TIMES[p.time_a]} ${p.placar_a} × ${p.placar_b} ${NOMES_TIMES[p.time_b]}`);
  const vit = vitoriasDoDia(o.partidas);
  if (vit) linhas.push("", `🏆 Vitórias: ${vit}`);
  const art = artilhariaDoDia(o.lances, o.nome);
  if (art) linhas.push(`👟 Artilharia: ${art}`);
  linhas.push("", `Ao vivo: ${o.link}`);
  return linhas.join("\n");
}

export const linkZap = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
