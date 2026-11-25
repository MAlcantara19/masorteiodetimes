"use client";
// Botõezinhos do telão: apito quando o tempo acaba, voz narrando o gol (desligada no começo)
// e o atalho pra música (a playlist toca no app de música; o telão continua na tela).
// As escolhas ficam guardadas neste aparelho.
import { useEffect, useRef, useState } from "react";
import { apitar, falar, liberarSom } from "@/lib/som";

const CHAVE = "masorteio:telao-som";
type Prefs = { apito: boolean; narrar: boolean; playlist: string };

function ler(): Prefs {
  try {
    return { apito: true, narrar: false, playlist: "", ...JSON.parse(window.localStorage.getItem(CHAVE) ?? "{}") };
  } catch {
    return { apito: true, narrar: false, playlist: "" };
  }
}

export default function SomTelao({ golId, golFala, tempoAcabou, partidaId }: { golId: string | null; golFala: string; tempoAcabou: boolean; partidaId: string }) {
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

  // Gol novo (não o que já estava quando abriu o telão).
  useEffect(() => {
    if (!golId || golId === ultimoGol.current) return;
    ultimoGol.current = golId;
    if (p.narrar) falar(golFala);
    else if (p.apito) apitar("curto");
  }, [golId, golFala, p.narrar, p.apito]);

  // Acabou o tempo: apita uma vez por jogo.
  useEffect(() => {
    if (!tempoAcabou || apitou.current === partidaId) return;
    apitou.current = partidaId;
    if (p.apito) apitar("fim");
  }, [tempoAcabou, partidaId, p.apito]);

  const botao = (ligado: boolean) => `rounded-full px-[1.6vmin] py-[0.6vmin] text-[1.8vmin] font-semibold ${ligado ? "bg-white/20 text-white" : "bg-white/5 text-white/50"}`;

  return (
    <div className="absolute bottom-[1.5vmin] left-[3vmin] flex flex-col items-start gap-[1vmin]">
      {musica && (
        <div className="flex w-[60vmin] flex-col gap-[1vmin] rounded-[1.6vmin] bg-noite/95 p-[2vmin] text-[2vmin] ring-1 ring-white/20">
          <span>Cole o link da playlist (Spotify, YouTube Music, Deezer). Ela toca no app de música, ligado na caixinha de som; depois volte pro telão.</span>
          <input
            value={p.playlist}
            onChange={(e) => mudar({ playlist: e.target.value })}
            placeholder="https://open.spotify.com/playlist/…"
            aria-label="Link da playlist"
            className="rounded-[1vmin] bg-white/10 px-[1.4vmin] py-[1vmin] text-white"
          />
          <div className="flex gap-[1vmin]">
            <a
              href={p.playlist || "https://open.spotify.com/search/pelada"}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-roxo px-[2vmin] py-[0.8vmin] font-bold"
            >
              {p.playlist ? "Abrir a playlist" : "Procurar playlist"}
            </a>
            <button type="button" onClick={() => setMusica(false)} className="rounded-full bg-white/10 px-[2vmin] py-[0.8vmin]">
              Fechar
            </button>
          </div>
        </div>
      )}
      <div className="flex gap-[1vmin]">
        <button type="button" onClick={() => mudar({ apito: !p.apito })} className={botao(p.apito)}>
          📣 Apito {p.apito ? "ligado" : "desligado"}
        </button>
        <button type="button" onClick={() => mudar({ narrar: !p.narrar })} className={botao(p.narrar)}>
          🗣️ Narrar gols {p.narrar ? "ligado" : "desligado"}
        </button>
        <button type="button" onClick={() => setMusica(!musica)} className={botao(musica)}>
          🎵 Música
        </button>
      </div>
    </div>
  );
}
