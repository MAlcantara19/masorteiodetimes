-- 0006: valor da diária (cobrar a pelada avulsa com Pix) e votos de vários dias num pedido só.
-- Pode rodar mais de uma vez sem problema.

-- 1) Valor da diária (quem não é mensalista paga por pelada)
alter table public.peladas add column if not exists valor_diaria numeric(8,2);

-- 2) Contagem de votos de vários dias de uma vez (deixa o Hall da fama e o campeonato mais rápidos)
create or replace function public.contagem_votos_eventos(p_eventos uuid[])
returns table (evento_id uuid, categoria text, votado_id uuid, votos bigint)
language sql stable security definer set search_path = public as $$
  select v.evento_id, v.categoria, vo.votado_id, count(*)
  from public.votacoes v
  join public.votos vo on vo.votacao_id = v.id
  where v.evento_id = any(p_eventos)
  group by v.evento_id, v.categoria, vo.votado_id;
$$;

grant execute on function public.contagem_votos_eventos(uuid[]) to anon, authenticated;
