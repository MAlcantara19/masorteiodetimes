"use client";
// Cronômetro simples: funciona só neste aparelho, sem internet, sem sorteio e sem login.
// Regressivo; quando zera, NÃO para: mostra "tempo excedido" contando pra cima até alguém pausar.
// Mostra tempo real × bola rolando × parado, guarda o motivo de cada pausa e o placar do dia.
// Regra "7 minutos ou 2 gols": escolhe os gols pra acabar. Apita (som) quando acaba o tempo ou bate os gols.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatarRelogio } from "@/lib/partida";
import { apitar, liberarSom } from "@/lib/som";

type Pausa = { inicio: number; fim: number | null; motivo: string | null };
type Jogo = { nomes: [string, string]; placar: [number, number]; rolando: number; real: number; pausas: number };

type Estado = {
  minutos: number;
  inicio: number | null; // quando começou (ms)
  pausas: Pausa[];
  extra: number; // segundos a mais (+1 min)
  fim: number | null; // quando encerrou o jogo
  placar: [number, number];
  nomes: [string, string];
  dia: string; // "AAAA-MM-DD" do histórico abaixo
  jogos: Jogo[]; // jogos já encerrados hoje
  gols?: number; // gols pra acabar (0 = só tempo)
  som?: boolean; // apito quando acaba
};

const CHAVE = "masorteio:cronometro:v2";
const MOTIVOS = ["Machucou", "Bola longe", "Falta / discussão", "Outro"];
const hojeIso = () => new Date().toISOString().slice(0, 10);
const NOVO: Omit<Estado, "dia" | "jogos" | "minutos" | "nomes"> = { inicio: null, pausas: [], extra: 0, fim: null, placar: [0, 0] };

