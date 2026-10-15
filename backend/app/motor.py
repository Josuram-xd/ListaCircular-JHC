"""Motor de Texas Hold'em: maquina de estados de la mano.

El orden de la mesa (dealer, ciegas, turnos, eliminacion) vive en una
ListaCircular doblemente enlazada. `todos` es solo un registro historico.
Sin side pots: la apuesta de la ronda se limita al menor (apuesta + fichas)
entre los jugadores que siguen en la mano.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from .cartas import Baraja
from .evaluador import evaluar, nombre_mano
from .lista_circular import ListaCircular, NodoJugador

FASES_APUESTA = ("preflop", "flop", "turn", "river")
SIGUIENTE_FASE = {"preflop": "flop", "flop": "turn", "turn": "river"}


class GameError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class Jugador:
    id: str
    name: str
    is_bot: bool
    chips: int
    bet: int = 0
    total: int = 0
    status: str = "active"  # active | folded | all_in | out
    cards: List[str] = field(default_factory=list)
    acted: bool = False
    showdown: bool = False


class Game:
    def __init__(self, game_id: str, bots: int, chips: int,
                 rng: Optional[random.Random] = None,
                 baraja_factory: Optional[Callable[..., Baraja]] = None,
                 auto_start: bool = True):
        self.game_id = game_id
        self.rng = rng or random.Random()
        self.baraja_factory = baraja_factory
        self.sb = max(1, chips // 100)
        self.bb = self.sb * 2
        self.mesa = ListaCircular()
        self.todos: List[Jugador] = []
        self._nodos: Dict[str, NodoJugador] = {}
        self._agregar(Jugador("human", "Tú", False, chips))
        for i in range(1, bots + 1):
            self._agregar(Jugador(f"bot{i}", f"Bot {i}", True, chips))
        self.dealer: Optional[NodoJugador] = None
        self.turn: Optional[NodoJugador] = None
        self.phase = "waiting"
        self.hand_number = 0
        self.community: List[str] = []
        self.current_bet = 0
        self.min_inc = self.bb
        self.baraja: Optional[Baraja] = None
        self.reveal = False
        self.winner_id: Optional[str] = None
        # eventos (hand_result/game_over) de una primera mano resuelta al repartir;
        # el servidor los envia al primer cliente que se conecta.
        self.eventos_iniciales: List[dict] = []
        if auto_start:
            self.eventos_iniciales = self.start_hand()

    # ------------------------------------------------------------ utilidades
    def _agregar(self, j: Jugador) -> None:
        self._nodos[j.id] = self.mesa.insertar(j)
        self.todos.append(j)

    def jugador(self, pid: str) -> Jugador:
        return self._nodos[pid].dato

    def _en_mano(self):
        return [n for n in self.mesa.nodos() if n.dato.status in ("active", "all_in")]

    def max_bet(self) -> int:
        vivos = [n.dato.bet + n.dato.chips for n in self._en_mano()]
        return min(vivos) if vivos else 0

    def pot(self) -> int:
        return sum(j.total for j in self.todos)

    def _poner(self, p: Jugador, cantidad: int) -> None:
        cantidad = min(cantidad, p.chips)
        p.chips -= cantidad
        p.bet += cantidad
        p.total += cantidad
        if p.chips == 0:
            p.status = "all_in"

    # ----------------------------------------------------------------- mano
    def start_hand(self) -> List[dict]:
        if self.phase not in ("waiting", "hand_over"):
            raise GameError("illegal_action", "La mano actual no ha terminado")
        self.hand_number += 1
        self.dealer = self.mesa.cabeza if self.dealer is None else self.mesa.avanzar(self.dealer)
        for n in self.mesa.nodos():
            j = n.dato
            j.bet = j.total = 0
            j.acted = j.showdown = False
            j.cards = []
            j.status = "active"
        self.baraja = self.baraja_factory(self.rng) if self.baraja_factory else Baraja(self.rng)
        self.community = []
        self.reveal = False
        self.current_bet = 0
        self.min_inc = self.bb

        if self.mesa.tamano == 2:  # heads-up: dealer = ciega pequena y actua primero
            sb = self.dealer
            bb = sb.siguiente
            primero = sb
        else:
            sb = self.dealer.siguiente
            bb = sb.siguiente
            primero = bb.siguiente
        for n in self.mesa.nodos(sb):
            n.dato.cards = self.baraja.repartir()
        self._poner(sb.dato, self.sb)
        self._poner(bb.dato, self.bb)
        self.current_bet = max(n.dato.bet for n in self.mesa.nodos())
        self._recortar_exceso()
        self.phase = "preflop"
        actor = self._buscar_actor(primero, inclusivo=True)
        if actor is not None:
            self.turn = actor
            return []
        self.turn = None
        return self._cerrar_ronda()

    def _recortar_exceso(self) -> None:
        """Devuelve lo apostado por encima del tope (sin side pots)."""
        tope = self.max_bet()
        for n in self.mesa.nodos():
            p = n.dato
            if p.bet > tope:
                dif = p.bet - tope
                p.bet -= dif
                p.total -= dif
                p.chips += dif
                if p.status == "all_in":
                    p.status = "active"
        self.current_bet = max(n.dato.bet for n in self.mesa.nodos())

    def _necesita(self, p: Jugador) -> bool:
        return p.status == "active" and (not p.acted or p.bet < self.current_bet)

    def _buscar_actor(self, desde: NodoJugador, inclusivo: bool) -> Optional[NodoJugador]:
        activos = [n for n in self.mesa.nodos() if n.dato.status == "active"]
        if len(activos) <= 1 and all(n.dato.bet >= self.current_bet for n in activos):
            return None
        inicio = desde if inclusivo else desde.siguiente
        for n in self.mesa.nodos(inicio):
            if self._necesita(n.dato):
                return n
        return None

    # --------------------------------------------------------------- acciones
    def apply(self, pid: str, action: str, amount: Any = None) -> List[dict]:
        if self.phase not in FASES_APUESTA or self.turn is None:
            raise GameError("illegal_action", "No hay una mano en curso")
        if action not in ("fold", "call", "raise", "all_in"):
            raise GameError("bad_message", "Accion desconocida")
        if self.turn.dato.id != pid:
            raise GameError("not_your_turn", "No es tu turno")
        nodo = self.turn
        p = nodo.dato
        tope = self.max_bet()
        if action == "fold":
            p.status = "folded"
        elif action == "call":
            self._poner(p, self.current_bet - p.bet)
        elif action == "raise":
            if isinstance(amount, bool) or not isinstance(amount, int):
                raise GameError("invalid_amount", "Monto invalido")
            if tope <= self.current_bet:
                raise GameError("illegal_action", "No se puede subir mas")
            if amount > tope or amount <= self.current_bet:
                raise GameError("invalid_amount", f"El monto debe estar entre {self.current_bet + 1} y {tope}")
            if amount < self.current_bet + self.min_inc and amount != tope:
                raise GameError("invalid_amount", f"La subida minima es a {self.current_bet + self.min_inc}")
            self._subir_a(p, amount)
        else:  # all_in
            objetivo = min(p.bet + p.chips, tope)
            if objetivo > self.current_bet:
                self._subir_a(p, objetivo)
            else:
                self._poner(p, self.current_bet - p.bet)
        p.acted = True
        return self._despues_de_actuar(nodo)

    def _subir_a(self, p: Jugador, objetivo: int) -> None:
        self._poner(p, objetivo - p.bet)
        incremento = objetivo - self.current_bet
        if incremento >= self.min_inc:
            self.min_inc = incremento
        self.current_bet = objetivo
        for n in self.mesa.nodos():
            if n.dato is not p:
                n.dato.acted = False

    def next_hand(self) -> List[dict]:
        if self.phase != "hand_over":
            raise GameError("illegal_action", "La mano aun no termina")
        return self.start_hand()

    # ---------------------------------------------------------- flujo de mano
    def _despues_de_actuar(self, nodo: NodoJugador) -> List[dict]:
        if len(self._en_mano()) == 1:
            return self._terminar_por_folds()
        sig = self._buscar_actor(nodo, inclusivo=False)
        if sig is not None:
            self.turn = sig
            return []
        self.turn = None
        return self._cerrar_ronda()

    def _cerrar_ronda(self) -> List[dict]:
        while True:
            if self.phase == "river":
                return self._showdown()
            self.phase = SIGUIENTE_FASE[self.phase]
            for n in self.mesa.nodos():
                n.dato.bet = 0
                n.dato.acted = False
            self.current_bet = 0
            self.min_inc = self.bb
            self.community += self.baraja.repartir(3 if self.phase == "flop" else 1)
            actor = self._buscar_actor(self.dealer, inclusivo=False)
            if actor is not None:
                self.turn = actor
                return []

    def _terminar_por_folds(self) -> List[dict]:
        ganador = self._en_mano()[0].dato
        return self._repartir([ganador], "Sin showdown", {})

    def _showdown(self) -> List[dict]:
        puntajes = {n.dato.id: evaluar(n.dato.cards + self.community) for n in self._en_mano()}
        mejor = max(puntajes.values())
        ganadores = [n.dato for n in self.mesa.nodos(self.dealer.siguiente)
                     if n.dato.id in puntajes and puntajes[n.dato.id] == mejor]
        muestra = {}
        for n in self._en_mano():
            n.dato.showdown = True
            muestra[n.dato.id] = list(n.dato.cards)
        self.reveal = True
        return self._repartir(ganadores, nombre_mano(mejor), muestra)

    def _repartir(self, ganadores: List[Jugador], nombre: str, muestra: dict) -> List[dict]:
        bote = self.pot()
        parte, resto = divmod(bote, len(ganadores))
        for i, g in enumerate(ganadores):
            g.chips += parte + (1 if i < resto else 0)
        for j in self.todos:
            j.bet = j.total = 0
        self.turn = None
        self.current_bet = 0
        eventos = [{"type": "hand_result", "winners": [g.id for g in ganadores],
                    "pot": bote, "hand_name": nombre, "showdown": muestra}]
        self.eliminar_sin_fichas()
        humano_vivo = self.jugador("human").status != "out"
        if not humano_vivo or self.mesa.tamano == 1:
            if self.mesa.tamano == 1:
                self.winner_id = self.mesa.cabeza.dato.id
            else:
                self.winner_id = max(self.mesa, key=lambda j: j.chips).id
            self.phase = "game_over"
            eventos.append({"type": "game_over", "winner_id": self.winner_id})
        else:
            self.phase = "hand_over"
        return eventos

    def eliminar_sin_fichas(self) -> None:
        for n in self.mesa.nodos():
            if n.dato.chips == 0:
                if self.dealer is n and self.mesa.tamano > 1:
                    self.dealer = self.mesa.retroceder(n)
                n.dato.status = "out"
                n.dato.cards = []
                n.dato.showdown = False
                self.mesa.eliminar(n)

    # ------------------------------------------------------------------ estado
    def state(self) -> dict:
        h = self._nodos["human"]
        if h._lista is self.mesa:
            orden = [n.dato for n in self.mesa.nodos(h)]
        else:
            orden = [n.dato for n in self.mesa.nodos()]
        orden += [j for j in self.todos if j.status == "out"]
        tope = self.max_bet()
        jugando = self.phase in FASES_APUESTA
        min_raise = min(self.current_bet + self.min_inc, max(tope, self.current_bet))
        players = []
        for j in orden:
            if not j.is_bot:
                cartas = list(j.cards) if j.cards else None
            else:
                cartas = list(j.cards) if (self.reveal and j.showdown) else None
            players.append({"id": j.id, "name": j.name, "is_bot": j.is_bot, "chips": j.chips,
                            "bet": j.bet, "status": j.status, "cards": cartas})
        return {
            "game_id": self.game_id,
            "phase": self.phase,
            "pot": self.pot(),
            "community": list(self.community),
            "current_bet": self.current_bet,
            "max_bet": tope,
            "min_raise": min_raise,
            "dealer_id": self.dealer.dato.id if self.dealer else None,
            "turn_id": self.turn.dato.id if (self.turn and jugando) else None,
            "hand_number": self.hand_number,
            "players": players,
        }
