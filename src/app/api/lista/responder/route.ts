// Resposta direto pela notificação ("✋ Vou" / "Não vou"), sem abrir o app.
// Quem chama é o service worker do celular, com a sessão (cookies) de quem está logado.
import { NextResponse, type NextRequest } from "next/server";
import { clienteServidor } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const corpo = (await request.json().catch(() => null)) as { evento_id?: string; resposta?: string } | null;
  if (!corpo?.evento_id || (corpo.resposta !== "vou" && corpo.resposta !== "naovou")) return NextResponse.json({ ok: false, titulo: "Não deu certo", corpo: "Abre o app pra responder." }, { status: 400 });

  const sb = await clienteServidor();
  const { data: eu } = await sb.auth.getUser();
  if (!eu.user) return NextResponse.json({ ok: false, titulo: "Entra no app primeiro", corpo: "Abre o MA Sorteio e faz o login com o Google." }, { status: 401 });

  if (corpo.resposta === "vou") {
    const { data, error } = await sb.rpc("lista_entrar", { p_evento: corpo.evento_id, p_modo: "eu" });
    if (error) {
      const m = error.message;
      const txt = m.includes("ainda_nao_abriu") ? "A lista ainda não abriu." : m.includes("lista_lotada") ? "A lista lotou (até a espera)." : m.includes("sem_vinculo") ? "Abre a lista no app e toca no seu nome." : m.includes("lista_fechada") ? "A lista já fechou." : "Abre o app pra pôr o nome.";
      return NextResponse.json({ ok: false, titulo: "Não deu pra pôr seu nome", corpo: txt });
    }
    const r = data as { ja_estava?: boolean; status?: string } | null;
    return NextResponse.json({ ok: true, titulo: r?.ja_estava ? "Você já está na lista ✅" : r?.status === "espera" ? "Você entrou na espera ⏳" : "Seu nome está na lista ✅", corpo: "Se mudar de ideia, é só tirar o nome no app." });
  }

  const { data: subiu, error } = await sb.rpc("lista_sair", { p_evento: corpo.evento_id, p_membro: null });
  if (error) return NextResponse.json({ ok: false, titulo: "Não deu pra tirar seu nome", corpo: "Abre o app e tira por lá." });
  // Quem subiu da espera ganha o aviso (mesma rota que o app usa).
  if (subiu) {
    await fetch(`${request.nextUrl.origin}/api/lista/vaga`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" },
      body: JSON.stringify({ evento_id: corpo.evento_id, membro_id: subiu }),
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true, titulo: "Anotado: você não vai 👍", corpo: "Se mudar de ideia, põe o nome de novo no app." });
}
