// Envio de notificações (Web Push) a partir do servidor.
import "server-only";
import * as webpush from "web-push";
import { clienteAdmin } from "@/lib/supabase/server";

// `acoes` + `evento`: botões na notificação (✋ Vou / Não vou) que respondem sem abrir o app.
export type Mensagem = { titulo: string; corpo: string; url: string; tag?: string; acoes?: { action: string; title: string }[]; evento?: string };
export const ACOES_LISTA = [
  { action: "vou", title: "✋ Vou" },
  { action: "naovou", title: "Não vou" },
];

function configurar(origem: string): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(origem.startsWith("https://") ? origem : "https://masorteiodetimes.vercel.app", pub, priv);
  return true;
}

// Manda pra todos os aparelhos dessas pessoas. Apaga as inscrições que morreram.
export async function enviarPara(profileIds: string[], msg: Mensagem, origem: string): Promise<number> {
  if (!profileIds.length || !configurar(origem)) return 0;
  const admin = clienteAdmin();
  const { data } = await admin.from("push_subs").select("endpoint, keys").in("profile_id", [...new Set(profileIds)]);
  let enviados = 0;
  await Promise.all(
    (data ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(msg), { TTL: 6 * 3600 });
        enviados++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from("push_subs").delete().eq("endpoint", s.endpoint);
      }
    }),
  );
  return enviados;
}

// Perfis ligados ao elenco de uma pelada (opcional: só admins, ou só alguns membros).
export async function perfisDaPelada(peladaId: string, filtro: { soAdmins?: boolean; membros?: string[] } = {}): Promise<string[]> {
  let q = clienteAdmin().from("membros").select("profile_id").eq("pelada_id", peladaId).eq("ativo", true).not("profile_id", "is", null);
  if (filtro.soAdmins) q = q.eq("papel", "admin");
  if (filtro.membros?.length) q = q.in("id", filtro.membros);
  const { data } = await q;
  const ids = (data ?? []).map((m) => m.profile_id as string);
  if (filtro.soAdmins) {
    // O master também recebe os lembretes de admin.
    const { data: masters } = await clienteAdmin().from("profiles").select("id").eq("is_master", true);
    ids.push(...(masters ?? []).map((m) => m.id as string));
  }
  return [...new Set(ids)];
}
