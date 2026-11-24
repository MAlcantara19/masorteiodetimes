"use client";
// Painel master: só o Matheus vê. Peladas, admins, gerar senha, promover quem entrou com Google
// e as duplas que mais caem juntas.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { nomeCurto, type Pelada } from "@/lib/pelada";
import Topo, { Carregando } from "@/components/Topo";
import FormPelada from "@/components/FormPelada";

type PerfilLinha = { id: string; nome: string; apelido: string | null; email: string | null; is_master: boolean };
type MembroLinha = { id: string; nome: string; apelido: string | null; papel: string; profile_id: string | null };
type Dupla = { a: string; b: string; vezes: number };

const NOVA = "__nova__";

export default function MasterPage() {
  const router = useRouter();
  const { carregando, usuario, ehMaster, recarregar: recarregarSessao } = useSessao();
  const [peladas, setPeladas] = useState<Pelada[]>([]);
  const [atual, setAtual] = useState<string>(NOVA);
  const [perfis, setPerfis] = useState<PerfilLinha[]>([]);
  const [membros, setMembros] = useState<MembroLinha[]>([]);
  const [duplas, setDuplas] = useState<Dupla[]>([]);
  const [oficiais, setOficiais] = useState(0);
  const [email, setEmail] = useState("");
  const [nomeNovo, setNomeNovo] = useState("");
  const [gerada, setGerada] = useState<{ email: string; senha: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (carregando) return;
    if (!usuario) router.replace("/entrar");
    else if (!ehMaster) router.replace("/");
  }, [carregando, usuario, ehMaster, router]);

  const carregarPeladas = useCallback(async () => {
    const sb = criarClienteSupabase();
    const [{ data: p }, { data: pf }] = await Promise.all([
      sb.from("peladas").select("*").order("nome"),
      sb.from("profiles").select("id, nome, apelido, email, is_master").order("nome"),
    ]);
    const lista = (p ?? []) as Pelada[];
    setPeladas(lista);
    setPerfis((pf ?? []) as PerfilLinha[]);
    setAtual((a) => (a === NOVA && lista.length ? lista[0].id : a));
  }, []);

  const carregarPelada = useCallback(async (id: string) => {
    if (id === NOVA) return;
    const sb = criarClienteSupabase();
    const [{ data: m }, { data: d }, { count }] = await Promise.all([
      sb.from("membros").select("id, nome, apelido, papel, profile_id").eq("pelada_id", id),
      sb.rpc("duplas_juntas", { p_pelada: id }),
      sb.from("sorteios").select("id, eventos!inner(pelada_id)", { count: "exact", head: true }).eq("oficial", true).eq("eventos.pelada_id", id),
    ]);
    setMembros((m ?? []) as MembroLinha[]);
    setDuplas(((d ?? []) as Dupla[]).slice(0, 8));
    setOficiais(count ?? 0);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ehMaster) carregarPeladas();
  }, [ehMaster, carregarPeladas]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarPelada(atual);
  }, [atual, carregarPelada]);

  if (carregando || !ehMaster) return <Carregando />;

  const pelada = peladas.find((p) => p.id === atual);
  const admins = membros.filter((m) => m.papel === "admin");
  const idsAdmin = new Set(admins.map((m) => m.profile_id));
  const candidatos = perfis.filter((p) => !p.is_master && !idsAdmin.has(p.id));
  const porPerfil = new Map(perfis.map((p) => [p.id, p]));
  const nomeMembro = (id: string) => {
    const m = membros.find((x) => x.id === id);
    return m ? nomeCurto(m) : "?";
  };

  async function gerarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (!pelada) return;
    setOcupado(true);
    setAviso(null);
    const r = await fetch("/api/master/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pelada_id: pelada.id, email, nome: nomeNovo }),
    });
    const j = await r.json();
    setOcupado(false);
    if (!r.ok) return setAviso(j.erro ?? "Deu erro.");
    if (j.senha) setGerada({ email, senha: j.senha });
    else setAviso("Essa pessoa já tinha conta: virou admin desta pelada.");
    setEmail("");
    setNomeNovo("");
    carregarPeladas();
    carregarPelada(pelada.id);
  }

  async function tornarAdmin(p: PerfilLinha) {
    if (!pelada) return;
    const sb = criarClienteSupabase();
    const existente = membros.find((m) => m.profile_id === p.id);
    const res = existente
      ? await sb.from("membros").update({ papel: "admin", ativo: true }).eq("id", existente.id)
      : await sb.from("membros").insert({ pelada_id: pelada.id, profile_id: p.id, nome: p.nome || p.email || "Admin", apelido: p.apelido, papel: "admin" });
    if (res.error) setAviso("Não deu pra promover.");
    carregarPelada(pelada.id);
  }

  async function remover(m: MembroLinha) {
    if (!pelada) return;
    await criarClienteSupabase().from("membros").update({ papel: "jogador" }).eq("id", m.id);
    carregarPelada(pelada.id);
  }

  const textoSenha = gerada
    ? `Seu acesso de admin no MA Sorteio (${pelada?.nome}):\nE-mail: ${gerada.email}\nSenha: ${gerada.senha}\nEntre em ${typeof window !== "undefined" ? window.location.origin : ""}/entrar`
    : "";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Painel master" sub="Só você vê esta tela" voltar="/mais" direita={<span className="rounded-full bg-noite px-2.5 py-1 text-xs font-bold text-roxo-claro">MASTER</span>} />

      <div role="tablist" aria-label="Peladas" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {peladas.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={p.id === atual}
            onClick={() => setAtual(p.id)}
            className={`h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ${p.id === atual ? "border-noite bg-noite text-white" : "border-[#D8D0E6] bg-white"}`}
          >
            {p.nome}
          </button>
        ))}
        <button
          role="tab"
          aria-selected={atual === NOVA}
          onClick={() => setAtual(NOVA)}
          className={`h-10 shrink-0 rounded-full border border-dashed px-4 text-sm font-semibold ${atual === NOVA ? "border-roxo bg-roxo-suave text-roxo-escuro" : "border-[#B9B3C6] text-apagado"}`}
        >
          + Nova pelada
        </button>
      </div>

      {atual === NOVA && (
        <section className="rounded-2xl border border-borda bg-white p-4">
          <h2 className="mb-3 font-semibold">Nova pelada</h2>
          <FormPelada
            aoSalvar={async (p) => {
              await carregarPeladas();
              await recarregarSessao();
              setAtual(p.id);
            }}
          />
        </section>
      )}

      {pelada && (
        <>
          <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Admins da {pelada.nome}</span>
              <span className="text-sm text-apagado">
                {admins.length} {admins.length === 1 ? "admin" : "admins"}
              </span>
            </div>
            {admins.map((a) => {
              const pf = a.profile_id ? porPerfil.get(a.profile_id) : null;
              return (
                <div key={a.id} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-roxo-suave text-sm font-bold text-roxo-escuro">
                    {nomeCurto(a).split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{nomeCurto(a)}</span>
                    <span className="truncate text-[13px] text-apagado">{pf?.email ?? "sem conta"}</span>
                  </span>
                  <button type="button" onClick={() => remover(a)} className="text-sm font-semibold text-alerta">
                    Remover
                  </button>
                </div>
              );
            })}
            <p className="text-[13px] text-apagado">Você (master) já manda em todas as peladas.</p>

            <form onSubmit={gerarSenha} className="flex flex-col gap-2 border-t border-borda pt-3">
              <span className="text-[13px] font-semibold">Novo admin com e-mail e senha</span>
              <input value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} placeholder="Nome (ex.: Biel)" className="h-11 rounded-xl border border-borda px-3" />
              <div className="flex gap-2">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e-mail do novo admin" className="h-11 min-w-0 flex-1 rounded-xl border border-borda px-3" />
                <button type="submit" disabled={ocupado} className="h-11 shrink-0 rounded-xl bg-roxo px-4 font-semibold text-white disabled:opacity-60">
                  Gerar senha
                </button>
              </div>
            </form>

            {gerada && (
              <div className="flex flex-col gap-2 rounded-xl bg-roxo-suave p-3 text-sm text-roxo-escuro">
                <span>
                  Senha de <strong>{gerada.email}</strong>: <strong className="font-mono text-base">{gerada.senha}</strong>
                </span>
                <span className="text-xs">Ela só aparece agora. Mande pra pessoa:</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => navigator.clipboard.writeText(textoSenha)} className="h-10 flex-1 rounded-lg bg-white font-semibold">
                    Copiar
                  </button>
                  <a href={`https://wa.me/?text=${encodeURIComponent(textoSenha)}`} target="_blank" rel="noreferrer" className="flex h-10 flex-1 items-center justify-center rounded-lg bg-zap font-semibold text-white">
                    Mandar no Zap
                  </a>
                </div>
              </div>
            )}
            {aviso && <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{aviso}</p>}
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
            <span className="font-semibold">Entraram com Google</span>
            {candidatos.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{p.apelido || p.nome || "Sem nome"}</span>
                  <span className="truncate text-[13px] text-apagado">{p.email} · jogador</span>
                </span>
                <button type="button" onClick={() => tornarAdmin(p)} className="h-9 shrink-0 rounded-lg border border-roxo px-3 text-sm font-semibold text-roxo">
                  Tornar admin
                </button>
              </div>
            ))}
            {!candidatos.length && <p className="text-sm text-apagado">Ninguém novo por enquanto.</p>}
          </section>

          <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Duplas que mais caem juntas</span>
              <span className="rounded bg-noite px-2 py-0.5 text-[11px] font-bold text-roxo-claro">SÓ MASTER</span>
            </div>
            <span className="text-[13px] text-apagado">Em {oficiais} sorteios oficiais</span>
            {duplas.map((d) => {
              const pct = oficiais ? Math.round((d.vezes / oficiais) * 100) : 0;
              return (
                <div key={d.a + d.b} className="grid grid-cols-[1fr_80px_52px] items-center gap-2 text-sm">
                  <span className="truncate">
                    {nomeMembro(d.a)} + {nomeMembro(d.b)}
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-roxo-suave">
                    <span className="block h-full bg-roxo" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-apagado">
                    {d.vezes} de {oficiais}
                  </span>
                </div>
              );
            })}
            {!duplas.length && <p className="text-sm text-apagado">Aparece depois dos primeiros sorteios oficiais.</p>}
          </section>

          <section className="rounded-2xl border border-borda bg-white p-4">
            <h2 className="mb-3 font-semibold">Configurar {pelada.nome}</h2>
            <FormPelada key={pelada.id} pelada={pelada} aoSalvar={() => { carregarPeladas(); recarregarSessao(); setAviso("Pelada salva."); }} />
          </section>
        </>
      )}
    </main>
  );
}
