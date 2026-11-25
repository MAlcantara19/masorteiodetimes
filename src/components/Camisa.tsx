// Camisa da pelada desenhada em SVG: cor principal, cor do detalhe, modelo e a logo no peito.
// De costas mostra o nome e o número. Corte moderno (manga raglan, gola, punho, sombra e dobras).
// Modelos genéricos, sem marca de fabricante nenhum.
import { useId } from "react";
import { textoSobre } from "@/lib/cores";

export type EstiloCamisa =
  | "lisa"
  | "listras"
  | "listras_finas"
  | "listras_horizontais"
  | "listras_degrade"
  | "faixa"
  | "faixa_peito"
  | "centro"
  | "metade"
  | "gradiente"
  | "chevron"
  | "raio"
  | "ombros"
  | "lateral"
  | "mangas"
  | "geometrico"
  | "diagonal"
  | "xadrez"
  | "pontilhado"
  | "polo"
  // Antigos (continuam desenhando pra quem já escolheu)
  | "faixa_baixa"
  | "quartos"
  | "cruz"
  | "gola";

// Os que precisam do SQL 0009 pra salvar estão marcados com `novo`.
export const ESTILOS_CAMISA: { valor: EstiloCamisa; rotulo: string; novo?: boolean }[] = [
  { valor: "lisa", rotulo: "Lisa" },
  { valor: "listras", rotulo: "Listrada" },
  { valor: "listras_finas", rotulo: "Risca fina" },
  { valor: "listras_horizontais", rotulo: "Listras deitadas" },
  { valor: "listras_degrade", rotulo: "Listras degradê", novo: true },
  { valor: "faixa", rotulo: "Faixa" },
  { valor: "faixa_peito", rotulo: "Faixa no peito" },
  { valor: "centro", rotulo: "Faixa no meio" },
  { valor: "metade", rotulo: "Metade" },
  { valor: "gradiente", rotulo: "Degradê", novo: true },
  { valor: "chevron", rotulo: "V no peito", novo: true },
  { valor: "raio", rotulo: "Raio", novo: true },
  { valor: "ombros", rotulo: "Ombros" },
  { valor: "lateral", rotulo: "Laterais" },
  { valor: "mangas", rotulo: "Mangas" },
  { valor: "geometrico", rotulo: "Geométrica", novo: true },
  { valor: "diagonal", rotulo: "Riscas diagonais", novo: true },
  { valor: "xadrez", rotulo: "Quadriculada", novo: true },
  { valor: "pontilhado", rotulo: "Pontilhada", novo: true },
  { valor: "polo", rotulo: "Polo" },
];

// Silhueta: ombro caído, manga curta, cintura levemente acinturada e barra curva.
const CORPO =
  "M71 12 C60 14 48 18 39 24 L9 53 L28 89 L52 78 C53 112 52 168 49 206 Q100 216 151 206 C148 168 147 112 148 78 L172 89 L191 53 L161 24 C152 18 140 14 129 12 C123 25 113 33 100 34 C87 33 77 25 71 12 Z";
// De costas a gola é rasa (a frente tem o recorte do pescoço).
const CORPO_COSTAS = CORPO.replace("C123 25 113 33 100 34 C87 33 77 25 71 12", "C118 18 82 18 71 12");
const MANGA_E = "M44 21 L9 53 L28 89 L53 78 C54 60 56 44 61 31 Z";
const MANGA_D = "M156 21 L191 53 L172 89 L147 78 C146 60 144 44 139 31 Z";

type Props = {
  cor: string;
  cor2: string;
  estilo?: string | null;
  logo?: string | null;
  sigla?: string; // se não tiver logo
  costas?: { nome: string; numero?: string | number | null } | null;
  largura?: number;
  className?: string;
};

// Número "aleatório" fixo, só com inteiros (sai igual no servidor e no celular).
const ruido = (i: number) => ((i * 9301 + 49297) % 233280) / 233280;

