// Prévia do link ao vivo no WhatsApp: mostra o placar do jogo em campo na hora em que o link é mandado.
import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { envSupabase } from "@/lib/supabase/env";
import { fontesMarca, SIMBOLO } from "@/lib/arte-marca";
import { corLegivel, misturar } from "@/lib/cores";

export const alt = "Placar ao vivo da pelada";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TIMES = ["Time 1", "Time 2", "Time 3", "Time 4", "Time 5"];

type P = { numero: number; time_a: number; time_b: number; placar_a: number; placar_b: number; status: string; vencedor: number | null };

async function buscar<T>(caminho: string): Promise<T[]> {
  try {
    const { url, chave } = envSupabase();
    const r = await fetch(`${url}/rest/v1/${caminho}`, { headers: { apikey: chave, Authorization: `Bearer ${chave}` }, cache: "no-store" });
    return r.ok ? ((await r.json()) as T[]) : [];
  } catch {
    return [];
  }
}

export default async function Imagem({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const [pelada] = await buscar<{ id: string; nome: string; cor_banner: string | null }>(`peladas?slug=eq.${encodeURIComponent(slug)}&select=id,nome,cor_banner`);
  const ontem = new Date(Date.now() - 36 * 3600 * 1000).toISOString().slice(0, 10);
  const eventos = pelada
    ? await buscar<{ id: string; status: string }>(`eventos?pelada_id=eq.${pelada.id}&status=neq.cancelado&data=gte.${ontem}&select=id,status&order=data.desc&limit=3`)
    : [];
  const ev = eventos.find((e) => e.status === "em_jogo") ?? eventos[0];
  const partidas = ev ? await buscar<P>(`partidas?evento_id=eq.${ev.id}&select=numero,time_a,time_b,placar_a,placar_b,status,vencedor&order=numero`) : [];
  const p = partidas[partidas.length - 1];

  const vit = new Map<number, number>();
  for (const x of partidas.filter((y) => y.status === "encerrada")) {
    const w = x.vencedor ?? (x.placar_a > x.placar_b ? x.time_a : x.placar_b > x.placar_a ? x.time_b : null);
    if (w !== null) vit.set(w, (vit.get(w) ?? 0) + 1);
  }
  const vitTxt = [...vit.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${TIMES[t]}: ${n}`).join("  ·  ");
  const cor = corLegivel(pelada?.cor_banner || "#7444D6");
  const status = !p ? "" : p.status === "encerrada" ? "ENCERRADO" : p.status === "pausado" ? "PAUSADO" : p.status === "rolando" ? "AO VIVO" : "VAI COMEÇAR";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          color: "#fff",
          fontFamily: "Grotesk",
          background: `radial-gradient(circle at 20% 0%, ${misturar(cor, "#FFFFFF", 0.3)} 0%, ${cor} 40%, ${misturar(cor, "#000000", 0.35)} 75%, #1B1430 100%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 52 }}>{pelada?.nome ?? "Pelada"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#B4460B", borderRadius: 999, padding: "10px 26px", fontSize: 30 }}>
            <div style={{ width: 16, height: 16, borderRadius: 999, background: "#fff" }} />
            {status || "PLACAR AO VIVO"}
          </div>
        </div>

        {p ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", fontSize: 32, color: "#E8DEFF" }}>Jogo {p.numero}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
              <div style={{ display: "flex", fontSize: 56 }}>{TIMES[p.time_a]}</div>
              <div style={{ display: "flex", fontSize: 170, lineHeight: 1 }}>
                {p.placar_a} × {p.placar_b}
              </div>
              <div style={{ display: "flex", fontSize: 56 }}>{TIMES[p.time_b]}</div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center", fontSize: 90 }}>Placar ao vivo</div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 28 }}>
          <div style={{ display: "flex", color: "#E8DEFF" }}>{vitTxt ? `Vitórias hoje · ${vitTxt}` : "Toque pra acompanhar"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={SIMBOLO} />
            </svg>
            MA Sorteio
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await fontesMarca(), headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } },
  );
}
