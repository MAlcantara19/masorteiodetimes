"use client";
// Tour guiado: mostra tela por tela o que o app faz, com exemplos e links pra Pelada Piloto (demonstração).
// Pra atualizar o tour quando o app ganhar coisa nova, é só mexer na lista PASSOS.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { CONTATO, linkWhatsapp } from "@/lib/contato";
import { NIVEIS } from "@/lib/elenco";
import Estrelas from "@/components/Estrelas";
import Carta, { type Raridade } from "@/components/Carta";
import CardTimes from "@/components/CardTimes";

const D = `/${CONTATO.peladaDemo}`;
const P = `/p/${CONTATO.peladaDemo}`;

function Contato() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <a href={linkWhatsapp()} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center rounded-xl bg-zap font-semibold text-white">
        WhatsApp
      </a>
      <a href={`mailto:${CONTATO.email}?subject=${encodeURIComponent("Quero o MA Sorteio na minha pelada")}`} className="flex h-12 items-center justify-center rounded-xl border-2 border-roxo font-semibold text-roxo">
        E-mail
      </a>
    </div>
  );
}

function Caixa({ children, escura }: { children: ReactNode; escura?: boolean }) {
  return <div className={`flex flex-col gap-2 rounded-2xl p-4 text-sm ${escura ? "bg-noite text-white" : "border border-borda bg-white"}`}>{children}</div>;
}

type Passo = { titulo: string; texto: string; dicas?: string[]; visual?: ReactNode; ver?: { href: string; rotulo: string } };

const TIMES_EXEMPLO = [
  { jogadores: ["Cadu", "Diegão", "Luquinha", "Guga", "Leleco"].map((n) => ({ id: n, nome: n })), goleiro: "Paredão" },
  { jogadores: ["Gabi", "Dedé", "Bruneta", "Dudu", "Fabinho"].map((n) => ({ id: n, nome: n })), goleiro: "Prass" },
  { jogadores: ["Vini", "Digão", "Marquinhos", "Felipão", "Igão"].map((n) => ({ id: n, nome: n })), goleiro: "Marcão" },
];

