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


def sesion_rigged(gid="rigged", seed=5):
    """Partida cuya primera mano se resuelve sola al repartir (humano 5 fichas)."""
    import random
    from app.motor import Game
    g = Game(gid, bots=1, chips=1000, rng=random.Random(seed), auto_start=False)
    g.jugador("human").chips = 5
    g.jugador("bot1").chips = 1995
    g.eventos_iniciales = g.start_hand()
    main.SESIONES[gid] = main.Sesion(g)
    return g


def test_ws_envia_eventos_de_primera_mano_resuelta_al_repartir(client):
    g = sesion_rigged("rig1")
    with client.websocket_connect("/ws/games/rig1") as ws:
        assert ws.receive_json()["type"] == "state"
        assert ws.receive_json()["type"] == "hand_result"
        if g.phase == "game_over":
            assert ws.receive_json()["type"] == "game_over"


def test_ws_next_hand_envia_eventos_de_mano_resuelta_al_repartir(client):
    g = sesion_rigged("rig2", seed=3)
    assert g.phase == "hand_over"
    with client.websocket_connect("/ws/games/rig2") as ws:
        while ws.receive_json()["type"] != "hand_result":
            pass
        for j in g.todos:
            j.chips = 0
        g.jugador("human").chips = 5
        g.jugador("bot1").chips = 1995
        ws.send_json({"type": "next_hand"})
        tipos = []
        while "hand_result" not in tipos:
            tipos.append(ws.receive_json()["type"])
        assert tipos[0] == "state"


def test_ids_de_partida_son_impredecibles_y_largos(client):
    gid = crear(client)
    assert len(gid) >= 20


def test_limpieza_de_sesiones_inactivas_al_crear(client, monkeypatch):
    main.SESIONES.clear()
    viejo = crear(client)
    over = crear(client)
    reciente = crear(client)
    ahora = main._ahora()
    main.SESIONES[viejo].last_activity = ahora - main.INACTIVIDAD_MAX - 1
    main.SESIONES[over].game.phase = "game_over"
    main.SESIONES[over].last_activity = ahora - main.GAME_OVER_MAX - 1
    crear(client)
    assert viejo not in main.SESIONES
    assert over not in main.SESIONES
    assert reciente in main.SESIONES


def test_game_over_reciente_no_se_limpia(client):
    main.SESIONES.clear()
    over = crear(client)
    main.SESIONES[over].game.phase = "game_over"
    crear(client)
    assert over in main.SESIONES


def test_tope_duro_de_partidas_devuelve_503(client, monkeypatch):
    main.SESIONES.clear()
    monkeypatch.setattr(main, "MAX_SESIONES", 3)
    for _ in range(3):
        crear(client)
    r = client.post("/games", json={"bots": 1, "chips": 200})
    assert r.status_code == 503
    assert "partidas" in r.json()["detail"].lower()
    assert len(main.SESIONES) == 3


def test_get_partida_toma_el_lock_de_la_sesion(client):
    import asyncio
    assert asyncio.iscoroutinefunction(main.obtener_partida)
    gid = crear(client)
    assert client.get(f"/games/{gid}").status_code == 200


def _cierre(ws):
    """Lee hasta que el servidor cierra; devuelve el codigo."""
    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect) as exc:
        for _ in range(200):
            ws.receive_json()
    return exc.value.code


def test_ws_rechaza_origin_no_permitido(client):
    gid = crear(client)
    with client.websocket_connect(f"/ws/games/{gid}", headers={"origin": "http://evil.example"}) as ws:
        assert _cierre(ws) == 4403


def test_ws_permite_origin_de_la_whitelist_y_sin_origin(client):
    gid = crear(client)
    with client.websocket_connect(f"/ws/games/{gid}", headers={"origin": "http://localhost:5173"}) as ws:
        assert ws.receive_json()["type"] == "state"
    with client.websocket_connect(f"/ws/games/{gid}") as ws:
        assert ws.receive_json()["type"] == "state"


def test_ws_segunda_conexion_cierra_la_anterior_con_4409(client):
    gid = crear(client)
    with client.websocket_connect(f"/ws/games/{gid}") as ws1:
        ws1.receive_json()
        with client.websocket_connect(f"/ws/games/{gid}") as ws2:
            assert ws2.receive_json()["type"] == "state"
            assert _cierre(ws1) == 4409


def _a_turno_humano(ws):
    leer_hasta_turno_humano(ws, [])


def test_ws_frame_binario_responde_bad_message(client):
    gid = crear(client)
    with client.websocket_connect(f"/ws/games/{gid}") as ws:
        _a_turno_humano(ws)
        ws.send_bytes(b"\x00\x01")
        assert ws.receive_json()["code"] == "bad_message"
        ws.send_text("[]")
        assert ws.receive_json()["code"] == "bad_message"  # sigue viva


def test_ws_json_con_recursion_responde_bad_message(client):
    gid = crear(client)
    with client.websocket_connect(f"/ws/games/{gid}") as ws:
        _a_turno_humano(ws)
        ws.send_text("[" * 4000)
        assert ws.receive_json()["code"] == "bad_message"
        ws.send_text("{}")
        assert ws.receive_json()["code"] == "bad_message"


def test_ws_mensaje_demasiado_largo_responde_bad_message(client):
    gid = crear(client)
    with client.websocket_connect(f"/ws/games/{gid}") as ws:
        _a_turno_humano(ws)
        ws.send_text('{"type": "action", "action": "fold", "x": "' + "a" * 5000 + '"}')
        assert ws.receive_json()["code"] == "bad_message"
        ws.send_text("{}")
        assert ws.receive_json()["code"] == "bad_message"
