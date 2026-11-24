"use client";
// Times sorteados: abas Sorteio 1 a 4, troca tocando em 2 nomes, desfazer, oficial,
// imagem clara/escura (sem nota nenhuma), baixar, copiar, mandar no Zap e começar o jogo.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { carregarElenco, nomeCurto, notaDoMembro, usePelada, type Membro } from "@/lib/pelada";
import {
  carregarPresencas,
  carregarSorteios,
  eventoAtual,
  lerConfig,
  rodarSorteio,
  NOMES_TIMES,
  type Evento,
  type Regra,
  type SorteioSalvo,
} from "@/lib/evento";
import { curtaDia, DIAS, deIso } from "@/lib/datas";
import CardTimes, { type TimeCard } from "@/components/CardTimes";
import { Escolha } from "@/components/Folha";
import Topo, { Carregando } from "@/components/Topo";

export default function TimesPage() {
  const router = useRouter();
  const { pelada, slug, naoAchou } = usePelada();
  const { carregando, usuario, ehAdmin } = useSessao();
  const admin = pelada ? ehAdmin(pelada.id) : false;
  const [evento, setEvento] = useState<Evento | null | undefined>(undefined);
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [sorteios, setSorteios] = useState<SorteioSalvo[]>([]);
  const [atual, setAtual] = useState(0);
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [historico, setHistorico] = useState<{ id: string; times: string[][] }[]>([]);
  const [escuro, setEscuro] = useState(false);
  const [formato, setFormato] = useState<"quadrada" | "vertical">("quadrada");
  const [gerandoImagem, setGerandoImagem] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const todosRef = useRef<(HTMLDivElement | null)[]>([]);

  const carregar = useCallback(async () => {
    if (!pelada) return;
    const ev = await eventoAtual(pelada.id);
    setEvento(ev);
    const [el, s] = await Promise.all([carregarElenco(pelada.id, admin), ev ? carregarSorteios(ev.id) : Promise.resolve([])]);
    setElenco(el);
    setSorteios(admin ? s : s.filter((x) => x.oficial));
  }, [pelada, admin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!carregando) carregar();
  }, [carregar, carregando]);

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const modo = slug ? lerConfig(slug).modo : "simples";

  function montarCard(s: SorteioSalvo, comMedias: boolean): TimeCard[] {
    return s.times.map((t, i) => {
      const membros = t.map((id) => porId.get(id)).filter((m): m is Membro => !!m);
      const gk = s.goleiros?.[i] ? porId.get(s.goleiros[i] as string) : null;
      return {
        jogadores: membros.map((m) => ({ id: m.id, nome: nomeCurto(m) })),
        goleiro: gk ? nomeCurto(gk) : null,
        media: comMedias && membros.length ? membros.reduce((a, m) => a + notaDoMembro(m, modo), 0) / membros.length : undefined,
      };
    });
  }

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando || evento === undefined) return <Carregando />;

  const s = sorteios[Math.min(atual, sorteios.length - 1)];
  const dataTxt = evento ? `${DIAS[deIso(evento.data).getDay()].toLowerCase()} ${curtaDia(evento.data)}` : "";

  if (!evento || !s) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
        <Topo titulo="Times sorteados" sub={pelada.nome} voltar="/" />
        <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">Ainda não sortearam os times de hoje.</p>
        {admin && (
          <Link href={`/${slug}/sortear`} className="flex h-14 items-center justify-center rounded-2xl bg-roxo text-lg font-bold text-white">
            Montar sorteio
          </Link>
        )}
      </main>
    );
  }

  const idx = sorteios.indexOf(s);
  const card = montarCard(s, admin && !gerandoImagem);
  const medias = card.map((t) => t.media ?? 0);
  const diferenca = medias.length ? Math.max(...medias) - Math.min(...medias) : 0;

  async function salvarTimes(sorteio: SorteioSalvo, times: string[][]) {
    setSorteios((lista) => lista.map((x) => (x.id === sorteio.id ? { ...x, times } : x)));
    await criarClienteSupabase().from("sorteios").update({ times }).eq("id", sorteio.id);
  }

  function tocar(ti: number, pi: number) {
    if (!admin) return;
    if (!sel || sel[0] === ti) {
      setSel(sel && sel[0] === ti && sel[1] === pi ? null : [ti, pi]);
      return;
    }
    const times = s.times.map((t) => t.slice());
    const [a, b] = sel;
    [times[a][b], times[ti][pi]] = [times[ti][pi], times[a][b]];
    setHistorico([...historico, { id: s.id, times: s.times }]);
    setSel(null);
    salvarTimes(s, times);
  }

  function desfazer() {
    const u = historico[historico.length - 1];
    if (!u) return;
    const alvo = sorteios.find((x) => x.id === u.id);
    if (alvo) salvarTimes(alvo, u.times);
    setAtual(sorteios.findIndex((x) => x.id === u.id));
    setHistorico(historico.slice(0, -1));
  }

  async function novoSorteio() {
    if (!evento || !usuario || sorteios.length >= 4) return;
    setOcupado(true);
    const sb = criarClienteSupabase();
    const [pres, { data: r }] = await Promise.all([
      carregarPresencas(evento.id),
      sb.from("regras_sorteio").select("id, tipo, membros").eq("pelada_id", pelada!.id),
    ]);
    const linha = pres.filter((p) => !p.goleiro && p.status !== "saiu");
    const ordenada = [...linha.filter((p) => p.status === "confirmado"), ...linha.filter((p) => p.status === "espera")];
    const res = rodarSorteio(
      ordenada.map((p) => porId.get(p.membro_id)).filter((m): m is Membro => !!m),
      pres.filter((p) => p.goleiro && p.status !== "saiu").map((p) => porId.get(p.membro_id)).filter((m): m is Membro => !!m),
      lerConfig(slug),
      (r ?? []) as Regra[],
    );
    const numero = Math.max(0, ...sorteios.map((x) => x.numero)) + 1;
    const { data } = await sb
      .from("sorteios")
      .insert({ evento_id: evento.id, numero, times: res.times, goleiros: res.goleiros, espera: res.espera, criado_por: usuario.id })
      .select()
      .single();
    setOcupado(false);
    if (data) {
      setSorteios([...sorteios, data as SorteioSalvo]);
      setAtual(sorteios.length);
      setSel(null);
    }
  }

  async function fechar(i: number) {
    const alvo = sorteios[i];
    setSorteios(sorteios.filter((_, k) => k !== i));
    setAtual(Math.max(0, atual >= i ? atual - 1 : atual));
    await criarClienteSupabase().from("sorteios").delete().eq("id", alvo.id);
  }

  async function marcarOficial(): Promise<boolean> {
    if (!evento) return false;
    const sb = criarClienteSupabase();
    await sb.from("sorteios").update({ oficial: false }).eq("evento_id", evento.id).neq("id", s.id);
    const { error } = await sb.from("sorteios").update({ oficial: true }).eq("id", s.id);
    if (error) return false;
    setSorteios(sorteios.map((x) => ({ ...x, oficial: x.id === s.id })));
    if (evento.status === "lista") {
      await sb.from("eventos").update({ status: "sorteado" }).eq("id", evento.id);
      setEvento({ ...evento, status: "sorteado" });
    }
    return true;
  }

  async function comecar() {
    if (!evento) return;
    setOcupado(true);
    if (!(await marcarOficial())) {
      setOcupado(false);
      return setAviso("Não deu pra marcar como oficial.");
    }
    const sb = criarClienteSupabase();
    const { count } = await sb.from("partidas").select("id", { count: "exact", head: true }).eq("evento_id", evento.id);
    if (!count) {
      const { error } = await sb.rpc("nova_partida", {
        p_evento: evento.id,
        p_time_a: 0,
        p_time_b: 1,
        p_goleiro_a: s.goleiros?.[0] ?? null,
        p_goleiro_b: s.goleiros?.[1] ?? null,
      });
      if (error) {
        setOcupado(false);
        return setAviso("Não deu pra criar a primeira partida: " + error.message);
      }
    }
    router.push(`/${slug}/jogo`);
  }

  function texto(sorteio: SorteioSalvo, n: number) {
    const partes = montarCard(sorteio, false).map((t, i) => `*${NOMES_TIMES[i]}*\n${t.jogadores.map((j) => j.nome).join("\n")}${t.goleiro ? `\n🧤 ${t.goleiro}` : ""}`);
    return `⚽ *${pelada!.nome} · Sorteio ${n} · ${dataTxt}*\n\n${partes.join("\n\n")}\n\n_Times gerados pelo MA Sorteio_`;
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto(s, idx + 1));
      setAviso("Texto copiado. É só colar no grupo.");
    } catch {
      setAviso("Não deu pra copiar automaticamente.");
    }
  }

  async function gerarPng(el: HTMLElement) {
    return toPng(el, { pixelRatio: 3, backgroundColor: escuro ? "#1B1430" : "#ffffff" });
  }

  function baixar(url: string, n: number) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-sorteio-${n}.png`;
    a.click();
  }

  async function baixarUma() {
    setGerandoImagem(true); // esconde médias e seleção antes de gerar
    setSel(null);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      if (cardRef.current) baixar(await gerarPng(cardRef.current), idx + 1);
    } catch {
      setAviso("Não deu pra gerar a imagem neste navegador.");
    } finally {
      setGerandoImagem(false);
    }
  }

  async function baixarTodas() {
    setGerandoImagem(true);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      for (let i = 0; i < sorteios.length; i++) {
        const el = todosRef.current[i];
        if (el) baixar(await gerarPng(el), i + 1);
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch {
      setAviso("Não deu pra gerar as imagens neste navegador.");
    } finally {
      setGerandoImagem(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 pt-6 pb-48">
      <Topo
        titulo="Times sorteados"
        sub={`${pelada.nome} · ${dataTxt}`}
        voltar={admin ? `/${slug}/sortear` : "/"}
        direita={
          admin && sorteios.length < 4 ? (
            <button type="button" onClick={novoSorteio} disabled={ocupado} className="h-10 rounded-full border border-dashed border-roxo px-3 text-sm font-semibold text-roxo">
              + Sortear
            </button>
          ) : undefined
        }
      />

      {sorteios.length > 1 && (
        <div role="tablist" className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {sorteios.map((x, i) => (
            <span key={x.id} className={`flex h-9 shrink-0 items-center rounded-full border ${i === idx ? "border-noite bg-noite text-white" : "border-borda bg-white"}`}>
              <button type="button" role="tab" aria-selected={i === idx} onClick={() => { setAtual(i); setSel(null); }} className="pr-1 pl-3 text-sm font-semibold">
                {x.oficial ? "★ " : ""}Sorteio {i + 1}
              </button>
              {admin && (
                <button type="button" onClick={() => fechar(i)} aria-label={`Fechar sorteio ${i + 1}`} className="px-2 text-sm">
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Escolha rotulo="Formato" valor={formato} aoMudar={setFormato} opcoes={[{ valor: "quadrada", rotulo: "Quadrada" }, { valor: "vertical", rotulo: "Vertical" }]} />
        <Escolha
          rotulo="Fundo"
          valor={escuro ? "e" : "c"}
          aoMudar={(v) => setEscuro(v === "e")}
          opcoes={[{ valor: "c", rotulo: "Claro" }, { valor: "e", rotulo: "Escuro" }]}
        />
      </div>

      {admin && diferenca >= 0.5 && (
        <p role="status" className="rounded-xl bg-alerta-suave px-3 py-2 text-[13px] font-semibold text-alerta-escuro">
          Só admins veem: diferença de {diferenca.toFixed(1).replace(".", ",")}★ na média entre o time mais forte e o mais fraco.
        </p>
      )}
      {admin && <p className="text-[13px] text-apagado">Toca em 2 nomes de times diferentes pra trocar. As médias nunca saem na imagem.</p>}

      <CardTimes
        ref={cardRef}
        pelada={pelada.nome}
        subtitulo={`Sorteio ${idx + 1} · ${curtaDia(evento.data)}`}
        times={card}
        escuro={escuro}
        formato={formato}
        selecionado={gerandoImagem ? null : sel}
        aoTocar={admin ? tocar : undefined}
        mostrarMedias={admin && !gerandoImagem}
      />

      {/* Cópias escondidas, só pra gerar "Baixar as 4" (sem notas). */}
      {gerandoImagem && (
        <div aria-hidden="true" className="pointer-events-none fixed top-0 -left-[2000px] w-[420px]">
          {sorteios.map((x, i) => (
            <CardTimes
              key={x.id}
              ref={(el) => {
                todosRef.current[i] = el;
              }}
              pelada={pelada.nome}
              subtitulo={`Sorteio ${i + 1} · ${curtaDia(evento.data)}`}
              times={montarCard(x, false)}
              escuro={escuro}
              formato={formato}
            />
          ))}
        </div>
      )}

      {admin && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={desfazer} disabled={!historico.length} className="h-9 rounded-full border border-borda bg-white px-3 text-sm font-semibold disabled:opacity-40">
            Desfazer troca
          </button>
          <button
            type="button"
            onClick={marcarOficial}
            className={`h-9 rounded-full px-3 text-sm font-semibold ${s.oficial ? "bg-roxo-escuro text-white" : "border border-roxo text-roxo-escuro"}`}
          >
            {s.oficial ? "★ Oficial do dia" : "Marcar como oficial"}
          </button>
        </div>
      )}

      {aviso && (
        <p role="status" onClick={() => setAviso(null)} className="rounded-xl bg-noite px-3 py-2 text-sm text-white">
          {aviso}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-[76px] z-20 border-t border-borda bg-fundo/95 px-4 pt-3 pb-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={sorteios.length > 1 ? baixarTodas : baixarUma} className="h-11 rounded-xl border-2 border-noite bg-white text-sm font-semibold">
              {sorteios.length > 1 ? `Baixar as ${sorteios.length}` : "Baixar imagem"}
            </button>
            <button type="button" onClick={copiar} className="h-11 rounded-xl border-2 border-zap bg-white text-sm font-semibold text-zap">
              Copiar texto
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(texto(s, idx + 1))}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center rounded-xl bg-zap text-sm font-semibold text-white"
            >
              Mandar no Zap
            </a>
          </div>
          {sorteios.length > 1 && (
            <button type="button" onClick={baixarUma} className="text-sm font-semibold text-roxo">
              Baixar só a do Sorteio {idx + 1}
            </button>
          )}
          {admin && (
            <button type="button" onClick={comecar} disabled={ocupado} className="h-13 rounded-2xl bg-roxo py-3 text-lg font-bold text-white disabled:opacity-50">
              Usar este sorteio e começar
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
