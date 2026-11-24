-- MA Sorteio de Times — atualização 3
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.
-- (Pode rodar mesmo se ainda não rodou o 0002: rode o 0002 primeiro, depois este.)
-- 1) Quem é membro da pelada e está logado mexe no cronômetro/placar sem PIN
-- 2) Pix da mensalidade (chave, nome e cidade de quem recebe) e "já paguei" do jogador
-- 3) Data de aniversário do jogador (carta de aniversário)

alter table public.peladas add column if not exists pix_chave text;
alter table public.peladas add column if not exists pix_nome text;
alter table public.peladas add column if not exists pix_cidade text;
alter table public.pagamentos add column if not exists informado_em timestamptz;
alter table public.membros add column if not exists nascimento date;

-- Toda mexida na partida passa aqui: qualquer membro logado da pelada, ou visitante com o PIN do dia.
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

  if not public.eh_membro(v_pelada) then
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

-- Cria a próxima partida do dia (membro logado ou PIN).
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
  if not public.eh_membro(v_pelada) then
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


-- O próprio jogador avisa "já paguei" (o admin confere e marca como pago).
create or replace function public.informar_pagamento(p_membro uuid, p_mes date) returns void
language plpgsql security definer set search_path = public as $$
declare v_pelada uuid;
begin
  select pelada_id into v_pelada from public.membros where id = p_membro and profile_id = auth.uid();
  if v_pelada is null then raise exception 'Só dá pra avisar o seu próprio pagamento'; end if;
  insert into public.pagamentos (pelada_id, membro_id, mes, pago, informado_em)
  values (v_pelada, p_membro, date_trunc('month', p_mes)::date, false, now())
  on conflict (membro_id, mes) do update set informado_em = now();
end;
$$;
grant execute on function public.informar_pagamento(uuid, date) to authenticated;
