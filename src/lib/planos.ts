// Planos da pelada e o que cada um libera. O master vê tudo sempre.
// Cada pelada pode ter exceções em `recursos` (ex.: { "confrontos_admin": true }), que o master liga no painel.

export type Plano = "gratis" | "completo";

export type Recurso =
  | "pix"
  | "retrospectiva"
  | "banners"
  | "fotos"
  | "album"
  | "cores"
  | "confrontos_admin"
  | "duplas_admin";

export const RECURSOS: { id: Recurso; titulo: string; sub: string }[] = [
  { id: "pix", titulo: "Mensalidade com Pix", sub: "QR Code com o valor e “já paguei”" },
  { id: "retrospectiva", titulo: "Retrospectiva do ano", sub: "o ano de cada um, pra postar" },
  { id: "banners", titulo: "Banners", sub: "story e quadrado do dia" },
  { id: "fotos", titulo: "Fotos do dia", sub: "a galera manda as fotos" },
  { id: "album", titulo: "Álbum de cartas", sub: "as cartas e a seleção" },
  { id: "cores", titulo: "Cores e camisa da pelada", sub: "o app com a cara da pelada" },
  { id: "confrontos_admin", titulo: "Confrontos pro admin", sub: "duplas que vencem, rivalidades" },
  { id: "duplas_admin", titulo: "Duplas que caem juntas pro admin", sub: "pra conferir o sorteio" },
];

export const PLANOS: Record<Plano, { nome: string; preco: string; recursos: Recurso[]; resumo: string[] }> = {
  gratis: {
    nome: "Grátis",
    preco: "R$ 0",
    recursos: [],
    resumo: ["1 pelada", "Lista do Zap e sorteio equilibrado", "Placar ao vivo e cronômetro", "Campeonato, votação e card básico"],
  },
  completo: {
    nome: "Completo",
    preco: "R$ 29,90/mês",
    recursos: ["pix", "retrospectiva", "banners", "fotos", "album", "cores"],
    resumo: ["Tudo do grátis", "Pix da mensalidade", "Cores, logo e camisa", "Banners, fotos, álbum e retrospectiva", "Cartas especiais"],
  },
};

type ComPlano = { plano?: string | null; recursos?: Record<string, boolean> | null; plano_ate?: string | null };

export function planoDe(p: ComPlano | null | undefined): Plano {
  if (!p) return "completo";
  // Sem a coluna (SQL 0004 não rodou): tudo liberado, como era antes.
  if (p.plano === undefined) return "completo";
  if (p.plano === "completo" && p.plano_ate && p.plano_ate < new Date().toISOString().slice(0, 10)) return "gratis";
  return p.plano === "gratis" ? "gratis" : "completo";
}

// A pelada tem esse recurso? (master sempre tem)
export function temRecurso(p: ComPlano | null | undefined, r: Recurso, ehMaster = false): boolean {
  if (ehMaster) return true;
  const exc = p?.recursos?.[r];
  if (typeof exc === "boolean") return exc;
  return PLANOS[planoDe(p)].recursos.includes(r);
}
