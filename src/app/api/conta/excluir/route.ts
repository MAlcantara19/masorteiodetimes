// "Excluir minha conta" (LGPD): apaga o login e o perfil da própria pessoa.
// As estatísticas da pelada continuam, mas ficam só com o nome do elenco, sem ligação com a conta.
import { NextResponse } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/server";

export async function POST() {
  const sb = await clienteServidor();
  const { data: eu } = await sb.auth.getUser();
  if (!eu.user) return NextResponse.json({ erro: "Entre primeiro." }, { status: 401 });

  const admin = clienteAdmin();
  // Apaga as fotos de perfil e as fotos enviadas por ela.
  const pasta = eu.user.id;
  const { data: arquivos } = await admin.storage.from("imagens").list(pasta, { limit: 1000 });
  const { data: fotos } = await admin.storage.from("imagens").list(`${pasta}/fotos`, { limit: 1000 });
  const caminhos = [...(arquivos ?? []).filter((a) => a.id).map((a) => `${pasta}/${a.name}`), ...(fotos ?? []).map((a) => `${pasta}/fotos/${a.name}`)];
  if (caminhos.length) await admin.storage.from("imagens").remove(caminhos);

  const { error } = await admin.auth.admin.deleteUser(eu.user.id);
  if (error) return NextResponse.json({ erro: "Não deu pra excluir. Fala com o admin." }, { status: 500 });
  await sb.auth.signOut();
  return NextResponse.json({ ok: true });
}
