# Cria a "Pelada Piloto": pelada de demonstração com 30 jogadores fictícios e 6 peladas de histórico.
# Uso (na pasta do projeto, com o .env.local preenchido):  python scripts/criar-pelada-piloto.py
# Se a Pelada Piloto já existir, apaga e cria de novo.
import json
import os
import random
import urllib.request
from datetime import datetime, timedelta, timezone


def ler_env():
    for linha in open(".env.local", encoding="utf-8"):
        if "=" in linha and not linha.startswith("#"):
            k, v = linha.strip().split("=", 1)
            os.environ.setdefault(k, v)


ler_env()
U = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
K = os.environ["SUPABASE_SECRET_KEY"]
H = {"apikey": K, "Authorization": "Bearer " + K, "Content-Type": "application/json", "Prefer": "return=representation"}


def api(metodo, caminho, corpo=None):
    dados = json.dumps(corpo).encode() if corpo is not None else None
    r = urllib.request.Request(U + "/rest/v1/" + caminho, method=metodo, headers=H, data=dados)
    with urllib.request.urlopen(r) as resp:
        txt = resp.read().decode()
        return json.loads(txt) if txt else None


random.seed(27)
master = api("GET", "profiles?select=id&is_master=eq.true&limit=1")[0]["id"]

for p in api("GET", "peladas?select=id&slug=eq.piloto"):
    api("DELETE", "peladas?id=eq." + p["id"])

pelada = api("POST", "peladas", {
    "nome": "Pelada Piloto", "slug": "piloto", "dia_semana": 3, "horario": "19:00", "horario_fim": "21:00",
    "local": "Arena Demonstração", "regra_fim": "tempo", "minutos": 7, "gols_limite": 2,
    "regra_empate": "sai_quem_ficou", "criado_por": master, "cor_banner": "#7444D6",
})[0]
PID = pelada["id"]

# 26 de linha + 4 goleiros, todos fictícios: (nome, apelido, estrelas, posição)
LINHA = [
    ("Carlos Eduardo", "Cadu", 4.5, "A"), ("Rafael Moreira", "Rafinha", 4, "M"), ("Diego Souza", "Diegão", 3.5, "D"),
    ("Pedro Henrique", "PH", 4, "A"), ("Lucas Almeida", "Luquinha", 3, "M"), ("Gabriel Costa", "Gabi", 5, "A"),
    ("André Luiz", "Dedé", 2.5, "D"), ("Felipe Santos", "Felipão", 3, "D"), ("Bruno Lima", "Bruneta", 3.5, "M"),
    ("Thiago Martins", "Thiaguinho", 2, "Q"), ("Marcos Paulo", "Marquinhos", 4, "M"), ("Vinícius Rocha", "Vini", 4.5, "A"),
    ("Gustavo Reis", "Guga", 3, "Q"), ("Leandro Dias", "Leleco", 2.5, "D"), ("Rodrigo Pires", "Digão", 3.5, "D"),
    ("Eduardo Neves", "Dudu", 3, "A"), ("Fábio Júnior", "Fabinho", 2, "Q"), ("Igor Teixeira", "Igão", 1.5, "D"),
    ("Renato Campos", "Renatinho", 3.5, "M"), ("Caio Ribeiro", "Caião", 4, "D"), ("Matheus Prado", "Mateuzinho", 2.5, "M"),
    ("Daniel Araújo", "Danilo", 3, "M"), ("Júlio Mendes", "Julinho", 1, "Q"), ("Hugo Barbosa", "Huguinho", 3.5, "A"),
    ("Sérgio Lopes", "Serginho", 2, "Q"), ("Wellington Braga", "Tom", 4, "M"),
]
GOLEIROS = [("Roberto Farias", "Paredão", 4), ("Fernando Prado", "Prass", 3.5), ("Marcos Rocha", "Marcão", 3), ("José Mário", "Zé", 2.5)]

rows = [
    {"pelada_id": PID, "nome": n, "apelido": a, "posicao": pos, "goleiro": False, "convidado": i >= 24, "sabe_marcar": pos == "D"}
    for i, (n, a, _, pos) in enumerate(LINHA)
]
rows += [{"pelada_id": PID, "nome": n, "apelido": a, "posicao": "Q", "goleiro": True, "convidado": False, "sabe_marcar": False} for n, a, _ in GOLEIROS]
membros = api("POST", "membros", rows)
estrelas = [x[2] for x in LINHA] + [g[2] for g in GOLEIROS]
nota = {m["id"]: e for m, e in zip(membros, estrelas)}
api("POST", "notas", [{"membro_id": mid, "nota_simples": n, "atualizado_por": master} for mid, n in nota.items()])
ids_linha = [m["id"] for m in membros if not m["goleiro"]]
ids_gol = [m["id"] for m in membros if m["goleiro"]]


def sortear(jog):
    # serpentina pela nota (com um pouco de sorte): times parecidos
    jog = sorted(jog, key=lambda x: -(nota[x] + random.uniform(-0.4, 0.4)))
    times = [[], [], []]
    ordem = [0, 1, 2, 2, 1, 0]
    for i, j in enumerate(jog):
        times[ordem[i % 6]].append(j)
    return times


hoje = datetime(2026, 11, 24, tzinfo=timezone.utc)
volta = (hoje.weekday() - 2) % 7 or 7  # última quarta antes de hoje
quartas = sorted(hoje - timedelta(days=volta) - timedelta(weeks=k) for k in range(6))

