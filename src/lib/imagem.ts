"use client";
// Gerar PNG de um pedaço da tela (cards, banners, times) e baixar ou compartilhar.
import { toPng } from "html-to-image";

// No modo noturno, a imagem sai com as cores claras (o tema volta logo depois).
export async function comTemaClaro<T>(f: () => Promise<T>): Promise<T> {
  const html = document.documentElement;
  const antes = html.dataset.tema;
  if (antes !== "escuro") return f();
  html.dataset.tema = "claro";
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  try {
    return await f();
  } finally {
    html.dataset.tema = antes;
  }
}

export async function gerarPng(el: HTMLElement, opcoes: { largura?: number; altura?: number; fundo?: string; escala?: number } = {}) {
  return comTemaClaro(() =>
    toPng(el, {
      pixelRatio: opcoes.escala ?? 3,
      backgroundColor: opcoes.fundo,
      cacheBust: true,
      ...(opcoes.largura ? { canvasWidth: opcoes.largura, canvasHeight: opcoes.altura } : {}),
    }),
  );
}

export function baixarDataUrl(url: string, nome: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
}

// Compartilha a imagem (no celular abre o menu do Zap/Instagram). Sem suporte, baixa.
export async function compartilharDataUrl(url: string, nome: string, texto?: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const arquivo = new File([blob], nome, { type: "image/png" });
    if (navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], text: texto });
      return;
    }
  } catch {
    // cancelou ou não suporta: cai no download
  }
  baixarDataUrl(url, nome);
}
