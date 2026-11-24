// Lê as variáveis do Supabase do .env.local (ou da Vercel).
// As NEXT_PUBLIC_ precisam ser escritas por extenso pra o Next colocá-las no navegador.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function envSupabase() {
  if (!url || !chave) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env.local");
  }
  return { url: url.replace(/\/+$/, ""), chave };
}
