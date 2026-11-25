"use client";
// Cobrar com Pix (admin): mensalidade, diária ou outro valor, pro grupo ou pra uma pessoa.
// Monta a mensagem pronta com o valor, pra quem vai o Pix, a chave e o Pix copia e cola já com o valor.
// Também tem o texto pra deixar fixo na descrição do grupo.
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { carregarElenco, nomeCurto, usePelada, type Membro } from "@/lib/pelada";
import { curtaDia, inicioMes, nomeMes } from "@/lib/datas";
import { gerarPix } from "@/lib/pix";
import { linkZap } from "@/lib/resumo-zap";
import { Escolha } from "@/components/Folha";
import Topo, { Carregando } from "@/components/Topo";

type Tipo = "mensalidade" | "diaria" | "outro";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function BotaoCopiar({ texto, rotulo, className }: { texto: string; rotulo: string; className: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard
          .writeText(texto)
          .then(() => {
            setOk(true);
            setTimeout(() => setOk(false), 2500);
          })
          .catch(() => {})
      }
      className={className}
    >
      {ok ? "Copiado!" : rotulo}
    </button>
  );
}

export default function CobrarPage() {
  const { pelada, slug, naoAchou } = usePelada();
  const { carregando, usuario, ehAdmin } = useSessao();
  const admin = pelada ? ehAdmin(pelada.id) : false;
  const [elenco, setElenco] = useState<Membro[]>([]);
  const [pagos, setPagos] = useState<Set<string>>(new Set());
  const [ultimo, setUltimo] = useState<{ data: string; convidados: string[] } | null>(null);
  const [tipo, setTipo] = useState<Tipo>("mensalidade");
  const [outro, setOutro] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pra, setPra] = useState<"grupo" | "pessoa">("grupo");
  const [pessoa, setPessoa] = useState("");
  const [listarNomes, setListarNomes] = useState(true);
  const mes = inicioMes();

  useEffect(() => {
    if (!pelada || !admin) return;
    const sb = criarClienteSupabase();
    carregarElenco(pelada.id, false).then(setElenco);
    sb.from("pagamentos")
      .select("membro_id, pago")
      .eq("pelada_id", pelada.id)
      .eq("mes", mes)
      .then(({ data }) => setPagos(new Set((data ?? []).filter((p) => p.pago).map((p) => p.membro_id))));
    // Convidados da última pelada que teve jogo (quem costuma pagar a diária).
    (async () => {
      const { data: evs } = await sb.from("eventos").select("id, data").eq("pelada_id", pelada.id).neq("status", "cancelado").lte("data", new Date().toISOString().slice(0, 10)).order("data", { ascending: false }).limit(1);
      const ev = evs?.[0];
      if (!ev) return;
      const { data: pr } = await sb.from("presencas").select("membro_id").eq("evento_id", ev.id).eq("status", "confirmado");
      setUltimo({ data: ev.data, convidados: (pr ?? []).map((p) => p.membro_id) });
    })();
  }, [pelada, admin, mes]);

  const porId = useMemo(() => new Map(elenco.map((m) => [m.id, m])), [elenco]);
  const fixos = elenco.filter((m) => m.ativo && !m.convidado);
  const devendo = fixos.filter((m) => !pagos.has(m.id)).map(nomeCurto);
  const convidadosDia = (ultimo?.convidados ?? [])
    .map((id) => porId.get(id))
    .filter((m): m is Membro => !!m && m.convidado && !/^RESERVA( \d+)?$/.test(m.nome))
    .map(nomeCurto);

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando) return <Carregando />;
  if (!usuario || !admin) return <main className="p-6 text-center text-apagado">Só admin cobra.</main>;

  const mensalidade = pelada.mensalidade ? Number(pelada.mensalidade) : null;
  const diaria = pelada.valor_diaria ? Number(pelada.valor_diaria) : null;
  const valor = tipo === "mensalidade" ? mensalidade : tipo === "diaria" ? diaria : Number(outro.replace(",", ".")) || null;
  const oQue = tipo === "mensalidade" ? `mensalidade de ${nomeMes(new Date()).toLowerCase()}` : tipo === "diaria" ? `diária${ultimo ? ` de ${curtaDia(ultimo.data)}` : ""}` : motivo.trim() || "pelada";
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const temPix = !!pelada.pix_chave;
  const recebedor = pelada.pix_nome || pelada.nome;
  const codigo = temPix ? gerarPix({ chave: pelada.pix_chave as string, nome: recebedor, cidade: pelada.pix_cidade || "BRASIL", valor, descricao: `${pelada.nome} ${oQue}` }) : "";
  const nomes = tipo === "mensalidade" ? devendo : tipo === "diaria" ? convidadosDia : [];

  const pix = temPix
    ? [`Pix pra *${recebedor}*`, `Chave: ${pelada.pix_chave}`, "", `Pix copia e cola${valor ? " (já vai com o valor)" : ""}:`, codigo, "", `Ou paga pelo app, com QR Code: ${origem}/${slug}/pagar`]
    : [];
  const mensagem =
    pra === "pessoa"
      ? [
          `Fala, ${pessoa ? nomeCurto(porId.get(pessoa) as Membro) : "craque"}! ⚽`,
          `Tá faltando acertar a ${oQue} da ${pelada.nome}${valor ? `: *${brl(valor)}*` : ""}.`,
          "",
          ...pix,
          "",
          "Valeu! 🙌",
        ].join("\n")
      : [
          `💰 *${tipo === "mensalidade" ? "Mensalidade" : tipo === "diaria" ? "Diária" : oQue.charAt(0).toUpperCase() + oQue.slice(1)} · ${pelada.nome}*${tipo === "mensalidade" ? ` · ${nomeMes(new Date())}` : ""}${valor ? ` · ${brl(valor)}` : ""}`,
          ...(listarNomes && nomes.length ? ["", "Falta acertar:", ...nomes.map((n) => `• ${n}`)] : []),
          "",
          ...pix,
          "",
          "Valeu, galera! ⚽",
        ].join("\n");

  const descricao = [
    `💰 *PIX DA ${pelada.nome.toUpperCase()}*`,
    temPix ? `Chave: ${pelada.pix_chave}` : "",
    temPix ? `Pra: ${recebedor}` : "",
    mensalidade ? `Mensalidade: ${brl(mensalidade)}` : "",
    diaria ? `Diária: ${brl(diaria)}` : "",
    `Paga pelo app (QR Code): ${origem}/${slug}/pagar`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Cobrar com Pix" sub={pelada.nome} voltar="/mais" />

      {!temPix && (
        <p className="rounded-2xl border border-alerta/40 bg-alerta-suave p-4 text-sm text-alerta-escuro">
          Cadastre a chave Pix e o nome de quem recebe em{" "}
          <Link href={`/${slug}/config`} className="font-semibold underline">
            Configurar pelada
          </Link>{" "}
          pra mensagem já ir com o Pix copia e cola.
        </p>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
        <span className="font-semibold">Cobrar o quê?</span>
        <Escolha
          rotulo="Cobrar o quê"
          valor={tipo}
          aoMudar={setTipo}
          opcoes={[
            { valor: "mensalidade", rotulo: `Mensalidade${mensalidade ? ` ${brl(mensalidade)}` : ""}` },
            { valor: "diaria", rotulo: `Diária${diaria ? ` ${brl(diaria)}` : ""}` },
            { valor: "outro", rotulo: "Outro" },
          ]}
        />
        {tipo === "mensalidade" && !mensalidade && (
          <span className="text-[13px] text-apagado">
            Sem valor da mensalidade. Coloque em{" "}
            <Link href={`/${slug}/config`} className="font-semibold text-roxo">
              Configurar → Dados da pelada
            </Link>
            .
          </span>
        )}
        {tipo === "diaria" && !diaria && (
          <span className="text-[13px] text-apagado">
            Sem valor da diária. Coloque em{" "}
            <Link href={`/${slug}/config`} className="font-semibold text-roxo">
              Configurar → Pix
            </Link>
            .
          </span>
        )}
        {tipo === "outro" && (
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: bola nova, churrasco" aria-label="O que é" className="h-11 rounded-xl border border-borda px-3 text-[15px]" />
            <input value={outro} onChange={(e) => setOutro(e.target.value)} inputMode="decimal" placeholder="R$ 20" aria-label="Valor" className="h-11 rounded-xl border border-borda px-3 text-[15px]" />
          </div>
        )}

        <span className="pt-1 font-semibold">Pra quem?</span>
        <Escolha rotulo="Pra quem" valor={pra} aoMudar={setPra} opcoes={[{ valor: "grupo", rotulo: "Pro grupo" }, { valor: "pessoa", rotulo: "Uma pessoa" }]} />
        {pra === "pessoa" && (
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} aria-label="Pessoa" className="h-11 rounded-xl border border-borda bg-white px-3 text-[15px]">
            <option value="">Escolhe quem…</option>
            {elenco
              .filter((m) => m.ativo || m.convidado)
              .filter((m) => !/^RESERVA( \d+)?$/.test(m.nome))
              .sort((a, b) => nomeCurto(a).localeCompare(nomeCurto(b)))
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {nomeCurto(m)}
                  {tipo === "mensalidade" && !m.convidado ? (pagos.has(m.id) ? " · pago" : " · devendo") : ""}
                </option>
              ))}
          </select>
        )}
        {pra === "grupo" && tipo !== "outro" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={listarNomes} onChange={(e) => setListarNomes(e.target.checked)} className="h-4 w-4 accent-[var(--marca)]" />
            {tipo === "mensalidade" ? `Listar quem está devendo (${devendo.length})` : `Listar os convidados${ultimo ? ` de ${curtaDia(ultimo.data)}` : ""} (${convidadosDia.length})`}
          </label>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
        <span className="text-xs font-bold tracking-wider text-apagado">MENSAGEM PRONTA</span>
        <pre className="max-h-72 overflow-auto rounded-xl bg-fundo p-3 font-sans text-[13px] whitespace-pre-wrap break-all">{mensagem}</pre>
        <div className="grid grid-cols-2 gap-2">
          <BotaoCopiar texto={mensagem} rotulo="Copiar mensagem" className="h-12 rounded-xl border-2 border-zap font-semibold text-zap" />
          <a href={linkZap(mensagem)} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center rounded-xl bg-zap font-semibold text-white">
            Mandar no Zap
          </a>
        </div>
        {temPix && <BotaoCopiar texto={codigo} rotulo="Copiar só o Pix copia e cola" className="h-10 rounded-xl border border-borda text-sm font-semibold" />}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
        <span className="font-semibold">Pra deixar na descrição do grupo</span>
        <span className="text-[13px] text-apagado">Fica fixo no grupo: a galera sempre sabe a chave e os valores.</span>
        <pre className="rounded-xl bg-fundo p-3 font-sans text-[13px] whitespace-pre-wrap break-all">{descricao}</pre>
        <BotaoCopiar texto={descricao} rotulo="Copiar texto da descrição" className="h-11 rounded-xl border-2 border-roxo font-semibold text-roxo" />
      </section>

      <Link href={`/${slug}/gestao`} className="text-center text-sm font-semibold text-roxo">
        Marcar quem pagou (Gestão) →
      </Link>
    </main>
  );
}
