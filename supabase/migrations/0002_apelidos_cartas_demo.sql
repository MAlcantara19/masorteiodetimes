-- MA Sorteio de Times — atualização 2
-- Rodar UMA vez no Supabase: SQL Editor → New query → colar tudo → Run.
-- 1) Vários apelidos por jogador (a lista do Zap reconhece qualquer um deles)
-- 2) Estilo de carta escolhido pelo jogador
-- 3) Marcação de pelada de demonstração (Pelada Piloto, usada no tour)

alter table public.membros add column if not exists apelidos text[] not null default '{}';
alter table public.profiles add column if not exists estilo_card text;
alter table public.peladas add column if not exists demo boolean not null default false;

-- A visão pública do perfil passa a mostrar o estilo da carta.
create or replace view public.perfis_publicos as
  select id, nome, apelido, foto_url, cor_card, estilo_card from public.profiles;
grant select on public.perfis_publicos to anon, authenticated;

-- Apelidos da Bola Fora (dá pra editar depois em Jogadores → toca no nome → Outros nomes).
update public.membros m set apelidos = v.apelidos
from (values
  ('Bruno Fernandes', array['Bruno', 'Bruninho', 'Vida Animal', 'Bruno Vida Animal']),
  ('Luiz Felipe', array['Felipe', 'Fubuia Júnior', 'Fubuia Jr', 'Luis Felipe']),
  ('João Guilherme', array['Ryan', 'João Guilherme Ryan', 'Fubuia mais velho', 'Joao Guilherme']),
  ('Luiz Fernando', array['Lulu', 'Luis Fernando']),
  ('Ramir', array['Ramizinho']),
  ('Renan Tarcitano', array['Renan', 'Tarcitano']),
  ('Taffarel', array['Tafarel']),
  ('Thiago Bromana', array['Bromana']),
  ('Thiago Rodrigues', array['Tiago', 'Thiago goleiro']),
  ('Ycaro', array['Ícaro', 'Icaro']),
  ('Patrick Vieira', array['Patrick']),
  ('Matheus Alcântara', array['Alcântara', 'Alcantara', 'Matheus'])
) as v(nome, apelidos)
where m.nome = v.nome and m.pelada_id = (select id from public.peladas where slug = 'bola-fora');
