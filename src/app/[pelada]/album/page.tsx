"use client";
// Álbum da pelada (as cartas de todo mundo) e a seleção do mês num campo:
// goleiro, 2 no meio e 2 no ataque, montada pela votação + estatísticas do mês.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { carregarCartas, carregarPerfisPublicos, cartaFinal, montarSelecao, posicaoCarta, statsCarta, type InfoCarta, type PerfilPublico } from "@/lib/cartas";
import { calcularEstatisticas, type Linha } from "@/lib/estatisticas";
import { inicioMes, nomeMes } from "@/lib/datas";
import { baixarDataUrl, gerarPng } from "@/lib/imagem";
import Carta, { ORDEM_RARIDADE } from "@/components/Carta";
import { Escolha } from "@/components/Folha";
import Topo, { Carregando } from "@/components/Topo";

type Foto = PerfilPublico;

export default function AlbumPage() {
  const { pelada, slug, naoAchou } = usePelada();
  const [aba, setAba] = useState<"album" | "selecao">("album");
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [cartas, setCartas] = useState<Map<string, InfoCarta> | null>(null);
  const [estMes, setEstMes] = useState<Map<string, Linha>>(new Map());
  const [fotos, setFotos] = useState<Map<string, Foto>>(new Map());
  const campoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pelada) return;
    carregarElenco(pelada.id, false).then(async (el) => {
      setElenco(el);
      setFotos(await carregarPerfisPublicos(el.map((m) => m.profile_id).filter(Boolean) as string[]));
    });
    carregarCartas(pelada.id).then(({ cartas: c, temporada }) => {
      setCartas(c);
      const mes = inicioMes();
      const evs = temporada.eventos.filter((e) => e.data >= mes);
      const ids = new Set(evs.map((e) => e.id));
      const pids = new Set(temporada.partidas.filter((p) => ids.has(p.evento_id)).map((p) => p.id));
      setEstMes(
        calcularEstatisticas({
          eventos: evs,
          partidas: temporada.partidas.filter((p) => ids.has(p.evento_id)),
          lances: temporada.lances.filter((l) => pids.has(l.partida_id)),
          sorteios: temporada.sorteios.filter((s) => ids.has(s.evento_id)),
          presencas: temporada.presencas.filter((p) => ids.has(p.evento_id)),
          pausas: [],
          votos: temporada.votos.filter((v) => ids.has(v.evento_id)),
        }),
      );
    });
  }, [pelada]);

  const ativos = useMemo(
    () =>
      elenco
        .filter((m) => m.ativo)
        .sort((a, b) => ORDEM_RARIDADE.indexOf(cartas?.get(b.id)?.raridade ?? "bronze") - ORDEM_RARIDADE.indexOf(cartas?.get(a.id)?.raridade ?? "bronze") || nomeCurto(a).localeCompare(nomeCurto(b))),
    [elenco, cartas],
  );

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || !cartas) return <Carregando />;

  const sel = montarSelecao(elenco, estMes);
  const foto = (m: Membro) => (m.profile_id ? fotos.get(m.profile_id) : undefined);
  const mes = nomeMes();

  function cartaDe(m: Membro, escala: number) {
    const i = cartas!.get(m.id);
    const f = foto(m);
    return (
      <Carta
        apelido={nomeCurto(m)}
        posicao={posicaoCarta(m)}
        pelada={pelada!.nome}
        raridade={cartaFinal(i, f?.estilo_card)}
        cor={f?.cor_card}
        foto={f?.foto_url}
        stats={statsCarta(m, i?.temporada ?? null, i?.medalhasMes ?? 0)}
        escala={escala}
      />
    );
  }

  const texto = [
    `⭐ *SELEÇÃO DO MÊS · ${pelada.nome.toUpperCase()} · ${mes.toUpperCase()}*`,
    "",
    `⚽ Ataque: ${sel.ataque.map(nomeCurto).join(" e ") || "—"}`,
    `🎯 Meio: ${sel.meio.map(nomeCurto).join(" e ") || "—"}`,
    `🧤 Gol: ${sel.goleiro ? nomeCurto(sel.goleiro) : "—"}`,
    "",
    "_Montada pela votação da galera + estatísticas do mês · MA Sorteio_",
  ].join("\n");

  async function baixar() {
    if (!campoRef.current) return;
    baixarDataUrl(await gerarPng(campoRef.current), `selecao-${slug}-${mes.toLowerCase()}.png`);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Álbum da pelada" sub={`${pelada.nome} · ${mes.toLowerCase()}`} voltar="/mais" />
      <Escolha
        rotulo="Ver"
        valor={aba}
        aoMudar={setAba}
        opcoes={[
          { valor: "album", rotulo: `Álbum · ${ativos.length}` },
          { valor: "selecao", rotulo: "Seleção do mês" },
        ]}
      />

      {aba === "album" && (
        <div className="grid grid-cols-2 justify-items-center gap-3 sm:grid-cols-3">
          {ativos.map((m) => (
            <Link key={m.id} href={`/${slug}/jogador/${m.id}`} aria-label={nomeCurto(m)}>
              {cartaDe(m, 0.8)}
            </Link>
          ))}
        </div>
      )}

      {aba === "selecao" && (
        <>
          <div ref={campoRef} className="flex flex-col gap-3 rounded-3xl bg-noite p-4 text-white">
            <div className="text-center">
              <div className="text-xs font-bold tracking-widest text-roxo-claro">SELEÇÃO DO MÊS</div>
              <div className="font-display text-xl font-bold">
                {pelada.nome} · {mes}
              </div>
            </div>
            <div
              className="flex flex-col items-center gap-3 rounded-2xl p-3"
              style={{ background: "repeating-linear-gradient(180deg, #1A6B3A 0 36px, #1E7A42 36px 72px)", border: "2px solid rgba(255,255,255,0.5)" }}
            >
              {[sel.ataque, sel.meio, sel.goleiro ? [sel.goleiro] : []].map((fileira, i) => (
                <div key={i} className="flex justify-center gap-3">
                  {fileira.length ? fileira.map((m) => <div key={m.id}>{cartaDe(m, 0.62)}</div>) : <span className="py-6 text-sm text-white/70">—</span>}
                </div>
              ))}
            </div>
            <div className="text-center text-xs text-[#CFC7E0]">Montada pela votação da galera + estatísticas do mês · MA Sorteio</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={baixar} className="h-12 rounded-xl border-2 border-noite bg-white font-semibold">
              Baixar imagem
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center rounded-xl bg-zap font-semibold text-white">
              Mandar no Zap
            </a>
          </div>
        </>
      )}
    </main>
  );
}
