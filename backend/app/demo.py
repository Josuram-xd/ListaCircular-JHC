"""Demo educativa de la lista circular: usa la ListaCircular real del backend."""
from __future__ import annotations

import secrets
from collections import OrderedDict
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request

from .lista_circular import ListaCircular, NodoJugador

router = APIRouter(prefix="/demo")

MAX_NODOS = 12
MAX_NOMBRE = 12
MAX_LISTAS = 500  # tope de memoria: se descartan las mas antiguas

DONDE = ("start", "end", "after_pointer")


def _error(detalle: str, status: int = 422) -> HTTPException:
    return HTTPException(status_code=status, detail=detalle)


class Demo:
    """Una lista de demostracion: la lista real + el puntero + la ultima operacion."""

    def __init__(self) -> None:
        self.lista = ListaCircular()
        self.puntero: Optional[NodoJugador] = None
        self.last_op: Optional[dict] = None
        self.steps: List[str] = []
        self.highlight: List[str] = []

    def nombres(self) -> List[str]:
        return [n.dato for n in self.lista.nodos()]

    def estado(self, list_id: str) -> dict:
        cab = self.lista.cabeza
        nodos = [
            {
                "name": n.dato,
                "next": n.siguiente.dato,
                "prev": n.anterior.dato,
                "is_head": n is cab,
                "is_pointer": n is self.puntero,
            }
            for n in self.lista.nodos()
        ]
        return {
            "list_id": list_id,
            "size": len(self.lista),
            "pointer": self.puntero.dato if self.puntero else None,
            "nodes": nodos,
            "last_op": self.last_op,
            "steps": self.steps,
            "highlight": self.highlight,
        }

    def _buscar(self, nombre: str) -> NodoJugador:
        n = self.lista.buscar(lambda d: d == nombre)
        if n is None:
            raise _error(f"No existe un nodo llamado '{nombre}'.")
        return n

    def _requiere_no_vacia(self) -> NodoJugador:
        if self.puntero is None:
            raise _error("La lista está vacía: primero inserta un nodo.")
        return self.puntero

    def _validar_nuevo(self, nombre: Any) -> str:
        nombre = _validar_nombre(nombre)
        if len(self.lista) >= MAX_NODOS:
            raise _error(f"La lista ya tiene el máximo de {MAX_NODOS} nodos.")
        if nombre in self.nombres():
            raise _error(f"Ya existe un nodo llamado '{nombre}'; los nombres deben ser únicos.")
        return nombre

    # ---- operaciones ----
    def aplicar(self, body: dict) -> None:
        op = body.get("op")
        if op == "insert":
            self._insertar(body)
        elif op == "remove":
            self._eliminar(body)
        elif op == "advance":
            self._mover(True)
        elif op == "retreat":
            self._mover(False)
        elif op == "lap":
            self._vuelta()
        elif op == "reset":
            self._reset()
        else:
            raise _error("Operación inválida: usa insert, remove, advance, retreat, lap o reset.")

    def _insertar(self, body: dict) -> None:
        nombre = self._validar_nuevo(body.get("name"))
        donde = body.get("where")
        if donde not in DONDE:
            raise _error("El campo 'where' debe ser start, end o after_pointer.")
        lista = self.lista
        X = nombre
        if len(lista) == 0:
            nodo = lista.insertar(nombre)
            self.puntero = nodo
            steps = [
                "La lista está vacía: no hay cabeza ni último nodo.",
                f"Se crea el nodo {X}.",
                f"{X}.siguiente = {X} y {X}.anterior = {X}: el único nodo se apunta a sí mismo, "
                "y eso ya es un círculo.",
                f"{X} pasa a ser la cabeza y el puntero apunta a {X}.",
            ]
            hl = [X]
        elif donde == "after_pointer":
            P = self.puntero
            Q = P.siguiente
            era_ultimo = Q is lista.cabeza
            lista.insertar_despues(P, nombre)
            steps = [
                f"Se crea el nodo {X}.",
                f"{X}.anterior = {P.dato} (el nodo bajo el puntero).",
                f"{X}.siguiente = {Q.dato} (el que seguía a {P.dato}).",
                f"{P.dato}.siguiente = {X}.",
                f"{Q.dato}.anterior = {X}.",
            ]
            if P is Q:
                steps.append(
                    f"Antes {P.dato} se apuntaba a sí mismo; ahora {P.dato} y {X} se apuntan entre sí."
                )
            if era_ultimo:
                steps.append(f"{X} queda como último nodo; la cabeza ({Q.dato}) no cambia.")
            hl = [X, P.dato, Q.dato]
        else:
            H = lista.cabeza
            U = H.anterior
            if donde == "start":
                lista.insertar_inicio(nombre)
            else:
                lista.insertar(nombre)
            steps = [
                f"Se crea el nodo {X}.",
                f"{X}.anterior = {U.dato} (el último actual).",
                f"{X}.siguiente = {H.dato} (la cabeza), así se cierra el círculo.",
                f"{U.dato}.siguiente = {X}.",
                f"{H.dato}.anterior = {X}.",
            ]
            if U is H:
                steps.append(
                    f"Antes {H.dato} se apuntaba a sí mismo; ahora {H.dato} y {X} se apuntan entre sí."
                )
            if donde == "start":
                steps.append(f"{X} pasa a ser la nueva cabeza: la lista ahora empieza en {X}.")
            else:
                steps.append(f"{X} queda como último nodo; la cabeza ({H.dato}) no cambia.")
            hl = [X, U.dato, H.dato]
        self.steps = steps
        self.highlight = list(dict.fromkeys(hl))
        self.last_op = {"op": "insert", "name": nombre, "where": donde}

    def _eliminar(self, body: dict) -> None:
        self._requiere_no_vacia()
        nombre = body.get("name")
        if not isinstance(nombre, str) or not nombre:
            raise _error("Falta el nombre del nodo a eliminar.")
        nodo = self._buscar(nombre)
        lista = self.lista
        N, P, S = nodo.dato, nodo.anterior.dato, nodo.siguiente.dato
        era_cabeza = nodo is lista.cabeza
        era_puntero = nodo is self.puntero
        sig = nodo.siguiente
        tam = len(lista)
        if tam == 1:
            steps = [
                f"{N} era el único nodo y se apuntaba a sí mismo.",
                f"Se elimina {N}: la cabeza y el puntero quedan vacíos.",
                "La lista queda vacía.",
            ]
            self.puntero = None
            hl = [N]
        else:
            if tam == 2:
                steps = [
                    f"{P}.siguiente = {P} (se salta a {N}).",
                    f"{P}.anterior = {P}: el nodo restante se apunta a sí mismo.",
                ]
            else:
                steps = [
                    f"{P}.siguiente = {S} (se salta a {N}).",
                    f"{S}.anterior = {P}.",
                ]
            if era_cabeza:
                steps.append(f"{N} era la cabeza: la cabeza pasa a {S}.")
            if era_puntero:
                steps.append(
                    f"El puntero estaba en {N}: como se elimina, el puntero pasa a {S} (el siguiente)."
                )
                self.puntero = sig
            steps.append(f"{N} queda aislado (se apunta a sí mismo) y sale de la lista.")
            hl = [N, P, S]
        lista.eliminar(nodo)
        self.steps = steps
        self.highlight = list(dict.fromkeys(hl))
        self.last_op = {"op": "remove", "name": N}

    def _mover(self, adelante: bool) -> None:
        P = self._requiere_no_vacia()
        lista = self.lista
        nuevo = lista.avanzar(P) if adelante else lista.retroceder(P)
        op = "advance" if adelante else "retreat"
        enlace = "siguiente" if adelante else "anterior"
        if nuevo is P:
            steps = [
                f"{P.dato} es el único nodo y se apunta a sí mismo ({P.dato}.{enlace} = {P.dato}).",
                "El puntero da la vuelta al círculo y vuelve al mismo nodo: no se mueve.",
            ]
            hl = [P.dato]
        else:
            steps = [
                f"El puntero estaba en {P.dato}.",
                f"Se sigue {P.dato}.{enlace} = {nuevo.dato}: el puntero pasa a {nuevo.dato}.",
            ]
            cab = lista.cabeza
            if adelante and nuevo is cab:
                steps.append(f"{P.dato} era el último: su siguiente es la cabeza, así que el recorrido da la vuelta.")
            if not adelante and P is cab:
                steps.append(f"{P.dato} es la cabeza: su anterior es el último nodo, así que el recorrido da la vuelta.")
            hl = [P.dato, nuevo.dato]
        self.puntero = nuevo
        self.steps = steps
        self.highlight = hl
        self.last_op = {"op": op}

    def _vuelta(self) -> None:
        P = self._requiere_no_vacia()
        lista = self.lista
        visitados = [n.dato for n in lista.nodos(desde=P)]
        steps = [f"Se parte del puntero en {P.dato}."]
        actual = P
        for _ in range(len(lista)):
            sig = lista.avanzar(actual)
            if sig is actual:
                steps.append(f"{actual.dato}.siguiente = {actual.dato}: se apunta a sí mismo.")
            else:
                steps.append(f"{actual.dato}.siguiente = {sig.dato}: se visita {sig.dato}.")
            actual = sig
        steps.append(
            f"Después de {len(lista)} paso(s) se regresa a {P.dato}: vuelta completa y el puntero queda donde empezó."
        )
        self.steps = steps
        self.highlight = visitados
        self.last_op = {"op": "lap"}

    def _reset(self) -> None:
        if len(self.lista) == 0:
            self.steps = ["La lista ya estaba vacía; no hay nada que borrar."]
            self.highlight = []
        else:
            self.steps = [
                f"Se descartan los {len(self.lista)} nodo(s) y se libera la lista.",
                "La cabeza y el puntero quedan vacíos: la lista queda vacía.",
            ]
            self.highlight = []
        self.lista = ListaCircular()
        self.puntero = None
        self.last_op = {"op": "reset"}


