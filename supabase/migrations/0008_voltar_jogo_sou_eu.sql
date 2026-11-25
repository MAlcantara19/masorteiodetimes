-- 0008: voltar um jogo encerrado sem querer, "sou eu" na lista e juntar duas fichas do mesmo jogador.
-- Pode rodar mais de uma vez sem problema.

-- 1) Voltar o jogo: encerrou sem querer (ou alguém se machucou). Volta pausado, contando o tempo desde o
--    "encerrar" como parado. Se o próximo jogo já foi chamado e ainda não começou, ele some.
create or replace function public.reabrir_partida(p_partida uuid, p_pin text default null)
returns public.partidas
language plpgsql security definer set search_path = public as $$
declare
  pa public.partidas;
  v_pelada uuid;
begin
  select * into pa from public.partidas where id = p_partida for update;
  if not found then raise exception 'Partida não encontrada'; end if;
  v_pelada := public.pelada_do_evento(pa.evento_id);
  if not public.eh_membro(v_pelada) then
    if p_pin is null or not public.conferir_pin(v_pelada, p_pin) then raise exception 'PIN errado'; end if;
  end if;
  if pa.status <> 'encerrada' then return pa; end if;
  if exists (select 1 from public.partidas where evento_id = pa.evento_id and numero > pa.numero and inicio_em is not null) then
    raise exception 'O próximo jogo já começou';
  end if;
  delete from public.partidas where evento_id = pa.evento_id and numero > pa.numero and inicio_em is null;
  update public.partidas set status = 'pausado', pausado_em = coalesce(encerrada_em, now()), encerrada_em = null, vencedor = null
  where id = pa.id;
  insert into public.pausas (partida_id, inicio, motivo) values (pa.id, coalesce(pa.encerrada_em, now()), 'Voltou o jogo');
  update public.eventos set status = 'em_jogo' where id = pa.evento_id and status = 'encerrado';
  select * into pa from public.partidas where id = p_partida;
  return pa;
end;
$$;
grant execute on function public.reabrir_partida(uuid, text) to anon, authenticated;

-- 2) "Sou eu": quem entrou com o Google escolhe o próprio nome no elenco (só nomes sem conta).
--    O admin vê no elenco quem se ligou e pode desligar se alguém escolheu o nome errado.
create or replace function public.sou_eu(p_pelada uuid, p_membro uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'entre_primeiro'; end if;
  if exists (select 1 from public.membros where pelada_id = p_pelada and profile_id = auth.uid()) then raise exception 'ja_ligado'; end if;
  update public.membros set profile_id = auth.uid()
  where id = p_membro and pelada_id = p_pelada and profile_id is null and ativo
    and not (convidado and nome ~ '^RESERVA( [0-9]+)?$');
  if not found then raise exception 'nome_ocupado'; end if;
end;
$$;
grant execute on function public.sou_eu(uuid, uuid) to authenticated;

-- 3) Juntar fichas (só admin): a conta que entrou como nova vira a do jogador antigo (com nota e histórico).
--    Tudo da ficha nova (presença, gols, votos, pagamentos, sorteios) passa pra antiga e a nova some.
create or replace function public.juntar_membros(p_manter uuid, p_juntar uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  m public.membros;
  j public.membros;
begin
  select * into m from public.membros where id = p_manter;
  select * into j from public.membros where id = p_juntar;
  if m.id is null or j.id is null or m.pelada_id <> j.pelada_id or m.id = j.id then raise exception 'fichas_invalidas'; end if;
  if not public.eh_admin(m.pelada_id) then raise exception 'so_admin'; end if;
  if m.profile_id is not null and j.profile_id is not null then raise exception 'as_duas_tem_conta'; end if;

  -- A conta (se houver) fica na ficha antiga.
  if j.profile_id is not null then
    update public.membros set profile_id = null where id = j.id;
    update public.membros set profile_id = j.profile_id where id = m.id;
  end if;
  if m.papel = 'jogador' and j.papel = 'admin' then update public.membros set papel = 'admin' where id = m.id; end if;

  delete from public.presencas p where p.membro_id = j.id and exists (select 1 from public.presencas x where x.evento_id = p.evento_id and x.membro_id = m.id);
  update public.presencas set membro_id = m.id where membro_id = j.id;
  update public.presencas set convidado_por = m.id where convidado_por = j.id;
  update public.lances set autor_id = m.id where autor_id = j.id;
  update public.lances set assist_id = m.id where assist_id = j.id;
  update public.partidas set goleiro_a = m.id where goleiro_a = j.id;
  update public.partidas set goleiro_b = m.id where goleiro_b = j.id;
  update public.votos set votado_id = m.id where votado_id = j.id;
  update public.votos_partida set votado_id = m.id where votado_id = j.id;
  delete from public.pagamentos p where p.membro_id = j.id and exists (select 1 from public.pagamentos x where x.membro_id = m.id and x.mes = p.mes);
  update public.pagamentos set membro_id = m.id where membro_id = j.id;
  delete from public.medalhas d where d.membro_id = j.id and exists (select 1 from public.medalhas x where x.membro_id = m.id and x.tipo = d.tipo and x.periodo = d.periodo);
  update public.medalhas set membro_id = m.id where membro_id = j.id;
  update public.regras_sorteio set membros = array_replace(membros, j.id, m.id) where pelada_id = m.pelada_id and j.id = any(membros);
  update public.sorteios s set
    times = replace(s.times::text, j.id::text, m.id::text)::jsonb,
    goleiros = case when s.goleiros is null then null else replace(s.goleiros::text, j.id::text, m.id::text)::jsonb end,
    espera = case when s.espera is null then null else replace(s.espera::text, j.id::text, m.id::text)::jsonb end
  where s.evento_id in (select id from public.eventos where pelada_id = m.pelada_id)
    and (s.times::text like '%' || j.id::text || '%' or coalesce(s.goleiros::text, '') like '%' || j.id::text || '%' or coalesce(s.espera::text, '') like '%' || j.id::text || '%');
  update public.avaliacoes a set sugestoes = replace(a.sugestoes::text, j.id::text, m.id::text)::jsonb
  where a.sugestoes is not null and a.sugestoes::text like '%' || j.id::text || '%';
  delete from public.membros_email where membro_id = j.id;
  delete from public.membros where id = j.id;
end;
$$;
grant execute on function public.juntar_membros(uuid, uuid) to authenticated;

-- 4) O admin desliga a conta de um nome (quem escolheu o nome errado no "sou eu").
create or replace function public.desligar_conta(p_membro uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.eh_admin((select pelada_id from public.membros where id = p_membro)) then raise exception 'so_admin'; end if;
  update public.membros set profile_id = null where id = p_membro and papel = 'jogador';
end;
$$;
grant execute on function public.desligar_conta(uuid) to authenticated;
