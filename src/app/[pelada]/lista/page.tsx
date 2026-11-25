"use client";
// Colar a lista do WhatsApp: separa linha, goleiros e suplentes, confere nomes parecidos,
// cadastra quem é novo (nota 3) e guarda o dia + a presença no banco.
// Colar de novo: mostra quem entrou e quem saiu; quem sumiu da lista fica como "fora hoje".
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { CHAVE_LISTA, casarComElenco, lerLista, type ListaLida, type NomeLido } from "@/lib/lista";
import { deDataBr, isoDia, proximaPelada, curtaDia } from "@/lib/datas";
import { carregarPresencas, eventoAtual, type Presenca } from "@/lib/evento";
import Topo, { Carregando } from "@/components/Topo";

type Secao = "linha" | "goleiros" | "suplentes";
type Item = { secao: Secao; nome: string; convidadoDe: string | null; membro: Membro | null; sugestao: Membro | null; opcoes?: Membro[]; decidido: boolean };

export default function ListaPage() {
  const router = useRouter();
  const { pelada, slug, naoAchou } = usePelada();
  const { carregando, usuario, ehAdmin } = useSessao();
  const admin = pelada ? ehAdmin(pelada.id) : false;
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [texto, setTexto] = useState("");
  const [lida, setLida] = useState<ListaLida | null>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [veioDoZap, setVeioDoZap] = useState(false);
  // Presença que já estava salva pro mesmo dia (pra mostrar o que mudou).
  const [anterior, setAnterior] = useState<{ eventoId: string; pres: Presenca[] } | null>(null);

  // Lista mandada pelo "Compartilhar" do WhatsApp (tela /compartilhar).
  useEffect(() => {
    try {
      const t = window.sessionStorage.getItem(CHAVE_LISTA);
      if (t) {
        window.sessionStorage.removeItem(CHAVE_LISTA);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTexto(t);
        setVeioDoZap(true);
      }
    } catch {}
  }, []);

  async function colar() {
    try {
      const t = await navigator.clipboard.readText();
      if (t.trim()) {
        setTexto(t);
        setLida(null);
        setItens([]);
      }
    } catch {
      setErro("O navegador não deixou colar sozinho. Segure dentro da caixa e toque em Colar.");
    }
  }

  useEffect(() => {
    if (!pelada || !admin) return;
    carregarElenco(pelada.id, true).then(setElenco);
    // Se já tem lista do dia, mostra de novo pra conferir.
    eventoAtual(pelada.id).then((e) => e?.lista_texto && setTexto((t) => t || e.lista_texto || ""));
  }, [pelada, admin]);

  const ativos = useMemo(() => elenco.filter((m) => m.ativo), [elenco]);

  function diaDa(l: ListaLida): string {
    const proxima = pelada ? proximaPelada(pelada.dia_semana, pelada.horario) : null;
    return (l.data && deDataBr(l.data)) || (proxima ? isoDia(proxima) : isoDia(new Date()));
  }

  async function ler() {
    const l = lerLista(texto);
    setLida(l);
    const montar = (secao: Secao, nomes: NomeLido[]): Item[] =>
      casarComElenco(
        nomes.map((x) => x.nome),
        ativos,
      ).map((c, k) => {
        const convidadoDe = nomes[k].convidadoDe;
        return c.tipo === "exato"
          ? { secao, nome: c.nome, convidadoDe, membro: c.jogador, sugestao: null, decidido: true }
          : c.tipo === "ambiguo"
            ? { secao, nome: c.nome, convidadoDe, membro: null, sugestao: null, opcoes: c.opcoes, decidido: false }
            : c.tipo === "parecido"
              ? { secao, nome: c.nome, convidadoDe, membro: null, sugestao: c.jogador, decidido: false }
              : { secao, nome: c.nome, convidadoDe, membro: null, sugestao: null, decidido: true };
      });
    setItens([...montar("linha", l.linha), ...montar("goleiros", l.goleiros), ...montar("suplentes", l.suplentes)]);
    setErro(null);
    if (!pelada) return;
    const { data: ev } = await criarClienteSupabase().from("eventos").select("id").eq("pelada_id", pelada.id).eq("data", diaDa(l)).neq("status", "cancelado").maybeSingle();
    setAnterior(ev ? { eventoId: ev.id, pres: await carregarPresencas(ev.id) } : null);
  }

  // Escolhe quem é (ou null = é outra pessoa, cadastra como novo).
  function decidir(i: number, quem: Membro | null) {
    setItens(itens.map((x, k) => (k === i ? { ...x, membro: quem, decidido: true } : x)));
  }

  const duvidas = itens.map((x, i) => [x, i] as const).filter(([x]) => !x.decidido);
  const reconhecidos = itens.filter((x) => x.membro);
  const novos = itens.filter((x) => x.decidido && !x.membro);
  const conta = (s: Secao) => itens.filter((x) => x.secao === s).length;
  // Quem riscou o nome ou escreveu "saí": só os que dá pra reconhecer com certeza.
  const riscados = useMemo(
    () =>
      lida
        ? casarComElenco(lida.riscados, ativos)
            .map((c) => (c.tipo === "exato" ? c.jogador : null))
            .filter((m): m is Membro => !!m)
        : [],
    [lida, ativos],
  );
  // O que mudou desde a última lista salva desse dia.
  const nomeDoId = (id: string) => {
    const m = elenco.find((x) => x.id === id);
    return m ? nomeCurto(m) : "?";
  };
  const idsAgora = new Set(itens.map((x) => x.membro?.id).filter(Boolean) as string[]);
  const antes = (anterior?.pres ?? []).filter((p) => p.status !== "saiu");
  const idsAntes = new Set(antes.map((p) => p.membro_id));
  const entraram = anterior?.pres.length ? [...itens.filter((x) => (x.membro ? !idsAntes.has(x.membro.id) : x.decidido)).map((x) => (x.membro ? nomeCurto(x.membro) : x.nome))] : [];
  const sairam = antes.filter((p) => !idsAgora.has(p.membro_id)).map((p) => nomeDoId(p.membro_id));

  async function confirmar() {
    if (!pelada || !usuario || !lida) return;
    if (duvidas.length) return setErro("Confirma os nomes parecidos primeiro.");
    setSalvando(true);
    const sb = criarClienteSupabase();

    // 1. Cadastra os novos (nota 3, posição "qualquer").
    const novosDados = [...new Map(novos.map((x) => [x.nome, x])).values()].map((x) => ({ pelada_id: pelada.id, nome: x.nome, goleiro: x.secao === "goleiros", convidado: true }));
    const criados = new Map<string, string>();
    if (novosDados.length) {
      const { data, error } = await sb.from("membros").insert(novosDados).select("id, nome");
      if (error || !data) {
        setSalvando(false);
        return setErro("Não deu pra cadastrar os novos.");
      }
      data.forEach((m) => criados.set(m.nome, m.id));
      await sb.from("notas").insert(data.map((m) => ({ membro_id: m.id, nota_simples: 3, atualizado_por: usuario.id })));
    }

    // 2. Acha (ou cria) o evento do dia.
    const dia = diaDa(lida);
    let { data: ev } = await sb.from("eventos").select("id").eq("pelada_id", pelada.id).eq("data", dia).neq("status", "cancelado").maybeSingle();
    if (!ev) {
      const r = await sb.from("eventos").insert({ pelada_id: pelada.id, data: dia, horario: lida.horario, lista_texto: texto, status: "lista" }).select("id").single();
      ev = r.data;
    } else {
      await sb.from("eventos").update({ lista_texto: texto, horario: lida.horario }).eq("id", ev.id);
    }
    if (!ev) {
      setSalvando(false);
      return setErro("Não deu pra salvar o dia.");
    }

    // 3. Presença: linha e goleiros confirmados, suplentes na espera (sem repetir ninguém).
    const vistos = new Set<string>();
    const presencas: { evento_id: string; membro_id: string; status: Presenca["status"]; goleiro: boolean; ordem: number }[] = itens
      .map((x, ordem) => {
        const id = x.membro?.id ?? criados.get(x.nome);
        if (!id || vistos.has(id)) return null;
        vistos.add(id);
        return { evento_id: ev.id, membro_id: id, status: (x.secao === "suplentes" ? "espera" : "confirmado") as Presenca["status"], goleiro: x.secao === "goleiros", ordem };
      })
      .filter((x) => x !== null);
    // Quem estava na lista e sumiu (ou riscou o nome) fica como "fora hoje", não é apagado.
    const ja = await carregarPresencas(ev.id);
    const fora = new Set([...ja.map((p) => p.membro_id), ...riscados.map((m) => m.id)].filter((id) => !vistos.has(id)));
    for (const id of fora) {
      const antes = ja.find((p) => p.membro_id === id);
      presencas.push({ evento_id: ev.id, membro_id: id, status: "saiu", goleiro: antes?.goleiro ?? false, ordem: 900 + presencas.length });
    }
    const { error } = await sb.from("presencas").upsert(presencas);
    setSalvando(false);
    if (error) return setErro("Não deu pra salvar a presença.");
    router.push(`/${slug}/sortear`);
  }

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando) return <Carregando />;
  if (!usuario || !admin) return <main className="p-6 text-center text-apagado">Só admin cola a lista.</main>;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Colar lista" sub={pelada.nome} voltar="/" />

      <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
        <div className="flex items-center justify-between">
          <label htmlFor="lista" className="text-xs font-bold uppercase tracking-wider text-apagado">
            Mensagem colada
          </label>
          {texto ? (
            <button type="button" onClick={() => { setTexto(""); setLida(null); setItens([]); setVeioDoZap(false); setAnterior(null); }} className="text-sm font-semibold text-roxo">
              Limpar
            </button>
          ) : (
            <button type="button" onClick={colar} className="text-sm font-semibold text-roxo">
              Colar do Zap
            </button>
          )}
        </div>
        {veioDoZap && !lida && <span className="rounded-xl bg-roxo-suave px-3 py-2 text-[13px] text-roxo-escuro">Lista recebida do WhatsApp. Confere e toque em “Ler lista”.</span>}
        <textarea
          id="lista"
          rows={lida ? 4 : 10}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={"Pelada 23/11/2026\nHorário: 18:30 até 20:30\n1 - Fulano\n2 - Ciclano\n\nGoleiros\n1-Tilu\n\nSuplentes\n1-Ycaro"}
          className="w-full resize-y rounded-xl border border-borda bg-fundo p-3 font-mono text-[13px]"
        />
        <button type="button" onClick={ler} disabled={!texto.trim()} className="h-12 rounded-xl bg-roxo font-semibold text-white disabled:opacity-40">
          {lida ? "Ler de novo" : "Ler lista"}
        </button>
      </section>

      {lida && (
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            [conta("linha"), "linha"],
            [conta("goleiros"), "goleiros"],
            [conta("suplentes"), "suplente"],
            [lida.horario ?? "—", lida.data ? curtaDia(deDataBr(lida.data) ?? "") : "horário"],
          ].map(([v, r]) => (
            <div key={String(r)} className="rounded-2xl border border-borda bg-white py-3">
              <div className="font-display text-xl font-bold">{v}</div>
              <div className="text-xs text-apagado">{r}</div>
            </div>
          ))}
        </div>
      )}

      {lida && (entraram.length > 0 || sairam.length > 0) && (
        <section className="flex flex-col gap-1.5 rounded-2xl border-2 border-roxo/40 bg-white p-4 text-sm">
          <span className="font-semibold">O que mudou desde a última lista</span>
          {entraram.length > 0 && (
            <span>
              <strong className="text-zap">Entraram:</strong> {entraram.join(", ")}
            </span>
          )}
          {sairam.length > 0 && (
            <span>
              <strong className="text-alerta">Saíram:</strong> {sairam.join(", ")} <span className="text-apagado">(ficam como “fora hoje”)</span>
            </span>
          )}
        </section>
      )}

      {lida && (riscados.length > 0 || lida.vazias > 0) && (
        <section className="flex flex-col gap-1 rounded-2xl border border-borda bg-white p-4 text-sm">
          {riscados.length > 0 && (
            <span>
              <strong>Riscaram o nome:</strong> {riscados.map(nomeCurto).join(", ")} <span className="text-apagado">(ficam fora hoje)</span>
            </span>
          )}
          {lida.vazias > 0 && (
            <span>
              <strong>
                {lida.vazias} {lida.vazias === 1 ? "vaga vazia" : "vagas vazias"}
              </strong>{" "}
              <span className="text-apagado">· se ninguém entrar, no sorteio vira RESERVA</span>
            </span>
          )}
        </section>
      )}

      {duvidas.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border-2 border-alerta/50 bg-white p-4">
          <h2 className="font-semibold">Confirma {duvidas.length === 1 ? "esse" : `esses ${duvidas.length}`}, por favor</h2>
          {duvidas.map(([x, i]) => (
            <div key={i} className="flex items-center gap-2">
              {x.opcoes ? (
                <span className="flex flex-1 flex-wrap items-center gap-1.5 text-sm">
                  <span>
                    <strong>{x.nome}</strong> é qual?
                  </span>
                  {x.opcoes.map((o) => (
                    <button key={o.id} type="button" onClick={() => decidir(i, o)} className="h-9 rounded-lg bg-roxo px-3 text-sm font-semibold text-white">
                      {nomeCurto(o)}
                      {o.apelido && o.apelido !== o.nome ? <span className="font-normal opacity-80"> ({o.nome.split(" ")[0]})</span> : null}
                    </button>
                  ))}
                </span>
              ) : (
                <>
                  <span className="flex-1 text-sm">
                    <strong>{x.nome}</strong> é o <strong>{x.sugestao ? nomeCurto(x.sugestao) : ""}</strong>?
                  </span>
                  <button type="button" onClick={() => decidir(i, x.sugestao)} className="h-9 rounded-lg bg-roxo px-3 text-sm font-semibold text-white">
                    É ele
                  </button>
                </>
              )}
              <button type="button" onClick={() => decidir(i, null)} className="h-9 rounded-lg border border-borda px-3 text-sm font-semibold">
                É outro
              </button>
            </div>
          ))}
        </section>
      )}

      {lida && (
        <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4 text-sm">
          <span className="font-semibold">Reconhecidos automaticamente · {reconhecidos.length}</span>
          <span className="text-apagado">{reconhecidos.map((x) => (x.membro ? nomeCurto(x.membro) : "")).join(", ") || "ninguém"}</span>
          {novos.length > 0 && (
            <>
              <span className="pt-2 font-semibold">Novos no elenco · {novos.length}</span>
              <span className="text-apagado">{novos.map((x) => (x.convidadoDe && !x.nome.startsWith("Convidado") ? `${x.nome} (conv. do ${x.convidadoDe})` : x.nome)).join(", ")} (entram como convidado com 3 estrelas, dá pra ajustar depois)</span>
            </>
          )}
        </section>
      )}

      {erro && <p role="alert" className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{erro}</p>}

      {lida && (
        <button type="button" onClick={confirmar} disabled={salvando || duvidas.length > 0 || !itens.length} className="h-14 rounded-2xl bg-roxo text-lg font-bold text-white disabled:opacity-40">
          {salvando ? "Salvando…" : "Confirmar e ir pro sorteio"}
        </button>
      )}
    </main>
  );
}
