// Arte da marca MA Sorteio de Times, desenhada em código (vira PNG nas rotas /marca/... e na capa de link).
// Fundo roxo, símbolo do sorteio (setas cruzadas) e o nome. Só depende do ImageResponse do Next.

export const SIMBOLO = "M3 6h4l10 12h4M3 18h4l3-3.6M14 9.6 17 6h4M18 3l3 3-3 3M18 15l3 3-3 3";

const FUNDO = "radial-gradient(circle at 25% 15%, #9B6BFF 0%, #7444D6 35%, #4F2A9E 70%, #1B1430 100%)";

function Simbolo({ lado }: { lado: number }) {
  return (
    <div style={{ width: lado, height: lado, borderRadius: lado * 0.26, background: "rgba(255,255,255,0.14)", border: "3px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={lado * 0.6} height={lado * 0.6} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d={SIMBOLO} />
      </svg>
    </div>
  );
}

function Nome({ tamanho, esquerda }: { tamanho: number; esquerda?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: esquerda ? "flex-start" : "center", lineHeight: 1, fontFamily: "Grotesk" }}>
      <div style={{ display: "flex", fontSize: tamanho, fontWeight: 800, color: "#fff", letterSpacing: -2 }}>
        MA <span style={{ color: "#C9B2FF", marginLeft: tamanho * 0.25 }}>Sorteio</span>
      </div>
      <div style={{ fontSize: tamanho * 0.42, fontWeight: 700, color: "#EFE8FC", marginTop: tamanho * 0.12, letterSpacing: 1 }}>DE TIMES</div>
    </div>
  );
}

const ITENS = ["⚖️  Times equilibrados", "⏱️  Placar ao vivo", "🏆  Campeonato e prêmios", "🃏  Cartas dos jogadores"];

// formato: logo (quadrado só com símbolo e nome), post (1080²), story (1080×1920), capa (1200×630, link do Zap)
export function ArteMarca({ formato, largura, altura }: { formato: "logo" | "post" | "story" | "capa"; largura: number; altura: number }) {
  const base = Math.min(largura, altura);
  const story = formato === "story";
  const capa = formato === "capa";
  return (
    <div
      style={{
        width: largura,
        height: altura,
        display: "flex",
        flexDirection: capa ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: base * (capa ? 0.08 : 0.06),
        background: FUNDO,
        fontFamily: "sans-serif",
        padding: base * 0.07,
        position: "relative",
      }}
    >
      {/* faixas diagonais de fundo */}
      <div style={{ position: "absolute", inset: 0, display: "flex", background: "repeating-linear-gradient(125deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 46px)" }} />
      <Simbolo lado={base * (formato === "logo" ? 0.42 : capa ? 0.42 : story ? 0.26 : 0.17)} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: capa ? "flex-start" : "center", gap: base * 0.04 }}>
        <Nome tamanho={base * (formato === "logo" ? 0.12 : capa ? 0.13 : story ? 0.1 : 0.09)} esquerda={capa} />
        {formato !== "logo" && (
          <div style={{ fontSize: base * (capa ? 0.045 : 0.038), color: "#EFE8FC", textAlign: capa ? "left" : "center", maxWidth: largura * 0.8, display: "flex" }}>
            Sorteie, jogue e premie a sua pelada.
          </div>
        )}
        {(formato === "post" || story) && (
          <div style={{ display: "flex", flexDirection: story ? "column" : "row", flexWrap: "wrap", justifyContent: "center", gap: base * 0.018, marginTop: base * 0.02, maxWidth: largura * 0.86 }}>
            {ITENS.map((t) => (
              <div key={t} style={{ display: "flex", fontSize: base * (story ? 0.04 : 0.03), color: "#fff", background: "rgba(255,255,255,0.12)", borderRadius: 999, padding: `${base * 0.014}px ${base * 0.035}px` }}>
                {t}
              </div>
            ))}
          </div>
        )}
      </div>
      {formato !== "logo" && !capa && (
        <div style={{ position: "absolute", bottom: base * 0.04, display: "flex", fontSize: base * 0.026, color: "#C9B2FF", letterSpacing: 2 }}>
          GRÁTIS PRA JOGAR · SEM ANÚNCIO
        </div>
      )}
    </div>
  );
}

// Space Grotesk em negrito (a mesma fonte dos títulos do app). Sem internet, usa a fonte padrão.
export async function fontesMarca(): Promise<{ name: string; data: ArrayBuffer; weight: 700; style: "normal" }[]> {
  try {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700")).text();
    const url = css.match(/src: url\((.+?)\) format/)?.[1];
    if (!url) return [];
    const data = await (await fetch(url)).arrayBuffer();
    return [{ name: "Grotesk", data, weight: 700, style: "normal" }];
  } catch {
    return [];
  }
}
