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

export function falar(texto: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "pt-BR";
    u.rate = 1.05;
    u.pitch = 1.1;
    const voz = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("pt-br"));
    if (voz) u.voice = voz;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}
