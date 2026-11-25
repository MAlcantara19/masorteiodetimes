"use client";
// Início que muda conforme o dia.
// - Dia de pelada: "Hoje tem pelada", sua posição na lista (ou "pôr meu nome"), o time em que você caiu
//   no sorteio oficial e, pro sorteador oficial (modo dia de jogo ligado), o passo a passo da noite:
//   lista → sorteio → times → partida → fim.
// - Outros dias: a próxima pelada e quando a lista abre.
import Link from "next/link";
import { useEffect, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao, type PeladaResumo } from "@/lib/sessao";
import { carregarPresencas, carregarSorteios, eventoAtual, NOMES_TIMES, CORES_TIMES, type Evento, type Presenca, type SorteioSalvo } from "@/lib/evento";
import { DIAS, curtaDia, isoDia, proximaPelada } from "@/lib/datas";
import { aberturaDaLista, montarVagas, type ConfigLista } from "@/lib/lista-app";

type Info = { evento: Evento | null; pres: Presenca[]; sorteios: SorteioSalvo[]; sorteador: boolean; temSorteador: boolean; agora: number };

export default function HojeNaPelada({ pelada }: { pelada: PeladaResumo & ConfigLista & { modo_dia_jogo?: boolean } }) {
  const { vinculos, ehAdmin } = useSessao();
  const meuId = vinculos.find((v) => v.pelada.id === pelada.id)?.membro_id ?? null;
  const admin = ehAdmin(pelada.id);
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const ev = await eventoAtual(pelada.id);
      const [pres, sorteios, sort] = await Promise.all([
        ev ? carregarPresencas(ev.id) : Promise.resolve([]),
        ev ? carregarSorteios(ev.id) : Promise.resolve([]),
        criarClienteSupabase().from("membros").select("id").eq("pelada_id", pelada.id).eq("sorteador", true),
      ]);
      const sorteadores = ((sort.data ?? []) as { id: string }[]).map((x) => x.id);
      if (vivo) setInfo({ evento: ev, pres, sorteios, sorteador: !!meuId && sorteadores.includes(meuId), temSorteador: sorteadores.length > 0, agora: Date.now() });
    })();
    return () => {
      vivo = false;
    };
  }, [pelada.id, meuId]);

  if (!info) return null;
  const hoje = isoDia(new Date());
  const ev = info.evento;
  const ehHoje = !!ev && (ev.data === hoje || ev.status === "em_jogo");
  const slug = pelada.slug;

  // ---------- Outros dias: a próxima pelada ----------
  if (!ehHoje) {
    const prox = proximaPelada(pelada.dia_semana, pelada.horario);
    if (!prox) return null;
    const dataProx = isoDia(prox);
    const abre = pelada.lista_app ? aberturaDaLista(pelada, dataProx) : null;
    const listaAberta = !!ev && ev.status === "lista" && ev.data === dataProx;
    return (
      <section className="flex flex-col gap-1 rounded-2xl border border-borda bg-white p-4 text-sm">
        <span className="text-xs font-bold tracking-wider text-apagado">PRÓXIMA PELADA</span>
        <span className="font-display text-lg font-bold">
          {DIAS[prox.getDay()]} {curtaDia(dataProx)}
          {pelada.horario ? ` · ${pelada.horario.slice(0, 5)}` : ""}
        </span>
        {pelada.lista_app && (
          <span className="text-apagado">
            {listaAberta ? "A lista já está no app." : abre && abre.getTime() > info.agora ? `A lista abre ${DIAS[abre.getDay()].toLowerCase()} às ${abre.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.` : ""}
          </span>
        )}
        {pelada.lista_app && listaAberta && (
          <Link href={`/p/${slug}/lista`} className="mt-1 flex h-11 items-center justify-center rounded-xl bg-roxo font-semibold text-white">
            Ver a lista
          </Link>
        )}
      </section>
    );
  }

  // ---------- Dia de jogo ----------
  const vagas = montarVagas(info.pres, new Map(), pelada);
  const posLinha = meuId ? vagas.linha.findIndex((x) => x.p.membro_id === meuId) : -1;
  const posGol = meuId ? vagas.goleiros.findIndex((x) => x.p.membro_id === meuId) : -1;
  const posEspera = meuId ? vagas.espera.findIndex((x) => x.p.membro_id === meuId) : -1;
  const oficial = info.sorteios.find((s) => s.oficial) ?? null;
  const meuTime = oficial && meuId ? oficial.times.findIndex((t) => t.includes(meuId) || oficial.goleiros?.[oficial.times.indexOf(t)] === meuId) : -1;
  const passoAPasso = !!pelada.modo_dia_jogo && admin && (info.sorteador || !info.temSorteador);

  const passos = [
    { id: "lista", titulo: "Lista", feito: info.pres.length > 0, href: pelada.lista_app ? `/p/${slug}/lista` : `/${slug}/lista`, sub: info.pres.length ? `${vagas.linha.length} na linha · ${vagas.goleiros.length} goleiros${vagas.espera.length ? ` · ${vagas.espera.length} na espera` : ""}` : "ainda sem lista" },
    { id: "sorteio", titulo: "Sorteio", feito: info.sorteios.length > 0, href: `/${slug}/sortear`, sub: info.sorteios.length ? `${info.sorteios.length} sorteio${info.sorteios.length > 1 ? "s" : ""} feito${info.sorteios.length > 1 ? "s" : ""}` : "1h ~ 1h30 antes, pra lista não mudar" },
    { id: "times", titulo: "Times", feito: !!oficial, href: `/${slug}/times`, sub: oficial ? "oficial escolhido" : "escolher o oficial e mandar no grupo" },
    { id: "partida", titulo: "Partida", feito: ev.status === "em_jogo" || ev.status === "encerrado", href: `/${slug}/jogo`, sub: ev.status === "em_jogo" ? "rolando agora" : "cronômetro e placar" },
    { id: "fim", titulo: "Fim", feito: ev.status === "encerrado", href: `/${slug}/fim`, sub: "resumo, prêmios e votação" },
  ];
  const atualPasso = passos.findIndex((p) => !p.feito);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 rounded-2xl bg-noite p-4 text-white">
        <span className="text-xs font-bold tracking-widest text-roxo-claro">HOJE TEM PELADA</span>
        <span className="font-display text-xl font-bold">
          {pelada.nome}
          {ev.horario ? ` · ${ev.horario.slice(0, 5)}` : ""}
        </span>
        {pelada.local && <span className="text-[13px] text-[#CFC7E0]">📍 {pelada.local}</span>}
        <span className="pt-1 text-sm">
          {posLinha >= 0 && `✅ Você é o nº ${posLinha + 1} na lista.`}
          {posGol >= 0 && `🧤 Você está no gol (nº ${posGol + 1}).`}
          {posEspera >= 0 && `⏳ Você está na espera (${posEspera + 1}º). Se abrir vaga, te aviso.`}
          {posLinha < 0 && posGol < 0 && posEspera < 0 && info.pres.length > 0 && "Você não está na lista de hoje."}
        </span>
        {meuTime >= 0 && (
          <Link href={`/${slug}/times`} className="mt-1 flex items-center justify-between rounded-xl px-3 py-2 font-semibold" style={{ background: CORES_TIMES[meuTime] }}>
            Você caiu no {NOMES_TIMES[meuTime]} <span>Ver os times ›</span>
          </Link>
        )}
        {!oficial && info.sorteios.length === 0 && info.pres.length > 0 && <span className="text-[13px] text-[#CFC7E0]">Os times saem perto da hora do jogo.</span>}
        {pelada.lista_app && ev.status === "lista" && posLinha < 0 && posGol < 0 && posEspera < 0 && (
          <Link href={`/p/${slug}/lista`} className="mt-1 flex h-11 items-center justify-center rounded-xl bg-zap font-semibold text-white">
            ✋ Pôr meu nome
          </Link>
        )}
      </div>

      {passoAPasso && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-roxo/40 bg-white p-4">
          <span className="flex items-center justify-between text-xs font-bold tracking-wider text-apagado">
            🎲 DIA DE JOGO · {curtaDia(ev.data)}
            <span>
              {passos.filter((p) => p.feito).length}/{passos.length}
            </span>
          </span>
          <div className="flex gap-1">
            {passos.map((p, i) => (
              <span key={p.id} className={`h-1.5 flex-1 rounded-full ${p.feito ? "bg-roxo" : i === atualPasso ? "bg-roxo/40" : "bg-borda"}`} />
            ))}
          </div>
          {passos.map((p, i) => (
            <Link
              key={p.id}
              href={p.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ${i === atualPasso ? "bg-roxo text-white" : p.feito ? "text-apagado" : ""}`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i === atualPasso ? "bg-white/20" : p.feito ? "bg-roxo-suave text-roxo-escuro" : "bg-fundo"}`}>
                {p.feito ? "✓" : i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{p.titulo}</span>
                <span className={`truncate text-[12px] ${i === atualPasso ? "text-white/80" : "text-apagado"}`}>{p.sub}</span>
              </span>
              <span aria-hidden="true">›</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
