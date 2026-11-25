// Camisa da pelada desenhada em SVG: cor principal, cor do detalhe, modelo e a logo no peito.
// De costas mostra o nome e o número. Modelos genéricos (não copiam camisa de time nenhum).
import { useId } from "react";
import { textoSobre } from "@/lib/cores";

export type EstiloCamisa =
  | "lisa"
  | "listras"
  | "listras_finas"
  | "listras_horizontais"
  | "faixa"
  | "faixa_peito"
  | "faixa_baixa"
  | "metade"
  | "quartos"
  | "centro"
  | "cruz"
  | "gola"
  | "mangas"
  | "ombros"
  | "lateral"
  | "polo";

// Os 5 primeiros funcionam mesmo antes do SQL 0005; os outros precisam dele.
export const ESTILOS_CAMISA: { valor: EstiloCamisa; rotulo: string }[] = [
  { valor: "lisa", rotulo: "Lisa" },
  { valor: "listras", rotulo: "Listrada" },
  { valor: "faixa", rotulo: "Faixa" },
  { valor: "metade", rotulo: "Metade" },
  { valor: "gola", rotulo: "Gola e mangas" },
  { valor: "listras_finas", rotulo: "Listras finas" },
  { valor: "listras_horizontais", rotulo: "Listras deitadas" },
  { valor: "faixa_peito", rotulo: "Faixa no peito" },
  { valor: "faixa_baixa", rotulo: "Faixa embaixo" },
  { valor: "quartos", rotulo: "Quartos" },
  { valor: "centro", rotulo: "Faixa no meio" },
  { valor: "cruz", rotulo: "Cruz" },
  { valor: "mangas", rotulo: "Mangas" },
  { valor: "ombros", rotulo: "Ombros" },
  { valor: "lateral", rotulo: "Laterais" },
  { valor: "polo", rotulo: "Polo" },
];

const CORPO = "M75 12 L60 14 L18 42 L36 84 L55 72 L55 206 Q100 214 145 206 L145 72 L164 84 L182 42 L140 14 L125 12 Q100 34 75 12 Z";
const MANGA_E = "62,13 18,42 36,84 56,72 56,40";
const MANGA_D = "138,13 182,42 164,84 144,72 144,40";

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

function Desenho({ e, cor2 }: { e: EstiloCamisa; cor2: string }) {
  switch (e) {
    case "listras":
      return <>{[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={30 + i * 26} y="0" width="13" height="220" fill={cor2} />)}</>;
    case "listras_finas":
      return <>{Array.from({ length: 15 }, (_, i) => <rect key={i} x={14 + i * 12} y="0" width="3.5" height="220" fill={cor2} />)}</>;
    case "listras_horizontais":
      return <>{[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x="0" y={30 + i * 28} width="200" height="14" fill={cor2} />)}</>;
    case "faixa":
      return <polygon points="40,10 75,10 170,220 135,220" fill={cor2} />;
    case "faixa_peito":
      return <rect x="0" y="82" width="200" height="30" fill={cor2} />;
    case "faixa_baixa":
      return (
        <>
          <polygon points="0,150 200,104 200,128 0,174" fill={cor2} />
          <polygon points="0,180 200,134 200,140 0,186" fill={cor2} opacity="0.55" />
        </>
      );
    case "metade":
      return <rect x="100" y="0" width="100" height="220" fill={cor2} />;
    case "quartos":
      return (
        <>
          <rect x="100" y="0" width="100" height="110" fill={cor2} />
          <rect x="0" y="110" width="100" height="110" fill={cor2} />
        </>
      );
    case "centro":
      return <rect x="78" y="0" width="44" height="220" fill={cor2} />;
    case "cruz":
      return (
        <>
          <rect x="86" y="0" width="28" height="220" fill={cor2} />
          <rect x="0" y="88" width="200" height="26" fill={cor2} />
        </>
      );
    case "gola":
      return (
        <>
          <polygon points="60,14 18,42 30,70 62,38" fill={cor2} />
          <polygon points="140,14 182,42 170,70 138,38" fill={cor2} />
          <rect x="0" y="196" width="200" height="14" fill={cor2} />
        </>
      );
    case "mangas":
      return (
        <>
          <polygon points={MANGA_E} fill={cor2} />
          <polygon points={MANGA_D} fill={cor2} />
        </>
      );
    case "ombros":
      return <path d="M0 0 H200 V46 Q170 40 150 50 Q100 66 50 50 Q30 40 0 46 Z" fill={cor2} />;
    case "lateral":
      return (
        <>
          <rect x="55" y="60" width="14" height="160" fill={cor2} />
          <rect x="131" y="60" width="14" height="160" fill={cor2} />
        </>
      );
    default:
      return null;
  }
}

