// Convite por link.
// GET  ?pelada_id=…  → admin pega o código do convite.
// POST {slug, codigo, membro_id?} → quem abriu o convite entra no elenco (ou se liga a um nome que já existe).
import { NextResponse, type NextRequest } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/server";
import { codigoConvite, conviteValido } from "@/lib/convite";

export async function GET(request: NextRequest) {
  const peladaId = request.nextUrl.searchParams.get("pelada_id");
  if (!peladaId) return NextResponse.json({ erro: "Falta a pelada." }, { status: 400 });
  const sb = await clienteServidor();
  const { data: ehAdmin } = await sb.rpc("eh_admin", { p: peladaId });
  if (!ehAdmin) return NextResponse.json({ erro: "Só admin." }, { status: 403 });
  return NextResponse.json({ codigo: codigoConvite(peladaId) });
}

export async function POST(request: NextRequest) {
  const corpo = (await request.json().catch(() => null)) as { slug?: string; codigo?: string; membro_id?: string | null } | null;
  if (!corpo?.slug || !corpo.codigo) return NextResponse.json({ erro: "Convite inválido." }, { status: 400 });

  const sb = await clienteServidor();
  const { data: eu } = await sb.auth.getUser();
  if (!eu.user) return NextResponse.json({ erro: "Entre primeiro." }, { status: 401 });

  const admin = clienteAdmin();
  const { data: pelada } = await admin.from("peladas").select("id, nome").eq("slug", corpo.slug).maybeSingle();
  if (!pelada || !conviteValido(pelada.id, corpo.codigo)) return NextResponse.json({ erro: "Esse convite não vale mais. Pede um novo pro admin." }, { status: 403 });

  const { data: ja } = await admin.from("membros").select("id").eq("pelada_id", pelada.id).eq("profile_id", eu.user.id).maybeSingle();
  if (ja) return NextResponse.json({ ok: true, jaEstava: true });

  if (corpo.membro_id) {
    // "Sou eu": liga a conta a um nome do elenco que ainda não tem dono.
    const { data, error } = await admin
      .from("membros")
      .update({ profile_id: eu.user.id })
      .eq("id", corpo.membro_id)
      .eq("pelada_id", pelada.id)
      .is("profile_id", null)
      .select("id");
    if (error || !data?.length) return NextResponse.json({ erro: "Esse nome já foi ligado a outra conta." }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  const { data: perfil } = await admin.from("profiles").select("nome, apelido").eq("id", eu.user.id).single();
  const { data: novo, error } = await admin
    .from("membros")
    .insert({ pelada_id: pelada.id, profile_id: eu.user.id, nome: perfil?.nome || "Jogador", apelido: perfil?.apelido ?? null, papel: "jogador" })
    .select("id")
    .single();
  if (error || !novo) return NextResponse.json({ erro: "Não deu pra entrar na pelada." }, { status: 500 });
  await admin.from("notas").insert({ membro_id: novo.id, nota_simples: 3 });
  return NextResponse.json({ ok: true });
}
