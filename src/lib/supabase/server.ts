// Clientes do Supabase no servidor (rotas e Server Components).
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { envSupabase } from "./env";

// Cliente "como o usuário logado": lê o cookie de sessão e respeita o RLS.
export async function clienteServidor() {
  const { url, chave } = envSupabase();
  const loja = await cookies();
  return createServerClient(url, chave, {
    cookies: {
      getAll: () => loja.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => loja.set(name, value, options));
        } catch {
          // Chamado de um Server Component: o proxy renova o cookie, pode ignorar.
        }
      },
    },
  });
}

// Cliente com a chave secreta: passa por cima do RLS. Só usar em rota de servidor,
// depois de conferir que quem pediu é master.
export function clienteAdmin() {
  const { url } = envSupabase();
  const secreta = process.env.SUPABASE_SECRET_KEY;
  if (!secreta) throw new Error("Falta SUPABASE_SECRET_KEY no .env.local");
  return createClient(url, secreta, { auth: { persistSession: false, autoRefreshToken: false } });
}
