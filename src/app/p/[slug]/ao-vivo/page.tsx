// Link público ao vivo. A tela é a AoVivo (cliente); o marcador abaixo avisa o Next que
// esta página é sempre "na hora" (a prévia do link mostra o placar atual).
import { Suspense } from "react";
import { connection } from "next/server";
import AoVivo from "./AoVivo";

async function NaHora() {
  await connection();
  return null;
}

export default function AoVivoPage() {
  return (
    <>
      <AoVivo />
      <Suspense fallback={null}>
        <NaHora />
      </Suspense>
    </>
  );
}
