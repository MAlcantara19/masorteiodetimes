// Aviso de recurso que não está no plano da pelada (com o contato pra liberar).
import { linkWhatsapp } from "@/lib/contato";
import { PLANOS } from "@/lib/planos";
import Icone from "./Icone";

export default function Bloqueado({ titulo, pelada, admin }: { titulo: string; pelada: string; admin: boolean }) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border border-borda bg-white p-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-roxo-suave text-roxo-escuro">
        <Icone nome="chave" />
      </span>
      <h2 className="font-display text-xl font-bold">{titulo}</h2>
      <p className="text-sm text-apagado">
        Esse recurso faz parte do plano <strong>{PLANOS.completo.nome}</strong> ({PLANOS.completo.preco} por pelada).
        {admin ? " Fala com o Matheus pra liberar na sua pelada." : " Peça pro admin da pelada liberar."}
      </p>
      {admin && (
        <a
          href={linkWhatsapp(`Oi Matheus! Quero liberar o plano Completo na pelada ${pelada}.`)}
          target="_blank"
          rel="noreferrer"
          className="flex h-11 items-center gap-2 rounded-xl bg-zap px-4 font-semibold text-white"
        >
          <Icone nome="zap" tamanho={18} /> Falar no WhatsApp
        </a>
      )}
    </section>
  );
}
