// O app pede uma notificação ("a pelada começou", "votação aberta", "você ganhou medalha").
// Só admin da pelada pode pedir; quem recebe é decidido aqui no servidor.
import { NextResponse, type NextRequest } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/server";
import { enviarPara, perfisDaPelada } from "@/lib/push-servidor";

export async function POST(request: NextRequest) {
  const corpo = (await request.json().catch(() => null)) as { pelada_id?: string; tipo?: string; membros?: string[] } | null;
  if (!corpo?.pelada_id || !corpo.tipo) return NextResponse.json({ erro: "Pedido incompleto." }, { status: 400 });

  const sb = await clienteServidor();
  const { data: eu } = await sb.auth.getUser();
  if (!eu.user) return NextResponse.json({ erro: "Entre primeiro." }, { status: 401 });
  const { data: ehAdmin } = await sb.rpc("eh_admin", { p: corpo.pelada_id });
  if (!ehAdmin) return NextResponse.json({ erro: "Só admin." }, { status: 403 });

  const { data: pelada } = await clienteAdmin().from("peladas").select("nome, slug").eq("id", corpo.pelada_id).single();
  if (!pelada) return NextResponse.json({ erro: "Pelada não encontrada." }, { status: 404 });
  const origem = request.nextUrl.origin;

  let enviados = 0;
  if (corpo.tipo === "comecou") {
    const ids = await perfisDaPelada(corpo.pelada_id);
    enviados = await enviarPara(ids.filter((id) => id !== eu.user!.id), { titulo: `⚽ ${pelada.nome} começou!`, corpo: "Acompanha o placar ao vivo.", url: `/p/${pelada.slug}/ao-vivo`, tag: "comecou" }, origem);
  } else if (corpo.tipo === "votacao") {
    const ids = await perfisDaPelada(corpo.pelada_id);
    enviados = await enviarPara(ids, { titulo: `🗳️ Votação aberta · ${pelada.nome}`, corpo: "Vota no craque, no bagre e no melhor goleiro do dia.", url: `/p/${pelada.slug}/votar`, tag: "votacao" }, origem);
  } else if (corpo.tipo === "medalha" && corpo.membros?.length) {
    const ids = await perfisDaPelada(corpo.pelada_id, { membros: corpo.membros });
    enviados = await enviarPara(ids, { titulo: "🏅 Você ganhou medalha!", corpo: `Olha teu card na ${pelada.nome}.`, url: "/perfil/card", tag: "medalha" }, origem);
  }
  return NextResponse.json({ ok: true, enviados });
}