def _validar_nombre(nombre: Any) -> str:
    if not isinstance(nombre, str):
        raise _error("El nombre debe ser texto.")
    nombre = nombre.strip()
    if not 1 <= len(nombre) <= MAX_NOMBRE:
        raise _error(f"El nombre debe tener entre 1 y {MAX_NOMBRE} caracteres.")
    return nombre


LISTAS: "OrderedDict[str, Demo]" = OrderedDict()


async def _json(request: Request, requerido: bool) -> dict:
    crudo = await request.body()
    if not crudo.strip():
        if requerido:
            raise _error("Falta el cuerpo JSON de la operación.")
        return {}
    try:
        data = await request.json()
    except ValueError:
        raise _error("El cuerpo no es un JSON válido.")
    if not isinstance(data, dict):
        raise _error("Se esperaba un objeto JSON.")
    return data


def _obtener(list_id: str) -> Demo:
    d = LISTAS.get(list_id)
    if d is None:
        raise _error("Lista no encontrada", 404)
    return d


@router.post("/lists", status_code=201)
async def crear_lista(request: Request):
    body = await _json(request, requerido=False)
    names = body.get("names", [])
    if names is None:
        names = []
    if not isinstance(names, list):
        raise _error("'names' debe ser una lista de nombres.")
    if len(names) > MAX_NODOS:
        raise _error(f"La lista admite como máximo {MAX_NODOS} nodos.")
    limpios = [_validar_nombre(n) for n in names]
    if len(set(limpios)) != len(limpios):
        raise _error("Los nombres deben ser únicos.")
    demo = Demo()
    for n in limpios:
        nodo = demo.lista.insertar(n)
        if demo.puntero is None:
            demo.puntero = nodo
    list_id = secrets.token_hex(2)
    while list_id in LISTAS:
        list_id = secrets.token_hex(3)
    LISTAS[list_id] = demo
    while len(LISTAS) > MAX_LISTAS:
        LISTAS.popitem(last=False)
    return {"list_id": list_id, "state": demo.estado(list_id)}


@router.post("/lists/{list_id}/ops")
async def operar(list_id: str, request: Request):
    demo = _obtener(list_id)
    body = await _json(request, requerido=True)
    demo.aplicar(body)
    return demo.estado(list_id)


@router.get("/lists/{list_id}")
def obtener_lista(list_id: str):
    return _obtener(list_id).estado(list_id)
