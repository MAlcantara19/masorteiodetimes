// Lembretes automáticos. Um agendador (GitHub Actions, de hora em hora) chama esta rota com o CRON_SECRET.
// - "Ainda não sorteou": X horas antes da pelada (lembrete_horas_antes), pros admins.
// - "Amanhã tem pelada": no dia anterior, às 10h, pros admins colarem a lista.
import { NextResponse, type NextRequest } from "next/server";
import { clienteAdmin } from "@/lib/supabase/server";
import { enviarPara, perfisDaPelada } from "@/lib/push-servidor";

// Hora de Brasília (o servidor roda em UTC).
function agoraSP() {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { data: `${partes.year}-${partes.month}-${partes.day}`, hora: Number(partes.hour) % 24, minuto: Number(partes.minute), dia: dias.indexOf(partes.weekday) };
}

export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo || request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  const sp = agoraSP();
  const origem = request.nextUrl.origin;
  const admin = clienteAdmin();
  const { data: peladas } = await admin.from("peladas").select("id, nome, slug, dia_semana, horario, lembrete_horas_antes").not("dia_semana", "is", null);
  const log: string[] = [];

  for (const p of peladas ?? []) {
    const [h] = String(p.horario ?? "00:00").split(":").map(Number);
    const amanha = (sp.dia + 1) % 7 === p.dia_semana;
    const hoje = sp.dia === p.dia_semana;

    // Dia anterior, 10h: cola a lista.
    if (amanha && sp.hora === 10) {
      const ids = await perfisDaPelada(p.id, { soAdmins: true });
      const n = await enviarPara(ids, { titulo: `📋 Amanhã tem ${p.nome}`, corpo: "Já dá pra colar a lista do grupo.", url: `/${p.slug}/lista`, tag: `lista-${p.id}` }, origem);
      log.push(`${p.nome}: lista (${n})`);
    }

    // X horas antes: ainda não sorteou?
    if (hoje && sp.hora === h - (p.lembrete_horas_antes ?? 2)) {
      const { data: ev } = await admin.from("eventos").select("id, status").eq("pelada_id", p.id).eq("data", sp.data).neq("status", "cancelado").maybeSingle();
      if (!ev || ev.status === "lista") {
        const ids = await perfisDaPelada(p.id, { soAdmins: true });
        const n = await enviarPara(
          ids,
          { titulo: `⏰ ${p.nome} daqui a ${p.lembrete_horas_antes}h`, corpo: ev ? "A lista tá colada, falta sortear os times." : "Ainda não sorteou os times.", url: `/${p.slug}/${ev ? "sortear" : "lista"}`, tag: `sortear-${p.id}` },
          origem,
        );
        log.push(`${p.nome}: sortear (${n})`);
      }
    }
  }
  return NextResponse.json({ ok: true, agora: sp, log });
}
