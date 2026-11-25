"use client";
// Telão: abre o placar gigante nesta tela, ou manda pra TV (Chromecast) pelo Chrome.
// Com ?tv=1 vai direto pro placar (é o endereço que a TV abre).
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePelada } from "@/lib/pelada";
import { Carregando } from "@/components/Topo";
import Capa from "@/components/Capa";
import TelaoTV from "@/components/TelaoTV";
import Bloqueado from "@/components/Bloqueado";
import { useSessao } from "@/lib/sessao";
import { temRecurso } from "@/lib/planos";

type Apresentacao = { start: () => Promise<unknown> };
type ComApresentacao = Window & { PresentationRequest?: new (urls: string[]) => Apresentacao };

export default function TelaoPage() {
  const { pelada, slug, naoAchou } = usePelada();
  const q = useSearchParams();
  const [aberto, setAberto] = useState(q.get("tv") === "1");
  const [aviso, setAviso] = useState<string | null>(null);
  const { ehMaster, ehAdmin } = useSessao();

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada) return <Carregando />;

  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const linkAoVivo = `${origem}/p/${slug}/ao-vivo`;
  const linkTv = `${origem}/p/${slug}/telao?tv=1`;
  if (!temRecurso(pelada, "telao", ehMaster)) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
        <Capa titulo="Telão" sub={pelada.nome} voltar={`/p/${slug}/ao-vivo`} logo={pelada.logo_url} />
        <Bloqueado titulo="Telão pra TV" pelada={pelada.nome} admin={ehAdmin(pelada.id)} />
      </main>
    );
  }
  const podeTransmitir = typeof window !== "undefined" && !!(window as ComApresentacao).PresentationRequest;

  if (aberto) {
    return (
      <div onDoubleClick={() => document.exitFullscreen?.().catch(() => {})}>
        <TelaoTV pelada={pelada} link={linkAoVivo} />
      </div>
    );
  }

  function abrirAqui() {
    document.documentElement.requestFullscreen?.().catch(() => {});
    try {
      (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape").catch(() => {});
    } catch {}
    setAberto(true);
  }

  async function transmitir() {
    setAviso(null);
    try {
      const P = (window as ComApresentacao).PresentationRequest!;
      await new P([linkTv]).start();
      setAviso("Pronto! O placar está indo pra TV. Pode deixar o celular de lado.");
    } catch {
      setAviso("Não achei nenhuma TV. Confere se o celular e o Chromecast estão no mesmo Wi-Fi, ou use o “Transmitir” do menu do Chrome.");
    }
  }

  async function copiar() {
    await navigator.clipboard.writeText(linkTv).catch(() => {});
    setAviso("Link do telão copiado.");
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Capa titulo="Telão" sub={`${pelada.nome} · placar gigante pra TV da quadra`} voltar={`/p/${slug}/ao-vivo`} logo={pelada.logo_url} />

      <button type="button" onClick={abrirAqui} className="flex h-14 items-center justify-center rounded-2xl bg-roxo text-lg font-bold text-white">
        📺 Abrir o telão nesta tela
      </button>
      {podeTransmitir && (
        <button type="button" onClick={transmitir} className="flex h-14 items-center justify-center rounded-2xl border-2 border-noite bg-white text-lg font-bold">
          Mandar pra TV (Chromecast)
        </button>
      )}
      {aviso && <p className="rounded-xl bg-roxo-suave px-3 py-2 text-sm text-roxo-escuro">{aviso}</p>}

      <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4 text-sm">
        <span className="font-semibold">Como colocar na TV</span>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-apagado">
          <li>
            <strong className="text-tinta">TV com Chromecast ou Google TV:</strong> no Chrome do celular ou do notebook, toque em ⋮ → <strong className="text-tinta">Transmitir</strong> → escolha a TV. Depois toque em “Abrir o telão nesta tela”.
          </li>
          <li>
            <strong className="text-tinta">Smart TV com navegador:</strong> abra o navegador da TV e digite o link do telão (botão abaixo copia).
          </li>
          <li>
            <strong className="text-tinta">Cabo HDMI:</strong> ligue o notebook na TV e abra o telão nele.
          </li>
        </ol>
        <span className="text-apagado">O telão só mostra. Quem marca os gols continua usando a tela da partida no celular, e a TV atualiza sozinha.</span>
        <button type="button" onClick={copiar} className="h-11 rounded-xl border border-borda font-semibold">
          Copiar link do telão
        </button>
      </section>
    </main>
  );
}
