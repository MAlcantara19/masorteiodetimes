"use client";
// Montar sorteio: quem joga hoje, quantos times, quantos por time, regras salvas da pelada.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import {
  carregarPresencas,
  carregarSorteios,
  eventoAtual,
  lerConfig,
  rodarSorteio,
  salvarConfig,
  CONFIG_PADRAO,
  type ConfigSorteio,
  type Evento,
  type Presenca,
  type Regra,
} from "@/lib/evento";
import { DIAS, curtaDia, deIso, isoDia, proximaPelada } from "@/lib/datas";
import { Escolha, Interruptor } from "@/components/Folha";
import Topo, { Carregando } from "@/components/Topo";
import { linkZap } from "@/lib/resumo-zap";

export default function SortearPage() {
  const router = useRouter();
  const { pelada, slug, naoAchou } = usePelada();
  const { carregando, usuario, ehAdmin } = useSessao();
  const admin = pelada ? ehAdmin(pelada.id) : false;
  const [evento, setEvento] = useState<Evento | null | undefined>(undefined);
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [pres, setPres] = useState<Presenca[]>([]);
  const [regras, setRegras] = useState<Regra[]>([]);
  const [cfg, setCfg] = useState<ConfigSorteio>(CONFIG_PADRAO);
  const [escolhendo, setEscolhendo] = useState<{ tipo: "junto" | "separar"; ids: string[] } | null>(null);
  const [sorteando, setSorteando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Lista de espera inteligente: quem saiu e o suplente que entrou no lugar (pra avisar no Zap).
  const [chamado, setChamado] = useState<{ entrou: string; saiu: string } | null>(null);

  const carregar = useCallback(async () => {
    if (!pelada) return;
    const ev = await eventoAtual(pelada.id);
    setEvento(ev);
    const [el, p, { data: r }] = await Promise.all([
      carregarElenco(pelada.id, true),
      ev ? carregarPresencas(ev.id) : Promise.resolve([]),
      criarClienteSupabase().from("regras_sorteio").select("id, tipo, membros").eq("pelada_id", pelada.id),
    ]);
    setElenco(el);
    setPres(p);
    setRegras((r ?? []) as Regra[]);
  }, [pelada]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (admin) carregar();
  }, [admin, carregar]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (slug) setCfg(lerConfig(slug));
  }, [slug]);

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const linha = pres.filter((p) => !p.goleiro && p.status !== "saiu");
  const fora = pres.filter((p) => p.status === "saiu");
  const goleiros = pres.filter((p) => p.goleiro && p.status !== "saiu");
  // Ordem: confirmados primeiro (na ordem da lista), depois a espera.
  const ordenada = [...linha.filter((p) => p.status === "confirmado"), ...linha.filter((p) => p.status === "espera")];
  const vagas = cfg.times * cfg.porTime;
  const naLista = new Set(pres.map((p) => p.membro_id));
  const foraDaLista = elenco.filter((m) => m.ativo && !naLista.has(m.id)).sort((a, b) => nomeCurto(a).localeCompare(nomeCurto(b)));
  const sobra = ordenada.length - vagas;

  function mudarCfg(c: Partial<ConfigSorteio>) {
    const n = { ...cfg, ...c };
    setCfg(n);
    if (slug) salvarConfig(slug, n);
  }

  // Sem lista do Zap: cria o dia da pelada vazio pra escolher na mão quem joga.
  async function escolherNaMao() {
    if (!pelada) return;
    const prox = proximaPelada(pelada.dia_semana, pelada.horario);
    const dia = prox ? isoDia(prox) : isoDia(new Date());
    const { error } = await criarClienteSupabase().from("eventos").insert({ pelada_id: pelada.id, data: dia, horario: pelada.horario?.slice(0, 5) ?? null, status: "lista" });
    if (error) return setErro("Não deu pra criar o dia da pelada.");
    carregar();
  }

  // Põe alguém do elenco no jogo de hoje (marcar "disponível").
  async function adicionar(m: Membro) {
    if (!evento) return;
    const ordem = Math.max(0, ...pres.map((p) => p.ordem ?? 0)) + 1;
    const nova: Presenca = { membro_id: m.id, status: "confirmado", goleiro: m.goleiro, ordem };
    setPres([...pres, nova]);
    await criarClienteSupabase().from("presencas").upsert({ evento_id: evento.id, ...nova });
  }

  async function mudarStatus(membroId: string, status: Presenca["status"]) {
    if (!evento) return;
    // Saiu alguém que estava jogando e tem gente esperando: o primeiro da espera sobe.
    const pos = ordenada.findIndex((p) => p.membro_id === membroId);
    const sobe = status === "saiu" && pos >= 0 && pos < vagas ? ordenada[vagas] : undefined;
    setPres(pres.map((p) => (p.membro_id === membroId ? { ...p, status } : sobe && p.membro_id === sobe.membro_id ? { ...p, status: "confirmado" } : p)));
    const sb = criarClienteSupabase();
    await sb.from("presencas").update({ status }).eq("evento_id", evento.id).eq("membro_id", membroId);
    if (sobe) {
      if (sobe.status === "espera") await sb.from("presencas").update({ status: "confirmado" }).eq("evento_id", evento.id).eq("membro_id", sobe.membro_id);
      setChamado({ entrou: sobe.membro_id, saiu: membroId });
    }
  }

  function textoChamado(c: { entrou: string; saiu: string }) {
    if (!evento || !pelada) return "";
    const dia = deIso(evento.data);
    return [
      `Fala, ${nome(c.entrou)}! ⚽`,
      `Abriu vaga na ${pelada.nome} (${DIAS[dia.getDay()].toLowerCase()} ${curtaDia(evento.data)}${evento.horario ? ` às ${evento.horario}` : ""}) e você é o próximo da lista de espera.`,
      "Confirma aí se vai! 🙌",
    ].join("\n");
  }

  // Escolher quem fica na espera: manda pro fim da fila.
  async function mandarPraEspera(membroId: string) {
    if (!evento) return;
    const max = Math.max(0, ...pres.map((p) => p.ordem ?? 0)) + 1;
    setPres(pres.map((p) => (p.membro_id === membroId ? { ...p, status: "espera", ordem: max } : p)));
    await criarClienteSupabase().from("presencas").update({ status: "espera", ordem: max }).eq("evento_id", evento.id).eq("membro_id", membroId);
  }

  function tocar(membroId: string) {
    if (escolhendo) {
      const ids = escolhendo.ids.includes(membroId) ? escolhendo.ids.filter((x) => x !== membroId) : [...escolhendo.ids, membroId];
      setEscolhendo({ ...escolhendo, ids: escolhendo.tipo === "separar" ? ids.slice(-2) : ids });
    }
  }

  async function salvarRegra() {
    if (!escolhendo || !pelada) return;
    if (escolhendo.ids.length < 2) return setEscolhendo(null);
    const { data } = await criarClienteSupabase()
      .from("regras_sorteio")
      .insert({ pelada_id: pelada.id, tipo: escolhendo.tipo, membros: escolhendo.ids })
      .select("id, tipo, membros")
      .single();
    if (data) setRegras([...regras, data as Regra]);
    setEscolhendo(null);
  }

  async function apagarRegra(id: string) {
    setRegras(regras.filter((r) => r.id !== id));
    await criarClienteSupabase().from("regras_sorteio").delete().eq("id", id);
  }

  async function sortearAgora() {
    if (!evento || !usuario) return;
    if (ordenada.length < cfg.times * 2) return setErro("Gente de menos pra esse número de times.");
    setSorteando(true);
    setErro(null);
    const sb = criarClienteSupabase();
    const r = rodarSorteio(
      ordenada.map((p) => porId.get(p.membro_id)).filter((m): m is Membro => !!m),
      goleiros.map((p) => porId.get(p.membro_id)).filter((m): m is Membro => !!m),
      cfg,
      regras,
    );
    // Sortear do zero: apaga os sorteios não oficiais e começa do 1.
    const antigos = await carregarSorteios(evento.id);
    const manter = antigos.filter((s) => s.oficial);
    if (antigos.length > manter.length) await sb.from("sorteios").delete().eq("evento_id", evento.id).eq("oficial", false);
    const numero = manter.length ? Math.max(...manter.map((s) => s.numero)) + 1 : 1;
    const { error } = await sb.from("sorteios").insert({ evento_id: evento.id, numero, times: r.times, goleiros: r.goleiros, espera: r.espera, criado_por: usuario.id });
    setSorteando(false);
    if (error) return setErro("Não deu pra salvar o sorteio.");
    router.push(`/${slug}/times`);
  }

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando || (admin && evento === undefined)) return <Carregando />;
  if (!usuario || !admin) return <main className="p-6 text-center text-apagado">Só admin monta o sorteio.</main>;

  if (!evento) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
        <Topo titulo="Montar sorteio" sub={pelada.nome} />
        <Link href={`/${slug}/lista`} className="flex h-14 items-center justify-center rounded-2xl bg-roxo text-lg font-bold text-white">
          Colar lista do WhatsApp
        </Link>
        <button type="button" onClick={escolherNaMao} className="h-14 rounded-2xl border-2 border-roxo bg-white text-lg font-bold text-roxo">
          Escolher na mão quem joga
        </button>
        <p className="text-center text-sm text-apagado">Sem lista? Escolhe direto do elenco, marcando quem está disponível hoje.</p>
        {erro && <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{erro}</p>}
      </main>
    );
  }

  const nome = (id: string) => {
    const m = porId.get(id);
    return m ? nomeCurto(m) : "?";
  };
  const d = deIso(evento.data);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pt-6 pb-44">
      <Topo
        titulo="Montar sorteio"
        sub={`${pelada.nome} · ${DIAS[d.getDay()].toLowerCase()} ${curtaDia(evento.data)}${evento.horario ? ` · ${evento.horario}` : ""}`}
        direita={
          <Link href={`/${slug}/lista`} className="text-sm font-semibold text-roxo">
            Colar lista de novo
          </Link>
        }
      />

      {escolhendo && (
        <div className="sticky top-2 z-20 flex items-center gap-2 rounded-xl bg-noite px-3 py-2.5 text-sm text-white">
          <span className="flex-1">
            {escolhendo.tipo === "junto" ? "Toca em quem joga junto" : "Toca nos 2 que não podem cair juntos"} ({escolhendo.ids.length})
          </span>
          <button type="button" onClick={() => setEscolhendo(null)} className="font-semibold text-[#CFC7E0]">
            Cancelar
          </button>
          <button type="button" onClick={salvarRegra} className="rounded-lg bg-roxo px-3 py-1 font-semibold">
            Salvar
          </button>
        </div>
      )}

      <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Quem joga hoje · {ordenada.length}</h2>
        </div>
        <span className="text-[13px] text-apagado">Toca no nome pra tirar ou colocar. Laranja = fica na espera.</span>
        <div className="flex flex-wrap gap-2">
          {ordenada.map((p, i) => {
            const espera = i >= vagas;
            const marcado = escolhendo?.ids.includes(p.membro_id);
            return (
              <span key={p.membro_id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => (escolhendo ? tocar(p.membro_id) : mudarStatus(p.membro_id, "saiu"))}
                  className={`h-9 rounded-l-full border px-3 text-sm font-semibold ${
                    marcado ? "border-noite bg-noite text-white" : espera ? "border-alerta bg-alerta-suave text-alerta-escuro" : "border-roxo bg-roxo-suave text-roxo-escuro"
                  }`}
                >
                  {nome(p.membro_id)}
                </button>
                {!escolhendo && !espera && (
                  <button
                    type="button"
                    aria-label={`Mandar ${nome(p.membro_id)} pra espera`}
                    onClick={() => mandarPraEspera(p.membro_id)}
                    className="h-9 rounded-r-full border border-l-0 border-roxo bg-white px-2 text-xs text-roxo-escuro"
                  >
                    ↓
                  </button>
                )}
                {(escolhendo || espera) && <span className={`h-9 w-2 rounded-r-full border border-l-0 ${espera ? "border-alerta bg-alerta-suave" : "border-roxo bg-roxo-suave"}`} />}
              </span>
            );
          })}
        </div>
        {fora.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-2">
            <span className="text-xs text-apagado">Fora hoje:</span>
            {fora.map((p) => (
              <button key={p.membro_id} type="button" onClick={() => mudarStatus(p.membro_id, p.goleiro ? "confirmado" : "confirmado")} className="h-8 rounded-full border border-dashed border-[#B9B3C6] px-3 text-sm text-apagado line-through">
                {nome(p.membro_id)}
              </button>
            ))}
          </div>
        )}
        {foraDaLista.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-borda pt-2">
            <span className="text-xs text-apagado">Do elenco (toca pra marcar que está disponível hoje):</span>
            <div className="flex flex-wrap gap-2">
              {foraDaLista.map((m) => (
                <button key={m.id} type="button" onClick={() => adicionar(m)} className="h-8 rounded-full border border-borda bg-white px-3 text-sm">
                  + {m.goleiro ? "🧤 " : ""}
                  {nomeCurto(m)}
                </button>
              ))}
            </div>
          </div>
        )}
        {goleiros.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-2">
            <span className="text-xs text-apagado">Goleiros (fora da média):</span>
            {goleiros.map((p) => (
              <button key={p.membro_id} type="button" onClick={() => mudarStatus(p.membro_id, "saiu")} className="h-8 rounded-full bg-noite px-3 text-sm font-semibold text-white">
                🧤 {nome(p.membro_id)}
              </button>
            ))}
          </div>
        )}
        {chamado && (
          <div className="flex items-center gap-2 rounded-xl border-2 border-zap/40 bg-white p-3 text-sm">
            <span className="flex-1">
              <strong>{nome(chamado.entrou)}</strong> saiu da espera e entrou no lugar de {nome(chamado.saiu)}.
            </span>
            <a href={linkZap(textoChamado(chamado))} target="_blank" rel="noreferrer" onClick={() => setChamado(null)} className="shrink-0 rounded-full bg-zap px-3 py-1.5 text-xs font-bold text-white">
              Avisar no Zap
            </a>
            <button type="button" aria-label="Fechar" onClick={() => setChamado(null)} className="text-apagado">
              ×
            </button>
          </div>
        )}
        <p className={`mt-1 rounded-xl px-3 py-2 text-sm font-semibold ${sobra === 0 ? "bg-roxo-suave text-roxo-escuro" : "bg-alerta-suave text-alerta-escuro"}`}>
          {sobra === 0 && `${ordenada.length} jogadores → ${cfg.times} times de ${cfg.porTime}. Fecha certinho.`}
          {sobra > 0 && `${sobra} a mais: ${sobra === 1 ? "o último fica" : `os últimos ${sobra} ficam`} na espera.`}
          {sobra < 0 && `Faltam ${-sobra} pra ${cfg.times} times de ${cfg.porTime}.`}
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-borda bg-white p-4">
        <div className="flex flex-col gap-2">
          <span className="font-semibold">Quantos times?</span>
          <div className="grid grid-cols-4 gap-2">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={cfg.times === n}
                onClick={() => mudarCfg({ times: n })}
                className={`h-12 rounded-xl border-2 font-display text-xl font-bold ${cfg.times === n ? "border-roxo bg-roxo text-white" : "border-borda"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex flex-col">
            <span className="font-semibold">Jogadores por time</span>
            <span className="text-[13px] text-apagado">sem contar o goleiro</span>
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => mudarCfg({ porTime: Math.max(2, cfg.porTime - 1) })} aria-label="Menos um" className="h-11 w-11 rounded-xl border border-borda bg-fundo text-xl">
              −
            </button>
            <span className="w-10 text-center font-display text-2xl font-bold">{cfg.porTime}</span>
            <button type="button" onClick={() => mudarCfg({ porTime: Math.min(11, cfg.porTime + 1) })} aria-label="Mais um" className="h-11 w-11 rounded-xl border border-borda bg-fundo text-xl">
              +
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-semibold">Equilibrar pela avaliação</span>
          <Escolha
            rotulo="Avaliação usada"
            valor={cfg.modo}
            aoMudar={(v) => mudarCfg({ modo: v })}
            opcoes={[{ valor: "simples", rotulo: "Simples · estrelas" }, { valor: "completa", rotulo: "Completa" }]}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-apagado">Regras · padrão da {pelada.nome}</span>
          <span className="text-xs text-apagado">salvas</span>
        </div>
        {(["junto", "separar"] as const).map((tipo) => (
          <div key={tipo} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{tipo === "junto" ? "Jogar junto" : "Separar"}</span>
              <button type="button" onClick={() => setEscolhendo({ tipo, ids: [] })} className="text-sm font-semibold text-roxo">
                + Adicionar
              </button>
            </div>
            {regras
              .filter((r) => r.tipo === tipo)
              .map((r) => (
                <span key={r.id} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${tipo === "junto" ? "bg-roxo-suave text-roxo-escuro" : "bg-alerta-suave text-alerta-escuro"}`}>
                  {r.membros.map(nome).join(tipo === "junto" ? " · " : " × ")}
                  <button type="button" aria-label="Apagar regra" onClick={() => apagarRegra(r.id)} className="px-1 font-bold">
                    ×
                  </button>
                </span>
              ))}
          </div>
        ))}
        <div className="flex items-center justify-between border-t border-borda pt-3">
          <span className="flex flex-col">
            <span className="font-semibold">Equilibrar posições</span>
            <span className="text-[13px] text-apagado">não deixar um time só de quem marca</span>
          </span>
          <Interruptor rotulo="Equilibrar posições" ligado={cfg.equilibrarPosicoes} aoMudar={(v) => mudarCfg({ equilibrarPosicoes: v })} />
        </div>
        <div className="flex items-center justify-between">
          <span className="font-semibold">Goleiro fixo em cada time</span>
          <Interruptor rotulo="Goleiro fixo" ligado={cfg.goleiroFixo} aoMudar={(v) => mudarCfg({ goleiroFixo: v })} />
        </div>
      </section>

      {erro && <p role="alert" className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{erro}</p>}

      <div className="fixed inset-x-0 bottom-[76px] z-20 border-t border-borda bg-fundo/95 px-4 pt-3 pb-3 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <button type="button" onClick={sortearAgora} disabled={sorteando || ordenada.length < cfg.times * 2} className="h-14 w-full rounded-2xl bg-roxo text-lg font-bold text-white disabled:opacity-40">
            {sorteando ? "Sorteando…" : "Sortear"}
          </button>
        </div>
      </div>
    </main>
  );
}
