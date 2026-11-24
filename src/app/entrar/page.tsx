"use client";
// Tela de entrada: Google, e-mail e senha (que o master gera pros admins) ou só acompanhar.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import InstalarApp from "@/components/InstalarApp";
import BotaoGoogle from "@/components/BotaoGoogle";

export default function EntrarPage() {
  const router = useRouter();
  const { usuario, carregando } = useSessao();
  const [mostrarEmail, setMostrarEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!carregando && usuario) router.replace("/");
  }, [carregando, usuario, router]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const volta = q.get("volta");
    if (volta && volta.startsWith("/") && !volta.startsWith("//")) {
      try {
        window.localStorage.setItem("masorteio:voltar", volta);
      } catch {}
    }
    if (q.get("erro") === "google") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setErro("Não deu pra entrar com o Google. Tenta de novo.");
    }
  }, []);

  async function entrarEmail(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await criarClienteSupabase().auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error) setErro("E-mail ou senha errados.");
    else router.replace("/");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col bg-fundo">
      <div className="flex h-[300px] flex-col justify-end gap-2.5 bg-noite px-6 pb-8 text-white sm:rounded-b-3xl">
        <div className="flex h-16 w-16 items-center justify-center rounded-[18px] bg-roxo">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h4l10 12h4M3 18h4l3-3.6M14 9.6 17 6h4M18 3l3 3-3 3M18 15l3 3-3 3" />
          </svg>
        </div>
        <span className="font-display text-[34px] font-bold tracking-tight">
          MA <span className="text-roxo-claro">Sorteio</span>
        </span>
        <span className="text-[15px] text-[#CFC7E0]">Times equilibrados, placar ao vivo e o campeonato da sua pelada.</span>
      </div>

      <div className="flex flex-col gap-3 p-6">
        <BotaoGoogle onErro={setErro} />
        <button
          type="button"
          onClick={() => setMostrarEmail(!mostrarEmail)}
          className="h-[54px] rounded-[14px] bg-roxo text-base font-semibold text-white"
        >
          Entrar com e-mail e senha
        </button>

        {mostrarEmail && (
          <form onSubmit={entrarEmail} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              E-mail
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className="h-[46px] rounded-xl border border-[#D8D0E6] bg-white px-3 text-[15px] font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Senha
              <input
                type="password"
                required
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Senha que o admin te passou"
                className="h-[46px] rounded-xl border border-[#D8D0E6] bg-white px-3 text-[15px] font-normal"
              />
            </label>
            <button type="submit" disabled={enviando} className="h-12 rounded-xl bg-roxo-escuro font-semibold text-white disabled:opacity-60">
              {enviando ? "Entrando…" : "Entrar"}
            </button>
          </form>
        )}

        {erro && (
          <p role="alert" className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">
            {erro}
          </p>
        )}

        <Link href="/acompanhar" className="flex h-12 items-center justify-center text-[15px] font-semibold text-roxo">
          Só acompanhar, sem entrar
        </Link>
        <Link href="/tour" className="-mt-2 flex h-10 items-center justify-center text-sm font-semibold text-apagado underline">
          Primeira vez? Conhece o app no tour
        </Link>

        <InstalarApp />

        <span className="text-center text-xs text-apagado">
          Quem entra com Google vira jogador. O master pode promover a admin de uma pelada.
        </span>
      </div>
    </main>
  );
}
