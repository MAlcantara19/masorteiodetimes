// Cabeçalho das telas internas: voltar, título e um espaço pra botão à direita.
import Link from "next/link";
import type { ReactNode } from "react";
import Icone from "./Icone";

type Props = { titulo: string; sub?: string; voltar?: string; direita?: ReactNode };

export default function Topo({ titulo, sub, voltar, direita }: Props) {
  return (
    <header className="flex items-center gap-3 pb-2">
      {voltar && (
        <Link href={voltar} aria-label="Voltar" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-tinta">
          <Icone nome="voltar" />
        </Link>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate font-display text-2xl font-bold tracking-tight">{titulo}</h1>
        {sub && <span className="truncate text-sm text-apagado">{sub}</span>}
      </div>
      {direita}
    </header>
  );
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-apagado" role="status">
      {texto}
    </div>
  );
}
