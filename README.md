# Póker con lista circular

Juego de **Texas Hold'em contra bots** donde el orden de la mesa (dealer, ciegas, turnos y eliminación de jugadores) se maneja con una **lista circular doblemente enlazada de nodos**, implementada desde cero. Además incluye un menú educativo que muestra paso a paso cómo funciona esa lista.

- **Backend:** Python 3.11+, FastAPI, WebSocket.
- **Frontend:** React 19, Vite, TypeScript.
- **Pruebas:** pytest (backend), vitest (frontend) y Playwright (E2E).

## Qué se puede hacer

El menú principal tiene dos opciones:

1. **Jugar póker:** eliges de 1 a 8 bots y las fichas iniciales (100 a 100000) y juegas hasta que queda un solo jugador con fichas.
2. **Cómo funciona la lista circular:** un visualizador interactivo de la misma estructura que usa la mesa.

## Cómo ejecutarlo

Hacen falta dos terminales, una por servidor.

**Terminal 1: backend**
```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000
```

**Terminal 2: frontend**
```powershell
cd frontend
npm install
npm run dev
```

Abre **http://localhost:5173**. Usa `localhost` y no `127.0.0.1`: el CORS del backend solo permite ese origen.

> En PowerShell 5.1 no existe `&&`. Si quieres todo en una línea, usa `;`:
> `cd backend; pip install -r requirements.txt; python -m uvicorn app.main:app --port 8000`

Si Vite no abre en tu máquina, prueba `npm run dev -- --host localhost`.

Para desarrollar el frontend sin backend hay un servidor simulado: `cd frontend; npm run mock` (puerto 8000). Es una partida simplificada, sin evaluador de manos real.

## La lista circular

Cada jugador es un nodo con dos enlaces: `siguiente` y `anterior`. El último nodo apunta al primero y el primero al último, así que no hay principio ni fin: se puede avanzar o retroceder indefinidamente.

```
        ┌──────────────── anterior ────────────────┐
        ▼                                          │
     [ Ana ] ──siguiente──▶ [ Luis ] ──siguiente──▶ [ Eva ]
        ▲                                          │
        └──────────────── siguiente ───────────────┘
```

La implementación está en `backend/app/lista_circular.py` (clases `NodoJugador` y `ListaCircular`):

| Operación | Método | Detalle |
|---|---|---|
| Insertar al final | `insertar(dato)` | Entra entre el último nodo y la cabeza. |
| Insertar al inicio | `insertar_inicio(dato)` | El nuevo nodo pasa a ser la cabeza. |
| Insertar después de un nodo | `insertar_despues(ref, dato)` | Se engancha detrás de `ref`. |
| Eliminar | `eliminar(nodo)` | Cubre cabeza, medio, último y nodo único. Devuelve el dato. |
| Avanzar / retroceder | `avanzar(nodo, pasos)` / `retroceder(nodo, pasos)` | Da la vuelta sin condiciones especiales. `pasos < 0` lanza `ValueError`. |
| Recorrer una vuelta | `nodos(desde)` | Genera cada nodo una sola vez. Lanza `ValueError` si el nodo no pertenece a la lista. |
| Buscar | `buscar(predicado)` | Primer nodo cuyo dato cumple el predicado. |

Casos borde que están cubiertos por tests: lista vacía, un solo nodo apuntándose a sí mismo y eliminar la cabeza o el nodo que se está recorriendo.

### Cómo la usa la mesa de póker

| Mecánica del juego | Operación sobre la lista |
|---|---|
| El botón de dealer rota cada mano | `avanzar` el puntero del dealer. |
| Ciega pequeña y grande | Los dos nodos siguientes al dealer. |
| Turno de apuesta | Recorrer desde el jugador en acción. |
| Un jugador se queda sin fichas | `eliminar` su nodo (si era el dealer, el botón pasa al siguiente). |
| Heads-up (quedan 2) | El dealer es la ciega pequeña y actúa primero antes del flop. |
| Fin de la partida | La lista queda con un solo nodo. |

El orden de la mesa no usa `list` ni `deque`.

## El menú "Cómo funciona la lista circular"

