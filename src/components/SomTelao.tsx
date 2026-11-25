"use client";
// Botões de som da partida e do telão: apito quando o tempo acaba (ou bate os gols), narrador do gol
// e o atalho pra música. Apito e narrador vêm desligados; as escolhas ficam guardadas neste aparelho.
// `variante`: "tv" fica no canto do telão; "celular" é uma linha de botões na tela da partida.
import { useEffect, useRef, useState } from "react";
import { apitar, liberarSom, narrarGol } from "@/lib/som";

const CHAVE = "masorteio:telao-som";
type Prefs = { apito: boolean; narrar: boolean; playlist: string };
const PADRAO: Prefs = { apito: false, narrar: false, playlist: "" };

function ler(): Prefs {
  try {
    return { ...PADRAO, ...JSON.parse(window.localStorage.getItem(CHAVE) ?? "{}") };
  } catch {
    return PADRAO;
  }
}

type Props = {
  golId: string | null;
  golNome: string | null; // quem fez (null = sem autor)
  golContra: boolean;
  tempoAcabou: boolean;
  partidaId: string;
  variante?: "tv" | "celular";
};

export default function SomTelao({ golId, golNome, golContra, tempoAcabou, partidaId, variante = "tv" }: Props) {
  const [p, setP] = useState<Prefs>(ler);
  const [musica, setMusica] = useState(false);
  const ultimoGol = useRef(golId);
  const apitou = useRef<string | null>(tempoAcabou ? partidaId : null);

  function mudar(n: Partial<Prefs>) {
    liberarSom();
    const x = { ...p, ...n };
    setP(x);
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(x));
    } catch {}
  }

  // Gol novo (não o que já estava quando abriu a tela).
  useEffect(() => {
    if (!golId || golId === ultimoGol.current) return;
    ultimoGol.current = golId;
    if (p.narrar) narrarGol(golNome, golContra);
  }, [golId, golNome, golContra, p.narrar]);

  // Acabou o tempo: apita uma vez por jogo.
  useEffect(() => {
    if (!tempoAcabou || apitou.current === partidaId) return;
    apitou.current = partidaId;
    if (p.apito) apitar("fim");
  }, [tempoAcabou, partidaId, p.apito]);

  const tv = variante === "tv";
  const botao = (ligado: boolean) =>
    tv
      ? `rounded-full px-[1.6vmin] py-[0.6vmin] text-[1.8vmin] font-semibold ${ligado ? "bg-white/20 text-white" : "bg-white/5 text-white/50"}`
      : `h-9 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap ${ligado ? "border-roxo bg-roxo-suave text-roxo-escuro" : "border-borda bg-white text-apagado"}`;

  return (
    <div className={tv ? "absolute bottom-[1.5vmin] left-[3vmin] flex flex-col items-start gap-[1vmin]" : "flex flex-col gap-2"}>
      {musica && (
        <div className={tv ? "flex w-[60vmin] flex-col gap-[1vmin] rounded-[1.6vmin] bg-noite/95 p-[2vmin] text-[2vmin] ring-1 ring-white/20" : "flex flex-col gap-2 rounded-2xl border border-borda bg-white p-3 text-[13px]"}>
          <span>Toca no app de música (Spotify, YouTube Music, Deezer) ligado na caixinha de som. Pode ser uma playlist ou o aleatório. Depois é só voltar pra cá.</span>
          <input
            value={p.playlist}
            onChange={(e) => mudar({ playlist: e.target.value })}
            placeholder="Link da playlist (opcional)"
            aria-label="Link da playlist"
            className={tv ? "rounded-[1vmin] bg-white/10 px-[1.4vmin] py-[1vmin] text-white" : "h-10 rounded-xl border border-borda px-3"}
          />
          <div className="flex flex-wrap gap-2">
            <a href={p.playlist || "https://open.spotify.com/"} target="_blank" rel="noreferrer" className={tv ? "rounded-full bg-roxo px-[2vmin] py-[0.8vmin] font-bold" : "rounded-full bg-zap px-3 py-1.5 font-bold text-white"}>
              {p.playlist ? "Abrir a playlist" : "Abrir o Spotify"}
            </a>
            <button type="button" onClick={() => setMusica(false)} className={tv ? "rounded-full bg-white/10 px-[2vmin] py-[0.8vmin]" : "rounded-full border border-borda px-3 py-1.5"}>
              Fechar
            </button>
          </div>
        </div>
      )}
      <div className={tv ? "flex gap-[1vmin]" : "flex flex-wrap gap-2"}>
        <button type="button" aria-pressed={p.apito} onClick={() => mudar({ apito: !p.apito })} className={botao(p.apito)}>
          📣 Apito {p.apito ? "ligado" : "desligado"}
        </button>
        <button type="button" aria-pressed={p.narrar} onClick={() => mudar({ narrar: !p.narrar })} className={botao(p.narrar)}>
          🗣️ Narrador {p.narrar ? "ligado" : "desligado"}
        </button>
        <button type="button" onClick={() => setMusica(!musica)} className={botao(musica)}>
          🎵 Música
        </button>
      </div>
    </div>
  );
}
