// Cores da pelada: a partir da cor escolhida, monta os tons que o app usa
// (botões, capa, textos claros) e garante que o texto branco continue legível.

export const COR_PADRAO = "#7444D6";

export const PALETA = ["#7444D6", "#1A8F4E", "#0B6E4F", "#1B6FD6", "#0D2C6B", "#C2185B", "#B4460B", "#D62828", "#E0A100", "#111111", "#5B5570", "#00897B"];

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  return [parseInt(n.slice(0, 2), 16) || 0, parseInt(n.slice(2, 4), 16) || 0, parseInt(n.slice(4, 6), 16) || 0];
}

function hex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function misturar(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

function luminancia(c: string): number {
  const [r, g, b] = rgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// Escurece a cor até o texto branco ficar legível em cima dela.
export function corLegivel(c: string): string {
  let atual = /^#[0-9a-f]{6}$/i.test(c) ? c : COR_PADRAO;
  for (let i = 0; i < 12 && contraste(atual, "#FFFFFF") < 4.5; i++) atual = misturar(atual, "#000000", 0.12);
  return atual;
}

// Texto em cima da cor da camisa: branco ou preto, o que ler melhor.
export function textoSobre(c: string): string {
  return contraste(c, "#FFFFFF") >= contraste(c, "#111111") ? "#FFFFFF" : "#111111";
}

// Variáveis CSS do tema (as mesmas do globals.css).
export function varsDaMarca(cor: string | null | undefined): Record<string, string> {
  const base = corLegivel(cor || COR_PADRAO);
  if (base.toUpperCase() === COR_PADRAO) {
    return { "--marca": "#7444D6", "--marca-escuro": "#4F2A9E", "--marca-suave": "#EFE8FC", "--marca-claro": "#C9B2FF", "--marca-luz": "#9B6BFF" };
  }
  return {
    "--marca": base,
    "--marca-escuro": misturar(base, "#000000", 0.32),
    "--marca-suave": misturar(base, "#FFFFFF", 0.9),
    "--marca-claro": misturar(base, "#FFFFFF", 0.6),
    "--marca-luz": misturar(base, "#FFFFFF", 0.3),
  };
}
