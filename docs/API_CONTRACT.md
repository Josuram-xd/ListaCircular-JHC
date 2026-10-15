# Contrato de API: Póker contra bots

Contrato congelado entre backend (FastAPI) y frontend (React). Cualquier cambio se acuerda antes de implementarlo.

## Reglas del juego
- Texas Hold'em, 1 humano (`id: "human"`) + N bots (1 a 8). Fichas iniciales configurables.
- Acciones: `fold`, `call` (incluye `check`), `raise`, `all_in`.
- **Sin side pots.** La apuesta máxima de la mano (`max_bet`) se limita a las fichas del jugador activo con menos fichas. Así todos aportan igual y el bote es único.
- Ciegas fijas: pequeña = `chips_inicial / 100` (mín. 1), grande = el doble.
- Un jugador con 0 fichas al terminar la mano se elimina de la lista circular. La partida termina cuando queda 1 jugador.
- Si el humano se queda sin fichas, la partida termina (`game_over`) con el ganador entre los bots.

## REST

### `POST /games`
Request:
```json
{ "bots": 3, "chips": 1000 }
```
Validación: `1 <= bots <= 8`, `100 <= chips <= 100000`. Error 422 si no cumple.

Response 201:
```json
{ "game_id": "a1b2c3" }
```

### `GET /games/{game_id}`
Devuelve un `state` (ver abajo). 404 si no existe.

## WebSocket `/ws/games/{game_id}`

Al conectar, el servidor envía un `state`. Los mensajes son JSON con campo `type`.

### Cliente a servidor
```json
{ "type": "action", "action": "fold" }
{ "type": "action", "action": "call" }
{ "type": "action", "action": "raise", "amount": 80 }
{ "type": "action", "action": "all_in" }
{ "type": "next_hand" }
```
- `amount` en `raise` es el total al que se sube la apuesta de la ronda (no el incremento).
- `next_hand` solo es válido cuando `phase == "hand_over"`.

### Servidor a cliente
```json
{ "type": "state", "state": { ... } }
{ "type": "bot_action", "player_id": "bot1", "action": "raise", "amount": 80 }
{ "type": "hand_result", "winners": ["bot2"], "pot": 340, "hand_name": "Pareja de Ases", "showdown": { "bot2": ["AS","KD"] } }
{ "type": "game_over", "winner_id": "human" }
{ "type": "error", "code": "illegal_action", "message": "No es tu turno" }
```
- Tras cada mensaje relevante el servidor manda un `state` completo (nunca diffs).
- Los bots actúan con un retardo de ~600 ms entre acciones para poder animarlas.
- Códigos de error: `illegal_action`, `not_your_turn`, `invalid_amount`, `bad_message`.

## Objeto `state`
```json
{
  "game_id": "a1b2c3",
  "phase": "preflop",
  "pot": 30,
  "community": ["AH", "7D", "2C"],
  "current_bet": 20,
  "max_bet": 1000,
  "min_raise": 40,
  "dealer_id": "bot1",
  "turn_id": "human",
  "hand_number": 3,
  "players": [
    {
      "id": "human",
      "name": "Tú",
      "is_bot": false,
      "chips": 980,
      "bet": 20,
      "status": "active",
      "cards": ["KS", "QS"]
    },
    {
      "id": "bot1",
      "name": "Bot 1",
      "is_bot": true,
      "chips": 1000,
      "bet": 10,
      "status": "active",
      "cards": null
    }
  ]
}
```

- `phase`: `waiting | preflop | flop | turn | river | showdown | hand_over | game_over`.
- `players` va **en el orden de la lista circular**, empezando por el humano, para que el front dibuje los asientos en círculo.
- `status`: `active | folded | all_in | out` (`out` = eliminado, ya no aparece en la lista circular pero se mantiene en `players` para el historial).
- `cards`: solo se envían las del humano; las de los bots son `null` hasta el showdown (en `showdown` y `hand_over` las de los jugadores que llegaron al showdown se revelan).
- `turn_id`: `null` si no hay turno (showdown, hand_over, game_over).

### Formato de cartas
Cadena de 2 caracteres: rango + palo. Rangos `2-9, T, J, Q, K, A`. Palos `S` (picas), `H` (corazones), `D` (diamantes), `C` (tréboles). Ejemplo: `TH` = 10 de corazones.

## Requisito del backend: lista circular
El orden de la mesa (dealer, ciegas, turnos, eliminación) debe implementarse con una **lista circular doblemente enlazada de nodos propia** (`NodoJugador` con `siguiente` y `anterior`). No se permite usar `list`/`deque` para el orden de la mesa.
