-- 0007: lista da semana no app (no lugar da lista do Zap, se a pelada quiser).
-- Mensalistas já entram na lista; ela abre num dia/hora pra galera do grupo; convidado vai pra espera
-- (a galera do grupo tem prioridade). Cada um põe ou tira o próprio nome logado com o Google.
-- O admin liga o nome do jogador ao e-mail do Google dele (fica escondido, só admin vê).
-- Pode rodar mais de uma vez sem problema.

-- 1) Configuração da lista na pelada
alter table public.peladas add column if not exists lista_app boolean not null default false;
alter table public.peladas add column if not exists lista_vagas smallint not null default 15;
alter table public.peladas add column if not exists lista_espera smallint not null default 10;
alter table public.peladas add column if not exists lista_goleiros smallint not null default 3;
alter table public.peladas add column if not exists lista_abre_dia smallint;   -- 0 = domingo … 6 = sábado
alter table public.peladas add column if not exists lista_abre_hora time;

-- 2) Mensalista (entra direto na lista toda semana)
alter table public.membros add column if not exists mensalista boolean not null default false;

-- 3) Quando a lista do dia abre pra quem não é mensalista
alter table public.eventos add column if not exists lista_abre_em timestamptz;

-- 4) De onde veio cada nome da lista
alter table public.presencas add column if not exists origem text;           -- mensalista | grupo | convidado | admin
alter table public.presencas add column if not exists convidado_por uuid references public.membros on delete set null;
alter table public.presencas add column if not exists entrou_em timestamptz default now();

-- 5) E-mail do Google de cada jogador (pra ligar a conta sozinho no primeiro login). Só admin vê.
create table if not exists public.membros_email (
  membro_id uuid primary key references public.membros on delete cascade,
  email text not null
);
create index if not exists membros_email_email on public.membros_email (lower(email));
alter table public.membros_email enable row level security;
drop policy if exists "membros_email: só admin" on public.membros_email;
create policy "membros_email: só admin" on public.membros_email for all
  using (public.eh_admin((select pelada_id from public.membros m where m.id = membro_id)))
  with check (public.eh_admin((select pelada_id from public.membros m where m.id = membro_id)));

-- 6) Liga a conta de quem acabou de entrar aos nomes que o admin cadastrou com o e-mail dela.
create or replace function public.vincular_minha_conta() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_n integer := 0;
begin
  if auth.uid() is null then return 0; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
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

