-- MA Sorteio de Times — banco completo (todas as etapas).
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.
-- Regra de ouro: notas/estrelas ficam na tabela `notas`, que só admin lê.

create extension if not exists pgcrypto;

-- =====================================================================
-- Tabelas
-- =====================================================================

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nome text not null default '',
  apelido text,
  foto_url text,
  email text,
  is_master boolean not null default false,
  perfil_completo boolean not null default false,
  cor_card text,
  created_at timestamptz not null default now()
);

create table public.peladas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  dia_semana smallint check (dia_semana between 0 and 6),   -- 0 = domingo
  horario time,
  horario_fim time,
  local text,
  logo_url text,
  cor_banner text not null default '#7444D6',
  regra_fim text not null default 'tempo' check (regra_fim in ('tempo', 'tempo_ou_gols', 'gols')),
  minutos smallint not null default 7,
  gols_limite smallint not null default 2,
  regra_empate text not null default 'sai_quem_ficou' check (regra_empate in ('sai_quem_ficou', 'sai_os_dois', 'penaltis')),
  lembrete_horas_antes smallint not null default 2,
  mensalidade numeric(8,2),
  criado_por uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

-- PIN do ao vivo fica separado: a tabela peladas é pública e o PIN não pode vazar.
create table public.pelada_pins (
  pelada_id uuid primary key references public.peladas on delete cascade,
  pin text not null default lpad((floor(random() * 10000))::int::text, 4, '0')
);

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
  created_at timestamptz not null default now(),
  unique (pelada_id, profile_id)
);
create index on public.membros (profile_id);

create table public.notas (
  membro_id uuid primary key references public.membros on delete cascade,
  nota_simples numeric(2,1) not null default 3 check (nota_simples between 0.5 and 5),
  atributos jsonb,            -- {folego, habilidade, nocao, joga_pro_time, fisico, defesa, finalizacao} 0–10
  usar_completa boolean not null default false,
  atualizado_por uuid references public.profiles on delete set null,
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
  horario text,
  status text not null default 'lista' check (status in ('lista', 'sorteado', 'em_jogo', 'encerrado', 'cancelado')),
  lista_texto text,
  iniciado_em timestamptz,
  encerrado_em timestamptz,
  created_at timestamptz not null default now()
);
create index on public.eventos (pelada_id, data desc);

create table public.presencas (
  evento_id uuid references public.eventos on delete cascade,
  membro_id uuid references public.membros on delete cascade,
  status text not null default 'confirmado' check (status in ('confirmado', 'espera', 'saiu')),
  goleiro boolean not null default false,
  ordem smallint,
  primary key (evento_id, membro_id)
);

create table public.sorteios (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos on delete cascade,
  numero smallint not null,
  times jsonb not null,               -- [[membro_id, ...], ...]
  goleiros jsonb,                     -- [membro_id | null, ...] um por time
  espera jsonb,
  oficial boolean not null default false,
  criado_por uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);

-- Cronômetro: calculado a partir destes campos com a hora do servidor (todo celular vê o mesmo tempo).
create table public.partidas (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos on delete cascade,
  numero smallint not null,
  time_a smallint not null,           -- índice do time no sorteio oficial (0 = Time 1)
  time_b smallint not null,
  goleiro_a uuid references public.membros on delete set null,
  goleiro_b uuid references public.membros on delete set null,
  goleiro_a_linha boolean not null default false,
  goleiro_b_linha boolean not null default false,
  duracao_seg integer not null default 420,
  inicio_em timestamptz,
  pausado_em timestamptz,
  segundos_pausados integer not null default 0,
  encerrada_em timestamptz,
  status text not null default 'aguardando' check (status in ('aguardando', 'rolando', 'pausado', 'encerrada')),
  placar_a smallint not null default 0,
  placar_b smallint not null default 0,
  vencedor smallint,                  -- índice do time, null = empate
  created_at timestamptz not null default now()
);
create index on public.partidas (evento_id, numero);

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
  time smallint not null,                       -- time que ganhou o ponto
  autor_id uuid references public.membros on delete set null,   -- null = sem autor (corrigir depois)
  assist_id uuid references public.membros on delete set null,
  minuto smallint,
  criado_por uuid references public.profiles on delete set null,
  criado_por_nome text,
  desfeito boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.lances (partida_id);

