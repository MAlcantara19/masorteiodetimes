import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MA Sorteio de Times",
    short_name: "MA Sorteio",
    description: "Times equilibrados, placar ao vivo e o campeonato da sua pelada.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F4FA",
    theme_color: "#1B1430",
    lang: "pt-BR",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
