# MA Sorteio de Times — mapa do projeto

Documento de referência para construir o app. Ele resume as decisões tomadas no chat com o Claude (23 e 24/11/2026) e o protótipo visual.

- **Protótipo clicável (todas as telas):** https://claude.ai/artifact/RNQsAVNEBKM9caUbSS8Ma5
- **Dono / master:** Matheus Alcântara
- **Primeira pelada de teste:** Bola Fora. Depois vêm Artilheiros do Copo (segunda) e Terça dos conhecidos.

---

## 1. O que é

É um app web instalável (PWA) pra organizar peladas:

- sortear times equilibrados;
- controlar o jogo ao vivo (cronômetro e placar compartilhados);
- guardar o histórico;
- rodar o "campeonato" do grupo: rankings, prêmios, votação, cards e banners.

Tem que ser grátis, sem anúncio, simples e rápido: qualquer pessoa abre e entende.

---

## 2. Stack

| Parte | Escolha | Por quê |
|---|---|---|
| Front | **Next.js (App Router) + TypeScript + Tailwind** | Mesmo caminho dos outros projetos, deploy fácil na Vercel |
| Banco, login, tempo real, arquivos | **Supabase** (Postgres + Auth + Realtime + Storage) | Plano grátis; login Google pronto; placar ao vivo sincronizado |
| Hospedagem | **Vercel** | Já usada nos outros projetos |
| PWA | `next-pwa` ou manifest + service worker próprio | Instalar na tela inicial, abrir logado, funcionar offline na quadra |
| Notificações | Web Push (VAPID) | Lembrete de sortear, "a pelada começou", medalhas |
| Imagens pra compartilhar | `html-to-image` (ou `@vercel/og` no servidor) | Gerar PNG dos times, banners e cards |

PC: Windows 10, com Node LTS, Git e VS Code instalados.

---

## 3. Identidade visual

- **Roxo claro** como cor principal, na linha da VitraForma e da MA Online Store.
- Tokens usados no protótipo:
  - primária `#7444D6`
  - primária escura `#4F2A9E`
  - roxo suave `#EFE8FC`
  - fundo `#F6F4FA`
  - borda `#E6E1EF`
  - escuro `#1B1430`
  - destaque no escuro `#C9B2FF`
  - alerta `#B4460B` sobre `#FCEBDD`
  - botões de WhatsApp `#1A8F4E`
- Fontes: **Space Grotesk** nos títulos e números, **Inter** nos textos.
- Nome do app: **MA Sorteio de Times** (curto: "MA Sorteio"), com "Sorteio de Times" no roxo de destaque. Pasta e repositório: `masorteiodetimes`.
- Créditos: "Desenvolvido por Matheus Alcântara".

---

## 4. Papéis e permissões

| Papel | Quem | Pode |
|---|---|---|
| **Master** | Matheus | Tudo, em todas as peladas. Cria peladas, gera e-mail e senha de admins, promove quem entrou com Google, vê as estatísticas de duplas (só master) |
| **Admin** | Por pelada | Elenco, notas, sorteio, partida, correções, quem votou em quem |
| **Jogador** | Login Google ou e-mail | O próprio perfil e card, votar, avaliar a pelada, ver rankings |
| **Visitante** | Sem login, pelo link | Ver o ao vivo e a página pública. Mexer no placar só com o PIN do dia (ver 7.5) |

Regras fixas:

- **Notas e estrelas nunca aparecem pra jogador** e nunca saem em imagem compartilhada. Só os admins veem.
- Votos: a galera vê só a contagem. Os admins veem quem votou em quem.
- Menu lateral (ou a aba "Mais") mostra as opções conforme o papel: painel master, painel admin, jogador.

---

## 5. Modelo de dados (Supabase)

