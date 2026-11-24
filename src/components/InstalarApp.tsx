"use client";
// Faixa "Instale o app": usa o pedido de instalação do Android/PC e explica o caminho no iPhone.
import { useEffect, useState } from "react";

type EventoInstalar = Event & { prompt: () => Promise<void> };

export default function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  const [instalado, setInstalado] = useState(false);
  const [ajuda, setAjuda] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalado(true);
    const pegar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    const ok = () => setInstalado(true);
    window.addEventListener("beforeinstallprompt", pegar);
    window.addEventListener("appinstalled", ok);
    return () => {
      window.removeEventListener("beforeinstallprompt", pegar);
      window.removeEventListener("appinstalled", ok);
    };
  }, []);

  if (instalado) return null;

  async function instalar() {
    if (evento) {
      await evento.prompt();
      setEvento(null);
    } else {
      setAjuda(true);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-roxo-suave px-3.5 py-3 text-roxo-escuro">
      <div className="flex items-center gap-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="6" y="2" width="12" height="20" rx="2.5" />
          <path d="M12 8v6M9 11l3 3 3-3" />
        </svg>
        <span className="flex-1 text-[13px]">
          <strong>Instale o app</strong> na tela inicial: abre direto e você continua logado.
        </span>
        <button type="button" onClick={instalar} className="h-9 rounded-[10px] bg-roxo-escuro px-3 text-[13px] font-semibold text-white">
          Instalar
        </button>
      </div>
      {ajuda && (
        <p className="text-[13px]">
          No iPhone: toque em <strong>Compartilhar</strong> (quadrado com a seta) e depois em <strong>Adicionar à Tela de Início</strong>.
          No Android: menu <strong>⋮</strong> → <strong>Instalar app</strong>.
        </p>
      )}
    </div>
  );
}
