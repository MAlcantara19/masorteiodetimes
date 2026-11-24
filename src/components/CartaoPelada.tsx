"use client";
// Cartão de uma pelada no Início: próxima data, contagem regressiva e se já sorteou.
import Link from "next/link";
import { useEffect, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao, type PeladaResumo } from "@/lib/sessao";
import { definirPeladaAtual } from "@/lib/pelada-atual";
import { contagem, DIAS, horaCurta, horaDe, isoDia, mesmoDia, proximaPelada } from "@/lib/datas";

type EventoResumo = { id: string; data: string; status: string; created_at: string; linha: number; goleiros: number };

export default function CartaoPelada({ pelada }: { pelada: PeladaResumo }) {
  const { ehAdmin } = useSessao();
  const admin = ehAdmin(pelada.id);
  const [agora, setAgora] = useState(() => new Date());
  const [evento, setEvento] = useState<EventoResumo | null>(null);
  const proxima = proximaPelada(pelada.dia_semana, pelada.horario, agora);
  const diaAlvo = proxima ? isoDia(proxima) : null;

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!diaAlvo) return;
    const sb = criarClienteSupabase();
    sb.from("eventos")
      .select("id, data, status, created_at, presencas(status, goleiro)")
      .eq("pelada_id", pelada.id)
      .eq("data", diaAlvo)
      .neq("status", "cancelado")
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const e = data?.[0] as (Omit<EventoResumo, "linha" | "goleiros"> & { presencas: { status: string; goleiro: boolean }[] }) | undefined;
        if (!e) return setEvento(null);
        const conf = e.presencas.filter((p) => p.status === "confirmado");
        setEvento({ ...e, linha: conf.filter((p) => !p.goleiro).length, goleiros: conf.filter((p) => p.goleiro).length });
      });
  }, [pelada.id, diaAlvo]);

  const hoje = proxima ? mesmoDia(proxima, agora) : false;
  const selo = proxima ? `${hoje ? "HOJE" : DIAS[proxima.getDay()].slice(0, 3).toUpperCase()} · ${horaCurta(pelada.horario)}` : "sem dia fixo";

  let destino = `/${pelada.slug}/jogo`;
  let acao = "Ver partida →";
  if (admin) {
    if (!evento) [destino, acao] = [`/${pelada.slug}/sortear`, "Montar sorteio →"];
    else if (evento.status === "lista") [destino, acao] = [`/${pelada.slug}/sortear`, "Sortear →"];
    else if (evento.status === "sorteado") [destino, acao] = [`/${pelada.slug}/times`, "Ver times →"];
    else if (evento.status === "encerrado") [destino, acao] = [`/${pelada.slug}/fim`, "Ver fim da pelada →"];
  } else if (evento?.status === "encerrado") {
    [destino, acao] = [`/p/${pelada.slug}/votar`, "Votar no craque →"];
  }

  return (
    <Link
      href={destino}
      onClick={() => definirPeladaAtual(pelada.slug)}
      className={`flex flex-col gap-3 rounded-2xl bg-white p-4 text-tinta ${hoje ? "border-2 border-roxo" : "border border-borda"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-xl font-semibold">{pelada.nome}</span>
        <span className="shrink-0 rounded-full bg-roxo-suave px-2.5 py-1 text-xs font-semibold text-roxo-escuro">{selo}</span>
      </div>
      {proxima && (
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-[30px] font-bold tabular-nums">{contagem(proxima, agora)}</span>
          <span className="text-[13px] text-apagado">{contagem(proxima, agora) === "rolando" ? "" : "pra começar"}</span>
        </div>
      )}
      {admin && (!evento || evento.status === "lista") && (
        <div className="flex items-center gap-2 rounded-[10px] bg-alerta-suave px-2.5 py-2 text-[13px] font-semibold text-alerta-escuro">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
          </svg>
          {evento ? `Ainda não sorteou · ${evento.linha} linha, ${evento.goleiros} goleiros` : "Lista ainda não colada"}
        </div>
      )}
      <div className="flex items-center justify-between border-t border-borda pt-3">
        <span className="text-[13px] text-apagado">
          {evento ? `Lista colada às ${horaDe(evento.created_at)}` : pelada.local || `Lembrete ${pelada.lembrete_horas_antes}h antes`}
        </span>
        <span className="text-sm font-semibold text-roxo">{acao}</span>
      </div>
    </Link>
  );
}
