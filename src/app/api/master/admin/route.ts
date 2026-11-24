// Rota de servidor: o master cria um admin com e-mail e senha temporária.
// Usa a chave secreta (passa por cima das permissões), por isso confere antes se quem pediu é master.
import { NextResponse, type NextRequest } from "next/server";
import { randomInt } from "node:crypto";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/server";

const PALAVRAS = ["bola", "gol", "chute", "drible", "trave", "rede", "quadra", "pelada", "craque", "passe", "lance", "placar"];

function gerarSenha() {
  const p = PALAVRAS[randomInt(PALAVRAS.length)];
  const q = PALAVRAS[randomInt(PALAVRAS.length)];
  return `${p}-${q}-${randomInt(1000, 9999)}`;
}

export async function POST(request: NextRequest) {
  const sb = await clienteServidor();
  const { data: eu } = await sb.auth.getUser();
  if (!eu.user) return NextResponse.json({ erro: "Entre primeiro." }, { status: 401 });
  const { data: perfil } = await sb.from("profiles").select("is_master").eq("id", eu.user.id).maybeSingle();
  if (!perfil?.is_master) return NextResponse.json({ erro: "Só o master pode fazer isso." }, { status: 403 });

  const corpo = (await request.json().catch(() => null)) as { pelada_id?: string; email?: string; nome?: string } | null;
  const email = corpo?.email?.trim().toLowerCase();
  const nome = corpo?.nome?.trim() || email?.split("@")[0] || "";
  if (!corpo?.pelada_id || !email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ erro: "Coloca um e-mail válido." }, { status: 400 });
  }

  const admin = clienteAdmin();
  const { data: existente } = await admin.from("profiles").select("id, nome, apelido").ilike("email", email).maybeSingle();

  let profileId = existente?.id as string | undefined;
  let senha: string | null = null;
  if (!profileId) {
    senha = gerarSenha();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { full_name: nome },
    });
    if (error || !data.user) return NextResponse.json({ erro: "Não deu pra criar o usuário: " + (error?.message ?? "") }, { status: 400 });
    profileId = data.user.id;
  }

  // Coloca (ou promove) no elenco da pelada como admin.
  const { data: membro } = await admin.from("membros").select("id").eq("pelada_id", corpo.pelada_id).eq("profile_id", profileId).maybeSingle();
  const res = membro
    ? await admin.from("membros").update({ papel: "admin", ativo: true }).eq("id", membro.id)
    : await admin.from("membros").insert({
        pelada_id: corpo.pelada_id,
        profile_id: profileId,
        nome: existente?.nome || nome,
        apelido: existente?.apelido ?? null,
        papel: "admin",
      });
  if (res.error) return NextResponse.json({ erro: "Usuário criado, mas não deu pra pôr na pelada." }, { status: 500 });

  return NextResponse.json({ ok: true, senha, jaExistia: !!existente });
}
