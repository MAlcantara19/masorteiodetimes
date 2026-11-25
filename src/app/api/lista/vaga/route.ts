// Abriu vaga na lista: quem estava na espera e subiu recebe "você está na lista"
// e os admins recebem o aviso (pra mandar no Zap de quem não tem o app com notificação).
import { NextResponse, type NextRequest } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/server";
import { enviarPara, perfisDaPelada } from "@/lib/push-servidor";

export async function POST(request: NextRequest) {
  const corpo = (await request.json().catch(() => null)) as { evento_id?: string; membro_id?: string } | null;
  if (!corpo?.evento_id || !corpo.membro_id) return NextResponse.json({ erro: "Pedido incompleto." }, { status: 400 });

  const sb = await clienteServidor();
  const { data: eu } = await sb.auth.getUser();
  if (!eu.user) return NextResponse.json({ erro: "Entre primeiro." }, { status: 401 });

  const admin = clienteAdmin();
  const { data: ev } = await admin.from("eventos").select("id, pelada_id, data, status, peladas(nome, slug)").eq("id", corpo.evento_id).maybeSingle();
  if (!ev || ev.status !== "lista") return NextResponse.json({ ok: true, enviados: 0 });
  // Só quem é da pelada pede esse aviso, e só vale pra quem está mesmo confirmado na lista.
  const { data: souDaPelada } = await admin.from("membros").select("id").eq("pelada_id", ev.pelada_id).eq("profile_id", eu.user.id).maybeSingle();
  const { data: pr } = await admin.from("presencas").select("status").eq("evento_id", ev.id).eq("membro_id", corpo.membro_id).maybeSingle();
  if (!souDaPelada || pr?.status !== "confirmado") return NextResponse.json({ ok: true, enviados: 0 });

  const pelada = ev.peladas as unknown as { nome: string; slug: string };
  const { data: m } = await admin.from("membros").select("nome, apelido").eq("id", corpo.membro_id).single();
  const nome = m?.apelido || m?.nome || "Alguém";
  const [d, mes] = [ev.data.slice(8, 10), ev.data.slice(5, 7)];
  const origem = request.nextUrl.origin;

  const quem = await perfisDaPelada(ev.pelada_id, { membros: [corpo.membro_id] });
  let enviados = await enviarPara(quem, { titulo: `✅ Abriu vaga na ${pelada.nome}!`, corpo: `Você saiu da espera e está na lista de ${d}/${mes}.`, url: `/p/${pelada.slug}/lista`, tag: `vaga-${ev.id}` }, origem);
  const admins = (await perfisDaPelada(ev.pelada_id, { soAdmins: true })).filter((id) => id !== eu.user!.id);
  enviados += await enviarPara(
    admins,
    { titulo: `🔁 ${nome} entrou na lista`, corpo: `Saiu da espera (${pelada.nome} ${d}/${mes}). Toque pra avisar no Zap.`, url: `/p/${pelada.slug}/lista?avisar=${corpo.membro_id}`, tag: `vaga-adm-${ev.id}` },
    origem,
  );
  return NextResponse.json({ ok: true, enviados });
}
