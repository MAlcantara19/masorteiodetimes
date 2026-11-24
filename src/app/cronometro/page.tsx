"use client";
// Cronômetro simples: funciona só neste aparelho, sem internet, sem sorteio e sem login.
// Bom pra quando a conexão da quadra está ruim ou não deu tempo de sortear pelo app.
// O estado fica salvo no aparelho (se fechar e abrir de novo, continua de onde parou).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatarRelogio } from "@/lib/partida";

type Estado = {
  minutos: number;
  inicio: number | null; // quando começou (ms)
  pausadoEm: number | null;
  pausado: number; // ms acumulados parado
  extra: number; // segundos a mais (+1 min)
  placar: [number, number];
  nomes: [string, string];
};

const CHAVE = "masorteio:cronometro";
const INICIAL: Estado = { minutos: 7, inicio: null, pausadoEm: null, pausado: 0, extra: 0, placar: [0, 0], nomes: ["Time 1", "Time 2"] };

export default function CronometroPage() {
  const [e, setE] = useState<Estado>(INICIAL);
  const [agora, setAgora] = useState(0);
  const [telao, setTelao] = useState(false);
  const vibrou = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHAVE);
      const min = Number(new URLSearchParams(window.location.search).get("min"));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setE({ ...INICIAL, ...JSON.parse(raw) });
      else if (min > 0) setE({ ...INICIAL, minutos: min });
    } catch {}
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(e));
    } catch {}
  }, [e]);

  // Tela acesa enquanto o cronômetro existe na tela.
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let trava: { release: () => Promise<void> } | null = null;
    const pedir = () =>
      document.visibilityState === "visible" &&
      (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock
        .request("screen")
        .then((t) => (trava = t))
        .catch(() => {});
    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      document.removeEventListener("visibilitychange", pedir);
      trava?.release().catch(() => {});
    };
  }, []);

  const rolando = e.inicio ? Math.max(0, ((e.pausadoEm ?? agora) - e.inicio - e.pausado) / 1000) : 0;
  const restante = e.minutos * 60 + e.extra - rolando;
  const status = !e.inicio ? "pronto" : e.pausadoEm ? "pausado" : restante <= 0 ? "fim" : "rolando";

  useEffect(() => {
    if (status === "fim" && !vibrou.current) {
      vibrou.current = true;
      if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
    }
    if (status !== "fim") vibrou.current = false;
  }, [status]);

  function playPausa() {
    const t = Date.now();
    if (!e.inicio) setE({ ...e, inicio: t });
    else if (e.pausadoEm) setE({ ...e, pausado: e.pausado + (t - e.pausadoEm), pausadoEm: null });
    else setE({ ...e, pausadoEm: t });
  }

  function zerar(manterPlacar = false) {
    setE({ ...INICIAL, minutos: e.minutos, nomes: e.nomes, placar: manterPlacar ? e.placar : [0, 0] });
  }

  function gol(lado: 0 | 1, d: number) {
    const p: [number, number] = [...e.placar];
    p[lado] = Math.max(0, p[lado] + d);
    setE({ ...e, placar: p });
    if (d > 0 && navigator.vibrate) navigator.vibrate(40);
  }

  const relogio = formatarRelogio(restante);
  const fim = status === "fim";

  if (telao) {
    return (
      <div
        className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[4vh] bg-noite p-6 text-white"
        onClick={() => {
          setTelao(false);
          document.exitFullscreen?.().catch(() => {});
        }}
      >
        <span className={`font-display text-[28vmin] leading-none font-bold tabular-nums ${fim ? "text-alerta-suave" : ""}`}>{relogio}</span>
        <div className="flex items-center gap-[6vw] font-display font-bold">
          <span className="flex flex-col items-center">
            <span className="text-[4vmin] text-roxo-claro">{e.nomes[0]}</span>
            <span className="text-[22vmin] leading-none">{e.placar[0]}</span>
          </span>
          <span className="text-[10vmin] text-white/40">×</span>
          <span className="flex flex-col items-center">
            <span className="text-[4vmin] text-roxo-claro">{e.nomes[1]}</span>
            <span className="text-[22vmin] leading-none">{e.placar[1]}</span>
          </span>
        </div>
        <span className="text-sm text-white/40">Toque pra sair do telão</span>
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-6">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="font-display text-2xl font-bold">Cronômetro</h1>
          <span className="text-[13px] text-apagado">Só neste aparelho · funciona sem internet</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setTelao(true);
            document.documentElement.requestFullscreen?.().catch(() => {});
          }}
          className="rounded-full border border-borda bg-white px-3 py-1.5 text-sm font-semibold"
        >
          Telão
        </button>
      </header>

      <section className="flex flex-col items-center gap-3 rounded-3xl bg-noite px-4 pt-4 pb-5 text-white">
        <span className={`text-xs font-bold tracking-widest ${fim ? "text-alerta-suave" : "text-roxo-claro"}`}>
          {status === "pronto" ? "PRONTO PRA COMEÇAR" : status === "pausado" ? "PAUSADO" : fim ? "FIM DE JOGO" : "ROLANDO"}
        </span>
        <span className={`font-display text-[92px] leading-none font-bold tabular-nums ${fim ? "text-alerta-suave" : ""}`}>{relogio}</span>
        <div className="grid w-full grid-cols-[1fr_1.6fr_1fr] gap-2">
          <button type="button" onClick={() => confirm("Zerar o cronômetro e o placar?") && zerar()} className="h-12 rounded-xl bg-white/10 text-sm font-semibold">
            Zerar
          </button>
          <button type="button" onClick={playPausa} className="h-12 rounded-xl bg-roxo text-base font-bold">
            {status === "pronto" ? "Iniciar" : status === "pausado" ? "Voltar" : "Pausar"}
          </button>
          <button type="button" onClick={() => setE({ ...e, extra: e.extra + 60 })} className="h-12 rounded-xl bg-white/10 text-sm font-semibold">
            +1 min
          </button>
        </div>
        {status === "pronto" && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#CFC7E0]">Minutos:</span>
            {[5, 7, 8, 10, 12, 15].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setE({ ...e, minutos: m })}
                className={`h-9 w-9 rounded-lg font-semibold ${e.minutos === m ? "bg-roxo" : "bg-white/10"}`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-2">
        {([0, 1] as const).map((lado) => (
          <div key={lado} className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-3">
            <input
              aria-label="Nome do time"
              value={e.nomes[lado]}
              onChange={(ev) => {
                const n: [string, string] = [...e.nomes];
                n[lado] = ev.target.value;
                setE({ ...e, nomes: n });
              }}
              className="text-center text-sm font-bold text-roxo outline-none"
            />
            <div className="flex items-center justify-between">
              <button type="button" aria-label="Tirar gol" onClick={() => gol(lado, -1)} className="h-11 w-11 rounded-xl border border-borda text-xl">
                −
              </button>
              <span className="font-display text-5xl font-bold tabular-nums">{e.placar[lado]}</span>
              <span className="w-11" />
            </div>
            <button type="button" onClick={() => gol(lado, 1)} className="h-12 rounded-xl bg-roxo font-bold text-white">
              + Gol
            </button>
          </div>
        ))}
      </section>

      <button type="button" onClick={() => zerar(false)} className="h-12 rounded-xl border border-borda bg-white font-semibold">
        Próximo jogo (zera tempo e placar)
      </button>
      <p className="text-center text-xs text-apagado">
        Este cronômetro não salva os gols no campeonato. Pra isso, use a partida ao vivo depois do sorteio. <Link href="/" className="font-semibold text-roxo">Início</Link>
      </p>
    </main>
  );
}
