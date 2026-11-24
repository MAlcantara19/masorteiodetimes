// Endereço que não existe.
import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="font-display text-6xl font-bold text-roxo">404</span>
      <h1 className="font-display text-2xl font-bold">Essa bola foi pra fora</h1>
      <p className="text-sm text-apagado">Não achei essa página. Confere o link ou volta pro início.</p>
      <Link href="/" className="flex h-12 items-center rounded-xl bg-roxo px-5 font-semibold text-white">
        Voltar pro início
      </Link>
    </main>
  );
}
