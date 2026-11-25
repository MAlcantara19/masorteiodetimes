// Só abre se o plano da pelada tiver "Álbum".
import TravaRecurso from "@/components/TravaRecurso";

export default function LayoutAlbum({ children }: LayoutProps<"/[pelada]/album">) {
  return (
    <TravaRecurso recurso="album" titulo="Álbum">
      {children}
    </TravaRecurso>
  );
}
