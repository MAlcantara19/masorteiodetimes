-- 0010: sorteador oficial e modo dia de jogo, aviso de vaga (quem sobe da espera),
-- e qualquer pessoa cria a própria pelada (15 dias de teste do Completo, depois o Grátis).
-- Pode rodar mais de uma vez sem problema.

-- 1) Sorteador oficial e modo dia de jogo
alter table public.membros add column if not exists sorteador boolean not null default false;
alter table public.peladas add column if not exists modo_dia_jogo boolean not null default false;

-- 2) Quem criou a pelada já fica em peladas.criado_por (o master vê as peladas novas e oferece o Completo).

-- 3) Tirar o nome da lista agora devolve quem subiu da espera (pra avisar a pessoa)
drop function if exists public.lista_sair(uuid, uuid);
create or replace function public.lista_sair(p_evento uuid, p_membro uuid default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ev public.eventos;
  v_me uuid;
  v_alvo uuid;
  v_antes text;
  v_gk boolean;
  v_subiu uuid;
begin
  if auth.uid() is null then raise exception 'entre_primeiro'; end if;
  select * into v_ev from public.eventos where id = p_evento;
  if v_ev.id is null or v_ev.status <> 'lista' then raise exception 'lista_fechada'; end if;
  select id into v_me from public.membros where pelada_id = v_ev.pelada_id and profile_id = auth.uid();
  v_alvo := coalesce(p_membro, v_me);
  if v_alvo is null then raise exception 'sem_vinculo'; end if;
  if not (v_alvo = v_me
          or exists (select 1 from public.presencas where evento_id = p_evento and membro_id = v_alvo and convidado_por = v_me)
          or public.eh_admin(v_ev.pelada_id)) then
    raise exception 'sem_permissao';
  end if;
  select status, goleiro into v_antes, v_gk from public.presencas where evento_id = p_evento and membro_id = v_alvo;
  update public.presencas set status = 'saiu' where evento_id = p_evento and membro_id = v_alvo;
  if v_antes = 'confirmado' then
    select p.membro_id into v_subiu from public.presencas p
    where p.evento_id = p_evento and p.status = 'espera' and p.ordem < 1000 and p.goleiro = v_gk
    order by p.ordem limit 1;
    if v_subiu is not null then
      update public.presencas set status = 'confirmado' where evento_id = p_evento and membro_id = v_subiu;
    end if;
  end if;
  return v_subiu;
end;
$$;
grant execute on function public.lista_sair(uuid, uuid) to authenticated;

-- 4) As travas de plano deixam o próprio sistema criar a pelada com o teste de 15 dias
create or replace function public.plano_inicial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('masorteio.sistema', true), '') = '1' then return new; end if;
  if auth.uid() is not null and not public.eh_master() then
    new.plano := 'gratis';
    new.recursos := '{}'::jsonb;
  end if;
  return new;
end $$;

create or replace function public.proteger_plano() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('masorteio.sistema', true), '') = '1' then return new; end if;
  if (new.plano is distinct from old.plano
      or new.recursos is distinct from old.recursos
      or new.plano_ate is distinct from old.plano_ate)
     and auth.uid() is not null and not public.eh_master() then
    raise exception 'Só o master muda o plano da pelada';
  end if;
  return new;
end $$;

-- 5) Criar a própria pelada: quem cria vira admin; começa com 15 dias do Completo (teste).
--    Cada pessoa cria uma pelada sozinha (o master cria quantas quiser).
create or replace function public.criar_minha_pelada(p_nome text, p_slug text, p_dia smallint, p_horario time, p_local text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_nome text;
  v_slug text := lower(btrim(p_slug));
begin
  if auth.uid() is null then raise exception 'entre_primeiro'; end if;
  if length(btrim(coalesce(p_nome, ''))) < 3 then raise exception 'nome_curto'; end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{2,39}$' then raise exception 'endereco_invalido'; end if;
  if exists (select 1 from public.peladas where slug = v_slug) then raise exception 'endereco_em_uso'; end if;
  if not public.eh_master() and exists (select 1 from public.peladas where criado_por = auth.uid()) then raise exception 'ja_tem_pelada'; end if;

  perform set_config('masorteio.sistema', '1', true);
  insert into public.peladas (nome, slug, dia_semana, horario, local, plano, plano_ate, criado_por)
  values (btrim(p_nome), v_slug, p_dia, p_horario, nullif(btrim(coalesce(p_local, '')), ''), 'completo', current_date + 15, auth.uid())
  returning id into v_id;
  perform set_config('masorteio.sistema', '', true);

  select coalesce(nullif(btrim(apelido), ''), nullif(btrim(nome), ''), 'Admin') into v_nome from public.profiles where id = auth.uid();
  insert into public.membros (pelada_id, profile_id, nome, papel, sorteador) values (v_id, auth.uid(), coalesce(v_nome, 'Admin'), 'admin', true);
  return v_slug;
end;
$$;
grant execute on function public.criar_minha_pelada(text, text, smallint, time, text) to authenticated;

-- 6) Segurança: a conta só liga sozinha pelo e-mail se o e-mail estiver confirmado
--    (conta do Google já vem confirmada; assim ninguém cria conta com o e-mail de outro pra pegar o nome dele).
create or replace function public.vincular_minha_conta() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_n integer := 0;
begin
  if auth.uid() is null then return 0; end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then return 0; end if;
  update public.membros m set profile_id = auth.uid()
  from public.membros_email e
  where e.membro_id = m.id
    and lower(e.email) = v_email
    and m.profile_id is null
    and not exists (select 1 from public.membros x where x.pelada_id = m.pelada_id and x.profile_id = auth.uid());
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
