"use client";
// Banners de premiação: do dia, da semana e do mês, em story (1080×1920) ou quadrado (1080×1080),
// com logo da pelada, foto e cor de fundo. Tipos: artilheiro, garçom, muralha, craque, campeão, bagre e seleção.
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { calcularEstatisticas, calcularPremios, carregarPeriodo, premioPorDias, vencedorDe, type DadosPeriodo } from "@/lib/estatisticas";
import { montarSelecao } from "@/lib/cartas";
import { NOMES_TIMES, ultimoEvento } from "@/lib/evento";
import { curtaDia, inicioMes, inicioSemana, isoDia, nomeMes } from "@/lib/datas";
import { baixarDataUrl, compartilharDataUrl, gerarPng } from "@/lib/imagem";
import { Escolha } from "@/components/Folha";
import Topo, { Carregando } from "@/components/Topo";

type Periodo = "dia" | "semana" | "mes";
type Tipo = "artilheiro" | "garcom" | "muralha" | "craque" | "campeao" | "bagre" | "selecao";
type Foto = { id: string; foto_url: string | null };

const TIPOS: { valor: Tipo; rotulo: string; ico: string; titulo: string }[] = [
  { valor: "artilheiro", rotulo: "Artilheiro", ico: "⚽", titulo: "ARTILHEIRO" },
  { valor: "garcom", rotulo: "Garçom", ico: "👟", titulo: "GARÇOM" },
  { valor: "muralha", rotulo: "Muralha", ico: "🧤", titulo: "MURALHA" },
  { valor: "craque", rotulo: "Craque", ico: "⭐", titulo: "CRAQUE" },
  { valor: "campeao", rotulo: "Campeão", ico: "🏆", titulo: "CAMPEÃO" },
  { valor: "bagre", rotulo: "Bagre", ico: "🐟", titulo: "BAGRE" },
  { valor: "selecao", rotulo: "Seleção", ico: "🌟", titulo: "SELEÇÃO" },
];

const CORES = ["#7444D6", "#1B1430", "#1A8F4E", "#C8102E", "#1B6FD6", "#E07A10", "#121212"];

