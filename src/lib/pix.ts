// Pix "copia e cola" (BR Code, padrão do Banco Central) com valor, pra virar QR Code.
// Não precisa de banco nem de API: é só um texto no formato certo, com uma conferência (CRC) no fim.

function campo(id: string, valor: string) {
  return id + String(valor.length).padStart(2, "0") + valor;
}

function limpar(txt: string, max: number) {
  return txt
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-@]/g, "")
    .toUpperCase()
    .trim()
    .slice(0, max);
}

// CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no fim do BR Code.
function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type DadosPix = { chave: string; nome: string; cidade: string; valor?: number | null; descricao?: string };

export function gerarPix({ chave, nome, cidade, valor, descricao }: DadosPix): string {
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", chave.trim()) + (descricao ? campo("02", limpar(descricao, 40)) : "");
  let p =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    (valor && valor > 0 ? campo("54", valor.toFixed(2)) : "") +
    campo("58", "BR") +
    campo("59", limpar(nome, 25) || "RECEBEDOR") +
    campo("60", limpar(cidade, 15) || "BRASIL") +
    campo("62", campo("05", "***"));
  p += "6304";
  return p + crc16(p);
}

export function mesRotulo(mesIso: string) {
  const [a, m] = mesIso.split("-").map(Number);
  return new Date(a, m - 1, 1, 12).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
