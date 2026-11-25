-- 0005: mais modelos de camisa, número da camisa, craque da partida, caixa da pelada
-- e o modo sem internet (ações guardadas chegam com a hora certa).
-- Rodar no Supabase: SQL Editor → New query → colar tudo → Run. Pode rodar mais de uma vez.

-- 1) Modelos de camisa ------------------------------------------------------
alter table public.peladas drop constraint if exists peladas_camisa_estilo_check;
alter table public.peladas add constraint peladas_camisa_estilo_check check (camisa_estilo in (
  'lisa', 'listras', 'listras_finas', 'listras_horizontais', 'faixa', 'faixa_peito', 'faixa_baixa',
  'metade', 'quartos', 'centro', 'cruz', 'gola', 'mangas', 'ombros', 'lateral', 'polo'));

-- 2) Número da camisa (o jogador escolhe no perfil) -------------------------
alter table public.profiles add column if not exists numero_camisa smallint check (numero_camisa between 0 and 99);
create or replace view public.perfis_publicos as
  select id, nome, apelido, foto_url, cor_card, estilo_card, numero_camisa from public.profiles;
grant select on public.perfis_publicos to anon, authenticated;

-- 3) Craque da partida: voto rápido depois de cada jogo ---------------------
-- Vota quem está logado (1 voto por conta) ou visitante (1 voto por aparelho).
create table if not exists public.votos_partida (
  partida_id uuid not null references public.partidas on delete cascade,
  eleitor text not null,
  votado_id uuid not null references public.membros on delete cascade,
  created_at timestamptz not null default now(),
  primary key (partida_id, eleitor)
);
alter table public.votos_partida enable row level security;
-- Sem política de leitura direta: só pelas funções abaixo (ninguém vê em quem cada um votou).

create or replace function public.votar_craque_partida(p_partida uuid, p_votado uuid, p_aparelho text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  pa public.partidas;
  v_eleitor text := coalesce(auth.uid()::text, nullif(trim(p_aparelho), ''));
begin
  if v_eleitor is null then raise exception 'Não deu pra identificar o voto'; end if;
  select * into pa from public.partidas where id = p_partida;
  if not found then raise exception 'Jogo não encontrado'; end if;
  if pa.status <> 'encerrada' or pa.encerrada_em < now() - interval '3 hours' then
    raise exception 'A votação desse jogo já fechou';
  end if;
  if not exists (select 1 from public.membros where id = p_votado and pelada_id = public.pelada_do_evento(pa.evento_id)) then
    raise exception 'Jogador não é dessa pelada';
  end if;
  insert into public.votos_partida (partida_id, eleitor, votado_id) values (p_partida, v_eleitor, p_votado)
  on conflict (partida_id, eleitor) do update set votado_id = excluded.votado_id, created_at = now();
end $$;

create or replace function public.craques_partidas(p_evento uuid)
returns table (partida_id uuid, votado_id uuid, votos bigint)
language sql stable security definer set search_path = public as $$
  select v.partida_id, v.votado_id, count(*) from public.votos_partida v
  join public.partidas p on p.id = v.partida_id
  where p.evento_id = p_evento
  group by v.partida_id, v.votado_id;
$$;

-- Em quem eu votei (pra marcar na tela).
create or replace function public.meu_voto_partida(p_partida uuid, p_aparelho text default null)
returns uuid language sql stable security definer set search_path = public as $$
  select votado_id from public.votos_partida
  where partida_id = p_partida and eleitor = coalesce(auth.uid()::text, nullif(trim(p_aparelho), ''));
$$;

grant execute on function public.votar_craque_partida(uuid, uuid, text) to anon, authenticated;
grant execute on function public.craques_partidas(uuid) to anon, authenticated;
grant execute on function public.meu_voto_partida(uuid, text) to anon, authenticated;

-- 4) Caixa da pelada: entradas e saídas ------------------------------------
create table if not exists public.caixa (
  id uuid primary key default gen_random_uuid(),
  pelada_id uuid not null references public.peladas on delete cascade,
  data date not null default current_date,
  tipo text not null check (tipo in ('entrada', 'saida')),
  valor numeric(10,2) not null check (valor > 0),
  descricao text not null default '',
  categoria text,
  criado_por uuid references public.profiles on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists caixa_pelada_data on public.caixa (pelada_id, data desc);
alter table public.caixa enable row level security;
drop policy if exists "caixa: membro lê" on public.caixa;
create policy "caixa: membro lê" on public.caixa for select using (public.eh_membro(pelada_id) or public.eh_admin(pelada_id));
drop policy if exists "caixa: admin edita" on public.caixa;
create policy "caixa: admin edita" on public.caixa for all using (public.eh_admin(pelada_id)) with check (public.eh_admin(pelada_id));

-- 5) Modo sem internet -------------------------------------------------------
-- A ação guardada no celular leva a hora em que foi feita ("em"). O banco usa essa hora
-- (no máximo 6 horas atrás e nunca no futuro), então o cronômetro e os minutos dos gols ficam certos.
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
  v_agora timestamptz;
