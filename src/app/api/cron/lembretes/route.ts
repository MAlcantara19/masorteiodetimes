// Lembretes automáticos. Um agendador (GitHub Actions, de hora em hora) chama esta rota com o CRON_SECRET.
// - "Ainda não sorteou": X horas antes da pelada (lembrete_horas_antes), pros admins.
// - "Amanhã tem pelada": no dia anterior, às 10h, pros admins colarem a lista.
// - Lista no app (SQL 0007): 1 hora antes de abrir, lança a lista (com os mensalistas) e avisa "abre às 12:00";
//   na hora de abrir, avisa "a lista abriu". A lista abre na hora certa mesmo se o aviso atrasar.
import { NextResponse, type NextRequest } from "next/server";
import { clienteAdmin } from "@/lib/supabase/server";
import { enviarPara, perfisDaPelada } from "@/lib/push-servidor";
import { aberturaDaLista, lancarLista, proximoDiaDaPelada } from "@/lib/lista-app";

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

  // Lista no app: só as peladas que ligaram (sem o SQL 0007 essa consulta só volta vazia).
  const { data: comLista } = await admin
    .from("peladas")
    .select("id, nome, slug, dia_semana, horario, lista_abre_dia, lista_abre_hora")
    .eq("lista_app", true)
    .not("lista_abre_dia", "is", null)
    .not("dia_semana", "is", null);
  const agoraMs = Date.now();
  for (const p of comLista ?? []) {
    const data = proximoDiaDaPelada(p, sp.data, sp.hora);
    const abre = data ? aberturaDaLista(p, data) : null;
    if (!data || !abre) continue;
    const faltaMin = (abre.getTime() - agoraMs) / 60000;
    const hhmm = String(p.lista_abre_hora).slice(0, 5);
    // Uma hora antes: lança (mensalistas já entram) e avisa.
    if (faltaMin > 0 && faltaMin <= 60) {
      await lancarLista(admin, p, data, abre);
      const ids = await perfisDaPelada(p.id);
      const n = await enviarPara(ids, { titulo: `📋 Lista da ${p.nome}`, corpo: `A lista abre hoje às ${hhmm}. Fica ligado!`, url: `/p/${p.slug}/lista`, tag: `listaapp-${p.id}` }, origem);
      log.push(`${p.nome}: lista abre às ${hhmm} (${n})`);
    }
    // Acabou de abrir (na rodada seguinte ao horário).
    if (faltaMin <= 0 && faltaMin > -60) {
      const r = await lancarLista(admin, p, data, abre);
      const ids = await perfisDaPelada(p.id);
      const n = await enviarPara(ids, { titulo: `✅ A lista da ${p.nome} abriu!`, corpo: "Corre pra pôr seu nome.", url: `/p/${p.slug}/lista`, tag: `listaapp-${p.id}` }, origem);
      log.push(`${p.nome}: lista abriu (${n})${r?.nova ? " · lançada agora" : ""}`);
    }
  }

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
