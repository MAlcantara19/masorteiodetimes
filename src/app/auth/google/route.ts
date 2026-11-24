// Volta do botão oficial do Google (modo "redirect", sem janelinha/popup).
// O Google manda um POST com o "credential" (um token que prova quem a pessoa é).
// Aqui a gente entrega esse token pro Supabase, que cria a sessão e grava o cookie de login.
import { NextResponse, type NextRequest } from "next/server";
import { clienteServidor } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const origem = request.nextUrl.origin;
  const form = await request.formData().catch(() => null);
  const credential = form?.get("credential");
  const csrfCorpo = form?.get("g_csrf_token");
  const csrfCookie = request.cookies.get("g_csrf_token")?.value;

  // Proteção do próprio Google: o token do formulário tem que bater com o do cookie.
  if (typeof credential !== "string" || (csrfCookie && csrfCookie !== csrfCorpo)) {
    return NextResponse.redirect(`${origem}/entrar?erro=google`, 303);
  }

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: credential });
  if (error) return NextResponse.redirect(`${origem}/entrar?erro=google`, 303);
  return NextResponse.redirect(`${origem}/`, 303);
}
