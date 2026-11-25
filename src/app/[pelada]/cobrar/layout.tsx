// Só abre se o plano da pelada tiver "Mensalidade (Pix)".
import TravaRecurso from "@/components/TravaRecurso";

export default function LayoutCobrar({ children }: LayoutProps<"/[pelada]/cobrar">) {
  return (
    <TravaRecurso recurso="pix" titulo="Mensalidade (Pix)">
      {children}
    </TravaRecurso>
  );
}
