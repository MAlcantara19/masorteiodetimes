// Camisa da pelada desenhada em SVG: cor principal, cor do detalhe, estilo e a logo no peito.
// De costas mostra o nome e o número. Desenho próprio (não copia camisa de time nenhum).
import { useId } from "react";
import { textoSobre } from "@/lib/cores";

export type EstiloCamisa = "lisa" | "listras" | "faixa" | "metade" | "gola";

export const ESTILOS_CAMISA: { valor: EstiloCamisa; rotulo: string }[] = [
  { valor: "lisa", rotulo: "Lisa" },
  { valor: "listras", rotulo: "Listrada" },
  { valor: "faixa", rotulo: "Faixa" },
  { valor: "metade", rotulo: "Metade" },
  { valor: "gola", rotulo: "Gola e mangas" },
];

const CORPO = "M75 12 L60 14 L18 42 L36 84 L55 72 L55 206 Q100 214 145 206 L145 72 L164 84 L182 42 L140 14 L125 12 Q100 34 75 12 Z";

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

export default function Camisa({ cor, cor2, estilo, logo, sigla, costas, largura = 180, className }: Props) {
  const id = useId().replace(/:/g, "");
  const e = (estilo ?? "lisa") as EstiloCamisa;
  const texto = textoSobre(cor);
  const contorno = texto === "#FFFFFF" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.5)";
  const punho = e === "listras" ? cor : cor2;

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
        {e === "listras" && [0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x={30 + i * 26} y="0" width="13" height="220" fill={cor2} />)}
        {e === "faixa" && <polygon points="40,10 75,10 170,220 135,220" fill={cor2} />}
        {e === "metade" && <rect x="100" y="0" width="100" height="220" fill={cor2} />}
        {e === "gola" && (
          <>
            <polygon points="60,14 18,42 30,70 62,38" fill={cor2} />
            <polygon points="140,14 182,42 170,70 138,38" fill={cor2} />
            <rect x="0" y="196" width="200" height="14" fill={cor2} />
          </>
        )}
        <rect width="200" height="220" fill={`url(#g${id})`} />
      </g>
      <path d="M75 12 Q100 34 125 12" fill="none" stroke={cor2} strokeWidth="6" strokeLinecap="round" />
      <line x1="21" y1="48" x2="34" y2="79" stroke={punho} strokeWidth="6" strokeLinecap="round" />
      <line x1="179" y1="48" x2="166" y2="79" stroke={punho} strokeWidth="6" strokeLinecap="round" />
      <path d={CORPO} fill="none" stroke={contorno} strokeWidth="1.5" />

      {costas ? (
        <>
          <text x="100" y="72" textAnchor="middle" fontFamily="var(--font-grotesk), sans-serif" fontWeight="700" fontSize={costas.nome.length > 9 ? 15 : 19} letterSpacing="1.5" fill={texto} stroke={contorno} strokeWidth="0.6" paintOrder="stroke">
            {costas.nome.toUpperCase().slice(0, 14)}
          </text>
          {costas.numero !== undefined && costas.numero !== null && costas.numero !== "" && (
            <text x="100" y="158" textAnchor="middle" fontFamily="var(--font-grotesk), sans-serif" fontWeight="700" fontSize="74" fill={texto} stroke={contorno} strokeWidth="1.2" paintOrder="stroke">
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
