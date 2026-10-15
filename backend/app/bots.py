"""Bot: decide por fuerza de mano (0..1) con algo de azar."""
from __future__ import annotations

import random
from typing import Optional, Tuple

from .cartas import valor, palo
from .evaluador import evaluar
from .motor import Game


def fuerza_preflop(cartas) -> float:
    a, b = sorted((valor(cartas[0]), valor(cartas[1])), reverse=True)
    f = (a + b) / 56.0  # 0.14 .. 1.0
    if a == b:
        f = 0.55 + a / 28.0 * 0.45
    if palo(cartas[0]) == palo(cartas[1]):
        f += 0.06
    if a != b and a - b <= 2:
        f += 0.04
    return max(0.0, min(1.0, f))


def fuerza_postflop(cartas, comunitarias) -> float:
    p = evaluar(list(cartas) + list(comunitarias))
    categoria = p[0]
    base = {0: 0.15, 1: 0.45, 2: 0.65, 3: 0.75, 4: 0.82, 5: 0.86, 6: 0.93, 7: 0.97, 8: 1.0}[categoria]
    if categoria == 0:
        base += p[1] / 14 * 0.1
    if categoria == 1:  # una pareja alta vale mas
        base += p[1] / 14 * 0.12
    return min(1.0, base)


def decidir(game: Game, pid: str, rng: Optional[random.Random] = None) -> Tuple[str, Optional[int]]:
    """Devuelve (accion, monto) siempre legal para el estado actual."""
    rng = rng or random
    p = game.jugador(pid)
    if game.community:
        f = fuerza_postflop(p.cards, game.community)
    else:
        f = fuerza_preflop(p.cards)
    f += rng.uniform(-0.12, 0.12)
    if rng.random() < 0.06:  # farol ocasional
        f = max(f, 0.8)
    por_pagar = game.current_bet - p.bet
    tope = game.max_bet()
    minimo = min(game.current_bet + game.min_inc, tope)
    puede_subir = tope > game.current_bet

    def subir(fraccion: float):
        if not puede_subir:
            return ("call", None)
        objetivo = game.current_bet + int(max(game.pot(), game.bb) * fraccion)
        objetivo = max(minimo, min(objetivo, tope))
        if objetivo >= p.bet + p.chips:
            return ("all_in", None)
        return ("raise", objetivo)

    if por_pagar == 0:
        if f > 0.7 and rng.random() < 0.7:
            return subir(rng.choice((0.5, 0.75, 1.0)))
        return ("call", None)  # check
    ratio = por_pagar / max(1, p.chips + p.bet)
    if f > 0.92 and rng.random() < 0.35:
        return ("all_in", None)
    if f > 0.75 and rng.random() < 0.6:
        return subir(rng.choice((0.5, 1.0)))
    if f >= 0.3 + ratio * 0.5:
        return ("call", None)
    return ("fold", None)
