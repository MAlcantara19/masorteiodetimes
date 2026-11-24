"use client";
// Liga o service worker (public/sw.js): app abre sem internet e recebe notificações.
import { useEffect } from "react";

export default function RegistrarSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // no `npm run dev` fica desligado pra não guardar versão velha
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
