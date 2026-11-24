import Link from "next/link";

export default function Inicio() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-8">
      <header className="flex flex-col gap-1">
        <span className="font-display text-3xl font-bold tracking-tight">
          MA <span className="text-roxo">Sorteio de Times</span>
        </span>
        <span className="text-sm text-apagado">Times equilibrados, sem anúncio e sem enrolação.</span>
      </header>

      <Link
        href="/sortear"
        className="flex flex-col gap-3 rounded-2xl border-2 border-roxo bg-white p-5 text-tinta"
      >
        <div className="flex items-center justify-between">
          <span className="font-display text-2xl font-semibold">Bola Fora</span>
          <span className="rounded-full bg-roxo-suave px-3 py-1 text-xs font-semibold text-roxo-escuro">Pelada de teste</span>
        </div>
        <span className="text-sm text-apagado">Cola a lista do grupo, ajusta as estrelas e sorteia.</span>
        <span className="font-semibold text-roxo">Montar sorteio →</span>
      </Link>

      <section className="rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">
        <p>
          Esta é a primeira versão: o elenco e as notas ficam guardados neste aparelho. Login, placar ao vivo e
          campeonato entram nas próximas etapas (veja o PROJETO.md).
        </p>
      </section>

      <footer className="pt-4 text-center text-xs text-apagado">Desenvolvido por Matheus Alcântara</footer>
    </main>
  );
}
