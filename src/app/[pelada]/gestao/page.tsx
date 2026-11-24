"use client";
// Gestão da pelada (admin): presença do mês, mensalidade (pago/devendo e cobrar no Zap)
// e a nota da pelada (avaliações pós-jogo, com as sugestões de nota que só admin vê).
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { NOMES_TIMES } from "@/lib/evento";
import { curtaDia, inicioMes, isoDia, nomeMes } from "@/lib/datas";
import { Escolha, Interruptor } from "@/components/Folha";
import Topo, { Carregando } from "@/components/Topo";

type Avaliacao = {
  evento_id: string;
  equilibrio: string | null;
  mais_forte: number | null;
  motivo: string | null;
  sugestoes: { membro_id: string; direcao: "alta" | "baixa" }[] | null;
  nota_pelada: number | null;
  texto: string | null;
  created_at: string;
};

export default function GestaoPage() {
  const { pelada, slug, naoAchou } = usePelada();
  const { carregando, usuario, ehAdmin } = useSessao();
  const admin = pelada ? ehAdmin(pelada.id) : false;
  const [aba, setAba] = useState<"presenca" | "mensalidade" | "nota">("presenca");
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [desloc, setDesloc] = useState(0);
  const [eventos, setEventos] = useState<{ id: string; data: string }[]>([]);
  const [presencas, setPresencas] = useState<{ evento_id: string; membro_id: string; status: string }[]>([]);
  const [pagos, setPagos] = useState<Set<string>>(new Set());
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [copiado, setCopiado] = useState(false);

  const { mesRef, mesIni, mesFim } = useMemo(() => {
    const ref = new Date();
    const m = new Date(ref.getFullYear(), ref.getMonth() + desloc, 1, 12);
    return { mesRef: m, mesIni: inicioMes(m), mesFim: isoDia(new Date(m.getFullYear(), m.getMonth() + 1, 0, 12)) };
  }, [desloc]);

  const carregar = useCallback(async () => {
    if (!pelada || !admin) return;
    const sb = criarClienteSupabase();
    const { data: evs } = await sb.from("eventos").select("id, data").eq("pelada_id", pelada.id).neq("status", "cancelado").gte("data", mesIni).lte("data", mesFim).order("data");
    const lista = evs ?? [];
    setEventos(lista);
    const ids = lista.map((e) => e.id);
    const [{ data: pr }, { data: pg }, { data: av }] = await Promise.all([
      ids.length ? sb.from("presencas").select("evento_id, membro_id, status").in("evento_id", ids) : Promise.resolve({ data: [] }),
      sb.from("pagamentos").select("membro_id, pago").eq("pelada_id", pelada.id).eq("mes", mesIni),
      ids.length ? sb.from("avaliacoes").select("*").in("evento_id", ids).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    ]);
    setPresencas(pr ?? []);
    setPagos(new Set((pg ?? []).filter((p) => p.pago).map((p) => p.membro_id)));
    setAvaliacoes((av ?? []) as Avaliacao[]);
  }, [pelada, admin, mesIni, mesFim]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
    if (pelada) carregarElenco(pelada.id, false).then(setElenco);
  }, [carregar, pelada]);

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const nome = (id: string) => (porId.get(id) ? nomeCurto(porId.get(id) as Membro) : "?");

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando) return <Carregando />;
  if (!usuario || !admin) return <main className="p-6 text-center text-apagado">Só admin vê a gestão.</main>;

  const fixos = elenco.filter((m) => m.ativo && !m.convidado);
  const contaPresenca = (id: string) => presencas.filter((p) => p.membro_id === id && p.status === "confirmado").length;
  const ranking = elenco
    .filter((m) => m.ativo)
    .map((m) => ({ m, n: contaPresenca(m.id) }))
    .filter((x) => x.n > 0 || !x.m.convidado)
    .sort((a, b) => b.n - a.n || nomeCurto(a.m).localeCompare(nomeCurto(b.m)));
  const devendo = fixos.filter((m) => !pagos.has(m.id));
  const valor = pelada.mensalidade ? Number(pelada.mensalidade) : null;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  async function marcarPago(m: Membro, pago: boolean) {
    const n = new Set(pagos);
    if (pago) n.add(m.id);
    else n.delete(m.id);
    setPagos(n);
    await criarClienteSupabase().from("pagamentos").upsert({ pelada_id: pelada!.id, membro_id: m.id, mes: mesIni, pago });
  }

  const cobranca = [
    `💰 *Mensalidade ${pelada.nome} · ${nomeMes(mesRef)}*${valor ? ` · ${fmt(valor)}` : ""}`,
    "",
    "Falta acertar:",
    ...devendo.map((m) => `• ${nomeCurto(m)}`),
    "",
    "Valeu, galera! ⚽",
  ].join("\n");

  // Avaliações
  const notas = avaliacoes.filter((a) => a.nota_pelada).map((a) => a.nota_pelada as number);
  const media = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null;
  const equi = { sim: 0, mais_ou_menos: 0, nao: 0 } as Record<string, number>;
  avaliacoes.forEach((a) => a.equilibrio && (equi[a.equilibrio] = (equi[a.equilibrio] ?? 0) + 1));
  const sugestoes = new Map<string, { alta: number; baixa: number }>();
  avaliacoes.forEach((a) =>
    (a.sugestoes ?? []).forEach((s) => {
      const x = sugestoes.get(s.membro_id) ?? { alta: 0, baixa: 0 };
      x[s.direcao]++;
      sugestoes.set(s.membro_id, x);
    }),
  );
  const totalEqui = equi.sim + equi.mais_ou_menos + equi.nao;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Gestão" sub={`${pelada.nome} · ${nomeMes(mesRef)} · ${eventos.length} ${eventos.length === 1 ? "pelada" : "peladas"}`} voltar="/mais" />
      <div className="flex items-center justify-between gap-2">
        <Escolha
          rotulo="Seção"
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: "presenca", rotulo: "Presença" },
            { valor: "mensalidade", rotulo: "Mensalidade" },
            { valor: "nota", rotulo: "Nota" },
          ]}
        />
        <div className="flex items-center">
          <button type="button" aria-label="Mês anterior" onClick={() => setDesloc(desloc - 1)} className="h-10 w-9 rounded-xl border border-borda bg-white">
            ‹
          </button>
          <button type="button" aria-label="Próximo mês" disabled={desloc >= 0} onClick={() => setDesloc(desloc + 1)} className="h-10 w-9 rounded-xl border border-borda bg-white disabled:opacity-30">
            ›
          </button>
        </div>
      </div>

      {aba === "presenca" && (
        <section className="flex flex-col rounded-2xl border border-borda bg-white p-4">
          <span className="pb-2 text-xs font-bold tracking-wider text-apagado">PRESENÇA DE {nomeMes(mesRef).toUpperCase()}</span>
          {ranking.map(({ m, n }) => (
            <div key={m.id} className="flex items-center gap-3 border-t border-borda py-2 text-sm">
              <span className="flex-1 font-semibold">
                {nomeCurto(m)}
                {m.convidado && <span className="ml-1 text-xs font-normal text-alerta-escuro">convidado</span>}
              </span>
              <span className="h-2 w-24 overflow-hidden rounded-full bg-roxo-suave">
                <span className="block h-full bg-roxo" style={{ width: `${eventos.length ? (n / eventos.length) * 100 : 0}%` }} />
              </span>
              <span className="w-12 text-right tabular-nums text-apagado">
                {n}/{eventos.length}
              </span>
            </div>
          ))}
        </section>
      )}

      {aba === "mensalidade" && (
        <>
          <section className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-borda bg-white p-3">
              <div className="font-display text-2xl font-bold text-zap">{fixos.length - devendo.length}</div>
              <div className="text-xs text-apagado">Pagos</div>
            </div>
            <div className="rounded-2xl border border-borda bg-white p-3">
              <div className="font-display text-2xl font-bold text-alerta">{devendo.length}</div>
              <div className="text-xs text-apagado">Devendo</div>
            </div>
            <div className="rounded-2xl border border-borda bg-white p-3">
              <div className="font-display text-lg font-bold">{valor ? fmt(valor * (fixos.length - devendo.length)) : "—"}</div>
              <div className="text-xs text-apagado">Arrecadado</div>
            </div>
          </section>
          {!valor && (
            <p className="text-[13px] text-apagado">
              Dica: coloque o valor da mensalidade em{" "}
              <Link href={`/${slug}/config`} className="font-semibold text-roxo">
                Configurar pelada
              </Link>
              .
            </p>
          )}
          <section className="flex flex-col rounded-2xl border border-borda bg-white px-4 py-2">
            {fixos.map((m) => (
              <div key={m.id} className="flex items-center justify-between border-b border-borda py-2.5 text-sm last:border-0">
                <span className="font-semibold">{nomeCurto(m)}</span>
                <span className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${pagos.has(m.id) ? "text-zap" : "text-alerta"}`}>{pagos.has(m.id) ? "PAGO" : "DEVENDO"}</span>
                  <Interruptor rotulo={`${nomeCurto(m)} pagou`} ligado={pagos.has(m.id)} aoMudar={(v) => marcarPago(m, v)} />
                </span>
              </div>
            ))}
          </section>
          {devendo.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(cobranca).then(() => setCopiado(true)).catch(() => {})}
                className="h-12 rounded-xl border-2 border-zap font-semibold text-zap"
              >
                {copiado ? "Copiado!" : "Copiar cobrança"}
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(cobranca)}`} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center rounded-xl bg-zap font-semibold text-white">
                Cobrar no Zap
              </a>
            </div>
          )}
        </>
      )}

      {aba === "nota" && (
        <>
          <section className="flex items-center gap-4 rounded-2xl bg-noite p-4 text-white">
            <span className="font-display text-5xl font-bold">{media ? media.toFixed(1).replace(".", ",") : "—"}</span>
            <span className="flex flex-col text-sm">
              <span className="font-semibold">Nota da pelada em {nomeMes(mesRef).toLowerCase()}</span>
              <span className="text-[#CFC7E0]">
                {avaliacoes.length} {avaliacoes.length === 1 ? "avaliação" : "avaliações"}
                {totalEqui ? ` · ${Math.round((equi.sim / totalEqui) * 100)}% acharam equilibrado` : ""}
              </span>
            </span>
          </section>
          {sugestoes.size > 0 && (
            <section className="flex flex-col gap-1.5 rounded-2xl border border-alerta/40 bg-white p-4 text-sm">
              <span className="font-semibold">Revisar estrelas (só admin vê)</span>
              <span className="text-[13px] text-apagado">A galera achou que a avaliação dessas pessoas tá fora do lugar:</span>
              {[...sugestoes.entries()]
                .sort((a, b) => b[1].alta + b[1].baixa - (a[1].alta + a[1].baixa))
                .map(([id, s]) => (
                  <div key={id} className="flex justify-between">
                    <span>{nome(id)}</span>
                    <span className="text-apagado">
                      {s.alta ? `${s.alta}× tá alta` : ""}
                      {s.alta && s.baixa ? " · " : ""}
                      {s.baixa ? `${s.baixa}× tá baixa` : ""}
                    </span>
                  </div>
                ))}
              <Link href={`/${slug}/jogadores`} className="pt-1 font-semibold text-roxo">
                Ajustar estrelas →
              </Link>
            </section>
          )}
          <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4 text-sm">
            <span className="text-xs font-bold tracking-wider text-apagado">O QUE DISSERAM</span>
            {avaliacoes.map((a, i) => (
              <div key={i} className="flex flex-col border-t border-borda pt-2">
                <span className="text-xs text-apagado">
                  {curtaDia(eventos.find((e) => e.id === a.evento_id)?.data ?? a.created_at.slice(0, 10))}
                  {a.nota_pelada ? ` · nota ${a.nota_pelada}` : ""}
                  {a.equilibrio ? ` · ${a.equilibrio === "sim" ? "equilibrado" : a.equilibrio === "nao" ? "desequilibrado" : "mais ou menos"}` : ""}
                  {a.mais_forte !== null ? ` · ${NOMES_TIMES[a.mais_forte]} mais forte` : ""}
                </span>
                {a.motivo && <span className="text-[13px]">Por quê: {a.motivo}</span>}
                {a.texto && <span>“{a.texto}”</span>}
              </div>
            ))}
            {!avaliacoes.length && <span className="text-apagado">Nenhuma avaliação neste mês. Mande o link depois da pelada!</span>}
          </section>
        </>
      )}
    </main>
  );
}
