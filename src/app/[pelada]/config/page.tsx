"use client";
// Configuração da pelada (admin): dados, logo e o PIN do dia pro ao vivo.
import { useCallback, useEffect, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { usePelada } from "@/lib/pelada";
import Topo, { Carregando } from "@/components/Topo";
import FormPelada from "@/components/FormPelada";
import QrPix from "@/components/QrPix";
import type { Pelada } from "@/lib/pelada";

// Chave Pix da pelada (pra mensalidade). Aparece pra galera na tela Mensalidade.
function ConfigPix({ pelada, aoSalvar }: { pelada: Pelada; aoSalvar: () => void }) {
  const [chave, setChave] = useState(pelada.pix_chave ?? "");
  const [nome, setNome] = useState(pelada.pix_nome ?? "");
  const [cidade, setCidade] = useState(pelada.pix_cidade ?? "");
  const [erro, setErro] = useState<string | null>(null);
  async function salvar() {
    const { error } = await criarClienteSupabase()
      .from("peladas")
      .update({ pix_chave: chave.trim() || null, pix_nome: nome.trim() || null, pix_cidade: cidade.trim() || null })
      .eq("id", pelada.id);
    if (error) return setErro("Pra salvar o Pix, rode no Supabase o SQL novo (supabase/migrations/0003).");
    setErro(null);
    aoSalvar();
  }
  const campo = "h-11 rounded-xl border border-borda px-3 text-[15px] font-normal";
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
      <span className="font-semibold">Pix da mensalidade</span>
      <label className="flex flex-col gap-1 text-[13px] font-semibold">
        Chave Pix (celular, e-mail, CPF ou aleatória)
        <input value={chave} onChange={(e) => setChave(e.target.value)} className={campo} placeholder="+5524999999999" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Nome de quem recebe
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} placeholder="Matheus Alcântara" />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Cidade
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} className={campo} placeholder="Resende" />
        </label>
      </div>
      <span className="text-xs text-apagado">Celular no formato +55 DDD número. A chave aparece pra galera da pelada na hora de pagar.</span>
      {erro && <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{erro}</p>}
      <button type="button" onClick={salvar} className="h-11 rounded-xl bg-roxo font-semibold text-white">
        Salvar Pix
      </button>
      {pelada.pix_chave && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-roxo">Ver o QR Code de teste</summary>
          <div className="pt-3">
            <QrPix chave={pelada.pix_chave} nome={pelada.pix_nome || pelada.nome} cidade={pelada.pix_cidade || "BRASIL"} valor={pelada.mensalidade ? Number(pelada.mensalidade) : null} />
          </div>
        </details>
      )}
    </section>
  );
}

export default function ConfigPage() {
  const { pelada, naoAchou, recarregar } = usePelada();
  const { carregando, usuario, ehAdmin, recarregar: recarregarSessao } = useSessao();
  const admin = pelada ? ehAdmin(pelada.id) : false;
  const [pin, setPin] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregarPin = useCallback(async () => {
    if (!pelada || !admin) return;
    const { data } = await criarClienteSupabase().from("pelada_pins").select("pin").eq("pelada_id", pelada.id).maybeSingle();
    setPin(data?.pin ?? null);
  }, [pelada, admin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarPin();
  }, [carregarPin]);

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando) return <Carregando />;
  if (!usuario || !admin) return <main className="p-6 text-center text-apagado">Só admin configura a pelada.</main>;

  async function novoPin() {
    if (!pelada) return;
    const n = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    await criarClienteSupabase().from("pelada_pins").upsert({ pelada_id: pelada.id, pin: n });
    setPin(n);
  }

  async function enviarLogo(arq: File) {
    if (!pelada || !usuario) return;
    const sb = criarClienteSupabase();
    const caminho = `${usuario.id}/logo-${pelada.slug}-${Date.now()}.${arq.name.split(".").pop() || "png"}`;
    const up = await sb.storage.from("imagens").upload(caminho, arq, { contentType: arq.type });
    if (up.error) return setAviso("Não deu pra enviar a logo.");
    const url = sb.storage.from("imagens").getPublicUrl(caminho).data.publicUrl;
    await sb.from("peladas").update({ logo_url: url }).eq("id", pelada.id);
    recarregar();
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Configurar pelada" sub={pelada.nome} voltar="/mais" />

      <section className="flex flex-col gap-2 rounded-2xl bg-noite p-4 text-white">
        <span className="text-sm text-[#CFC7E0]">PIN do ao vivo (pra quem vai marcar o placar sem ter conta; quem é da pelada e está logado já mexe)</span>
        <div className="flex items-center justify-between">
          <span className="font-display text-4xl font-bold tracking-[0.3em] text-roxo-claro">{pin ?? "····"}</span>
          <button type="button" onClick={novoPin} className="h-10 rounded-xl bg-white/15 px-3 text-sm font-semibold">
            Gerar outro
          </button>
        </div>
      </section>

      <ConfigPix pelada={pelada} aoSalvar={() => { recarregar(); setAviso("Pix salvo!"); }} />

      <section className="flex items-center gap-4 rounded-2xl border border-borda bg-white p-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-roxo-suave text-xs text-roxo-escuro">
          {pelada.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pelada.logo_url} alt="Logo da pelada" className="h-full w-full object-contain" />
          ) : (
            "sem logo"
          )}
        </div>
        <label className="cursor-pointer rounded-xl border border-borda px-3 py-2 text-sm font-semibold text-roxo">
          {pelada.logo_url ? "Trocar logo" : "Enviar logo"}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && enviarLogo(e.target.files[0])} />
        </label>
      </section>
      {aviso && <p className="rounded-xl bg-roxo-suave px-3 py-2 text-sm text-roxo-escuro">{aviso}</p>}

      <section className="rounded-2xl border border-borda bg-white p-4">
        <FormPelada
          key={pelada.id + pelada.nome}
          pelada={pelada}
          aoSalvar={() => {
            recarregar();
            recarregarSessao();
            setAviso("Salvo!");
          }}
        />
      </section>
    </main>
  );
}
