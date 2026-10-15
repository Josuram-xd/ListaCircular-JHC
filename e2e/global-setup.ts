/**
 * Verifica que en localhost:8000 responde el backend real (FastAPI "Poker vs Bots")
 * y no el mock del frontend u otro proceso que ocupe el puerto.
 */
export default async function globalSetup() {
  let title = ''
  try {
    const res = await fetch('http://localhost:8000/openapi.json')
    if (res.ok) title = ((await res.json()) as { info?: { title?: string } }).info?.title ?? ''
  } catch { /* sin respuesta */ }
  if (title !== 'Poker vs Bots') {
    throw new Error(
      'En http://localhost:8000 no responde el backend real (FastAPI "Poker vs Bots"). ' +
      '¿Hay otro proceso (p. ej. `npm run mock`) ocupando el puerto 8000?',
    )
  }
}
