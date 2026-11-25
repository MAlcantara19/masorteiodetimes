-- 0009: cadastro do jogador no perfil (WhatsApp, aniversário, onde joga, pé, autoavaliação),
-- avisos da pelada, lembretes pra galera e a lista de peladas abertas pra achar pelada.
-- Pode rodar mais de uma vez sem problema.

-- 1) Cadastro no perfil (o perfil só a própria pessoa e o master leem; admin vê pelo contatos_da_pelada)
alter table public.profiles add column if not exists whatsapp text;          -- só números, com 55 + DDD
alter table public.profiles add column if not exists nascimento date;
alter table public.profiles add column if not exists posicao text;           -- D, M, A, Q ou G (goleiro)
alter table public.profiles add column if not exists pe text;                -- destro, canhoto, ambos
alter table public.profiles add column if not exists autoavaliacao smallint; -- 1 a 5 (só admin vê)
do $$
begin
  alter table public.profiles add constraint profiles_posicao_ok check (posicao is null or posicao in ('D', 'M', 'A', 'Q', 'G'));
exception when duplicate_object then null;
end $$;
do $$
begin
  alter table public.profiles add constraint profiles_pe_ok check (pe is null or pe in ('destro', 'canhoto', 'ambos'));
exception when duplicate_object then null;
end $$;
do $$
begin
  alter table public.profiles add constraint profiles_autoavaliacao_ok check (autoavaliacao is null or autoavaliacao between 1 and 5);
exception when duplicate_object then null;
end $$;

-- O aniversário do perfil vale pra carta de aniversário em todas as peladas da pessoa.
create or replace function public.sincronizar_meu_cadastro() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_nasc date;
begin
  if auth.uid() is null then return; end if;
  select nascimento into v_nasc from public.profiles where id = auth.uid();
  if v_nasc is not null then
    update public.membros set nascimento = v_nasc where profile_id = auth.uid() and nascimento is distinct from v_nasc;
  end if;
end;
$$;
grant execute on function public.sincronizar_meu_cadastro() to authenticated;

-- Contato e cadastro de quem é da pelada: só admin (ou master).
create or replace function public.contatos_da_pelada(p_pelada uuid)
returns table (membro_id uuid, whatsapp text, nascimento date, posicao text, pe text, autoavaliacao smallint)
language sql stable security definer set search_path = public as $$
  select m.id, p.whatsapp, p.nascimento, p.posicao, p.pe, p.autoavaliacao
  from public.membros m
  join public.profiles p on p.id = m.profile_id
  where m.pelada_id = p_pelada and public.eh_admin(p_pelada);
$$;
grant execute on function public.contatos_da_pelada(uuid) to authenticated;

-- 2) Pelada: aparecer na busca de peladas, contato do admin e lembretes pra galera
alter table public.peladas add column if not exists publica boolean not null default false;
alter table public.peladas add column if not exists contato_whatsapp text;
alter table public.peladas add column if not exists aviso_dia boolean not null default true;   -- "hoje tem pelada", 7h
alter table public.peladas add column if not exists aviso_2h boolean not null default true;    -- "daqui a 2 horas"

-- 3) Avisos da pelada (o admin escreve; os lembretes automáticos também ficam aqui)
create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  pelada_id uuid not null references public.peladas on delete cascade,
  titulo text not null,
  texto text,
  link text,
  automatico boolean not null default false,
  criado_por uuid default auth.uid() references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists avisos_pelada on public.avisos (pelada_id, created_at desc);
alter table public.avisos enable row level security;
drop policy if exists "avisos: quem é da pelada lê" on public.avisos;
create policy "avisos: quem é da pelada lê" on public.avisos for select using (public.eh_membro(pelada_id));
drop policy if exists "avisos: admin escreve" on public.avisos;
create policy "avisos: admin escreve" on public.avisos for all using (public.eh_admin(pelada_id)) with check (public.eh_admin(pelada_id));

-- 4) Camisa montada peça por peça (modelo, tom sobre tom, cor do desenho, gola, mangas, friso)
--    e a cor da barra de menu de cada pelada. O modelo agora é livre (o app confere), por isso sai a trava antiga.
alter table public.peladas drop constraint if exists peladas_camisa_estilo_check;
alter table public.peladas add column if not exists camisa jsonb;    -- {tom, cor3, gola, mangas, friso}
alter table public.peladas add column if not exists cor_menu text;   -- cor (padrão, a cor da pelada) | claro | escuro