```
profiles        id (auth.users), nome, apelido, foto_url, email, created_at
peladas         id, nome, slug, dia_semana, horario, local, logo_url, cor_banner,
                regra_fim ('tempo' | 'tempo_ou_gols' | 'gols'), minutos (7), gols_limite (2),
                regra_empate, lembrete_horas_antes (2), pin_ao_vivo, criado_por
membros         pelada_id, profile_id NULL, nome, apelido, papel ('admin'|'jogador'),
                posicao ('D'|'M'|'A'|'Q'), sabe_marcar bool, goleiro bool, convidado bool,
                nota_simples numeric(2,1) (0,5 a 5), atributos jsonb (fôlego, habilidade, noção,
                joga pro time, físico, defesa, finalização: 0–10), ativo
regras_sorteio  pelada_id, tipo ('junto'|'separar'), membros uuid[]
eventos         id, pelada_id, data, status ('lista'|'sorteado'|'em_jogo'|'encerrado'),
                lista_texto, iniciado_em, encerrado_em
presencas       evento_id, membro_id, status ('confirmado'|'espera'|'saiu'), ordem
sorteios        id, evento_id, numero, times jsonb, oficial bool, criado_por, created_at
partidas        id, evento_id, numero, time_a, time_b, goleiro_a, goleiro_b,
                goleiro_a_linha bool, goleiro_b_linha bool,
                inicio_em, pausado_em, segundos_pausados, duracao_seg, status, placar_a, placar_b
pausas          partida_id, inicio, fim, motivo NULL
lances          id, partida_id, tipo ('gol'|'gol_contra'), time, autor_id NULL, assist_id NULL,
                minuto, criado_por, created_at, desfeito bool
votacoes        id, evento_id ou periodo, categoria ('craque'|'bagre'|'goleiro'|'semana'), abre, fecha
votos           votacao_id, eleitor_id, votado_id
avaliacoes      evento_id, profile_id NULL, equilibrio, mais_forte, motivo, sugestoes jsonb, texto
pagamentos      pelada_id, membro_id, mes, pago bool
medalhas        membro_id, tipo, periodo, valor
fotos           evento_id, autor_id, url, legenda
push_subs       profile_id, endpoint, keys
```

RLS (Row Level Security) liga as permissões da seção 4. A coluna de notas fica numa view ou policy que só admin lê.

---

## 6. Telas (na ordem do protótipo)

1. **Início:** as peladas do usuário, com contagem regressiva, aviso "ainda não sorteou", botão "Colar lista do WhatsApp" e o lembrete configurável.
2. **Colar lista:** lê a mensagem do grupo (formato abaixo) e separa linha, goleiros, suplentes, data e horário. Reconhece nomes parecidos e pede confirmação ("Felipe" pode ser o "Feliph").
3. **Jogadores:**
   - Avaliação **simples**: estrelas de 0,5 a 5, tocando na metade da estrela pra dar meia, com a descrição de cada nível da 6.1.
   - Avaliação **completa**: atributos.
   - Também guarda posição, "sabe marcar", apelido e nome.
4. **Montar sorteio:**
   - quem joga hoje (tocar pra tirar ou pôr), com aviso de gente sobrando ou faltando;
   - quantos times (2 a 5) e jogadores por time (padrão 5);
   - avaliação simples ou completa;
   - regras salvas da pelada: jogar junto, separar, goleiro fixo, equilibrar posições.
5. **Times sorteados:**
   - **quadrada como padrão** (times lado a lado); vertical como opção;
   - média de cada time e alerta de desequilíbrio, **só no app pra admin**;
   - abas Sorteio 1 a 4, cada uma com ×; troca manual tocando em 2 nomes, com desfazer;
   - "Marcar como oficial";
   - imagem clara ou escura, "Baixar as 4" e "Mandar no Zap";
   - a imagem leva só "Bola Fora · Sorteio N · data", os times e o rodapé "Times gerados pelo MA Sorteio", **sem nota nenhuma**.
6. **Partida + ao vivo, na mesma tela** (ver 7.5):
   - cronômetro grande: iniciar, pausar ou voltar, +1 min e zerar; motivo da pausa é opcional; alerta quando fica mais de 1 min parado; no fim só vibra;
   - placar com + e − em cada time; "+ Gol" pergunta quem fez (ou sem autor, ou gol contra) e a assistência (opcional);
   - desfazer último lance; goleiro de cada time, inclusive jogador de linha no gol;
   - **editar quais times estão jogando**; fila com o próximo.
7. **Resultados do dia:** jogos, placares, gols, quem completou, botão "Corrigir" em cada jogo e gols sem autor destacados.
8. **Fim da pelada:**
   - capa do time campeão;
   - premiados do dia: artilheiro, garçom, menos vazado, craque;
   - tempo real (bola rolando × com pausas);
   - pendências (só aviso, opcional);
   - mensagem pronta pro Zap com emojis.
