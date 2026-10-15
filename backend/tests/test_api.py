import pytest
from fastapi.testclient import TestClient

from app import main


@pytest.fixture(autouse=True)
def sin_retardo():
    anterior = main.settings["bot_delay"]
    main.settings["bot_delay"] = 0
    yield
    main.settings["bot_delay"] = anterior


@pytest.fixture
def client():
    return TestClient(main.app)


def crear(client, bots=2, chips=200):
    r = client.post("/games", json={"bots": bots, "chips": chips})
    assert r.status_code == 201
    return r.json()["game_id"]


@pytest.mark.parametrize("body", [
    {"bots": 0, "chips": 1000}, {"bots": 9, "chips": 1000},
    {"bots": 3, "chips": 99}, {"bots": 3, "chips": 100001}, {"bots": 3}, {},
])
def test_post_games_validacion_422(client, body):
    assert client.post("/games", json=body).status_code == 422


def test_post_y_get_games(client):
    gid = crear(client, bots=3, chips=1000)
    r = client.get(f"/games/{gid}")
    assert r.status_code == 200
    s = r.json()
    assert s["game_id"] == gid and len(s["players"]) == 4
    assert s["players"][0]["id"] == "human"
    assert all(p["cards"] is None for p in s["players"][1:])


def test_get_inexistente_404(client):
    assert client.get("/games/nope").status_code == 404


def test_cors_permite_vite(client):
    r = client.options("/games", headers={"Origin": "http://localhost:5173",
                                          "Access-Control-Request-Method": "POST"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"


def leer_hasta_turno_humano(ws, vistos):
    """Lee mensajes hasta un state donde le toca al humano o la mano/partida acabo."""
    while True:
        m = ws.receive_json()
        vistos.append(m)
        if m["type"] == "state":
            s = m["state"]
            if s["turn_id"] == "human" or s["phase"] in ("hand_over", "game_over"):
                # vaciar eventos que siguen al state (hand_result / game_over)
                return s


def test_ws_envia_state_al_conectar_y_oculta_cartas_de_bots(client):
    gid = crear(client)
    with client.websocket_connect(f"/ws/games/{gid}") as ws:
        m = ws.receive_json()
        assert m["type"] == "state"
        s = m["state"]
        assert s["players"][0]["cards"] and len(s["players"][0]["cards"]) == 2
        assert all(p["cards"] is None for p in s["players"] if p["is_bot"])


def test_ws_errores(client):
    gid = crear(client)
    with client.websocket_connect(f"/ws/games/{gid}") as ws:
        vistos = []
        leer_hasta_turno_humano(ws, vistos)
        ws.send_text("no es json")
        assert ws.receive_json()["code"] == "bad_message"
        ws.send_json({"type": "otra"})
        assert ws.receive_json()["code"] == "bad_message"
        ws.send_json({"type": "next_hand"})
        assert ws.receive_json()["code"] == "illegal_action"
        ws.send_json({"type": "action", "action": "raise", "amount": 1})
        assert ws.receive_json()["code"] == "invalid_amount"
        ws.send_json({"type": "action", "action": "baila"})
        assert ws.receive_json()["code"] == "bad_message"


def test_ws_partida_completa_hasta_game_over(client):
    gid = crear(client, bots=1, chips=100)
    tipos = set()
    with client.websocket_connect(f"/ws/games/{gid}") as ws:
        vistos = []
        for _ in range(5000):
            s = leer_hasta_turno_humano(ws, vistos)
            if s["phase"] == "game_over":
                break
            if s["phase"] == "hand_over":
                ws.send_json({"type": "next_hand"})
            else:
                ws.send_json({"type": "action", "action": "all_in"})
        else:
            pytest.fail("la partida no termino")
        # consumir los eventos finales que siguen al state
        for m in vistos:
            tipos.add(m["type"])
    assert {"state", "bot_action"} <= tipos
    # el ultimo state en game_over; hand_result y game_over llegan tras el state
    assert s["phase"] == "game_over"


def test_ws_eventos_hand_result_y_game_over(client):
    gid = crear(client, bots=1, chips=100)
    recibidos = []
    with client.websocket_connect(f"/ws/games/{gid}") as ws:
        while True:
            m = ws.receive_json()
            recibidos.append(m)
            if m["type"] == "game_over":
                break
            if m["type"] == "state":
                s = m["state"]
                if s["phase"] == "hand_over":
                    # esperar el hand_result que sigue al state
                    pass
                elif s["turn_id"] == "human":
                    ws.send_json({"type": "action", "action": "all_in"})
            if m["type"] == "hand_result" and s["phase"] == "hand_over":
                ws.send_json({"type": "next_hand"})
    res = [m for m in recibidos if m["type"] == "hand_result"]
    assert res and set(res[-1]) == {"type", "winners", "pot", "hand_name", "showdown"}
    assert recibidos[-1]["winner_id"] in ("human", "bot1")


def test_ws_partida_inexistente_cierra(client):
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/games/nope") as ws:
            ws.receive_json()
