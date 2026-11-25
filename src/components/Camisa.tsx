// Camisa da pelada desenhada em SVG, montada peça por peça:
// cor principal, cor do detalhe (gola, punho, frisos), cor do desenho, o padrão (inspirado nas tendências
// das camisas de seleção: étnico, ondas, relevo, pinceladas, folhagem, quadriculado…), desenho "tom sobre tom"
// ou em contraste, tipo de gola, mangas e friso no ombro. Logo da pelada no peito; de costas, nome e número.
// Tudo genérico: sem marca de fabricante nem escudo de seleção nenhuma.
import { useId } from "react";
import { misturar, textoSobre } from "@/lib/cores";

export type Gola = "redonda" | "v" | "polo" | "retro";
export type Mangas = "iguais" | "detalhe" | "raglan";
export type OpcoesCamisa = {
  tom?: "tom" | "contraste"; // tom sobre tom (desenho discreto na própria cor) ou contraste
  cor3?: string | null; // cor do desenho no modo contraste (padrão: a do detalhe)
  gola?: Gola;
  mangas?: Mangas;
  friso?: boolean; // friso fino no ombro, de duas cores
};

export type EstiloCamisa =
  | "lisa"
  | "jacquard"
  | "etnico"
  | "ondas"
  | "relevo"
  | "pinceladas"
  | "listras"
  | "riscas"
  | "listras_onduladas"
  | "quadriculado"
  | "chevron"
  | "faixa_peito"
  | "faixa"
  | "degrade"
  | "manchas"
  | "folhagem"
  | "cruz_nordica"
  | "pontilhado"
  | "metade"
  | "listras_horizontais";

export const ESTILOS_CAMISA: { valor: EstiloCamisa; rotulo: string; padrao?: OpcoesCamisa }[] = [
  { valor: "lisa", rotulo: "Lisa", padrao: { gola: "v" } },
  { valor: "jacquard", rotulo: "Jacquard", padrao: { tom: "tom", gola: "redonda" } },
  { valor: "etnico", rotulo: "Étnico", padrao: { tom: "tom", gola: "v", friso: true } },
  { valor: "ondas", rotulo: "Ondas", padrao: { tom: "tom", gola: "v" } },
  { valor: "relevo", rotulo: "Relevo", padrao: { tom: "tom", gola: "redonda" } },
  { valor: "pinceladas", rotulo: "Pinceladas", padrao: { tom: "contraste", gola: "redonda" } },
  { valor: "listras", rotulo: "Listras", padrao: { tom: "contraste", gola: "v" } },
  { valor: "riscas", rotulo: "Riscas coloridas", padrao: { tom: "contraste", gola: "retro" } },
  { valor: "listras_onduladas", rotulo: "Listras onduladas", padrao: { tom: "contraste", gola: "redonda" } },
  { valor: "listras_horizontais", rotulo: "Listras deitadas", padrao: { tom: "contraste", gola: "redonda" } },
  { valor: "quadriculado", rotulo: "Quadriculado", padrao: { tom: "contraste", gola: "redonda" } },
  { valor: "chevron", rotulo: "V no peito", padrao: { tom: "contraste", gola: "v" } },
  { valor: "faixa_peito", rotulo: "Faixa no peito", padrao: { tom: "contraste", gola: "polo" } },
  { valor: "faixa", rotulo: "Faixa diagonal", padrao: { tom: "contraste", gola: "v" } },
  { valor: "degrade", rotulo: "Degradê", padrao: { tom: "contraste", gola: "v" } },
  { valor: "manchas", rotulo: "Camuflado", padrao: { tom: "tom", gola: "redonda" } },
  { valor: "folhagem", rotulo: "Folhagem", padrao: { tom: "tom", gola: "v" } },
  { valor: "cruz_nordica", rotulo: "Cruz nórdica", padrao: { tom: "contraste", gola: "redonda" } },
  { valor: "pontilhado", rotulo: "Pontilhado", padrao: { tom: "contraste", gola: "v" } },
  { valor: "metade", rotulo: "Metade", padrao: { tom: "contraste", gola: "redonda" } },
];