9. **Votação:** craque, bagre e melhor goleiro. Abre depois do último jogo, dentro do link ao vivo. Votos anônimos pra galera, visíveis pros admins.
10. **Campeonato:**
    - semana e mês;
    - prêmios: craque, artilheiro, garçom, bagre, **mais vitorioso** ("joga comigo que é vitória");
    - tabela de pontos (3 por vitória do time + 1 por gol);
    - disputa dos goleiros: gols sofridos por jogo, jogos sem sofrer gol e duelo entre dois; quem é de linha e foi pro gol aparece separado, sem concorrer.
11. **Banners:** do dia, da semana e do mês, em story ou quadrado, com espaço pra logo da pelada e foto. Tipos: artilheiro, garçom, muralha, craque, time campeão, bagre, seleção.
12. **Meu card:** raridades Bronze, Prata e Ouro, a carta preta "Destaque da semana" e a carta "Jogador do mês" (ele escolhe a cor). Tem animação de "abrir pacote" quando sobe de raridade. O design é próprio, **sem copiar arte do EA FC**.
13. **Álbum e seleção do mês:** as cartas de todo mundo; seleção do mês num campo (2 no ataque, 2 no meio e goleiro), montada pelos prêmios e pelas estatísticas.
14. **Avaliação pós-jogo** (link): equilibrou? qual time ficou mais forte? por quê? nota de alguém fora do lugar (tá alta / tá baixa)? comentário.
15. **Mais:** presença, mensalidade (pago/devendo e cobrar no Zap), nota da pelada e atalhos pras outras telas.
16. **Entrar:** Google, e-mail e senha, "só acompanhar", instalar o app.
17. **Painel master:** peladas, admins, gerar senha, promover quem entrou com Google, duplas que mais caem juntas.

---

## 7. Regras de negócio

### 7.1 Escala das estrelas (texto que aparece ao avaliar)
| Nota | Descrição |
|---|---|
| 5 | Quase profissional na pelada |
| 4,5 | Muito bom, carrega o time (2 ou 3 por pelada) |
| 4 | Bom, tem bastante noção, mas não carrega o time |
| 3,5 | Um pouco acima da média |
| 3 | Na média |
| 2,5 | Abaixo da média, mas tem noção (pesado, não corre…) |
| 2 | Noção básica, quase tudo no básico |
| 1,5 | Ruim, sabe menos que o básico (não manja de posicionamento) |
| 1 | Muito fraco |
| 0,5 | Começando agora |

### 7.2 Formato da lista do WhatsApp
```
Pelada 23/11/2026
Horário: 18:30 até 20:30
1 - Thiago Bromana
2 - João Guilherme
...
Goleiros
1-Tilu
2-Tiago
3- Alcântara
Suplentes
1-Ycaro
2-
```
O parser:
- ignora as linhas de cabeçalho e pega a data e o horário;
- tira a numeração (`1 -`, `1-`, `1.`, `1)`) e os emojis;
- separa as seções pelos títulos "Goleiros" e "Suplentes";
- descarta as linhas vazias;
- casa os nomes com o elenco por similaridade (normalizando acento e caixa).

### 7.3 Algoritmo do sorteio
1. Coloca primeiro os grupos de "jogar junto" (no mesmo time).
2. Ordena o resto pela nota, somando um pouco de aleatoriedade (±0,4), e distribui sempre no time com menor soma, respeitando "separar" e o tamanho do time.
3. Faz uma busca local (de 400 a 500 trocas aleatórias), mantendo uma troca só se diminuir o custo e não quebrar as regras. Custo = 2 × (maior soma − menor soma) + diferença de defensores entre os times (quando "equilibrar posições" estiver ligado).
4. Goleiros fixos ficam fora da média e vão um por time.
5. Com gente sobrando, os últimos da lista ficam na espera; o admin pode escolher outro nome.

### 7.4 Partida
- A regra de fim é configurada por pelada. Na Bola Fora é **só tempo, 7 min**. Também existe "7 min ou 2 gols" pra outras peladas.
- Fila "quem ganha fica". A regra de empate é configurável.
- Tempo real = soma do tempo rolando; tempo com pausas = do início ao fim.