export default function BannersPage() {
  const { pelada, slug, naoAchou } = usePelada();
  const q = useSearchParams();
  const [periodo, setPeriodo] = useState<Periodo>((q.get("periodo") as Periodo) || "dia");
  const [tipo, setTipo] = useState<Tipo>((q.get("tipo") as Tipo) || "artilheiro");
  const [formato, setFormato] = useState<"story" | "quadrado">("story");
  const [cor, setCor] = useState<string | null>(null);
  const [fotoExtra, setFotoExtra] = useState<string | null>(null);
  const [d, setD] = useState<DadosPeriodo | null>(null);
  const [rotuloPeriodo, setRotuloPeriodo] = useState("");
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [fotos, setFotos] = useState<Map<string, string | null>>(new Map());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pelada) return;
    carregarElenco(pelada.id, false).then(async (el) => {
      setElenco(el);
      const ids = el.map((m) => m.profile_id).filter(Boolean) as string[];
      if (ids.length) {
        const { data } = await criarClienteSupabase().from("perfis_publicos").select("id, foto_url").in("id", ids);
        setFotos(new Map(((data ?? []) as Foto[]).map((f) => [f.id, f.foto_url])));
      }
    });
  }, [pelada]);

  useEffect(() => {
    if (!pelada) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setD(null);
    (async () => {
      if (periodo === "dia") {
        const ev = await ultimoEvento(pelada.id);
        setRotuloPeriodo(ev ? `Pelada de ${curtaDia(ev.data)}` : "");
        setD(ev ? await carregarPeriodo(pelada.id, undefined, undefined, [ev.id]) : null);
      } else {
        const desde = periodo === "semana" ? inicioSemana() : inicioMes();
        setRotuloPeriodo(periodo === "semana" ? `Semana de ${curtaDia(desde)}` : nomeMes());
        setD(await carregarPeriodo(pelada.id, desde, isoDia(new Date())));
      }
    })();
  }, [pelada, periodo]);

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada) return <Carregando />;

  const fundo = cor ?? pelada.cor_banner ?? "#7444D6";
  const info = TIPOS.find((t) => t.valor === tipo) as (typeof TIPOS)[number];

  // Quem aparece no banner e a linha de destaque.
  let nomes: string[] = [];
  let destaque = "";
  let fotoPrincipal: string | null = null;
  let selecao: ReturnType<typeof montarSelecao> | null = null;
  if (d) {
    const est = calcularEstatisticas(d);
    const pr = calcularPremios(est);
    const ids = (x: string[]) => x.filter((id) => porId.has(id));
    const quem: Record<Tipo, string[]> = {
      artilheiro: ids(pr.artilheiro.ids),
      garcom: ids(pr.garcom.ids),
      muralha: ids(pr.muralha.ids),
      craque: periodo === "dia" ? ids(pr.craque.ids) : ids(premioPorDias(d, "craque")),
      bagre: periodo === "dia" ? ids(pr.bagre.ids) : ids(premioPorDias(d, "bagre")),
      campeao: [],
      selecao: [],
    };
    if (tipo === "campeao") {
      if (periodo === "dia" && d.sorteios[0]) {
        const s = d.sorteios[0];
        const vit = s.times.map((_, t) => d.partidas.filter((p) => p.status === "encerrada" && vencedorDe(p) === t).length);
        const t = vit.indexOf(Math.max(...vit));
        nomes = s.times[t].filter((id) => porId.has(id)).map((id) => nomeCurto(porId.get(id) as Membro));
        destaque = `${NOMES_TIMES[t]} · ${vit[t]} vitórias`;
      } else {
        const v = pr.maisVitorioso;
        nomes = ids(v.ids).map((id) => nomeCurto(porId.get(id) as Membro));
        destaque = `${v.valor} vitórias · "joga comigo que é vitória"`;
        fotoPrincipal = v.ids[0] && porId.get(v.ids[0])?.profile_id ? (fotos.get(porId.get(v.ids[0])?.profile_id as string) ?? null) : null;
      }
    } else if (tipo === "selecao") {
      selecao = montarSelecao(elenco, est);
    } else {
      const lista = quem[tipo];
      nomes = lista.map((id) => nomeCurto(porId.get(id) as Membro));
      const l = lista[0] ? est.get(lista[0]) : null;
      destaque = !l
        ? ""
        : tipo === "artilheiro"
          ? `${l.gols} gols`
          : tipo === "garcom"
            ? `${l.assist} assistências`
            : tipo === "muralha"
              ? `${l.goleiro.sofridos} gols sofridos em ${l.goleiro.jogos} jogos`
              : tipo === "craque"
                ? `${l.votos.craque} votos`
                : `${l.votos.bagre} votos (na zoeira)`;
      const m = lista[0] ? porId.get(lista[0]) : null;
      fotoPrincipal = m?.profile_id ? (fotos.get(m.profile_id) ?? null) : null;
    }
  }
  const foto = fotoExtra ?? fotoPrincipal;
  const story = formato === "story";
  const largura = 360;
  const altura = story ? 640 : 360;

  async function gerar(acao: "baixar" | "zap") {
    if (!ref.current) return;
    const url = await gerarPng(ref.current, { escala: 3 }); // 360 × 3 = 1080 px
    const nome = `${slug}-${tipo}-${periodo}-${formato}.png`;
    if (acao === "baixar") baixarDataUrl(url, nome);
    else await compartilharDataUrl(url, nome, `${info.ico} ${info.titulo} · ${pelada!.nome}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-6">
      <Topo titulo="Banners" sub={`${pelada.nome} · ${rotuloPeriodo.toLowerCase()}`} voltar="/mais" />

      <Escolha
        rotulo="Período"
        valor={periodo}
        aoMudar={setPeriodo}
        opcoes={[
          { valor: "dia", rotulo: "Do dia" },
          { valor: "semana", rotulo: "Da semana" },
          { valor: "mes", rotulo: "Do mês" },
        ]}
      />
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {TIPOS.map((t) => (
          <button
            key={t.valor}
            type="button"
            aria-pressed={tipo === t.valor}
            onClick={() => setTipo(t.valor)}
            className={`h-9 shrink-0 rounded-full border px-3 text-sm font-semibold ${tipo === t.valor ? "border-noite bg-noite text-white" : "border-borda bg-white"}`}
          >
            {t.ico} {t.rotulo}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Escolha rotulo="Formato" valor={formato} aoMudar={setFormato} opcoes={[{ valor: "story", rotulo: "Story" }, { valor: "quadrado", rotulo: "Quadrado" }]} />
        <div className="flex gap-1.5">
          {CORES.map((c) => (
            <button key={c} type="button" aria-label={`Fundo ${c}`} onClick={() => setCor(c)} className={`h-8 w-8 rounded-full border-2 ${fundo === c ? "border-tinta" : "border-white"}`} style={{ background: c }} />
          ))}
        </div>
      </div>

      {!d && <Carregando />}
      {d && (
        <div className="flex justify-center overflow-hidden">
          <div
            ref={ref}
            className="relative flex shrink-0 flex-col items-center overflow-hidden text-white"
            style={{ width: largura, height: altura, background: `radial-gradient(circle at 50% 30%, ${fundo} 0%, #0B0710 95%)`, padding: story ? "36px 24px" : "20px 20px" }}
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/30 bg-white/10 text-[10px] font-bold text-white/70">
                {pelada.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pelada.logo_url} alt="" crossOrigin="anonymous" className="h-full w-full object-contain" />
                ) : (
                  "LOGO"
                )}
              </div>
              <span className="text-right text-[11px] font-semibold tracking-wider text-white/80">
                {pelada.nome.toUpperCase()}
                <br />
                {rotuloPeriodo.toUpperCase()}
              </span>
            </div>

            <div className={`flex flex-1 flex-col items-center justify-center text-center ${story ? "gap-4" : "gap-2"}`}>
              <span className={story ? "text-6xl" : "text-4xl"}>{info.ico}</span>
              <span className={`font-display font-bold tracking-tight ${story ? "text-5xl" : "text-3xl"}`}>{info.titulo}</span>
              {tipo !== "selecao" && tipo !== "campeao" && (
                <div
                  className={`flex items-center justify-center overflow-hidden rounded-full border-4 border-white/80 bg-white/10 font-display font-bold ${story ? "h-40 w-40 text-5xl" : "h-24 w-24 text-3xl"}`}
                >
                  {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={foto} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />
                  ) : (
                    (nomes[0] ?? "?").slice(0, 2).toUpperCase()
                  )}
                </div>
              )}
              {tipo === "selecao" && selecao ? (
                <div className="flex flex-col gap-2 text-lg font-semibold">
                  <span>⚽ {selecao.ataque.map(nomeCurto).join(" · ") || "—"}</span>
                  <span>🎯 {selecao.meio.map(nomeCurto).join(" · ") || "—"}</span>
                  <span>🧤 {selecao.goleiro ? nomeCurto(selecao.goleiro) : "—"}</span>
                </div>
              ) : (
                <span className={`font-display font-bold ${tipo === "campeao" ? (story ? "text-2xl leading-snug" : "text-lg") : story ? "text-4xl" : "text-2xl"}`}>
                  {nomes.length ? nomes.join(tipo === "campeao" ? ", " : " e ") : "Ainda sem vencedor"}
                </span>
              )}
              {destaque && <span className={`rounded-full bg-white/15 px-4 py-1.5 font-semibold ${story ? "text-lg" : "text-sm"}`}>{destaque}</span>}
            </div>

            <span className="text-[11px] font-semibold tracking-widest text-white/70">{pelada.nome.toUpperCase()} · MA SORTEIO</span>
          </div>
        </div>
      )}

      <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-borda bg-white py-3 text-sm font-semibold text-roxo">
        {fotoExtra ? "Trocar a foto do banner" : "Usar outra foto no banner (opcional)"}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => setFotoExtra(String(r.result));
            r.readAsDataURL(f);
          }}
        />
      </label>
      <p className="text-center text-xs text-apagado">A logo vem da configuração da pelada. A foto é a do jogador, ou a que você escolher.</p>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => gerar("baixar")} className="h-12 rounded-xl border-2 border-noite bg-white font-semibold">
          Baixar banner
        </button>
        <button type="button" onClick={() => gerar("zap")} className="h-12 rounded-xl bg-zap font-semibold text-white">
          Mandar no Zap
        </button>
      </div>
    </main>
  );
}