// Modelos antigos (de antes do editor): viram um modelo novo + opções parecidas.
const ANTIGOS: Record<string, { modelo: EstiloCamisa; extra?: OpcoesCamisa }> = {
  listras_finas: { modelo: "riscas", extra: { tom: "contraste" } },
  listras_degrade: { modelo: "riscas", extra: { tom: "contraste" } },
  centro: { modelo: "listras", extra: { tom: "contraste" } },
  faixa_baixa: { modelo: "faixa_peito", extra: { tom: "contraste" } },
  quartos: { modelo: "metade" },
  cruz: { modelo: "cruz_nordica" },
  gola: { modelo: "lisa" },
  mangas: { modelo: "lisa", extra: { mangas: "detalhe" } },
  ombros: { modelo: "lisa", extra: { mangas: "raglan" } },
  lateral: { modelo: "lisa", extra: { mangas: "raglan" } },
  polo: { modelo: "lisa", extra: { gola: "polo" } },
  gradiente: { modelo: "degrade" },
  geometrico: { modelo: "jacquard", extra: { tom: "contraste" } },
  diagonal: { modelo: "pinceladas" },
  xadrez: { modelo: "quadriculado" },
  raio: { modelo: "chevron" },
};

export function resolverCamisa(estilo: string | null | undefined, opcoes?: OpcoesCamisa | null): { modelo: EstiloCamisa; op: Required<Omit<OpcoesCamisa, "cor3">> & { cor3: string | null } } {
  const antigo = estilo ? ANTIGOS[estilo] : undefined;
  const modelo = (antigo?.modelo ?? (ESTILOS_CAMISA.some((e) => e.valor === estilo) ? estilo : "lisa")) as EstiloCamisa;
  const base = ESTILOS_CAMISA.find((e) => e.valor === modelo)?.padrao ?? {};
  const o = { ...base, ...(antigo?.extra ?? {}), ...(opcoes ?? {}) };
  return { modelo, op: { tom: o.tom ?? "contraste", cor3: o.cor3 ?? null, gola: o.gola ?? "redonda", mangas: o.mangas ?? "iguais", friso: !!o.friso } };
}

// Silhueta: ombro caído, manga curta, levemente acinturada, barra curva.
const CORPO =
  "M71 12 C60 14 48 18 39 24 L9 53 L28 89 L52 78 C53 112 52 168 49 206 Q100 216 151 206 C148 168 147 112 148 78 L172 89 L191 53 L161 24 C152 18 140 14 129 12 C123 25 113 33 100 34 C87 33 77 25 71 12 Z";
const CORPO_COSTAS = CORPO.replace("C123 25 113 33 100 34 C87 33 77 25 71 12", "C118 18 82 18 71 12");
const MANGA_E = "M44 21 L9 53 L28 89 L53 78 C54 60 56 44 61 31 Z";
const MANGA_D = "M156 21 L191 53 L172 89 L147 78 C146 60 144 44 139 31 Z";
const RAGLAN_E = "M73 13 C66 30 58 52 53 78 L28 89 L9 53 L39 24 C48 18 60 14 71 12 Z";
const RAGLAN_D = "M127 13 C134 30 142 52 147 78 L172 89 L191 53 L161 24 C152 18 140 14 129 12 Z";

// Número "aleatório" fixo, só com inteiros (sai igual no servidor e no celular).
const ruido = (i: number) => ((i * 9301 + 49297) % 233280) / 233280;
const r1 = (n: number) => Math.round(n * 10) / 10;

type Props = {
  cor: string;
  cor2: string;
  estilo?: string | null;
  opcoes?: OpcoesCamisa | null;
  logo?: string | null;
  sigla?: string; // se não tiver logo
  costas?: { nome: string; numero?: string | number | null } | null;
  largura?: number;
  className?: string;
};

// Curvas de nível (relevo): anéis irregulares em volta de um ponto.
function aneis(cx: number, cy: number, n: number) {
  const out: string[] = [];
  for (let k = 1; k <= n; k++) {
    const R = k * 13;
    let d = "";
    for (let a = 0; a <= 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      const r = R * (1 + 0.13 * Math.sin(3 * t + k * 0.7) + 0.07 * Math.cos(5 * t + k));
      d += `${a ? "L" : "M"}${r1(cx + r * Math.cos(t))} ${r1(cy + r * Math.sin(t) * 0.9)} `;
    }
    out.push(d + "Z");
  }
  return out;
}

