"use client";
// Partida + ao vivo numa tela só. Serve pro admin (/bola-fora/jogo) e pro link público (/p/bola-fora/ao-vivo).
// O cronômetro NÃO conta em cada celular: o banco guarda início/pausas e cada aparelho calcula
// com a hora do servidor. Mudanças chegam pelo Supabase Realtime e a tela se atualiza sozinha.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { carregarElenco, nomeCurto, type Membro, type Pelada } from "@/lib/pelada";
import { eventoAtual, carregarPresencas, carregarSorteios, CORES_TIMES, NOMES_TIMES, type Evento, type Presenca, type SorteioSalvo } from "@/lib/evento";
import {
  acoesPendentes,
  calcularFila,
  enviarAcao,
  formatarRelogio,
  gravarPin,
  lerPin,
  medirDiferencaRelogio,
  reenviarPendentes,
  segundosRolando,
  textoRegra,
  type Lance,
  type Partida,
  type Pausa,
} from "@/lib/partida";
import Folha from "./Folha";
import Icone from "./Icone";
import { Carregando } from "./Topo";

const MOTIVOS = ["Machucou", "Bola longe", "Falta / discussão", "Outro"];

type Dados = {
  evento: Evento;
  sorteio: SorteioSalvo | null;
  partidas: Partida[];
  lances: Lance[];
  pausa: Pausa | null;
  presencas: Presenca[];
};

type FolhaAberta =
  | { tipo: "autor"; time: number; lado: "a" | "b" }
  | { tipo: "assist"; time: number; lado: "a" | "b"; autor: string | null; contra: boolean }
  | { tipo: "goleiro"; lado: "a" | "b" }
  | { tipo: "times" }
  | { tipo: "penaltis" }
  | { tipo: "pin"; depois: (() => void) | null }
  | null;

