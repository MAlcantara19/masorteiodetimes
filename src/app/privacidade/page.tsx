"use client";
// Privacidade (LGPD) em linguagem simples, e o botão de excluir a própria conta.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSessao } from "@/lib/sessao";
import Topo from "@/components/Topo";

export default function PrivacidadePage() {
  const router = useRouter();
  const { usuario, sair } = useSessao();
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  async function excluir() {
    setExcluindo(true);
    const r = await fetch("/api/conta/excluir", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setExcluindo(false);
    if (!r.ok) return setErro(j.erro ?? "Deu erro.");
    await sair();
    router.replace("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6 text-[15px] leading-relaxed">
      <Topo titulo="Privacidade" voltar="/mais" />
      <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
        <h2 className="font-semibold">O que o app guarda</h2>
        <ul className="list-disc pl-5 text-apagado">
          <li>Seu nome, apelido, e-mail e foto (do Google ou que você enviou).</li>
          <li>Os jogos da pelada: presença, times, gols, assistências, votos e fotos do dia.</li>
          <li>As avaliações de nível (estrelas) que os admins dão. Elas nunca aparecem pra jogador nem em imagem compartilhada.</li>
          <li>Se você ativar, o endereço do seu aparelho pra receber notificações.</li>
        </ul>
        <h2 className="font-semibold">Pra que serve</h2>
        <p className="text-apagado">Só pra organizar a pelada: sortear times, mostrar o placar e o campeonato. Nada é vendido, não tem anúncio.</p>
        <h2 className="font-semibold">Quem vê</h2>
        <p className="text-apagado">
          Placar, artilharia, campeonato e álbum são públicos pra quem tem o link da pelada. Estrelas, quem votou em quem e as sugestões das avaliações só os admins
          veem.
        </p>
        <h2 className="font-semibold">Onde fica</h2>
        <p className="text-apagado">No Supabase (banco de dados) e na Vercel (site), serviços usados pelo app.</p>
      </section>

      {usuario && (
        <section className="flex flex-col gap-3 rounded-2xl border border-alerta/40 bg-white p-4">
          <h2 className="font-semibold text-alerta-escuro">Excluir minha conta</h2>
          <p className="text-sm text-apagado">
            Apaga seu login, seu perfil, suas fotos e seus votos. Isso não tem volta. Os jogos que você jogou continuam no histórico da pelada, só com o nome do elenco.
          </p>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Pra confirmar, escreva EXCLUIR
            <input value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className="h-11 rounded-xl border border-borda px-3 font-normal" />
          </label>
          {erro && <p className="text-sm text-alerta-escuro">{erro}</p>}
          <button
            type="button"
            disabled={confirmar.trim().toUpperCase() !== "EXCLUIR" || excluindo}
            onClick={excluir}
            className="h-12 rounded-xl bg-alerta font-semibold text-white disabled:opacity-40"
          >
            {excluindo ? "Excluindo…" : "Excluir minha conta"}
          </button>
        </section>
      )}
    </main>
  );
}
