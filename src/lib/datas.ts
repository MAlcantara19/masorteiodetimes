// Datas da pelada: próxima ocorrência, contagem regressiva e formatos em português.

export const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// "18:30:00" → [18, 30]
function hm(horario: string | null): [number, number] {
  const [h, m] = (horario ?? "00:00").split(":").map(Number);
  return [h || 0, m || 0];
}

// Próxima data/hora da pelada a partir de agora (se começou há menos de 3h, ainda conta como "hoje").
export function proximaPelada(diaSemana: number | null, horario: string | null, agora = new Date()): Date | null {
  if (diaSemana === null || diaSemana === undefined) return null;
  const [h, m] = hm(horario);
  const d = new Date(agora);
  d.setHours(h, m, 0, 0);
  let dif = (diaSemana - d.getDay() + 7) % 7;
  if (dif === 0 && agora.getTime() - d.getTime() > 3 * 3600_000) dif = 7;
  d.setDate(d.getDate() + dif);
  return d;
}

export function contagem(alvo: Date, agora = new Date()): string {
  const ms = alvo.getTime() - agora.getTime();
  if (ms <= 0) return "rolando";
  const min = Math.floor(ms / 60000);
  const dias = Math.floor(min / 1440);
  const horas = Math.floor((min % 1440) / 60);
  const mins = min % 60;
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${String(mins).padStart(2, "0")}min`;
  return `${mins}min`;
}

export function mesmoDia(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// "Segunda, 23 de novembro"
export function dataExtenso(d: Date): string {
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

// Date → "2026-11-23" (no fuso do aparelho)
export function isoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "2026-11-23" → "23/11"
export function curtaDia(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// "2026-11-23" → Date ao meio-dia (evita pular de dia por fuso)
export function deIso(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d, 12);
}

// "23/11/2026" ou "23/11" → "2026-11-23"
export function deDataBr(br: string, ref = new Date()): string | null {
  const m = br.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return null;
  let ano = m[3] ? Number(m[3]) : ref.getFullYear();
  if (ano < 100) ano += 2000;
  return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export function horaCurta(horario: string | null): string {
  if (!horario) return "";
  const [h, m] = hm(horario);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function horaDe(ts: string): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Início da semana (segunda) e do mês, em "AAAA-MM-DD"
export function inicioSemana(d = new Date()): string {
  const x = new Date(d);
  const dia = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dia);
  return isoDia(x);
}

export function inicioMes(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function nomeMes(d = new Date()): string {
  const n = MESES[d.getMonth()];
  return n[0].toUpperCase() + n.slice(1);
}
