"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toPng } from "html-to-image";
import { comTemaClaro } from "@/lib/imagem";
import Estrelas from "@/components/Estrelas";
import { casarComElenco, lerLista, type ListaLida } from "@/lib/lista";
import { carregarElenco, formatarNota, NIVEIS, novoId, POSICOES, salvarElenco, type Jogador } from "@/lib/elenco";
import { mediaTime, sortear, somaTime, type JogadorSorteio, type Posicao } from "@/lib/sorteio";

const PELADA = "Bola Fora";

type Sorteio = { id: number; times: JogadorSorteio[][] };

export default function SortearPage() {
  const [elenco, setElenco] = useState<Jogador[]>([]);
  const [texto, setTexto] = useState("");
  const [lista, setLista] = useState<ListaLida | null>(null);
  const [presentes, setPresentes] = useState<string[]>([]); // ids, na ordem da lista
  const [goleiros, setGoleiros] = useState<string[]>([]);
  const [duvidas, setDuvidas] = useState<{ nome: string; sugestao: Jogador }[]>([]);
  const [editando, setEditando] = useState<string | null>(null);

  const [qtdTimes, setQtdTimes] = useState(3);
  const [porTime, setPorTime] = useState(5);
  const [equilibrarPos, setEquilibrarPos] = useState(true);
  const [juntos, setJuntos] = useState<string[]>([]);
  const [separar, setSeparar] = useState<string[]>([]);
  const [modoRegra, setModoRegra] = useState<"junto" | "separar" | null>(null);

  const [sorteios, setSorteios] = useState<Sorteio[]>([]);
  const [atual, setAtual] = useState(0);
  const [oficial, setOficial] = useState<number | null>(null);
  const [mostrarNotas, setMostrarNotas] = useState(true);
  const [selecionado, setSelecionado] = useState<[number, number] | null>(null);
  const [historico, setHistorico] = useState<{ idx: number; times: JogadorSorteio[][] }[]>([]);
  const [escuro, setEscuro] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const proxId = useRef(1);

  useEffect(() => {
    // Lê o que ficou guardado neste aparelho (só existe no navegador).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setElenco(carregarElenco());
    try {
      const t = window.localStorage.getItem("masorteio:ultima-lista");
      if (t) setTexto(t);
    } catch {}
  }, []);

  const porId = useMemo(() => new Map(elenco.map((j) => [j.id, j])), [elenco]);

  function atualizarElenco(novo: Jogador[]) {
    setElenco(novo);
    salvarElenco(novo);
  }

  function editarJogador(id: string, mudanca: Partial<Jogador>) {
    atualizarElenco(elenco.map((j) => (j.id === id ? { ...j, ...mudanca } : j)));
  }

  function lerTexto() {
    const l = lerLista(texto);
    try {
      window.localStorage.setItem("masorteio:ultima-lista", texto);
    } catch {}
    let novoElenco = elenco.slice();
    const garantir = (nomes: string[], goleiro: boolean) => {
      const ids: string[] = [];
      const pendentes: { nome: string; sugestao: Jogador }[] = [];
      for (const c of casarComElenco(nomes, novoElenco)) {
        if (c.tipo === "exato") ids.push(c.jogador.id);
        else {
          const j: Jogador = { id: novoId(), nome: c.nome, nota: 3, posicao: "Q", goleiro };
          novoElenco = [...novoElenco, j];
          ids.push(j.id);
          if (c.tipo === "parecido") pendentes.push({ nome: c.nome, sugestao: c.jogador });
        }
      }
      return { ids, pendentes };
    };
    const linha = garantir(l.linha.map((x) => x.nome), false);
    const gols = garantir(l.goleiros.map((x) => x.nome), true);
    atualizarElenco(novoElenco);
    setLista(l);
    setPresentes(linha.ids);
    setGoleiros(gols.ids);
    setDuvidas([...linha.pendentes, ...gols.pendentes]);
    setSorteios([]);
  }

  // "É ele": troca o cadastro novo pelo jogador que já existia.
  function confirmarDuvida(nome: string, sugestao: Jogador, ehEle: boolean) {
    if (ehEle) {
      const novo = elenco.find((j) => j.nome === nome && j.id !== sugestao.id);
      if (novo) {
        setPresentes((p) => p.map((id) => (id === novo.id ? sugestao.id : id)));
        setGoleiros((g) => g.map((id) => (id === novo.id ? sugestao.id : id)));
        atualizarElenco(elenco.filter((j) => j.id !== novo.id));
      }
    }
    setDuvidas((d) => d.filter((x) => x.nome !== nome));
  }

  const linhaAtiva = presentes.map((id) => porId.get(id)).filter((j): j is Jogador => !!j);
  const vagas = qtdTimes * porTime;
  const sobra = linhaAtiva.length - vagas;

  function tocarNome(id: string) {
    if (modoRegra === "junto") {
      setJuntos((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
      return;
    }
    if (modoRegra === "separar") {
      setSeparar((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-2)));
      return;
    }
    setEditando(editando === id ? null : id);
  }

  function gerarSorteio(): Sorteio {
    const jogadores: JogadorSorteio[] = linhaAtiva.map((j) => ({ id: j.id, nome: j.apelido || j.nome, nota: j.nota, posicao: j.posicao }));
    const r = sortear(jogadores, {
      times: qtdTimes,
      porTime,
      juntos: juntos.length > 1 ? [juntos] : [],
      separar: separar.length === 2 ? [[separar[0], separar[1]]] : [],
      equilibrarPosicoes: equilibrarPos,
    });
    return { id: proxId.current++, times: r.times };
  }

  function sortearNovo(adicionar: boolean) {
    if (linhaAtiva.length < qtdTimes) return;
    const s = gerarSorteio();
    if (adicionar && sorteios.length < 4) {
      setSorteios([...sorteios, s]);
      setAtual(sorteios.length);
    } else {
      setSorteios([s]);
      setAtual(0);
      setOficial(null);
    }
    setHistorico([]);
    setSelecionado(null);
  }

  function fecharSorteio(i: number) {
    const s = sorteios.filter((_, k) => k !== i);
    if (oficial === sorteios[i].id) setOficial(null);
    setSorteios(s);
    setAtual(Math.max(0, Math.min(atual > i ? atual - 1 : atual, s.length - 1)));
    setHistorico([]);
  }

  function tocarNoTime(ti: number, pi: number) {
    if (!selecionado || selecionado[0] === ti) {
      setSelecionado(selecionado && selecionado[0] === ti && selecionado[1] === pi ? null : [ti, pi]);
      return;
    }
    const s = sorteios[atual];
    const antes = s.times.map((t) => t.slice());
    const times = s.times.map((t) => t.slice());
    const [a, b] = selecionado;
    [times[a][b], times[ti][pi]] = [times[ti][pi], times[a][b]];
    setSorteios(sorteios.map((x, k) => (k === atual ? { ...x, times } : x)));
    setHistorico([...historico, { idx: atual, times: antes }]);
    setSelecionado(null);
  }

  function desfazer() {
    const u = historico[historico.length - 1];
    if (!u) return;
    setSorteios(sorteios.map((x, k) => (k === u.idx ? { ...x, times: u.times } : x)));
    setAtual(u.idx);
    setHistorico(historico.slice(0, -1));
  }

  const sorteioAtual = sorteios[atual];
  const goleirosNomes = goleiros.map((id) => porId.get(id)).filter((j): j is Jogador => !!j).map((j) => j.apelido || j.nome);
  const dataTxt = lista?.data ? lista.data.split("/").slice(0, 2).join("/") : "";

  const somas = sorteioAtual ? sorteioAtual.times.map(somaTime) : [];
  const diferenca = somas.length ? Math.max(...somas) - Math.min(...somas) : 0;

  function textoZap(): string {
    if (!sorteioAtual) return "";
    const partes = sorteioAtual.times.map((t, i) => {
      const gk = goleirosNomes[i] ? `\n🧤 ${goleirosNomes[i]}` : "";
      return `*Time ${i + 1}*\n${t.map((j) => j.nome).join("\n")}${gk}`;
    });
    return `⚽ *${PELADA}${dataTxt ? " · " + dataTxt : ""}* · Sorteio ${atual + 1}\n\n${partes.join("\n\n")}\n\n_Times gerados pelo MA Sorteio de Times_`;
  }

  async function copiarZap() {
    try {
      await navigator.clipboard.writeText(textoZap());
      setAviso("Texto copiado. É só colar no grupo.");
    } catch {
      setAviso("Não deu pra copiar automaticamente.");
    }
  }

  function abrirZap() {
    window.open(`https://wa.me/?text=${encodeURIComponent(textoZap())}`, "_blank");
  }

  async function baixarImagem() {
    if (!cardRef.current) return;
    setCapturando(true); // esconde notas e seleção antes de gerar a imagem
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const el = cardRef.current;
      const url = await comTemaClaro(() => toPng(el, { pixelRatio: 2, backgroundColor: escuro ? "#17121F" : "#ffffff" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${PELADA.toLowerCase().replace(/\s+/g, "-")}-sorteio-${atual + 1}.png`;
      a.click();
    } catch {
      setAviso("Não deu pra gerar a imagem neste navegador.");
    } finally {
      setCapturando(false);
    }
  }

  const notasVisiveis = mostrarNotas && !capturando;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 pb-40 pt-6">
      <header className="flex items-center justify-between">
        <div className="flex flex-col">
          <Link href="/" className="text-sm font-semibold text-roxo">← Início</Link>
          <h1 className="font-display text-2xl font-bold">Montar sorteio</h1>
          <span className="text-sm text-apagado">{PELADA}{lista?.data ? ` · ${lista.data}` : ""}{lista?.horario ? ` · ${lista.horario}` : ""}</span>
        </div>
      </header>

      <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
        <label htmlFor="lista" className="text-sm font-semibold">Colar lista do WhatsApp</label>
        <textarea
          id="lista"
          rows={lista ? 3 : 8}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={"Pelada 23/11/2026\nHorário: 18:30 até 20:30\n1 - Fulano\n2 - Ciclano\n\nGoleiros\n1-Tilu"}
          className="w-full resize-y rounded-xl border border-borda bg-fundo p-3 font-mono text-xs"
        />
        <button onClick={lerTexto} disabled={!texto.trim()} className="h-12 rounded-xl bg-roxo font-semibold text-white disabled:opacity-40">
          {lista ? "Ler de novo" : "Ler lista"}
        </button>
        {lista && (
          <p className="text-sm text-roxo-escuro">
            {lista.linha.length} de linha · {lista.goleiros.length} goleiros · {lista.suplentes.length} suplentes
          </p>
        )}
      </section>

      {duvidas.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-alerta/40 bg-white p-4">
          <h2 className="text-sm font-semibold">Confirma esses nomes</h2>
          {duvidas.map((d) => (
            <div key={d.nome} className="flex items-center gap-2">
              <span className="flex-1 text-sm">
                <strong>{d.nome}</strong> é o <strong>{d.sugestao.apelido || d.sugestao.nome}</strong>?
              </span>
              <button onClick={() => confirmarDuvida(d.nome, d.sugestao, true)} className="h-9 rounded-lg bg-roxo px-3 text-sm font-semibold text-white">É ele</button>
              <button onClick={() => confirmarDuvida(d.nome, d.sugestao, false)} className="h-9 rounded-lg border border-borda px-3 text-sm font-semibold">Outro</button>
            </div>
          ))}
        </section>
      )}

      {linhaAtiva.length > 0 && (
        <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Quem joga hoje · {linhaAtiva.length}</h2>
            <button onClick={() => setMostrarNotas(!mostrarNotas)} className="text-xs font-semibold text-roxo">
              {mostrarNotas ? "Esconder notas" : "Mostrar notas"}
            </button>
          </div>
          {modoRegra && (
            <p className="rounded-lg bg-roxo-suave px-3 py-2 text-xs font-semibold text-roxo-escuro">
              {modoRegra === "junto" ? "Toca nos nomes que vão jogar juntos." : "Toca em 2 nomes que não podem cair juntos."}
              <button onClick={() => setModoRegra(null)} className="ml-2 underline">Pronto</button>
            </p>
          )}
          <ul className="flex flex-col">
            {linhaAtiva.map((j, i) => {
              const espera = i >= vagas;
              const marcaJunto = juntos.includes(j.id);
              const marcaSep = separar.includes(j.id);
              return (
                <li key={j.id} className="border-b border-borda/70 last:border-0">
                  <div className="flex min-h-12 items-center gap-2">
                    <button onClick={() => tocarNome(j.id)} className="flex flex-1 flex-col text-left">
                      <span className={`font-medium ${espera ? "text-alerta-escuro" : ""}`}>
                        {j.apelido || j.nome}
                        {marcaJunto && <span className="ml-2 rounded-full bg-roxo-suave px-2 text-xs text-roxo-escuro">junto</span>}
                        {marcaSep && <span className="ml-2 rounded-full bg-alerta-suave px-2 text-xs text-alerta-escuro">separar</span>}
                        {espera && <span className="ml-2 text-xs">na espera</span>}
                      </span>
                      {notasVisiveis && <span className="text-xs text-apagado">{POSICOES[j.posicao]}</span>}
                    </button>
                    {notasVisiveis && <Estrelas valor={j.nota} tamanho={16} />}
                    <button
                      onClick={() => setPresentes(presentes.filter((x) => x !== j.id))}
                      aria-label={`Tirar ${j.nome} da lista`}
                      className="h-9 w-9 rounded-lg text-apagado"
                    >
                      ×
                    </button>
                  </div>
                  {editando === j.id && notasVisiveis && (
                    <div className="flex flex-col gap-2 pb-3">
                      <div className="flex items-center gap-3">
                        <Estrelas valor={j.nota} tamanho={34} onChange={(v) => editarJogador(j.id, { nota: v })} rotulo={`Nota de ${j.nome}`} />
                        <span className="font-display text-xl font-bold">{formatarNota(j.nota)}</span>
                      </div>
                      <span className="text-xs text-apagado">{NIVEIS[String(j.nota)]}</span>
                      <div className="flex flex-wrap gap-1">
                        {(Object.keys(POSICOES) as Posicao[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => editarJogador(j.id, { posicao: p })}
                            className={`h-8 rounded-full border px-3 text-xs font-semibold ${j.posicao === p ? "border-roxo bg-roxo text-white" : "border-borda"}`}
                          >
                            {POSICOES[p]}
                          </button>
                        ))}
                      </div>
                      <input
                        defaultValue={j.apelido || ""}
                        placeholder="Apelido (opcional)"
                        onBlur={(e) => editarJogador(j.id, { apelido: e.target.value.trim() || null })}
                        className="h-10 rounded-lg border border-borda px-3 text-sm"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {goleirosNomes.length > 0 && <p className="text-xs text-apagado">Goleiros (fora da média): {goleirosNomes.join(", ")}</p>}
        </section>
      )}

      {linhaAtiva.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-white p-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Quantos times?</span>
            <div className="grid grid-cols-4 gap-2">
              {[2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setQtdTimes(n)}
                  className={`h-12 rounded-xl border-2 font-display text-xl font-bold ${qtdTimes === n ? "border-roxo bg-roxo text-white" : "border-borda"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Jogadores por time</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPorTime(Math.max(2, porTime - 1))} aria-label="Menos um" className="h-11 w-11 rounded-xl border border-borda bg-fundo text-xl">−</button>
              <span className="w-10 text-center font-display text-2xl font-bold">{porTime}</span>
              <button onClick={() => setPorTime(Math.min(11, porTime + 1))} aria-label="Mais um" className="h-11 w-11 rounded-xl border border-borda bg-fundo text-xl">+</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setModoRegra(modoRegra === "junto" ? null : "junto")} className="h-10 rounded-full border border-roxo px-3 text-sm font-semibold text-roxo-escuro">
              Jogar junto{juntos.length ? ` (${juntos.length})` : ""}
            </button>
            <button onClick={() => setModoRegra(modoRegra === "separar" ? null : "separar")} className="h-10 rounded-full border border-alerta px-3 text-sm font-semibold text-alerta-escuro">
              Separar{separar.length ? ` (${separar.length})` : ""}
            </button>
            <button
              onClick={() => setEquilibrarPos(!equilibrarPos)}
              className={`h-10 rounded-full border px-3 text-sm font-semibold ${equilibrarPos ? "border-roxo bg-roxo-suave text-roxo-escuro" : "border-borda"}`}
            >
              Equilibrar posições {equilibrarPos ? "✓" : ""}
            </button>
          </div>
          <p className={`rounded-xl px-3 py-2 text-sm font-semibold ${sobra === 0 ? "bg-roxo-suave text-roxo-escuro" : "bg-alerta-suave text-alerta-escuro"}`}>
            {sobra === 0 && `${linhaAtiva.length} jogadores → ${qtdTimes} times de ${porTime}. Fecha certinho.`}
            {sobra > 0 && `${sobra} a mais: os últimos da lista ficam na espera.`}
            {sobra < 0 && `Faltam ${-sobra} pra ${qtdTimes} times de ${porTime}.`}
          </p>
        </section>
      )}

      {sorteioAtual && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {sorteios.map((s, i) => (
              <span key={s.id} className={`flex h-9 items-center rounded-full border ${i === atual ? "border-noite bg-noite text-white" : "border-borda bg-white"}`}>
                <button onClick={() => { setAtual(i); setSelecionado(null); }} className="pl-3 pr-1 text-sm font-semibold">
                  {oficial === s.id ? "★ " : ""}Sorteio {i + 1}
                </button>
                <button onClick={() => fecharSorteio(i)} aria-label={`Fechar sorteio ${i + 1}`} className="px-2 text-sm">×</button>
              </span>
            ))}
            {sorteios.length < 4 && (
              <button onClick={() => sortearNovo(true)} className="h-9 rounded-full border border-dashed border-apagado px-3 text-sm font-semibold">+ Sortear</button>
            )}
          </div>

          {notasVisiveis && diferenca >= 1 && (
            <p role="status" className="rounded-lg bg-alerta-suave px-3 py-2 text-xs font-semibold text-alerta-escuro">
              Só admins veem: diferença de {formatarNota(diferenca)}★ entre o time mais forte e o mais fraco.
            </p>
          )}
          <p className="text-xs text-apagado">Toca em 2 nomes de times diferentes pra trocar. As médias nunca saem na imagem.</p>

          <div ref={cardRef} className={`rounded-md p-3 ${escuro ? "bg-[#17121F] text-white" : "bg-white"}`}>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-display text-xl font-bold">{PELADA}</span>
              <span className={`text-sm font-semibold ${escuro ? "text-[#B9AFCB]" : "text-apagado"}`}>Sorteio {atual + 1}{dataTxt ? ` · ${dataTxt}` : ""}</span>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(sorteioAtual.times.length, 3)}, minmax(0, 1fr))` }}>
              {sorteioAtual.times.map((t, ti) => (
                <div key={ti} className="flex flex-col">
                  <div className="rounded-t bg-roxo px-2 py-1 text-base font-semibold text-white">Time {ti + 1}</div>
                  {notasVisiveis && (
                    <div className="bg-roxo-suave px-2 py-1 text-xs font-bold text-roxo-escuro">média ★{formatarNota(mediaTime(t))} · soma {formatarNota(somaTime(t))}</div>
                  )}
                  {t.map((j, pi) => {
                    const sel = !capturando && selecionado?.[0] === ti && selecionado?.[1] === pi;
                    return (
                      <button
                        key={j.id}
                        onClick={() => tocarNoTime(ti, pi)}
                        className={`min-h-8 px-2 text-left text-sm leading-tight ${sel ? (escuro ? "bg-[#4A3A73]" : "bg-[#F1E8FF]") : ""}`}
                      >
                        {j.nome}
                        {notasVisiveis && <span className="ml-1 text-xs opacity-60">{formatarNota(j.nota)}</span>}
                      </button>
                    );
                  })}
                  {goleirosNomes[ti] && <span className={`px-2 text-xs ${escuro ? "text-[#B9AFCB]" : "text-apagado"}`}>Gol: {goleirosNomes[ti]}</span>}
                </div>
              ))}
            </div>
            <p className={`mt-3 text-center text-xs font-medium ${escuro ? "text-roxo-claro" : "text-roxo"}`}>Times gerados pelo MA Sorteio de Times</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setEscuro(!escuro)} className="h-9 rounded-full border border-borda bg-white px-3 text-sm font-semibold">Fundo {escuro ? "claro" : "escuro"}</button>
            <button onClick={desfazer} disabled={!historico.length} className="h-9 rounded-full border border-borda bg-white px-3 text-sm font-semibold disabled:opacity-40">Desfazer troca</button>
            <button
              onClick={() => setOficial(oficial === sorteioAtual.id ? null : sorteioAtual.id)}
              className={`h-9 rounded-full px-3 text-sm font-semibold ${oficial === sorteioAtual.id ? "bg-roxo-escuro text-white" : "border border-roxo text-roxo-escuro"}`}
            >
              {oficial === sorteioAtual.id ? "★ Oficial do dia" : "Marcar como oficial"}
            </button>
          </div>
        </section>
      )}

      {aviso && (
        <p role="status" onClick={() => setAviso(null)} className="rounded-lg bg-noite px-3 py-2 text-sm text-white">{aviso}</p>
      )}

      {linhaAtiva.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-borda bg-fundo/95 px-4 pb-6 pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-xl flex-col gap-2">
            {sorteioAtual && (
              <div className="grid grid-cols-3 gap-2">
                <button onClick={baixarImagem} className="h-11 rounded-xl border-2 border-noite bg-white text-sm font-semibold">Baixar imagem</button>
                <button onClick={copiarZap} className="h-11 rounded-xl border-2 border-zap bg-white text-sm font-semibold text-zap">Copiar texto</button>
                <button onClick={abrirZap} className="h-11 rounded-xl bg-zap text-sm font-semibold text-white">Mandar no Zap</button>
              </div>
            )}
            <button onClick={() => sortearNovo(false)} disabled={sobra < 0} className="h-13 rounded-2xl bg-roxo py-3 text-lg font-bold text-white disabled:opacity-40">
              {sorteioAtual ? "Sortear do zero" : "Sortear"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
