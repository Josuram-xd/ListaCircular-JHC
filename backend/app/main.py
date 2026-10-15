"""API REST + WebSocket del poker contra bots."""
from __future__ import annotations

import asyncio
import json
import os
import secrets
import time
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .bots import decidir
from .demo import router as demo_router
from .motor import FASES_APUESTA, Game, GameError

# Retardo entre acciones de bots (segundos). Configurable: env POKER_BOT_DELAY
# o `settings["bot_delay"] = 0` en tests.
settings = {"bot_delay": float(os.environ.get("POKER_BOT_DELAY", "0.6"))}


MAX_SESIONES = 200          # tope duro de partidas simultaneas
INACTIVIDAD_MAX = 30 * 60   # segundos sin actividad antes de limpiar
GAME_OVER_MAX = 5 * 60      # segundos que se conserva una partida terminada


def _ahora() -> float:
    return time.monotonic()


class Sesion:
    def __init__(self, game: Game):
        self.game = game
        self.lock = asyncio.Lock()
        self.last_activity = _ahora()
        self.ws_activo: Optional[WebSocket] = None

    def tocar(self) -> None:
        self.last_activity = _ahora()


SESIONES: Dict[str, Sesion] = {}

app = FastAPI(title="Poker vs Bots")
ORIGENES_PERMITIDOS = ["http://localhost:5173"]
MAX_MENSAJE = 4096  # caracteres maximos por mensaje WS

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES_PERMITIDOS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(demo_router)


class NuevaPartida(BaseModel):
    bots: int = Field(ge=1, le=8)
    chips: int = Field(ge=100, le=100000)


def _limpiar_sesiones() -> None:
    """Elimina partidas inactivas (>30 min) o terminadas hace mas de 5 min."""
    ahora = _ahora()
    for gid, s in list(SESIONES.items()):
        inactiva = ahora - s.last_activity
        if inactiva > INACTIVIDAD_MAX or (s.game.phase == "game_over" and inactiva > GAME_OVER_MAX):
            del SESIONES[gid]


@app.post("/games", status_code=201)
def crear_partida(body: NuevaPartida):
    _limpiar_sesiones()
    if len(SESIONES) >= MAX_SESIONES:
        raise HTTPException(status_code=503,
                            detail="Hay demasiadas partidas activas, intenta de nuevo mas tarde")
    game_id = secrets.token_urlsafe(16)
    while game_id in SESIONES:
        game_id = secrets.token_urlsafe(16)
    SESIONES[game_id] = Sesion(Game(game_id, body.bots, body.chips))
    return {"game_id": game_id}


@app.get("/games/{game_id}")
async def obtener_partida(game_id: str):
    s = SESIONES.get(game_id)
    if s is None:
        raise HTTPException(status_code=404, detail="Partida no encontrada")
    async with s.lock:  # no leer el estado a mitad de una mutacion
        s.tocar()
        return s.game.state()


async def _enviar(ws: WebSocket, msg: dict) -> None:
    await ws.send_json(msg)


async def _enviar_estado(ws: WebSocket, game: Game) -> None:
    await _enviar(ws, {"type": "state", "state": game.state()})


async def _turno_de_bot(game: Game) -> bool:
    return game.phase in FASES_APUESTA and game.turn is not None and game.turn.dato.is_bot


def _etiqueta_bot(game: Game, pid: str, accion: str, monto) -> tuple:
    """(accion, monto) que se muestra al cliente; igualar sin fichas es 'check'."""
    p = game.jugador(pid)
    if accion == "call":
        if game.current_bet - p.bet == 0:
            return "check", None
        return "call", game.current_bet
    if accion == "raise":
        return "raise", monto
    if accion == "all_in":
        return "all_in", min(p.bet + p.chips, game.max_bet())
    return accion, None


async def _correr_bots(ws: WebSocket, game: Game) -> None:
    while await _turno_de_bot(game):
        if settings["bot_delay"] > 0:
            await asyncio.sleep(settings["bot_delay"])
        pid = game.turn.dato.id
        accion, monto = decidir(game, pid)
        mostrado_accion, mostrado = _etiqueta_bot(game, pid, accion, monto)
        try:
            eventos = game.apply(pid, accion, monto)
        except GameError:  # red de seguridad: jamas dejar la partida colgada
            mostrado_accion, mostrado = _etiqueta_bot(game, pid, "call", None)
            eventos = game.apply(pid, "call")
        accion = mostrado_accion
        await _enviar(ws, {"type": "bot_action", "player_id": pid, "action": accion, "amount": mostrado})
        await _enviar_estado(ws, game)
        for e in eventos:
            await _enviar(ws, e)


@app.websocket("/ws/games/{game_id}")
async def ws_partida(ws: WebSocket, game_id: str):
    sesion = SESIONES.get(game_id)
    await ws.accept()
    origen = ws.headers.get("origin")
    if origen is not None and origen not in ORIGENES_PERMITIDOS:
        await ws.close(code=4403)
        return
    if sesion is None:
        await ws.close(code=4404)
        return
    game = sesion.game
    anterior = sesion.ws_activo
    sesion.ws_activo = ws  # una sola conexion activa por partida
    if anterior is not None:
        try:
            await anterior.close(code=4409)
        except Exception:
            pass
    try:
        async with sesion.lock:
            sesion.tocar()
            await _enviar_estado(ws, game)
            pendientes, game.eventos_iniciales = game.eventos_iniciales, []
            for e in pendientes:
                await _enviar(ws, e)
            await _correr_bots(ws, game)
        while True:
            mensaje = await ws.receive()
            if mensaje["type"] == "websocket.disconnect":
                return
            texto = mensaje.get("text")
            async with sesion.lock:
                sesion.tocar()
                if texto is None:
                    await _error(ws, "bad_message", "Se esperaba un mensaje de texto")
                elif len(texto) > MAX_MENSAJE:
                    await _error(ws, "bad_message", "Mensaje demasiado largo")
                else:
                    await _procesar(ws, game, texto)
    except (WebSocketDisconnect, RuntimeError):
        return
    finally:
        if sesion.ws_activo is ws:
            sesion.ws_activo = None


async def _error(ws: WebSocket, code: str, message: str) -> None:
    await _enviar(ws, {"type": "error", "code": code, "message": message})


async def _procesar(ws: WebSocket, game: Game, texto: str) -> None:
    try:
        msg = json.loads(texto)
    except (ValueError, RecursionError):
        return await _error(ws, "bad_message", "JSON invalido")
    if not isinstance(msg, dict):
        return await _error(ws, "bad_message", "Se esperaba un objeto JSON")
    tipo = msg.get("type")
    try:
        if tipo == "action":
            eventos = game.apply("human", msg.get("action"), msg.get("amount"))
        elif tipo == "next_hand":
            eventos = game.next_hand()
        else:
            return await _error(ws, "bad_message", "Tipo de mensaje desconocido")
    except GameError as e:
        return await _error(ws, e.code, e.message)
    await _enviar_estado(ws, game)
    for e in eventos:
        await _enviar(ws, e)
    await _correr_bots(ws, game)
