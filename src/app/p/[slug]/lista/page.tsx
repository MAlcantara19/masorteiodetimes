"use client";
// Lista da semana no app (link fixo, dá pra deixar fixado no grupo): /p/<pelada>/lista
// - Mensalistas já estão na lista (ordem alfabética). Abre no dia/hora configurado pra galera do grupo.
// - Cada um entra com o Google e põe ou tira o próprio nome; pode levar convidado (vai pra trás do grupo).
// - Quem não é do grupo entra como convidado (espera). Admin põe/tira qualquer um e copia a lista pro Zap.
// Atualiza sozinha (tempo real). Nunca mostra notas.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { elencoRapido, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { eventoAtual, type Evento } from "@/lib/evento";
import { DIAS, curtaDia, deIso, isoDia } from "@/lib/datas";
import { medirDiferencaRelogio } from "@/lib/partida";
import { aberturaDaLista, erroLista, lancarLista, montarVagas, proximoDiaDaPelada, type PresencaLista, type Vaga } from "@/lib/lista-app";
import { montarTextoLista } from "@/lib/lista";
import { linkZap } from "@/lib/resumo-zap";
import { ehReserva } from "@/lib/montar-sorteio";
import { avisarPush } from "@/lib/push-cliente";
import { useContatos } from "@/lib/contatos";
import { linkZapPara } from "@/lib/whatsapp";
import { useSearchParams } from "next/navigation";
import Capa from "@/components/Capa";
import { Carregando } from "@/components/Topo";

type EventoLista = Evento & { lista_abre_em?: string | null };

