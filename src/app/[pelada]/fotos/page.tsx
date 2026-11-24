"use client";
// Galeria de fotos do dia: quem é da pelada manda foto; o autor ou os admins podem apagar.
import { useCallback, useEffect, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { usePelada } from "@/lib/pelada";
import { ultimoEvento, type Evento } from "@/lib/evento";
import { curtaDia } from "@/lib/datas";
import Topo, { Carregando } from "@/components/Topo";

type Foto = { id: string; evento_id: string; autor_id: string | null; url: string; legenda: string | null; created_at: string };

// Diminui a foto antes de enviar (economiza espaço e internet).
async function reduzir(arquivo: File, max = 1600): Promise<Blob> {
  const img = await createImageBitmap(arquivo);
  const escala = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * escala);
  canvas.height = Math.round(img.height * escala);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((ok) => canvas.toBlob((b) => ok(b ?? arquivo), "image/jpeg", 0.85));
}

export default function FotosPage() {
  const { pelada, naoAchou } = usePelada();
  const { usuario, vinculos, ehAdmin } = useSessao();
  const admin = !!pelada && ehAdmin(pelada.id);
  const membro = !!pelada && (admin || vinculos.some((v) => v.pelada.id === pelada.id));
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [fotos, setFotos] = useState<Foto[] | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [aberta, setAberta] = useState<Foto | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!pelada) return;
    const sb = criarClienteSupabase();
    const { data: evs } = await sb.from("eventos").select("*").eq("pelada_id", pelada.id).neq("status", "cancelado").order("data", { ascending: false }).limit(20);
    const lista = (evs ?? []) as Evento[];
    setEventos(lista);
    const ids = lista.map((e) => e.id);
    const { data } = ids.length ? await sb.from("fotos").select("*").in("evento_id", ids).order("created_at", { ascending: false }) : { data: [] };
    setFotos((data ?? []) as Foto[]);
  }, [pelada]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
  }, [carregar]);

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || !fotos) return <Carregando />;

  async function enviar(arquivos: FileList) {
    if (!usuario || !pelada) return;
    const ev = await ultimoEvento(pelada.id);
    if (!ev) return setAviso("Ainda não tem pelada registrada pra pôr foto.");
    setEnviando(true);
    const sb = criarClienteSupabase();
    for (const arq of Array.from(arquivos).slice(0, 10)) {
      const blob = await reduzir(arq).catch(() => arq);
      const caminho = `${usuario.id}/fotos/${ev.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
      const up = await sb.storage.from("imagens").upload(caminho, blob, { contentType: "image/jpeg" });
      if (up.error) {
        setAviso("Não deu pra enviar uma das fotos.");
        continue;
      }
      const url = sb.storage.from("imagens").getPublicUrl(caminho).data.publicUrl;
      await sb.from("fotos").insert({ evento_id: ev.id, autor_id: usuario.id, url });
    }
    setEnviando(false);
    carregar();
  }

  async function apagar(f: Foto) {
    if (!confirm("Apagar esta foto?")) return;
    await criarClienteSupabase().from("fotos").delete().eq("id", f.id);
    setAberta(null);
    carregar();
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Fotos" sub={pelada.nome} voltar="/mais" />
      {membro && usuario && (
        <label className={`flex h-12 cursor-pointer items-center justify-center rounded-xl bg-roxo font-semibold text-white ${enviando ? "opacity-60" : ""}`}>
          {enviando ? "Enviando…" : "Mandar fotos da última pelada"}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={enviando} onChange={(e) => e.target.files && enviar(e.target.files)} />
        </label>
      )}
      {aviso && <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{aviso}</p>}

      {eventos
        .filter((e) => fotos.some((f) => f.evento_id === e.id))
        .map((e) => (
          <section key={e.id} className="flex flex-col gap-2">
            <span className="text-xs font-bold tracking-wider text-apagado">PELADA DE {curtaDia(e.data)}</span>
            <div className="grid grid-cols-3 gap-1.5">
              {fotos
                .filter((f) => f.evento_id === e.id)
                .map((f) => (
                  <button key={f.id} type="button" onClick={() => setAberta(f)} className="aspect-square overflow-hidden rounded-lg bg-borda">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
            </div>
          </section>
        ))}
      {!fotos.length && <p className="text-sm text-apagado">Nenhuma foto ainda.</p>}

      {aberta && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/90 p-4" onClick={() => setAberta(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={aberta.url} alt="" className="max-h-[80vh] max-w-full rounded-lg object-contain" />
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <a href={aberta.url} download target="_blank" rel="noreferrer" className="rounded-xl bg-white px-4 py-2 font-semibold">
              Baixar
            </a>
            {(admin || aberta.autor_id === usuario?.id) && (
              <button type="button" onClick={() => apagar(aberta)} className="rounded-xl bg-alerta px-4 py-2 font-semibold text-white">
                Apagar
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