### 7.5 Ao vivo (tempo real)
- Uma só tela de partida, que funciona pra admin logado e pra quem abre o link.
- **O cronômetro não "conta" em cada celular.** O banco guarda `inicio_em`, `pausado_em` e `segundos_pausados`, e cada aparelho calcula o tempo restante com o relógio do servidor. Assim todo mundo vê o mesmo tempo.
- Supabase Realtime no canal `partida:{id}` (mudanças em `partidas` e `lances`).
- Pra ver é livre. Pra mexer no placar, o visitante digita o **PIN do dia**, que o admin passa no grupo; quem está logado como admin não precisa.
- Todo lance guarda quem marcou (`criado_por`), mostrado como "por Fulano".
- Modo telão: tela cheia com cronômetro e placar gigantes, pra um tablet na mesa.

### 7.6 Prêmios
- **Do dia:** artilheiro, garçom, menos vazado (só goleiro de verdade) e craque (votação).
- **Do mês:** quem ganhou mais vezes cada prêmio nas peladas do mês, e quem teve mais vitórias ("mais vitorioso").
- **Raridade do card:**
  - bronze é o início;
  - prata com 10 peladas na temporada;
  - ouro com 25 peladas ou uma medalha no mês;
  - "Destaque da semana" é carta preta, vale 7 dias;
  - "Jogador do mês" é o craque do mês.

---

## 8. Fases de entrega

**Fase 1 — usar na Bola Fora (MVP)**
- Login (Google, e-mail e senha), PWA instalável, papéis (master, admin, jogador).
- Peladas, elenco, avaliação simples e completa.
- Colar lista, montar sorteio, times sorteados (imagem, Zap, oficial, troca, desfazer).
- Partida com o cronômetro e o placar ao vivo sincronizados, mais o link público com PIN.
- Resultados, correção e fim da pelada com a mensagem pro Zap.

**Fase 2 — engajamento**
- Votação (craque, bagre, goleiro), avaliação pós-jogo.
- Campeonato semanal e mensal, goleiros, recordes por pelada.
- Perfil com apelido e foto, card com raridades, álbum, seleção do mês.
- Notificações push: lembrete de sortear, "a pelada começou", medalha nova.

**Fase 3 — extra**
- Banners (dia, semana, mês), cor puxada da logo, animação de pacote.
- Página pública da pelada, convite por link, galeria de fotos, card do grupo.
- Mensalidade, presença, retrospectiva do ano.
- **Importar elenco por foto** (print de outro app com as estrelas): usar uma IA com visão, que lê os nomes e as estrelas e devolve tudo pra conferir. Isso tem custo por uso (centavos por imagem) e precisa de uma chave de API. Fica pra quando o resto estiver rodando.

---

## 9. Onde estamos e próximos passos

**Etapa 1 — pronta neste repositório (funciona sem login, dados no aparelho):**
- Next.js + TypeScript + Tailwind com a identidade roxa, manifest pra instalar (PWA básico).
- `/sortear`: colar a lista do Zap, confirmar nomes parecidos, estrelas de 0,5 em 0,5 com a descrição de cada nível, posição e apelido, quantos times e quantos por time, jogar junto, separar, equilibrar posições, aviso de sobra ou falta, até 4 sorteios com ×, troca tocando em 2 nomes, desfazer, oficial, fundo claro ou escuro, baixar imagem (sem notas), copiar texto e mandar no Zap.
- `src/lib/lista.ts` (leitor da lista) e `src/lib/sorteio.ts` (algoritmo).
- `supabase/migrations/0001_inicial.sql` (banco completo, com permissões) e `src/lib/supabase/client.ts`.

**Etapa 2 — próxima (com o Claude Code):**
1. Criar o projeto no Supabase (supabase.com, plano grátis), rodar `supabase/migrations/0001_inicial.sql` no SQL Editor, copiar `.env.example` para `.env.local` e preencher.
2. Ligar o login Google (Authentication → Providers) e marcar o seu perfil como `is_master = true`.
3. Trocar o armazenamento local pelo Supabase (peladas, elenco, notas só pra admin, sorteios).
4. Partida + ao vivo numa tela só, com o cronômetro calculado a partir do banco, PIN do dia pra visitante, edição dos times em campo.
5. Deploy na Vercel com as mesmas variáveis.

Pra começar no Claude Code: abra a pasta `C:\PROJETOS\masorteiodetimes` e peça *"Leia o PROJETO.md e faça a etapa 2"*.