function Desenho({ e, F, F2, base, id }: { e: EstiloCamisa; F: string; F2: string; base: string; id: string }) {
  const tronco = `url(#t${id})`;
  switch (e) {
    case "jacquard":
      return <rect width="200" height="220" fill={`url(#pj${id})`} />;
    case "etnico":
      return <rect width="200" height="220" fill={`url(#pe${id})`} />;
    case "ondas":
      return <rect width="200" height="220" fill={`url(#po${id})`} />;
    case "folhagem":
      return <rect width="200" height="220" fill={`url(#pf${id})`} />;
    case "relevo":
      return (
        <>
          {aneis(132, 120, 9).map((d, i) => (
            <path key={i} d={d} fill="none" stroke={F} strokeWidth="1.6" />
          ))}
          {aneis(40, 40, 5).map((d, i) => (
            <path key={`b${i}`} d={d} fill="none" stroke={F} strokeWidth="1.6" />
          ))}
        </>
      );
    case "pinceladas":
      return (
        <g clipPath={tronco}>
          {[0, 1, 2, 3, 4, 5].map((s) => {
            const x0 = 56 + s * 16;
            let esq = "";
            let dir = "";
            for (let y = 0; y <= 220; y += 10) {
              const j = (ruido(s * 40 + y) - 0.5) * 5;
              esq += `${y ? "L" : "M"}${r1(x0 + j)} ${y} `;
              dir = `L${r1(x0 + 8 + (ruido(s * 77 + y) - 0.5) * 5)} ${y} ` + dir;
            }
            return <path key={s} d={`${esq}${dir.replace(/^L/, "L")}Z`} fill={F} />;
          })}
        </g>
      );
    case "listras":
      return (
        <g clipPath={tronco}>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={62 + i * 28} y="0" width="16" height="220" fill={F} />
          ))}
        </g>
      );
    case "riscas":
      return (
        <g clipPath={tronco}>
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x={55 + i * 8} y="0" width="1.5" height="220" fill={i % 2 ? F2 : F} opacity="0.9" />
          ))}
        </g>
      );
    case "listras_onduladas":
      return (
        <>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const y = 34 + i * 27;
            return <path key={i} d={`M-10 ${y} Q20 ${y - 7} 50 ${y} T110 ${y} T170 ${y} T230 ${y} V${y + 12} Q200 ${y + 5} 170 ${y + 12} T110 ${y + 12} T50 ${y + 12} T-10 ${y + 12} Z`} fill={F} />;
          })}
        </>
      );
    case "listras_horizontais":
      return (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x="0" y={44 + i * 30} width="200" height="14" fill={F} />
          ))}
        </>
      );
    case "quadriculado":
      return (
        <g clipPath={tronco}>
          {Array.from({ length: 16 }, (_, l) =>
            Array.from({ length: 9 }, (_, c) => ((l + c) % 2 ? <rect key={`${l}-${c}`} x={51 + c * 11} y={28 + l * 12} width="11" height="12" fill={F} /> : null)),
          )}
        </g>
      );
    case "chevron":
      return (
        <>
          <polygon points="38,62 100,100 162,62 162,72 100,110 38,72" fill={F} />
          <polygon points="38,76 100,114 162,76 162,86 100,124 38,86" fill={F2} />
          <polygon points="38,90 100,128 162,90 162,96 100,134 38,96" fill={F} opacity="0.8" />
        </>
      );
    case "faixa_peito":
      return (
        <>
          <rect x="0" y="86" width="200" height="11" fill={F} />
          <rect x="0" y="80" width="200" height="2" fill={F2} />
          <rect x="0" y="101" width="200" height="2" fill={F2} />
        </>
      );
    case "faixa":
      return (
        <>
          <polygon points="36,8 64,8 184,220 156,220" fill={F} />
          <polygon points="66,8 70,8 190,220 186,220" fill={F2} />
        </>
      );
    case "degrade":
      return <rect width="200" height="220" fill={`url(#dg${id})`} />;
    case "manchas":
      // Camuflado: manchas de borda irregular, em duas cores.
      return (
        <>
          {Array.from({ length: 18 }, (_, i) => {
            const cx = 10 + ruido(i * 3) * 180;
            const cy = 10 + ruido(i * 7 + 1) * 200;
            const R = 10 + ruido(i * 11 + 2) * 16;
            let d = "";
            for (let k = 0; k < 9; k++) {
              const t = (k / 9) * Math.PI * 2;
              const r = R * (0.55 + ruido(i * 31 + k) * 0.6);
              d += `${k ? "L" : "M"}${r1(cx + r * Math.cos(t) * 1.4)} ${r1(cy + r * Math.sin(t))} `;
            }
            return <path key={i} d={d + "Z"} fill={i % 3 ? F : F2} strokeLinejoin="round" stroke={i % 3 ? F : F2} strokeWidth="4" />;
          })}
        </>
      );
    case "cruz_nordica":
      return (
        <>
          <rect x="70" y="0" width="30" height="220" fill={F} />
          <rect x="0" y="92" width="200" height="30" fill={F} />
          <rect x="79" y="0" width="12" height="220" fill={F2} />
          <rect x="0" y="101" width="200" height="12" fill={F2} />
        </>
      );
    case "pontilhado":
      return (
        <g clipPath={tronco}>
          {Array.from({ length: 13 }, (_, l) =>
            Array.from({ length: 13 }, (_, c) => <circle key={`${l}-${c}`} cx={r1(54 + c * 7.6 + (l % 2) * 3.8)} cy={120 + l * 7} r={r1(0.6 + l * 0.22)} fill={F} />),
          )}
        </g>
      );
    case "metade":
      return <rect x="100" y="0" width="100" height="220" fill={F === base ? F2 : F} />;
    default:
      return null;
  }
}

