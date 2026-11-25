"use client";
// Pagar a mensalidade com Pix: QR Code com o valor certo, copia e cola e o botão "Já paguei"
// (o admin confere no banco e marca como pago na Gestão). Se a pelada tiver diária, dá pra pagar a diária também.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";
import { usePelada } from "@/lib/pelada";
import { inicioMes } from "@/lib/datas";
import { mesRotulo } from "@/lib/pix";
import QrPix from "@/components/QrPix";
import { Escolha } from "@/components/Folha";
import Topo, { Carregando } from "@/components/Topo";

type Pagamento = { pago: boolean; informado_em?: string | null };

export default function PagarPage() {
  const { pelada, slug, naoAchou } = usePelada();
  const { carregando, usuario, vinculos, ehAdmin } = useSessao();
  const meuMembro = vinculos.find((v) => v.pelada.id === pelada?.id)?.membro_id ?? null;
  const [pg, setPg] = useState<Pagamento | null | undefined>(undefined);
  const [aviso, setAviso] = useState<string | null>(null);
  const [oQue, setOQue] = useState<"mensalidade" | "diaria">("mensalidade");
  const mes = inicioMes();

  const carregar = useCallback(async () => {
    if (!meuMembro) return setPg(null);
    const { data } = await criarClienteSupabase().from("pagamentos").select("*").eq("membro_id", meuMembro).eq("mes", mes).maybeSingle();
    setPg((data as Pagamento) ?? null);
  }, [meuMembro, mes]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!carregando) carregar();
  }, [carregar, carregando]);

  if (naoAchou) return <main className="p-6 text-center text-apagado">Pelada não encontrada.</main>;
  if (!pelada || carregando) return <Carregando />;

  async function jaPaguei() {
    if (!meuMembro) return;
    const { error } = await criarClienteSupabase().rpc("informar_pagamento", { p_membro: meuMembro, p_mes: mes });
    if (error) return setAviso("Não deu pra avisar. (O admin precisa rodar o SQL novo no Supabase: 0003.)");
    setAviso("Valeu! O admin vai conferir e marcar como pago.");
    carregar();
  }

  const temPix = !!pelada.pix_chave;
  const diaria = pelada.valor_diaria ? Number(pelada.valor_diaria) : null;
  const ehDiaria = oQue === "diaria" && !!diaria;
  const valor = ehDiaria ? diaria : pelada.mensalidade ? Number(pelada.mensalidade) : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <Topo titulo="Mensalidade" sub={`${pelada.nome} · ${mesRotulo(mes)}`} voltar="/mais" />

      {pg?.pago && <p className="rounded-2xl bg-[#E7F5EC] p-4 text-center font-semibold text-zap">✓ Mensalidade de {mesRotulo(mes)} paga. Valeu!</p>}
      {!pg?.pago && pg?.informado_em && (
        <p className="rounded-2xl bg-roxo-suave p-4 text-center text-sm font-semibold text-roxo-escuro">Você avisou que pagou. Falta o admin conferir.</p>
      )}

      {temPix && diaria && (
        <Escolha
          rotulo="Pagar o quê"
          valor={oQue}
          aoMudar={setOQue}
          opcoes={[
            { valor: "mensalidade", rotulo: "Mensalidade" },
            { valor: "diaria", rotulo: "Diária" },
          ]}
        />
      )}

      {temPix ? (
        <section className="rounded-2xl border border-borda bg-white p-4">
          <QrPix chave={pelada.pix_chave as string} nome={pelada.pix_nome || pelada.nome} cidade={pelada.pix_cidade || "BRASIL"} valor={valor} descricao={ehDiaria ? `${pelada.nome} diaria` : `${pelada.nome} ${mes.slice(0, 7)}`} />
        </section>
      ) : (
        <p className="rounded-2xl border border-borda bg-white p-4 text-sm text-apagado">
          O admin ainda não cadastrou a chave Pix da pelada.
          {ehAdmin(pelada.id) && (
            <>
              {" "}
              <Link href={`/${slug}/config`} className="font-semibold text-roxo">
                Cadastrar agora
              </Link>
            </>
          )}
        </p>
      )}

      {usuario && meuMembro && !pg?.pago && !ehDiaria && (
        <button type="button" onClick={jaPaguei} className="h-14 rounded-2xl bg-zap text-lg font-bold text-white">
          Já paguei
        </button>
      )}
      {!usuario && (
        <Link href={`/entrar?volta=/${slug}/pagar`} className="flex h-12 items-center justify-center rounded-xl border border-roxo font-semibold text-roxo">
          Entre pra avisar que pagou
        </Link>
      )}
      {aviso && <p className="rounded-xl bg-noite px-3 py-2 text-sm text-white">{aviso}</p>}
      {ehAdmin(pelada.id) && (
        <Link href={`/${slug}/gestao`} className="text-center text-sm font-semibold text-roxo">
          Ver quem pagou (Gestão) →
        </Link>
      )}
    </main>
  );
}
