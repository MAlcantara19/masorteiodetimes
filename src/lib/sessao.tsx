"use client";
// Quem está logado, o perfil e em quais peladas a pessoa está (e com qual papel).
// Qualquer tela usa com: const { usuario, perfil, ehMaster, ehAdmin } = useSessao();
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { criarClienteSupabase } from "@/lib/supabase/client";

export type Perfil = {
  id: string;
  nome: string;
  apelido: string | null;
  foto_url: string | null;
  email: string | null;
  is_master: boolean;
  perfil_completo: boolean;
  cor_card: string | null;
  estilo_card?: string | null;
  numero_camisa?: number | null; // SQL 0005
};

export type PeladaResumo = {
  id: string;
  nome: string;
  slug: string;
  dia_semana: number | null;
  horario: string | null;
  horario_fim: string | null;
  local: string | null;
  logo_url: string | null;
  lembrete_horas_antes: number;
  cor_banner?: string | null;
  cor_secundaria?: string | null; // (SQL 0004)
  camisa_estilo?: string | null;
  plano?: string | null;
  recursos?: Record<string, boolean> | null;
  plano_ate?: string | null;
  lista_app?: boolean; // (SQL 0007)
};

export type Vinculo = { membro_id: string; papel: "admin" | "jogador"; pelada: PeladaResumo };

type Sessao = {
  carregando: boolean;
  usuario: User | null;
  perfil: Perfil | null;
  vinculos: Vinculo[];
  peladas: PeladaResumo[]; // as que a pessoa vê (master vê todas)
  ehMaster: boolean;
  ehAdmin: (peladaId: string) => boolean;
  ehAdminDeAlguma: boolean;
  recarregar: () => Promise<void>;
  sair: () => Promise<void>;
};

const Contexto = createContext<Sessao | null>(null);

// "*" pra funcionar antes e depois dos SQLs novos (colunas de cor e plano).
const CAMPOS_PELADA = "*";

// Liga a conta aos nomes que o admin cadastrou com o e-mail dela (uma vez por login; SQL 0007).
const jaVinculou = new Set<string>();

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [todas, setTodas] = useState<PeladaResumo[]>([]);

  const carregar = useCallback(async (u: User | null) => {
    setUsuario(u);
    if (!u) {
      setPerfil(null);
      setVinculos([]);
      setTodas([]);
      setCarregando(false);
      return;
    }
    const sb = criarClienteSupabase();
    if (!jaVinculou.has(u.id)) {
      jaVinculou.add(u.id);
      await sb.rpc("vincular_minha_conta");
    }
    const [{ data: p }, { data: m }] = await Promise.all([
      sb.from("profiles").select("*").eq("id", u.id).maybeSingle(),
      sb.from("membros").select(`id, papel, peladas(${CAMPOS_PELADA})`).eq("profile_id", u.id).eq("ativo", true),
    ]);
    setPerfil((p as Perfil) ?? null);
    const lista = ((m ?? []) as unknown as { id: string; papel: "admin" | "jogador"; peladas: PeladaResumo | null }[])
      .filter((x) => x.peladas)
      .map((x) => ({ membro_id: x.id, papel: x.papel, pelada: x.peladas as PeladaResumo }));
    setVinculos(lista);
    if (p?.is_master) {
      const { data: t } = await sb.from("peladas").select(CAMPOS_PELADA).order("nome");
      setTodas((t ?? []) as PeladaResumo[]);
    } else {
      setTodas([]);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    let sb;
    try {
      sb = criarClienteSupabase();
    } catch {
      // Sem chaves configuradas: o app abre deslogado.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCarregando(false);
      return;
    }
    sb.auth.getUser().then(({ data }) => carregar(data.user));
    const { data } = sb.auth.onAuthStateChange((evento, s) => {
      // Importante: não consultar o banco DENTRO deste aviso (a biblioteca do Supabase trava).
      // O setTimeout joga a consulta pra depois que o aviso termina.
      if (evento === "SIGNED_IN" || evento === "SIGNED_OUT" || evento === "USER_UPDATED") {
        setTimeout(() => carregar(s?.user ?? null), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [carregar]);

  const valor = useMemo<Sessao>(() => {
    const ehMaster = !!perfil?.is_master;
    const admins = new Set(vinculos.filter((v) => v.papel === "admin").map((v) => v.pelada.id));
    const porId = new Map<string, PeladaResumo>();
    for (const v of vinculos) porId.set(v.pelada.id, v.pelada);
    for (const p of todas) porId.set(p.id, p);
    return {
      carregando,
      usuario,
      perfil,
      vinculos,
      peladas: [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome)),
      ehMaster,
      ehAdmin: (id) => ehMaster || admins.has(id),
      ehAdminDeAlguma: ehMaster || admins.size > 0,
      recarregar: async () => {
        const { data } = await criarClienteSupabase().auth.getUser();
        await carregar(data.user);
      },
      sair: async () => {
        // As telas que exigem login voltam sozinhas pra /entrar quando o usuário some.
        await criarClienteSupabase().auth.signOut();
      },
    };
  }, [carregando, usuario, perfil, vinculos, todas, carregar]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): Sessao {
  const s = useContext(Contexto);
  if (!s) throw new Error("useSessao precisa estar dentro do SessaoProvider");
  return s;
}
