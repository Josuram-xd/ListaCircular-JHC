"""Cartas y baraja. Carta = rango + palo, p. ej. 'TH' (10 de corazones)."""
from __future__ import annotations

import random
from typing import List, Optional

RANGOS = "23456789TJQKA"
PALOS = "SHDC"


def valor(carta: str) -> int:
    return RANGOS.index(carta[0]) + 2


def palo(carta: str) -> str:
    return carta[1]


class Baraja:
    def __init__(self, rng: Optional[random.Random] = None):
        self.cartas: List[str] = [r + p for r in RANGOS for p in PALOS]
        (rng or random).shuffle(self.cartas)

    @classmethod
    def desde(cls, cartas: List[str]) -> "Baraja":
        """Baraja con orden fijo (para tests): se reparte desde el principio."""
        b = cls.__new__(cls)
        b.cartas = list(cartas)
        return b

    def repartir(self, n: Optional[int] = None):
        """Sin argumento devuelve 2 cartas (mano); con n devuelve n cartas."""
        if n is None:
            return [self.cartas.pop(0), self.cartas.pop(0)]
        return [self.cartas.pop(0) for _ in range(n)]

    def una(self) -> str:
        return self.cartas.pop(0)
