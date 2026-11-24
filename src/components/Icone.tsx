// Ícones simples em SVG (traço), no mesmo estilo do protótipo.
const CAMINHOS = {
  inicio: "M3 10.5 12 3l9 7.5V21H3z",
  jogadores:
    "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.25 3.25 0 0 1 0 6.2",
  sorteio: "M3 6h4l10 12h4M3 18h4l3-3.6M14 9.6 17 6h4M18 3l3 3-3 3M18 15l3 3-3 3",
  partida: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16M12 9v4l2.5 2M9.5 2h5",
  mais: "M5 12h.01M12 12h.01M19 12h.01",
  voltar: "M15 18 9 12l6-6",
  fechar: "M18 6 6 18M6 6l12 12",
  check: "M5 12.5 10 17 19 7",
  somar: "M12 5v14M5 12h14",
  menos: "M5 12h14",
  busca: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-3.5-3.5",
  lapis: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  baixar: "M12 4v11M7 10l5 5 5-5M5 20h14",
  copiar: "M9 9h10v10H9zM5 15V5h10",
  desfazer: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  play: "M8 5v14l11-7z",
  pausa: "M8 5v14M16 5v14",
  trofeu: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3",
  estrela: "M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z",
  escudo: "M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  sair: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  cartao: "M6 3h12v18H6zM9 15h6M12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5",
  imagem: "M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M15 9h.01",
  sino: "M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16zM10 21h4",
  lista: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  dinheiro: "M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  tela: "M3 4h18v12H3zM8 20h8M12 16v4",
  chave: "M15 9a3 3 0 1 0 0-.01M13 11l-9 9M7 17l2 2M9 15l2 2",
  zap: "M4 20l1.3-4A8 8 0 1 1 8 18.7z",
  grafico: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  usuario: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0",
} as const;

export type NomeIcone = keyof typeof CAMINHOS;

export default function Icone({ nome, tamanho = 22, className = "" }: { nome: NomeIcone; tamanho?: number; className?: string }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}
