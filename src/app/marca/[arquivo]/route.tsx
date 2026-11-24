// Arte da marca pra baixar e postar: /marca/logo.png, /marca/post.png, /marca/story.png e /marca/capa.png
import { ImageResponse } from "next/og";
import { ArteMarca, fontesMarca } from "@/lib/arte-marca";

const FORMATOS = {
  "logo.png": { formato: "logo", largura: 1024, altura: 1024 },
  "post.png": { formato: "post", largura: 1080, altura: 1080 },
  "story.png": { formato: "story", largura: 1080, altura: 1920 },
  "capa.png": { formato: "capa", largura: 1200, altura: 630 },
} as const;

export async function GET(_req: Request, ctx: RouteContext<"/marca/[arquivo]">) {
  const { arquivo } = await ctx.params;
  const f = FORMATOS[arquivo as keyof typeof FORMATOS];
  if (!f) return new Response("Não encontrado", { status: 404 });
  return new ImageResponse(<ArteMarca formato={f.formato} largura={f.largura} altura={f.altura} />, {
    width: f.largura,
    height: f.altura,
    headers: { "Cache-Control": "public, max-age=86400" },
    fonts: await fontesMarca(),
  });
}
