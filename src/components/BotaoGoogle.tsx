"use client";
// Botão "Entrar com Google" oficial (Google Identity Services).
// O login acontece no próprio site, então o Google mostra o nome/endereço do app,
// e não o endereço do Supabase. Sem NEXT_PUBLIC_GOOGLE_CLIENT_ID, cai no login antigo (redirect).
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { criarClienteSupabase } from "@/lib/supabase/client";

type Google = {
  accounts: {
    id: {
      initialize: (cfg: Record<string, unknown>) => void;
      renderButton: (el: HTMLElement, cfg: Record<string, unknown>) => void;
    };
  };
};

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

async function sha256(texto: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function BotaoGoogle({ onErro, onEntrou }: { onErro: (m: string) => void; onEntrou: () => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [scriptPronto, setScriptPronto] = useState(false);

  useEffect(() => {
    const g = (window as unknown as { google?: Google }).google;
    if (!CLIENT_ID || !scriptPronto || !g || !caixa.current) return;
    let cancelado = false;
    // O "nonce" amarra o token do Google a esta tentativa de login (segurança).
    const nonce = crypto.randomUUID();
    sha256(nonce).then((hash) => {
      if (cancelado || !caixa.current) return;
      g.accounts.id.initialize({
        client_id: CLIENT_ID,
        nonce: hash,
        use_fedcm_for_prompt: true,
        callback: async (resp: { credential: string }) => {
          const { error } = await criarClienteSupabase().auth.signInWithIdToken({
            provider: "google",
            token: resp.credential,
            nonce,
          });
          if (error) onErro("Não deu pra entrar com o Google. Tenta de novo.");
          else onEntrou();
        },
      });
      g.accounts.id.renderButton(caixa.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        locale: "pt-BR",
        width: Math.min(caixa.current.offsetWidth || 340, 400),
      });
    });
    return () => {
      cancelado = true;
    };
  }, [scriptPronto, onErro, onEntrou]);

  async function loginAntigo() {
    const { error } = await criarClienteSupabase().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) onErro("O login com Google ainda não está ligado no Supabase.");
  }

  if (!CLIENT_ID) {
    return (
      <button
        type="button"
        onClick={loginAntigo}
        className="flex h-[54px] items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-[#D8D0E6] bg-white text-base font-semibold"
      >
        <span aria-hidden="true" className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-tinta text-[13px] font-bold">
          G
        </span>
        Entrar com Google
      </button>
    );
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setScriptPronto(true)} />
      <div ref={caixa} className="flex min-h-[44px] w-full justify-center" />
    </>
  );
}
