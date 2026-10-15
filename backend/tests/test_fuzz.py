"""Fuzz de partidas completas: conservacion de fichas, lista consistente, termina."""
import random

import pytest

from app.bots import decidir
from app.motor import FASES_APUESTA, Game, GameError


def _consistente(g: Game) -> None:
    nodos = list(g.mesa.nodos())
    assert len(nodos) == g.mesa.tamano
    for n in nodos:
        assert n.siguiente.anterior is n and n.anterior.siguiente is n
    assert {n.dato.id for n in nodos} == {j.id for j in g.todos if j.status != "out"}


def _total(g: Game) -> int:
    return sum(j.chips for j in g.todos) + g.pot()


def jugar_partida(semilla: int) -> None:
    r = random.Random(semilla)
    bots = r.randint(1, 8)
    chips = r.choice((100, 200, 1000))
    g = Game(f"fz{semilla}", bots, chips, rng=random.Random(semilla))
    inicial = chips * (bots + 1)
    for _ in range(20000):
        assert _total(g) == inicial, f"semilla {semilla}: fichas no conservadas"
        _consistente(g)
        if g.phase == "game_over":
            assert g.mesa.tamano >= 1 and g.winner_id
            return
        if g.phase == "hand_over":
            g.next_hand()
            continue
        assert g.phase in FASES_APUESTA and g.turn is not None
        pid = g.turn.dato.id
        accion, monto = decidir(g, pid, r)
        try:
            g.apply(pid, accion, monto)
        except GameError:
            g.apply(pid, "call")
    pytest.fail(f"semilla {semilla}: la partida no termino")


@pytest.mark.parametrize("semilla", range(30))
def test_fuzz_rapido(semilla):
    jugar_partida(semilla)


@pytest.mark.slow
@pytest.mark.parametrize("semilla", range(1000, 1200))
def test_fuzz_200_partidas(semilla):
    jugar_partida(semilla)
