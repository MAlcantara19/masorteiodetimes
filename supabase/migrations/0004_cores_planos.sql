-- 0004: cor/camisa de cada pelada, plano (grátis/completo) e chaves de recursos.
-- Rodar no Supabase: SQL Editor → New query → colar tudo → Run. Pode rodar mais de uma vez.

-- Cores e camisa (a cor principal já existe: cor_banner)
alter table public.peladas add column if not exists cor_secundaria text not null default '#FFFFFF';
alter table public.peladas add column if not exists camisa_estilo text not null default 'lisa';
alter table public.peladas drop constraint if exists peladas_camisa_estilo_check;
alter table public.peladas add constraint peladas_camisa_estilo_check
  check (camisa_estilo in ('lisa', 'listras', 'faixa', 'metade', 'gola'));

-- Plano e recursos liberados (só o master muda)
alter table public.peladas add column if not exists plano text not null default 'completo';
alter table public.peladas drop constraint if exists peladas_plano_check;
alter table public.peladas add constraint peladas_plano_check check (plano in ('gratis', 'completo'));
alter table public.peladas add column if not exists recursos jsonb not null default '{}'::jsonb;
alter table public.peladas add column if not exists plano_ate date;

-- Admin edita a pelada, mas plano/recursos só o master.
create or replace function public.proteger_plano() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.plano is distinct from old.plano
      or new.recursos is distinct from old.recursos
      or new.plano_ate is distinct from old.plano_ate)
     and auth.uid() is not null and not public.eh_master() then
    raise exception 'Só o master muda o plano da pelada';
  end if;
  return new;
end $$;

drop trigger if exists proteger_plano on public.peladas;
create trigger proteger_plano before update on public.peladas
  for each row execute function public.proteger_plano();

-- Pelada nova criada por quem não é master começa no grátis.
create or replace function public.plano_inicial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.eh_master() then
    new.plano := 'gratis';
    new.recursos := '{}'::jsonb;
  end if;
  return new;
end $$;

drop trigger if exists plano_inicial on public.peladas;
create trigger plano_inicial before insert on public.peladas
  for each row execute function public.plano_inicial();