const PASSOS: Passo[] = [
  {
    titulo: "Bem-vindo ao MA Sorteio de Times",
    texto: "Times equilibrados em segundos, placar ao vivo no celular de todo mundo e o campeonato da sua pelada, com cartas, prêmios e banners. Grátis pra jogar, sem anúncio.",
    dicas: ["Este tour usa a Pelada Piloto, uma pelada de demonstração com 30 jogadores fictícios.", "Toque em Próximo pra ver cada parte do app."],
    visual: (
      <Caixa escura>
        <span className="font-display text-3xl font-bold">
          MA <span className="text-roxo-claro">Sorteio</span>
        </span>
        <span className="text-[#CFC7E0]">Sortear · jogar · premiar</span>
      </Caixa>
    ),
  },
  {
    titulo: "1. Como ter a sua pelada no app",
    texto: `Fale com o administrador, ${CONTATO.nome}. Ele cria a pelada e te dá o acesso de admin (com Google ou com e-mail e senha). Depois você convida a galera por link ou QR code.`,
    dicas: [`WhatsApp: ${CONTATO.whatsappTexto}`, `E-mail: ${CONTATO.email}`],
    visual: <Contato />,
  },
  {
    titulo: "2. Elenco e estrelas",
    texto: "O admin cadastra a galera e dá as estrelas de 0,5 a 5 (tocando na metade da estrela dá meia). Tem também a avaliação completa com 7 atributos. Cada jogador pode ter vários apelidos.",
    dicas: ["As estrelas só os admins veem. Nunca aparecem pra jogador nem em imagem compartilhada.", "Posição, sabe marcar, goleiro e convidado ajudam o sorteio."],
    visual: (
      <Caixa>
        {[
          ["Gabi", 5],
          ["Rafinha", 4],
          ["Luquinha", 3],
          ["Igão", 1.5],
        ].map(([n, v]) => (
          <div key={n as string} className="flex items-center justify-between gap-2">
            <span className="flex flex-col">
              <span className="font-semibold">{n}</span>
              <span className="text-xs text-apagado">{NIVEIS[String(v)]}</span>
            </span>
            <Estrelas valor={v as number} tamanho={16} />
          </div>
        ))}
      </Caixa>
    ),
  },
  {
    titulo: "3. Cola a lista do WhatsApp",
    texto: "No dia da pelada, cola a mensagem inteira do grupo. O app separa linha, goleiros e suplentes, pega a data e o horário e reconhece cada nome, até pelo apelido.",
    dicas: ["Se tiver dois “Bruno”, ele pergunta qual é.", "Sem lista? Dá pra marcar na mão quem está disponível."],
    visual: (
      <Caixa>
        <pre className="rounded-lg bg-fundo p-2 font-mono text-xs leading-relaxed">{"Pelada 25/11\nHorário: 19:00\n1 - Cadu\n2 - Gabigol\n3 - Diego\nGoleiros\n1- Paredão"}</pre>
        <span className="text-xs text-apagado">↓ vira</span>
        <div className="flex flex-wrap gap-1.5">
          {["Cadu", "Gabi", "Diegão", "🧤 Paredão"].map((n) => (
            <span key={n} className="rounded-full bg-roxo-suave px-2.5 py-1 text-xs font-semibold text-roxo-escuro">
              {n}
            </span>
          ))}
        </div>
      </Caixa>
    ),
  },
  {
    titulo: "4. Monta o sorteio",
    texto: "Escolhe quantos times e quantos por time. O algoritmo distribui pela nota, testa centenas de trocas e respeita as regras da pelada.",
    dicas: ["Jogar junto e separar (salvas pra sempre).", "Equilibrar posições e goleiro fixo em cada time.", "Quem passa do limite fica na espera (laranja)."],
    visual: (
      <Caixa>
        <div className="grid grid-cols-4 gap-2">
          {[2, 3, 4, 5].map((n) => (
            <span key={n} className={`flex h-10 items-center justify-center rounded-xl border-2 font-display font-bold ${n === 3 ? "border-roxo bg-roxo text-white" : "border-borda"}`}>
              {n}
            </span>
          ))}
        </div>
        <span className="rounded-xl bg-roxo-suave px-3 py-2 text-xs font-semibold text-roxo-escuro">15 jogadores → 3 times de 5. Fecha certinho.</span>
      </Caixa>
    ),
  },
  {
    titulo: "5. Times sorteados, imagem e Zap",
    texto: "Até 4 sorteios pra escolher o melhor. Troca dois nomes tocando neles, marca o oficial e manda a imagem (clara ou escura) ou o texto pronto no grupo.",
    dicas: ["A imagem nunca leva nota.", "Só o admin vê a média de cada time e o alerta de desequilíbrio."],
    visual: <CardTimes pelada="Pelada Piloto" subtitulo="Sorteio 1 · 25/11" times={TIMES_EXEMPLO} escuro={false} formato="quadrada" />,
  },
  {
    titulo: "6. Partida ao vivo",
    texto: "Cronômetro e placar sincronizados em todos os celulares. O tempo é calculado pelo servidor, então todo mundo vê o mesmo relógio.",
    dicas: ["Qualquer um vê pelo link; pra marcar gol precisa do PIN do dia.", "Gol com autor e assistência, desfazer, goleiro de cada time.", "Modo telão pra um tablet na mesa.", "Internet ruim? Tem o cronômetro simples, que funciona só no aparelho."],
    visual: (
      <Caixa escura>
        <span className="text-center text-xs font-bold tracking-widest text-roxo-claro">ROLANDO · JOGO 3</span>
        <span className="text-center font-display text-6xl font-bold tabular-nums">4:32</span>
        <div className="flex items-center justify-center gap-6 font-display text-3xl font-bold">
          <span>2</span>
          <span className="text-white/40">×</span>
          <span>1</span>
        </div>
      </Caixa>
    ),
    ver: { href: `${P}/ao-vivo`, rotulo: "Ver o ao vivo" },
  },
  {
    titulo: "7. Resultados e fim da pelada",
    texto: "Todos os jogos do dia com correção fácil. No fim: o time campeão, artilheiro, garçom, menos vazado, tempo de bola rolando e uma mensagem pronta pro Zap.",
    visual: (
      <Caixa>
        <div className="rounded-xl bg-[#E7F5EC] p-3 text-[13px] leading-relaxed whitespace-pre-line">
          {"⚽ *PELADA PILOTO · 18/11*\n\n🏆 Campeão: Time 2 (4V 1E 1D)\n⚽ Artilheiro: Gabi (6 gols)\n👟 Garçom: PH (3 assistências)\n🧤 Menos vazado: Zé"}
        </div>
      </Caixa>
    ),
  },
  {
    titulo: "8. Votação e avaliação",
    texto: "Depois do último jogo abre a votação: craque, bagre e melhor goleiro. A galera também avalia se os times ficaram equilibrados e sugere ajuste de estrelas (só o admin vê).",
    ver: { href: `${P}/votar`, rotulo: "Ver a votação" },
  },
  {
    titulo: "9. Campeonato e gráficos",
    texto: "Semana e mês: prêmios, tabela de pontos (3 por vitória + 1 por gol), disputa dos goleiros com duelo, recordes e gráficos de artilharia e vitórias.",
    ver: { href: `${D}/campeonato`, rotulo: "Ver o campeonato" },
  },
  {
    titulo: "10. Cartas e álbum",
    texto: "Cada jogador ganha uma carta que sobe de nível sozinha. Cartas especiais liberam com medalhas, e o jogador escolhe qual mostrar. Animação de abrir pacote quando sobe!",
    dicas: ["Bronze → prata (10 peladas) → ouro (25 ou medalha no mês).", "Preta dourada = destaque da semana. Colorida = jogador do mês."],
    visual: (
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {(["bronze", "prata", "ouro", "artilheiro", "garcom", "muralha", "lenda", "destaque", "mes"] as Raridade[]).map((r) => (
          <Carta key={r} apelido="Gabi" posicao="ATA" pelada="Piloto" raridade={r} cor="#C8102E" stats={[{ v: 22, l: "JOG" }, { v: 16, l: "VIT" }, { v: 11, l: "GOL" }, { v: 3, l: "AST" }]} escala={0.6} />
        ))}
      </div>
    ),
    ver: { href: `${D}/album`, rotulo: "Ver o álbum" },
  },
  {
    titulo: "11. Banners pro Instagram e Zap",
    texto: "Banners do dia, da semana e do mês, em story ou quadrado, com a logo da pelada e a foto do premiado: artilheiro, garçom, muralha, craque, campeão, bagre e seleção.",
    ver: { href: `${D}/banners`, rotulo: "Ver os banners" },
  },
  {
    titulo: "12. Instala e recebe avisos",
    texto: "Instala na tela inicial (é um app de verdade, abre sem barra do navegador). Ativa as notificações: lembrete de sortear, a pelada começou, votação aberta e medalha nova.",
    dicas: ["Também tem mensalidade (quem pagou e cobrar no Zap), presença do mês, fotos do dia e página pública com QR code."],
  },
  {
    titulo: "Bora usar na sua pelada?",
    texto: `Chama o ${CONTATO.nome} que ele configura tudo pra você.`,
    visual: <Contato />,
    ver: { href: P, rotulo: "Ver a página da Pelada Piloto" },
  },
];

