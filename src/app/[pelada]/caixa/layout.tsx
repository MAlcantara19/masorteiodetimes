// Só abre se o plano da pelada tiver o caixa.
import TravaRecurso from "@/components/TravaRecurso";

export default function LayoutCaixa({ children }: LayoutProps<"/[pelada]/caixa">) {
  return (
    <TravaRecurso recurso="caixa" titulo="Caixa da pelada">
      {children}
    </TravaRecurso>
  );
}
