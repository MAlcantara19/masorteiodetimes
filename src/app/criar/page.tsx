"use client";
// Criar a própria pelada (sem precisar do master): nome, endereço, dia e horário.
// Começa com 15 dias do Completo pra testar; depois fica no Grátis (jogadores, notas, sorteio equilibrado,
// mandar no grupo, partida ao vivo e cronômetro). Quem cria vira admin e o master recebe o aviso.
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { definirPeladaAtual } from "@/lib/pelada-atual";
import { DIAS } from "@/lib/datas";
import { SLUGS_RESERVADOS } from "@/lib/pelada";
import { normalizar } from "@/lib/lista";
import Topo, { Carregando } from "@/components/Topo";

const ERROS: Record<string, string> = {
  nome_curto: "Coloca um nome com pelo menos 3 letras.",
  endereco_invalido: "O endereço só pode ter letras, números e hífen (3 a 40).",
  endereco_em_uso: "Esse endereço já existe. Tenta outro.",
  ja_tem_pelada: "Você já criou uma pelada. Pra criar outra, fala com o Matheus (dono do app).",
  entre_primeiro: "Entra com o Google primeiro.",
};

const virarEndereco = (t: string) =>
  normalizar(t)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export default function CriarPeladaPage() {
  const router = useRouter();
  const { carregando, usuario, recarregar } = useSessao();
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [mexeuEndereco, setMexeuEndereco] = useState(false);
  const [dia, setDia] = useState("1");
  const [horario, setHorario] = useState("19:00");
  const [local, setLocal] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [criada, setCriada] = useState<string | null>(null);

  if (carregando) return <Carregando />;
  if (!usuario) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
        <Topo titulo="Criar minha pelada" voltar="/" />
        <Link href="/entrar?volta=/criar" className="flex h-12 items-center justify-center rounded-xl bg-roxo font-bold text-white">
          Entrar com o Google pra criar
        </Link>
      </main>
    );
  }

  const slug = mexeuEndereco ? endereco : virarEndereco(nome);

  async function criar() {
    setErro(null);
    if (SLUGS_RESERVADOS.includes(slug)) return setErro("Esse endereço é reservado. Tenta outro.");
    setCriando(true);
    const { data, error } = await criarClienteSupabase().rpc("criar_minha_pelada", { p_nome: nome, p_slug: slug, p_dia: Number(dia), p_horario: horario, p_local: local || null });
    setCriando(false);
    if (error) {
      const chave = Object.keys(ERROS).find((k) => error.message.includes(k));
      return setErro(chave ? ERROS[chave] : error.message.includes("Could not find") ? "Falta rodar o SQL 0010 no Supabase." : "Não deu pra criar. Tenta de novo.");
    }
    const novo = String(data);
    fetch("/api/pelada/criada", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: novo }) }).catch(() => {});
    definirPeladaAtual(novo);
    await recarregar();
    setCriada(novo);
  }

  if (criada) {
    const passos = [
      { feito: true, titulo: "Pelada criada", sub: "você é o admin e o sorteador", href: null },
      { feito: false, titulo: "Coloque os jogadores e as notas", sub: "as estrelas só os admins veem", href: `/${criada}/jogadores` },
      { feito: false, titulo: "Mande o convite no grupo", sub: "a galera entra com o Google e escolhe o nome", href: `/p/${criada}` },
      { feito: false, titulo: "Monte o primeiro sorteio", sub: "cola a lista do Zap ou escolhe na mão", href: `/${criada}/sortear` },
    ];
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
        <Topo titulo="Pelada criada! 🎉" sub="agora é só seguir os passos" />
        <p className="rounded-2xl bg-roxo-suave p-4 text-sm text-roxo-escuro">
          Você ganhou <strong>15 dias do plano Completo</strong> pra testar tudo. Depois a pelada continua no <strong>Grátis</strong>: jogadores, notas, sorteio equilibrado, mandar os
          times no grupo, partida ao vivo e cronômetro.
        </p>
        <section className="flex flex-col gap-2">
          {passos.map((p, i) =>
            p.href ? (
              <Link key={i} href={p.href} className="flex items-center gap-3 rounded-2xl border border-borda bg-white p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-fundo font-bold">{i + 1}</span>
                <span className="flex flex-1 flex-col">
                  <span className="font-semibold">{p.titulo}</span>
                  <span className="text-[13px] text-apagado">{p.sub}</span>
                </span>
                <span aria-hidden="true">›</span>
              </Link>
            ) : (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-borda bg-white p-4 text-apagado">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-roxo text-white">✓</span>
                <span className="flex flex-col">
                  <span className="font-semibold">{p.titulo}</span>
                  <span className="text-[13px]">{p.sub}</span>
                </span>
              </div>
            ),
          )}
        </section>
        <button type="button" onClick={() => router.push("/")} className="text-sm font-semibold text-roxo">
          Ir pro Início
        </button>
      </main>
    );
  }

  const campo = "h-11 rounded-xl border border-borda px-3 text-[15px] font-normal";
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Criar minha pelada" sub="grátis, com 15 dias do Completo pra testar" voltar="/" />
      <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Nome da pelada
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Pelada dos Amigos" className={campo} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Endereço (link da pelada)
          <span className="flex items-center gap-1 font-normal text-apagado">
            masorteio…/
            <input
              value={slug}
              onChange={(e) => {
                setMexeuEndereco(true);
                setEndereco(virarEndereco(e.target.value));
              }}
              placeholder="pelada-dos-amigos"
              className={`${campo} min-w-0 flex-1 text-tinta`}
            />
          </span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Dia da semana
            <select value={dia} onChange={(e) => setDia(e.target.value)} className={`${campo} bg-white`}>
              {DIAS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Horário
            <input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className={campo} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Local (opcional)
          <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Quadra do clube" className={campo} />
        </label>
        {erro && <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{erro}</p>}
        <button type="button" onClick={criar} disabled={criando || nome.trim().length < 3 || slug.length < 3} className="h-12 rounded-xl bg-roxo font-bold text-white disabled:opacity-40">
          {criando ? "Criando…" : "Criar pelada"}
        </button>
      </section>
    </main>
  );
}
