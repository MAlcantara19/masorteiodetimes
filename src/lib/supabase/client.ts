// Cliente do Supabase no navegador. Usa a chave publicável: quem protege os dados é o RLS do banco.
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { envSupabase } from "./env";

let cliente: SupabaseClient | null = null;

export function criarClienteSupabase(): SupabaseClient {
  if (cliente) return cliente;
  const { url, chave } = envSupabase();
  cliente = createBrowserClient(url, chave);
  return cliente;
}
