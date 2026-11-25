"use client";
// Telão pra TV da quadra: placar e cronômetro gigantes, quem está em campo, artilharia,
// vitórias do dia e o próximo jogo. Só mostra (não mexe em nada) e se atualiza sozinho.
import { useCallback, useEffect, useMemo, useState } from "react";
import SomTelao from "@/components/SomTelao";
import QRCode from "qrcode";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { carregarElenco, nomeCurto, type Membro, type Pelada } from "@/lib/pelada";
import { eventoAtual, carregarSorteios, CORES_TIMES, NOMES_TIMES, type SorteioSalvo } from "@/lib/evento";
import { calcularFila, formatarRelogio, medirDiferencaRelogio, segundosRolando, type Lance, type Partida } from "@/lib/partida";
import { corLegivel } from "@/lib/cores";

type Dados = { eventoId: string; sorteio: SorteioSalvo | null; partidas: Partida[]; lances: Lance[] };

export default function TelaoTV({ pelada, link }: { pelada: Pelada; link: string }) {
  const [dados, setDados] = useState<Dados | null | undefined>(undefined);
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [dif, setDif] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());
  const [qr, setQr] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const ev = await eventoAtual(pelada.id);
      if (!ev) return setDados(null);
      const sb = criarClienteSupabase();
      const [sorteios, { data: ps, error }] = await Promise.all([carregarSorteios(ev.id), sb.from("partidas").select("*").eq("evento_id", ev.id).order("numero")]);
      if (error) return; // sem internet: fica com o que já tem
      const partidas = (ps ?? []) as Partida[];
      const ids = partidas.map((p) => p.id);
      const { data: ls } = ids.length ? await sb.from("lances").select("*").in("partida_id", ids).eq("desfeito", false).order("created_at") : { data: [] };
      setDados({ eventoId: ev.id, sorteio: sorteios.find((s) => s.oficial) ?? sorteios[sorteios.length - 1] ?? null, partidas, lances: (ls ?? []) as Lance[] });
    } catch {}
  }, [pelada.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
    carregarElenco(pelada.id, false).then(setElenco);
    medirDiferencaRelogio().then(setDif);
    QRCode.toDataURL(link, { width: 360, margin: 1, color: { dark: "#1B1430", light: "#FFFFFF" } }).then(setQr).catch(() => {});
    const t = setInterval(() => setAgora(Date.now()), 250);
    const r = setInterval(carregar, 30_000); // garantia, caso o tempo real caia
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [carregar, pelada.id, link]);

  // Tempo real
  const eventoId = dados?.eventoId;
  useEffect(() => {
    if (!eventoId) return;
    const sb = criarClienteSupabase();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const recarregar = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(carregar, 200);
    };
    const canal = sb
      .channel(`telao:${eventoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "partidas", filter: `evento_id=eq.${eventoId}` }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "lances" }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "sorteios", filter: `evento_id=eq.${eventoId}` }, recarregar)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      sb.removeChannel(canal);
    };
  }, [eventoId, carregar]);

  // Mantém a TV/celular aceso.
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

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const nome = useCallback((id: string | null) => (id && porId.get(id) ? nomeCurto(porId.get(id) as Membro) : "—"), [porId]);

  const cor = corLegivel(pelada.cor_banner || "#7444D6");
  const partida = dados?.partidas[dados.partidas.length - 1] ?? null;

  if (dados === undefined) return <div className="flex h-dvh items-center justify-center bg-noite text-2xl text-white">Carregando…</div>;
  if (!dados || !partida || !dados.sorteio) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-noite p-8 text-center text-white">
        <span className="font-display text-[7vmin] font-bold">{pelada.nome}</span>
        <span className="text-[3.5vmin] text-[#CFC7E0]">{!dados ? "Nenhuma pelada marcada pra agora." : "Esperando o primeiro jogo…"}</span>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="QR Code do ao vivo" className="h-[22vmin] w-[22vmin] rounded-2xl" />
        )}
      </div>
    );
  }

  const agoraServidor = agora + dif;
  const rolando = segundosRolando(partida, agoraServidor);
  const contaPraCima = pelada.regra_fim === "gols";
  const restante = partida.duracao_seg - rolando;
  const excedido = !contaPraCima && partida.status !== "aguardando" && restante < 0 ? -restante : 0;
  const relogio = contaPraCima ? formatarRelogio(rolando) : excedido ? `+${formatarRelogio(excedido)}` : formatarRelogio(restante);
  const status =
    partida.status === "encerrada" ? "ENCERRADO" : partida.status === "pausado" ? "PAUSADO" : partida.status === "rolando" ? (excedido ? "TEMPO ESGOTADO" : "AO VIVO") : "VAI COMEÇAR";
  const times = dados.sorteio.times;
  const fila = calcularFila(times.length, dados.partidas, pelada.regra_empate);
  const proximo = partida.status === "encerrada" ? fila.proximo : null;
  const esperando = fila.espera;

  const vitorias = new Map<number, number>();
  for (const p of dados.partidas.filter((x) => x.status === "encerrada")) {
    const v = p.vencedor ?? (p.placar_a > p.placar_b ? p.time_a : p.placar_b > p.placar_a ? p.time_b : null);
    if (v !== null) vitorias.set(v, (vitorias.get(v) ?? 0) + 1);
  }
  const gols = new Map<string, number>();
  for (const l of dados.lances) if (l.tipo === "gol" && l.autor_id) gols.set(l.autor_id, (gols.get(l.autor_id) ?? 0) + 1);
  const artilharia = [...gols].sort((a, b) => b[1] - a[1]).slice(0, 6);
  // GOL! na tela nos primeiros segundos depois de cada gol
  const ultimoGol = dados.lances.filter((l) => l.partida_id === partida.id).at(-1);
  const golFlash =
    ultimoGol && agoraServidor - new Date(ultimoGol.created_at).getTime() < 7000
      ? ultimoGol.tipo === "gol_contra"
        ? `Gol contra · ${NOMES_TIMES[ultimoGol.time]}`
        : `${nome(ultimoGol.autor_id)} · ${NOMES_TIMES[ultimoGol.time]}`
      : null;

  const lado = (t: number, placar: number, gk: string | null) => (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-[1vh]">
      <span className="rounded-full px-[2vmin] py-[0.6vmin] text-[3.6vmin] font-bold" style={{ background: CORES_TIMES[t] }}>
        {NOMES_TIMES[t]}
      </span>
      <span className="font-display text-[26vmin] leading-[0.9] font-bold tabular-nums">{placar}</span>
      <span className="line-clamp-2 text-center text-[2.2vmin] text-[#CFC7E0]">
        {[...(times[t] ?? [])].map((id) => nome(id)).join(" · ")}
        {gk && !(times[t] ?? []).includes(gk) ? ` · 🧤 ${nome(gk)}` : ""}
      </span>
    </div>
  );

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-noite p-[3vmin] text-white" style={{ backgroundImage: `radial-gradient(circle at 50% -20%, ${cor}aa 0%, transparent 60%)` }}>
      <header className="flex items-center justify-between">
        <span className="font-display text-[4.2vmin] font-bold">{pelada.nome}</span>
        <span className="flex items-center gap-[1.2vmin] rounded-full bg-alerta px-[2.4vmin] py-[0.8vmin] text-[2.8vmin] font-bold">
          <span className={`h-[1.6vmin] w-[1.6vmin] rounded-full bg-white ${partida.status === "rolando" ? "animate-pulse" : ""}`} />
          {status} · JOGO {partida.numero}
        </span>
      </header>

      <main className="flex flex-1 items-center gap-[3vmin]">
        <section className="flex flex-[2] flex-col items-center gap-[2vh]">
          <span className={`font-display text-[16vmin] leading-none font-bold tabular-nums ${excedido ? "text-alerta-suave" : ""}`}>{relogio}</span>
          <div className="flex w-full items-start gap-[2vmin]">
            {lado(partida.time_a, partida.placar_a, partida.goleiro_a)}
            <span className="pt-[12vmin] font-display text-[8vmin] text-white/30">×</span>
            {lado(partida.time_b, partida.placar_b, partida.goleiro_b)}
          </div>
        </section>

        <aside className="flex flex-1 flex-col gap-[2vmin] self-stretch py-[2vmin]">
          <div className="rounded-[2vmin] bg-white/10 p-[2vmin]">
            <div className="text-[2.2vmin] font-bold tracking-widest text-roxo-claro">ARTILHARIA</div>
            {artilharia.length ? (
              artilharia.map(([id, n], i) => (
                <div key={id} className="flex justify-between text-[3vmin]">
                  <span className="truncate">
                    {i === 0 ? "👟 " : ""}
                    {nome(id)}
                  </span>
                  <strong className="tabular-nums">{n}</strong>
                </div>
              ))
            ) : (
              <div className="text-[2.6vmin] text-white/50">Ninguém marcou ainda</div>
            )}
          </div>
          <div className="rounded-[2vmin] bg-white/10 p-[2vmin]">
            <div className="text-[2.2vmin] font-bold tracking-widest text-roxo-claro">VITÓRIAS HOJE</div>
            <div className="flex flex-wrap gap-x-[2vmin] text-[3vmin]">
              {times.map((_, t) => (
                <span key={t}>
                  <span style={{ color: CORES_TIMES[t] }}>●</span> {vitorias.get(t) ?? 0}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-[2vmin] bg-white/10 p-[2vmin] text-[3vmin]">
            <div className="text-[2.2vmin] font-bold tracking-widest text-roxo-claro">{proximo ? "PRÓXIMO JOGO" : "ESPERANDO"}</div>
            {proximo ? `${NOMES_TIMES[proximo[0]]} × ${NOMES_TIMES[proximo[1]]}` : esperando.length ? esperando.map((t) => NOMES_TIMES[t]).join(" · ") : "—"}
          </div>
          {qr && (
            <div className="mt-auto flex items-center gap-[2vmin]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR Code do ao vivo" className="h-[14vmin] w-[14vmin] rounded-[1.4vmin]" />
              <span className="text-[2.4vmin] text-[#CFC7E0]">Acompanhe no celular</span>
            </div>
          )}
        </aside>
      </main>

      <SomTelao
        golId={ultimoGol?.id ?? null}
        golFala={ultimoGol ? (ultimoGol.tipo === "gol_contra" ? "Gol contra!" : ultimoGol.autor_id ? `Gooool do ${nome(ultimoGol.autor_id)}!` : "Gooool!") : ""}
        tempoAcabou={partida.status === "rolando" && (!!excedido || (pelada.regra_fim !== "tempo" && Math.max(partida.placar_a, partida.placar_b) >= pelada.gols_limite))}
        partidaId={partida.id}
      />

      {golFlash && (
        <div className="telao-gol absolute inset-0 flex flex-col items-center justify-center gap-[2vh] bg-noite/90">
          <span className="font-display text-[24vmin] leading-none font-bold" style={{ color: cor === "#7444D6" ? "#C9B2FF" : "#fff" }}>
            GOOOL!
          </span>
          <span className="text-[6vmin] font-bold">{golFlash}</span>
        </div>
      )}
    </div>
  );
}
