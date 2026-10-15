# Backend: Poker contra bots

FastAPI + WebSocket. Contrato en `../docs/API_CONTRACT.md`.

## Correr
```
cd backend
python -m venv .venv && .venv\Scripts\activate   # opcional
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Retardo de los bots (segundos, por defecto 0.6): variable de entorno `POKER_BOT_DELAY`.

## Tests
```
cd backend
python -m pytest
```

## Estructura
- `app/lista_circular.py`: lista circular doblemente enlazada (orden de la mesa).
- `app/cartas.py`, `app/evaluador.py`: baraja y mejor mano de 5 entre 7.
- `app/motor.py`: maquina de estados de la mano. `app/bots.py`: IA de los bots.
- `app/main.py`: REST y WebSocket.

## Demo de la lista circular
`app/demo.py` expone endpoints educativos que operan sobre la `ListaCircular` real (no una copia):
`POST /demo/lists`, `POST /demo/lists/{id}/ops` (`insert`, `remove`, `advance`, `retreat`, `lap`, `reset`) y
`GET /demo/lists/{id}`. Cada respuesta incluye `steps` (una frase en español por enlace que cambia, con los
casos borde) y `highlight`. Tests en `tests/test_demo.py`. Contrato en `docs/API_CONTRACT.md`.
