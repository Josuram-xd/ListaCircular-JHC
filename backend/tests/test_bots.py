import random

import pytest

from app.bots import decidir, fuerza_postflop, fuerza_preflop
from app.motor import Game


def test_fuerza_preflop_ordena_manos():
    assert fuerza_preflop(["AS", "AH"]) > fuerza_preflop(["KS", "QD"]) > fuerza_preflop(["7S", "2D"])
    assert fuerza_preflop(["AS", "KS"]) > fuerza_preflop(["AS", "KD"])


def test_fuerza_postflop_ordena_categorias():
    com = ["2C", "7D", "9H", "JS", "3S"]
    assert fuerza_postflop(["AS", "AH"], com) > fuerza_postflop(["AD", "KC"], com)
    assert fuerza_postflop(["7S", "7H"], com) > fuerza_postflop(["AD", "KC"], com)


def jugar_partida(seed, bots, chips=200):
    """Todos (incluido el humano) juegan con el bot. Verifica invariantes."""
    rng = random.Random(seed)
    g = Game("sim", bots=bots, chips=chips, rng=rng)
    total = bots * chips + chips
    pasos = 0
    while g.state()["phase"] != "game_over":
        s = g.state()
        if s["phase"] == "hand_over":
            g.next_hand()
            continue
        accion, monto = decidir(g, s["turn_id"], rng)
        g.apply(s["turn_id"], accion, monto)  # nunca debe lanzar GameError
        total_actual = sum(j.chips + j.total for j in g.todos)
        assert total_actual == total
        pasos += 1
        assert pasos < 20000
    s = g.state()
    assert s["turn_id"] is None
    return g


@pytest.mark.parametrize("seed", range(25))
def test_simulacion_completa_conserva_fichas_y_termina(seed):
    g = jugar_partida(seed, bots=1 + seed % 8)
    assert g.winner_id is not None
    assert sum(j.chips for j in g.todos) == (len(g.todos)) * 200
