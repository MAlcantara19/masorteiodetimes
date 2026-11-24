// Capa que aparece quando alguém manda o link do app no WhatsApp/Instagram.
import { ImageResponse } from "next/og";
import { ArteMarca, fontesMarca } from "@/lib/arte-marca";

export const alt = "MA Sorteio de Times: sorteie, jogue e premie a sua pelada";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Imagem() {
  return new ImageResponse(<ArteMarca formato="capa" largura={1200} altura={630} />, { ...size, fonts: await fontesMarca() });
}
