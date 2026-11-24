-- MA Sorteio de Times — schema da etapa 2 (login + dados na nuvem).
-- Rodar no Supabase: SQL Editor → New query → colar → Run.

create extension if not exists pgcrypto;

-- Perfil de cada pessoa que entra (Google ou e-mail)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nome text not null default '',
  apelido text,
  foto_url text,
  is_master boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.peladas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique not null,
  dia_semana smallint,               -- 0 = domingo
  horario time,
  local text,
  logo_url text,
  regra_fim text not null default 'tempo' check (regra_fim in ('tempo', 'tempo_ou_gols', 'gols')),
  minutos smallint not null default 7,
  gols_limite smallint default 2,
  lembrete_horas_antes smallint not null default 2,
  pin_ao_vivo text,
  created_at timestamptz not null default now()
);

-- Elenco da pelada. profile_id é opcional: dá pra cadastrar quem ainda não tem login.
create table public.membros (
  id uuid primary key default gen_random_uuid(),
  pelada_id uuid not null references public.peladas on delete cascade,
  profile_id uuid references public.profiles on delete set null,
  nome text not null,
  apelido text,
  papel text not null default 'jogador' check (papel in ('admin', 'jogador')),
  posicao text not null default 'Q' check (posicao in ('D', 'M', 'A', 'Q')),
  sabe_marcar boolean not null default false,
  goleiro boolean not null default false,
  convidado boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Notas ficam separadas: só admin lê e escreve (regra de ouro do app).
create table public.notas (
  membro_id uuid primary key references public.membros on delete cascade,
  nota_simples numeric(2,1) not null default 3 check (nota_simples between 0.5 and 5),
  atributos jsonb,
  atualizado_por uuid references public.profiles,
  updated_at timestamptz not null default now()
);

create table public.regras_sorteio (
  id uuid primary key default gen_random_uuid(),
  pelada_id uuid not null references public.peladas on delete cascade,
  tipo text not null check (tipo in ('junto', 'separar')),
  membros uuid[] not null
);

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  pelada_id uuid not null references public.peladas on delete cascade,
  data date not null,
  status text not null default 'lista' check (status in ('lista', 'sorteado', 'em_jogo', 'encerrado', 'cancelado')),
  lista_texto text,
  iniciado_em timestamptz,
  encerrado_em timestamptz
);

create table public.presencas (
  evento_id uuid references public.eventos on delete cascade,
  membro_id uuid references public.membros on delete cascade,
  status text not null default 'confirmado' check (status in ('confirmado', 'espera', 'saiu')),
  ordem smallint,
  primary key (evento_id, membro_id)
);

create table public.sorteios (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos on delete cascade,
  numero smallint not null,
  times jsonb not null,               -- [[membro_id, ...], ...]
  goleiros jsonb,
  oficial boolean not null default false,
  criado_por uuid references public.profiles,
  created_at timestamptz not null default now()
);

-- Partida: o cronômetro é calculado a partir destes campos (todo celular vê o mesmo tempo).
create table public.partidas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos on delete cascade,
  numero smallint not null,
  time_a smallint not null,
  time_b smallint not null,
  goleiro_a uuid references public.membros,
  goleiro_b uuid references public.membros,
  goleiro_a_linha boolean not null default false,
  goleiro_b_linha boolean not null default false,
  duracao_seg integer not null default 420,
  inicio_em timestamptz,
  pausado_em timestamptz,
  segundos_pausados integer not null default 0,
  status text not null default 'aguardando' check (status in ('aguardando', 'rolando', 'pausado', 'encerrada')),
  placar_a smallint not null default 0,
  placar_b smallint not null default 0
);

create table public.pausas (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references public.partidas on delete cascade,
  inicio timestamptz not null default now(),
  fim timestamptz,
  motivo text
);

create table public.lances (
  id uuid primary key default gen_random_uuid(),
  partida_id uuid not null references public.partidas on delete cascade,
  tipo text not null check (tipo in ('gol', 'gol_contra')),
  time smallint not null,
  autor_id uuid references public.membros,     -- null = gol sem autor (corrigir depois)
  assist_id uuid references public.membros,
  minuto smallint,
  criado_por uuid references public.profiles,
  criado_por_nome text,                        -- quem marcou pelo link ao vivo, sem login
  desfeito boolean not null default false,
  created_at timestamptz not null default now()
);

