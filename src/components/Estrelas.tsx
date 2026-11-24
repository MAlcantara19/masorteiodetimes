"use client";

const PATH = "M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z";

type Props = {
  valor: number;
  onChange?: (v: number) => void;
  tamanho?: number;
  rotulo?: string;
};

// Estrelas de 0,5 a 5. Metade esquerda da estrela = meia estrela.
export default function Estrelas({ valor, onChange, tamanho = 18, rotulo = "Nota" }: Props) {
  const gradId = "meia-estrela";
  return (
    <span className="inline-flex items-center" role={onChange ? "group" : "img"} aria-label={`${rotulo}: ${valor} de 5`}>
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id={gradId}>
            <stop offset="50%" stopColor="#7444D6" />
            <stop offset="50%" stopColor="#D9D3E6" />
          </linearGradient>
        </defs>
      </svg>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = valor >= i ? "#7444D6" : valor >= i - 0.5 ? `url(#${gradId})` : "#D9D3E6";
        return (
          <span key={i} className="relative inline-block" style={{ width: tamanho, height: tamanho }}>
            <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true">
              <path d={PATH} fill={fill} />
            </svg>
            {onChange && (
              <>
                <button
                  type="button"
                  aria-label={`${i - 0.5} estrelas`}
                  className="absolute inset-y-0 left-0 w-1/2"
                  onClick={() => onChange(i - 0.5)}
                />
                <button
                  type="button"
                  aria-label={`${i} ${i === 1 ? "estrela" : "estrelas"}`}
                  className="absolute inset-y-0 right-0 w-1/2"
                  onClick={() => onChange(i)}
                />
              </>
            )}
          </span>
        );
      })}
    </span>
  );
}
