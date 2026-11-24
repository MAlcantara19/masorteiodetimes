"use client";
// Botão "Entrar com Google" oficial (Google Identity Services), no modo redirect:
// abre a página do Google na mesma aba (sem popup, que o navegador costuma bloquear)
// e volta pra /auth/google. Como o login acontece no próprio site, o Google mostra
// o nome/endereço do app, e não o do Supabase.
// Sem NEXT_PUBLIC_GOOGLE_CLIENT_ID, usa o login antigo pelo Supabase.
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

export default function BotaoGoogle({ onErro }: { onErro: (m: string) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const [scriptPronto, setScriptPronto] = useState(false);

  useEffect(() => {
    const g = (window as unknown as { google?: Google }).google;
    if (!CLIENT_ID || !scriptPronto || !g || !caixa.current) return;
    g.accounts.id.initialize({
      client_id: CLIENT_ID,
      ux_mode: "redirect",
      login_uri: `${window.location.origin}/auth/google`,
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
  }, [scriptPronto]);

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
