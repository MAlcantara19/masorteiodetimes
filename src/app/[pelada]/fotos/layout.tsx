// Só abre se o plano da pelada tiver "Fotos do dia".
import TravaRecurso from "@/components/TravaRecurso";

export default function LayoutFotos({ children }: LayoutProps<"/[pelada]/fotos">) {
  return (
    <TravaRecurso recurso="fotos" titulo="Fotos do dia">
      {children}
    </TravaRecurso>
  );
}
