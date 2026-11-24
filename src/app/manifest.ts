import type { MetadataRoute } from "next";

// Manifesto do PWA: nome, cores e ícones pra instalar na tela inicial.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MA Sorteio de Times",
    short_name: "MA Sorteio",
    description: "Times equilibrados, placar ao vivo e o campeonato da sua pelada.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1B1430",
    theme_color: "#1B1430",
    lang: "pt-BR",
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