export default function TourPage() {
  const [i, setI] = useState(0);
  const passo = PASSOS[i];

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((x) => Math.min(PASSOS.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [i]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 px-4 pt-5 pb-28">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-display text-lg font-bold">
          MA <span className="text-roxo">Sorteio</span>
        </Link>
        <span className="text-sm text-apagado">
          {i + 1} de {PASSOS.length}
        </span>
      </header>
      <div className="flex gap-1" aria-hidden="true">
        {PASSOS.map((_, k) => (
          <span key={k} className={`h-1.5 flex-1 rounded-full ${k <= i ? "bg-roxo" : "bg-borda"}`} />
        ))}
      </div>

      <h1 className="font-display text-2xl font-bold tracking-tight">{passo.titulo}</h1>
      <p className="text-[15px] leading-relaxed text-tinta">{passo.texto}</p>
      {passo.visual}
      {passo.dicas && (
        <ul className="flex flex-col gap-1.5 text-sm text-apagado">
          {passo.dicas.map((d) => (
            <li key={d} className="flex gap-2">
              <span className="text-roxo">✓</span>
              {d}
            </li>
          ))}
        </ul>
      )}
      {passo.ver && (
        <Link href={passo.ver.href} className="flex h-12 items-center justify-center rounded-xl border border-roxo bg-white font-semibold text-roxo">
          {passo.ver.rotulo} →
        </Link>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-fundo/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2">
          <button type="button" disabled={i === 0} onClick={() => setI(i - 1)} className="h-12 flex-1 rounded-xl border border-borda bg-white font-semibold disabled:opacity-40">
            Voltar
          </button>
          {i < PASSOS.length - 1 ? (
            <button type="button" onClick={() => setI(i + 1)} className="h-12 flex-[2] rounded-xl bg-roxo font-bold text-white">
              Próximo
            </button>
          ) : (
            <Link href="/entrar" className="flex h-12 flex-[2] items-center justify-center rounded-xl bg-roxo font-bold text-white">
              Entrar no app
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
