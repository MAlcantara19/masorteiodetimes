// Sons do app, feitos na hora pelo navegador (sem arquivo de áudio): apito do juiz e a voz narrando o gol.
// O navegador só deixa tocar som depois que alguém toca na tela: chame liberarSom() num clique.

type Janela = Window & { webkitAudioContext?: typeof AudioContext };
let ctx: AudioContext | null = null;

export function liberarSom() {
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as Janela).webkitAudioContext;
      if (!C) return;
      ctx = new C();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  } catch {}
}

// Um trinado de apito: tom agudo com "vibrato" rápido, começando em `inicio` (s) e durando `dur` (s).
function trinado(inicio: number, dur: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const prof = ctx.createGain();
  const vol = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 2900;
  lfo.frequency.value = 32;
  prof.gain.value = 180;
  lfo.connect(prof).connect(osc.frequency);
  const t = ctx.currentTime + inicio;
  vol.gain.setValueAtTime(0, t);
  vol.gain.linearRampToValueAtTime(0.35, t + 0.02);
  vol.gain.setValueAtTime(0.35, t + dur - 0.05);
  vol.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(vol).connect(ctx.destination);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + dur + 0.05);
  lfo.stop(t + dur + 0.05);
}

// Fim de jogo: dois curtos e um longo. Gol/aviso: um curto.
export function apitar(tipo: "fim" | "curto" = "fim") {
  liberarSom();
  if (!ctx) return;
  if (tipo === "curto") return trinado(0, 0.35);
  trinado(0, 0.3);
  trinado(0.45, 0.3);
  trinado(0.9, 1.1);
}

function frase(texto: string, rate: number, pitch: number) {
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = "pt-BR";
  u.rate = rate;
  u.pitch = pitch;
  const vozes = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("pt-br"));
  // Prefere as vozes "naturais"/online, que soam melhor que a voz robô padrão.
  const voz = vozes.find((v) => /natural|online|google/i.test(v.name)) ?? vozes[0];
  if (voz) u.voice = voz;
  return u;
}

export function falar(texto: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(frase(texto, 1.05, 1.1));
  } catch {}
}

// Narrador empolgado (voz do próprio aparelho, sem imitar nenhum narrador de verdade).
const DEPOIS = [
  (n: string) => `É do ${n}!`,
  (n: string) => `${n}! Balançou a rede!`,
  (n: string) => `Ele mesmo, ${n}! Que pintura!`,
  (n: string) => `${n} não perdoa!`,
  (n: string) => `Lá vai ${n}, e é gol!`,
  (n: string) => `Bola na rede! Gol do ${n}!`,
];

export function narrarGol(nome: string | null, contra = false) {
  try {
    if (!("speechSynthesis" in window)) return;
    const s = window.speechSynthesis;
    s.cancel();
    s.speak(frase(contra ? "Gol contra!" : "Goooooooooooool!", 0.75, 1.35));
    if (contra) s.speak(frase("Que azar!", 1.1, 1.1));
    else if (nome) s.speak(frase(DEPOIS[Math.floor(Math.random() * DEPOIS.length)](nome), 1.1, 1.2));
  } catch {}
}
