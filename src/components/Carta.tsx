// Carta do jogador (design próprio do MA Sorteio, nada de arte de jogo de videogame).
// Mostra só estatísticas de jogo: nunca nota/estrelas.
import { forwardRef } from "react";

export type Raridade = "bronze" | "prata" | "ouro" | "destaque" | "mes";

export const ESTILOS: Record<Raridade, { bg: (cor: string) => string; fg: string; accent: string; line: string; photoBg: string; label: string }> = {
  bronze: { bg: () => "linear-gradient(160deg, #E9C29C 0%, #A6673A 100%)", fg: "#2A1607", accent: "#5A3214", line: "rgba(90,50,20,0.35)", photoBg: "rgba(255,255,255,0.35)", label: "BRONZE" },
  prata: { bg: () => "linear-gradient(160deg, #F3F5F8 0%, #A4ADB8 100%)", fg: "#1B2127", accent: "#46505B", line: "rgba(70,80,91,0.35)", photoBg: "rgba(255,255,255,0.5)", label: "PRATA" },
  ouro: { bg: () => "linear-gradient(160deg, #FCEBAA 0%, #C6952A 100%)", fg: "#2C2105", accent: "#6B4E0E", line: "rgba(107,78,14,0.35)", photoBg: "rgba(255,255,255,0.4)", label: "OURO" },
  destaque: { bg: () => "linear-gradient(160deg, #2A2A30 0%, #050506 100%)", fg: "#F7EBC4", accent: "#E6C56A", line: "rgba(230,197,106,0.45)", photoBg: "#1A1A1F", label: "DESTAQUE DA SEMANA" },
  mes: { bg: (cor) => `linear-gradient(160deg, ${cor} 0%, #0B0710 100%)`, fg: "#FFFFFF", accent: "#FFFFFF", line: "rgba(255,255,255,0.4)", photoBg: "rgba(0,0,0,0.25)", label: "JOGADOR DO MÊS" },
};

export const ORDEM_RARIDADE: Raridade[] = ["bronze", "prata", "ouro", "destaque", "mes"];

type Props = {
  apelido: string;
  posicao: string; // DEF, MEI, ATA, GOL, QLQ
  pelada: string;
  raridade: Raridade;
  cor?: string | null;
  foto?: string | null;
  stats: { v: number | string; l: string }[];
  escala?: number;
};

const Carta = forwardRef<HTMLDivElement, Props>(function Carta({ apelido, posicao, pelada, raridade, cor, foto, stats, escala = 1 }, ref) {
  const t = ESTILOS[raridade];
  return (
    <div
      ref={ref}
      style={{ width: 200 * escala, height: 290 * escala, borderRadius: 18 * escala, background: t.bg(cor || "#C8102E"), color: t.fg, padding: 6 * escala, boxShadow: "0 6px 18px rgba(0,0,0,0.25)" }}
      className="shrink-0"
    >
      <div
        style={{ border: `1.5px solid ${t.line}`, borderRadius: 13 * escala, padding: `${10 * escala}px ${12 * escala}px`, gap: 6 * escala }}
        className="relative flex h-full w-full flex-col items-center"
      >
        <div className="flex w-full items-start justify-between">
          <div className="flex flex-col items-center leading-none">
            <span className="font-display font-bold" style={{ fontSize: 22 * escala }}>
              {posicao}
            </span>
            <span className="font-bold" style={{ fontSize: 8 * escala, letterSpacing: 0.6, color: t.accent, marginTop: 3 * escala }}>
              {pelada.toUpperCase()}
            </span>
          </div>
          <span
            className="text-center font-bold"
            style={{ fontSize: 8 * escala, letterSpacing: 0.8, padding: `${3 * escala}px ${6 * escala}px`, borderRadius: 99, border: `1px solid ${t.accent}`, color: t.accent, maxWidth: 96 * escala, lineHeight: 1.2 }}
          >
            {t.label}
          </span>
        </div>
        <div
          className="flex items-center justify-center overflow-hidden rounded-full font-display font-bold"
          style={{ width: 84 * escala, height: 84 * escala, border: `2px solid ${t.accent}`, background: t.photoBg, fontSize: 28 * escala, color: t.accent }}
        >
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />
          ) : (
            apelido.slice(0, 2).toUpperCase()
          )}
        </div>
        <span className="text-center font-display font-bold" style={{ fontSize: (apelido.length > 12 ? 17 : 22) * escala, letterSpacing: -0.4, lineHeight: 1.1 }}>
          {apelido}
        </span>
        <div className="w-full" style={{ height: 1, background: t.line }} />
        <div className="grid w-full grid-cols-2" style={{ gap: `${2 * escala}px ${10 * escala}px` }}>
          {stats.map((s) => (
            <div key={s.l} className="flex items-baseline" style={{ gap: 5 * escala }}>
              <span className="font-display font-bold" style={{ fontSize: 16 * escala }}>
                {s.v}
              </span>
              <span className="font-bold" style={{ fontSize: 10 * escala, color: t.accent }}>
                {s.l}
              </span>
            </div>
          ))}
        </div>
        <span className="absolute font-semibold" style={{ bottom: 7 * escala, fontSize: 8 * escala, letterSpacing: 0.6, color: t.accent }}>
          MA SORTEIO
        </span>
      </div>
    </div>
  );
});

export default Carta;