for dia in quartas:
    data = dia.strftime("%Y-%m-%d")
    presentes = random.sample(ids_linha, 15)
    gks = random.sample(ids_gol, 3)
    inicio = datetime(dia.year, dia.month, dia.day, 22, 0, tzinfo=timezone.utc)  # 19h em Brasília
    ev = api("POST", "eventos", {
        "pelada_id": PID, "data": data, "horario": "19:00", "status": "encerrado",
        "iniciado_em": inicio.isoformat(), "encerrado_em": (inicio + timedelta(hours=2)).isoformat(),
    })[0]
    api("POST", "presencas",
        [{"evento_id": ev["id"], "membro_id": m, "status": "confirmado", "goleiro": False, "ordem": i} for i, m in enumerate(presentes)]
        + [{"evento_id": ev["id"], "membro_id": g, "status": "confirmado", "goleiro": True, "ordem": 20 + i} for i, g in enumerate(gks)])
    times = sortear(presentes)
    api("POST", "sorteios", {"evento_id": ev["id"], "numero": 1, "times": times, "goleiros": gks, "espera": [], "oficial": True, "criado_por": master})

    forca = [sum(nota[j] for j in t) for t in times]
    em_campo, fila, veterano = [0, 1], [2], None
    t0 = inicio
    gols_dia, assist_dia = {}, {}
    sofridos = {g: [0, 0] for g in gks}
    jogos = random.randint(8, 10)
    for numero in range(1, jogos + 1):
        a, b = em_campo
        placar = [0, 0]
        lances = []
        for lado, t in ((0, a), (1, b)):
            outro = b if lado == 0 else a
            media = 0.9 + (forca[t] - forca[outro]) * 0.12
            n = max(0, min(5, int(round(random.gauss(media, 1)))))
            for _ in range(n):
                autor = random.choices(times[t], weights=[nota[x] ** 2 for x in times[t]])[0]
                assist = random.choice([x for x in times[t] if x != autor]) if random.random() < 0.6 else None
                lances.append({"tipo": "gol", "time": t, "autor_id": autor, "assist_id": assist, "minuto": random.randint(1, 7)})
                placar[lado] += 1
                gols_dia[autor] = gols_dia.get(autor, 0) + 1
                if assist:
                    assist_dia[assist] = assist_dia.get(assist, 0) + 1
        pausa = random.choice([0, 0, 30, 60, 90])
        p = api("POST", "partidas", {
            "evento_id": ev["id"], "numero": numero, "time_a": a, "time_b": b, "goleiro_a": gks[a], "goleiro_b": gks[b],
            "duracao_seg": 420, "status": "encerrada", "placar_a": placar[0], "placar_b": placar[1],
            "inicio_em": t0.isoformat(), "encerrada_em": (t0 + timedelta(seconds=420 + pausa)).isoformat(), "segundos_pausados": pausa,
            "vencedor": a if placar[0] > placar[1] else b if placar[1] > placar[0] else None,
        })[0]
        if lances:
            api("POST", "lances", [{
                **l, "partida_id": p["id"], "criado_por": master, "criado_por_nome": "Demo",
                "created_at": (t0 + timedelta(minutes=l["minuto"])).isoformat(),
            } for l in lances])
        sofridos[gks[a]][0] += placar[1]
        sofridos[gks[a]][1] += 1
        sofridos[gks[b]][0] += placar[0]
        sofridos[gks[b]][1] += 1
        t0 += timedelta(seconds=420 + pausa + 120)
        # quem ganha fica; empate sai quem estava há mais tempo
        if placar[0] != placar[1]:
            venc, perd = (a, b) if placar[0] > placar[1] else (b, a)
        else:
            perd = veterano if veterano in (a, b) else a
            venc = b if perd == a else a
        fila.append(perd)
        em_campo = [venc, fila.pop(0)]
        veterano = venc

    # votação (1 voto por categoria, só pra demonstração) e medalhas do dia
    fecha = (inicio + timedelta(hours=26)).isoformat()
    vots = api("POST", "votacoes", [{"evento_id": ev["id"], "categoria": c, "abre": (inicio + timedelta(hours=2)).isoformat(), "fecha": fecha} for c in ("craque", "bagre", "goleiro")])
    craque = max(presentes, key=lambda x: gols_dia.get(x, 0) * 2 + assist_dia.get(x, 0) + nota[x])
    bagre = min(presentes, key=lambda x: nota[x] + gols_dia.get(x, 0))
    gol_melhor = min(gks, key=lambda g: sofridos[g][0] / max(1, sofridos[g][1]))
    escolha = {"craque": craque, "bagre": bagre, "goleiro": gol_melhor}
    api("POST", "votos", [{"votacao_id": v["id"], "eleitor_id": master, "votado_id": escolha[v["categoria"]]} for v in vots])
    med = []
    if gols_dia:
        mx = max(gols_dia.values())
        med += [{"membro_id": m, "tipo": "artilheiro", "periodo": data, "valor": mx} for m, g in gols_dia.items() if g == mx]
    if assist_dia:
        mx = max(assist_dia.values())
        med += [{"membro_id": m, "tipo": "garcom", "periodo": data, "valor": mx} for m, g in assist_dia.items() if g == mx]
    med.append({"membro_id": gol_melhor, "tipo": "muralha", "periodo": data, "valor": sofridos[gol_melhor][0]})
    api("POST", "medalhas", med)
    print(f"{data}: 15 de linha + 3 goleiros, {jogos} jogos, {sum(gols_dia.values())} gols")

print(f"Pelada Piloto pronta: {len(membros)} jogadores. Endereços: /piloto e /p/piloto")
