// Código do convite por link: assinado com a chave secreta (só o servidor sabe gerar e conferir).
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export function codigoConvite(peladaId: string): string {
  const segredo = process.env.SUPABASE_SECRET_KEY ?? "";
  return createHmac("sha256", segredo).update(`convite:${peladaId}`).digest("base64url").slice(0, 16);
}

export function conviteValido(peladaId: string, codigo: string): boolean {
  const certo = Buffer.from(codigoConvite(peladaId));
  const veio = Buffer.from(codigo ?? "");
  return certo.length === veio.length && timingSafeEqual(certo, veio);
}
