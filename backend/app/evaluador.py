"""Evaluador de manos: mejor mano de 5 entre 5, 6 o 7 cartas."""
from __future__ import annotations

from collections import Counter
from itertools import combinations
from typing import Sequence, Tuple

from .cartas import valor, palo

CARTA_ALTA, PAREJA, DOBLE_PAREJA, TRIO, ESCALERA, COLOR, FULL, POKER, ESCALERA_COLOR = range(9)

Puntaje = Tuple[int, ...]

_SING = {2: "Dos", 3: "Tres", 4: "Cuatro", 5: "Cinco", 6: "Seis", 7: "Siete", 8: "Ocho",
         9: "Nueve", 10: "Diez", 11: "Jota", 12: "Reina", 13: "Rey", 14: "As"}
_PLUR = {2: "Doses", 3: "Treses", 4: "Cuatros", 5: "Cincos", 6: "Seises", 7: "Sietes", 8: "Ochos",
         9: "Nueves", 10: "Dieces", 11: "Jotas", 12: "Reinas", 13: "Reyes", 14: "Ases"}


def _evaluar5(cartas: Sequence[str]) -> Puntaje:
    vals = sorted((valor(c) for c in cartas), reverse=True)
    es_color = len({palo(c) for c in cartas}) == 1
    unicos = sorted(set(vals), reverse=True)
    alta_escalera = 0
    if len(unicos) == 5:
        if unicos[0] - unicos[4] == 4:
            alta_escalera = unicos[0]
        elif unicos == [14, 5, 4, 3, 2]:
            alta_escalera = 5
    if alta_escalera and es_color:
        return (ESCALERA_COLOR, alta_escalera)
    cuenta = Counter(vals)
    # ordena por (repeticiones, valor) descendente
    grupos = sorted(cuenta.items(), key=lambda kv: (kv[1], kv[0]), reverse=True)
    patron = [g[1] for g in grupos]
    orden = tuple(g[0] for g in grupos)
    if patron == [4, 1]:
        return (POKER,) + orden
    if patron == [3, 2]:
        return (FULL,) + orden
    if es_color:
        return (COLOR,) + tuple(vals)
    if alta_escalera:
        return (ESCALERA, alta_escalera)
    if patron == [3, 1, 1]:
        return (TRIO,) + orden
    if patron == [2, 2, 1]:
        return (DOBLE_PAREJA,) + orden
    if patron == [2, 1, 1, 1]:
        return (PAREJA,) + orden
    return (CARTA_ALTA,) + tuple(vals)


def evaluar(cartas: Sequence[str]) -> Puntaje:
    """Puntaje comparable (tupla) de la mejor mano de 5 cartas."""
    if not 5 <= len(cartas) <= 7:
        raise ValueError("Se necesitan entre 5 y 7 cartas")
    return max(_evaluar5(c) for c in combinations(cartas, 5))


def nombre_mano(p: Puntaje) -> str:
    c = p[0]
    if c == ESCALERA_COLOR:
        return "Escalera Real" if p[1] == 14 else f"Escalera de Color al {_SING[p[1]]}"
    if c == POKER:
        return f"Póker de {_PLUR[p[1]]}"
    if c == FULL:
        return f"Full de {_PLUR[p[1]]} con {_PLUR[p[2]]}"
    if c == COLOR:
        return f"Color al {_SING[p[1]]}"
    if c == ESCALERA:
        return f"Escalera al {_SING[p[1]]}"
    if c == TRIO:
        return f"Trío de {_PLUR[p[1]]}"
    if c == DOBLE_PAREJA:
        return f"Doble Pareja de {_PLUR[p[1]]} y {_PLUR[p[2]]}"
    if c == PAREJA:
        return f"Pareja de {_PLUR[p[1]]}"
    return f"Carta Alta: {_SING[p[1]]}"
