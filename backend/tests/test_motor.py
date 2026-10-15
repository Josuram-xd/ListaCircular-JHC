import random

import pytest

from app.cartas import Baraja
from app.lista_circular import ListaCircular
from app.motor import Game, GameError


def mazo(*cartas):
    """Baraja fija: se reparte desde el principio. Relleno al final."""
    resto = [r + p for r in "23456789TJQKA" for p in "SHDC" if r + p not in cartas]
    return lambda rng=None: Baraja.desde(list(cartas) + resto)


def hu(chips=1000, mazo_fijo=None):
    """Heads-up: dealer=human (cabeza). SB=human, BB=bot1."""
    return Game("g1", bots=1, chips=chips, rng=random.Random(1), baraja_factory=mazo_fijo)


def ids(g):
    return [p["id"] for p in g.state()["players"]]


def fold_hasta_fin(g):
    while g.state()["turn_id"] is not None:
        g.apply(g.state()["turn_id"], "fold")


def test_estado_inicial_multi_jugador():
    g = Game("g1", bots=3, chips=1000, rng=random.Random(1))
    s = g.state()
    assert s["phase"] == "preflop" and s["hand_number"] == 1
    assert ids(g) == ["human", "bot1", "bot2", "bot3"]
    assert s["dealer_id"] == "human"
    # SB = bot1 (10), BB = bot2 (20), primero en actuar = bot3
    bets = {p["id"]: p["bet"] for p in s["players"]}
    assert bets == {"human": 0, "bot1": 10, "bot2": 20, "bot3": 0}
    assert s["turn_id"] == "bot3"
    assert s["pot"] == 30 and s["current_bet"] == 20
    assert s["min_raise"] == 40 and s["max_bet"] == 1000
    me = s["players"][0]
    assert me["name"] == "Tú" and len(me["cards"]) == 2 and me["is_bot"] is False
    assert all(p["cards"] is None for p in s["players"][1:])
    assert s["community"] == []


def test_ciegas_minimo_1():
    g = Game("g", bots=1, chips=100, rng=random.Random(1))
    assert g.sb == 1 and g.bb == 2


def test_heads_up_dealer_es_ciega_pequena_y_actua_primero():
    g = hu()
    s = g.state()
    bets = {p["id"]: p["bet"] for p in s["players"]}
    assert s["dealer_id"] == "human"
    assert bets == {"human": 10, "bot1": 20}
    assert s["turn_id"] == "human"


def test_heads_up_postflop_actua_primero_el_no_dealer():
    g = hu()
    g.apply("human", "call")
    assert g.state()["turn_id"] == "bot1"  # BB tiene opcion
    g.apply("bot1", "call")
    s = g.state()
    assert s["phase"] == "flop" and len(s["community"]) == 3
    assert s["turn_id"] == "bot1"  # no dealer primero


def test_mano_completa_showdown_gana_humano():
    g = hu(mazo_fijo=mazo("AS", "AH", "KD", "KC", "2C", "7D", "9H", "3S", "4D"))
    g.apply("human", "call")
    g.apply("bot1", "call")
    assert g.state()["community"] == ["2C", "7D", "9H"]
    g.apply("bot1", "call")
    g.apply("human", "call")
    assert g.state()["phase"] == "turn"
    g.apply("bot1", "call")
    g.apply("human", "call")
    assert g.state()["phase"] == "river"
    g.apply("bot1", "call")
    ev = g.apply("human", "call")
    s = g.state()
    assert s["phase"] == "hand_over" and s["turn_id"] is None
    res = [e for e in ev if e["type"] == "hand_result"][0]
    assert res["winners"] == ["human"] and res["pot"] == 40
    assert res["hand_name"] == "Pareja de Ases"
    assert res["showdown"] == {"human": ["AS", "AH"], "bot1": ["KD", "KC"]}
    chips = {p["id"]: p["chips"] for p in s["players"]}
    assert chips == {"human": 1020, "bot1": 980}
    # cartas del bot reveladas al llegar al showdown
    assert s["players"][1]["cards"] == ["KD", "KC"]
    assert s["pot"] == 0