function relogioAte(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, "0")}min`;
  return `${h ? `${h}h ` : ""}${String(m).padStart(2, "0")}min ${String(ss).padStart(2, "0")}s`;
}

export default function ListaAppPage() {
  const { pelada, slug, naoAchou } = usePelada();
  const { carregando, usuario, vinculos, ehAdmin, recarregar } = useSessao();
  const admin = pelada ? ehAdmin(pelada.id) : false;
  const meuId = vinculos.find((v) => v.pelada.id === pelada?.id)?.membro_id ?? null;
  const [evento, setEvento] = useState<EventoLista | null | undefined>(undefined);
  const [pres, setPres] = useState<PresencaLista[]>([]);
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [dif, setDif] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; txt: string } | null>(null);
  const [convidado, setConvidado] = useState("");
  const [noGol, setNoGol] = useState(false);
  const [busca, setBusca] = useState("");
  const [souBusca, setSouBusca] = useState("");
  // Quem subiu da espera (vem da notificação do admin: ?avisar=<membro>) pra mandar no Zap.
  const busca2 = useSearchParams();
  const [subiu, setSubiu] = useState<string | null>(busca2.get("avisar"));
  const contatos = useContatos(pelada?.id, admin);

  const carregarPres = useCallback(async (id: string) => {
    const { data } = await criarClienteSupabase().from("presencas").select("*").eq("evento_id", id).order("ordem");
    setPres((data ?? []) as PresencaLista[]);
  }, []);

  const carregar = useCallback(async () => {
    if (!pelada) return;
    // Pelada que já acabou não é a lista da semana (a próxima ainda vai ser lançada).
    const atual = (await eventoAtual(pelada.id)) as EventoLista | null;
    const ev = atual && atual.status !== "encerrado" ? atual : null;
    setEvento(ev);
    if (ev) await carregarPres(ev.id);
  }, [pelada, carregarPres]);

  useEffect(() => {
    if (!pelada) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
    elencoRapido(pelada.id, setElenco);
    medirDiferencaRelogio().then(setDif).catch(() => {});
  }, [pelada, carregar]);

  // Tempo real + recarrega de tempos em tempos (se o tempo real falhar).
  useEffect(() => {
    if (!evento) return;
    const sb = criarClienteSupabase();
    const canal = sb
      .channel(`lista-${evento.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "presencas", filter: `evento_id=eq.${evento.id}` }, () => {
        carregarPres(evento.id);
        if (pelada) elencoRapido(pelada.id, setElenco);
      })
      .subscribe();
    const t = setInterval(() => carregarPres(evento.id), 30000);
    return () => {
      clearInterval(t);
      sb.removeChannel(canal);
    };
  }, [evento, carregarPres, pelada]);

  const abreEm = evento?.lista_abre_em ? new Date(evento.lista_abre_em).getTime() : null;
  const agoraServ = agora + dif;
  const fechadaAinda = !!abreEm && agoraServ < abreEm;
  useEffect(() => {
    if (!fechadaAinda) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [fechadaAinda]);

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const v = useMemo(() => montarVagas(pres, porId, pelada ?? {}), [pres, porId, pelada]);

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando || evento === undefined) return <Carregando />;

  const nome = (m: Membro | undefined) => (m ? nomeCurto(m) : "…");
  const eu = meuId ? porId.get(meuId) : undefined;
  const minha = meuId ? pres.find((p) => p.membro_id === meuId && p.status !== "saiu") : undefined;
  const meusConvidados = pres.filter((p) => p.convidado_por && p.convidado_por === meuId && p.status !== "saiu");
  const aberta = evento?.status === "lista";
  const volta = `/p/${slug}/lista`;

  async function rpc(fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) {
    setOcupado(true);
    setAviso(null);
    const { error } = await fn();
    setOcupado(false);
    if (error) return setAviso({ ok: false, txt: erroLista(error.message) });
    setAviso({ ok: true, txt: ok });
    if (evento) carregarPres(evento.id);
    if (pelada) elencoRapido(pelada.id, setElenco);
  }

  const sb = criarClienteSupabase();
  const entrar = (modo: "eu" | "convidado" | "sou_convidado", nomeConv?: string) =>
    evento && rpc(() => sb.rpc("lista_entrar", { p_evento: evento.id, p_modo: modo, p_nome: nomeConv ?? null, p_goleiro: noGol }), modo === "convidado" ? "Convidado na lista (atrás da galera do grupo)." : "Seu nome está na lista! ✅");
  // "Sou eu": escolhe o próprio nome no elenco (SQL 0008).
  async function souEu(m: Membro) {
    if (!pelada || !confirm(`Você é ${nomeCurto(m)}${m.apelido && m.apelido !== m.nome ? ` (${m.nome})` : ""}? Seu login fica ligado a esse nome.`)) return;
    setOcupado(true);
    const { error } = await criarClienteSupabase().rpc("sou_eu", { p_pelada: pelada.id, p_membro: m.id });
    setOcupado(false);
    if (error) {
      const msg = error.message;
      return setAviso({ ok: false, txt: msg.includes("nome_ocupado") ? "Esse nome já está ligado a outra conta. Fala com o admin." : msg.includes("ja_ligado") ? "Sua conta já está ligada a um nome." : msg.includes("Could not find") ? "Falta rodar o SQL 0008 no Supabase." : "Não deu certo." });
    }
    await recarregar();
    setAviso({ ok: true, txt: `Pronto, ${nomeCurto(m)}! Agora é só pôr o nome na lista.` });
    elencoRapido(pelada.id, setElenco);
  }

  async function sair(membroId?: string) {
    if (!evento) return;
    setOcupado(true);
    setAviso(null);
    const { data, error } = await sb.rpc("lista_sair", { p_evento: evento.id, p_membro: membroId ?? null });
    setOcupado(false);
    if (error) return setAviso({ ok: false, txt: erroLista(error.message) });
    setAviso({ ok: true, txt: "Nome tirado da lista." });
    // Alguém subiu da espera: avisa a pessoa (e os admins) por notificação.
    if (typeof data === "string") {
      fetch("/api/lista/vaga", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evento_id: evento.id, membro_id: data }) }).catch(() => {});
      if (admin) setSubiu(data);
    }
    carregarPres(evento.id);
  }

  // ---------- Admin ----------
  async function lancar() {
    if (!pelada) return;
    const hoje = isoDia(new Date());
    const data = proximoDiaDaPelada(pelada, hoje, new Date().getHours());
    if (!data) return setAviso({ ok: false, txt: "Configure o dia da semana da pelada primeiro." });
    const abre = aberturaDaLista(pelada, data);
    setOcupado(true);
    const r = await lancarLista(criarClienteSupabase(), pelada, data, abre && abre.getTime() > Date.now() ? abre : null);
    setOcupado(false);
    if (!r) return setAviso({ ok: false, txt: "Não deu pra lançar a lista." });
    setAviso({ ok: true, txt: r.nova ? "Lista lançada com os mensalistas. Avisei a galera." : "A lista desse dia já existia." });
    if (r.nova && pelada && (!abre || abre.getTime() <= Date.now())) avisarPush({ pelada_id: pelada.id, tipo: "lista", evento_id: r.id });
    carregar();
  }
  async function abrirAgora() {
    if (!evento) return;
    await criarClienteSupabase().from("eventos").update({ lista_abre_em: new Date().toISOString() }).eq("id", evento.id);
    carregar();
  }
  async function porNaLista(m: Membro) {
    if (!evento) return;
    const ordem = Math.max(0, ...pres.filter((p) => (p.ordem ?? 0) < 900).map((p) => p.ordem ?? 0)) + 1;
    const { error } = await criarClienteSupabase()
      .from("presencas")
      .upsert({ evento_id: evento.id, membro_id: m.id, status: "confirmado", goleiro: m.goleiro, ordem, origem: "admin", entrou_em: new Date().toISOString() });
    if (error) return setAviso({ ok: false, txt: erroLista(error.message) });
    setBusca("");
    carregarPres(evento.id);
  }
  function textoZap() {
    if (!evento || !pelada) return "";
    const [a, m, d] = evento.data.split("-");
    return montarTextoLista({
      titulo: `Pelada ${d}/${m}/${a}`,
      horario: evento.horario ? `${evento.horario.slice(0, 5)}${pelada.horario_fim ? ` até ${pelada.horario_fim.slice(0, 5)}` : ""}` : null,
      vagas: v.vagas,
      linha: v.linha.map((x) => nome(x.m)),
      goleiros: v.goleiros.map((x) => nome(x.m)),
      suplentes: v.espera.map((x) => nome(x.m)),
    }) + `\n\nColoca ou tira seu nome aqui: ${window.location.origin}/p/${slug}/lista`;
  }

  const linhaNome = (x: Vaga, i: number | null) => {
    const meu = x.p.membro_id === meuId;
    const doMeu = !!meuId && x.p.convidado_por === meuId;
    const quem = x.p.convidado_por ? porId.get(x.p.convidado_por) : undefined;
    return (
      <li key={x.p.membro_id} className={`flex items-center gap-2 border-b border-borda py-1.5 text-[15px] last:border-0 ${meu ? "font-bold text-roxo-escuro" : ""}`}>
        {i !== null && <span className="w-6 text-right text-sm text-apagado tabular-nums">{i}</span>}
        <span className="min-w-0 flex-1 truncate">
          {nome(x.m)}
          {x.p.origem === "mensalista" && <span className="ml-1.5 rounded bg-roxo-suave px-1.5 py-0.5 text-[10px] font-bold text-roxo-escuro">MENSAL</span>}
          {x.p.origem === "convidado" && <span className="ml-1.5 text-xs font-normal text-alerta-escuro">conv.{quem ? ` de ${nomeCurto(quem)}` : ""}</span>}
        </span>
        {aberta && (admin || meu || doMeu) && (
          <button type="button" onClick={() => sair(x.p.membro_id)} disabled={ocupado} aria-label={`Tirar ${nome(x.m)}`} className="px-2 text-lg text-apagado">
            ×
          </button>
        )}
      </li>
    );
  };

  const dia = evento ? deIso(evento.data) : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Capa
        titulo={pelada.nome}
        sub={evento && dia ? `Lista de ${DIAS[dia.getDay()].toLowerCase()} ${curtaDia(evento.data)}${evento.horario ? ` · ${evento.horario.slice(0, 5)}` : ""}` : "Lista da semana"}
        voltar="/"
        logo={pelada.logo_url}
      />

      {!pelada.lista_app && (
        <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">
          Esta pelada ainda usa a lista do Zap.
          {admin && (
            <>
              {" "}
              <Link href={`/${slug}/config`} className="font-semibold text-roxo">
                Ligar a lista no app
              </Link>
            </>
          )}
        </p>
      )}

      {pelada.lista_app && !evento && (
        <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4 text-center text-sm">
          <span className="font-semibold">Ainda não tem lista aberta.</span>
          {pelada.lista_abre_dia !== null && pelada.lista_abre_dia !== undefined && pelada.lista_abre_hora && (
            <span className="text-apagado">
              A lista abre {DIAS[pelada.lista_abre_dia].toLowerCase()} às {pelada.lista_abre_hora.slice(0, 5)}.
            </span>
          )}
          {admin && (
            <button type="button" onClick={lancar} disabled={ocupado} className="h-12 rounded-xl bg-roxo font-bold text-white disabled:opacity-50">
              Lançar a lista da próxima pelada
            </button>
          )}
        </section>
      )}

      {evento && !aberta && (
        <p className="rounded-2xl bg-roxo-suave p-4 text-center text-sm font-semibold text-roxo-escuro">
          A lista fechou: os times já foram sorteados.{" "}
          <Link href={`/p/${slug}/ao-vivo`} className="underline">
            Ver ao vivo
          </Link>
        </p>
      )}

      {evento && aberta && fechadaAinda && abreEm && (
        <section className="flex flex-col items-center gap-1 rounded-2xl bg-noite p-4 text-center text-white">
          <span className="text-xs font-bold tracking-widest text-roxo-claro">A LISTA ABRE EM</span>
          <span className="font-display text-4xl font-bold tabular-nums">{relogioAte(abreEm - agoraServ)}</span>
          <span className="text-[13px] text-[#CFC7E0]">
            {new Date(abreEm).toLocaleString("pt-BR", { weekday: "long", hour: "2-digit", minute: "2-digit" })} · mensalistas já estão na lista
          </span>
          {admin && (
            <button type="button" onClick={abrirAgora} className="mt-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              Abrir agora
            </button>
          )}
        </section>
      )}

      {admin && subiu && (
        <section className="flex items-center gap-2 rounded-2xl border-2 border-zap/40 bg-white p-3 text-sm">
          <span className="flex-1">
            🔁 <strong>{nome(porId.get(subiu))}</strong> saiu da espera e entrou na lista.
          </span>
          <a
            href={
              contatos.get(subiu)?.whatsapp
                ? linkZapPara(contatos.get(subiu)!.whatsapp as string, `Fala, ${nome(porId.get(subiu))}! ⚽ Abriu vaga na ${pelada.nome} e você saiu da espera: tá na lista! Confirma aí.`)
                : `https://wa.me/?text=${encodeURIComponent(`Fala, ${nome(porId.get(subiu))}! ⚽ Abriu vaga na ${pelada.nome} e você saiu da espera: tá na lista! Confirma aí.`)}`
            }
            target="_blank"
            rel="noreferrer"
            onClick={() => setSubiu(null)}
            className="shrink-0 rounded-full bg-zap px-3 py-1.5 text-xs font-bold text-white"
          >
            Avisar no Zap
          </a>
          <button type="button" aria-label="Fechar" onClick={() => setSubiu(null)} className="text-apagado">
            ×
          </button>
        </section>
      )}

      {/* Minhas ações */}
      {evento && aberta && (
        <section className="flex flex-col gap-2 rounded-2xl border-2 border-roxo/40 bg-white p-4">
          {!usuario ? (
            <>
              <span className="text-sm">Entre com o Google pra colocar ou tirar o seu nome.</span>
              <Link href={`/entrar?volta=${encodeURIComponent(volta)}`} className="flex h-12 items-center justify-center rounded-xl bg-roxo font-bold text-white">
                Entrar pra pôr meu nome
              </Link>
            </>
          ) : eu ? (
            <>
              {minha ? (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm">
                    ✅ <strong>{nomeCurto(eu)}</strong>, você está na lista{minha.status === "espera" || v.espera.some((x) => x.p.membro_id === meuId) ? " (na espera)" : ""}.
                  </span>
                  <button type="button" onClick={() => sair()} disabled={ocupado} className="h-10 rounded-xl border border-alerta px-3 text-sm font-semibold text-alerta-escuro">
                    Tirar meu nome
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => entrar("eu")}
                    disabled={ocupado || (fechadaAinda && !eu.mensalista && !admin)}
                    className="h-14 rounded-2xl bg-zap text-lg font-bold text-white disabled:opacity-40"
                  >
                    ✋ Vou! Pôr meu nome
                  </button>
                  {(pelada.lista_goleiros ?? 3) > 0 && (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={noGol || eu.goleiro} disabled={eu.goleiro} onChange={(e) => setNoGol(e.target.checked)} className="h-4 w-4 accent-[var(--marca)]" />
                      Vou no gol 🧤
                    </label>
                  )}
                </>
              )}
              <div className="flex gap-2 border-t border-borda pt-2">
                <input
                  value={convidado}
                  onChange={(e) => setConvidado(e.target.value)}
                  placeholder="Levar um convidado (nome)"
                  aria-label="Nome do convidado"
                  className="h-10 min-w-0 flex-1 rounded-xl border border-borda bg-fundo px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await entrar("convidado", convidado);
                    setConvidado("");
                  }}
                  disabled={ocupado || convidado.trim().length < 2 || (fechadaAinda && !admin)}
                  className="h-10 shrink-0 rounded-xl bg-roxo px-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  + Convidado
                </button>
              </div>
              {meusConvidados.length > 0 && <span className="text-xs text-apagado">Seus convidados: {meusConvidados.map((p) => nome(porId.get(p.membro_id))).join(", ")} (ficam atrás da galera do grupo)</span>}
            </>
          ) : (
            <>
              <span className="text-sm font-semibold">Você é do grupo? Toca no seu nome:</span>
              <input value={souBusca} onChange={(e) => setSouBusca(e.target.value)} placeholder="Procurar meu nome…" aria-label="Procurar meu nome" className="h-10 rounded-xl border border-borda bg-fundo px-3 text-sm" />
              <div className="flex max-h-56 flex-wrap gap-1.5 overflow-auto">
                {elenco
                  .filter((m) => m.ativo && !m.profile_id && !ehReserva(m) && !m.nome.startsWith("Convidado"))
                  .filter((m) => !souBusca.trim() || `${m.nome} ${m.apelido ?? ""} ${(m.apelidos ?? []).join(" ")}`.toLowerCase().includes(souBusca.trim().toLowerCase()))
                  .sort((a, b) => nomeCurto(a).localeCompare(nomeCurto(b), "pt-BR"))
                  .map((m) => (
                    <button key={m.id} type="button" disabled={ocupado} onClick={() => souEu(m)} className="h-9 rounded-full border border-roxo/40 bg-white px-3 text-sm font-semibold text-roxo-escuro">
                      {nomeCurto(m)}
                    </button>
                  ))}
              </div>
              <span className="border-t border-borda pt-2 text-[13px] text-apagado">Não é do grupo? Entra como convidado (fica na espera, atrás da galera do grupo).</span>
              <button type="button" onClick={() => entrar("sou_convidado")} disabled={ocupado || fechadaAinda} className="h-12 rounded-xl border-2 border-roxo font-bold text-roxo disabled:opacity-40">
                Sou convidado, quero jogar
              </button>
            </>
          )}
          {aviso && <p className={`rounded-xl px-3 py-2 text-sm ${aviso.ok ? "bg-[#E7F5EC] text-zap" : "bg-alerta-suave text-alerta-escuro"}`}>{aviso.txt}</p>}
        </section>
      )}

      {/* A lista */}
      {evento && (
        <>
          <section className="flex flex-col rounded-2xl border border-borda bg-white p-4">
            <span className="flex justify-between pb-1 text-xs font-bold tracking-wider text-apagado">
              <span>NA LISTA</span>
              <span>
                {v.linha.length}/{v.vagas}
              </span>
            </span>
            <ol>
              {v.linha.map((x, i) => linhaNome(x, i + 1))}
              {Array.from({ length: Math.max(0, v.vagas - v.linha.length) }, (_, k) => (
                <li key={`vazio${k}`} className="flex items-center gap-2 border-b border-borda py-1.5 text-[15px] text-apagado last:border-0">
                  <span className="w-6 text-right text-sm tabular-nums">{v.linha.length + k + 1}</span>
                  <span className="text-[#C9C3D6]">—</span>
                </li>
              ))}
            </ol>
          </section>
          {v.gks > 0 && (
            <section className="flex flex-col rounded-2xl border border-borda bg-white p-4">
              <span className="flex justify-between pb-1 text-xs font-bold tracking-wider text-apagado">
                <span>🧤 GOLEIROS</span>
                <span>
                  {v.goleiros.length}/{v.gks}
                </span>
              </span>
              <ol>{v.goleiros.length ? v.goleiros.map((x, i) => linhaNome(x, i + 1)) : <li className="py-1.5 text-sm text-apagado">Nenhum goleiro ainda.</li>}</ol>
            </section>
          )}
          {v.espera.length > 0 && (
            <section className="flex flex-col rounded-2xl border border-alerta/40 bg-white p-4">
              <span className="pb-1 text-xs font-bold tracking-wider text-alerta-escuro">ESPERA · entra se abrir vaga (grupo primeiro)</span>
              <ol>{v.espera.map((x, i) => linhaNome(x, i + 1))}</ol>
            </section>
          )}
          {v.sairam.length > 0 && <p className="text-xs text-apagado">Saíram: {v.sairam.map((x) => nome(x.m)).join(", ")}</p>}
        </>
      )}

      {/* Admin */}
      {admin && evento && aberta && (
        <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
          <span className="text-xs font-bold tracking-wider text-apagado">ADMIN</span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pôr alguém do elenco na lista…" aria-label="Buscar no elenco" className="h-10 rounded-xl border border-borda bg-fundo px-3 text-sm" />
          {busca.trim() && (
            <div className="flex flex-wrap gap-1.5">
              {elenco
                .filter((m) => m.ativo && !ehReserva(m) && !pres.some((p) => p.membro_id === m.id && p.status !== "saiu"))
                .filter((m) => `${m.nome} ${m.apelido ?? ""}`.toLowerCase().includes(busca.trim().toLowerCase()))
                .slice(0, 12)
                .map((m) => (
                  <button key={m.id} type="button" onClick={() => porNaLista(m)} className="h-8 rounded-full border border-borda px-3 text-sm">
                    + {nomeCurto(m)}
                  </button>
                ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => navigator.clipboard.writeText(textoZap()).then(() => setAviso({ ok: true, txt: "Lista copiada." }))} className="h-11 rounded-xl border-2 border-zap text-sm font-semibold text-zap">
              Copiar pro Zap
            </button>
            <a href={linkZap(textoZap())} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center rounded-xl bg-zap text-sm font-semibold text-white">
              Mandar no Zap
            </a>
          </div>
          <Link href={`/${slug}/sortear`} className="flex h-11 items-center justify-center rounded-xl bg-roxo text-sm font-semibold text-white">
            Fechar e ir pro sorteio
          </Link>
          {!usuario || !eu ? null : <span className="text-xs text-apagado">Os times sorteados fecham a lista sozinha.</span>}
        </section>
      )}
    </main>
  );
}