export default function CronometroPage() {
  const [e, setE] = useState<Estado>({ ...NOVO, minutos: 7, nomes: ["Time 1", "Time 2"], dia: "", jogos: [] });
  const [agora, setAgora] = useState(0);
  const [telao, setTelao] = useState(false);
  const vibrou = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHAVE);
      const busca = new URLSearchParams(window.location.search);
      const min = Number(busca.get("min"));
      const gols = busca.has("gols") ? Number(busca.get("gols")) : null;
      const salvo = raw ? (JSON.parse(raw) as Estado) : null;
      const dia = hojeIso();
      // O link da partida manda os minutos e os gols da pelada: vale se o jogo ainda não começou.
      const daPelada = salvo && !salvo.inicio ? { ...(min > 0 ? { minutos: min } : {}), ...(gols !== null && gols >= 0 ? { gols } : {}) } : {};
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (salvo) setE({ ...salvo, ...daPelada, ...(salvo.dia !== dia ? { dia, jogos: [] } : {}) });
      else setE((x) => ({ ...x, dia, minutos: min > 0 ? min : x.minutos, gols: gols !== null && gols >= 0 ? gols : x.gols }));
    } catch {}
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      if (e.dia) window.localStorage.setItem(CHAVE, JSON.stringify(e));
    } catch {}
  }, [e]);

  // Tela acesa enquanto o cronômetro está aberto.
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

  const ate = e.fim ?? agora;
  const aberta = e.pausas.find((p) => !p.fim) ?? null;
  const parado = e.pausas.reduce((t, p) => t + ((p.fim ?? ate) - p.inicio), 0) / 1000;
  const real = e.inicio ? Math.max(0, (ate - e.inicio) / 1000) : 0;
  const rolando = Math.max(0, real - parado);
  const restante = e.minutos * 60 + e.extra - rolando;
  const excedido = e.inicio && restante < 0 ? -restante : 0;
  const limiteGols = e.gols ?? 0;
  const bateuGols = !!limiteGols && Math.max(...e.placar) >= limiteGols;
  const status = e.fim ? "fim" : !e.inicio ? "pronto" : bateuGols ? "gols" : aberta ? "pausado" : excedido ? "excedido" : "rolando";

  useEffect(() => {
    if ((status === "excedido" || status === "gols") && !vibrou.current) {
      vibrou.current = true;
      if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
      if (e.som === true) apitar("fim");
    }
    if (status === "pronto") vibrou.current = false;
  }, [status, e.som]);

  function playPausa() {
    liberarSom();
    const t = Date.now();
    if (e.fim) return;
    if (!e.inicio) setE({ ...e, inicio: t });
    else if (aberta) setE({ ...e, pausas: e.pausas.map((p) => (p === aberta ? { ...p, fim: t } : p)) });
    else setE({ ...e, pausas: [...e.pausas, { inicio: t, fim: null, motivo: null }] });
  }

  function motivo(m: string) {
    if (!aberta) return;
    setE({ ...e, pausas: e.pausas.map((p) => (p === aberta ? { ...p, motivo: p.motivo === m ? null : m } : p)) });
  }

  function gol(lado: 0 | 1, d: number) {
    const p: [number, number] = [...e.placar];
    p[lado] = Math.max(0, p[lado] + d);
    setE({ ...e, placar: p });
    if (d > 0 && navigator.vibrate) navigator.vibrate(40);
  }

  // Encerra o jogo, guarda no placar do dia e já deixa o próximo pronto.
  function proximoJogo() {
    const jogo: Jogo | null = e.inicio ? { nomes: e.nomes, placar: e.placar, rolando, real, pausas: e.pausas.length } : null;
    setE({ ...e, ...NOVO, jogos: jogo ? [...e.jogos, jogo] : e.jogos });
  }

  function zerarTudo() {
    if (!confirm("Apagar o jogo atual e o placar do dia?")) return;
    setE({ ...e, ...NOVO, jogos: [] });
  }

  const relogio = excedido ? `+${formatarRelogio(excedido)}` : formatarRelogio(restante);
  // Tempo esgotado ou bateu os gols: o cartão inteiro pisca (quem segura o celular vê de canto de olho).
  const acabou = status === "excedido" || status === "gols" || (!!e.inicio && !e.fim && (bateuGols || !!excedido));
  const corRelogio = excedido || bateuGols ? "text-alerta-suave" : "";
  const rotulo = { gols: `FIM · CHEGOU A ${limiteGols} ${limiteGols === 1 ? "GOL" : "GOLS"}`, pronto: "PRONTO PRA COMEÇAR", pausado: `PAUSADO${aberta?.motivo ? " · " + aberta.motivo.toUpperCase() : ""}`, excedido: "TEMPO ESGOTADO · EXCEDIDO", rolando: "ROLANDO", fim: "ENCERRADO" }[status];

  // Placar do dia por nome de time
  const tabela = new Map<string, { v: number; e: number; d: number; gp: number }>();
  for (const j of e.jogos) {
    j.nomes.forEach((n, k) => {
      const t = tabela.get(n) ?? { v: 0, e: 0, d: 0, gp: 0 };
      const meu = j.placar[k];
      const deles = j.placar[1 - k];
      if (meu > deles) t.v++;
      else if (meu === deles) t.e++;
      else t.d++;
      t.gp += meu;
      tabela.set(n, t);
    });
  }

  if (telao) {
    return (
      <div
        className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[4vh] p-6 text-white ${acabou ? "fim-tempo" : "bg-noite"}`}
        onClick={() => {
          setTelao(false);
          document.exitFullscreen?.().catch(() => {});
        }}
      >
        <span className={acabou ? "font-display text-[9vmin] font-black" : "text-[3vh] font-semibold tracking-widest text-roxo-claro"}>{acabou ? (bateuGols ? `${limiteGols} GOLS · ACABOU` : "ACABOU O TEMPO") : rotulo}</span>
        <span className={`font-display text-[28vmin] leading-none font-bold tabular-nums ${corRelogio}`}>{relogio}</span>
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
        <span className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            liberarSom();
            setE({ ...e, som: e.som !== true });
          }}
          aria-pressed={e.som === true}
          className="rounded-full border border-borda bg-white px-3 py-1.5 text-sm font-semibold whitespace-nowrap"
        >
          {e.som === true ? "📣 Apito ligado" : "🔇 Apito desligado"}
        </button>
        <button
          type="button"
          onClick={() => {
            setTelao(true);
            document.documentElement.requestFullscreen?.().catch(() => {});
          }}
          className="rounded-full border border-borda bg-white px-3 py-1.5 text-sm font-semibold whitespace-nowrap"
        >
          Telão
        </button>
        </span>
      </header>

      <section className={`flex flex-col items-center gap-3 rounded-3xl px-4 pt-4 pb-5 text-white ${acabou ? "fim-tempo" : "bg-noite"}`}>
        {acabou ? (
          <span className="flex flex-col items-center text-center">
            <span className="font-display text-[34px] leading-none font-black tracking-tight">{bateuGols ? `${limiteGols} ${limiteGols === 1 ? "GOL" : "GOLS"} · ACABOU` : "ACABOU O TEMPO"}</span>
            <span className="pt-1 text-sm font-semibold">{aberta ? "Jogo pausado" : "Na próxima saída de bola, encerra"}</span>
          </span>
        ) : (
          <span className="text-xs font-bold tracking-widest text-roxo-claro">{rotulo}</span>
        )}
        <span className={`font-display text-[88px] leading-none font-bold tabular-nums ${acabou ? "" : corRelogio}`}>{relogio}</span>
        {e.inicio && (
          <div className="grid w-full grid-cols-3 gap-1 text-center text-[11px] text-[#CFC7E0]">
            <span>
              Tempo real
              <br />
              <strong className="font-display text-sm text-white tabular-nums">{formatarRelogio(real)}</strong>
            </span>
            <span>
              Bola rolando
              <br />
              <strong className="font-display text-sm text-white tabular-nums">{formatarRelogio(rolando)}</strong>
            </span>
            <span>
              Parado
              <br />
              <strong className="font-display text-sm text-white tabular-nums">{formatarRelogio(parado)}</strong>
            </span>
          </div>
        )}
        {e.pausas.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 text-[11px]">
            {e.pausas.map((p, k) => (
              <span key={k} className={`rounded-full px-2 py-0.5 ${!p.fim ? "bg-alerta text-white" : "bg-white/10 text-[#CFC7E0]"}`}>
                ⏸ {p.motivo ?? "sem motivo"} · {formatarRelogio(((p.fim ?? ate) - p.inicio) / 1000)}
              </span>
            ))}
          </div>
        )}
        {status !== "fim" && (
          <div className="grid w-full grid-cols-[1fr_1.6fr_1fr] gap-2">
            <button type="button" onClick={proximoJogo} className="h-12 rounded-xl bg-white/10 text-sm font-semibold">
              Encerrar
            </button>
            <button type="button" onClick={playPausa} className="h-12 rounded-xl bg-roxo text-base font-bold">
              {status === "pronto" ? "Iniciar" : status === "pausado" || (status === "gols" && aberta) ? "Voltar" : "Pausar"}
            </button>
            <button type="button" onClick={() => setE({ ...e, extra: e.extra + 60 })} className="h-12 rounded-xl bg-white/10 text-sm font-semibold">
              +1 min
            </button>
          </div>
        )}
        {status === "pausado" && (
          <div className="flex w-full flex-col gap-1.5">
            <span className="text-xs text-[#CFC7E0]">Motivo da pausa (opcional)</span>
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => motivo(m)}
                  className={`h-8 rounded-full border px-3 text-[13px] font-semibold ${aberta?.motivo === m ? "border-roxo bg-roxo" : "border-white/20"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}
        {status === "pronto" && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#CFC7E0]">Minutos:</span>
            {[5, 7, 8, 10, 12, 15].map((m) => (
              <button key={m} type="button" onClick={() => setE({ ...e, minutos: m })} className={`h-9 w-9 rounded-lg font-semibold ${e.minutos === m ? "bg-roxo" : "bg-white/10"}`}>
                {m}
              </button>
            ))}
          </div>
        )}
        {status === "pronto" && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#CFC7E0]">Ou gols:</span>
            {[0, 1, 2, 3].map((g) => (
              <button key={g} type="button" onClick={() => setE({ ...e, gols: g })} className={`h-9 min-w-9 rounded-lg px-2 font-semibold ${limiteGols === g ? "bg-roxo" : "bg-white/10"}`}>
                {g === 0 ? "só tempo" : g}
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

      <button type="button" onClick={proximoJogo} className="h-12 rounded-xl bg-noite font-semibold text-white">
        Encerrar e começar o próximo jogo
      </button>

      {e.jogos.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
          <span className="text-xs font-bold tracking-wider text-apagado">PLACAR DO DIA (NESTE APARELHO)</span>
          <div className="flex flex-wrap gap-2">
            {[...tabela.entries()]
              .sort((a, b) => b[1].v - a[1].v || b[1].gp - a[1].gp)
              .map(([n, t]) => (
                <span key={n} className="rounded-xl bg-fundo px-2.5 py-1.5 text-sm">
                  <strong>{n}</strong>{" "}
                  <span className="tabular-nums text-apagado">
                    {t.v}V {t.e}E {t.d}D
                  </span>
                </span>
              ))}
          </div>
          {[...e.jogos].reverse().map((j, k) => (
            <span key={k} className="flex justify-between border-t border-borda py-1 text-[13px]">
              <span className="text-apagado">
                Jogo {e.jogos.length - k} · {formatarRelogio(j.rolando)} rolando
              </span>
              <span className="tabular-nums">
                {j.nomes[0]} <strong>{j.placar[0]} × {j.placar[1]}</strong> {j.nomes[1]}
              </span>
            </span>
          ))}
          <button type="button" onClick={zerarTudo} className="self-start text-xs font-semibold text-alerta underline">
            Apagar o placar do dia
          </button>
        </section>
      )}

      <p className="text-center text-xs text-apagado">
        Este cronômetro não salva no campeonato. Pra isso, use a partida ao vivo depois do sorteio.{" "}
        <Link href="/" className="font-semibold text-roxo">
          Início
        </Link>
      </p>
    </main>
  );
}