export default function Camisa({ cor, cor2, estilo, logo, sigla, costas, largura = 180, className }: Props) {
  const id = useId().replace(/:/g, "");
  const e = (estilo ?? "lisa") as EstiloCamisa;
  const contorno = textoSobre(cor) === "#FFFFFF" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.5)";
  const punho = e === "listras" || e === "mangas" || e === "listras_horizontais" ? cor : cor2;
  // Em camisa com desenho atrás (listras, quartos…), nome e número vão em branco com contorno escuro: dá pra ler em qualquer cor.
  const estampada = !["lisa", "gola", "mangas", "ombros", "polo", "lateral"].includes(e);
  const textoCostas = estampada ? "#FFFFFF" : textoSobre(cor);
  const bordaCostas = estampada ? "#1B1430" : contorno;

  return (
    <svg viewBox="0 0 200 220" width={largura} height={(largura * 220) / 200} className={className} role="img" aria-label={costas ? `Camisa de ${costas.nome}` : "Camisa da pelada"}>
      <defs>
        <clipPath id={`c${id}`}>
          <path d={CORPO} />
        </clipPath>
        <linearGradient id={`g${id}`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.18" />
          <stop offset="0.3" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#000" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#c${id})`}>
        <rect width="200" height="220" fill={cor} />
        <Desenho e={e} cor2={cor2} />
        <rect width="200" height="220" fill={`url(#g${id})`} />
      </g>
      {e === "polo" ? (
        <>
          <path d="M75 12 L100 30 L90 46 L68 22 Z" fill={cor2} stroke={contorno} strokeWidth="1" />
          <path d="M125 12 L100 30 L110 46 L132 22 Z" fill={cor2} stroke={contorno} strokeWidth="1" />
          <line x1="100" y1="30" x2="100" y2="62" stroke={cor2} strokeWidth="5" />
          <circle cx="100" cy="42" r="1.8" fill={contorno} />
          <circle cx="100" cy="54" r="1.8" fill={contorno} />
        </>
      ) : (
        <path d="M75 12 Q100 34 125 12" fill="none" stroke={cor2} strokeWidth="6" strokeLinecap="round" />
      )}
      <line x1="21" y1="48" x2="34" y2="79" stroke={punho} strokeWidth="6" strokeLinecap="round" />
      <line x1="179" y1="48" x2="166" y2="79" stroke={punho} strokeWidth="6" strokeLinecap="round" />
      <path d={CORPO} fill="none" stroke={contorno} strokeWidth="1.5" />

      {costas ? (
        <>
          <text x="100" y="72" textAnchor="middle" fontFamily="var(--font-grotesk), sans-serif" fontWeight="700" fontSize={costas.nome.length > 9 ? 15 : 19} letterSpacing="1.5" fill={textoCostas} stroke={bordaCostas} strokeWidth={estampada ? 2.4 : 0.6} paintOrder="stroke" strokeLinejoin="round">
            {costas.nome.toUpperCase().slice(0, 14)}
          </text>
          {costas.numero !== undefined && costas.numero !== null && costas.numero !== "" && (
            <text x="100" y="158" textAnchor="middle" fontFamily="var(--font-grotesk), sans-serif" fontWeight="700" fontSize="74" fill={textoCostas} stroke={bordaCostas} strokeWidth={estampada ? 5 : 1.2} paintOrder="stroke" strokeLinejoin="round">
              {costas.numero}
            </text>
          )}
        </>
      ) : logo ? (
        <>
          <circle cx="124" cy="66" r="15" fill="#fff" fillOpacity="0.9" />
          <image href={logo} x="111" y="53" width="26" height="26" preserveAspectRatio="xMidYMid meet" />
        </>
      ) : (
        <>
          <circle cx="124" cy="66" r="14" fill={cor2} stroke={contorno} strokeWidth="1" />
          <text x="124" y="70.5" textAnchor="middle" fontFamily="var(--font-grotesk), sans-serif" fontWeight="700" fontSize="11" fill={textoSobre(cor2)}>
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