function Desenho({ e, cor2, id }: { e: EstiloCamisa; cor2: string; id: string }) {
  const tronco = `url(#t${id})`;
  switch (e) {
    case "listras":
      return (
        <g clipPath={tronco}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={57 + i * 16} y="0" width="8" height="220" fill={cor2} />
          ))}
        </g>
      );
    case "listras_finas":
      return (
        <g clipPath={tronco}>
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x={55 + i * 8} y="0" width="1.6" height="220" fill={cor2} opacity="0.85" />
          ))}
        </g>
      );
    case "listras_horizontais":
      return (
        <>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x="0" y={44 + i * 30} width="200" height="14" fill={cor2} />
          ))}
        </>
      );
    case "listras_degrade":
      return (
        <g clipPath={tronco} mask={`url(#m${id})`}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={57 + i * 16} y="0" width="8" height="220" fill={cor2} />
          ))}
        </g>
      );
    case "faixa":
      return (
        <>
          <polygon points="34,8 66,8 186,220 154,220" fill={cor2} />
          <polygon points="28,8 32,8 152,220 148,220" fill={cor2} opacity="0.55" />
          <polygon points="68,8 72,8 192,220 188,220" fill={cor2} opacity="0.55" />
        </>
      );
    case "faixa_peito":
      return (
        <>
          <rect x="0" y="80" width="200" height="22" fill={cor2} />
          <rect x="0" y="74" width="200" height="2.5" fill={cor2} />
          <rect x="0" y="105.5" width="200" height="2.5" fill={cor2} />
        </>
      );
    case "centro":
      return (
        <>
          <rect x="84" y="0" width="32" height="220" fill={cor2} />
          <rect x="78" y="0" width="2" height="220" fill={cor2} opacity="0.7" />
          <rect x="120" y="0" width="2" height="220" fill={cor2} opacity="0.7" />
        </>
      );
    case "metade":
      return <rect x="100" y="0" width="100" height="220" fill={cor2} />;
    case "gradiente":
      return <rect width="200" height="220" fill={`url(#d${id})`} />;
    case "chevron":
      return (
        <>
          <polygon points="40,58 100,104 160,58 160,76 100,122 40,76" fill={cor2} />
          <polygon points="40,84 100,130 160,84 160,88 100,134 40,88" fill={cor2} opacity="0.6" />
        </>
      );
    case "raio":
      return (
        <>
          <polygon points="0,96 46,78 84,104 124,74 160,98 200,80 200,98 160,116 124,92 84,122 46,96 0,114" fill={cor2} />
          <polygon points="0,120 46,102 84,128 124,98 160,122 200,104 200,108 160,126 124,102 84,132 46,106 0,124" fill={cor2} opacity="0.5" />
        </>
      );
    case "ombros":
      return (
        <>
          <path d="M0 0 H200 V50 Q150 66 100 66 Q50 66 0 50 Z" fill={cor2} />
          <path d={MANGA_E} fill={cor2} />
          <path d={MANGA_D} fill={cor2} />
        </>
      );
    case "lateral":
      return (
        <>
          <path d={MANGA_E} fill={cor2} />
          <path d={MANGA_D} fill={cor2} />
          <path d="M52 76 L64 80 C64 120 63 170 62 214 L48 214 Z" fill={cor2} />
          <path d="M148 76 L136 80 C136 120 137 170 138 214 L152 214 Z" fill={cor2} />
        </>
      );
    case "mangas":
      return (
        <>
          <path d={MANGA_E} fill={cor2} />
          <path d={MANGA_D} fill={cor2} />
        </>
      );
    case "geometrico":
      return (
        <g clipPath={tronco}>
          {Array.from({ length: 11 }, (_, l) =>
            Array.from({ length: 6 }, (_, c) => {
              const x = 52 + c * 17 + (l % 2) * 8.5;
              const y = 34 + l * 17;
              const k = l * 7 + c;
              return <polygon key={k} points={`${x},${y} ${x + 17},${y} ${x + 8.5},${y + 17}`} fill={cor2} opacity={Math.round((0.12 + ruido(k) * 0.55) * 100) / 100} />;
            }),
          )}
        </g>
      );
    case "diagonal":
      return (
        <g clipPath={tronco}>
          {Array.from({ length: 22 }, (_, i) => (
            <line key={i} x1={i * 12 - 20} y1="0" x2={i * 12 - 140} y2="220" stroke={cor2} strokeWidth="2.4" opacity="0.9" />
          ))}
        </g>
      );
    case "xadrez":
      return (
        <g clipPath={tronco}>
          {Array.from({ length: 12 }, (_, l) =>
            Array.from({ length: 7 }, (_, c) => ((l + c) % 2 ? <rect key={`${l}-${c}`} x={52 + c * 14} y={30 + l * 16} width="14" height="16" fill={cor2} /> : null)),
          )}
        </g>
      );
    case "pontilhado":
      return (
        <g clipPath={tronco}>
          {Array.from({ length: 13 }, (_, l) =>
            Array.from({ length: 13 }, (_, c) => <circle key={`${l}-${c}`} cx={54 + c * 7.6 + (l % 2) * 3.8} cy={120 + l * 7} r={0.6 + l * 0.22} fill={cor2} />),
          )}
        </g>
      );
    // ---- antigos ----
    case "faixa_baixa":
      return (
        <>
          <polygon points="0,150 200,104 200,128 0,174" fill={cor2} />
          <polygon points="0,180 200,134 200,140 0,186" fill={cor2} opacity="0.55" />
        </>
      );
    case "quartos":
      return (
        <>
          <rect x="100" y="0" width="100" height="110" fill={cor2} />
          <rect x="0" y="110" width="100" height="110" fill={cor2} />
        </>
      );
    case "cruz":
      return (
        <>
          <rect x="88" y="0" width="24" height="220" fill={cor2} />
          <rect x="0" y="88" width="200" height="22" fill={cor2} />
        </>
      );
    case "gola":
      return <rect x="0" y="198" width="200" height="12" fill={cor2} />;
    default:
      return null;
  }
}

