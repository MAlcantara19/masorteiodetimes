"use client";
// Diminui a foto antes de subir (foto de celular tem 3 a 5 MB; aqui vira ~100 a 300 KB).
// `transparente`: mantém o fundo transparente (logo e foto da camisa) salvando em PNG/WebP.
export async function comprimirImagem(arq: File, o: { lado?: number; qualidade?: number; transparente?: boolean } = {}): Promise<{ blob: Blob; ext: string; tipo: string }> {
  const lado = o.lado ?? 1024;
  try {
    const img = await createImageBitmap(arq);
    const escala = Math.min(1, lado / Math.max(img.width, img.height));
    const w = Math.round(img.width * escala);
    const h = Math.round(img.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sem canvas");
    if (!o.transparente) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    const tipo = o.transparente ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, tipo, o.qualidade ?? 0.82));
    // Navegador sem WebP: PNG (mantém a transparência).
    if (blob && blob.type === tipo) return { blob, ext: tipo === "image/webp" ? "webp" : "jpg", tipo };
    const png = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (png) return { blob: png, ext: "png", tipo: "image/png" };
  } catch {}
  // Não deu pra diminuir (formato estranho): sobe como veio.
  return { blob: arq, ext: arq.name.split(".").pop() || "jpg", tipo: arq.type || "image/jpeg" };
}
