"use client";
// Avisos da pelada: o admin escreve um recado (e pode mandar notificação pra galera);
// os lembretes automáticos (hoje tem pelada, 2 horas antes, a lista abriu) também ficam aqui.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { usePelada } from "@/lib/pelada";
import { avisarPush } from "@/lib/push-cliente";
import AtivarNotificacoes from "@/components/AtivarNotificacoes";
import Topo, { Carregando } from "@/components/Topo";

type Aviso = { id: string; titulo: string; texto: string | null; link: string | null; automatico: boolean; created_at: string };

function quando(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  return mesmoDia ? `hoje às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AvisosPage() {
  const { pelada, naoAchou } = usePelada();
  const { carregando, usuario, ehAdmin } = useSessao();
  const admin = pelada ? ehAdmin(pelada.id) : false;
  const [avisos, setAvisos] = useState<Aviso[] | null>(null);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [notificar, setNotificar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    if (!pelada) return;
    const { data, error } = await criarClienteSupabase().from("avisos").select("id, titulo, texto, link, automatico, created_at").eq("pelada_id", pelada.id).order("created_at", { ascending: false }).limit(60);
    if (error) setErro("Os avisos precisam do SQL 0009 no Supabase.");
    setAvisos((data ?? []) as Aviso[]);
  }, [pelada]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!carregando) carregar();
  }, [carregar, carregando]);

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando) return <Carregando />;

  async function publicar() {
    if (!pelada || !titulo.trim()) return;
    setEnviando(true);
    const { error } = await criarClienteSupabase().from("avisos").insert({ pelada_id: pelada.id, titulo: titulo.trim(), texto: texto.trim() || null });
    setEnviando(false);
    if (error) return setErro("Não deu pra publicar (rode o SQL 0009 no Supabase).");
    if (notificar) avisarPush({ pelada_id: pelada.id, tipo: "aviso", titulo: titulo.trim(), texto: texto.trim() });
    setTitulo("");
    setTexto("");
    setErro(null);
    carregar();
  }

  async function apagar(id: string) {
    if (!confirm("Apagar este aviso?")) return;
    await criarClienteSupabase().from("avisos").delete().eq("id", id);
    carregar();
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Avisos" sub={pelada.nome} voltar="/" />

      {usuario && <AtivarNotificacoes />}

      {admin && (
        <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
          <span className="font-semibold">Novo aviso</span>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} placeholder="Ex.: Segunda não tem pelada (feriado)" aria-label="Título do aviso" className="h-11 rounded-xl border border-borda px-3 text-[15px]" />
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={500} placeholder="Detalhes (opcional)" aria-label="Detalhes do aviso" className="rounded-xl border border-borda p-3 text-[15px]" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notificar} onChange={(e) => setNotificar(e.target.checked)} className="h-4 w-4 accent-[var(--marca)]" />
            Mandar notificação pra galera
          </label>
          <button type="button" onClick={publicar} disabled={enviando || !titulo.trim()} className="h-11 rounded-xl bg-roxo font-semibold text-white disabled:opacity-40">
            {enviando ? "Publicando…" : "Publicar aviso"}
          </button>
        </section>
      )}

      {erro && <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{erro}</p>}

      {!usuario ? (
        <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">Entre pra ver os avisos da pelada.</p>
      ) : avisos === null ? (
        <Carregando />
      ) : avisos.length === 0 ? (
        <p className="rounded-2xl border border-borda bg-white p-4 text-center text-sm text-apagado">Nenhum aviso ainda.</p>
      ) : (
        <section className="flex flex-col gap-2">
          {avisos.map((a) => (
            <article key={a.id} className={`flex flex-col gap-1 rounded-2xl border bg-white p-4 ${a.automatico ? "border-borda" : "border-roxo/40"}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{a.titulo}</span>
                <span className="shrink-0 text-xs text-apagado">{quando(a.created_at)}</span>
              </div>
              {a.texto && <p className="text-sm whitespace-pre-wrap text-apagado">{a.texto}</p>}
              <div className="flex items-center justify-between">
                {a.link ? (
                  <Link href={a.link} className="text-sm font-semibold text-roxo">
                    Abrir →
                  </Link>
                ) : (
                  <span />
                )}
                {admin && (
                  <button type="button" onClick={() => apagar(a.id)} className="text-xs text-apagado underline">
                    apagar
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
