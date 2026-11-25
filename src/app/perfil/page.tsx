"use client";
// Meu perfil: nome, apelido, foto e o cadastro (WhatsApp, aniversário, onde joga, pé e como se avalia).
// No primeiro acesso é obrigatório passar por aqui; o WhatsApp é obrigatório (pra lembrete e cobrança).
// A autoavaliação só o admin vê (ajuda a dar a nota). Aqui também fica o modo noturno.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import Topo, { Carregando } from "@/components/Topo";
import { Escolha } from "@/components/Folha";
import { formatarZap, mascaraZap, normalizarZap } from "@/lib/whatsapp";
import { lerTema, salvarTema, type Tema } from "@/lib/tema";
import AtivarNotificacoes from "@/components/AtivarNotificacoes";
import { comprimirImagem } from "@/lib/comprimir";
import Link from "next/link";
import Camisa from "@/components/Camisa";

const NIVEIS = ["Tô começando", "Quebro o galho", "Jogo direitinho", "Jogo bem", "Sou craque"];

export default function PerfilPage() {
  const router = useRouter();
  const { carregando, usuario, perfil, recarregar, sair, vinculos } = useSessao();
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [numero, setNumero] = useState("");
  const [zap, setZap] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [posicao, setPosicao] = useState("");
  const [pe, setPe] = useState("");
  const [nivel, setNivel] = useState(0);
  const [tema, setTema] = useState<Tema>("auto");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const primeiro = perfil ? !perfil.perfil_completo : false;

  useEffect(() => {
    if (!carregando && !usuario) router.replace("/entrar");
  }, [carregando, usuario, router]);

  useEffect(() => {
    if (!perfil) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNome(perfil.nome);
    setApelido(perfil.apelido ?? "");
    setFoto(perfil.foto_url);
    setNumero(perfil.numero_camisa != null ? String(perfil.numero_camisa) : "");
    setZap(mascaraZap(formatarZap(perfil.whatsapp)));
    setNascimento(perfil.nascimento ?? "");
    setPosicao(perfil.posicao ?? "");
    setPe(perfil.pe ?? "");
    setNivel(perfil.autoavaliacao ?? 0);
    setTema(lerTema());
  }, [perfil]);

  async function enviarFoto(arquivo: File) {
    if (!usuario) return;
    setErro(null);
    const sb = criarClienteSupabase();
    // Foto mais leve: 600 px já sobra pra card e lista.
    const { blob, ext, tipo } = await comprimirImagem(arquivo, { lado: 600 });
    const caminho = `${usuario.id}/foto-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from("imagens").upload(caminho, blob, { upsert: true, contentType: tipo });
    if (error) {
      setErro("Não deu pra enviar a foto.");
      return;
    }
    setFoto(sb.storage.from("imagens").getPublicUrl(caminho).data.publicUrl);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario) return;
    if (!nome.trim()) {
      setErro("Coloca pelo menos o nome.");
      return;
    }
    const numeroZap = normalizarZap(zap);
    if (!numeroZap) {
      setErro("Coloca seu WhatsApp com DDD, tipo (24) 99999-9999. É por ele que chegam os lembretes e a cobrança.");
      return;
    }
    setSalvando(true);
    const sb = criarClienteSupabase();
    const { error } = await sb
      .from("profiles")
      .update({ nome: nome.trim(), apelido: apelido.trim() || null, foto_url: foto, perfil_completo: true })
      .eq("id", usuario.id);
    // Número da camisa (precisa do SQL 0005; sem ele, só não salva o número).
    const n = numero.trim() === "" ? null : Math.min(99, Math.max(0, Number(numero)));
    if (!error && (perfil?.numero_camisa ?? null) !== n) await sb.from("profiles").update({ numero_camisa: n }).eq("id", usuario.id);
    // Cadastro (SQL 0009). O aniversário vai também pra ficha da pessoa em cada pelada.
    if (!error) {
      const r = await sb
        .from("profiles")
        .update({ whatsapp: numeroZap, nascimento: nascimento || null, posicao: posicao || null, pe: pe || null, autoavaliacao: nivel || null })
        .eq("id", usuario.id);
      if (r.error) {
        setSalvando(false);
        setErro("Pra salvar o WhatsApp e o cadastro, o admin precisa rodar o SQL 0009 no Supabase.");
        return;
      }
      await sb.rpc("sincronizar_meu_cadastro");
    }
    setSalvando(false);
    if (error) {
      setErro("Não deu pra salvar. Tenta de novo.");
      return;
    }
    await recarregar();
    router.replace("/");
  }

  if (carregando || !perfil) return <Carregando />;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo={primeiro ? "Bem-vindo!" : "Meu perfil"} sub={primeiro ? "Só falta seu nome, apelido e WhatsApp" : perfil.email ?? undefined} voltar={primeiro ? undefined : "/mais"} />

      <form onSubmit={salvar} className="flex flex-col gap-4 rounded-2xl border border-borda bg-white p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-roxo-suave font-display text-2xl font-bold text-roxo-escuro">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="Sua foto" className="h-full w-full object-cover" />
            ) : (
              (apelido || nome || "?").slice(0, 1).toUpperCase()
            )}
          </div>
          <label className="cursor-pointer rounded-xl border border-borda px-3 py-2 text-sm font-semibold text-roxo">
            {foto ? "Trocar foto" : "Colocar foto (opcional)"}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && enviarFoto(e.target.files[0])} />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Nome
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Matheus Alcântara"
            className="h-[46px] rounded-xl border border-[#D8D0E6] px-3 text-[15px] font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Apelido (como a galera te chama)
          <input
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            placeholder="Alcântara"
            className="h-[46px] rounded-xl border border-[#D8D0E6] px-3 text-[15px] font-normal"
          />
        </label>

        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Número da camisa (opcional)
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, "").slice(0, 2))}
            inputMode="numeric"
            placeholder="10"
            className="h-[46px] w-28 rounded-xl border border-[#D8D0E6] px-3 text-[15px] font-normal"
          />
        </label>

        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          WhatsApp (obrigatório)
          <input
            value={zap}
            onChange={(e) => setZap(mascaraZap(e.target.value))}
            inputMode="tel"
            autoComplete="tel"
            placeholder="(24) 99999-9999"
            className="h-[46px] rounded-xl border border-[#D8D0E6] px-3 text-[15px] font-normal"
          />
          <span className="font-normal text-apagado">Só o admin da pelada vê. É por ele que chegam lembrete de pelada e cobrança.</span>
        </label>

        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          Aniversário (opcional)
          <input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} className="h-[46px] w-48 rounded-xl border border-[#D8D0E6] px-3 text-[15px] font-normal" />
          <span className="font-normal text-apagado">No dia, a pelada ganha uma carta de aniversário sua.</span>
        </label>

        <div className="flex flex-col gap-2 border-t border-borda pt-3">
          <span className="text-[13px] font-semibold">Onde você gosta de jogar? (opcional)</span>
          <Escolha
            rotulo="Onde joga"
            valor={posicao}
            aoMudar={setPosicao}
            opcoes={[
              { valor: "D", rotulo: "Defesa" },
              { valor: "M", rotulo: "Meio" },
              { valor: "A", rotulo: "Ataque" },
              { valor: "Q", rotulo: "Tanto faz" },
              { valor: "G", rotulo: "Gol" },
            ]}
          />
          <span className="text-[13px] font-semibold">Pé bom</span>
          <Escolha
            rotulo="Pé bom"
            valor={pe}
            aoMudar={setPe}
            opcoes={[
              { valor: "destro", rotulo: "Direito" },
              { valor: "canhoto", rotulo: "Esquerdo" },
              { valor: "ambos", rotulo: "Os dois" },
            ]}
          />
          <span className="text-[13px] font-semibold">Como você se avalia?</span>
          <div className="grid grid-cols-5 gap-1.5">
            {NIVEIS.map((t, i) => (
              <button
                key={t}
                type="button"
                aria-pressed={nivel === i + 1}
                onClick={() => setNivel(nivel === i + 1 ? 0 : i + 1)}
                className={`flex flex-col items-center rounded-xl border px-1 py-2 text-[11px] leading-tight font-semibold ${nivel === i + 1 ? "border-roxo bg-roxo text-white" : "border-borda"}`}
              >
                <span className="text-base">{"★".repeat(i + 1)}</span>
                {t}
              </button>
            ))}
          </div>
          <span className="text-xs text-apagado">Só o admin vê. Ajuda a montar times equilibrados, mas quem decide a nota é o admin.</span>
        </div>

        {erro && (
          <p role="alert" className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">
            {erro}
          </p>
        )}

        <button type="submit" disabled={salvando} className="h-12 rounded-xl bg-roxo font-semibold text-white disabled:opacity-60">
          {salvando ? "Salvando…" : primeiro ? "Começar" : "Salvar"}
        </button>
      </form>

      {!primeiro && vinculos.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
          <span className="font-semibold">Minhas peladas</span>
          {vinculos.map((v) => (
            <div key={v.membro_id} className="flex items-center gap-3 border-t border-borda pt-2 first:border-0 first:pt-0">
              <Camisa
                cor={v.pelada.cor_banner || "#7444D6"}
                cor2={v.pelada.cor_secundaria || "#FFFFFF"}
                estilo={v.pelada.camisa_estilo}
                opcoes={v.pelada.camisa}
                costas={{ nome: apelido || nome.split(" ")[0] || "Você", numero: numero || 10 }}
                largura={56}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{v.pelada.nome}</span>
                <span className="text-xs text-apagado">{v.papel === "admin" ? "admin" : "jogador"}</span>
              </span>
              <Link href={`/${v.pelada.slug}/jogador/${v.membro_id}`} className="shrink-0 rounded-full border border-borda px-3 py-1.5 text-xs font-semibold">
                Meus números
              </Link>
            </div>
          ))}
          <Link href="/perfil/card" className="text-center text-sm font-semibold text-roxo">
            Ver meu card →
          </Link>
        </section>
      )}

      <AtivarNotificacoes />

      <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
        <span className="font-semibold">Aparência</span>
        <Escolha
          rotulo="Tema"
          valor={tema}
          aoMudar={(t) => {
            setTema(t);
            salvarTema(t);
          }}
          opcoes={[
            { valor: "auto", rotulo: "Igual ao celular" },
            { valor: "claro", rotulo: "Claro" },
            { valor: "escuro", rotulo: "Noturno" },
          ]}
        />
      </section>

      {!primeiro && (
        <button type="button" onClick={sair} className="h-12 rounded-xl border border-borda bg-white font-semibold text-alerta">
          Sair da conta
        </button>
      )}
    </main>
  );
}
