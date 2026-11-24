"use client";
// Elenco da pelada: busca, estrelas (só admin), posição, "sabe marcar", apelido, goleiro, convidado.
import { useCallback, useEffect, useMemo, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import {
  ATRIBUTOS,
  ATRIBUTOS_PADRAO,
  atributosParaEstrelas,
  carregarElenco,
  mediaAtributos,
  nomeCurto,
  usePelada,
  type Atributos,
  type Membro,
} from "@/lib/pelada";
import { carregarElenco as elencoLocal, formatarNota, NIVEIS, POSICOES } from "@/lib/elenco";
import { normalizar } from "@/lib/lista";
import type { Posicao } from "@/lib/sorteio";
import Estrelas from "@/components/Estrelas";
import Folha, { Escolha, Interruptor } from "@/components/Folha";
import Icone from "@/components/Icone";
import Topo, { Carregando } from "@/components/Topo";

const CURTO: Record<string, string> = {
  "0.5": "Começando", "1": "Muito fraco", "1.5": "Ruim", "2": "Básico", "2.5": "Abaixo da média",
  "3": "Na média", "3.5": "Acima da média", "4": "Bom", "4.5": "Carrega o time", "5": "Fora da curva",
};

type Rascunho = {
  id: string | null;
  nome: string;
  apelido: string;
  posicao: Posicao;
  sabe_marcar: boolean;
  goleiro: boolean;
  convidado: boolean;
  ativo: boolean;
  nota: number;
  modo: "simples" | "completa";
  atributos: Atributos;
  email: string;
  profile_id: string | null;
  apelidos: string; // outros nomes, separados por vírgula
};

function novoRascunho(): Rascunho {
  return {
    id: null, nome: "", apelido: "", posicao: "Q", sabe_marcar: false, goleiro: false, convidado: false, ativo: true,
    nota: 3, modo: "simples", atributos: { ...ATRIBUTOS_PADRAO }, email: "", profile_id: null, apelidos: "",
  };
}

export default function JogadoresPage() {
  const { pelada, naoAchou } = usePelada();
  const { carregando, usuario, ehAdmin } = useSessao();
  const admin = pelada ? ehAdmin(pelada.id) : false;
  const [elenco, setElenco] = useState<Membro[] | null>(null);
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [edit, setEdit] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [temLocal, setTemLocal] = useState(0);

  const recarregar = useCallback(async () => {
    if (!pelada) return;
    setElenco(await carregarElenco(pelada.id, admin));
  }, [pelada, admin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recarregar();
  }, [recarregar]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTemLocal(elencoLocal().length);
  }, []);

  const lista = useMemo(() => {
    const q = normalizar(busca);
    return (elenco ?? [])
      .filter((m) => mostrarInativos || m.ativo)
      .filter((m) => !q || normalizar(`${m.nome} ${m.apelido ?? ""} ${(m.apelidos ?? []).join(" ")}`).includes(q))
      .sort((a, b) => nomeCurto(a).localeCompare(nomeCurto(b)));
  }, [elenco, busca, mostrarInativos]);

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando || !elenco) return <Carregando />;
  if (!usuario || !admin) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-6">
        <Topo titulo="Jogadores" sub={pelada.nome} voltar="/" />
        <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">Só os admins da pelada mexem no elenco.</p>
      </main>
    );
  }

  function abrir(m: Membro) {
    const n = m.nota;
    setEdit({
      id: m.id, nome: m.nome, apelido: m.apelido ?? "", posicao: m.posicao, sabe_marcar: m.sabe_marcar, goleiro: m.goleiro,
      convidado: m.convidado, ativo: m.ativo, nota: n ? Number(n.nota_simples) : 3,
      modo: n?.usar_completa ? "completa" : "simples", atributos: n?.atributos ?? { ...ATRIBUTOS_PADRAO },
      email: "", profile_id: m.profile_id, apelidos: (m.apelidos ?? []).join(", "),
    });
  }

  async function salvar() {
    if (!edit || !pelada || !usuario) return;
    if (!edit.nome.trim()) return setAviso("Coloca o nome do jogador.");
    setSalvando(true);
    const sb = criarClienteSupabase();
    let profileId = edit.profile_id;
    if (edit.email.trim()) {
      const { data } = await sb.rpc("buscar_perfil", { p_email: edit.email.trim() });
      if (!data?.length) {
        setSalvando(false);
        return setAviso("Ninguém com esse e-mail entrou no app ainda. Peça pra pessoa entrar uma vez com o Google.");
      }
      profileId = data[0].id;
    }
    const dados = {
      pelada_id: pelada.id, nome: edit.nome.trim(), apelido: edit.apelido.trim() || null, posicao: edit.posicao,
      sabe_marcar: edit.sabe_marcar, goleiro: edit.goleiro, convidado: edit.convidado, ativo: edit.ativo, profile_id: profileId,
    };
    const apelidos = [...new Set(edit.apelidos.split(",").map((x) => x.trim()).filter(Boolean))];
    const salvarMembro = (d: object) =>
      edit.id ? sb.from("membros").update(d).eq("id", edit.id).select("id").single() : sb.from("membros").insert(d).select("id").single();
    let res = await salvarMembro({ ...dados, apelidos });
    // Banco ainda sem a coluna "apelidos" (SQL 0002 não rodado): salva o resto.
    if (res.error && /apelidos/.test(res.error.message)) res = await salvarMembro(dados);
    if (res.error || !res.data) {
      setSalvando(false);
      return setAviso(res.error?.code === "23505" ? "Essa pessoa já está no elenco." : "Não deu pra salvar.");
    }
    const completa = edit.modo === "completa";
    await sb.from("notas").upsert({
      membro_id: res.data.id,
      nota_simples: completa ? atributosParaEstrelas(edit.atributos) : edit.nota,
      atributos: completa || edit.id ? edit.atributos : null,
      usar_completa: completa,
      atualizado_por: usuario.id,
      updated_at: new Date().toISOString(),
    });
    setSalvando(false);
    setEdit(null);
    setAviso(null);
    recarregar();
  }

  async function importarLocal() {
    if (!pelada || !usuario) return;
    const locais = elencoLocal();
    const existentes = new Set((elenco ?? []).map((m) => normalizar(m.nome)));
    const novos = locais.filter((j) => !existentes.has(normalizar(j.nome)));
    if (!novos.length) return setAviso("Todo mundo deste aparelho já está no elenco.");
    const sb = criarClienteSupabase();
    const { data, error } = await sb
      .from("membros")
      .insert(novos.map((j) => ({ pelada_id: pelada.id, nome: j.nome, apelido: j.apelido || null, posicao: j.posicao, goleiro: j.goleiro })))
      .select("id, nome");
    if (error || !data) return setAviso("Não deu pra trazer o elenco.");
    const porNome = new Map(novos.map((j) => [j.nome, j]));
    await sb.from("notas").upsert(
      data.map((m) => ({ membro_id: m.id, nota_simples: porNome.get(m.nome)?.nota ?? 3, atualizado_por: usuario.id })),
    );
    setAviso(`${data.length} jogadores trazidos deste aparelho.`);
    recarregar();
  }

  const ativos = elenco.filter((m) => m.ativo).length;
  const media = edit ? mediaAtributos(edit.atributos) : 0;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 py-6">
      <Topo
        titulo="Jogadores"
        sub={pelada.nome}
        direita={
          <button type="button" aria-label="Adicionar jogador" onClick={() => setEdit(novoRascunho())} className="flex h-11 w-11 items-center justify-center rounded-full bg-roxo text-white">
            <Icone nome="somar" />
          </button>
        }
      />
      <label className="flex h-12 items-center gap-2 rounded-xl border border-borda bg-white px-3">
        <Icone nome="busca" tamanho={18} className="text-apagado" />
        <span className="sr-only">Buscar jogador</span>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar jogador" className="h-full flex-1 bg-transparent text-[15px] outline-none" />
      </label>
      <div className="flex items-center justify-between text-[13px] text-apagado">
        <span>Toca no jogador pra avaliar · {ativos} no elenco</span>
        <button type="button" onClick={() => setMostrarInativos(!mostrarInativos)} className="font-semibold text-roxo">
          {mostrarInativos ? "Esconder inativos" : "Ver inativos"}
        </button>
      </div>

      {aviso && !edit && (
        <p role="status" className="rounded-xl bg-roxo-suave px-3 py-2 text-sm text-roxo-escuro">
          {aviso}
        </p>
      )}

      {temLocal > 0 && elenco.length === 0 && (
        <button type="button" onClick={importarLocal} className="rounded-2xl border-2 border-dashed border-roxo bg-white p-4 text-left text-sm">
          <strong className="text-roxo">Trazer elenco deste aparelho</strong>
          <br />
          <span className="text-apagado">Achei {temLocal} jogadores salvos na versão sem login. Toca pra copiar com as estrelas.</span>
        </button>
      )}

      <div className="flex flex-col overflow-hidden rounded-2xl border border-borda bg-white">
        {lista.map((m) => {
          const n = m.nota ? Number(m.nota.nota_simples) : 3;
          return (
            <button key={m.id} type="button" onClick={() => abrir(m)} className={`flex items-center gap-3 border-b border-borda px-4 py-3 text-left last:border-0 ${m.ativo ? "" : "opacity-50"}`}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">
                  {nomeCurto(m)}
                  {m.goleiro && <span className="ml-1.5 rounded bg-roxo-suave px-1.5 py-0.5 text-[11px] text-roxo-escuro">GOL</span>}
                  {m.convidado && <span className="ml-1.5 rounded bg-alerta-suave px-1.5 py-0.5 text-[11px] text-alerta-escuro">convidado</span>}
                  {m.papel === "admin" && <span className="ml-1.5 rounded bg-noite px-1.5 py-0.5 text-[11px] text-white">admin</span>}
                </span>
                <span className="truncate text-[13px] text-apagado">
                  {CURTO[String(n)]} · {POSICOES[m.posicao]}
                  {m.apelido && m.apelido !== m.nome ? ` · ${m.nome}` : ""}
                </span>
              </span>
              <Estrelas valor={n} tamanho={16} />
              <span className="w-7 text-right font-display font-semibold tabular-nums">{formatarNota(n)}</span>
            </button>
          );
        })}
        {!lista.length && <p className="p-4 text-sm text-apagado">{busca ? "Ninguém com esse nome." : "Elenco vazio. Toca no + pra adicionar."}</p>}
      </div>

      <Folha aberta={!!edit} titulo={edit?.id ? nomeCurto({ nome: edit.nome, apelido: edit.apelido }) || "Jogador" : "Novo jogador"} aoFechar={() => setEdit(null)}>
        {edit && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[13px] font-semibold">
                Nome
                <input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} className="h-11 rounded-xl border border-borda px-3 text-[15px] font-normal" />
              </label>
              <label className="flex flex-col gap-1 text-[13px] font-semibold">
                Apelido
                <input value={edit.apelido} onChange={(e) => setEdit({ ...edit, apelido: e.target.value })} className="h-11 rounded-xl border border-borda px-3 text-[15px] font-normal" />
              </label>
            </div>

            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Outros nomes (separados por vírgula)
              <input
                value={edit.apelidos}
                onChange={(e) => setEdit({ ...edit, apelidos: e.target.value })}
                placeholder="Bruno, Vida Animal, Bruno Vida Animal"
                className="h-11 rounded-xl border border-borda px-3 text-[15px] font-normal"
              />
              <span className="font-normal text-apagado">Quando colar a lista do Zap, qualquer um desses nomes vira este jogador.</span>
            </label>

            <Escolha
              rotulo="Tipo de avaliação"
              valor={edit.modo}
              aoMudar={(v) => setEdit({ ...edit, modo: v })}
              opcoes={[{ valor: "simples", rotulo: "Simples" }, { valor: "completa", rotulo: "Completa" }]}
            />

            {edit.modo === "simples" ? (
              <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-fundo p-4 text-center">
                <Estrelas valor={edit.nota} onChange={(v) => setEdit({ ...edit, nota: v })} tamanho={44} />
                <span className="font-display text-3xl font-bold">{formatarNota(edit.nota)}</span>
                <span className="text-sm font-semibold">{NIVEIS[String(edit.nota)]}</span>
                <span className="text-xs text-apagado">Toca na metade esquerda da estrela pra dar meia</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 rounded-2xl bg-fundo p-4">
                {ATRIBUTOS.map((a) => (
                  <label key={a.chave} className="grid grid-cols-[110px_1fr_24px] items-center gap-2 text-sm">
                    <span className="font-semibold">{a.rotulo}</span>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={edit.atributos[a.chave]}
                      onChange={(e) => setEdit({ ...edit, atributos: { ...edit.atributos, [a.chave]: Number(e.target.value) } })}
                      className="accent-roxo"
                    />
                    <span className="text-right font-display font-semibold tabular-nums">{edit.atributos[a.chave]}</span>
                  </label>
                ))}
                <span className="text-center text-[13px] text-apagado">
                  Nota geral {media.toFixed(1).replace(".", ",")} de 10 · equivale a {formatarNota(atributosParaEstrelas(edit.atributos))} estrelas
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold">Onde joga</span>
              <Escolha
                rotulo="Posição"
                valor={edit.posicao}
                aoMudar={(v) => setEdit({ ...edit, posicao: v })}
                opcoes={[
                  { valor: "D", rotulo: "Defesa" },
                  { valor: "M", rotulo: "Meio" },
                  { valor: "A", rotulo: "Ataque" },
                  { valor: "Q", rotulo: "Qualquer" },
                ]}
              />
            </div>

            <div className="flex flex-col divide-y divide-borda rounded-2xl border border-borda">
              {(
                [
                  ["sabe_marcar", "Sabe marcar"],
                  ["goleiro", "É goleiro"],
                  ["convidado", "Convidado (não é fixo)"],
                  ["ativo", "Ativo no elenco"],
                ] as const
              ).map(([k, r]) => (
                <div key={k} className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold">
                  {r}
                  <Interruptor rotulo={r} ligado={edit[k]} aoMudar={(v) => setEdit({ ...edit, [k]: v })} />
                </div>
              ))}
            </div>

            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              {edit.profile_id ? "Já ligado a uma conta. Trocar pelo e-mail:" : "Ligar à conta do jogador (e-mail do Google, opcional)"}
              <input
                type="email"
                value={edit.email}
                onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                placeholder="jogador@gmail.com"
                className="h-11 rounded-xl border border-borda px-3 text-[15px] font-normal"
              />
            </label>

            {aviso && (
              <p role="alert" className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">
                {aviso}
              </p>
            )}

            <button type="button" onClick={salvar} disabled={salvando} className="h-12 rounded-xl bg-roxo font-semibold text-white disabled:opacity-60">
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </>
        )}
      </Folha>
    </main>
  );
}
