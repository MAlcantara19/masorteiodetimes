// Quadro de conquistas do jogador: as que ele já tem ficam coloridas; as outras mostram como ganhar.
import { CONQUISTAS, type Ganha } from "@/lib/conquistas";

export default function Conquistas({ ganhas, titulo = "Conquistas da temporada" }: { ganhas: Ganha[]; titulo?: string }) {
  const tem = new Map(ganhas.map((g) => [g.id, g.vezes]));
  const todas = Object.values(CONQUISTAS).sort((a, b) => Number(tem.has(b.id)) - Number(tem.has(a.id)));
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-white p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{titulo}</span>
        <span className="text-xs text-apagado">
          {tem.size} de {todas.length}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {todas.map((c) => {
          const n = tem.get(c.id);
          return (
            <div key={c.id} title={c.como} className={`relative flex flex-col items-center gap-0.5 rounded-xl p-2 text-center ${n ? "bg-roxo-suave" : "bg-fundo opacity-50"}`}>
              <span className={`text-2xl ${n ? "" : "grayscale"}`}>{c.emoji}</span>
              <span className="text-[11px] leading-tight font-bold">{c.titulo}</span>
              <span className="text-[10px] leading-tight text-apagado">{c.como}</span>
              {n && n > 1 && <span className="absolute top-1 right-1 rounded-full bg-roxo px-1.5 text-[10px] font-bold text-white">{n}×</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
