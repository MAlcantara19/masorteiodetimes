"use client";
// Configuração da pelada (admin): dados, logo e o PIN do dia pro ao vivo.
import ConfigLista from "@/components/ConfigLista";
import ConfigAvisos from "@/components/ConfigAvisos";
import { useCallback, useEffect, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { usePelada } from "@/lib/pelada";
import Topo, { Carregando } from "@/components/Topo";
import FormPelada from "@/components/FormPelada";
import QrPix from "@/components/QrPix";
import type { Pelada } from "@/lib/pelada";
import Camisa, { ESTILOS_CAMISA, resolverCamisa, siglaDe, type EstiloCamisa, type OpcoesCamisa } from "@/components/Camisa";
import Bloqueado from "@/components/Bloqueado";
import { Escolha, Interruptor } from "@/components/Folha";
import { PALETA } from "@/lib/cores";
import { temRecurso } from "@/lib/planos";

function Bolinhas({ valor, mudar, rotulo }: { valor: string; mudar: (c: string) => void; rotulo: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{rotulo}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {[...PALETA, "#FFFFFF"].map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={valor.toUpperCase() === c}
            onClick={() => mudar(c)}
            className={`h-8 w-8 rounded-full border ${valor.toUpperCase() === c ? "ring-2 ring-tinta ring-offset-2" : "border-borda"}`}
            style={{ background: c }}
          />
        ))}
        <label className="flex h-8 items-center gap-1 rounded-full border border-borda px-2 text-xs font-semibold">
          Outra
          <input type="color" value={valor} onChange={(e) => mudar(e.target.value.toUpperCase())} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" />
        </label>
      </div>
    </div>
  );
}