export default function TelaPartida({ pelada, publico }: { pelada: Pelada; publico: boolean }) {
  const { usuario, perfil, ehAdmin } = useSessao();
  const admin = !!usuario && ehAdmin(pelada.id);
  const [dados, setDados] = useState<Dados | null | undefined>(undefined);
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [dif, setDif] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());
  const [folha, setFolha] = useState<FolhaAberta>(null);
  const [pin, setPin] = useState<{ pin: string; nome: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [vendo, setVendo] = useState(1);
  const [pendentes, setPendentes] = useState(0);
  const [telao, setTelao] = useState(false);
  const [aba, setAba] = useState<"lances" | "artilharia">("lances");
  const [formPin, setFormPin] = useState({ pin: "", nome: "" });
  const [ocupado, setOcupado] = useState(false);
  const vibrou = useRef<string | null>(null);

  // ---------- Carregar ----------
  const carregar = useCallback(async () => {
    const ev = await eventoAtual(pelada.id);
    if (!ev) return setDados(null);
    const sb = criarClienteSupabase();
    const [sorteios, { data: ps }, presencas] = await Promise.all([
      carregarSorteios(ev.id),
      sb.from("partidas").select("*").eq("evento_id", ev.id).order("numero"),
      carregarPresencas(ev.id),
    ]);
    const partidas = (ps ?? []) as Partida[];
    const ids = partidas.map((p) => p.id);
    const atual = partidas[partidas.length - 1];
    const [{ data: ls }, { data: pa }] = await Promise.all([
      ids.length ? sb.from("lances").select("*").in("partida_id", ids).order("created_at") : Promise.resolve({ data: [] }),
      atual ? sb.from("pausas").select("*").eq("partida_id", atual.id).is("fim", null).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setDados({
      evento: ev,
      sorteio: sorteios.find((s) => s.oficial) ?? sorteios[sorteios.length - 1] ?? null,
      partidas,
      lances: (ls ?? []) as Lance[],
      pausa: (pa as Pausa) ?? null,
      presencas,
    });
  }, [pelada.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
    carregarElenco(pelada.id, false).then(setElenco); // nunca com notas: esta tela é pública
    medirDiferencaRelogio().then(setDif);
    setPin(lerPin(pelada.id));
    setPendentes(acoesPendentes());
  }, [carregar, pelada.id]);

  // Relógio da tela (4x por segundo pra não "pular" segundo).
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Tempo real: qualquer mudança no banco recarrega a tela.
  const eventoId = dados?.evento.id;
  useEffect(() => {
    if (!eventoId) return;
    const sb = criarClienteSupabase();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const recarregar = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(carregar, 150);
    };
    const canal = sb
      .channel(`partida:${eventoId}`, { config: { presence: { key: crypto.randomUUID() } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "partidas", filter: `evento_id=eq.${eventoId}` }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "lances" }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "pausas" }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "sorteios", filter: `evento_id=eq.${eventoId}` }, recarregar)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "eventos", filter: `id=eq.${eventoId}` }, recarregar)
      .on("presence", { event: "sync" }, () => setVendo(Math.max(1, Object.keys(canal.presenceState()).length)))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") canal.track({ desde: Date.now() });
      });
    // Se a tela volta do segundo plano, garante que está em dia.
    const voltou = () => document.visibilityState === "visible" && carregar();
    document.addEventListener("visibilitychange", voltou);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", voltou);
      sb.removeChannel(canal);
    };
  }, [eventoId, carregar]);

  // Internet voltou: reenvia o que ficou guardado.
  useEffect(() => {
    const tentar = async () => {
      if (!acoesPendentes()) return;
      setPendentes(await reenviarPendentes());
      carregar();
    };
    window.addEventListener("online", tentar);
    const t = setInterval(tentar, 10_000);
    return () => {
      window.removeEventListener("online", tentar);
      clearInterval(t);
    };
  }, [carregar]);

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const nome = useCallback((id: string | null) => (id ? (porId.get(id) ? nomeCurto(porId.get(id) as Membro) : "?") : "Sem autor"), [porId]);

  // ---------- Derivados ----------
  const partida = dados?.partidas[dados.partidas.length - 1] ?? null;
  const agoraServidor = agora + dif;
  const rolando = partida ? segundosRolando(partida, agoraServidor) : 0;
  const contaPraCima = pelada.regra_fim === "gols";
  const restante = partida ? partida.duracao_seg - rolando : pelada.minutos * 60;
  const fimDoTempo = !contaPraCima && !!partida && partida.status !== "aguardando" && restante <= 0;
  const qtdTimes = dados?.sorteio?.times.length ?? 0;
  const fila = useMemo(
    () => (dados ? calcularFila(qtdTimes, dados.partidas, pelada.regra_empate) : { proximo: null, espera: [] }),
    [dados, qtdTimes, pelada.regra_empate],
  );
  const pausadoHa = partida?.status === "pausado" && partida.pausado_em ? (agoraServidor - new Date(partida.pausado_em).getTime()) / 1000 : 0;
  const chegouGols =
    pelada.regra_fim !== "tempo" && partida && partida.status !== "encerrada" && Math.max(partida.placar_a, partida.placar_b) >= pelada.gols_limite;

  // Fim do tempo: só vibra (uma vez por partida).
  useEffect(() => {
    if (fimDoTempo && partida && partida.status === "rolando" && vibrou.current !== partida.id) {
      vibrou.current = partida.id;
      if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
    }
  }, [fimDoTempo, partida]);

  if (dados === undefined) return <Carregando />;

  // ---------- Ações ----------
  const podeMexer = admin || !!pin;

  function comPermissao(f: () => void) {
    if (podeMexer) f();
    else setFolha({ tipo: "pin", depois: f });
  }

  async function acao(nomeAcao: string, d: Record<string, unknown> = {}) {
    if (!partida) return;
    // Lê o PIN do aparelho na hora (pode ter acabado de ser digitado).
    const p = admin ? null : lerPin(pelada.id);
    const r = await enviarAcao({ partida: partida.id, acao: nomeAcao, dados: d, pin: p?.pin ?? null, nome: p?.nome ?? null });
    if (r.offline) {
      setPendentes(acoesPendentes());
      setAviso("Sem internet: guardei a ação e mando assim que voltar.");
    } else if (!r.ok) {
      if (/PIN/i.test(r.erro ?? "")) {
        gravarPin(pelada.id, null);
        setPin(null);
        setAviso("PIN errado. Pede o PIN do dia pro admin.");
      } else setAviso(r.erro ?? "Deu erro.");
    }
    carregar();
  }

  async function encerrarEChamar(vencedorPenaltis?: number) {
    if (!partida || !dados) return;
    const empate = partida.placar_a === partida.placar_b;
    if (empate && pelada.regra_empate === "penaltis" && vencedorPenaltis === undefined) {
      setFolha({ tipo: "penaltis" });
      return;
    }
    setOcupado(true);
    await acao("encerrar");
    if (vencedorPenaltis !== undefined) await acao("vencedor", { vencedor: vencedorPenaltis });
    // Calcula o próximo jogo com a partida já encerrada.
    const vencedor =
      vencedorPenaltis ?? (partida.placar_a > partida.placar_b ? partida.time_a : partida.placar_b > partida.placar_a ? partida.time_b : null);
    const atualizadas = dados.partidas.map((p) => (p.id === partida.id ? { ...p, status: "encerrada" as const, vencedor } : p));
    const prox = calcularFila(qtdTimes, atualizadas, pelada.regra_empate).proximo;
    if (prox) {
      const gk = dados.sorteio?.goleiros ?? [];
      const { error } = await criarClienteSupabase().rpc("nova_partida", {
        p_evento: dados.evento.id,
        p_time_a: prox[0],
        p_time_b: prox[1],
        p_goleiro_a: gk[prox[0]] ?? null,
        p_goleiro_b: gk[prox[1]] ?? null,
        p_pin: admin ? null : (lerPin(pelada.id)?.pin ?? null),
      });
      if (error) setAviso("Jogo encerrado, mas não deu pra chamar o próximo: " + error.message);
    }
    setOcupado(false);
    carregar();
  }

  function salvarPin(e: React.FormEvent) {
    e.preventDefault();
    const nomeFinal = (formPin.nome || (perfil ? perfil.apelido || perfil.nome : "")).trim();
    if (!formPin.pin.trim() || !nomeFinal) return;
    const v = { pin: formPin.pin.trim(), nome: nomeFinal };
    gravarPin(pelada.id, v);
    setPin(v);
    const depois = folha?.tipo === "pin" ? folha.depois : null;
    setFolha(null);
    // Executa a ação que a pessoa tinha tocado (agora com o PIN).
    if (depois) setTimeout(depois, 0);
  }

  // ---------- Sem jogo ----------
  if (!dados || !dados.sorteio || !partida) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">
          {!dados ? "Nenhuma pelada marcada pra agora." : !dados.sorteio ? "Os times ainda não foram sorteados." : "O primeiro jogo ainda não começou."}
        </p>
        {admin && !publico && (
          <Link href={`/${pelada.slug}/${dados?.sorteio ? "times" : "sortear"}`} className="flex h-14 items-center justify-center rounded-2xl bg-roxo text-lg font-bold text-white">
            {dados?.sorteio ? "Ver times e começar" : "Montar sorteio"}
          </Link>
        )}
      </div>
    );
  }

  const times = dados.sorteio.times;
  const lancesAtuais = dados.lances.filter((l) => l.partida_id === partida.id && !l.desfeito).reverse();
  const lados = [
    { lado: "a" as const, time: partida.time_a, placar: partida.placar_a, goleiro: partida.goleiro_a, linha: partida.goleiro_a_linha },
    { lado: "b" as const, time: partida.time_b, placar: partida.placar_b, goleiro: partida.goleiro_b, linha: partida.goleiro_b_linha },
  ];
  const statusTxt =
    partida.status === "encerrada"
      ? "ENCERRADO"
      : fimDoTempo
        ? "FIM DE JOGO"
        : partida.status === "rolando"
          ? "ROLANDO"
          : partida.status === "pausado"
            ? `PAUSADO${dados.pausa?.motivo ? " · " + dados.pausa.motivo.toUpperCase() : ""}`
            : "PRONTO PRA COMEÇAR";
  const relogio = formatarRelogio(contaPraCima ? rolando : restante);

  // Resumo do dia
  const encerradas = dados.partidas.filter((p) => p.status === "encerrada");
  const vitorias = new Map<number, number>();
  for (const p of encerradas) {
    const v = p.vencedor ?? (p.placar_a > p.placar_b ? p.time_a : p.placar_b > p.placar_a ? p.time_b : null);
    if (v !== null) vitorias.set(v, (vitorias.get(v) ?? 0) + 1);
  }
  const gols = new Map<string, { g: number; a: number }>();
  for (const l of dados.lances) {
    if (l.desfeito) continue;
    if (l.tipo === "gol" && l.autor_id) gols.set(l.autor_id, { g: (gols.get(l.autor_id)?.g ?? 0) + 1, a: gols.get(l.autor_id)?.a ?? 0 });
    if (l.assist_id) gols.set(l.assist_id, { g: gols.get(l.assist_id)?.g ?? 0, a: (gols.get(l.assist_id)?.a ?? 0) + 1 });
  }
  const artilharia = [...gols.entries()].sort((x, y) => y[1].g - x[1].g || y[1].a - x[1].a).slice(0, 10);

  // Jogadores que podem ter feito o gol: o time + quem completou (espera) + goleiro do time.
  function jogadoresDoTime(t: number, lado: "a" | "b") {
    const ids = [...(times[t] ?? [])];
    const gk = lado === "a" ? partida!.goleiro_a : partida!.goleiro_b;
    if (gk && !ids.includes(gk)) ids.push(gk);
    return ids;
  }
  const completaram = (dados.sorteio.espera ?? []).filter((id) => !times.flat().includes(id));
  const goleirosDia = dados.presencas.filter((p) => p.goleiro && p.status !== "saiu").map((p) => p.membro_id);

  // ---------- Telão ----------
  if (telao) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-[4vh] bg-noite p-6 text-white" onClick={() => { setTelao(false); document.exitFullscreen?.().catch(() => {}); }}>
        <span className="text-[3vh] font-semibold tracking-widest text-roxo-claro">{pelada.nome.toUpperCase()} · JOGO {partida.numero} · {statusTxt}</span>
        <span className={`font-display text-[28vmin] leading-none font-bold tabular-nums ${fimDoTempo ? "text-alerta-suave" : ""}`}>{relogio}</span>
        <div className="flex items-center gap-[6vw]">
          {lados.map((l, i) => (
            <div key={l.lado} className="flex items-center gap-[3vw]">
              {i === 1 && <span className="font-display text-[10vmin] text-white/40">×</span>}
              <div className="flex flex-col items-center">
                <span className="text-[4vmin] font-bold" style={{ color: CORES_TIMES[l.time] }}>{NOMES_TIMES[l.time]}</span>
                <span className="font-display text-[22vmin] leading-none font-bold tabular-nums">{l.placar}</span>
              </div>
            </div>
          ))}
        </div>
        {fila.espera.length > 0 && <span className="text-[3vh] text-[#CFC7E0]">Próximo: {NOMES_TIMES[fila.espera[0]]}</span>}
        <span className="text-sm text-white/40">Toque pra sair do telão</span>
      </div>
    );
  }

  // ---------- Tela ----------
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-alerta px-2.5 py-1 text-xs font-bold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> AO VIVO
          </span>
          <span className="text-apagado">
            {vendo} {vendo === 1 ? "pessoa vendo" : "pessoas vendo"}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            setTelao(true);
            document.documentElement.requestFullscreen?.().catch(() => {});
          }}
          className="flex items-center gap-1 rounded-full border border-borda bg-white px-3 py-1.5 font-semibold"
        >
          <Icone nome="tela" tamanho={16} /> Telão
        </button>
      </div>

      {pendentes > 0 && (
        <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm font-semibold text-alerta-escuro">
          {pendentes} {pendentes === 1 ? "ação esperando" : "ações esperando"} a internet voltar.
        </p>
      )}

      {/* Relógio */}
      <section className="flex flex-col items-center gap-2 rounded-3xl bg-noite px-4 pt-4 pb-5 text-white">
        <div className="flex w-full items-center justify-between text-xs font-semibold text-[#CFC7E0]">
          <span>JOGO {partida.numero}</span>
          <span>Termina por: {textoRegra(pelada)}</span>
        </div>
        <span className={`text-xs font-bold tracking-widest ${fimDoTempo ? "text-alerta-suave" : "text-roxo-claro"}`}>{statusTxt}</span>
        <span className={`font-display text-[84px] leading-none font-bold tabular-nums ${fimDoTempo ? "text-alerta-suave" : ""}`} aria-live="off">
          {relogio}
        </span>
        {pausadoHa > 60 && (
          <span className="rounded-lg bg-alerta px-3 py-1.5 text-center text-[13px] font-semibold">
            Jogo parado há {formatarRelogio(pausadoHa)}. Não esquece de voltar o tempo.
          </span>
        )}
        {partida.status !== "encerrada" && (
          <div className="mt-1 grid w-full grid-cols-[1fr_1.6fr_1fr] gap-2">
            <button
              type="button"
              onClick={() => comPermissao(() => confirm("Zerar o cronômetro deste jogo?") && acao("zerar"))}
              className="h-12 rounded-xl bg-white/10 text-sm font-semibold"
            >
              Zerar
            </button>
            <button
              type="button"
              onClick={() => comPermissao(() => acao(partida.status === "rolando" ? "pausar" : "iniciar"))}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-roxo text-base font-bold"
            >
              <Icone nome={partida.status === "rolando" ? "pausa" : "play"} tamanho={18} />
              {partida.status === "rolando" ? "Pausar" : partida.status === "pausado" ? "Voltar" : "Iniciar"}
            </button>
            <button type="button" onClick={() => comPermissao(() => acao("mais_minuto"))} className="h-12 rounded-xl bg-white/10 text-sm font-semibold">
              +1 min
            </button>
          </div>
        )}
        {partida.status === "pausado" && podeMexer && (
          <div className="flex w-full flex-col gap-1.5 pt-1">
            <span className="text-xs text-[#CFC7E0]">Motivo da pausa (opcional)</span>
            <div className="flex flex-wrap gap-1.5">
              {MOTIVOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => acao("motivo_pausa", { motivo: dados.pausa?.motivo === m ? "" : m })}
                  className={`h-8 rounded-full border px-3 text-[13px] font-semibold ${dados.pausa?.motivo === m ? "border-roxo bg-roxo" : "border-white/20"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {chegouGols && (
        <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm font-semibold text-alerta-escuro">
          Chegou a {pelada.gols_limite} gols. Pode encerrar o jogo.
        </p>
      )}

      {/* Placar */}
      <section className="grid grid-cols-2 gap-2">
        {lados.map((l) => (
          <div key={l.lado} className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-3">
            <span className="text-center text-sm font-bold" style={{ color: CORES_TIMES[l.time] }}>
              {NOMES_TIMES[l.time]}
            </span>
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label={`Tirar gol do ${NOMES_TIMES[l.time]}`}
                onClick={() => comPermissao(() => acao("menos", { time: l.time }))}
                disabled={partida.status === "encerrada" || l.placar === 0}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-borda text-xl disabled:opacity-30"
              >
                −
              </button>
              <span className="font-display text-5xl font-bold tabular-nums">{l.placar}</span>
              <span className="w-11" />
            </div>
            <button
              type="button"
              disabled={partida.status === "encerrada"}
              onClick={() => comPermissao(() => setFolha({ tipo: "autor", time: l.time, lado: l.lado }))}
              className="h-12 rounded-xl font-bold text-white disabled:opacity-40"
              style={{ background: CORES_TIMES[l.time] }}
            >
              + Gol
            </button>
            <button type="button" onClick={() => comPermissao(() => setFolha({ tipo: "goleiro", lado: l.lado }))} className="truncate text-center text-[13px] text-apagado">
              Gol: {l.goleiro ? `${nome(l.goleiro)}${l.linha ? " (de linha)" : ""}` : "sem goleiro"} ✎
            </button>
          </div>
        ))}
      </section>

      {/* Lances e artilharia */}
      <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-3 text-sm font-bold">
            <button type="button" onClick={() => setAba("lances")} className={aba === "lances" ? "text-tinta" : "text-apagado"}>
              LANCES
            </button>
            <button type="button" onClick={() => setAba("artilharia")} className={aba === "artilharia" ? "text-tinta" : "text-apagado"}>
              ARTILHARIA HOJE
            </button>
          </div>
          {aba === "lances" && lancesAtuais.length > 0 && partida.status !== "encerrada" && (
            <button type="button" onClick={() => comPermissao(() => acao("desfazer"))} className="flex items-center gap-1 text-sm font-semibold text-roxo">
              <Icone nome="desfazer" tamanho={16} /> Desfazer último
            </button>
          )}
        </div>
        {aba === "lances" &&
          (lancesAtuais.length ? (
            lancesAtuais.map((l) => (
              <div key={l.id} className="flex items-center gap-3 border-t border-borda pt-2 text-sm">
                <span className="h-8 w-1.5 rounded-full" style={{ background: CORES_TIMES[l.time] }} />
                <span className="flex flex-1 flex-col">
                  <span className={`font-semibold ${!l.autor_id && l.tipo === "gol" ? "text-alerta-escuro" : ""}`}>
                    {l.tipo === "gol_contra" ? `Gol contra${l.autor_id ? ` (${nome(l.autor_id)})` : ""}` : nome(l.autor_id)}
                    {l.assist_id && <span className="font-normal text-apagado"> · assist. {nome(l.assist_id)}</span>}
                  </span>
                  <span className="text-xs text-apagado">
                    {NOMES_TIMES[l.time]} · {l.minuto ?? "?"}&apos;{l.criado_por_nome ? ` · por ${l.criado_por_nome}` : ""}
                  </span>
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-apagado">Nenhum gol neste jogo ainda.</p>
          ))}
        {aba === "artilharia" &&
          (artilharia.length ? (
            artilharia.map(([id, v], i) => (
              <div key={id} className="flex items-center gap-3 border-t border-borda pt-2 text-sm">
                <span className="w-5 font-display font-bold text-apagado">{i + 1}</span>
                <span className="flex-1 font-semibold">{nome(id)}</span>
                <span className="tabular-nums">
                  {v.g} {v.g === 1 ? "gol" : "gols"}
                  {v.a ? <span className="text-apagado"> · {v.a} assist.</span> : null}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-apagado">Ainda sem gols hoje.</p>
          ))}
      </section>

      {/* Fila */}
      <section className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-2xl border border-borda bg-white p-3">
          <div className="text-[11px] font-bold tracking-wider text-apagado">EM CAMPO</div>
          <div className="font-semibold">
            {NOMES_TIMES[partida.time_a].replace("Time ", "T")} × {NOMES_TIMES[partida.time_b].replace("Time ", "T")}
          </div>
        </div>
        <div className="rounded-2xl border border-borda bg-white p-3">
          <div className="text-[11px] font-bold tracking-wider text-apagado">PRÓXIMO</div>
          <div className="font-semibold">{fila.espera.length ? NOMES_TIMES[fila.espera[0]] : "—"}</div>
        </div>
        <div className="rounded-2xl border border-borda bg-white p-3">
          <div className="text-[11px] font-bold tracking-wider text-apagado">VITÓRIAS HOJE</div>
          <div className="font-semibold">
            {[...vitorias.entries()].sort((a, b) => b[1] - a[1]).map(([t, v]) => `T${t + 1}: ${v}`).join(" · ") || "—"}
          </div>
        </div>
      </section>

      {podeMexer && (
        <div className="flex flex-col gap-2">
          {partida.status !== "encerrada" ? (
            <button type="button" disabled={ocupado} onClick={() => comPermissao(() => encerrarEChamar())} className="h-14 rounded-2xl bg-roxo text-lg font-bold text-white disabled:opacity-50">
              {ocupado ? "Chamando…" : "Encerrar jogo e chamar o próximo"}
            </button>
          ) : (
            fila.proximo && (
              <button type="button" disabled={ocupado} onClick={() => encerrarEChamar()} className="h-14 rounded-2xl bg-roxo text-lg font-bold text-white disabled:opacity-50">
                Chamar o próximo jogo
              </button>
            )
          )}
          <button type="button" onClick={() => comPermissao(() => setFolha({ tipo: "times" }))} className="h-11 rounded-xl border border-borda bg-white text-sm font-semibold">
            Trocar os times em campo
          </button>
        </div>
      )}

      {!podeMexer && (
        <button type="button" onClick={() => setFolha({ tipo: "pin", depois: null })} className="h-12 rounded-xl border border-roxo bg-white font-semibold text-roxo">
          Vou marcar o placar (tenho o PIN)
        </button>
      )}
      {!admin && pin && (
        <p className="text-center text-xs text-apagado">
          Marcando como {pin.nome}.{" "}
          <button type="button" className="underline" onClick={() => { gravarPin(pelada.id, null); setPin(null); }}>
            Sair
          </button>
        </p>
      )}

      {aviso && (
        <p role="status" onClick={() => setAviso(null)} className="rounded-xl bg-noite px-3 py-2 text-sm text-white">
          {aviso}
        </p>
      )}

      {/* ---------- Folhas ---------- */}
      <Folha
        aberta={folha?.tipo === "autor" || folha?.tipo === "assist"}
        titulo={folha?.tipo === "autor" ? `Gol do ${NOMES_TIMES[folha.time]}. Quem fez?` : "Assistência? (opcional)"}
        aoFechar={() => setFolha(null)}
      >
        {folha?.tipo === "autor" && (
          <div className="grid grid-cols-2 gap-2">
            {jogadoresDoTime(folha.time, folha.lado).map((id) => (
              <button key={id} type="button" onClick={() => setFolha({ tipo: "assist", time: folha.time, lado: folha.lado, autor: id, contra: false })} className="h-12 rounded-xl border border-borda font-semibold">
                {nome(id)}
              </button>
            ))}
            {completaram.map((id) => (
              <button key={id} type="button" onClick={() => setFolha({ tipo: "assist", time: folha.time, lado: folha.lado, autor: id, contra: false })} className="h-12 rounded-xl border border-dashed border-borda font-semibold">
                {nome(id)} <span className="text-xs font-normal text-apagado">(completou)</span>
              </button>
            ))}
            <button type="button" onClick={() => setFolha({ tipo: "assist", time: folha.time, lado: folha.lado, autor: null, contra: false })} className="h-12 rounded-xl bg-alerta-suave font-semibold text-alerta-escuro">
              Sem autor (marcar depois)
            </button>
            <button
              type="button"
              onClick={() => {
                const t = folha.time;
                setFolha(null);
                acao("gol_contra", { time: t });
              }}
              className="h-12 rounded-xl bg-fundo font-semibold"
            >
              Gol contra
            </button>
          </div>
        )}
        {folha?.tipo === "assist" && (
          <div className="grid grid-cols-2 gap-2">
            {[...jogadoresDoTime(folha.time, folha.lado), ...completaram]
              .filter((id) => id !== folha.autor)
              .map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    const f = folha;
                    setFolha(null);
                    acao("gol", { time: f.time, autor: f.autor, assist: id });
                  }}
                  className="h-12 rounded-xl border border-borda font-semibold"
                >
                  {nome(id)}
                </button>
              ))}
            <button
              type="button"
              onClick={() => {
                const f = folha;
                setFolha(null);
                acao("gol", { time: f.time, autor: f.autor });
              }}
              className="col-span-2 h-12 rounded-xl bg-roxo font-semibold text-white"
            >
              Sem assistência
            </button>
          </div>
        )}
      </Folha>

      <Folha aberta={folha?.tipo === "goleiro"} titulo="Quem está no gol?" aoFechar={() => setFolha(null)}>
        {folha?.tipo === "goleiro" && (
          <div className="flex flex-col gap-3">
            {goleirosDia.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {goleirosDia.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setFolha(null);
                      acao("goleiros", { [`goleiro_${folha.lado}`]: id, [`goleiro_${folha.lado}_linha`]: false });
                    }}
                    className="h-12 rounded-xl bg-noite font-semibold text-white"
                  >
                    🧤 {nome(id)}
                  </button>
                ))}
              </div>
            )}
            <span className="text-[13px] font-semibold text-apagado">Jogador de linha no gol (fica fora da disputa de goleiros)</span>
            <div className="grid grid-cols-2 gap-2">
              {(times[folha.lado === "a" ? partida.time_a : partida.time_b] ?? []).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setFolha(null);
                    acao("goleiros", { [`goleiro_${folha.lado}`]: id, [`goleiro_${folha.lado}_linha`]: true });
                  }}
                  className="h-11 rounded-xl border border-borda font-semibold"
                >
                  {nome(id)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setFolha(null);
                acao("goleiros", { [`goleiro_${folha.lado}`]: "", [`goleiro_${folha.lado}_linha`]: false });
              }}
              className="h-11 rounded-xl bg-fundo font-semibold"
            >
              Sem goleiro
            </button>
          </div>
        )}
      </Folha>

      <Folha aberta={folha?.tipo === "times"} titulo="Quais times estão jogando?" aoFechar={() => setFolha(null)}>
        <EscolherTimes
          qtd={times.length}
          inicial={[partida.time_a, partida.time_b]}
          aoSalvar={(a, b) => {
            setFolha(null);
            acao("times", { time_a: a, time_b: b });
          }}
        />
      </Folha>

      <Folha aberta={folha?.tipo === "penaltis"} titulo="Empatou. Quem ganhou nos pênaltis?" aoFechar={() => setFolha(null)}>
        <div className="grid grid-cols-2 gap-2">
          {lados.map((l) => (
            <button
              key={l.lado}
              type="button"
              onClick={() => {
                setFolha(null);
                encerrarEChamar(l.time);
              }}
              className="h-14 rounded-xl font-bold text-white"
              style={{ background: CORES_TIMES[l.time] }}
            >
              {NOMES_TIMES[l.time]}
            </button>
          ))}
        </div>
      </Folha>

      <Folha aberta={folha?.tipo === "pin"} titulo="Marcar o placar" aoFechar={() => setFolha(null)}>
        <form onSubmit={salvarPin} className="flex flex-col gap-3">
          <p className="text-sm text-apagado">Pra mexer no placar, digita o PIN do dia que o admin mandou no grupo.</p>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            PIN do dia
            <input
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={formPin.pin}
              onChange={(e) => setFormPin({ ...formPin, pin: e.target.value.replace(/\D/g, "") })}
              className="h-12 rounded-xl border border-borda px-3 text-center font-display text-2xl tracking-[0.4em]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Seu nome (aparece como “por Fulano”)
            <input
              value={formPin.nome || (perfil ? perfil.apelido || perfil.nome : "")}
              onChange={(e) => setFormPin({ ...formPin, nome: e.target.value })}
              className="h-12 rounded-xl border border-borda px-3"
            />
          </label>
          <button type="submit" className="h-12 rounded-xl bg-roxo font-semibold text-white">
            Entrar no placar
          </button>
        </form>
      </Folha>
    </div>
  );
}

function EscolherTimes({ qtd, inicial, aoSalvar }: { qtd: number; inicial: [number, number]; aoSalvar: (a: number, b: number) => void }) {
  const [sel, setSel] = useState<number[]>(inicial);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-apagado">Toca em 2 times.</p>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: qtd }, (_, t) => (
          <button
            key={t}
            type="button"
            aria-pressed={sel.includes(t)}
            onClick={() => setSel(sel.includes(t) ? sel.filter((x) => x !== t) : [...sel, t].slice(-2))}
            className={`h-12 rounded-xl border-2 font-bold ${sel.includes(t) ? "text-white" : "border-borda"}`}
            style={sel.includes(t) ? { background: CORES_TIMES[t], borderColor: CORES_TIMES[t] } : undefined}
          >
            {NOMES_TIMES[t]}
          </button>
        ))}
      </div>
      <button type="button" disabled={sel.length !== 2} onClick={() => aoSalvar(sel[0], sel[1])} className="h-12 rounded-xl bg-roxo font-semibold text-white disabled:opacity-40">
        Salvar
      </button>
    </div>
  );
}
