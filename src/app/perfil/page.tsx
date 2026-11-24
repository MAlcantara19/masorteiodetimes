"use client";
// Meu perfil: nome, apelido e foto. No primeiro acesso é obrigatório passar por aqui.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import Topo, { Carregando } from "@/components/Topo";

export default function PerfilPage() {
  const router = useRouter();
  const { carregando, usuario, perfil, recarregar, sair } = useSessao();
  const [nome, setNome] = useState("");
  const [apelido, setApelido] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
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
  }, [perfil]);

  async function enviarFoto(arquivo: File) {
    if (!usuario) return;
    setErro(null);
    const sb = criarClienteSupabase();
    const ext = arquivo.name.split(".").pop()?.toLowerCase() || "jpg";
    const caminho = `${usuario.id}/foto-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from("imagens").upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });
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
    setSalvando(true);
    const { error } = await criarClienteSupabase()
      .from("profiles")
      .update({ nome: nome.trim(), apelido: apelido.trim() || null, foto_url: foto, perfil_completo: true })
      .eq("id", usuario.id);
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
      <Topo titulo={primeiro ? "Bem-vindo!" : "Meu perfil"} sub={primeiro ? "Só falta seu nome e apelido" : perfil.email ?? undefined} voltar={primeiro ? undefined : "/mais"} />

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

        {erro && (
          <p role="alert" className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">
            {erro}
          </p>
        )}

        <button type="submit" disabled={salvando} className="h-12 rounded-xl bg-roxo font-semibold text-white disabled:opacity-60">
          {salvando ? "Salvando…" : primeiro ? "Começar" : "Salvar"}
        </button>
      </form>

      {!primeiro && (
        <button type="button" onClick={sair} className="h-12 rounded-xl border border-borda bg-white font-semibold text-alerta">
          Sair da conta
        </button>
      )}
    </main>
  );
}