def test_fold_termina_la_mano_sin_revelar_cartas():
    g = hu()
    ev = g.apply("human", "fold")
    res = [e for e in ev if e["type"] == "hand_result"][0]
    assert res["winners"] == ["bot1"] and res["pot"] == 30 and res["showdown"] == {}
    s = g.state()
    assert s["phase"] == "hand_over"
    assert s["players"][1]["cards"] is None
    assert {p["id"]: p["chips"] for p in s["players"]} == {"human": 990, "bot1": 1010}


def test_raise_valido_actualiza_apuesta_y_turno():
    g = hu()
    g.apply("human", "raise", 60)
    s = g.state()
    assert s["current_bet"] == 60 and s["turn_id"] == "bot1"
    assert s["min_raise"] == 100  # 60 + incremento 40
    g.apply("bot1", "raise", 100)
    assert g.state()["turn_id"] == "human"
    g.apply("human", "call")
    assert g.state()["phase"] == "flop" and g.state()["pot"] == 200


def test_acciones_ilegales():
    g = hu()
    with pytest.raises(GameError) as e:
        g.apply("bot1", "call")
    assert e.value.code == "not_your_turn"
    for amount in (None, 15, 30, 5000, "x", -4):
        with pytest.raises(GameError) as e:
            g.apply("human", "raise", amount)
        assert e.value.code == "invalid_amount"
    with pytest.raises(GameError) as e:
        g.apply("human", "dance")
    assert e.value.code == "bad_message"
    with pytest.raises(GameError) as e:
        g.next_hand()
    assert e.value.code == "illegal_action"


def test_all_in_sin_side_pots_limita_al_menor_stack():
    g = Game("g", bots=1, chips=1000, rng=random.Random(2),
             baraja_factory=mazo("AS", "AH", "KD", "KC", "2C", "7D", "9H", "3S", "4D"),
             auto_start=False)
    g.jugador("bot1").chips = 300
    g.start_hand()
    assert g.state()["max_bet"] == 300
    g.apply("human", "all_in")
    assert g.jugador("human").bet == 300 and g.jugador("human").chips == 700
    ev = g.apply("bot1", "call")
    res = [e for e in ev if e["type"] == "hand_result"][0]
    assert res["pot"] == 600 and res["winners"] == ["human"]
    s = g.state()
    chips = {p["id"]: p["chips"] for p in s["players"]}
    assert chips == {"human": 1300, "bot1": 0}
    assert [e["type"] for e in ev] == ["hand_result", "game_over"]
    assert s["phase"] == "game_over"
    assert {p["id"]: p["status"] for p in s["players"]}["bot1"] == "out"
    assert len(s["community"]) == 5


def test_raise_por_encima_del_max_bet_es_invalido():
    g = Game("g", bots=1, chips=1000, rng=random.Random(2), auto_start=False)
    g.jugador("bot1").chips = 300
    g.start_hand()
    with pytest.raises(GameError) as e:
        g.apply("human", "raise", 500)
    assert e.value.code == "invalid_amount"


def test_humano_sin_fichas_termina_la_partida_con_ganador_bot():
    g = Game("g", bots=1, chips=1000, rng=random.Random(2),
             baraja_factory=mazo("KD", "KC", "AS", "AH", "2C", "7D", "9H", "3S", "4D"))
    g.apply("human", "all_in")
    ev = g.apply("bot1", "call")
    over = [e for e in ev if e["type"] == "game_over"][0]
    assert over["winner_id"] == "bot1"
    assert g.state()["phase"] == "game_over"
    assert g.state()["turn_id"] is None
    with pytest.raises(GameError):
        g.next_hand()


