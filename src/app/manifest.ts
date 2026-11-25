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
    // No Android, com o app instalado: Zap → segurar a lista → Compartilhar → MA Sorteio.
    // Segurar o ícone do app no celular: atalhos direto pra pelada que a pessoa abriu por último.
    shortcuts: [
      { name: "Partida ao vivo", short_name: "Partida", url: "/ir/jogo", icons: [{ src: "/icons/192.png", sizes: "192x192" }] },
      { name: "Lista da semana", short_name: "Lista", url: "/ir/lista", icons: [{ src: "/icons/192.png", sizes: "192x192" }] },
      { name: "Montar sorteio", short_name: "Sorteio", url: "/ir/sortear", icons: [{ src: "/icons/192.png", sizes: "192x192" }] },
      { name: "Cronômetro", short_name: "Cronômetro", url: "/cronometro", icons: [{ src: "/icons/192.png", sizes: "192x192" }] },
    ],
    share_target: { action: "/compartilhar", method: "GET", params: { title: "title", text: "text", url: "url" } },
    icons: [
      { src: "/icons/192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
