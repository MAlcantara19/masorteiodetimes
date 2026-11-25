// Modo noturno: "auto" segue o celular; "claro" e "escuro" ficam fixos. Escolha guardada neste aparelho.
export type Tema = "auto" | "claro" | "escuro";
const CHAVE = "masorteio:tema";

export function lerTema(): Tema {
  try {
    const t = window.localStorage.getItem(CHAVE);
    return t === "claro" || t === "escuro" ? t : "auto";
  } catch {
    return "auto";
  }
}

export function aplicarTema(t: Tema = lerTema()) {
  const escuro = t === "escuro" || (t === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.tema = escuro ? "escuro" : "claro";
}

export function salvarTema(t: Tema) {
  try {
    window.localStorage.setItem(CHAVE, t);
  } catch {}
  aplicarTema(t);
}

// Roda antes da página aparecer (no <head>), pra não piscar claro antes de ficar escuro.
export const SCRIPT_TEMA = `try{var t=localStorage.getItem("${CHAVE}");var e=t==="escuro"||(t!=="claro"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.tema=e?"escuro":"claro"}catch(_){}`;
