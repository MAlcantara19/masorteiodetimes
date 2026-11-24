// Arte da marca pra baixar e divulgar (post, story, logo e capa de link).
import Link from "next/link";

const ARTES = [
  { arquivo: "post.png", titulo: "Post quadrado", sub: "1080×1080 · Instagram e grupo do Zap" },
  { arquivo: "story.png", titulo: "Story", sub: "1080×1920 · status do Zap e story" },
  { arquivo: "logo.png", titulo: "Logo", sub: "1024×1024 · foto de perfil do grupo" },
  { arquivo: "capa.png", titulo: "Capa de link", sub: "1200×630 · aparece quando mandam o link do app" },
];

export default function MarcaPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col">
        <Link href="/mais" className="text-sm font-semibold text-roxo">
          ← Mais
        </Link>
        <h1 className="font-display text-2xl font-bold">Arte da marca</h1>
        <span className="text-sm text-apagado">Toque pra abrir e segure a imagem pra salvar (ou use Baixar).</span>
      </header>
      {ARTES.map((a) => (
        <section key={a.arquivo} className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/marca/${a.arquivo}`} alt={a.titulo} className="max-h-80 w-full rounded-xl object-contain" />
          <div className="flex items-center justify-between gap-2">
            <span className="flex flex-col">
              <span className="font-semibold">{a.titulo}</span>
              <span className="text-xs text-apagado">{a.sub}</span>
            </span>
            <a href={`/marca/${a.arquivo}`} download={`ma-sorteio-${a.arquivo}`} className="rounded-xl bg-roxo px-4 py-2 text-sm font-semibold text-white">
              Baixar
            </a>
          </div>
        </section>
      ))}
    </main>
  );
}
