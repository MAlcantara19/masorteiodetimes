"use client";
// Lembretes pra galera (hoje tem pelada às 7h, 2 horas antes) e divulgação:
// aparecer em "Achar pelada" com o WhatsApp de contato do admin.
import { useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import type { Pelada } from "@/lib/pelada";
import { Interruptor } from "@/components/Folha";
import { formatarZap, mascaraZap, normalizarZap } from "@/lib/whatsapp";

export default function ConfigAvisos({ pelada, aoSalvar }: { pelada: Pelada; aoSalvar: () => void }) {
  const [dia, setDia] = useState(pelada.aviso_dia ?? true);
  const [duas, setDuas] = useState(pelada.aviso_2h ?? true);
  const [publica, setPublica] = useState(!!pelada.publica);
  const [zap, setZap] = useState(mascaraZap(formatarZap(pelada.contato_whatsapp)));
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    const numero = zap.trim() ? normalizarZap(zap) : null;
    if (zap.trim() && !numero) return setErro("WhatsApp de contato com DDD, tipo (24) 99999-9999.");
    if (publica && !numero) return setErro("Pra aparecer em Achar pelada, coloca um WhatsApp de contato.");
    const { error } = await criarClienteSupabase().from("peladas").update({ aviso_dia: dia, aviso_2h: duas, publica, contato_whatsapp: numero }).eq("id", pelada.id);
    if (error) return setErro("Pra salvar, rode no Supabase o SQL novo (supabase/migrations/0009).");
    setErro(null);
    aoSalvar();
  }

  const linha = (titulo: string, sub: string, ligado: boolean, set: (v: boolean) => void) => (
    <div className="flex items-center justify-between gap-3">
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{titulo}</span>
        <span className="text-[13px] text-apagado">{sub}</span>
      </span>
      <Interruptor rotulo={titulo} ligado={ligado} aoMudar={set} />
    </div>
  );

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
      <span className="font-semibold">Lembretes e divulgação</span>
      {linha("Hoje tem pelada (7h)", "notificação no dia da pelada de manhã", dia, setDia)}
      {linha("2 horas antes", "notificação pra quem está na lista", duas, setDuas)}
      <div className="border-t border-borda" />
      {linha("Aparecer em “Achar pelada”", "quem procura pelada vê dia, horário, local, valores e o contato", publica, setPublica)}
      <label className="flex flex-col gap-1 text-[13px] font-semibold">
        WhatsApp de contato da pelada
        <input value={zap} onChange={(e) => setZap(mascaraZap(e.target.value))} inputMode="tel" placeholder="(24) 99999-9999" className="h-11 rounded-xl border border-borda px-3 text-[15px] font-normal" />
      </label>
      {erro && <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta-escuro">{erro}</p>}
      <button type="button" onClick={salvar} className="h-11 rounded-xl bg-roxo font-semibold text-white">
        Salvar lembretes e divulgação
      </button>
    </section>
  );
}
