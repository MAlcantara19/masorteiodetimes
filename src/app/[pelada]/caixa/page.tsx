"use client";
// Caixa da pelada: entradas (mensalidades, avulsos) e saídas (quadra, bola, coletes), com o saldo.
// Admin lança e apaga; a galera da pelada só vê. Precisa do SQL 0005.
import { useCallback, useEffect, useMemo, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { usePelada } from "@/lib/pelada";
import { curtaDia, inicioMes, isoDia, nomeMes, deIso } from "@/lib/datas";
import Topo, { Carregando } from "@/components/Topo";
import Folha, { Escolha } from "@/components/Folha";

type Lancamento = { id: string; data: string; tipo: "entrada" | "saida"; valor: number; descricao: string; categoria: string | null };

const CATEGORIAS = {
  entrada: ["Mensalidade", "Avulso", "Convidado", "Patrocínio", "Outro"],
  saida: ["Aluguel da quadra", "Bola", "Coletes", "Água / gelo", "Confraternização", "Outro"],
};

const real = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CaixaPage() {
  const { pelada, naoAchou } = usePelada();
  const { ehAdmin, vinculos, usuario, carregando } = useSessao();
  const admin = !!pelada && ehAdmin(pelada.id);
  const membro = admin || (!!pelada && vinculos.some((v) => v.pelada.id === pelada.id));
  const [lista, setLista] = useState<Lancamento[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<{ tipo: "entrada" | "saida"; valor: string; descricao: string; categoria: string; data: string } | null>(null);
  const [mesVer, setMesVer] = useState(() => inicioMes().slice(0, 7));

  const carregar = useCallback(async () => {
    if (!pelada) return;
    const { data, error } = await criarClienteSupabase().from("caixa").select("*").eq("pelada_id", pelada.id).order("data", { ascending: false }).order("created_at", { ascending: false });
    if (error) {
      setErro("O caixa precisa do SQL novo no Supabase (supabase/migrations/0005).");
      return setLista([]);
    }
    setLista(((data ?? []) as Lancamento[]).map((l) => ({ ...l, valor: Number(l.valor) })));
  }, [pelada]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (membro) carregar();
  }, [carregar, membro]);

  const resumo = useMemo(() => {
    const l = lista ?? [];
    const soma = (xs: Lancamento[], t: "entrada" | "saida") => xs.filter((x) => x.tipo === t).reduce((s, x) => s + x.valor, 0);
    const doMes = l.filter((x) => x.data.startsWith(mesVer));
    const meses = [...new Set([inicioMes().slice(0, 7), ...l.map((x) => x.data.slice(0, 7))])].sort().reverse();
    return { saldo: soma(l, "entrada") - soma(l, "saida"), entradas: soma(doMes, "entrada"), saidas: soma(doMes, "saida"), doMes, meses };
  }, [lista, mesVer]);

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando) return <Carregando />;
  if (!usuario || !membro) return <main className="p-6 text-center text-apagado">Só quem é da pelada vê o caixa.</main>;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !pelada) return;
    const valor = Number(form.valor.replace(/\./g, "").replace(",", "."));
    if (!valor || valor <= 0) return setErro("Coloca um valor maior que zero.");
    const { error } = await criarClienteSupabase()
      .from("caixa")
      .insert({ pelada_id: pelada.id, tipo: form.tipo, valor, descricao: form.descricao.trim() || form.categoria, categoria: form.categoria, data: form.data });
    if (error) return setErro("Não deu pra salvar: " + error.message);
    setErro(null);
    setForm(null);
    carregar();
  }

  async function apagar(l: Lancamento) {
    if (!confirm(`Apagar "${l.descricao}" (${real(l.valor)})?`)) return;
    await criarClienteSupabase().from("caixa").delete().eq("id", l.id);
    carregar();
  }

  // Soma as mensalidades marcadas como pagas no mês e lança como uma entrada só.
  async function puxarMensalidades() {
    if (!pelada) return;
    if (!pelada.mensalidade) return setErro("Coloque o valor da mensalidade em Configurar pelada primeiro.");
    const mes = `${mesVer}-01`;
    const { data } = await criarClienteSupabase().from("pagamentos").select("membro_id").eq("pelada_id", pelada.id).eq("mes", mes).eq("pago", true);
    const n = data?.length ?? 0;
    if (!n) return setErro("Ninguém marcado como pago nesse mês (em Presença e mensalidade).");
    const nomeDoMes = nomeMes(deIso(mes));
    if ((lista ?? []).some((l) => l.categoria === "Mensalidade" && l.descricao.includes(nomeDoMes) && l.data.startsWith(mesVer))) {
      if (!confirm(`Já tem mensalidade de ${nomeDoMes} lançada. Lançar de novo?`)) return;
    }
    setForm({ tipo: "entrada", valor: String(n * Number(pelada.mensalidade)).replace(".", ","), descricao: `Mensalidades de ${nomeDoMes} (${n} pagas)`, categoria: "Mensalidade", data: isoDia(new Date()) });
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Caixa" sub={pelada.nome} voltar="/" />

      <section className="flex flex-col items-center gap-1 rounded-3xl bg-noite p-5 text-white">
        <span className="text-xs font-bold tracking-widest text-roxo-claro">SALDO DO CAIXA</span>
        <span className={`font-display text-4xl font-bold tabular-nums ${resumo.saldo < 0 ? "text-alerta-suave" : ""}`}>{real(resumo.saldo)}</span>
      </section>

      {resumo.meses.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
          {resumo.meses.map((m) => (
            <button key={m} type="button" onClick={() => setMesVer(m)} className={`h-9 shrink-0 rounded-full border px-3 text-sm font-semibold capitalize ${m === mesVer ? "border-noite bg-noite text-white" : "border-borda bg-white"}`}>
              {nomeMes(deIso(`${m}-15`))} {m.slice(2, 4)}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-borda bg-white p-3">
          <div className="text-xs font-bold tracking-wider text-apagado">ENTROU NO MÊS</div>
          <div className="font-display text-xl font-bold text-zap tabular-nums">{real(resumo.entradas)}</div>
        </div>
        <div className="rounded-2xl border border-borda bg-white p-3">
          <div className="text-xs font-bold tracking-wider text-apagado">SAIU NO MÊS</div>
          <div className="font-display text-xl font-bold text-alerta tabular-nums">{real(resumo.saidas)}</div>
        </div>
      </div>

      {admin && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setForm({ tipo: "entrada", valor: "", descricao: "", categoria: "Mensalidade", data: isoDia(new Date()) })} className="h-12 rounded-xl bg-zap font-semibold text-white">
            + Entrada
          </button>
          <button type="button" onClick={() => setForm({ tipo: "saida", valor: "", descricao: "", categoria: "Aluguel da quadra", data: isoDia(new Date()) })} className="h-12 rounded-xl bg-alerta font-semibold text-white">
            − Saída
          </button>
          <button type="button" onClick={puxarMensalidades} className="col-span-2 h-11 rounded-xl border border-borda bg-white text-sm font-semibold">
            Lançar as mensalidades pagas deste mês
          </button>
        </div>
      )}
      {erro && <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{erro}</p>}

      <section className="flex flex-col rounded-2xl border border-borda bg-white p-4">
        <span className="pb-1 font-semibold">Lançamentos</span>
        {lista === null ? (
          <Carregando />
        ) : resumo.doMes.length ? (
          resumo.doMes.map((l) => (
            <div key={l.id} className="flex items-center gap-2 border-t border-borda py-2 text-sm">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${l.tipo === "entrada" ? "bg-zap" : "bg-alerta"}`} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{l.descricao}</span>
                <span className="text-xs text-apagado">
                  {curtaDia(l.data)}
                  {l.categoria && l.categoria !== l.descricao ? ` · ${l.categoria}` : ""}
                </span>
              </span>
              <span className={`tabular-nums font-semibold ${l.tipo === "entrada" ? "text-zap" : "text-alerta"}`}>
                {l.tipo === "entrada" ? "+" : "−"} {real(l.valor)}
              </span>
              {admin && (
                <button type="button" onClick={() => apagar(l)} aria-label="Apagar lançamento" className="px-1 text-apagado">
                  ×
                </button>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-apagado">Nada lançado nesse mês.</p>
        )}
      </section>

      <Folha aberta={!!form} titulo={form?.tipo === "entrada" ? "Nova entrada" : "Nova saída"} aoFechar={() => setForm(null)}>
        {form && (
          <form onSubmit={salvar} className="flex flex-col gap-3">
            <Escolha
              rotulo="Tipo"
              valor={form.tipo}
              aoMudar={(t) => setForm({ ...form, tipo: t, categoria: CATEGORIAS[t][0] })}
              opcoes={[
                { valor: "entrada", rotulo: "Entrada" },
                { valor: "saida", rotulo: "Saída" },
              ]}
            />
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Valor (R$)
              <input autoFocus inputMode="decimal" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value.replace(/[^\d,.]/g, "") })} placeholder="150,00" className="h-12 rounded-xl border border-[#D8D0E6] px-3 text-lg font-normal" />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS[form.tipo].map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, categoria: c })} className={`h-9 rounded-full border px-3 text-sm font-semibold ${form.categoria === c ? "border-roxo bg-roxo text-white" : "border-borda"}`}>
                  {c}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Descrição (opcional)
              <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder={form.categoria} className="h-11 rounded-xl border border-[#D8D0E6] px-3 text-[15px] font-normal" />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Data
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} className="h-11 rounded-xl border border-[#D8D0E6] px-3 text-[15px] font-normal" />
            </label>
            <button type="submit" className="h-12 rounded-xl bg-roxo font-semibold text-white">
              Salvar
            </button>
          </form>
        )}
      </Folha>
    </main>
  );
}
