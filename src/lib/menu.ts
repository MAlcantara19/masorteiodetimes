"use client";
// Todos os atalhos do app num lugar só: usados no menu lateral, na aba Mais e na barra de baixo.
import { useSyncExternalStore } from "react";
import type { NomeIcone } from "@/components/Icone";
import type { PeladaResumo } from "@/lib/sessao";
import { temRecurso, type Recurso } from "@/lib/planos";

// Itens que dependem do plano da pelada.
const DO_PLANO: Record<string, Recurso> = { pagar: "pix", cobrar: "pix", retrospectiva: "retrospectiva", banners: "banners", fotos: "fotos", album: "album", confrontos: "confrontos_admin", caixa: "caixa", telao: "telao" };

// `grupo`: o menu junta os itens por assunto (cada grupo abre e fecha).
export type ItemMenu = { id: string; href: string; titulo: string; sub: string; icone: NomeIcone; grupo?: string };
export type GruposMenu = { master: ItemMenu[]; admin: ItemMenu[]; jogador: ItemMenu[]; geral: ItemMenu[] };

export function montarMenu(atual: PeladaResumo | null, admin: boolean, ehMaster: boolean): GruposMenu {
  const b = atual ? `/${atual.slug}` : null;
  const jogador: ItemMenu[] = [];
  if (atual && b) {
    jogador.push(
      // Dia de jogo
      { id: "jogo", href: `${b}/jogo`, titulo: "Partida", sub: "cronômetro, placar, ao vivo e telão", icone: "partida", grupo: "Dia de jogo" },
      ...(atual.lista_app ? [{ id: "listaapp", href: `/p/${atual.slug}/lista`, titulo: "Lista da semana", sub: "põe ou tira seu nome", icone: "lista" as const, grupo: "Dia de jogo" }] : []),
      { id: "votar", href: `/p/${atual.slug}/votar`, titulo: "Votação", sub: "craque, bagre e goleiro", icone: "estrela", grupo: "Dia de jogo" },
      { id: "meudia", href: `${b}/meu-dia`, titulo: "Meu dia", sub: "seu resultado do dia, pra postar", icone: "cartao", grupo: "Dia de jogo" },
      { id: "fotos", href: `${b}/fotos`, titulo: "Fotos do dia", sub: "manda e vê as fotos da pelada", icone: "imagem", grupo: "Dia de jogo" },
      // Ranking e prêmios
      { id: "campeonato", href: `${b}/campeonato`, titulo: "Campeonato", sub: "melhores da semana e do mês", icone: "trofeu", grupo: "Ranking e prêmios" },
      { id: "hall", href: `${b}/hall-da-fama`, titulo: "Hall da fama", sub: "recordes de todos os tempos", icone: "trofeu", grupo: "Ranking e prêmios" },
      { id: "album", href: `${b}/album`, titulo: "Álbum", sub: "as cartas de todo mundo e a seleção", icone: "imagem", grupo: "Ranking e prêmios" },
      { id: "presenca", href: `${b}/presenca`, titulo: "Presença", sub: "quem mais veio e quem sumiu", icone: "lista", grupo: "Ranking e prêmios" },
      { id: "retrospectiva", href: `${b}/retrospectiva`, titulo: `Retrospectiva ${new Date().getFullYear()}`, sub: "o seu ano na pelada, pra postar", icone: "grafico", grupo: "Ranking e prêmios" },
      // A pelada
      { id: "avisos", href: `${b}/avisos`, titulo: "Avisos", sub: "recados do admin e lembretes", icone: "estrela", grupo: "A pelada" },
      { id: "pagar", href: `${b}/pagar`, titulo: "Mensalidade (Pix)", sub: "QR Code com o valor e “já paguei”", icone: "dinheiro", grupo: "A pelada" },
      { id: "caixa", href: `${b}/caixa`, titulo: "Caixa da pelada", sub: "entradas, saídas e saldo", icone: "dinheiro", grupo: "A pelada" },
      { id: "pagina", href: `/p/${atual.slug}`, titulo: "Página da pelada", sub: "pública, com convite e QR code", icone: "inicio", grupo: "A pelada" },
    );
  }
  const adminItens: ItemMenu[] =
    atual && b && admin
      ? [
          { id: "jogadores", href: `${b}/jogadores`, titulo: "Jogadores", sub: "elenco e estrelas", icone: "jogadores", grupo: "Antes do jogo" },
          { id: "lista", href: `${b}/lista`, titulo: "Colar lista do Zap", sub: "monta a presença do dia", icone: "lista", grupo: "Antes do jogo" },
          { id: "sortear", href: `${b}/sortear`, titulo: "Montar sorteio", sub: "quem joga, times e regras", icone: "sorteio", grupo: "Antes do jogo" },
          { id: "resultados", href: `${b}/resultados`, titulo: "Resultados do dia", sub: "jogos, gols e correções", icone: "grafico", grupo: "Depois do jogo" },
          { id: "banners", href: `${b}/banners`, titulo: "Banners", sub: "story e quadrado", icone: "imagem", grupo: "Depois do jogo" },
          { id: "confrontos", href: `${b}/confrontos`, titulo: "Confrontos", sub: "duplas que vencem e rivalidades", icone: "escudo", grupo: "Depois do jogo" },
          { id: "gestao", href: `${b}/gestao`, titulo: "Presença e mensalidade", sub: "quem veio, quem pagou", icone: "dinheiro", grupo: "Dinheiro" },
          { id: "cobrar", href: `${b}/cobrar`, titulo: "Cobrar com Pix", sub: "mensalidade ou diária, mensagem pronta", icone: "dinheiro", grupo: "Dinheiro" },
          { id: "config", href: `${b}/config`, titulo: "Configurar pelada", sub: "cores, camisa, lista, Pix, PIN", icone: "lapis", grupo: "Ajustes" },
        ]
      : [];
  const master: ItemMenu[] = ehMaster
    ? [
        { id: "master", href: "/master", titulo: "Painel master", sub: "peladas, admins e acessos", icone: "chave" },
        { id: "marca", href: "/marca", titulo: "Arte da marca", sub: "post, story, logo e capa pra divulgar", icone: "imagem" },
      ]
    : [];
  const geral: ItemMenu[] = [
    { id: "card", href: "/perfil/card", titulo: "Meu card", sub: "sua carta e raridade", icone: "cartao", grupo: "Você" },
    { id: "perfil", href: "/perfil", titulo: "Meu perfil", sub: "cadastro, notificações e tema", icone: "usuario", grupo: "Você" },
    { id: "cronometro", href: "/cronometro", titulo: "Cronômetro simples", sub: "sem internet, só neste aparelho", icone: "partida", grupo: "Ferramentas" },
    { id: "achar", href: "/peladas", titulo: "Achar pelada", sub: "peladas abertas, horários e contato", icone: "busca", grupo: "Ferramentas" },
    { id: "acompanhar", href: "/acompanhar", titulo: "Acompanhar outras peladas", sub: "ao vivo de qualquer pelada", icone: "link", grupo: "Ferramentas" },
    { id: "tour", href: "/tour", titulo: "Tour do app", sub: "tudo que o app faz, passo a passo", icone: "estrela", grupo: "Ferramentas" },
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

// Junta os itens por grupo, na ordem em que aparecem.
export function porGrupo(itens: ItemMenu[]): [string, ItemMenu[]][] {
  const m = new Map<string, ItemMenu[]>();
  for (const i of itens) {
    const g = i.grupo ?? "";
    m.set(g, [...(m.get(g) ?? []), i]);
  }
  return [...m];
}
