"use client";
// Pede pro servidor mandar uma notificação (o servidor confere se quem pediu é admin da pelada).
// Se as notificações ainda não estiverem configuradas, simplesmente não faz nada.
export type AvisoPush = {
  pelada_id: string;
  tipo: "comecou" | "votacao" | "medalha" | "aviso" | "lista";
  evento_id?: string; // tipo "lista"
  membros?: string[];
  titulo?: string; // tipo "aviso": o que o admin escreveu
  texto?: string;
};

export function avisarPush(aviso: AvisoPush) {
  fetch("/api/push/enviar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(aviso),
  }).catch(() => {});
}
