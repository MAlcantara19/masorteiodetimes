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
  guardarCache,
  lerCache,
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
import { avisarPush } from "@/lib/push-cliente";
import { linkZap, textoDoDia, textoDoJogo } from "@/lib/resumo-zap";
import CraqueDaPartida, { carregarCraques, craquesPorJogo } from "./CraqueDaPartida";
import Folha from "./Folha";
import Icone from "./Icone";
import { Carregando } from "./Topo";

const MOTIVOS = ["Machucou", "Bola longe", "Falta / discussão", "Outro"];

type Dados = {
  evento: Evento;
  sorteio: SorteioSalvo | null;
  partidas: Partida[];
  lances: Lance[];
  pausa: Pausa | null; // a pausa em aberto (se o jogo está parado)
  pausas: Pausa[]; // todas as pausas do jogo em campo
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
  const { usuario, perfil, ehAdmin, vinculos } = useSessao();
  const admin = !!usuario && ehAdmin(pelada.id);
  // Membro logado da pelada mexe no cronômetro/placar sem PIN (SQL 0003).
  const membro = admin || vinculos.some((v) => v.pelada.id === pelada.id);
  const [dados, setDados] = useState<Dados | null | undefined>(undefined);
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [dif, setDif] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());
  const [folha, setFolha] = useState<FolhaAberta>(null);
  const [pin, setPin] = useState<{ pin: string; nome: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [vendo, setVendo] = useState<{ nome: string; tipo: "admin" | "membro" | "pin" | "visitante" }[]>([]);
  const [verQuem, setVerQuem] = useState(false);
  // Quem eu sou pra lista "quem está vendo" (lido na hora de entrar no canal).
  const canalRef = useRef<{ track: (x: object) => unknown } | null>(null);
  const quemSou = useRef<{ nome: string; tipo: "admin" | "membro" | "pin" | "visitante" }>({ nome: "Visitante", tipo: "visitante" });
  const [pendentes, setPendentes] = useState(0);
  const [aba, setAba] = useState<"lances" | "artilharia">("lances");
  const [formPin, setFormPin] = useState({ pin: "", nome: "" });
  const [ocupado, setOcupado] = useState(false);
  const [zapJogo, setZapJogo] = useState<string | null>(null); // jogo que acabou de encerrar (pra mandar no grupo)
  const [craques, setCraques] = useState<Map<string, string[]>>(new Map()); // craque de cada jogo (votação)
  const vibrou = useRef<string | null>(null);
  const ultimaAcao = useRef<{ chave: string; em: number }>({ chave: "", em: 0 });

  // ---------- Carregar ----------
  const carregar = useCallback(async () => {
    const chaveCache = `partida:${pelada.id}`;
    const doCache = () => setDados((d) => (d === undefined ? (lerCache<Dados>(chaveCache) ?? null) : d));
    // Com ações esperando a internet, a tela confia no que está no aparelho.
    if (acoesPendentes() > 0) return doCache();
    try {
      const ev = await eventoAtual(pelada.id, true);
      if (!ev) return setDados(null);
      const sb = criarClienteSupabase();
      const [sorteios, { data: ps, error: e1 }, presencas] = await Promise.all([
        carregarSorteios(ev.id),
        sb.from("partidas").select("*").eq("evento_id", ev.id).order("numero"),
        carregarPresencas(ev.id),
      ]);
      if (e1) throw new Error(e1.message);
      const partidas = (ps ?? []) as Partida[];
      const ids = partidas.map((p) => p.id);
      const atual = partidas[partidas.length - 1];
      const [{ data: ls, error: e2 }, { data: pa }] = await Promise.all([
        ids.length ? sb.from("lances").select("*").in("partida_id", ids).order("created_at") : Promise.resolve({ data: [], error: null }),
        atual ? sb.from("pausas").select("*").eq("partida_id", atual.id).order("inicio") : Promise.resolve({ data: [] }),
      ]);
      if (e2) throw new Error(e2.message);
      if (acoesPendentes() > 0) return; // ficou sem internet no meio: não apaga o que foi marcado
      const novo: Dados = {
        evento: ev,
        sorteio: sorteios.find((s) => s.oficial) ?? sorteios[sorteios.length - 1] ?? null,
        partidas,
        lances: (ls ?? []) as Lance[],
        pausa: ((pa ?? []) as Pausa[]).find((x) => !x.fim) ?? null,
        pausas: (pa ?? []) as Pausa[],
        presencas,
      };
      setDados(novo);
      guardarCache(chaveCache, novo);
      carregarCraques(ev.id).then((v) => setCraques(craquesPorJogo(v)));
    } catch {
      doCache(); // sem internet: fica com o que já tem (ou com a última foto guardada)
    }
  }, [pelada.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
    // Nunca com notas: esta tela é pública. Sem internet, usa o elenco guardado.
    const cacheElenco = lerCache<Membro[]>(`elenco:${pelada.id}`);
    if (cacheElenco) setElenco(cacheElenco);
    carregarElenco(pelada.id, false).then((el) => {
      if (!el.length) return;
      setElenco(el);
      guardarCache(`elenco:${pelada.id}`, el);
    });
    medirDiferencaRelogio().then(setDif);
    setPin(lerPin(pelada.id));
    setPendentes(acoesPendentes());
  }, [carregar, pelada.id]);

  // Relógio da tela (4x por segundo pra não "pular" segundo).
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Tempo real: mudanças deste dia (e do jogo em campo) recarregam a tela.
  // Os filtros evitam recarregar por causa de gols de outras peladas.
  const eventoId = dados?.evento.id;
  const partidaAtualId = dados?.partidas[dados.partidas.length - 1]?.id ?? null;
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
      .on("postgres_changes", { event: "*", schema: "public", table: "lances", filter: `partida_id=eq.${partidaAtualId ?? "00000000-0000-0000-0000-000000000000"}` }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "pausas", filter: `partida_id=eq.${partidaAtualId ?? "00000000-0000-0000-0000-000000000000"}` }, recarregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "sorteios", filter: `evento_id=eq.${eventoId}` }, recarregar)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "eventos", filter: `id=eq.${eventoId}` }, recarregar)
      .on("presence", { event: "sync" }, () => {
        const estado = canal.presenceState() as Record<string, { nome?: string; tipo?: string }[]>;
        setVendo(
          Object.values(estado).map((lista) => ({
            nome: lista[0]?.nome || "Visitante",
            tipo: (lista[0]?.tipo as "admin" | "membro" | "pin" | "visitante") || "visitante",
          })),
        );
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") canal.track({ ...quemSou.current, desde: Date.now() });
      });
    canalRef.current = canal;
    // Se a tela volta do segundo plano, garante que está em dia.
    const voltou = () => document.visibilityState === "visible" && carregar();
    document.addEventListener("visibilitychange", voltou);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", voltou);
      canalRef.current = null;
      sb.removeChannel(canal);
    };
  }, [eventoId, partidaAtualId, carregar]);

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

  useEffect(() => {
    const nomePerfil = perfil ? perfil.apelido || perfil.nome : null;
    quemSou.current = admin
      ? { nome: nomePerfil || "Admin", tipo: "admin" }
      : membro && nomePerfil
        ? { nome: nomePerfil, tipo: "membro" }
        : pin
          ? { nome: pin.nome, tipo: "pin" }
          : nomePerfil
            ? { nome: nomePerfil, tipo: "visitante" }
            : { nome: "Visitante", tipo: "visitante" };
    // Já está no canal? Atualiza o nome que os outros veem.
    canalRef.current?.track({ ...quemSou.current, desde: Date.now() });
  }, [perfil, admin, membro, pin]);

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

  // Mantém a tela do celular acesa enquanto tem jogo (não apaga no meio da partida).
  const jogoAberto = !!partida && partida.status !== "encerrada";
  useEffect(() => {
    if (!jogoAberto || !("wakeLock" in navigator)) return;
    let trava: { release: () => Promise<void> } | null = null;
    const pedir = () => {
      if (document.visibilityState !== "visible") return;
      (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock
        .request("screen")
        .then((t) => (trava = t))
        .catch(() => {});
    };
    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      document.removeEventListener("visibilitychange", pedir);
      trava?.release().catch(() => {});
    };
  }, [jogoAberto]);

  // Fim do tempo: só vibra (uma vez por partida).
  useEffect(() => {
    if (fimDoTempo && partida && partida.status === "rolando" && vibrou.current !== partida.id) {
      vibrou.current = partida.id;
      if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
    }
  }, [fimDoTempo, partida]);

  if (dados === undefined) return <Carregando />;

  // ---------- Ações ----------
  const podeMexer = membro || !!pin;

  function comPermissao(f: () => void) {
    if (podeMexer) f();
    else setFolha({ tipo: "pin", depois: f });
  }

  // Mostra o resultado na hora, antes do banco responder (depois o banco confirma).
  // Sem internet, é isso que fica na tela até a internet voltar.
  function otimista(nomeAcao: string, d: Record<string, unknown>, partidaId: string) {
    const agora = Date.now() + dif;
    const agoraIso = new Date(agora).toISOString();
    setDados((atual) => {
      if (!atual) return atual;
      const orig = atual.partidas.find((x) => x.id === partidaId);
      if (!orig) return atual;
      const p = { ...orig };
      let lances = atual.lances;
      const desfazerLance = (filtro: (l: Lance) => boolean) => {
        const ultimo = [...lances].reverse().find((l) => l.partida_id === p.id && !l.desfeito && filtro(l));
        if (!ultimo) return null;
        lances = lances.map((l) => (l.id === ultimo.id ? { ...l, desfeito: true } : l));
        return ultimo;
      };
      const tirar = (time: number) => {
        if (time === p.time_a) p.placar_a = Math.max(0, p.placar_a - 1);
        else if (time === p.time_b) p.placar_b = Math.max(0, p.placar_b - 1);
      };
      if (nomeAcao === "gol" || nomeAcao === "gol_contra") {
        if (d.time === p.time_a) p.placar_a++;
        else if (d.time === p.time_b) p.placar_b++;
        lances = [
          ...lances,
          {
            id: `local-${crypto.randomUUID()}`,
            partida_id: p.id,
            tipo: nomeAcao,
            time: d.time as number,
            autor_id: (d.autor as string) || null,
            assist_id: nomeAcao === "gol" ? (d.assist as string) || null : null,
            minuto: Math.max(1, Math.ceil(segundosRolando(p, agora) / 60)),
            criado_por_nome: null,
            desfeito: false,
            created_at: agoraIso,
          },
        ];
      } else if (nomeAcao === "menos") {
        desfazerLance((l) => l.time === d.time);
        tirar(d.time as number);
      } else if (nomeAcao === "desfazer") {
        const l = desfazerLance(() => true);
        if (l) tirar(l.time);
      } else if (nomeAcao === "pausar" && p.status === "rolando") {
        p.status = "pausado";
        p.pausado_em = agoraIso;
      } else if (nomeAcao === "iniciar" && p.status === "aguardando") {
        p.status = "rolando";
        p.inicio_em = agoraIso;
      } else if (nomeAcao === "iniciar" && p.status === "pausado" && p.pausado_em) {
        p.segundos_pausados += Math.round((agora - new Date(p.pausado_em).getTime()) / 1000);
        p.status = "rolando";
        p.pausado_em = null;
      } else if (nomeAcao === "encerrar" && p.status !== "encerrada") {
        if (p.pausado_em) p.segundos_pausados += Math.round((agora - new Date(p.pausado_em).getTime()) / 1000);
        p.pausado_em = null;
        p.inicio_em = p.inicio_em ?? agoraIso;
        p.encerrada_em = agoraIso;
        p.status = "encerrada";
        p.vencedor = p.placar_a > p.placar_b ? p.time_a : p.placar_b > p.placar_a ? p.time_b : null;
      } else if (nomeAcao === "vencedor") {
        p.vencedor = d.vencedor === "" || d.vencedor === null || d.vencedor === undefined ? null : Number(d.vencedor);
      } else if (nomeAcao === "mais_minuto") {
        p.duracao_seg += Number(d.segundos ?? 60);
      } else if (nomeAcao === "times") {
        p.time_a = d.time_a as number;
        p.time_b = d.time_b as number;
      } else if (nomeAcao === "goleiros") {
        if ("goleiro_a" in d) p.goleiro_a = (d.goleiro_a as string) || null;
        if ("goleiro_b" in d) p.goleiro_b = (d.goleiro_b as string) || null;
        if ("goleiro_a_linha" in d) p.goleiro_a_linha = !!d.goleiro_a_linha;
        if ("goleiro_b_linha" in d) p.goleiro_b_linha = !!d.goleiro_b_linha;
      } else if (nomeAcao === "motivo_pausa" && atual.pausa) {
        const motivo = (d.motivo as string) || null;
        const pausa = { ...atual.pausa, motivo };
        return { ...atual, pausa, pausas: atual.pausas.map((x) => (x.id === pausa.id ? pausa : x)) };
      } else return atual;
      return { ...atual, partidas: atual.partidas.map((x) => (x.id === p.id ? p : x)), lances };
    });
  }

  async function acao(nomeAcao: string, d: Record<string, unknown> = {}) {
    if (!partida) return;
    // Evita gol duplicado quando o dedo encosta duas vezes sem querer.
    const chave = nomeAcao + JSON.stringify(d);
    if (ultimaAcao.current.chave === chave && Date.now() - ultimaAcao.current.em < 1200) return;
    ultimaAcao.current = { chave, em: Date.now() };
    otimista(nomeAcao, d, partida.id);
    if ((nomeAcao === "gol" || nomeAcao === "gol_contra") && navigator.vibrate) navigator.vibrate(40);
    // Lê o PIN do aparelho na hora (pode ter acabado de ser digitado).
    const p = membro ? null : lerPin(pelada.id);
    // "em" = a hora em que a ação aconteceu (se for enviada depois, o banco usa essa hora; SQL 0005).
    const comHora = { ...d, em: new Date(Date.now() + dif).toISOString() };
    const r = await enviarAcao({ partida: partida.id, acao: nomeAcao, dados: comHora, pin: p?.pin ?? null, nome: p?.nome ?? null });
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
    setZapJogo(partida.id);
    if (vencedorPenaltis !== undefined) await acao("vencedor", { vencedor: vencedorPenaltis });
    // Calcula o próximo jogo com a partida já encerrada.
    const vencedor =
      vencedorPenaltis ?? (partida.placar_a > partida.placar_b ? partida.time_a : partida.placar_b > partida.placar_a ? partida.time_b : null);
    const atualizadas = dados.partidas.map((p) => (p.id === partida.id ? { ...p, status: "encerrada" as const, vencedor } : p));
    const prox = calcularFila(qtdTimes, atualizadas, pelada.regra_empate).proximo;
    if (prox) {
      const gk = dados.sorteio?.goleiros ?? [];
      const novoId = crypto.randomUUID();
      const params = {
        p_evento: dados.evento.id,
        p_time_a: prox[0],
        p_time_b: prox[1],
        p_goleiro_a: gk[prox[0]] ?? null,
        p_goleiro_b: gk[prox[1]] ?? null,
        p_id: novoId,
      };
      const pinAgora = membro ? null : (lerPin(pelada.id)?.pin ?? null);
      const r = await enviarAcao({ partida: novoId, acao: "__nova", dados: params, pin: pinAgora, nome: null });
      if (r.offline) {
        // Sem internet: o próximo jogo já aparece na tela e vai pro banco quando a internet voltar.
        setPendentes(acoesPendentes());
        setDados((atual) =>
          atual
            ? {
                ...atual,
                partidas: [
                  ...atual.partidas,
                  {
                    id: novoId,
                    evento_id: atual.evento.id,
                    numero: Math.max(0, ...atual.partidas.map((x) => x.numero)) + 1,
                    time_a: prox[0],
                    time_b: prox[1],
                    goleiro_a: params.p_goleiro_a,
                    goleiro_b: params.p_goleiro_b,
                    goleiro_a_linha: false,
                    goleiro_b_linha: false,
                    duracao_seg: pelada.minutos * 60,
                    inicio_em: null,
                    pausado_em: null,
                    segundos_pausados: 0,
                    encerrada_em: null,
                    status: "aguardando",
                    placar_a: 0,
                    placar_b: 0,
                    vencedor: null,
                  },
                ],
                pausa: null,
                pausas: [],
              }
            : atual,
        );
      } else if (!r.ok) setAviso("Jogo encerrado, mas não deu pra chamar o próximo: " + r.erro);
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
        <Link href={`/cronometro?min=${pelada.minutos}&gols=${pelada.regra_fim === "tempo" ? 0 : pelada.gols_limite}`} className="flex h-12 items-center justify-center rounded-2xl border border-borda bg-white font-semibold">
          ⏱️ Usar só o cronômetro (sem internet)
        </Link>
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
      : partida.status === "pausado"
        ? `PAUSADO${dados.pausa?.motivo ? " · " + dados.pausa.motivo.toUpperCase() : ""}`
        : fimDoTempo
          ? "TEMPO ESGOTADO · CONTANDO O EXCEDIDO"
          : partida.status === "rolando"
            ? "ROLANDO"
            : "PRONTO PRA COMEÇAR";
  // Passou do tempo: não para, conta o tempo excedido pra cima (+0:01, +0:02…).
  const excedido = !contaPraCima && partida.status !== "aguardando" && restante < 0 ? -restante : 0;
  const relogio = contaPraCima ? formatarRelogio(rolando) : excedido ? `+${formatarRelogio(excedido)}` : formatarRelogio(restante);
  // Tempo real (relógio de parede desde o apito) × bola rolando × parado.
  const fimReal = partida.encerrada_em ? new Date(partida.encerrada_em).getTime() : agoraServidor;
  const tempoReal = partida.inicio_em ? Math.max(0, (fimReal - new Date(partida.inicio_em).getTime()) / 1000) : 0;
  const tempoParado = Math.max(0, tempoReal - rolando);
  const pausasTxt = dados.pausas.map((pz) => {
    const fimPz = pz.fim ? new Date(pz.fim).getTime() : agoraServidor;
    return { motivo: pz.motivo ?? "sem motivo", seg: Math.max(0, (fimPz - new Date(pz.inicio).getTime()) / 1000), aberta: !pz.fim };
  });

  // Resumo do dia
  const encerradas = dados.partidas.filter((p) => p.status === "encerrada");
  const ultimaEncerrada = encerradas[encerradas.length - 1] ?? null;
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

  // Mensagens prontas pro grupo do Zap
  const linkAoVivo = `${typeof window !== "undefined" ? window.location.origin : ""}/p/${pelada.slug}/ao-vivo`;
  const proximoDe = (p: Partida): [number, number] | null => {
    if (p.id === partida.id) return fila.proximo;
    const seguinte = dados.partidas.find((x) => x.numero === p.numero + 1);
    return seguinte ? [seguinte.time_a, seguinte.time_b] : null;
  };
  const zapDoJogo = (p: Partida) =>
    linkZap(
      textoDoJogo({
        pelada: pelada.nome,
        partida: p,
        partidas: dados.partidas.filter((x) => x.numero <= p.numero),
        lances: dados.lances.filter((l) => dados.partidas.some((x) => x.id === l.partida_id && x.numero <= p.numero)),
        nome,
        proximo: proximoDe(p),
        link: `${linkAoVivo}?jogo=${p.numero}`,
      }),
    );
  const jogoRecente = zapJogo ? dados.partidas.find((p) => p.id === zapJogo && p.status === "encerrada") : null;

  // Jogadores que podem ter feito o gol: o time + quem completou (espera) + goleiro do time.
  function jogadoresDoTime(t: number, lado: "a" | "b") {
    const ids = [...(times[t] ?? [])];
    const gk = lado === "a" ? partida!.goleiro_a : partida!.goleiro_b;
    if (gk && !ids.includes(gk)) ids.push(gk);
    return ids;
  }
  const completaram = (dados.sorteio.espera ?? []).filter((id) => !times.flat().includes(id));
  const goleirosDia = dados.presencas.filter((p) => p.goleiro && p.status !== "saiu").map((p) => p.membro_id);

  // ---------- Tela ----------
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-alerta px-2.5 py-1 text-xs font-bold text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> AO VIVO
          </span>
          <button type="button" onClick={() => setVerQuem(!verQuem)} className="text-left text-apagado underline decoration-dotted">
            {Math.max(1, vendo.length)} {Math.max(1, vendo.length) === 1 ? "pessoa vendo" : "pessoas vendo"}
          </button>
        </span>
        <Link href={`/p/${pelada.slug}/telao`} className="flex items-center gap-1 rounded-full border border-borda bg-white px-3 py-1.5 font-semibold">
          <Icone nome="tela" tamanho={16} /> Telão
        </Link>
      </div>

      {verQuem && vendo.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-borda bg-white p-3 text-[13px]">
          <span className="w-full text-xs font-bold tracking-wider text-apagado">VENDO AGORA</span>
          {[...vendo]
            .sort((a, b) => ["admin", "membro", "pin", "visitante"].indexOf(a.tipo) - ["admin", "membro", "pin", "visitante"].indexOf(b.tipo))
            .map((v, i) => (
              <span
                key={i}
                className={`rounded-full px-2.5 py-1 font-semibold ${v.tipo === "admin" ? "bg-noite text-white" : v.tipo === "membro" ? "bg-roxo-suave text-roxo-escuro" : v.tipo === "pin" ? "bg-alerta-suave text-alerta-escuro" : "bg-fundo text-apagado"}`}
              >
                {v.nome}
                {v.tipo === "admin" ? " · admin" : v.tipo === "pin" ? " · PIN" : ""}
              </span>
            ))}
        </div>
      )}

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
        {partida.inicio_em && (
          <div className="grid w-full grid-cols-3 gap-1 text-center text-[11px] text-[#CFC7E0]">
            <span>
              Tempo real
              <br />
              <strong className="font-display text-sm text-white tabular-nums">{formatarRelogio(tempoReal)}</strong>
            </span>
            <span>
              Bola rolando
              <br />
              <strong className="font-display text-sm text-white tabular-nums">{formatarRelogio(rolando)}</strong>
            </span>
            <span>
              Parado
              <br />
              <strong className="font-display text-sm text-white tabular-nums">{formatarRelogio(tempoParado)}</strong>
            </span>
          </div>
        )}
        {pausasTxt.length > 0 && (
          <div className="flex w-full flex-wrap justify-center gap-1.5 text-[11px]">
            {pausasTxt.map((pz, k) => (
              <span key={k} className={`rounded-full px-2 py-0.5 ${pz.aberta ? "bg-alerta text-white" : "bg-white/10 text-[#CFC7E0]"}`}>
                ⏸ {pz.motivo} · {formatarRelogio(pz.seg)}
              </span>
            ))}
          </div>
        )}
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
              onClick={() =>
                comPermissao(() => {
                  if (admin && partida.numero === 1 && partida.status === "aguardando") avisarPush({ pelada_id: pelada.id, tipo: "comecou" });
                  acao(partida.status === "rolando" ? "pausar" : "iniciar");
                })
              }
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

      {jogoRecente && (
        <section className="flex items-center gap-3 rounded-2xl border-2 border-zap/40 bg-white p-3">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold">Jogo {jogoRecente.numero} encerrado</span>
            <span className="truncate text-xs text-apagado">
              {NOMES_TIMES[jogoRecente.time_a]} {jogoRecente.placar_a} × {jogoRecente.placar_b} {NOMES_TIMES[jogoRecente.time_b]} · manda o resultado pra galera
            </span>
          </span>
          <a href={zapDoJogo(jogoRecente)} target="_blank" rel="noreferrer" onClick={() => setZapJogo(null)} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-zap px-3 text-sm font-semibold text-white">
            <Icone nome="zap" tamanho={16} /> Mandar no grupo
          </a>
          <button type="button" aria-label="Fechar" onClick={() => setZapJogo(null)} className="text-apagado">
            <Icone nome="fechar" tamanho={16} />
          </button>
        </section>
      )}

      {ultimaEncerrada && agoraServidor - new Date(ultimaEncerrada.encerrada_em ?? 0).getTime() < 3 * 3600_000 && (
        <CraqueDaPartida
          key={ultimaEncerrada.id}
          partida={ultimaEncerrada}
          times={times}
          nome={nome}
          agoraServidor={agoraServidor}
          aoVotar={() => carregarCraques(dados.evento.id).then((v) => setCraques(craquesPorJogo(v)))}
        />
      )}

      {/* Placar do dia: vitórias de cada time e quem ganhou de quem */}
      {encerradas.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-apagado">PLACAR DO DIA</span>
            <a
              href={linkZap(textoDoDia({ pelada: pelada.nome, partidas: dados.partidas, lances: dados.lances, nome, link: `${linkAoVivo}?dia=${encerradas.length}` }))}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-sm font-semibold text-zap"
            >
              <Icone nome="zap" tamanho={15} /> Mandar no grupo
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            {times.map((_, t) => {
              const jogos = encerradas.filter((p) => p.time_a === t || p.time_b === t);
              const v = vitorias.get(t) ?? 0;
              const e = jogos.filter((p) => (p.vencedor ?? (p.placar_a > p.placar_b ? p.time_a : p.placar_b > p.placar_a ? p.time_b : null)) === null).length;
              return (
                <span key={t} className="flex items-center gap-1.5 rounded-xl bg-fundo px-2.5 py-1.5 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CORES_TIMES[t] }} />
                  <strong>{NOMES_TIMES[t]}</strong>
                  <span className="tabular-nums text-apagado">
                    {v}V {e}E {jogos.length - v - e}D
                  </span>
                </span>
              );
            })}
          </div>
          <div className="flex flex-col text-[13px]">
            {[...encerradas].reverse().map((p) => (
              <span key={p.id} className="flex items-center justify-between gap-2 border-t border-borda py-1">
                <span className="text-apagado">Jogo {p.numero}</span>
                <span className="flex-1 text-right tabular-nums">
                  {NOMES_TIMES[p.time_a]} <strong>{p.placar_a} × {p.placar_b}</strong> {NOMES_TIMES[p.time_b]}
                  {craques.get(p.id) && <span className="block text-[11px] text-apagado">⭐ {craques.get(p.id)!.map(nome).join(" e ")}</span>}
                </span>
                <a href={zapDoJogo(p)} target="_blank" rel="noreferrer" aria-label={`Mandar o jogo ${p.numero} no Zap`} className="text-zap">
                  <Icone nome="zap" tamanho={15} />
                </a>
              </span>
            ))}
          </div>
        </section>
      )}

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
          <Link href={`/cronometro?min=${pelada.minutos}&gols=${pelada.regra_fim === "tempo" ? 0 : pelada.gols_limite}`} className="text-center text-xs font-semibold text-apagado underline">
            Internet ruim? Usar só o cronômetro do aparelho
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => comPermissao(() => setFolha({ tipo: "times" }))} className="h-11 rounded-xl border border-borda bg-white text-sm font-semibold">
              Trocar times em campo
            </button>
            {admin && (
              <Link href={`/${pelada.slug}/resultados`} className="flex h-11 items-center justify-center rounded-xl border border-borda bg-white text-sm font-semibold">
                Resultados do dia
              </Link>
            )}
          </div>
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
