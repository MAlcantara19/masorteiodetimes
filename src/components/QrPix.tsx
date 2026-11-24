"use client";
// QR Code do Pix com o valor certo + botão "copiar código" (Pix copia e cola).
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { gerarPix, type DadosPix } from "@/lib/pix";

export default function QrPix(props: DadosPix) {
  const codigo = gerarPix(props);
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(codigo, { width: 520, margin: 1, color: { dark: "#1B1430", light: "#FFFFFF" } }).then(setQr).catch(() => setQr(null));
  }, [codigo]);

  return (
    <div className="flex flex-col items-center gap-3">
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="QR Code do Pix" className="h-56 w-56 rounded-xl border border-borda" />
      ) : (
        <div className="h-56 w-56 rounded-xl bg-fundo" />
      )}
      {props.valor ? (
        <span className="font-display text-2xl font-bold">{props.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
      ) : null}
      <span className="text-center text-xs text-apagado">
        Pra {props.nome} · chave {props.chave}
      </span>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard
            .writeText(codigo)
            .then(() => setCopiado(true))
            .catch(() => {})
        }
        className="h-12 w-full rounded-xl bg-roxo font-semibold text-white"
      >
        {copiado ? "Código copiado! Cola no app do banco" : "Copiar código Pix (copia e cola)"}
      </button>
    </div>
  );
}
