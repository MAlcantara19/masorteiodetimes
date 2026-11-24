// Roda antes de cada página: renova o cookie de login do Supabase pra ninguém ser deslogado à toa.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let resposta = NextResponse.next({ request });
  if (!url || !chave) return resposta;

  const supabase = createServerClient(url, chave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista, headers) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        resposta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => resposta.headers.set(k, v));
      },
    },
  });
  await supabase.auth.getUser();
  return resposta;
}

export const config = {
  // Não roda em arquivos estáticos nem imagens.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