Esta pantalla del frontend usa los endpoints `/demo` del backend, que operan sobre la **misma clase `ListaCircular`** que la mesa. No es una simulación aparte.

- **Dibujo en círculo (SVG):** flechas `siguiente` (trazo sólido) y `anterior` (trazo discontinuo), insignia de **HEAD** y un anillo giratorio en el **puntero** actual. Los nodos afectados por la última operación se resaltan.
- **Botones:** insertar al inicio, al final o después del puntero; eliminar (por nombre o con clic en un nodo); avanzar, retroceder, dar una vuelta completa, reiniciar y cargar un ejemplo de 4 nodos.
- **Panel "Qué pasó":** una frase en español por cada enlace que cambia en la última operación. Por ejemplo, al insertar un nodo explica qué `anterior` y `siguiente` se reasignan para cerrar el círculo.
- **Tabla de enlaces:** nombre, anterior y siguiente de cada nodo.
- **Errores:** nombre repetido, más de 12 nodos u operar sobre una lista vacía se muestran como mensaje.

Un ejercicio sencillo: carga el ejemplo, avanza el puntero, elimina el nodo bajo el puntero y lee en "Qué pasó" a dónde se mueve; luego elimina nodos hasta dejar uno y verás cómo se apunta a sí mismo.

## Cómo funciona la partida

1. `POST /games` crea la partida con `{bots, chips}` y devuelve un `game_id`.
2. El cliente abre el WebSocket `/ws/games/{game_id}`. El servidor siempre envía el **estado completo** (nunca diffs), con las cartas de los bots ocultas hasta el showdown.
3. El humano envía `fold`, `call` (que también hace check), `raise` o `all_in`. Los bots juegan en el servidor y cada acción llega como `bot_action`.
4. Al terminar la mano llega `hand_result` y el humano pulsa "Siguiente mano". Cuando queda un jugador llega `game_over`.

**Reglas simplificadas:** no hay side pots. La apuesta máxima de la mano se limita a las fichas del jugador activo con menos fichas, así todos aportan lo mismo y el bote es único. Los bots deciden por la fuerza de su mano, con algo de azar y faroles.

El contrato completo (mensajes, formato de cartas, códigos de error y de cierre) está en [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Estructura del repositorio

```
backend/
  app/
    lista_circular.py   Lista circular doblemente enlazada (NodoJugador, ListaCircular)
    cartas.py           Baraja
    evaluador.py        Mejor mano de 5 entre 7 cartas, con desempates
    motor.py            Máquina de estados de la mano (ciegas, apuestas, showdown, eliminación)
    bots.py             Decisiones de los bots
    demo.py             Endpoints /demo del visualizador
    main.py             REST + WebSocket
  tests/                pytest
frontend/
  src/                  App, mesa, controles, cliente WebSocket, reducer
  src/demo/             Visualizador de la lista circular
  mock/                 Servidor simulado para desarrollo
e2e/                    Pruebas de extremo a extremo con Playwright
docs/API_CONTRACT.md    Contrato de la API
```

## Pruebas

```powershell
# Backend (173 tests; el fuzz largo está marcado "slow")
cd backend
python -m pytest
python -m pytest -m slow     # 200 partidas completas aleatorias

# Frontend (42 tests)
cd frontend
npm test
npm run build

# E2E (Playwright, 10 pruebas; levanta backend y frontend solos)
cd e2e
npm install
npx playwright install chromium   # solo la primera vez
npm test
```

Las pruebas E2E cubren el menú, la demo de la lista circular y partidas completas con 1, 3 y 8 bots hasta el game over. Si fallan sin razón aparente, cierra los servidores que tengas abiertos: la configuración reutiliza los que encuentre en los puertos 8000 y 5173.

## Límites conocidos

- Las partidas viven en memoria: se pierden al reiniciar el servidor, se descartan tras 30 minutos sin actividad y hay un tope de 200 partidas activas.
- Una sola conexión por partida; una segunda pestaña reemplaza a la primera.
- Sin side pots (ver arriba) y sin autenticación de usuarios.
- El CORS y la validación de `Origin` del WebSocket solo admiten `http://localhost:5173`.
