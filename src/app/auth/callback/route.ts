// Volta do Google: troca o código por uma sessão e manda a pessoa pra dentro do app.
import { NextResponse, type NextRequest } from "next/server";
import { clienteServidor } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const destino = searchParams.get("next") ?? "/";
  const seguro = destino.startsWith("/") && !destino.startsWith("//") ? destino : "/";

  if (code) {
    const supabase = await clienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${seguro}`);
  }
  return NextResponse.redirect(`${origin}/entrar?erro=google`);
}
