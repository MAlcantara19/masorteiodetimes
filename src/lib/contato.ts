// Contato do dono do app (aparece no tour e na tela de entrar).
export const CONTATO = {
  nome: "Matheus Alcântara",
  whatsapp: "5524992924519", // (24) 99292-4519
  whatsappTexto: "(24) 99292-4519",
  email: "matheusalcan19@gmail.com",
  peladaDemo: "piloto",
};

export function linkWhatsapp(texto = "Oi Matheus! Vi o MA Sorteio de Times e quero usar na minha pelada.") {
  return `https://wa.me/${CONTATO.whatsapp}?text=${encodeURIComponent(texto)}`;
}
