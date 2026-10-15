"""Lista circular doblemente enlazada que modela el orden de la mesa."""
from __future__ import annotations

from typing import Any, Callable, Iterator, Optional


class NodoJugador:
    """Nodo de la lista circular: guarda un dato y enlaces siguiente/anterior."""

    __slots__ = ("dato", "siguiente", "anterior", "_lista")

    def __init__(self, dato: Any):
        self.dato = dato
        self.siguiente: NodoJugador = self
        self.anterior: NodoJugador = self
        self._lista: Optional["ListaCircular"] = None

    def __repr__(self) -> str:
        return f"NodoJugador({self.dato!r})"


class ListaCircular:
    def __init__(self) -> None:
        self.cabeza: Optional[NodoJugador] = None
        self._tamano = 0

    @property
    def tamano(self) -> int:
        return self._tamano

    def __len__(self) -> int:
        return self._tamano

    def insertar(self, dato: Any) -> NodoJugador:
        """Inserta al final (justo antes de la cabeza). Devuelve el nodo."""
        nodo = NodoJugador(dato)
        nodo._lista = self
        if self.cabeza is None:
            self.cabeza = nodo
        else:
            ultimo = self.cabeza.anterior
            nodo.siguiente = self.cabeza
            nodo.anterior = ultimo
            ultimo.siguiente = nodo
            self.cabeza.anterior = nodo
        self._tamano += 1
        return nodo

    def eliminar(self, nodo: NodoJugador) -> Any:
        """Elimina el nodo (cabeza, medio, ultimo o unico). Devuelve su dato."""
        if nodo is None or nodo._lista is not self:
            raise ValueError("El nodo no pertenece a esta lista")
        if self._tamano == 1:
            self.cabeza = None
        else:
            nodo.anterior.siguiente = nodo.siguiente
            nodo.siguiente.anterior = nodo.anterior
            if self.cabeza is nodo:
                self.cabeza = nodo.siguiente
        nodo.siguiente = nodo
        nodo.anterior = nodo
        nodo._lista = None
        self._tamano -= 1
        return nodo.dato

    def avanzar(self, nodo: Optional[NodoJugador], pasos: int = 1) -> NodoJugador:
        if nodo is None or nodo._lista is not self:
            raise ValueError("Nodo invalido")
        for _ in range(pasos):
            nodo = nodo.siguiente
        return nodo

    def retroceder(self, nodo: Optional[NodoJugador], pasos: int = 1) -> NodoJugador:
        if nodo is None or nodo._lista is not self:
            raise ValueError("Nodo invalido")
        for _ in range(pasos):
            nodo = nodo.anterior
        return nodo

    def nodos(self, desde: Optional[NodoJugador] = None) -> Iterator[NodoJugador]:
        """Recorre una vuelta completa de nodos empezando en `desde` (o la cabeza)."""
        inicio = desde if desde is not None else self.cabeza
        if inicio is None:
            return
        actual = inicio
        for _ in range(self._tamano):
            siguiente = actual.siguiente  # permite eliminar el actual al iterar
            yield actual
            actual = siguiente

    def __iter__(self) -> Iterator[Any]:
        for n in self.nodos():
            yield n.dato

    def buscar(self, predicado: Callable[[Any], bool]) -> Optional[NodoJugador]:
        for n in self.nodos():
            if predicado(n.dato):
                return n
        return None
