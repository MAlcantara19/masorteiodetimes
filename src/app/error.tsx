"use client";
// Tela que aparece se alguma página quebrar, em vez da tela branca.
import Link from "next/link";

export default function Erro({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-5xl">🤕</span>
      <h1 className="font-display text-2xl font-bold">Ih, deu ruim aqui</h1>
      <p className="text-sm text-apagado">Alguma coisa falhou ao abrir esta tela. Tenta de novo; se continuar, avisa o admin.</p>
      <div className="flex gap-2">
        <button type="button" onClick={reset} className="h-12 rounded-xl bg-roxo px-5 font-semibold text-white">
          Tentar de novo
        </button>
        <Link href="/" className="flex h-12 items-center rounded-xl border border-borda bg-white px-5 font-semibold">
          Início
        </Link>
      </div>
    </main>
  );
}
