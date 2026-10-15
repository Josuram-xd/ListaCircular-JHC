# Frontend de poker (React + Vite + TS)

- `npm install`
- `npm run mock` : servidor mock del contrato en http://localhost:8000 (variables `PORT`, `BOT_DELAY`)
- `npm run dev` : app en http://localhost:5173 (usa `VITE_API_URL`, por defecto http://localhost:8000)
- `npm test` / `npm run build`

## Menú y demo de la lista circular

La app abre en un menú (navegación por estado, sin router): "Jugar póker" (configuración -> mesa) y
"Cómo funciona la lista circular" (visualizador que usa `POST /demo/lists` y `POST /demo/lists/{id}/ops`).
El mock (`npm run mock`) implementa `/demo` con explicaciones simples; el backend real manda las suyas.

### `data-testid` estables (para E2E)

| Pantalla | testid |
|---|---|
| Menú | `menu-screen`, `menu-play`, `menu-demo` |
| Volver al menú | `setup-back` (configuración), `game-menu` (mesa), `demo-back` (demo) |
| Demo | `demo-screen`, `demo-name-input`, `demo-example`, `demo-reset` |
| Operaciones | `demo-insert-start`, `demo-insert-end`, `demo-insert-after`, `demo-remove`, `demo-advance`, `demo-retreat`, `demo-lap` |
| Resultado | `demo-steps` (panel "Qué pasó"), `demo-step` (cada paso), `demo-error` (detail de 404/422), `demo-table`, `demo-row-<nombre>` |
| Gráfico SVG | `demo-graph`, `demo-empty`, `demo-self-loop` (1 nodo), `demo-node-<nombre>` (con `data-head`, `data-pointer`, `data-highlight` = "true"/"false"; clic elimina el nodo), `demo-next-<nombre>`, `demo-prev-<nombre>` |