create table public.votacoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos on delete cascade,
  categoria text not null check (categoria in ('craque', 'bagre', 'goleiro')),
  abre timestamptz not null default now(),
  fecha timestamptz not null default now() + interval '24 hours',
  unique (evento_id, categoria)
);

create table public.votos (
  votacao_id uuid not null references public.votacoes on delete cascade,
  eleitor_id uuid not null references public.profiles on delete cascade,
  votado_id uuid not null references public.membros on delete cascade,
  created_at timestamptz not null default now(),
  primary key (votacao_id, eleitor_id)
);

create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos on delete cascade,
  profile_id uuid references public.profiles on delete set null,
  equilibrio text check (equilibrio in ('sim', 'mais_ou_menos', 'nao')),
  mais_forte smallint,
  motivo text,
  sugestoes jsonb,               -- [{membro_id, direcao: 'alta' | 'baixa'}]
  nota_pelada smallint check (nota_pelada between 1 and 5),
  texto text,
  created_at timestamptz not null default now()
);

create table public.pagamentos (
  pelada_id uuid not null references public.peladas on delete cascade,
  membro_id uuid not null references public.membros on delete cascade,
  mes date not null,             -- sempre dia 1
  pago boolean not null default false,
  primary key (membro_id, mes)
);

create table public.medalhas (
  id uuid primary key default gen_random_uuid(),
  membro_id uuid not null references public.membros on delete cascade,
  tipo text not null,            -- artilheiro, garcom, muralha, craque, bagre, mais_vitorioso, destaque_semana, jogador_mes
  periodo text not null,         -- '2026-11-23' (dia), '2026-W48' (semana), '2026-11' (mês)
  valor numeric,
  created_at timestamptz not null default now(),
  unique (membro_id, tipo, periodo)
);

create table public.fotos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos on delete cascade,
  autor_id uuid references public.profiles on delete set null,
  url text not null,
  legenda text,
  created_at timestamptz not null default now()
);

create table public.push_subs (
  endpoint text primary key,
  profile_id uuid not null references public.profiles on delete cascade,
  keys jsonb not null,
  created_at timestamptz not null default now()
);

create table public.pin_tentativas (
  pelada_id uuid not null references public.peladas on delete cascade,
  em timestamptz not null default now()
);

-- =====================================================================
-- Funções de permissão
-- =====================================================================

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