export default function Camisa({ cor, cor2, estilo, opcoes, logo, sigla, costas, largura = 180, className }: Props) {
  const id = useId().replace(/:/g, "");
  const { modelo: e, op } = resolverCamisa(estilo, opcoes);
  const escura = textoSobre(cor) === "#FFFFFF";
  const contorno = escura ? "rgba(255,255,255,0.32)" : "rgba(0,0,0,0.26)";
  // Cor do desenho: tom sobre tom (um tom acima/abaixo da principal) ou a cor de contraste.
  const tonal = escura ? misturar(cor, "#FFFFFF", 0.14) : misturar(cor, "#000000", 0.12);
  const tonal2 = escura ? misturar(cor, "#FFFFFF", 0.24) : misturar(cor, "#000000", 0.2);
  const cor3 = op.cor3 || cor2;
  const F = op.tom === "tom" ? tonal : cor3;
  const F2 = op.tom === "tom" ? tonal2 : op.cor3 && op.cor3 !== cor2 ? cor2 : misturar(cor3, escura ? "#FFFFFF" : "#000000", 0.35);
  const corManga = op.mangas === "iguais" ? null : cor2;
  const punho = corManga ? cor : cor2;
  const friso2 = op.cor3 && op.cor3 !== cor2 ? op.cor3 : misturar(cor2, escura ? "#000000" : "#FFFFFF", 0.45);
  // De costas: número branco com contorno quando o desenho é forte; senão na cor que dá leitura.
  const forte = op.tom === "contraste" && !["lisa", "faixa_peito", "chevron"].includes(e);
  const textoCostas = forte ? "#FFFFFF" : textoSobre(cor);
  const bordaCostas = forte ? "#1B1430" : contorno;
  const gola = costas ? "redonda" : op.gola;

  return (
    <svg viewBox="0 0 200 220" width={largura} height={(largura * 220) / 200} className={className} role="img" aria-label={costas ? `Camisa de ${costas.nome}` : "Camisa da pelada"}>
      <defs>
        <clipPath id={`c${id}`}>
          <path d={costas ? CORPO_COSTAS : CORPO} />
        </clipPath>
        <clipPath id={`t${id}`}>
          <rect x="51" y="0" width="98" height="220" />
        </clipPath>
        <pattern id={`pj${id}`} width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M7 1 L13 7 L7 13 L1 7 Z" fill="none" stroke={F} strokeWidth="1.3" />
          <circle cx="7" cy="7" r="1.2" fill={F} />
        </pattern>
        <pattern id={`pe${id}`} width="24" height="20" patternUnits="userSpaceOnUse">
          <path d="M0 16 H4 V12 H8 V8 H12 V4 H16 V8 H20 V12 H24" fill="none" stroke={F} strokeWidth="1.8" />
          <path d="M0 20 H6 V16 H10 V12 H14 V16 H18 V20" fill="none" stroke={F2} strokeWidth="1.2" />
          <rect x="11" y="0" width="2" height="2" fill={F} />
        </pattern>
        <pattern id={`po${id}`} width="40" height="9" patternUnits="userSpaceOnUse">
          <path d="M0 4.5 Q10 0.5 20 4.5 T40 4.5" fill="none" stroke={F} strokeWidth="1.6" />
        </pattern>
        <pattern id={`pf${id}`} width="38" height="38" patternUnits="userSpaceOnUse">
          {[
            [4, 8, 25],
            [22, 4, 110],
            [10, 26, 200],
            [28, 24, 300],
          ].map(([x, y, r], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
              <path d="M0 0 C5 -6 14 -6 18 0 C14 6 5 6 0 0 Z" fill={i % 2 ? F2 : F} />
              <path d="M1 0 H16" stroke={i % 2 ? F : F2} strokeWidth="0.6" />
            </g>
          ))}
        </pattern>
        <linearGradient id={`dg${id}`} x1="0" x2="0.25" y1="0" y2="1">
          <stop offset="0" stopColor={F} stopOpacity="1" />
          <stop offset="0.55" stopColor={F} stopOpacity="0.25" />
          <stop offset="1" stopColor={F} stopOpacity="0" />
        </linearGradient>
        {/* Volume do tecido */}
        <linearGradient id={`g${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.26" />
          <stop offset="0.22" stopColor="#000" stopOpacity="0.03" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.62" stopColor="#fff" stopOpacity="0.03" />
          <stop offset="0.82" stopColor="#000" stopOpacity="0.05" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
        <linearGradient id={`v${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.14" />
        </linearGradient>
        <radialGradient id={`a${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.3" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g clipPath={`url(#c${id})`}>
        <rect width="200" height="220" fill={cor} />
        <Desenho e={e} F={F} F2={F2} base={cor} id={id} />
        {/* Mangas */}
        {corManga && op.mangas === "detalhe" && (
          <>
            <path d={MANGA_E} fill={corManga} />
            <path d={MANGA_D} fill={corManga} />
          </>
        )}
        {corManga && op.mangas === "raglan" && (
          <>
            <path d={RAGLAN_E} fill={corManga} />
            <path d={RAGLAN_D} fill={corManga} />
          </>
        )}
        {/* Punhos com friso */}
        <line x1="9" y1="53" x2="28" y2="89" stroke={punho} strokeWidth="11" />
        <line x1="191" y1="53" x2="172" y2="89" stroke={punho} strokeWidth="11" />
        <line x1="14.5" y1="50" x2="33.5" y2="86" stroke={friso2} strokeWidth="1.4" />
        <line x1="185.5" y1="50" x2="166.5" y2="86" stroke={friso2} strokeWidth="1.4" />
        {/* Friso no ombro */}
        {op.friso && (
          <>
            <path d="M75 17 C63 20 52 24 43 30 L14 57" fill="none" stroke={cor2} strokeWidth="2.4" />
            <path d="M76 21 C64 24 54 28 46 34 L17 61" fill="none" stroke={friso2} strokeWidth="1.6" />
            <path d="M125 17 C137 20 148 24 157 30 L186 57" fill="none" stroke={cor2} strokeWidth="2.4" />
            <path d="M124 21 C136 24 146 28 154 34 L183 61" fill="none" stroke={friso2} strokeWidth="1.6" />
          </>
        )}
        {/* Barra */}
        <path d="M49 206 Q100 216 151 206" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="3" />
        {/* Volume: sombras e dobras */}
        <rect width="200" height="220" fill={`url(#g${id})`} />
        <rect width="200" height="220" fill={`url(#v${id})`} />
        <ellipse cx="54" cy="86" rx="12" ry="22" fill={`url(#a${id})`} />
        <ellipse cx="146" cy="86" rx="12" ry="22" fill={`url(#a${id})`} />
        <path d="M68 112 C73 142 65 172 70 206" fill="none" stroke="#fff" strokeOpacity="0.07" strokeWidth="7" />
        <path d="M133 120 C128 150 136 180 131 206" fill="none" stroke="#000" strokeOpacity="0.07" strokeWidth="7" />
        <path d="M72 14 C66 30 58 52 53 78" fill="none" stroke="#000" strokeOpacity="0.14" strokeWidth="1" />
        <path d="M128 14 C134 30 142 52 147 78" fill="none" stroke="#000" strokeOpacity="0.14" strokeWidth="1" />
      </g>

      {/* Gola */}
      {gola === "redonda" && (
        <>
          {!costas && <path d="M71 12 C84 18 116 18 129 12 C123 25 113 33 100 34 C87 33 77 25 71 12 Z" fill="#000" fillOpacity="0.3" />}
          <path d={costas ? "M71 12 C84 19 116 19 129 12" : "M71 12 C77 25 87 33 100 34 C113 33 123 25 129 12"} fill="none" stroke={cor2} strokeWidth="5.5" strokeLinecap="round" />
          {!costas && <path d="M74 15 C80 27 89 34 100 35.5 C111 34 120 27 126 15" fill="none" stroke={friso2} strokeWidth="1.1" />}
        </>
      )}
      {(gola === "v" || gola === "retro") && (
        <>
          <path d="M73 12 L100 44 L127 12 C116 17 84 17 73 12 Z" fill={cor} />
          <path d="M73 12 L100 44 L127 12 C116 17 84 17 73 12 Z" fill="#000" fillOpacity="0.32" />
          <path d="M72 12 L100 45 L128 12" fill="none" stroke={cor2} strokeWidth={gola === "retro" ? 7 : 5.5} strokeLinejoin="round" strokeLinecap="round" />
          <path d={gola === "retro" ? "M76 14 L100 42 L124 14" : "M75 15.5 L100 46.5 L125 15.5"} fill="none" stroke={friso2} strokeWidth="1.2" strokeLinejoin="round" />
          {gola === "retro" && <path d="M92 36 L108 36 L100 46 Z" fill={cor2} />}
        </>
      )}
      {gola === "polo" && (
        <>
          <path d="M74 12 L100 30 L126 12 C116 16 84 16 74 12 Z" fill="#000" fillOpacity="0.3" />
          <path d="M71 11 L100 30 L90 50 L64 22 Z" fill={cor2} stroke={contorno} strokeWidth="0.8" />
          <path d="M129 11 L100 30 L110 50 L136 22 Z" fill={cor2} stroke={contorno} strokeWidth="0.8" />
          <path d="M67 21 L89 46" stroke={friso2} strokeWidth="1.1" />
          <path d="M133 21 L111 46" stroke={friso2} strokeWidth="1.1" />
          <rect x="96" y="30" width="8" height="34" rx="2" fill={cor2} />
          <circle cx="100" cy="42" r="1.8" fill={contorno} />
          <circle cx="100" cy="54" r="1.8" fill={contorno} />
        </>
      )}

      <path d={costas ? CORPO_COSTAS : CORPO} fill="none" stroke={contorno} strokeWidth="1.2" strokeLinejoin="round" />

      {costas ? (
        <>
          <text x="100" y="74" textAnchor="middle" fontFamily="var(--font-grotesk), sans-serif" fontWeight="700" fontSize={costas.nome.length > 9 ? 14 : 18} letterSpacing="1.5" fill={textoCostas} stroke={bordaCostas} strokeWidth={forte ? 2.4 : 0.6} paintOrder="stroke" strokeLinejoin="round">
            {costas.nome.toUpperCase().slice(0, 14)}
          </text>
          {costas.numero !== undefined && costas.numero !== null && costas.numero !== "" && (
            <text x="100" y="160" textAnchor="middle" fontFamily="var(--font-grotesk), sans-serif" fontWeight="700" fontSize="72" fill={textoCostas} stroke={bordaCostas} strokeWidth={forte ? 5 : 1.2} paintOrder="stroke" strokeLinejoin="round">
              {costas.numero}
            </text>
          )}
        </>
      ) : logo ? (
        <>
          <circle cx="127" cy="70" r="14" fill="#fff" fillOpacity="0.92" />
          <image href={logo} x="115" y="58" width="24" height="24" preserveAspectRatio="xMidYMid meet" />
        </>
      ) : (
        <>
          <path d="M115 58 H139 V72 Q139 82 127 86 Q115 82 115 72 Z" fill={cor2} stroke={contorno} strokeWidth="1" />
          <text x="127" y="74.5" textAnchor="middle" fontFamily="var(--font-grotesk), sans-serif" fontWeight="700" fontSize="9.5" fill={textoSobre(cor2)}>
            {(sigla ?? "MA").slice(0, 3).toUpperCase()}
          </text>
        </>
      )}
    </svg>
  );
}

export function siglaDe(nome: string): string {
  const p = nome.split(/\s+/).filter(Boolean);
  return (p.length > 1 ? p.map((w) => w[0]).join("") : nome.slice(0, 2)).slice(0, 3).toUpperCase();
}
