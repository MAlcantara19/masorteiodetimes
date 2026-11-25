"use client";
// Avaliação pós-jogo (link): equilibrou? qual time ficou mais forte? por quê? alguma nota fora do lugar?
// Funciona sem login. As sugestões de nota só chegam pros admins.
import { useEffect, useMemo, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { carregarSorteios, ultimoEvento, CORES_TIMES, NOMES_TIMES, type Evento, type SorteioSalvo } from "@/lib/evento";
import { curtaDia } from "@/lib/datas";
import { Escolha } from "@/components/Folha";
import { Carregando } from "@/components/Topo";
import Capa from "@/components/Capa";

const MOTIVOS = ["Tinha mais craques", "Goleiro fez diferença", "Mais entrosado", "Time com mais fôlego", "Sorte"];

export default function AvaliarPage() {
  const { pelada, naoAchou } = usePelada();
  const { usuario } = useSessao();
  const [evento, setEvento] = useState<Evento | null | undefined>(undefined);
  const [sorteio, setSorteio] = useState<SorteioSalvo | null>(null);
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [equilibrio, setEquilibrio] = useState<"sim" | "mais_ou_menos" | "nao" | "">("");
  const [maisForte, setMaisForte] = useState<number | null>(null);
  const [motivos, setMotivos] = useState<string[]>([]);
  const [sugestoes, setSugestoes] = useState<{ membro_id: string; direcao: "alta" | "baixa" }[]>([]);
  const [escolhendo, setEscolhendo] = useState("");
  const [nota, setNota] = useState(0);
  const [texto, setTexto] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!pelada) return;
    ultimoEvento(pelada.id).then(async (ev) => {
      setEvento(ev);
      if (!ev) return;
      const ss = await carregarSorteios(ev.id);
      setSorteio(ss.find((s) => s.oficial) ?? ss[ss.length - 1] ?? null);
      try {
        if (window.localStorage.getItem(`masorteio:avaliou:${ev.id}`)) setEnviado(true);
      } catch {}
    });
    carregarElenco(pelada.id, false).then(setElenco);
  }, [pelada]);

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const nome = (id: string) => (porId.get(id) ? nomeCurto(porId.get(id) as Membro) : "?");

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || evento === undefined) return <Carregando />;

  async function enviar() {
    if (!evento) return;
    if (!equilibrio && !nota && !texto.trim()) return setErro("Responde pelo menos uma pergunta.");
    const { error } = await criarClienteSupabase()
      .from("avaliacoes")
      .insert({
        evento_id: evento.id,
        profile_id: usuario?.id ?? null,
        equilibrio: equilibrio || null,
        mais_forte: maisForte,
        motivo: motivos.join(", ") || null,
        sugestoes: sugestoes.length ? sugestoes : null,
        nota_pelada: nota || null,
        texto: texto.trim() || null,
      });
    if (error) return setErro("Não deu pra enviar. Tenta de novo.");
    try {
      window.localStorage.setItem(`masorteio:avaliou:${evento.id}`, "1");
    } catch {}
    setEnviado(true);
  }

  const jogadores = sorteio ? [...new Set(sorteio.times.flat())] : [];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Capa titulo="Como foi a pelada?" sub={`${pelada.nome}${evento ? ` · ${curtaDia(evento.data)}` : ""} · leva 1 minutinho`} voltar={`/p/${pelada.slug}`} logo={pelada.logo_url} />

      {!evento && <p className="text-sm text-apagado">Ainda não teve pelada pra avaliar.</p>}
      {enviado && (
        <p className="rounded-2xl bg-roxo-suave p-4 text-center font-semibold text-roxo-escuro">Valeu! Sua avaliação ajuda a deixar os times mais equilibrados. 💜</p>
      )}

      {evento && !enviado && (
        <>
          <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
            <span className="font-semibold">Os times ficaram equilibrados?</span>
            <Escolha
              rotulo="Equilíbrio"
              valor={equilibrio}
              aoMudar={setEquilibrio}
              opcoes={[
                { valor: "sim", rotulo: "Sim 👍" },
                { valor: "mais_ou_menos", rotulo: "Mais ou menos" },
                { valor: "nao", rotulo: "Não 👎" },
              ]}
            />
          </section>

          {sorteio && equilibrio && equilibrio !== "sim" && (
            <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
              <span className="font-semibold">Qual time ficou mais forte?</span>
              <div className="flex flex-wrap gap-2">
                {sorteio.times.map((_, t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={maisForte === t}
                    onClick={() => setMaisForte(maisForte === t ? null : t)}
                    className={`h-10 rounded-xl border-2 px-3 text-sm font-bold ${maisForte === t ? "text-white" : "border-borda"}`}
                    style={maisForte === t ? { background: CORES_TIMES[t], borderColor: CORES_TIMES[t] } : undefined}
                  >
                    {NOMES_TIMES[t]}
                  </button>
                ))}
              </div>
              <span className="pt-1 font-semibold">Por quê?</span>
              <div className="flex flex-wrap gap-2">
                {MOTIVOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={motivos.includes(m)}
                    onClick={() => setMotivos(motivos.includes(m) ? motivos.filter((x) => x !== m) : [...motivos, m])}
                    className={`h-9 rounded-full border px-3 text-sm font-semibold ${motivos.includes(m) ? "border-roxo bg-roxo-suave text-roxo-escuro" : "border-borda"}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </section>
          )}

          {jogadores.length > 0 && (
            <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
              <span className="font-semibold">Alguém tá com a avaliação fora do lugar?</span>
              <span className="text-[13px] text-apagado">Só os admins veem. Ninguém fica sabendo quem mandou.</span>
              <div className="flex gap-2">
                <select value={escolhendo} onChange={(e) => setEscolhendo(e.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-borda bg-white px-2">
                  <option value="">Escolhe o jogador</option>
                  {jogadores.map((id) => (
                    <option key={id} value={id}>
                      {nome(id)}
                    </option>
                  ))}
                </select>
                {(["alta", "baixa"] as const).map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    disabled={!escolhendo}
                    onClick={() => {
                      setSugestoes([...sugestoes.filter((s) => s.membro_id !== escolhendo), { membro_id: escolhendo, direcao: dir }]);
                      setEscolhendo("");
                    }}
                    className="h-11 rounded-xl border border-borda px-3 text-sm font-semibold disabled:opacity-40"
                  >
                    Tá {dir}
                  </button>
                ))}
              </div>
              {sugestoes.map((s) => (
                <span key={s.membro_id} className="flex items-center justify-between rounded-lg bg-fundo px-3 py-1.5 text-sm">
                  {nome(s.membro_id)}: tá {s.direcao}
                  <button type="button" onClick={() => setSugestoes(sugestoes.filter((x) => x !== s))} aria-label="Tirar">
                    ×
                  </button>
                </span>
              ))}
            </section>
          )}

          <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
            <span className="font-semibold">Nota pra pelada de hoje</span>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={nota === n}
                  onClick={() => setNota(n)}
                  className={`h-12 flex-1 rounded-xl border-2 font-display text-lg font-bold ${nota >= n ? "border-roxo bg-roxo text-white" : "border-borda"}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              placeholder="Comentário (opcional)"
              className="rounded-xl border border-borda p-3 text-sm"
            />
          </section>

          {erro && <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{erro}</p>}
          <button type="button" onClick={enviar} className="h-14 rounded-2xl bg-roxo text-lg font-bold text-white">
            Enviar avaliação
          </button>
        </>
      )}
    </main>
  );
}
