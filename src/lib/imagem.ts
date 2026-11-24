"use client";
// Gerar PNG de um pedaço da tela (cards, banners, times) e baixar ou compartilhar.
import { toPng } from "html-to-image";

export async function gerarPng(el: HTMLElement, opcoes: { largura?: number; altura?: number; fundo?: string; escala?: number } = {}) {
  return toPng(el, {
    pixelRatio: opcoes.escala ?? 3,
    backgroundColor: opcoes.fundo,
    cacheBust: true,
    ...(opcoes.largura ? { canvasWidth: opcoes.largura, canvasHeight: opcoes.altura } : {}),
  });
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
