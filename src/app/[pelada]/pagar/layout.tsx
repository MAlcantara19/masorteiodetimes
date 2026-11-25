// Só abre se o plano da pelada tiver "Mensalidade (Pix)".
import TravaRecurso from "@/components/TravaRecurso";

export default function LayoutPagar({ children }: LayoutProps<"/[pelada]/pagar">) {
  return (
    <TravaRecurso recurso="pix" titulo="Mensalidade (Pix)">
      {children}
    </TravaRecurso>
  );
}
