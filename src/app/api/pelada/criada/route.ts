// Alguém criou a própria pelada: avisa o master (pra ele entrar em contato e oferecer o Completo).
import { NextResponse, type NextRequest } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/server";
import { enviarPara } from "@/lib/push-servidor";

export async function POST(request: NextRequest) {
  const corpo = (await request.json().catch(() => null)) as { slug?: string } | null;
  if (!corpo?.slug) return NextResponse.json({ erro: "Pedido incompleto." }, { status: 400 });
  const sb = await clienteServidor();
  const { data: eu } = await sb.auth.getUser();
  if (!eu.user) return NextResponse.json({ erro: "Entre primeiro." }, { status: 401 });

  const admin = clienteAdmin();
  const { data: p } = await admin.from("peladas").select("nome, criado_por, created_at").eq("slug", corpo.slug).maybeSingle();
  // Só vale pra pelada que essa pessoa acabou de criar.
  if (!p || p.criado_por !== eu.user.id || Date.now() - new Date(p.created_at).getTime() > 10 * 60_000) return NextResponse.json({ ok: true, enviados: 0 });
  const { data: perfil } = await admin.from("profiles").select("nome, apelido").eq("id", eu.user.id).single();
  const { data: masters } = await admin.from("profiles").select("id").eq("is_master", true);
  const enviados = await enviarPara(
    (masters ?? []).map((m) => m.id as string).filter((id) => id !== eu.user!.id),
    { titulo: `🆕 Pelada nova: ${p.nome}`, corpo: `${perfil?.apelido || perfil?.nome || "Alguém"} criou e está no teste de 15 dias. Toque pra ver o contato.`, url: "/master", tag: `nova-${corpo.slug}` },
    request.nextUrl.origin,
  );
  return NextResponse.json({ ok: true, enviados });
}
