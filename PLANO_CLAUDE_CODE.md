# Plano de construção — versão completa do MA Sorteio de Times

Este é o roteiro pro **Claude Code** construir o app inteiro, funcional, a partir do que já existe no repositório. O Matheus vai testar no PC e no celular e pedir ajustes depois.

Leia antes, nesta ordem:

1. `PROJETO.md`: regras de negócio, banco, papéis e escala das estrelas.
2. Este arquivo: ordem de construção e critérios de pronto.
3. `docs/prototipo/*.dc.html`: o visual de cada tela. São HTML com estilo inline. Siga cores, textos, ordem dos blocos e tamanhos; o `<script>` no fim de cada arquivo mostra o comportamento esperado.

---

## Regras de trabalho

- Textos do app em **português do Brasil**, com o tom do protótipo (direto, informal).
- **Mobile first** (390px de largura), mas tem que funcionar bem no PC.
- Identidade roxa e fontes: `src/app/globals.css` (tokens) e `PROJETO.md`, seção 3.
- **Notas e estrelas nunca aparecem pra jogador** nem em imagem ou texto compartilhado. No banco isso é garantido por RLS (tabela `notas`, só admin).
- Não reescrever do zero o que já funciona: `src/lib/lista.ts`, `src/lib/sorteio.ts` e a tela `/sortear` são a base. Leve a lógica pra nova estrutura sem mudar o comportamento.
- Ao fim de **cada etapa**: `npm run build` sem erro, `npm run lint` limpo, um commit com mensagem clara (`feat: ...`). No fim, deixe pro Matheus os comandos `git add .`, `git commit -m "..."` e `git push` prontos pra copiar.
- Quando precisar de algo que só o Matheus consegue fazer (criar conta, copiar chave, clicar num painel), **pare e explique passo a passo**, em linguagem simples (ele é dev iniciante e usa Windows 10).
- Nunca colocar chave secreta no código nem no Git. Tudo vai em `.env.local` e nas variáveis da Vercel.

---

## Etapa 0 — Configuração (com o Matheus)

Guiar o Matheus em:

