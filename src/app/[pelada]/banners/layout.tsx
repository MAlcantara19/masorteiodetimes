// Só abre se o plano da pelada tiver "Banners".
import TravaRecurso from "@/components/TravaRecurso";

export default function LayoutBanners({ children }: LayoutProps<"/[pelada]/banners">) {
  return (
    <TravaRecurso recurso="banners" titulo="Banners">
      {children}
    </TravaRecurso>
  );
}
