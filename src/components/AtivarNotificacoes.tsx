"use client";
// Botão "Ativar notificações": pede permissão, inscreve este aparelho e salva no banco (push_subs).
import { useEffect, useState } from "react";
import { criarClienteSupabase } from "@/lib/supabase/client";
import { useSessao } from "@/lib/sessao";

const CHAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function base64ParaBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export default function AtivarNotificacoes() {
  const { usuario } = useSessao();
  const [estado, setEstado] = useState<"carregando" | "sem-suporte" | "ativo" | "inativo" | "bloqueado">("carregando");

  useEffect(() => {
    if (!CHAVE || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEstado("sem-suporte");
      return;
    }
    if (Notification.permission === "denied") return setEstado("bloqueado");
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setEstado(sub ? "ativo" : "inativo");
    });
  }, []);

  async function ativar() {
    if (!usuario || !CHAVE) return;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setEstado(perm === "denied" ? "bloqueado" : "inativo");
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaBytes(CHAVE) });
    const j = sub.toJSON();
    await criarClienteSupabase().from("push_subs").upsert({ endpoint: sub.endpoint, profile_id: usuario.id, keys: j.keys });
    setEstado("ativo");
  }

  async function desativar() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await criarClienteSupabase().from("push_subs").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setEstado("inativo");
  }

  if (estado === "carregando") return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-borda bg-white px-4 py-3">
      <span className="flex flex-1 flex-col text-sm">
        <span className="font-semibold">Notificações</span>
        <span className="text-[13px] text-apagado">
          {estado === "ativo" && "Ligadas neste aparelho: lembretes, pelada começou, votação e medalhas."}
          {estado === "inativo" && "Lembrete de sortear, a pelada começou, votação aberta e medalha nova."}
          {estado === "bloqueado" && "Bloqueadas no navegador. Libere nas configurações do site."}
          {estado === "sem-suporte" && "No iPhone, instale o app na tela inicial primeiro (iOS 16.4 ou mais novo)."}
        </span>
      </span>
      {estado === "inativo" && (
        <button type="button" onClick={ativar} className="h-9 shrink-0 rounded-[10px] bg-roxo px-3 text-[13px] font-semibold text-white">
          Ativar
        </button>
      )}
      {estado === "ativo" && (
        <button type="button" onClick={desativar} className="h-9 shrink-0 rounded-[10px] border border-borda px-3 text-[13px] font-semibold">
          Desligar
        </button>
      )}
    </div>
  );
}