-- ===== Permissões (RLS) =====
alter table public.profiles enable row level security;
alter table public.peladas enable row level security;
alter table public.membros enable row level security;
alter table public.notas enable row level security;
alter table public.regras_sorteio enable row level security;
alter table public.eventos enable row level security;
alter table public.presencas enable row level security;
alter table public.sorteios enable row level security;
alter table public.partidas enable row level security;
alter table public.pausas enable row level security;
alter table public.lances enable row level security;

create or replace function public.eh_master() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_master from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.eh_admin(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.eh_master() or exists (
    select 1 from public.membros m where m.pelada_id = p and m.profile_id = auth.uid() and m.papel = 'admin'
  );
$$;

create policy "perfil: cada um vê e edita o seu" on public.profiles
  for all using (id = auth.uid() or public.eh_master()) with check (id = auth.uid() or public.eh_master());

-- Leitura pública (página pública e link ao vivo); escrita só admin.
create policy "peladas: leitura" on public.peladas for select using (true);
create policy "peladas: master cria e edita" on public.peladas for all using (public.eh_master()) with check (public.eh_master());

create policy "membros: leitura" on public.membros for select using (true);
create policy "membros: admin edita" on public.membros for all using (public.eh_admin(pelada_id)) with check (public.eh_admin(pelada_id));

create policy "notas: só admin" on public.notas for all
  using (public.eh_admin((select pelada_id from public.membros m where m.id = membro_id)))
  with check (public.eh_admin((select pelada_id from public.membros m where m.id = membro_id)));

create policy "regras: só admin" on public.regras_sorteio for all using (public.eh_admin(pelada_id)) with check (public.eh_admin(pelada_id));

create policy "eventos: leitura" on public.eventos for select using (true);
create policy "eventos: admin edita" on public.eventos for all using (public.eh_admin(pelada_id)) with check (public.eh_admin(pelada_id));

create policy "presencas: leitura" on public.presencas for select using (true);
create policy "presencas: admin edita" on public.presencas for all
  using (public.eh_admin((select pelada_id from public.eventos e where e.id = evento_id)))
  with check (public.eh_admin((select pelada_id from public.eventos e where e.id = evento_id)));

create policy "sorteios: leitura" on public.sorteios for select using (true);
create policy "sorteios: admin edita" on public.sorteios for all
  using (public.eh_admin((select pelada_id from public.eventos e where e.id = evento_id)))
  with check (public.eh_admin((select pelada_id from public.eventos e where e.id = evento_id)));

-- Partida e lances: leitura pública. Escrita de visitante com PIN passa por uma função no servidor (etapa 3).
create policy "partidas: leitura" on public.partidas for select using (true);
create policy "partidas: admin edita" on public.partidas for all
  using (public.eh_admin((select pelada_id from public.eventos e where e.id = evento_id)))
  with check (public.eh_admin((select pelada_id from public.eventos e where e.id = evento_id)));

create policy "pausas: leitura" on public.pausas for select using (true);
create policy "pausas: admin edita" on public.pausas for all
  using (public.eh_admin((select e.pelada_id from public.partidas p join public.eventos e on e.id = p.evento_id where p.id = partida_id)))
  with check (public.eh_admin((select e.pelada_id from public.partidas p join public.eventos e on e.id = p.evento_id where p.id = partida_id)));

create policy "lances: leitura" on public.lances for select using (true);
create policy "lances: admin edita" on public.lances for all
  using (public.eh_admin((select e.pelada_id from public.partidas p join public.eventos e on e.id = p.evento_id where p.id = partida_id)))
  with check (public.eh_admin((select e.pelada_id from public.partidas p join public.eventos e on e.id = p.evento_id where p.id = partida_id)));

-- Cria o perfil automaticamente quando alguém entra pela primeira vez.
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, foto_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$;

create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_usuario();

-- Tempo real do placar ao vivo
alter publication supabase_realtime add table public.partidas, public.lances;