begin
  select * into pa from public.partidas where id = p_partida for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  v_pelada := public.pelada_do_evento(pa.evento_id);

  if not public.eh_membro(v_pelada) then
    if p_pin is null or not public.conferir_pin(v_pelada, p_pin) then
      raise exception 'PIN errado';
    end if;
  end if;
  v_quem := coalesce(nullif(trim(p_nome), ''), (select coalesce(nullif(apelido, ''), nome) from public.profiles where id = auth.uid()));

  begin
    v_agora := (p_dados->>'em')::timestamptz;
  exception when others then
    v_agora := null;
  end;
  v_agora := least(now(), greatest(now() - interval '6 hours', coalesce(v_agora, now())));

  v_decorrido := case
    when pa.inicio_em is null then 0
    else extract(epoch from (coalesce(pa.pausado_em, pa.encerrada_em, v_agora) - pa.inicio_em)) - pa.segundos_pausados
  end;
  v_minuto := greatest(1, ceil(v_decorrido / 60.0)::int);

  if p_acao = 'iniciar' then
    if pa.status = 'aguardando' then
      update public.partidas set inicio_em = v_agora, status = 'rolando', pausado_em = null where id = pa.id;
      update public.eventos set status = 'em_jogo', iniciado_em = coalesce(iniciado_em, v_agora) where id = pa.evento_id;
    elsif pa.status = 'pausado' then
      update public.partidas set
        segundos_pausados = segundos_pausados + greatest(0, extract(epoch from (v_agora - pausado_em))::int),
        pausado_em = null, status = 'rolando'
      where id = pa.id;
      update public.pausas set fim = v_agora where partida_id = pa.id and fim is null;
    end if;

  elsif p_acao = 'pausar' then
    if pa.status = 'rolando' then
      update public.partidas set pausado_em = v_agora, status = 'pausado' where id = pa.id;
      insert into public.pausas (partida_id, inicio, motivo) values (pa.id, v_agora, nullif(p_dados->>'motivo', ''));
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
    insert into public.lances (partida_id, tipo, time, autor_id, assist_id, minuto, criado_por, criado_por_nome, created_at)
    values (pa.id, p_acao, v_time, nullif(p_dados->>'autor', '')::uuid,
            case when p_acao = 'gol' then nullif(p_dados->>'assist', '')::uuid end,
            v_minuto, auth.uid(), v_quem, v_agora);
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
        segundos_pausados = segundos_pausados + case when pausado_em is not null then greatest(0, extract(epoch from (v_agora - pausado_em))::int) else 0 end,
        pausado_em = null,
        encerrada_em = v_agora,
        inicio_em = coalesce(inicio_em, v_agora),
        status = 'encerrada',
        vencedor = case when placar_a > placar_b then time_a when placar_b > placar_a then time_b else null end
      where id = pa.id;
      update public.pausas set fim = v_agora where partida_id = pa.id and fim is null;
    end if;

  elsif p_acao = 'vencedor' then
    update public.partidas set vencedor = nullif(p_dados->>'vencedor', '')::smallint where id = pa.id;

  else
    raise exception 'Ação desconhecida: %', p_acao;
  end if;

  select * into pa from public.partidas where id = p_partida;
  return pa;
end;
$$;
grant execute on function public.acao_partida(uuid, text, jsonb, text, text) to anon, authenticated;

-- Próxima partida: o celular pode mandar o id (criado sem internet). Se já existe, devolve a mesma.
drop function if exists public.nova_partida(uuid, smallint, smallint, uuid, uuid, text);
create or replace function public.nova_partida(
  p_evento uuid, p_time_a smallint, p_time_b smallint,
  p_goleiro_a uuid default null, p_goleiro_b uuid default null,
  p_pin text default null, p_id uuid default null
) returns public.partidas
language plpgsql security definer set search_path = public as $$
declare
  v_pelada uuid := public.pelada_do_evento(p_evento);
  v_dur int;
  pa public.partidas;
begin
  if not public.eh_membro(v_pelada) then
    if p_pin is null or not public.conferir_pin(v_pelada, p_pin) then raise exception 'PIN errado'; end if;
  end if;
  if p_id is not null then
    select * into pa from public.partidas where id = p_id;
    if found then return pa; end if;
  end if;
  if exists (select 1 from public.partidas where evento_id = p_evento and status <> 'encerrada') then
    raise exception 'Já tem uma partida em andamento';
  end if;
  select minutos * 60 into v_dur from public.peladas where id = v_pelada;
  insert into public.partidas (id, evento_id, numero, time_a, time_b, goleiro_a, goleiro_b, duracao_seg)
  values (coalesce(p_id, gen_random_uuid()), p_evento,
          coalesce((select max(numero) from public.partidas where evento_id = p_evento), 0) + 1,
          p_time_a, p_time_b, p_goleiro_a, p_goleiro_b, coalesce(v_dur, 420))
  returning * into pa;
  return pa;
end;
$$;
grant execute on function public.nova_partida(uuid, smallint, smallint, uuid, uuid, text, uuid) to anon, authenticated;