// Modelos com gola em V (os mais "modernos"); polo tem gola de botão; o resto, gola redonda.
const GOLA_V: EstiloCamisa[] = ["gradiente", "chevron", "geometrico", "diagonal", "listras_degrade", "lateral", "faixa", "raio", "pontilhado"];
// Modelos em que atrás fica liso o suficiente pro número normal; nos outros, número branco com contorno.
const COSTAS_LISAS: EstiloCamisa[] = ["lisa", "polo", "mangas", "ombros", "lateral", "gola"];
// Manga já pintada com a cor do detalhe: o punho vai na cor principal.
const MANGA_PINTADA: EstiloCamisa[] = ["mangas", "ombros", "lateral"];

export default function Camisa({ cor, cor2, estilo, logo, sigla, costas, largura = 180, className }: Props) {
  const id = useId().replace(/:/g, "");
  const e = (estilo ?? "lisa") as EstiloCamisa;
  const claro = textoSobre(cor) !== "#FFFFFF";
  const contorno = claro ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.35)";
  const punho = MANGA_PINTADA.includes(e) ? cor : cor2;
  const gola = e === "polo" ? "polo" : GOLA_V.includes(e) && !costas ? "v" : "redonda";
  const estampada = !COSTAS_LISAS.includes(e);
  const textoCostas = estampada ? "#FFFFFF" : textoSobre(cor);
  const bordaCostas = estampada ? "#1B1430" : contorno;

  return (
    <svg viewBox="0 0 200 220" width={largura} height={(largura * 220) / 200} className={className} role="img" aria-label={costas ? `Camisa de ${costas.nome}` : "Camisa da pelada"}>
      <defs>
        <clipPath id={`c${id}`}>
          <path d={costas ? CORPO_COSTAS : CORPO} />
        </clipPath>
        <clipPath id={`t${id}`}>
          <rect x="51" y="0" width="98" height="220" />
        </clipPath>
        {/* Sombra lateral (volume do tecido) */}
        <linearGradient id={`g${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.28" />
          <stop offset="0.22" stopColor="#000" stopOpacity="0.04" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.62" stopColor="#fff" stopOpacity="0.03" />
          <stop offset="0.82" stopColor="#000" stopOpacity="0.06" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id={`v${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id={`d${id}`} x1="0" x2="0.35" y1="0.15" y2="1">
          <stop offset="0" stopColor={cor2} stopOpacity="0" />
          <stop offset="1" stopColor={cor2} stopOpacity="1" />
        </linearGradient>
        <linearGradient id={`f${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0.25" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`m${id}`}>
          <rect width="200" height="220" fill={`url(#f${id})`} />
        </mask>
        <radialGradient id={`a${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.3" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g clipPath={`url(#c${id})`}>
        <rect width="200" height="220" fill={cor} />
        <Desenho e={e} cor2={cor2} id={id} />
        {/* Punhos */}
        <line x1="9" y1="53" x2="28" y2="89" stroke={punho} strokeWidth="11" />
        <line x1="191" y1="53" x2="172" y2="89" stroke={punho} strokeWidth="11" />
        {/* Barra */}
        {e !== "gola" && <path d="M49 206 Q100 216 151 206" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="3" />}
        {/* Volume: sombra nas laterais, embaixo do braço e dobras */}
        <rect width="200" height="220" fill={`url(#g${id})`} />
        <rect width="200" height="220" fill={`url(#v${id})`} />
        <ellipse cx="54" cy="86" rx="12" ry="22" fill={`url(#a${id})`} />
        <ellipse cx="146" cy="86" rx="12" ry="22" fill={`url(#a${id})`} />
        <path d="M68 112 C73 142 65 172 70 206" fill="none" stroke="#fff" strokeOpacity="0.07" strokeWidth="7" />
        <path d="M133 120 C128 150 136 180 131 206" fill="none" stroke="#000" strokeOpacity="0.07" strokeWidth="7" />
        {/* Costura da manga raglan */}
        <path d="M72 14 C66 30 58 52 53 78" fill="none" stroke="#000" strokeOpacity="0.14" strokeWidth="1" />
        <path d="M128 14 C134 30 142 52 147 78" fill="none" stroke="#000" strokeOpacity="0.14" strokeWidth="1" />
      </g>

      {/* Gola */}
      {gola === "redonda" && (
        <>
          {!costas && <path d="M71 12 C84 18 116 18 129 12 C123 25 113 33 100 34 C87 33 77 25 71 12 Z" fill="#000" fillOpacity="0.3" />}
          <path d={costas ? "M71 12 C84 19 116 19 129 12" : "M71 12 C77 25 87 33 100 34 C113 33 123 25 129 12"} fill="none" stroke={cor2} strokeWidth="5.5" strokeLinecap="round" />
        </>
      )}
      {gola === "v" && (
        <>
          <path d="M73 12 L100 44 L127 12 C116 17 84 17 73 12 Z" fill={cor} />
          <path d="M73 12 L100 44 L127 12 C116 17 84 17 73 12 Z" fill="#000" fillOpacity="0.32" />
          <path d="M72 12 L100 45 L128 12" fill="none" stroke={cor2} strokeWidth="5.5" strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
      {gola === "polo" && (
        <>
          <path d="M74 12 L100 30 L126 12 C116 16 84 16 74 12 Z" fill="#000" fillOpacity="0.3" />
          <path d="M71 11 L100 30 L90 50 L64 22 Z" fill={cor2} stroke={contorno} strokeWidth="0.8" />
          <path d="M129 11 L100 30 L110 50 L136 22 Z" fill={cor2} stroke={contorno} strokeWidth="0.8" />
          <rect x="96" y="30" width="8" height="34" rx="2" fill={cor2} />
          <circle cx="100" cy="42" r="1.8" fill={contorno} />
          <circle cx="100" cy="54" r="1.8" fill={contorno} />
        </>
      )}

      <path d={costas ? CORPO_COSTAS : CORPO} fill="none" stroke={contorno} strokeWidth="1.2" strokeLinejoin="round" />

      {costas ? (
        <>
          <text x="100" y="74" textAnchor="middle" fontFamily="var(--font-grotesk), sans-serif" fontWeight="700" fontSize={costas.nome.length > 9 ? 14 : 18} letterSpacing="1.5" fill={textoCostas} stroke={bordaCostas} strokeWidth={estampada ? 2.4 : 0.6} paintOrder="stroke" strokeLinejoin="round">
            {costas.nome.toUpperCase().slice(0, 14)}
          </text>
          {costas.numero !== undefined && costas.numero !== null && costas.numero !== "" && (
            <text x="100" y="160" textAnchor="middle" fontFamily="var(--font-grotesk), sans-serif" fontWeight="700" fontSize="72" fill={textoCostas} stroke={bordaCostas} strokeWidth={estampada ? 5 : 1.2} paintOrder="stroke" strokeLinejoin="round">
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
