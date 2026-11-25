"use client";
// Todos os atalhos do app num lugar só: usados no menu lateral, na aba Mais e na barra de baixo.
import { useSyncExternalStore } from "react";
import type { NomeIcone } from "@/components/Icone";
import type { PeladaResumo } from "@/lib/sessao";
import { temRecurso, type Recurso } from "@/lib/planos";

// Itens que dependem do plano da pelada.
const DO_PLANO: Record<string, Recurso> = { pagar: "pix", retrospectiva: "retrospectiva", banners: "banners", fotos: "fotos", album: "album", confrontos: "confrontos_admin" };

export type ItemMenu = { id: string; href: string; titulo: string; sub: string; icone: NomeIcone };
export type GruposMenu = { master: ItemMenu[]; admin: ItemMenu[]; jogador: ItemMenu[]; geral: ItemMenu[] };

export function montarMenu(atual: PeladaResumo | null, admin: boolean, ehMaster: boolean): GruposMenu {
  const b = atual ? `/${atual.slug}` : null;
  const jogador: ItemMenu[] = [];
  if (atual && b) {
    jogador.push(
      { id: "jogo", href: `${b}/jogo`, titulo: "Partida", sub: "cronômetro e placar ao vivo", icone: "partida" },
      { id: "aovivo", href: `/p/${atual.slug}/ao-vivo`, titulo: "Link ao vivo", sub: "placar e artilharia pra todos", icone: "link" },
      { id: "campeonato", href: `${b}/campeonato`, titulo: "Campeonato", sub: "melhores da semana e do mês", icone: "trofeu" },
      { id: "votar", href: `/p/${atual.slug}/votar`, titulo: "Votação", sub: "craque, bagre e goleiro", icone: "estrela" },
      { id: "avaliar", href: `/p/${atual.slug}/avaliar`, titulo: "Avaliar a pelada", sub: "link pós-jogo pra galera", icone: "check" },
      { id: "album", href: `${b}/album`, titulo: "Álbum", sub: "as cartas de todo mundo e a seleção", icone: "imagem" },
      { id: "fotos", href: `${b}/fotos`, titulo: "Fotos do dia", sub: "manda e vê as fotos da pelada", icone: "imagem" },
      { id: "pagar", href: `${b}/pagar`, titulo: "Mensalidade (Pix)", sub: "QR Code com o valor e “já paguei”", icone: "dinheiro" },
      { id: "retrospectiva", href: `${b}/retrospectiva`, titulo: `Retrospectiva ${new Date().getFullYear()}`, sub: "o seu ano na pelada, pra postar", icone: "grafico" },
      { id: "pagina", href: `/p/${atual.slug}`, titulo: "Página da pelada", sub: "pública, com convite e QR code", icone: "inicio" },
    );
  }
  const adminItens: ItemMenu[] =
    atual && b && admin
      ? [
          { id: "jogadores", href: `${b}/jogadores`, titulo: "Jogadores", sub: "elenco e estrelas", icone: "jogadores" },
          { id: "lista", href: `${b}/lista`, titulo: "Colar lista do Zap", sub: "monta a presença do dia", icone: "lista" },
          { id: "sortear", href: `${b}/sortear`, titulo: "Montar sorteio", sub: "quem joga, times e regras", icone: "sorteio" },
          { id: "resultados", href: `${b}/resultados`, titulo: "Resultados do dia", sub: "jogos, gols e correções", icone: "grafico" },
          { id: "banners", href: `${b}/banners`, titulo: "Banners", sub: "story e quadrado", icone: "imagem" },
          { id: "gestao", href: `${b}/gestao`, titulo: "Presença e mensalidade", sub: "quem veio, quem pagou", icone: "dinheiro" },
          { id: "confrontos", href: `${b}/confrontos`, titulo: "Confrontos", sub: "duplas que vencem e rivalidades", icone: "escudo" },
          { id: "config", href: `${b}/config`, titulo: "Configurar pelada", sub: "cores, camisa, Pix, PIN", icone: "lapis" },
        ]
      : [];
  const master: ItemMenu[] = ehMaster
    ? [
        { id: "master", href: "/master", titulo: "Painel master", sub: "peladas, admins e acessos", icone: "chave" },
        { id: "marca", href: "/marca", titulo: "Arte da marca", sub: "post, story, logo e capa pra divulgar", icone: "imagem" },
      ]
    : [];
  const geral: ItemMenu[] = [
    { id: "inicio", href: "/", titulo: "Início", sub: "suas peladas e o ao vivo", icone: "inicio" },
    { id: "card", href: "/perfil/card", titulo: "Meu card", sub: "sua carta e raridade", icone: "cartao" },
    { id: "perfil", href: "/perfil", titulo: "Meu perfil", sub: "nome, apelido e foto", icone: "usuario" },
    { id: "cronometro", href: "/cronometro", titulo: "Cronômetro simples", sub: "sem internet, só neste aparelho", icone: "partida" },
    { id: "acompanhar", href: "/acompanhar", titulo: "Acompanhar outras peladas", sub: "ao vivo de qualquer pelada", icone: "link" },
    { id: "tour", href: "/tour", titulo: "Tour do app", sub: "tudo que o app faz, passo a passo", icone: "estrela" },
  ];
  const libera = (i: ItemMenu) => !DO_PLANO[i.id] || temRecurso(atual, DO_PLANO[i.id], ehMaster);
  return { master, admin: adminItens.filter(libera), jogador: jogador.filter(libera), geral };
}

// ---------- Atalhos da barra de baixo (o próprio usuário escolhe) ----------

const CHAVE = "masorteio:atalhos";
const ouvintes = new Set<() => void>();
export const MAX_ATALHOS = 3;

export function atalhosPadrao(admin: boolean): string[] {
  return admin ? ["jogadores", "sortear", "jogo"] : ["jogo", "campeonato", "card"];
}

function ler(): string {
  try {
    return window.localStorage.getItem(CHAVE) ?? "";
  } catch {
    return "";
  }
}

export function gravarAtalhos(ids: string[] | null) {
  try {
    if (ids) window.localStorage.setItem(CHAVE, JSON.stringify(ids.slice(0, MAX_ATALHOS)));
    else window.localStorage.removeItem(CHAVE);
  } catch {}
  ouvintes.forEach((f) => f());
}

// Devolve os atalhos escolhidos (ou null = usar o padrão do papel).
export function useAtalhos(): string[] | null {
  const raw = useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => {
        ouvintes.delete(f);
      };
    },
    ler,
    () => "",
  );
  try {
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

// Abrir/fechar o menu lateral de qualquer lugar.
const ouvintesMenu = new Set<(aberto: boolean) => void>();
export function abrirMenu() {
  ouvintesMenu.forEach((f) => f(true));
}
export function ouvirMenu(f: (aberto: boolean) => void) {
  ouvintesMenu.add(f);
  return () => {
    ouvintesMenu.delete(f);
  };
}
