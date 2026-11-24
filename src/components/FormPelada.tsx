"use client";
// Formulário de criar/editar pelada (nome, dia, horário, regra de fim etc.).
import { useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { criarSlug, SLUGS_RESERVADOS, type Pelada } from "@/lib/pelada";
import { DIAS } from "@/lib/datas";
import { Escolha } from "./Folha";

type Dados = Omit<Pelada, "id" | "logo_url" | "cor_banner" | "mensalidade"> & { mensalidade: string };

const campo = "h-11 rounded-xl border border-borda bg-white px-3 text-[15px] font-normal";
const rot = "flex flex-col gap-1 text-[13px] font-semibold";

export default function FormPelada({ pelada, aoSalvar }: { pelada?: Pelada; aoSalvar: (p: Pelada) => void }) {
  const [d, setD] = useState<Dados>({
    nome: pelada?.nome ?? "",
    slug: pelada?.slug ?? "",
    dia_semana: pelada?.dia_semana ?? 3,
    horario: pelada?.horario?.slice(0, 5) ?? "18:30",
    horario_fim: pelada?.horario_fim?.slice(0, 5) ?? "20:30",
    local: pelada?.local ?? "",
    regra_fim: pelada?.regra_fim ?? "tempo",
    minutos: pelada?.minutos ?? 7,
    gols_limite: pelada?.gols_limite ?? 2,
    regra_empate: pelada?.regra_empate ?? "sai_quem_ficou",
    lembrete_horas_antes: pelada?.lembrete_horas_antes ?? 2,
    mensalidade: pelada?.mensalidade ? String(pelada.mensalidade) : "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const slug = d.slug || criarSlug(d.nome);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!d.nome.trim()) return setErro("Coloca o nome da pelada.");
    if (!slug || SLUGS_RESERVADOS.includes(slug)) return setErro("Esse endereço não pode. Escolhe outro.");
    setSalvando(true);
    setErro(null);
    const sb = criarClienteSupabase();
    const linha = {
      ...d,
      nome: d.nome.trim(),
      slug,
      local: d.local?.trim() || null,
      horario: d.horario || null,
      horario_fim: d.horario_fim || null,
      mensalidade: d.mensalidade ? Number(d.mensalidade.replace(",", ".")) : null,
    };
    if (!pelada) {
      const { data: u } = await sb.auth.getUser();
      Object.assign(linha, { criado_por: u.user?.id });
    }
    const res = pelada
      ? await sb.from("peladas").update(linha).eq("id", pelada.id).select().single()
      : await sb.from("peladas").insert(linha).select().single();
    setSalvando(false);
    if (res.error) return setErro(res.error.code === "23505" ? "Já existe uma pelada com esse endereço." : "Não deu pra salvar.");
    aoSalvar(res.data as Pelada);
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-3">
      <label className={rot}>
        Nome
        <input className={campo} value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} placeholder="Bola Fora" />
      </label>
      <label className={rot}>
        Endereço do link
        <span className="flex items-center gap-1 text-sm font-normal text-apagado">
          …/p/
          <input className={`${campo} flex-1`} value={slug} onChange={(e) => setD({ ...d, slug: criarSlug(e.target.value) })} />
        </span>
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className={rot}>
          Dia
          <select className={campo} value={d.dia_semana ?? ""} onChange={(e) => setD({ ...d, dia_semana: e.target.value === "" ? null : Number(e.target.value) })}>
            {DIAS.map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
            <option value="">Sem dia fixo</option>
          </select>
        </label>
        <label className={rot}>
          Começa
          <input type="time" className={campo} value={d.horario ?? ""} onChange={(e) => setD({ ...d, horario: e.target.value })} />
        </label>
        <label className={rot}>
          Termina
          <input type="time" className={campo} value={d.horario_fim ?? ""} onChange={(e) => setD({ ...d, horario_fim: e.target.value })} />
        </label>
      </div>
      <label className={rot}>
        Local
        <input className={campo} value={d.local ?? ""} onChange={(e) => setD({ ...d, local: e.target.value })} placeholder="Quadra do clube" />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Quando a partida acaba</span>
        <Escolha
          rotulo="Regra de fim"
          valor={d.regra_fim}
          aoMudar={(v) => setD({ ...d, regra_fim: v })}
          opcoes={[
            { valor: "tempo", rotulo: "Só tempo" },
            { valor: "tempo_ou_gols", rotulo: "Tempo ou gols" },
            { valor: "gols", rotulo: "Só gols" },
          ]}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className={rot}>
          Minutos
          <input type="number" min={1} max={90} className={campo} value={d.minutos} onChange={(e) => setD({ ...d, minutos: Number(e.target.value) })} />
        </label>
        <label className={rot}>
          Gols pra acabar
          <input type="number" min={1} max={20} className={campo} value={d.gols_limite} onChange={(e) => setD({ ...d, gols_limite: Number(e.target.value) })} />
        </label>
        <label className={rot}>
          Lembrete (h antes)
          <input type="number" min={0} max={48} className={campo} value={d.lembrete_horas_antes} onChange={(e) => setD({ ...d, lembrete_horas_antes: Number(e.target.value) })} />
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Se empatar</span>
        <Escolha
          rotulo="Regra de empate"
          valor={d.regra_empate}
          aoMudar={(v) => setD({ ...d, regra_empate: v })}
          opcoes={[
            { valor: "sai_quem_ficou", rotulo: "Sai quem já estava" },
            { valor: "sai_os_dois", rotulo: "Saem os dois" },
            { valor: "penaltis", rotulo: "Pênaltis" },
          ]}
        />
      </div>
      <label className={rot}>
        Mensalidade por pessoa (R$, opcional)
        <input inputMode="decimal" className={campo} value={d.mensalidade} onChange={(e) => setD({ ...d, mensalidade: e.target.value })} placeholder="40" />
      </label>

      {erro && (
        <p role="alert" className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">
          {erro}
        </p>
      )}
      <button type="submit" disabled={salvando} className="h-12 rounded-xl bg-roxo font-semibold text-white disabled:opacity-60">
        {salvando ? "Salvando…" : pelada ? "Salvar" : "Criar pelada"}
      </button>
    </form>
  );
}