create or replace function public.eh_membro(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.eh_master() or exists (
    select 1 from public.membros m where m.pelada_id = p and m.profile_id = auth.uid()
  );
$$;

create or replace function public.pelada_do_evento(e uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select pelada_id from public.eventos where id = e;
$$;

create or replace function public.pelada_da_partida(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select e.pelada_id from public.partidas pa join public.eventos e on e.id = pa.evento_id where pa.id = p;
$$;

create or replace function public.hora_servidor() returns timestamptz
language sql stable as $$ select now(); $$;

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.peladas enable row level security;
alter table public.pelada_pins enable row level security;
alter table public.membros enable row level security;
alter table public.notas enable row level security;
alter table public.regras_sorteio enable row level security;
alter table public.eventos enable row level security;
alter table public.presencas enable row level security;
alter table public.sorteios enable row level security;
alter table public.partidas enable row level security;
alter table public.pausas enable row level security;
alter table public.lances enable row level security;
alter table public.votacoes enable row level security;
alter table public.votos enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.pagamentos enable row level security;
alter table public.medalhas enable row level security;
alter table public.fotos enable row level security;
alter table public.push_subs enable row level security;
alter table public.pin_tentativas enable row level security;

create policy "perfil: o seu ou master" on public.profiles for select using (id = auth.uid() or public.eh_master());
create policy "perfil: edita o seu" on public.profiles for update using (id = auth.uid() or public.eh_master())
  with check (id = auth.uid() or public.eh_master());
-- Ninguém se promove a master sozinho.
create or replace function public.trava_master() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_master is distinct from old.is_master and not public.eh_master() and auth.uid() is not null then
    new.is_master := old.is_master;
  end if;
  return new;
end;
$$;
create trigger trava_master before update on public.profiles for each row execute function public.trava_master();

-- Dados públicos do perfil (sem e-mail), pra mostrar nome e foto.
create view public.perfis_publicos as select id, nome, apelido, foto_url, cor_card from public.profiles;
grant select on public.perfis_publicos to anon, authenticated;

create policy "peladas: leitura" on public.peladas for select using (true);
create policy "peladas: master cria" on public.peladas for insert with check (public.eh_master());
create policy "peladas: admin edita" on public.peladas for update using (public.eh_admin(id)) with check (public.eh_admin(id));
create policy "peladas: master apaga" on public.peladas for delete using (public.eh_master());

create policy "pin: só admin" on public.pelada_pins for all using (public.eh_admin(pelada_id)) with check (public.eh_admin(pelada_id));

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
  using (public.eh_admin(public.pelada_do_evento(evento_id))) with check (public.eh_admin(public.pelada_do_evento(evento_id)));

create policy "sorteios: leitura" on public.sorteios for select using (true);
create policy "sorteios: admin edita" on public.sorteios for all
  using (public.eh_admin(public.pelada_do_evento(evento_id))) with check (public.eh_admin(public.pelada_do_evento(evento_id)));

-- Partida, pausas e lances: leitura pública. Escrita só pela função acao_partida (admin ou PIN).
create policy "partidas: leitura" on public.partidas for select using (true);
create policy "partidas: admin corrige" on public.partidas for all
  using (public.eh_admin(public.pelada_do_evento(evento_id))) with check (public.eh_admin(public.pelada_do_evento(evento_id)));
create policy "pausas: leitura" on public.pausas for select using (true);
create policy "lances: leitura" on public.lances for select using (true);
create policy "lances: admin corrige" on public.lances for all
  using (public.eh_admin(public.pelada_da_partida(partida_id))) with check (public.eh_admin(public.pelada_da_partida(partida_id)));

create policy "votacoes: leitura" on public.votacoes for select using (true);
create policy "votacoes: admin edita" on public.votacoes for all
  using (public.eh_admin(public.pelada_do_evento(evento_id))) with check (public.eh_admin(public.pelada_do_evento(evento_id)));

-- Voto: cada um vê o seu; admin vê todos. Contagem pública pela função contagem_votos.
create policy "votos: o seu ou admin" on public.votos for select using (
  eleitor_id = auth.uid() or public.eh_admin((select public.pelada_do_evento(v.evento_id) from public.votacoes v where v.id = votacao_id)));
create policy "votos: votar" on public.votos for insert with check (
  eleitor_id = auth.uid() and exists (select 1 from public.votacoes v where v.id = votacao_id and now() between v.abre and v.fecha));
create policy "votos: trocar voto" on public.votos for update using (eleitor_id = auth.uid()) with check (
  eleitor_id = auth.uid() and exists (select 1 from public.votacoes v where v.id = votacao_id and now() between v.abre and v.fecha));

create policy "avaliacoes: qualquer um envia" on public.avaliacoes for insert with check (profile_id is null or profile_id = auth.uid());
create policy "avaliacoes: só admin lê" on public.avaliacoes for select using (public.eh_admin(public.pelada_do_evento(evento_id)));

create policy "pagamentos: membro lê" on public.pagamentos for select using (public.eh_membro(pelada_id));
create policy "pagamentos: admin edita" on public.pagamentos for all using (public.eh_admin(pelada_id)) with check (public.eh_admin(pelada_id));

create policy "medalhas: leitura" on public.medalhas for select using (true);
create policy "medalhas: admin edita" on public.medalhas for all
  using (public.eh_admin((select pelada_id from public.membros m where m.id = membro_id)))
  with check (public.eh_admin((select pelada_id from public.membros m where m.id = membro_id)));

create policy "fotos: leitura" on public.fotos for select using (true);
create policy "fotos: membro envia" on public.fotos for insert with check (
  autor_id = auth.uid() and public.eh_membro(public.pelada_do_evento(evento_id)));
create policy "fotos: autor ou admin apaga" on public.fotos for delete using (
  autor_id = auth.uid() or public.eh_admin(public.pelada_do_evento(evento_id)));

create policy "push: o seu" on public.push_subs for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
-- pin_tentativas: sem policy = ninguém lê direto (só as funções).

-- =====================================================================
-- Perfil automático no primeiro login
-- =====================================================================

create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, foto_url, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url',
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_usuario();

-- PIN novo pra cada pelada criada.
create or replace function public.nova_pelada() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.pelada_pins (pelada_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger ao_criar_pelada after insert on public.peladas
  for each row execute function public.nova_pelada();

-- =====================================================================
-- Funções usadas pelo app
-- =====================================================================

-- Admin procura alguém que já entrou no app (pra ligar ao elenco ou promover).
create or replace function public.buscar_perfil(p_email text)
returns table (id uuid, nome text, apelido text, foto_url text, email text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.apelido, p.foto_url, p.email from public.profiles p
  where (public.eh_master() or exists (select 1 from public.membros m where m.profile_id = auth.uid() and m.papel = 'admin'))
    and lower(p.email) = lower(trim(p_email));
$$;

-- Contagem de votos (pública, sem mostrar quem votou).
create or replace function public.contagem_votos(p_evento uuid)
returns table (categoria text, votado_id uuid, votos bigint)
language sql stable security definer set search_path = public as $$
  select v.categoria, vo.votado_id, count(*) from public.votacoes v
  join public.votos vo on vo.votacao_id = v.id
  where v.evento_id = p_evento
  group by v.categoria, vo.votado_id;
$$;

-- Duplas que mais caem juntas (só master).
create or replace function public.duplas_juntas(p_pelada uuid)
returns table (a uuid, b uuid, vezes bigint)
language sql stable security definer set search_path = public as $$
  with t as (
    select s.id, ti.ordinality as time_idx, jsonb_array_elements_text(ti.value)::uuid as membro
    from public.sorteios s
    join public.eventos e on e.id = s.evento_id
    cross join lateral jsonb_array_elements(s.times) with ordinality ti
    where e.pelada_id = p_pelada and s.oficial and public.eh_master()
  )
  select x.membro, y.membro, count(*) from t x join t y on x.id = y.id and x.time_idx = y.time_idx and x.membro < y.membro
  group by 1, 2 order by 3 desc limit 30;
$$;

-- Confere o PIN do dia (com limite de 10 erros a cada 10 min por pelada).
create or replace function public.conferir_pin(p_pelada uuid, p_pin text) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if (select count(*) from public.pin_tentativas where pelada_id = p_pelada and em > now() - interval '10 minutes') >= 10 then
    raise exception 'Muitas tentativas. Espera uns minutos e tenta de novo.';
  end if;
  select exists (select 1 from public.pelada_pins where pelada_id = p_pelada and pin = trim(p_pin)) into ok;
  if not ok then
    insert into public.pin_tentativas (pelada_id) values (p_pelada);
  end if;
  return ok;
end;
$$;

-- Recalcula o placar a partir dos lances que valem.
create or replace function public.recalcular_placar(p uuid) returns void
language sql security definer set search_path = public as $$
  update public.partidas pa set
    placar_a = (select count(*) from public.lances l where l.partida_id = pa.id and not l.desfeito and l.time = pa.time_a),
    placar_b = (select count(*) from public.lances l where l.partida_id = pa.id and not l.desfeito and l.time = pa.time_b)
  where pa.id = p;
$$;

-- Toda mexida na partida passa aqui: admin logado ou visitante com PIN.
-- Usa a hora do servidor, então todo mundo vê o mesmo cronômetro.
create or replace function public.acao_partida(
  p_partida uuid,
  p_acao text,
  p_dados jsonb default '{}'::jsonb,
  p_pin text default null,
  p_nome text default null
) returns public.partidas
language plpgsql security definer set search_path = public as $$
declare
  pa public.partidas;
  v_pelada uuid;
  v_decorrido numeric;
  v_minuto int;
  v_time smallint;
  v_lance uuid;
  v_quem text;
begin
  select * into pa from public.partidas where id = p_partida for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  v_pelada := public.pelada_do_evento(pa.evento_id);

  if not public.eh_admin(v_pelada) then
    if p_pin is null or not public.conferir_pin(v_pelada, p_pin) then
      raise exception 'PIN errado';
    end if;
  end if;
  v_quem := coalesce(nullif(trim(p_nome), ''), (select coalesce(nullif(apelido, ''), nome) from public.profiles where id = auth.uid()));

  v_decorrido := case
    when pa.inicio_em is null then 0
    else extract(epoch from (coalesce(pa.pausado_em, pa.encerrada_em, now()) - pa.inicio_em)) - pa.segundos_pausados
  end;
  v_minuto := greatest(1, ceil(v_decorrido / 60.0)::int);

  if p_acao = 'iniciar' then
    if pa.status = 'aguardando' then
      update public.partidas set inicio_em = now(), status = 'rolando', pausado_em = null where id = pa.id;
      update public.eventos set status = 'em_jogo', iniciado_em = coalesce(iniciado_em, now()) where id = pa.evento_id;
    elsif pa.status = 'pausado' then
      update public.partidas set
        segundos_pausados = segundos_pausados + extract(epoch from (now() - pausado_em))::int,
        pausado_em = null, status = 'rolando'
      where id = pa.id;
      update public.pausas set fim = now() where partida_id = pa.id and fim is null;
    end if;

  elsif p_acao = 'pausar' then
    if pa.status = 'rolando' then
      update public.partidas set pausado_em = now(), status = 'pausado' where id = pa.id;
      insert into public.pausas (partida_id, motivo) values (pa.id, nullif(p_dados->>'motivo', ''));
    end if;

  elsif p_acao = 'motivo_pausa' then
    update public.pausas set motivo = nullif(p_dados->>'motivo', '') where partida_id = pa.id and fim is null;

  elsif p_acao = 'mais_minuto' then
    update public.partidas set duracao_seg = duracao_seg + coalesce((p_dados->>'segundos')::int, 60) where id = pa.id;

  elsif p_acao = 'zerar' then
    update public.partidas set inicio_em = null, pausado_em = null, segundos_pausados = 0,
      status = 'aguardando', encerrada_em = null where id = pa.id;
    delete from public.pausas where partida_id = pa.id;

  elsif p_acao = 'gol' or p_acao = 'gol_contra' then
    v_time := (p_dados->>'time')::smallint;
    if v_time is distinct from pa.time_a and v_time is distinct from pa.time_b then
      raise exception 'Esse time não está em campo';
    end if;
    insert into public.lances (partida_id, tipo, time, autor_id, assist_id, minuto, criado_por, criado_por_nome)
    values (pa.id, p_acao, v_time, nullif(p_dados->>'autor', '')::uuid,
            case when p_acao = 'gol' then nullif(p_dados->>'assist', '')::uuid end,
            v_minuto, auth.uid(), v_quem);
    perform public.recalcular_placar(pa.id);

  elsif p_acao = 'assistencia' then
    update public.lances set assist_id = nullif(p_dados->>'assist', '')::uuid
    where id = (p_dados->>'lance')::uuid and partida_id = pa.id;

  elsif p_acao = 'menos' then
    v_time := (p_dados->>'time')::smallint;
    select id into v_lance from public.lances where partida_id = pa.id and time = v_time and not desfeito
      order by created_at desc limit 1;
    if v_lance is not null then
      update public.lances set desfeito = true where id = v_lance;
      perform public.recalcular_placar(pa.id);
    end if;

  elsif p_acao = 'desfazer' then
    select id into v_lance from public.lances where partida_id = pa.id and not desfeito order by created_at desc limit 1;
    if v_lance is not null then
      update public.lances set desfeito = true where id = v_lance;
      perform public.recalcular_placar(pa.id);
    end if;

  elsif p_acao = 'goleiros' then
    update public.partidas set
      goleiro_a = case when p_dados ? 'goleiro_a' then nullif(p_dados->>'goleiro_a', '')::uuid else goleiro_a end,
      goleiro_b = case when p_dados ? 'goleiro_b' then nullif(p_dados->>'goleiro_b', '')::uuid else goleiro_b end,
      goleiro_a_linha = coalesce((p_dados->>'goleiro_a_linha')::boolean, goleiro_a_linha),
      goleiro_b_linha = coalesce((p_dados->>'goleiro_b_linha')::boolean, goleiro_b_linha)
    where id = pa.id;

  elsif p_acao = 'times' then
    update public.partidas set time_a = (p_dados->>'time_a')::smallint, time_b = (p_dados->>'time_b')::smallint
    where id = pa.id;
    perform public.recalcular_placar(pa.id);

  elsif p_acao = 'encerrar' then
    if pa.status <> 'encerrada' then
      update public.partidas set
        segundos_pausados = segundos_pausados + case when pausado_em is not null then extract(epoch from (now() - pausado_em))::int else 0 end,
        pausado_em = null,
        encerrada_em = now(),
        inicio_em = coalesce(inicio_em, now()),
        status = 'encerrada',
        vencedor = case when placar_a > placar_b then time_a when placar_b > placar_a then time_b else null end
      where id = pa.id;
      update public.pausas set fim = now() where partida_id = pa.id and fim is null;
    end if;

  elsif p_acao = 'vencedor' then
    -- empate decidido nos pênaltis
    update public.partidas set vencedor = nullif(p_dados->>'vencedor', '')::smallint where id = pa.id;

  else
    raise exception 'Ação desconhecida: %', p_acao;
  end if;

  select * into pa from public.partidas where id = p_partida;
  return pa;
end;
$$;

-- Cria a próxima partida do dia (admin ou PIN).
create or replace function public.nova_partida(
  p_evento uuid, p_time_a smallint, p_time_b smallint,
  p_goleiro_a uuid default null, p_goleiro_b uuid default null,
  p_pin text default null
) returns public.partidas
language plpgsql security definer set search_path = public as $$
declare
  v_pelada uuid := public.pelada_do_evento(p_evento);
  v_dur int;
  pa public.partidas;
begin
  if not public.eh_admin(v_pelada) then
    if p_pin is null or not public.conferir_pin(v_pelada, p_pin) then raise exception 'PIN errado'; end if;
  end if;
  if exists (select 1 from public.partidas where evento_id = p_evento and status <> 'encerrada') then
    raise exception 'Já tem uma partida em andamento';
  end if;
  select minutos * 60 into v_dur from public.peladas where id = v_pelada;
  insert into public.partidas (evento_id, numero, time_a, time_b, goleiro_a, goleiro_b, duracao_seg)
  values (p_evento, coalesce((select max(numero) from public.partidas where evento_id = p_evento), 0) + 1,
          p_time_a, p_time_b, p_goleiro_a, p_goleiro_b, coalesce(v_dur, 420))
  returning * into pa;
  return pa;
end;
$$;

grant execute on function public.acao_partida(uuid, text, jsonb, text, text) to anon, authenticated;
grant execute on function public.nova_partida(uuid, smallint, smallint, uuid, uuid, text) to anon, authenticated;
grant execute on function public.hora_servidor() to anon, authenticated;
grant execute on function public.contagem_votos(uuid) to anon, authenticated;
revoke execute on function public.conferir_pin(uuid, text) from anon, authenticated, public;
revoke execute on function public.recalcular_placar(uuid) from anon, authenticated, public;

-- =====================================================================
-- Tempo real e arquivos
-- =====================================================================

alter publication supabase_realtime add table public.partidas, public.lances, public.eventos, public.sorteios, public.pausas;

insert into storage.buckets (id, name, public) values ('imagens', 'imagens', true) on conflict (id) do nothing;

create policy "imagens: leitura" on storage.objects for select using (bucket_id = 'imagens');
create policy "imagens: logado envia na sua pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'imagens' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "imagens: dono troca" on storage.objects for update to authenticated
  using (bucket_id = 'imagens' and owner = auth.uid());
create policy "imagens: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'imagens' and owner = auth.uid());
