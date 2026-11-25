// Só abre se o plano da pelada tiver "Retrospectiva".
import TravaRecurso from "@/components/TravaRecurso";

export default function LayoutRetrospectiva({ children }: LayoutProps<"/[pelada]/retrospectiva">) {
  return (
    <TravaRecurso recurso="retrospectiva" titulo="Retrospectiva">
      {children}
    </TravaRecurso>
  );
}