1. Criar o projeto no **Supabase** (supabase.com, plano grátis, região São Paulo).
2. Rodar `supabase/migrations/0001_inicial.sql` no SQL Editor (banco completo, com todas as tabelas da seção 5 do `PROJETO.md`).
3. Copiar `.env.example` pra `.env.local` com `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e (só servidor) `SUPABASE_SECRET_KEY`.
4. Login Google: criar as credenciais OAuth no Google Cloud e ligar em Supabase → Authentication → Providers. Também ligar o login por e-mail e senha.
5. Depois do primeiro login dele, marcar `is_master = true` no perfil (SQL pronto pra colar).
6. Gerar as chaves **VAPID** pro push (`npx web-push generate-vapid-keys`) e guardar no `.env.local`.
7. Criar o projeto na **Vercel** a partir do GitHub `MAlcantara19/masorteiodetimes` e copiar as mesmas variáveis.

---

## Etapa 1 — Base, login e papéis

- `@supabase/ssr` com cliente de navegador e de servidor, e o middleware/proxy da versão do Next instalada (ler `node_modules/next/dist/docs` antes, porque essa versão do Next mudou APIs).
- `/entrar` (protótipo `Entrar.dc.html`): Google, e-mail e senha, "Só acompanhar", banner pra instalar o app.
- Perfil criado pelo trigger; tela pra completar o perfil no 1º acesso (nome, apelido, foto opcional no Storage).
- Papéis master, admin e jogador, com menu lateral (ou aba "Mais") mostrando o que cada papel pode fazer.
- **Pronto quando:** o Matheus entra com o Google, vira master e vê o painel master; um usuário comum entra e não vê nada de admin.

## Etapa 2 — Peladas, elenco e notas

- `/master` (`Master.dc.html`):
  - criar e editar peladas (nome, slug, dia, horário, regra de fim, minutos, lembrete, logo, PIN);
  - admins por pelada, "Gerar senha" (cria o usuário com e-mail e senha temporária via service role, numa rota de servidor);
  - "Tornar admin" pra quem entrou com Google;
  - duplas que mais caem juntas, **só master**.
- `/` Início (`Main.dc.html`): as peladas do usuário com a próxima data, a contagem regressiva, o aviso "ainda não sorteou" e o botão "Colar lista".
- `/[pelada]/jogadores` (`Jogadores.dc.html`):
  - elenco com busca;
  - sheet de avaliação simples (estrelas de meia em meia, com a descrição de cada nível) e completa (7 atributos de 0 a 10, nota geral convertida pra estrelas);
  - posição (Defesa/Meio/Ataque/Qualquer), "sabe marcar", apelido, goleiro, convidado.
- Importar o elenco do `localStorage` da versão atual (botão "Trazer elenco deste aparelho").
- **Pronto quando:** dá pra cadastrar a Bola Fora com os jogadores e as notas, e um jogador logado não consegue ler as notas nem pela API.

## Etapa 3 — Lista e sorteio

- `/[pelada]/lista` (`ColarLista.dc.html`): colar a lista, confirmar os nomes parecidos, cadastrar os novos com nota padrão 3, guardar o evento do dia e a presença.
- `/[pelada]/sortear` (`Sorteio.dc.html`):
  - quem joga hoje (tocar pra tirar ou pôr, aviso de sobra ou falta, escolher quem fica na espera);
  - quantos times (2 a 5) e quantos por time;
  - avaliação simples ou completa;
  - regras salvas da pelada (jogar junto, separar, goleiro fixo, equilibrar posições).
- `/[pelada]/times` (`Times.dc.html`):
  - **quadrada como padrão**, vertical como opção;
  - média de cada time e alerta de desequilíbrio só pra admin;
  - abas Sorteio 1 a 4 com ×; troca tocando em 2 nomes; desfazer; marcar como oficial (salvo no banco);
  - imagem clara ou escura; **Baixar a imagem / Baixar as 4** (PNG sem notas), copiar texto, mandar no Zap;
  - "Usar este sorteio e começar".
- **Pronto quando:** do texto colado do Zap até as 4 imagens baixadas leva menos de 1 minuto.

## Etapa 4 — Partida ao vivo (o coração do app)

Partida e ao vivo são **uma tela só** (`Partida.dc.html` + `AoVivo.dc.html`): `/[pelada]/jogo` pra admin e `/p/[slug]/ao-vivo` pública.

- **Cronômetro calculado pelo banco:** a partida guarda `inicio_em`, `pausado_em`, `segundos_pausados` e `duracao_seg`. Tempo decorrido = agora(servidor) − `inicio_em` − `segundos_pausados` − (tempo desde `pausado_em`, se pausado). Corrigir a diferença de relógio do aparelho com a hora do servidor. Todo mundo vê o mesmo tempo.
- Supabase **Realtime** em `partidas` e `lances`; a interface atualiza sozinha em todos os aparelhos.
- Botões:
  - Iniciar / Pausar / Voltar, +1 min, Zerar;
  - motivo da pausa opcional;
  - alerta "parado há X" depois de 1 min;
  - fim do tempo só vibra.
- Gol:
  - placar com + e −;
  - "+ Gol" pede autor (com "sem autor" e "gol contra") e depois a assistência (opcional);
  - lances com "por Fulano";
  - "Desfazer último".
- Goleiro de cada time em campo, inclusive linha no gol. **Editar quais times estão jogando.**
- Fila "quem ganha fica", com a regra de empate configurável. Regra de fim: só tempo (Bola Fora, 7 min) ou tempo ou 2 gols.
- Visitante pelo link: ver é livre; pra mexer, digita o **PIN do dia** (rota de servidor ou função RPC `security definer` que confere o PIN e grava; limite de tentativas). Pede o nome pra registrar quem marcou.
- Modo telão: tela cheia com relógio e placar gigantes (tablet na mesa).
- Funciona com internet ruim: fila local de ações que reenvia quando a conexão volta.
- **Pronto quando:** dois celulares abertos no mesmo jogo mostram o mesmo tempo (diferença de no máximo 1s), e um gol marcado num aparece no outro sozinho.

## Etapa 5 — Resultados, fim da pelada e correções

- `/[pelada]/resultados` (`Resultados.dc.html`): os jogos do dia, a fila, "Corrigir" (placar, autor, assistência) e os gols sem autor destacados.
- `/[pelada]/fim` (`FimPelada.dc.html`):
  - capa do time campeão;
  - prêmios do dia (artilheiro, garçom, menos vazado, craque por votação);
  - tempo real × com pausas;
  - pendências (só aviso);
  - mensagem pronta pro Zap com emojis.
- Abre a votação e manda o link de avaliação.

## Etapa 6 — Votação, avaliação, campeonato e perfis

- `/p/[slug]/votar` (`Votacao.dc.html`): craque, bagre e melhor goleiro. 1 voto por pessoa logada. A galera vê só a contagem; os admins veem quem votou em quem.
- `/p/[slug]/avaliar` (`Feedback.dc.html`): perguntas de toque; a sugestão "nota tá alta / tá baixa" chega só pros admins.
- `/[pelada]/campeonato` (`Campeonato.dc.html`):
  - semana e mês;
  - prêmios: craque, artilheiro, garçom, bagre, **mais vitorioso ("joga comigo que é vitória")**;
  - tabela (3 por vitória do time + 1 por gol);
  - goleiros: gols sofridos por jogo, jogos sem sofrer gol, duelo entre dois; quem é de linha e foi pro gol aparece separado, sem concorrer;
  - recordes da pelada.
- Perfil do jogador: apelido em destaque e nome embaixo, foto, estatísticas, medalhas, selo de convidado, comparar dois jogadores.

## Etapa 7 — Cards, álbum e banners

- Componente de carta (`Carta.dc.html`): Bronze, Prata, Ouro, **Destaque da semana** (preta) e **Jogador do mês** (a cor escolhida por ele). A raridade muda sozinha pelas regras do `PROJETO.md` (7.6). Animação de "abrir pacote" ao subir de raridade. **Design próprio, sem copiar arte do EA FC.**
- `/perfil/card` (`CardJogador.dc.html`), álbum e seleção do mês (`Album.dc.html`).
- `/[pelada]/banners` (`Banners.dc.html`):
  - do dia, da semana e do mês, em story (1080×1920) ou quadrado (1080×1080);
  - logo da pelada e foto;
  - cor de fundo personalizável;
  - geração com `@vercel/og` ou `html-to-image`.

## Etapa 8 — Notificações, extras e página pública

- Web Push com service worker:
  - lembrete de sortear X horas antes (cron da Vercel chamando uma rota);
  - lembrete da lista no dia anterior;
  - "a pelada começou" com o link ao vivo;
  - "você ganhou medalha";
  - votação aberta.
- PWA completo: ícones (192/512 com a logo MA roxa), tela offline, "Adicionar à tela inicial" explicado.
- `Mais.dc.html`: presença do mês, mensalidade (pago/devendo, cobrar no Zap), nota da pelada.
- `/p/[slug]`: página pública com o ao vivo, o campeonato, o álbum, os recordes e um convite por link e QR code.
- Galeria de fotos do dia (os admins podem apagar).
- Página de privacidade simples (LGPD) e "excluir minha conta".

## Fora do escopo agora

- Importar o elenco por foto de outro app (precisa de IA com visão e chave de API).
- Vídeos.

---

## Prompt pra colar no Claude Code

> Leia o CLAUDE.md, o PROJETO.md e o PLANO_CLAUDE_CODE.md, e olhe as telas em docs/prototipo. Construa o app completo seguindo o plano, etapa por etapa, começando pela Etapa 0 comigo. Ao terminar cada etapa, rode build e lint, faça o commit e me diga como testar no PC e no celular antes de seguir.
