// Cliente do Supabase no navegador. Usado a partir da etapa 2 (login e dados na nuvem).
import { createBrowserClient } from "@supabase/ssr";

export function criarClienteSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local");
  return createBrowserClient(url, chave);
}