-- 7) Pôr o nome na lista.
--    p_modo: 'eu' (sou do grupo) | 'convidado' (estou levando alguém: p_nome) | 'sou_convidado' (não sou do grupo)
create or replace function public.lista_entrar(p_evento uuid, p_modo text, p_nome text default null, p_goleiro boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ev public.eventos;
  v_pel public.peladas;
  v_me public.membros;
  v_alvo uuid;
  v_goleiro boolean := coalesce(p_goleiro, false);
  v_origem text;
  v_status text;
  v_ordem integer;
  v_linha integer;
  v_gks integer;
  v_total integer;
  v_nome text;
begin
  if auth.uid() is null then raise exception 'entre_primeiro'; end if;
  select * into v_ev from public.eventos where id = p_evento;
  if v_ev.id is null or v_ev.status <> 'lista' then raise exception 'lista_fechada'; end if;
  select * into v_pel from public.peladas where id = v_ev.pelada_id;
  if not v_pel.lista_app then raise exception 'lista_fechada'; end if;
  select * into v_me from public.membros where pelada_id = v_pel.id and profile_id = auth.uid();

  if p_modo = 'eu' or (p_modo = 'sou_convidado' and v_me.id is not null) then
    if v_me.id is null then raise exception 'sem_vinculo'; end if;
    if v_ev.lista_abre_em is not null and now() < v_ev.lista_abre_em and not v_me.mensalista and not public.eh_admin(v_pel.id) then
      raise exception 'ainda_nao_abriu';
    end if;
    v_alvo := v_me.id;
    v_goleiro := v_goleiro or v_me.goleiro;
    v_origem := case when v_me.mensalista then 'mensalista' when v_me.convidado then 'convidado' else 'grupo' end;
  elsif p_modo = 'convidado' then
    if v_me.id is null then raise exception 'sem_vinculo'; end if;
    if v_ev.lista_abre_em is not null and now() < v_ev.lista_abre_em and not public.eh_admin(v_pel.id) then raise exception 'ainda_nao_abriu'; end if;
    v_nome := btrim(coalesce(p_nome, ''));
    if length(v_nome) < 2 then raise exception 'falta_nome'; end if;
    -- Reaproveita o convidado de mesmo nome (pra não encher o elenco de repetidos).
    select id into v_alvo from public.membros
      where pelada_id = v_pel.id and convidado and profile_id is null and lower(nome) = lower(v_nome) limit 1;
    if v_alvo is null then
      insert into public.membros (pelada_id, nome, convidado) values (v_pel.id, left(v_nome, 40), true) returning id into v_alvo;
    end if;
    v_origem := 'convidado';
  elsif p_modo = 'sou_convidado' then
    if v_ev.lista_abre_em is not null and now() < v_ev.lista_abre_em then raise exception 'ainda_nao_abriu'; end if;
    select coalesce(nullif(btrim(apelido), ''), nullif(btrim(nome), ''), 'Convidado') into v_nome from public.profiles where id = auth.uid();
    insert into public.membros (pelada_id, profile_id, nome, convidado) values (v_pel.id, auth.uid(), left(coalesce(v_nome, 'Convidado'), 40), true) returning id into v_alvo;
    v_origem := 'convidado';
  else
    raise exception 'modo_invalido';
  end if;

  -- Já está na lista? Não faz nada.
  if exists (select 1 from public.presencas where evento_id = p_evento and membro_id = v_alvo and status <> 'saiu') then
    return jsonb_build_object('ok', true, 'ja_estava', true);
  end if;

  select count(*) filter (where not goleiro and status <> 'saiu'),
         count(*) filter (where goleiro and status <> 'saiu'),
         count(*) filter (where status <> 'saiu')
    into v_linha, v_gks, v_total
    from public.presencas where evento_id = p_evento;
  if v_total >= v_pel.lista_vagas + v_pel.lista_goleiros + v_pel.lista_espera then raise exception 'lista_lotada'; end if;

  -- Ordem: o grupo na frente (por chegada), convidado sempre depois do grupo.
  if v_origem = 'convidado' then
    v_status := 'espera';
    select coalesce(max(ordem), 1000) + 1 into v_ordem from public.presencas where evento_id = p_evento and ordem >= 1000;
  else
    v_status := case when v_goleiro then (case when v_gks < v_pel.lista_goleiros then 'confirmado' else 'espera' end)
                     else (case when v_linha < v_pel.lista_vagas then 'confirmado' else 'espera' end) end;
    select coalesce(max(ordem), 0) + 1 into v_ordem from public.presencas where evento_id = p_evento and ordem < 900;
  end if;

  insert into public.presencas (evento_id, membro_id, status, goleiro, ordem, origem, convidado_por, entrou_em)
  values (p_evento, v_alvo, v_status, v_goleiro, least(v_ordem, 32000), v_origem, case when p_modo = 'convidado' then v_me.id else null end, now())
  on conflict (evento_id, membro_id) do update
    set status = excluded.status, goleiro = excluded.goleiro, ordem = excluded.ordem, origem = excluded.origem,
        convidado_por = excluded.convidado_por, entrou_em = excluded.entrou_em;
  return jsonb_build_object('ok', true, 'status', v_status);
end;
$$;

-- 8) Tirar o nome (o seu, o do seu convidado, ou qualquer um se for admin).
create or replace function public.lista_sair(p_evento uuid, p_membro uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ev public.eventos;
  v_me uuid;
  v_alvo uuid;
  v_antes text;
  v_gk boolean;
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
  -- Saiu alguém que estava dentro das vagas: o primeiro do grupo que estava na espera sobe.
  if v_antes = 'confirmado' then
    update public.presencas set status = 'confirmado'
    where evento_id = p_evento and membro_id = (
      select p.membro_id from public.presencas p
      where p.evento_id = p_evento and p.status = 'espera' and p.ordem < 1000 and p.goleiro = v_gk
      order by p.ordem limit 1
    );
  end if;
end;
$$;

grant execute on function public.vincular_minha_conta() to authenticated;
grant execute on function public.lista_entrar(uuid, text, text, boolean) to authenticated;
grant execute on function public.lista_sair(uuid, uuid) to authenticated;

-- 9) A lista atualiza sozinha na tela de todo mundo (tempo real).
do $$
begin
  alter publication supabase_realtime add table public.presencas;
exception when duplicate_object then null;
end $$;