def test_all_in_con_varios_jugadores_elimina_solo_al_perdedor():
    # human y bot2 all-in, bot1 foldea; human tiene AA, bot2 KK
    g = Game("g", bots=2, chips=1000, rng=random.Random(2), auto_start=False,
             baraja_factory=mazo("2S", "3S", "4S", "5C", "AS", "AH", "KD", "KC", "8D", "9H", "TC", "JD", "3D"))
    g.start_hand()
    # dealer human, SB bot1 (2S 3S? ver orden), BB bot2, primero human
    assert g.state()["turn_id"] == "human"
    g.apply("human", "all_in")
    g.apply("bot1", "fold")
    ev = g.apply("bot2", "call")
    res = [e for e in ev if e["type"] == "hand_result"][0]
    assert res["pot"] == 2000 + 10
    assert len(res["winners"]) == 1
    perdedor = "human" if res["winners"] == ["bot2"] else "bot2"
    st = {p["id"]: p["status"] for p in g.state()["players"]}
    assert st[perdedor] == "out"
    assert g.mesa.tamano == 2


def test_empate_divide_el_bote():
    g = hu(mazo_fijo=mazo("2S", "3H", "2D", "3C", "AC", "AD", "KH", "KS", "QD"))
    g.apply("human", "call")
    g.apply("bot1", "call")
    for _ in range(3):
        g.apply("bot1", "call")
        g.apply("human", "call")
    s = g.state()
    assert s["phase"] == "hand_over"
    assert {p["id"]: p["chips"] for p in s["players"]} == {"human": 1000, "bot1": 1000}


def test_rotacion_del_dealer_entre_manos():
    g = Game("g", bots=2, chips=1000, rng=random.Random(3))
    assert g.state()["dealer_id"] == "human"
    fold_hasta_fin(g)
    assert g.state()["phase"] == "hand_over"
    g.next_hand()
    s = g.state()
    assert s["hand_number"] == 2 and s["dealer_id"] == "bot1"
    assert all(p["status"] == "active" for p in s["players"])
    fold_hasta_fin(g)
    g.next_hand()
    assert g.state()["dealer_id"] == "bot2"
    fold_hasta_fin(g)
    g.next_hand()
    assert g.state()["dealer_id"] == "human"


def test_eliminar_al_dealer_pasa_el_boton_al_siguiente_vivo():
    g = Game("g", bots=3, chips=1000, rng=random.Random(4))
    fold_hasta_fin(g)
    g.next_hand()
    assert g.state()["dealer_id"] == "bot1"
    # el dealer (bot1) se queda sin fichas al terminar la mano
    fold_hasta_fin(g)
    b1 = g.jugador("bot1")
    b1.chips = 0
    g.eliminar_sin_fichas()
    assert g.mesa.tamano == 3
    assert {p["id"]: p["status"] for p in g.state()["players"]}["bot1"] == "out"
    assert ids(g)[-1] == "bot1"  # eliminado queda al final, solo historial
    g.phase = "hand_over"
    g.next_hand()
    assert g.state()["dealer_id"] == "bot2"
    assert "bot1" not in [j.id for j in g.mesa]


def test_eliminar_ultimo_y_cabeza_no_rompe_la_mesa():
    g = Game("g", bots=3, chips=1000, rng=random.Random(4))
    fold_hasta_fin(g)
    g.jugador("bot3").chips = 0
    g.jugador("bot2").chips = 0
    g.eliminar_sin_fichas()
    assert [j.id for j in g.mesa] == ["human", "bot1"]
    g.phase = "hand_over"
    g.next_hand()
    assert g.state()["phase"] == "preflop"


def test_next_hand_resetea_estado():
    g = hu()
    g.apply("human", "fold")
    g.next_hand()
    s = g.state()
    assert s["phase"] == "preflop" and s["community"] == [] and s["hand_number"] == 2
    assert s["dealer_id"] == "bot1"


def test_mesa_usa_lista_circular():
    g = Game("g", bots=3, chips=1000, rng=random.Random(1))
    assert isinstance(g.mesa, ListaCircular) and g.mesa.tamano == 4


def test_ciega_corta_all_in_en_las_ciegas():
    g = Game("g", bots=1, chips=1000, rng=random.Random(5), auto_start=False)
    g.jugador("bot1").chips = 5  # no alcanza la ciega grande
    g.start_hand()
    s = g.state()
    # sin side pots: la apuesta se limita al menor stack, el exceso se devuelve
    assert s["phase"] in ("preflop", "hand_over", "game_over")
    total = sum(p["chips"] + p["bet"] for p in s["players"])
    assert total == 1005
