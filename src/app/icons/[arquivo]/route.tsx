// Ícones do app (PWA) desenhados na hora: /icons/192.png, /icons/512.png,
// /icons/maskable-512.png (Android recorta) e /icons/apple-180.png (iPhone).
import { ImageResponse } from "next/og";

const TAMANHOS: Record<string, { lado: number; margem: number }> = {
  "192.png": { lado: 192, margem: 0 },
  "512.png": { lado: 512, margem: 0 },
  "maskable-512.png": { lado: 512, margem: 0.12 },
  "apple-180.png": { lado: 180, margem: 0 },
};

export async function GET(_req: Request, ctx: RouteContext<"/icons/[arquivo]">) {
  const { arquivo } = await ctx.params;
  const t = TAMANHOS[arquivo];
  if (!t) return new Response("Não encontrado", { status: 404 });
  const { lado, margem } = t;
  const icone = lado * (1 - margem * 2) * 0.5;
  return new ImageResponse(
    (
      <div style={{ width: lado, height: lado, display: "flex", alignItems: "center", justifyContent: "center", background: "#1B1430" }}>
        <div
          style={{
            width: lado * (1 - margem * 2),
            height: lado * (1 - margem * 2),
            borderRadius: margem ? 0 : lado * 0.22,
            background: "#7444D6",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: lado * 0.02,
          }}
        >
          <svg width={icone} height={icone} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h4l10 12h4M3 18h4l3-3.6M14 9.6 17 6h4M18 3l3 3-3 3M18 15l3 3-3 3" />
          </svg>
          <div style={{ color: "#fff", fontSize: lado * 0.14, fontWeight: 700, letterSpacing: -1 }}>MA</div>
        </div>
      </div>
    ),
    { width: lado, height: lado, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
