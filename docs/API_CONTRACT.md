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

## Demo de la lista circular (menú educativo)

Sirve para mostrar paso a paso cómo funciona la lista circular doblemente enlazada **real** del backend (la misma clase `ListaCircular` que usa la mesa). El estado vive en memoria, independiente de las partidas.

### `POST /demo/lists`
Request opcional: `{ "names": ["Ana", "Luis", "Eva"] }` (0 a 12 nombres). Sin body, crea una lista vacía.
Response 201: `{ "list_id": "x1y2", "state": <DemoState> }`.

### `POST /demo/lists/{list_id}/ops`
Request:
```json
{ "op": "insert", "name": "Marta", "where": "end" }
{ "op": "remove", "name": "Luis" }
{ "op": "advance" }
{ "op": "retreat" }
{ "op": "lap" }
{ "op": "reset" }
```
- `where` en `insert`: `start | end | after_pointer`. Máximo 12 nodos; nombres únicos, 1 a 12 caracteres.
- `lap` recorre una vuelta completa desde el puntero y vuelve al punto de partida.
- Errores: 404 lista inexistente, 422 operación o datos inválidos (con `detail` en español).
Response 200: `<DemoState>`.

### `GET /demo/lists/{list_id}`
Response: `<DemoState>`.

### `DemoState`
```json
{
  "list_id": "x1y2",
  "size": 3,
  "pointer": "Ana",
  "nodes": [
    { "name": "Ana",  "next": "Luis", "prev": "Eva",  "is_head": true,  "is_pointer": true },
    { "name": "Luis", "next": "Eva",  "prev": "Ana",  "is_head": false, "is_pointer": false },
    { "name": "Eva",  "next": "Ana",  "prev": "Luis", "is_head": false, "is_pointer": false }
  ],
  "last_op": { "op": "insert", "name": "Eva", "where": "end" },
  "steps": [
    "Se crea el nodo Eva.",
    "Eva.anterior = Luis (el último actual).",
    "Eva.siguiente = Ana (la cabeza), así se cierra el círculo.",
    "Luis.siguiente = Eva y Ana.anterior = Eva."
  ],
  "highlight": ["Eva", "Luis", "Ana"]
}
```
- `nodes` va en el orden de recorrido a partir de la cabeza (`is_head`).
- `steps`: explicación en español, una frase por cada enlace que cambia en la última operación. Debe cubrir los casos borde (lista vacía, un solo nodo apuntándose a sí mismo, eliminar la cabeza, eliminar el puntero).
- `highlight`: nombres de los nodos afectados, para resaltarlos en la interfaz.
- Con la lista vacía: `size: 0`, `pointer: null`, `nodes: []`.

### Decisiones de la demo (implementadas en el backend)
- Estado inicial tras `POST /demo/lists`: `last_op: null`, `steps: []`, `highlight: []`.
- El puntero inicial es el primer nodo creado; insertar no mueve el puntero. Insertar al inicio cambia la cabeza; insertar al final no.
- Eliminar el nodo bajo el puntero mueve el puntero al siguiente (si era el último, vuelve a la cabeza). Eliminar la cabeza pasa la cabeza al siguiente. Eliminar el único nodo deja la lista vacía y `pointer: null`.
- `lap` no mueve el puntero.
- `advance`, `retreat`, `lap` y `remove` sobre una lista vacía responden 422 con `detail` ("La lista está vacía…"). Un nombre inexistente en `remove` también es 422. El 404 es solo para lista inexistente.
- Los nombres se recortan con `strip()` y la unicidad distingue mayúsculas ("ana" y "Ana" son distintos).
- El servidor guarda como máximo 500 listas de demo (descarta las más antiguas).
