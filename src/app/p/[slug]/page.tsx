"use client";
// Página pública da pelada: ao vivo, campeonato do mês, álbum, recordes e convite por link/QR code.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useSessao } from "@/lib/sessao";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { calcularEstatisticas, calcularPremios, carregarPeriodo, premioPorDias, type DadosPeriodo } from "@/lib/estatisticas";
import { DIAS, horaCurta, inicioMes, isoDia, nomeMes } from "@/lib/datas";
import { textoRegra } from "@/lib/partida";
import { Carregando } from "@/components/Topo";
import Capa from "@/components/Capa";
import Camisa, { siglaDe } from "@/components/Camisa";
import { temRecurso } from "@/lib/planos";

export default function PaginaPublica() {
  const { pelada, slug, naoAchou } = usePelada();
  const { usuario, perfil, ehAdmin } = useSessao();
  const admin = !!usuario && !!pelada && ehAdmin(pelada.id);
  const [d, setD] = useState<DadosPeriodo | null>(null);
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [convite, setConvite] = useState<{ link: string; qr: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!pelada) return;
    carregarPeriodo(pelada.id, inicioMes(), isoDia(new Date())).then(setD);
    carregarElenco(pelada.id, false).then(setElenco);
  }, [pelada]);

  useEffect(() => {
    if (!pelada || !admin) return;
    fetch(`/api/convite?pelada_id=${pelada.id}`)
      .then((r) => r.json())
      .then(async (j) => {
        if (!j.codigo) return;
        const link = `${window.location.origin}/p/${pelada.slug}/convite?c=${j.codigo}`;
        setConvite({ link, qr: await QRCode.toDataURL(link, { width: 480, margin: 1, color: { dark: "#1B1430", light: "#FFFFFF" } }) });
      })
      .catch(() => {});
  }, [pelada, admin]);

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const nome = (id: string) => (porId.get(id) ? nomeCurto(porId.get(id) as Membro) : "?");

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada) return <Carregando />;

  const est = d ? calcularEstatisticas(d) : null;
  const pr = est ? calcularPremios(est) : null;
  const top = est ? [...est.values()].filter((l) => l.jogos > 0).sort((a, b) => b.pontos - a.pontos).slice(0, 5) : [];
  const craque = d ? premioPorDias(d, "craque") : [];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Capa
        titulo={pelada.nome}
        voltar="/"
        logo={pelada.logo_url}
        sub={`${pelada.dia_semana !== null ? `${DIAS[pelada.dia_semana]} · ${horaCurta(pelada.horario)}${pelada.horario_fim ? ` às ${horaCurta(pelada.horario_fim)}` : ""}` : ""}${pelada.local ? ` · ${pelada.local}` : ""}`}
      >
        <span className="text-xs text-[#E8DEFF]">Partidas de {textoRegra(pelada)}</span>
      </Capa>

      <Link href={`/p/${slug}/ao-vivo`} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-alerta text-lg font-bold text-white">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" /> Placar ao vivo
      </Link>

      {pr && (
        <section className="grid grid-cols-3 gap-2 text-center">
          {[
            ["⭐ Craque", craque.map(nome).join(", ") || "—"],
            ["⚽ Artilheiro", pr.artilheiro.ids.map(nome).join(", ") || "—"],
            ["🏅 Vitorioso", pr.maisVitorioso.ids.map(nome).join(", ") || "—"],
          ].map(([r, v]) => (
            <div key={r} className="rounded-2xl border border-borda bg-white p-3">
              <div className="text-[11px] text-apagado">{r}</div>
              <div className="truncate text-sm font-semibold">{v}</div>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col rounded-2xl border border-borda bg-white p-4">
        <span className="pb-2 text-xs font-bold tracking-wider text-apagado">TOP 5 DE {nomeMes().toUpperCase()} · PONTOS</span>
        {top.map((l, i) => (
          <div key={l.membro_id} className="flex justify-between border-t border-borda py-2 text-sm">
            <span>
              <span className="font-display font-bold text-apagado">{i + 1}</span> <span className="font-semibold">{nome(l.membro_id)}</span>
            </span>
            <span className="tabular-nums text-apagado">
              {l.vitorias}V · {l.gols}G · <strong className="text-tinta">{l.pontos} pts</strong>
            </span>
          </div>
        ))}
        {!top.length && <span className="text-sm text-apagado">Ainda sem jogos neste mês.</span>}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Link href={`/${slug}/campeonato`} className="flex h-12 items-center justify-center rounded-xl border border-roxo bg-white font-semibold text-roxo">
          Campeonato e recordes
        </Link>
        <Link href={`/${slug}/album`} className="flex h-12 items-center justify-center rounded-xl border border-roxo bg-white font-semibold text-roxo">
          Álbum
        </Link>
        <Link href={`/p/${slug}/votar`} className="flex h-12 items-center justify-center rounded-xl border border-roxo bg-white font-semibold text-roxo">
          Votação
        </Link>
        <Link href={`/${slug}/fotos`} className="flex h-12 items-center justify-center rounded-xl border border-roxo bg-white font-semibold text-roxo">
          Fotos
        </Link>
      </div>

      {pelada.camisa_estilo && temRecurso(pelada, "cores") && (
        <section className="flex flex-col items-center gap-2 rounded-2xl border border-borda bg-white p-4">
          <span className="self-start text-xs font-bold tracking-wider text-apagado">A CAMISA DA {pelada.nome.toUpperCase()}</span>
          <div className="flex justify-center gap-2">
            <Camisa cor={pelada.cor_banner || "#7444D6"} cor2={pelada.cor_secundaria || "#FFFFFF"} estilo={pelada.camisa_estilo} logo={pelada.logo_url} sigla={siglaDe(pelada.nome)} largura={130} />
            <Camisa
              cor={pelada.cor_banner || "#7444D6"}
              cor2={pelada.cor_secundaria || "#FFFFFF"}
              estilo={pelada.camisa_estilo}
              costas={{ nome: perfil?.apelido || perfil?.nome?.split(" ")[0] || "Craque", numero: perfil?.numero_camisa ?? 10 }}
              largura={130}
            />
          </div>
        </section>
      )}

      {admin && convite && (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-borda bg-white p-4 text-center">
          <span className="font-semibold">Convite pra pelada (só admin vê)</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={convite.qr} alt="QR code do convite" className="h-48 w-48" />
          <span className="text-[13px] text-apagado">Quem escanear ou abrir o link entra no elenco (ou se liga ao nome que já existe).</span>
          <div className="grid w-full grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(convite.link).then(() => setCopiado(true)).catch(() => {})}
              className="h-11 rounded-xl border border-borda font-semibold"
            >
              {copiado ? "Copiado!" : "Copiar link"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Entra na ${pelada.nome} no MA Sorteio: ${convite.link}`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center rounded-xl bg-zap font-semibold text-white"
            >
              Mandar no Zap
            </a>
          </div>
        </section>
      )}

      <footer className="pt-2 text-center text-xs text-apagado">
        <Link href="/" className="font-semibold text-roxo">
          MA Sorteio de Times
        </Link>{" "}
        · Desenvolvido por Matheus Alcântara
      </footer>
    </main>
  );
}