// Cores da pelada e a camisa montada peça por peça (o app inteiro fica com a cor escolhida).
function ConfigCores({ pelada, nomeAdmin, numeroAdmin, aoSalvar }: { pelada: Pelada; nomeAdmin: string; numeroAdmin: number; aoSalvar: () => void }) {
  const inicial = resolverCamisa(pelada.camisa_estilo, pelada.camisa);
  const [cor, setCor] = useState(pelada.cor_banner || "#7444D6");
  const [cor2, setCor2] = useState(pelada.cor_secundaria || "#FFFFFF");
  const [estilo, setEstilo] = useState<EstiloCamisa>(inicial.modelo);
  const [op, setOp] = useState<OpcoesCamisa>({ ...inicial.op, cor3: inicial.op.cor3 ?? null });
  const [menu, setMenu] = useState(pelada.cor_menu === "claro" || pelada.cor_menu === "escuro" ? pelada.cor_menu : "cor");
  const [erro, setErro] = useState<string | null>(null);
  const mudar = (n: Partial<OpcoesCamisa>) => setOp({ ...op, ...n });

  // Trocar de modelo usa a gola/tom sugeridos dele, mantendo as cores escolhidas.
  function escolherModelo(m: EstiloCamisa) {
    setEstilo(m);
    const sugestao = ESTILOS_CAMISA.find((e) => e.valor === m)?.padrao ?? {};
    setOp({ ...op, ...sugestao });
  }

  async function salvar() {
    const sb = criarClienteSupabase();
    const { error } = await sb.from("peladas").update({ cor_banner: cor, cor_secundaria: cor2, camisa_estilo: estilo }).eq("id", pelada.id);
    if (error) return setErro(/check/i.test(error.message) ? "Esse modelo novo precisa do SQL 0009 no Supabase." : "Não deu pra salvar: " + error.message);
    const r = await sb.from("peladas").update({ camisa: op, cor_menu: menu }).eq("id", pelada.id);
    if (r.error) return setErro("Cores salvas. A camisa montada e a cor do menu precisam do SQL 0009 no Supabase.");
    setErro(null);
    aoSalvar();
  }

  const opcoesEscolha = <T extends string>(rotulo: string, valor: T, set: (v: T) => void, opcoes: { valor: T; rotulo: string }[]) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{rotulo}</span>
      <Escolha rotulo={rotulo} valor={valor} aoMudar={set} opcoes={opcoes} />
    </div>
  );

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
      <span className="font-semibold">Cores e camisa da pelada</span>
      <div className="sticky top-2 z-10 flex justify-center gap-2 rounded-2xl bg-fundo py-3 shadow-sm">
        <Camisa cor={cor} cor2={cor2} estilo={estilo} opcoes={op} logo={pelada.logo_url} sigla={siglaDe(pelada.nome)} largura={140} />
        <Camisa cor={cor} cor2={cor2} estilo={estilo} opcoes={op} costas={{ nome: nomeAdmin, numero: numeroAdmin }} largura={140} />
      </div>
      <Bolinhas rotulo="Cor principal (vira a cor do app nesta pelada)" valor={cor} mudar={setCor} />
      <Bolinhas rotulo="Cor do detalhe (gola, punho e frisos)" valor={cor2} mudar={setCor2} />

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Modelo</span>
        <div className="grid grid-cols-4 gap-1.5">
          {ESTILOS_CAMISA.map((e) => (
            <button
              key={e.valor}
              type="button"
              onClick={() => escolherModelo(e.valor)}
              aria-pressed={estilo === e.valor}
              className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-1 pt-1.5 pb-1 text-[11px] leading-tight font-semibold ${estilo === e.valor ? "border-roxo bg-roxo-suave text-roxo-escuro" : "border-transparent bg-fundo"}`}
            >
              <Camisa cor={cor} cor2={cor2} estilo={e.valor} opcoes={{ ...(e.padrao ?? {}), cor3: op.cor3 }} sigla={siglaDe(pelada.nome)} logo={pelada.logo_url} largura={58} />
              {e.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-fundo p-3">
        <span className="text-xs font-bold tracking-wider text-apagado">MONTE A CAMISA</span>
        {estilo !== "lisa" &&
          opcoesEscolha("Desenho", op.tom ?? "contraste", (v) => mudar({ tom: v }), [
            { valor: "tom", rotulo: "Tom sobre tom" },
            { valor: "contraste", rotulo: "Em destaque" },
          ])}
        {estilo !== "lisa" && op.tom !== "tom" && <Bolinhas rotulo="Cor do desenho" valor={op.cor3 || cor2} mudar={(c) => mudar({ cor3: c })} />}
        {opcoesEscolha("Gola", op.gola ?? "redonda", (v) => mudar({ gola: v }), [
          { valor: "redonda", rotulo: "Redonda" },
          { valor: "v", rotulo: "V" },
          { valor: "retro", rotulo: "Retrô" },
          { valor: "polo", rotulo: "Polo" },
        ])}
        {opcoesEscolha("Mangas", op.mangas ?? "iguais", (v) => mudar({ mangas: v }), [
          { valor: "iguais", rotulo: "Iguais" },
          { valor: "detalhe", rotulo: "Cor do detalhe" },
          { valor: "raglan", rotulo: "Ombro e manga" },
        ])}
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold">Friso no ombro</span>
          <Interruptor rotulo="Friso no ombro" ligado={!!op.friso} aoMudar={(v) => mudar({ friso: v })} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Barra de menu (embaixo)</span>
        <Escolha
          rotulo="Cor do menu"
          valor={menu}
          aoMudar={setMenu}
          opcoes={[
            { valor: "cor", rotulo: "Cor da pelada" },
            { valor: "claro", rotulo: "Branca" },
            { valor: "escuro", rotulo: "Escura" },
          ]}
        />
      </div>
      <span className="text-xs text-apagado">Cor muito clara? O app escurece um pouco os botões pra continuar dando pra ler.</span>
      {erro && <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{erro}</p>}
      <button type="button" onClick={salvar} className="h-11 rounded-xl bg-roxo font-semibold text-white">
        Salvar cores e camisa
      </button>
    </section>
  );
}

// Chave Pix da pelada (pra mensalidade). Aparece pra galera na tela Mensalidade.
function ConfigPix({ pelada, aoSalvar }: { pelada: Pelada; aoSalvar: () => void }) {
  const [chave, setChave] = useState(pelada.pix_chave ?? "");
  const [nome, setNome] = useState(pelada.pix_nome ?? "");
  const [cidade, setCidade] = useState(pelada.pix_cidade ?? "");
  const [diaria, setDiaria] = useState(pelada.valor_diaria ? String(pelada.valor_diaria).replace(".", ",") : "");
  const [erro, setErro] = useState<string | null>(null);
  async function salvar() {
    const { error } = await criarClienteSupabase()
      .from("peladas")
      .update({ pix_chave: chave.trim() || null, pix_nome: nome.trim() || null, pix_cidade: cidade.trim() || null })
      .eq("id", pelada.id);
    if (error) return setErro("Pra salvar o Pix, rode no Supabase o SQL novo (supabase/migrations/0003).");
    const v = Number(diaria.replace(",", ".")) || null;
    if (v !== (pelada.valor_diaria ? Number(pelada.valor_diaria) : null)) {
      const r = await criarClienteSupabase().from("peladas").update({ valor_diaria: v }).eq("id", pelada.id);
      if (r.error) return setErro("Pra salvar a diária, rode no Supabase o SQL novo (supabase/migrations/0006).");
    }
    setErro(null);
    aoSalvar();
  }
  const campo = "h-11 rounded-xl border border-borda px-3 text-[15px] font-normal";
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
      <span className="font-semibold">Pix da pelada</span>
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
      <label className="flex flex-col gap-1 text-[13px] font-semibold">
        Valor da diária (quem paga por pelada)
        <input value={diaria} onChange={(e) => setDiaria(e.target.value)} inputMode="decimal" className={campo} placeholder="15" />
      </label>
      <span className="text-xs text-apagado">
        Celular no formato +55 DDD número. A chave aparece pra galera da pelada na hora de pagar. A mensalidade fica em Dados da pelada{pelada.mensalidade ? ` (hoje R$ ${String(pelada.mensalidade).replace(".", ",")})` : ""}.
      </span>
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
  const { carregando, usuario, perfil, ehAdmin, ehMaster, recarregar: recarregarSessao } = useSessao();
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

      <ConfigLista key={`lista-${pelada.id}`} pelada={pelada} aoSalvar={() => { recarregar(); recarregarSessao(); setAviso("Lista salva!"); }} />

      <ConfigAvisos key={`avisos-${pelada.id}`} pelada={pelada} aoSalvar={() => { recarregar(); setAviso("Lembretes e divulgação salvos!"); }} />

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
      {temRecurso(pelada, "cores", ehMaster) ? (
        <ConfigCores
          key={pelada.id}
          pelada={pelada}
          nomeAdmin={perfil?.apelido || perfil?.nome?.split(" ")[0] || "Craque"}
          numeroAdmin={perfil?.numero_camisa ?? 10}
          aoSalvar={() => {
            recarregar();
            recarregarSessao();
            setAviso("Cores salvas! O app já está com a cara da pelada.");
          }}
        />
      ) : (
        <Bloqueado titulo="Cores e camisa da pelada" pelada={pelada.nome} admin />
      )}
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
